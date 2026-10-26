import { C } from '../palette';
import type { Game } from '../game';
import type { Animal } from '../entities/animal';
import { SPECIES } from '../entities/species';
import { MW, FIELDS, TS, Ter, WOODPILE, regionById, type FieldSite, type SpeciesId, type WorldMap } from '../world/map';
import { ARCH, PLOTS, SPOTS, type StepId } from '../ranch/village';
import { SEASON_DAYS } from './season';
import type { MorningBanner } from './seasonal';
import { hourToT } from './orders';
import { calmRating } from '../game';

// The valley grows. Three kinds of thing, each with herding to do:
//
// - The village at the crossroads (src/ranch/village.ts): a well at first,
//   then cottages, a market square, a smithy and a hall, each built the
//   morning after the player has done something (fill orders, pen cattle,
//   clear a paddock, win a ribbon). The square brings a market day (the
//   third of each season: the drover pays half again, goods sell dearer);
//   the hall brings festivals (the last day of each season: parade five of
//   a kind through the arch on the green).
// - Fields past the clearing, off the ranch's south side: land to buy (nip
//   at the sign), overgrown. A bought field takes paddocks and fences at
//   once; stock grazing there, penned or loose, eats the scrub down tile by
//   tile, and once it is clear anything can be built on it (wildflowers
//   come up in it).
// - The old bridge at the ford: once the smith has forged an ox yoke, a cow
//   driven through the woodpile in the ford meadow picks up a log, and a log
//   brought to the bridge mends it a little. Six logs and cattle cross the
//   ford dry-shod, without balking.
//
// Buildings on the ranch with work of their own are in farmwork.ts.

export const BRIDGE_LOGS = 6;
const CLEAR_AT = 0.1; // a paddock is clear when this much scrub is left
// How fast each kind eats scrub (per second): an animal grazing in a
// paddock crops the rankest tile within reach (two tiles) and tramples its
// own a little. Goats are made for it; ducks eat bugs.
const GRAZE: Record<SpeciesId, number> = { duck: 0, sheep: 1 / 22, goat: 1 / 11, cow: 1 / 15, pony: 1 / 22 };

interface StepDef {
  id: StepId;
  name: string; // what appears
  deed: string; // what the player does to bring it
  after: StepId | null;
  done: (g: Game) => boolean;
  line: string; // the morning banner's small line
}

// The Map session's projects (systems/projects.ts, from projects-r4): once
// they are merged in, the third cottage is the shepherd's, and comes when
// the shepherd's hut is mended. (A lazy glob: it only asks whether the
// file is there.)
const PROJECTS = Object.keys(import.meta.glob('./projects.ts')).length > 0;
const hutMended = (g: Game) => !!(g as { projects?: { isDone(id: string): boolean } }).projects?.isDone('hut');

const penned = (g: Game, sp?: SpeciesId) => g.ranch.pens.reduce((n, p) => n + p.animals.filter((a) => !a.young && (!sp || a.sp.id === sp)).length, 0);

export const STEPS: StepDef[] = [
  { id: 'cottage1', name: 'A COTTAGE', deed: 'FILL AN ORDER FOR A BUYER', after: null, done: (g) => g.totals.orders >= 1, line: 'A FAMILY MOVES INTO A COTTAGE AT THE CROSSROADS' },
  { id: 'square', name: 'THE MARKET SQUARE', deed: 'FILL 4 ORDERS', after: 'cottage1', done: (g) => g.totals.orders >= 4, line: 'MARKET DAY IS THE THIRD OF EACH SEASON: THE DROVER PAYS MORE' },
  { id: 'cottage2', name: 'A SECOND COTTAGE', deed: 'GRAZE A FIELD CLEAR', after: 'cottage1', done: (g) => g.valley.fields.some((p) => p.cleared), line: 'ANOTHER FAMILY MOVES IN' },
  { id: 'smithy', name: 'THE SMITHY', deed: 'PEN 4 CATTLE', after: 'square', done: (g) => penned(g, 'cow') >= 4, line: 'THE SMITH CAN FORGE AN OX YOKE: THE OLD BRIDGE AT THE FORD CAN BE MENDED' },
  { id: 'hall', name: 'THE VILLAGE HALL', deed: 'WIN A RIBBON AT A TRIAL OR THE FAIR', after: 'square', done: (g) => g.totals.ribbons.some((n) => n > 0) || g.totals.fairRibbons.some((n) => n > 0), line: 'A FESTIVAL ON THE GREEN THE LAST DAY OF EACH SEASON' },
  PROJECTS
    ? { id: 'cottage3', name: "THE SHEPHERD'S COTTAGE", deed: "MEND THE SHEPHERD'S HUT", after: 'cottage2', done: hutMended, line: "THE SHEPHERD'S FAMILY MOVES IN: THE VILLAGE IS FULL OF LIFE" }
    : { id: 'cottage3', name: 'A THIRD COTTAGE', deed: 'HAVE 40 ANIMALS PENNED', after: 'cottage2', done: (g) => penned(g) >= 40, line: 'THE VILLAGE IS FULL OF LIFE' },
];

export interface FieldState {
  site: FieldSite;
  tiles: number[]; // ty * MW + tx
  index: Map<number, number>; // tile -> its place in `tiles`
  scrub: Float32Array; // per tile, 1 = overgrown .. 0 = grazed
  cleared: boolean;
  owned: boolean; // bought
  shown: number; // last quarter announced
  mouth: { x: number; y: number }; // where it opens onto the ranch (its sign)
}

export class Valley {
  fields: FieldState[] = [];
  private mask: Uint8Array; // paddock index + 1 per tile
  logs = 0;
  bridge = false;
  newcomer: { step: StepId; day: number } | null = null; // for the townsfolk
  parades = 0;
  paradeDone = false; // today's festival
  paraded = new Map<Animal, number>(); // crossed the arch: when
  side = new Map<Animal, number>(); // which side of the arch

  constructor(map: WorldMap) {
    this.mask = new Uint8Array(map.region.length);
    const ranch = regionById('ranch');
    for (const site of FIELDS) {
      const tiles: number[] = [];
      let mx = 0, my = 0, md = -1;
      for (let ty = Math.floor(site.cy - site.ry - 2); ty <= site.cy + site.ry + 2; ty++)
        for (let tx = Math.floor(site.cx - site.rx - 2); tx <= site.cx + site.rx + 2; tx++) {
          const i = ty * MW + tx;
          if (map.region[i] !== ranch.index || map.t(tx, ty) !== Ter.Grass || this.mask[i]) continue;
          const d = ((tx + 0.5 - site.cx) / site.rx) ** 2 + ((ty + 0.5 - site.cy) / site.ry) ** 2;
          const dr = ((tx + 0.5 - ranch.cx) / ranch.rx) ** 2 + ((ty + 0.5 - ranch.cy) / ranch.ry) ** 2;
          if (d > 1.3 || dr <= 1) continue;
          tiles.push(i);
          this.mask[i] = this.fields.length + 1;
          // The sign stands at the paddock tile nearest the ranch's middle.
          const near = 1 / (1 + Math.hypot(tx - ranch.cx, ty - ranch.cy));
          if (near > md) { md = near; mx = tx; my = ty; }
        }
      this.fields.push({ site, tiles, index: new Map(tiles.map((t, j) => [t, j])), scrub: new Float32Array(tiles.length).fill(1), cleared: false, owned: false, shown: 0, mouth: { x: mx * TS + 4, y: my * TS + 4 } });
    }
  }

  // Building land: null if not a field; true once bought.
  landAt(tx: number, ty: number): boolean | null {
    const k = this.mask[ty * MW + tx];
    return k ? this.fields[k - 1].owned : null;
  }

  // On a field still under scrub only paddocks and fences go up.
  landProblem(kind: string, tx: number, ty: number, w: number, h: number): string | null {
    if (kind === 'pen' || kind === 'fence' || kind === 'gate') return null;
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (this.scrubAt(x, y) > 0.1) return 'GRAZE THIS FIELD CLEAR FIRST';
    return null;
  }

  // Scrub left on a tile, 0..1 (0 off the fields or once cleared).
  scrubAt(tx: number, ty: number): number {
    const k = this.mask[ty * MW + tx];
    if (!k) return 0;
    const p = this.fields[k - 1];
    if (p.cleared) return 0;
    const j = p.index.get(ty * MW + tx);
    return j === undefined ? 0 : p.scrub[j];
  }

  left(p: FieldState) {
    let s = 0;
    for (const v of p.scrub) s += v;
    return s / Math.max(1, p.scrub.length);
  }

  fieldAt(px: number, py: number): FieldState | null {
    const k = this.mask[Math.floor(py / TS) * MW + Math.floor(px / TS)];
    return k ? this.fields[k - 1] : null;
  }
}

// ---- Helpers for the rest of the game ----

export const isMarketDay = (g: Game) => g.ranch.village.has('square') && g.season.dayOf === 3 && !g.season.forced;
export const isFestival = (g: Game) => g.ranch.village.has('hall') && g.season.dayOf === SEASON_DAYS && !g.season.forced;
export const woodpile = () => ({ x: WOODPILE.tx * TS + 8, y: WOODPILE.ty * TS + 8 });
export function bridgeLanding(g: Game) {
  const b = g.map.bridgeSpan();
  return { x: b.x0 * TS - 6, y: ((b.y0 + b.y1) / 2) * TS };
}

// The next step the village could take, and what it waits on.
export function nextStep(g: Game): StepDef | null {
  return STEPS.find((s) => !g.ranch.village.has(s.id)) ?? null;
}

// ---- The day ----

export function valleyMorning(g: Game, fresh: boolean): MorningBanner[] {
  const out: MorningBanner[] = [];
  g.map.setBridge(g.valley.bridge);
  if (!fresh) return out;
  const v = g.valley;
  // At most one step of the village a morning: the first whose deed is
  // done (and whose step before it stands).
  const step = STEPS.find((s) => !g.ranch.village.has(s.id) && (!s.after || g.ranch.village.has(s.after)) && s.done(g));
  if (step) {
    g.ranch.village.built.add(step.id);
    g.ranch.village.builtDay[step.id] = g.day.day;
    g.ranch.restamp();
    v.newcomer = { step: step.id, day: g.day.day };
    out.push({ big: `THE VILLAGE GROWS: ${step.name}`, small: step.line, prio: 3 });
    if (!g.tipsSeen.has('village')) {
      g.tipsSeen.add('village');
      g.tip = { text: 'THE VILLAGE AT THE CROSSROADS GROWS AS YOU DO THINGS. THE LEDGER SAYS WHAT IT WAITS ON NEXT.', t: 9 };
    }
  }
  v.paradeDone = false;
  v.paraded.clear();
  v.side.clear();
  if (isMarketDay(g)) {
    marketOrder(g);
    out.push({ big: 'MARKET DAY AT THE CROSSROADS', small: 'THE DROVER PAYS HALF AGAIN. GOODS SELL DEARER TODAY', prio: 2 });
  }
  if (isFestival(g)) out.push({ big: `THE ${g.season.season.toUpperCase()} FESTIVAL`, small: 'PARADE FIVE OF A KIND THROUGH THE ARCH ON THE GREEN', prio: 2 });
  return out;
}

// Market day: the drover always has an order, and pays half again.
function marketOrder(g: Game) {
  let ord = g.orders.forYard('drover');
  if (!ord) {
    const have = g.ranch.pens.filter((p) => p.species && p.animals.length >= 3).map((p) => p.species!)[0] ?? 'duck';
    ord = { id: g.orders.nextId++, yard: 'drover', species: have, n: 3, due: hourToT(16), got: 0, paid: 0, state: 'open' };
    g.orders.list.push(ord);
  }
  ord.market = true;
}

export function valleyUpdate(g: Game, dt: number) {
  if (g.day.phase === 'night') return;
  grazePaddocks(g, dt);
  haulTimber(g);
  if (isFestival(g)) parade(g);
}

function grazePaddocks(g: Game, dt: number) {
  const v = g.valley;
  if (v.fields.every((p) => p.cleared)) return;
  for (const a of g.animals) {
    if (a.gone || a.carried || a.trial) continue; // penned stock grazes its paddock too
    const rate = GRAZE[a.sp.id] * (a.young ? 0.5 : 1);
    if (!rate || a.stress > 0.45 || Math.hypot(a.vx, a.vy) > a.sp.walk * 0.7) continue;
    const p = v.fieldAt(a.x, a.y);
    if (!p || p.cleared) continue;
    const tx = Math.floor(a.x / TS), ty = Math.floor(a.y / TS);
    let best = -1, bs = 0.001;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const j = p.index.get((ty + dy) * MW + tx + dx);
        if (j !== undefined && p.scrub[j] > bs) { bs = p.scrub[j]; best = j; }
      }
    if (best >= 0) p.scrub[best] = Math.max(0, p.scrub[best] - rate * dt);
    const own = p.index.get(ty * MW + tx);
    if (own !== undefined) p.scrub[own] = Math.max(0, p.scrub[own] - rate * dt * 0.25);
  }
  for (const p of v.fields) {
    if (p.cleared) continue;
    const left = v.left(p);
    const q = Math.floor((1 - left) * 4);
    if (q > p.shown && q < 4) {
      p.shown = q;
      g.fx.float(p.mouth.x, p.mouth.y - 12, `${p.site.name}: ${q * 25}% GRAZED`, C.wool, 2);
    }
    if (left <= CLEAR_AT) clearPaddock(g, p);
  }
}

export function clearPaddock(g: Game, p: FieldState) {
  p.cleared = true;
  p.scrub.fill(0);
  g.showBanner(`${p.site.name} IS CLEAR`, p.owned ? 'GRAZED DOWN TO GOOD GRASS: BUILD ANYTHING ON IT NOW' : 'GOOD GRASS NOW: BUY IT AT ITS SIGN TO BUILD ON IT', 3.4);
  g.audio?.play('tierup');
  g.feel.confetti(g.screen.W);
}

function haulTimber(g: Game) {
  const v = g.valley;
  if (v.bridge) return;
  const yoke = g.ranch.village.has('smithy');
  const pile = woodpile(), land = bridgeLanding(g);
  for (const a of g.animals) {
    if (a.sp.id !== 'cow' || a.gone || a.carried || a.young) continue;
    if (a.pen) {
      a.load = null; // a penned cow's log goes back on the pile
      continue;
    }
    if (yoke && !a.load && Math.hypot(a.x - pile.x, a.y - pile.y) < 20) {
      a.load = 'log';
      g.fx.float(a.x, a.y - 12, 'A LOG HITCHED', C.butter, 1.2);
      g.audio?.play('chop', { x: a.x, y: a.y, vol: 0.6 });
    } else if (a.load && Math.hypot(a.x - land.x, a.y - land.y) < 24) {
      a.load = null;
      v.logs++;
      g.audio?.play('chop', { x: a.x, y: a.y });
      if (v.logs >= BRIDGE_LOGS) mendBridge(g);
      else g.fx.float(land.x, land.y - 16, `THE OLD BRIDGE: ${v.logs}/${BRIDGE_LOGS} LOGS`, C.butter, 2);
    }
  }
}

export function mendBridge(g: Game) {
  const v = g.valley;
  v.bridge = true;
  v.logs = BRIDGE_LOGS;
  for (const a of g.animals) a.load = null;
  g.map.setBridge(true);
  g.showBanner('THE OLD BRIDGE IS MENDED', 'CATTLE CROSS THE FORD DRY-SHOD NOW, AND DO NOT BALK', 3.6);
  g.audio?.play('tierup');
  g.feel.confetti(g.screen.W);
}

// Festival day: five of a kind driven through the arch (either way) within
// a minute of each other make a parade.
function parade(g: Game) {
  const v = g.valley;
  if (v.paradeDone) return;
  for (const a of g.animals) {
    if (a.pen || a.gone || a.carried || a.trial) continue;
    if (Math.abs(a.x - ARCH.x) > 30 || a.y < ARCH.y0 - 4 || a.y > ARCH.y1 + 4) {
      v.side.delete(a);
      continue;
    }
    const s = Math.sign(a.x - ARCH.x);
    const was = v.side.get(a);
    v.side.set(a, s);
    if (was !== undefined && was !== s && s !== 0 && a.y > ARCH.y0 && a.y < ARCH.y1) v.paraded.set(a, g.t);
  }
  for (const [a, t] of v.paraded) if (g.t - t > 60 || a.gone) v.paraded.delete(a);
  const kinds = new Map<SpeciesId, Animal[]>();
  for (const a of v.paraded.keys()) kinds.set(a.sp.id, [...(kinds.get(a.sp.id) ?? []), a]);
  for (const [sp, list] of kinds) {
    if (list.length < 5) continue;
    v.paradeDone = true;
    v.parades++;
    const calm = list.filter((a) => calmRating(a.peakStress).mult > 1).length;
    const pay = 20 + calm * 3;
    g.earn(pay);
    g.showBanner('WHAT A PARADE!', `${list.length} ${SPECIES[sp].plural.toUpperCase()} THROUGH THE ARCH${calm === list.length ? ', ALL CALM' : ''}  +${pay}$`, 3.2);
    g.audio?.play('thatlldo');
    g.feel.confetti(g.screen.W);
    break;
  }
}

// ---- What E does, and what the hint line says ----

// E at a field's sign: buy it.
export function buyField(g: Game): boolean {
  const p = g.valley.fields.find((x) => !x.owned && Math.hypot(g.dog.x - x.mouth.x, g.dog.y - x.mouth.y) < 24);
  if (!p) return false;
  if (g.coins < p.site.price) {
    g.showBanner(`${p.site.name}: ${p.site.price}$`, `YOU HAVE ${g.coins}$`, 1.8);
    g.audio?.play('deny');
    return true;
  }
  g.coins -= p.site.price;
  p.owned = true;
  g.showBanner(`${p.site.name} IS YOURS`, p.cleared ? 'BUILD ON IT AS YOU LIKE' : 'FENCE IT: STOCK ON IT GRAZES IT CLEAR, THEN BUILD ANYTHING', 3.2);
  g.audio?.play('coin');
  return true;
}

export function valleyHint(g: Game): string | null {
  const d = g.dog, v = g.valley;
  const near = (p: { x: number; y: number }, r: number) => Math.hypot(d.x - p.x, d.y - p.y) < r;
  if (!v.bridge && near(woodpile(), 40)) {
    if (!g.ranch.village.has('smithy')) return 'TIMBER FOR THE OLD BRIDGE. THE VILLAGE NEEDS A SMITH TO FORGE AN OX YOKE FIRST.';
    return `THE OLD BRIDGE: ${v.logs}/${BRIDGE_LOGS} LOGS. DRIVE CATTLE THROUGH THE WOODPILE, THEN TO THE BRIDGE.`;
  }
  if (!v.bridge && near(bridgeLanding(g), 36)) return `THE OLD BRIDGE: ${v.logs}/${BRIDGE_LOGS} LOGS.${g.ranch.village.has('smithy') ? ' COWS BRING THEM FROM THE WOODPILE WEST OF HERE.' : ' A SMITH COULD FORGE THE YOKE TO HAUL TIMBER.'}`;
  const E = g.input.touchMode ? 'NIP' : 'E';
  for (const p of v.fields) {
    if (!p.owned && near(p.mouth, 24)) return `${E}: BUY ${p.site.name} ${p.site.price}$ (YOU HAVE ${g.coins}$)`;
    if (!p.cleared && (near(p.mouth, 30) || v.fieldAt(d.x, d.y) === p)) return `${p.owned ? '' : 'FOR SALE. '}OVERGROWN: ${Math.round((1 - v.left(p)) * 100)}% GRAZED. STOCK GRAZING HERE, PENNED OR LOOSE, CLEARS IT.`;
  }
  if (isFestival(g) && !v.paradeDone && Math.abs(d.x - ARCH.x) < 50 && d.y > ARCH.y0 - 30 && d.y < ARCH.y1 + 30) return 'THE FESTIVAL: DRIVE FIVE OF A KIND THROUGH THE ARCH.';
  if (near(SPOTS.green, 64)) {
    const s = nextStep(g);
    if (s) return `THE VILLAGE: ${s.name} COMES WHEN YOU ${s.deed}.`;
  }
  return null;
}

// ---- Co-op and saving ----

export interface ValleySave {
  village: StepId[];
  builtDay: Partial<Record<StepId, number>>;
  scrub: { id: string; v: number[]; cleared: boolean; owned?: boolean }[];
  logs: number;
  bridge: boolean;
  parades: number;
  paradeDone?: boolean;
}

export function valleySave(g: Game): ValleySave {
  const v = g.valley;
  return {
    village: [...g.ranch.village.built],
    builtDay: { ...g.ranch.village.builtDay },
    scrub: v.fields.map((p) => ({ id: p.site.id, v: p.cleared ? [] : [...p.scrub].map((x) => Math.round(x * 100) / 100), cleared: p.cleared, owned: p.owned })),
    logs: v.logs,
    bridge: v.bridge,
    parades: v.parades,
    paradeDone: v.paradeDone,
  };
}

export function valleyLoad(g: Game, d: ValleySave | undefined) {
  const v = g.valley;
  g.ranch.village.built = new Set((d?.village ?? []).filter((id) => STEPS.some((s) => s.id === id)));
  g.ranch.village.builtDay = { ...(d?.builtDay ?? {}) };
  for (const p of v.fields) {
    const s = d?.scrub.find((x) => x.id === p.site.id);
    p.cleared = !!s?.cleared;
    p.owned = !!s?.owned;
    if (p.cleared) p.scrub.fill(0);
    else if (s && s.v.length === p.scrub.length) p.scrub.set(s.v);
    else p.scrub.fill(1);
    p.shown = Math.floor((1 - v.left(p)) * 4);
  }
  v.logs = d?.logs ?? 0;
  v.bridge = !!d?.bridge;
  v.parades = d?.parades ?? 0;
  v.paradeDone = !!d?.paradeDone;
  g.map.setBridge(v.bridge);
}

// Co-op: what a guest needs to draw the valley (scrub in tenths, so it is
// not resent every frame while a flock grazes), and putting it in place.
export function valleyShared(g: Game): ValleySave {
  const s = valleySave(g);
  for (const p of s.scrub) p.v = p.v.map((x) => Math.round(x * 10) / 10);
  return s;
}
export function valleyApply(g: Game, d: ValleySave) {
  const before = g.ranch.village.built.size;
  valleyLoad(g, d);
  if (g.ranch.village.built.size !== before) g.ranch.restamp();
}

// Where the village's buildings stand, for drawing (built ones only).
export const villagePlots = (g: Game) => PLOTS.filter((p) => !p.step || g.ranch.village.has(p.step));
