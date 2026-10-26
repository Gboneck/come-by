import type { Game } from '../game';
import { Animal } from '../entities/animal';
import type { Coat } from '../art/animals';
import { Pen, type BuildingKind, type PenFixture, type Rot } from '../ranch/buildings';
import { defOfKind } from '../ranch/catalog';
import { valleyLoad, valleySave, type ValleySave } from './valley';
import { Haystack } from '../ranch/structures';
import { LOFT_MAX, type FairEntry } from './seasonal';
import { makeBuilding } from '../ui/build';
import { Helper, type HelperMode } from '../entities/helper';
import type { SpeciesId } from '../world/map';
import { newTotals, type Totals } from './progression';
import type { UpKey } from './economy';
import { morningOrders, type Order } from './orders';
import type { FavourSave } from './favour';
import type { AchSave } from './achievements';
import type { ClassId } from './trials';
import { applyLook, readLook, type Look } from '../ui/look';
import { PIECES, type PlacedDecor } from '../ui/decorbuild';
import { SKIES, type Sky } from './weather';
import type { DiscoverySave } from './discovery';
import type { ProjectsSave } from './projects';
import type { LootSave } from './loot';
import { mergeTravels } from '../net/travels';

// A save is "the morning of day N": the ranch, the herds where they stand,
// goods waiting in the pens, upgrades and the lifetime record.
const KEY = 'comeby-save-v1';
export const SAVE_KEY = KEY; // ui/transfer.ts moves saves between devices

// Seasons added `young` (a lamb) with `mom`, the `k` of its mother (only
// mothers carry a `k`), and the years a ewe last lambed and was shorn.
interface SavedAnimal { id: SpeciesId; coat: Coat; stress: number; x?: number; y?: number; wanderer?: boolean; produceT?: number; home?: boolean; young?: 1; k?: number; mom?: number; lambed?: number; shorn?: number }

export interface SaveData {
  v: 1;
  day: number;
  tier: number;
  coins: number;
  won: boolean;
  tut: number;
  tips: string[];
  totals: Totals;
  upgrades: Record<UpKey, number>;
  owned: string[];
  buildings: { kind: BuildingKind; tx: number; ty: number; rot: Rot; level: number; trough?: boolean; goods?: number; animals?: SavedAnimal[]; hungry?: boolean; bales?: number;
    // Paddocks (round four): size, gate, fixtures, goods by kind. Old pens lack them.
    w?: number; h?: number; gate?: number; fixtures?: PenFixture[]; goodsBy?: Partial<Record<SpeciesId, number>> }[];
  wild: SavedAnimal[];
  helpers: { name: string; mode: HelperMode }[];
  // Added with orders and trials; older saves lack them.
  orders?: Order[];
  nextOrder?: number;
  trials?: { won: ClassId[]; cups: number; last: number };
  // Added with customization; older saves get the defaults.
  look?: Partial<Look>;
  decor?: PlacedDecor[];
  // Added with buyers' favour and achievements (older saves: worked out on load).
  favour?: FavourSave;
  achievements?: AchSave;
  weather?: { sky: Sky; forecast: Sky; dir: [number, number] };
  // Added with exploring.
  discovery?: DiscoverySave;
  projects?: ProjectsSave; // added with the valley projects
  loot?: LootSave; // added with digging
  // Added with seasons (the calendar itself follows from `day`).
  seasonal?: { loft: number; hungryNights: number; fair: FairEntry[] };
  // Added with the valley growing: the village, paddocks, the old bridge,
  // and the agility yard's training.
  valley?: ValleySave;
  farmwork?: { marks: Partial<Record<UpKey, number>>; trainedDay: number; best: number; cleanRuns: number; shorn: number; milked: number };
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(game: Game) {
  // A co-op guest is playing on someone else's ranch: their own save is never touched.
  if (game.demo || game.loading || game.net?.role === 'guest') return;
  try {
    store()?.setItem(KEY, JSON.stringify(saveData(game)));
  } catch { /* quota or blocked: play on */ }
}

// The seasonal fields of a saved animal; `k` numbers the mothers.
function seasonFields(a: Animal, ks: Map<Animal, number>): Partial<SavedAnimal> {
  const out: Partial<SavedAnimal> = {};
  if (a.young) {
    out.young = 1;
    const m = a.mother && ks.get(a.mother);
    if (m !== undefined && m !== null) out.mom = m;
  }
  if (ks.has(a)) out.k = ks.get(a);
  if (a.lambedYear) out.lambed = a.lambedYear;
  if (a.shorn) out.shorn = a.shorn;
  return out;
}

// Stock away at the shearer's or in the show ring when the game is saved
// comes back loose outside that gate, still yours.
function awayStock(game: Game): Animal[] {
  const out: Animal[] = [];
  for (const y of game.ranch.yards) {
    const o = game.orders.forYard(y.site.id);
    if (y.release || o?.kind === 'shear') out.push(...y.pen.animals);
  }
  out.push(...game.ranch.ring.pen.animals);
  return out.filter((a) => !a.gone && !a.forSale);
}

// The whole ranch as data (also what a co-op host sends a guest on joining).
export function saveData(game: Game): SaveData {
  const ks = new Map<Animal, number>();
  for (const a of game.animals) if (a.young && a.mother && !a.mother.gone && !ks.has(a.mother)) ks.set(a.mother, ks.size);
  const away = awayStock(game);
  const gateOf = (a: Animal) => (a.pen instanceof Pen ? a.pen.gatePoint(12) : a);
  return {
    v: 1,
    day: game.day.day,
    tier: game.tier,
    coins: game.coins,
    won: game.won,
    tut: game.tut,
    tips: [...game.tipsSeen],
    totals: game.totals,
    upgrades: game.upgrades,
    owned: [...game.owned],
    buildings: game.ranch.buildings
      .filter((b) => b.kind !== 'regiongate' && b.kind !== 'farmhouse')
      .map((b) => {
        const out: SaveData['buildings'][number] = { kind: b.kind, tx: b.tx, ty: b.ty, rot: b.rot, level: b.level };
        if (b instanceof Pen) {
          out.trough = b.hasTrough;
          out.goods = b.goods;
          out.w = b.w;
          out.h = b.h;
          if (b.gateAt !== null) out.gate = b.gateAt;
          if (b.fixtures.length) out.fixtures = b.fixtures.map((f) => ({ ...f }));
          if (Object.keys(b.goodsBy).length) out.goodsBy = { ...b.goodsBy };
          out.animals = b.animals.filter((a) => !a.gone).map((a) => ({ id: a.sp.id, coat: a.coat, stress: +a.stress.toFixed(2), produceT: Math.round(a.produceT), ...seasonFields(a, ks) }));
          if (b.hungry) out.hungry = true;
        }
        if (b instanceof Haystack) out.bales = b.bales;
        return out;
      }),
    wild: [
      ...game.animals.filter((a) => !a.pen && !a.gone && !a.trial && !game.discovery.tracked.has(a) && !game.loot.lost.has(a)), // strays and wild flocks: in `discovery`; the map's lost animals come back each morning
      ...away,
    ].map((a) => {
      const at = gateOf(a);
      return { id: a.sp.id, coat: a.coat, stress: +a.stress.toFixed(2), x: Math.round(at.x), y: Math.round(at.y), wanderer: a.wanderer, ...(a.home || a.pen ? { home: true } : {}), ...seasonFields(a, ks) };
    }),
    helpers: game.helpers.map((h) => ({ name: h.name, mode: h.mode })),
    orders: game.orders.list,
    nextOrder: game.orders.nextId,
    trials: { won: game.trials.won, cups: game.trials.cups, last: game.trials.lastPrizeDay },
    look: game.look,
    decor: game.decor,
    favour: game.favour.save(),
    achievements: game.achievements.save(),
    weather: { sky: game.weather.sky, forecast: game.weather.forecast, dir: [+game.weather.dirX.toFixed(3), +game.weather.dirY.toFixed(3)] },
    discovery: game.discovery.save(game),
    projects: game.projects.save(),
    loot: game.loot.save(),
    seasonal: { loft: game.seasonal.loft, hungryNights: game.seasonal.hungryNights, fair: game.seasonal.fair },
    valley: valleySave(game),
    farmwork: (({ marks, trainedDay, best, cleanRuns, shorn, milked }) => ({ marks, trainedDay, best, cleanRuns, shorn, milked }))(game.farmwork),
  };
}

// Seasonal fields back onto a loaded animal; `ks` collects the mothers.
function loadSeason(a: Animal, sa: SavedAnimal, ks: Map<number, Animal>, lambs: [Animal, number | undefined][]) {
  if (sa.k !== undefined) ks.set(sa.k, a);
  if (sa.young) {
    a.young = true;
    a.wanderer = false;
    lambs.push([a, sa.mom]);
  }
  a.lambedYear = sa.lambed ?? 0;
  a.shorn = sa.shorn ?? 0;
}

// Each lamb finds its mother again.
function linkLambs(ks: Map<number, Animal>, lambs: [Animal, number | undefined][]) {
  for (const [l, k] of lambs) {
    const m = k === undefined ? undefined : ks.get(k);
    if (!m) continue;
    l.mother = m;
    if (!m.lamb) m.lamb = l;
  }
}

function read(): SaveData | null {
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

// What our own ranch has found exploring (a co-op guest counts it too).
export function ownDiscovery(): DiscoverySave | undefined {
  return read()?.discovery;
}

// Our own achievements (a co-op guest shows them, and earns no others).
export function ownAchievements(): AchSave | undefined {
  return read()?.achievements;
}

export function saveInfo(): { day: number; tier: number; look?: Partial<Look> } | null {
  const d = read();
  return d ? { day: d.day, tier: d.tier, look: d.look } : null;
}

export function clearSave() {
  try {
    store()?.removeItem(KEY);
  } catch { /* ignore */ }
}

export function loadInto(game: Game): boolean {
  const d = read();
  if (!d) return false;
  game.day.day = d.day;
  game.coins = d.coins;
  game.won = d.won;
  game.tut = d.tut;
  game.tipsSeen = new Set(d.tips);
  game.totals = { ...newTotals(), ...d.totals };
  game.upgrades = { ...game.upgrades, ...d.upgrades };
  game.applyUpgrades();
  game.owned = new Set(d.owned);
  game.favour.load(d.favour);
  game.achievements.load(game, d.achievements);

  game.animals = [];
  const ks = new Map<number, Animal>();
  const lambs: [Animal, number | undefined][] = [];
  buildRanch(game, d, (b, sb) => {
    for (const sa of sb.animals ?? []) {
      const x = b.ix0 + 4 + Math.random() * (b.ix1 - b.ix0 - 8);
      const y = b.iy0 + 4 + Math.random() * (b.iy1 - b.iy0 - 8);
      const a = new Animal(sa.id, x, y, sa.coat);
      a.stress = sa.stress;
      a.produceT = sa.produceT ?? 0;
      a.pen = b;
      loadSeason(a, sa, ks, lambs);
      b.animals.push(a);
      b.species = sa.id;
      game.animals.push(a);
    }
  });
  for (const sa of d.wild) {
    const a = new Animal(sa.id, sa.x ?? 0, sa.y ?? 0, sa.coat);
    a.stress = sa.stress;
    if (sa.wanderer !== undefined) a.wanderer = sa.wanderer;
    a.home = !!sa.home;
    loadSeason(a, sa, ks, lambs);
    game.animals.push(a);
  }
  linkLambs(ks, lambs);
  const s = d.seasonal;
  game.seasonal.loft = s ? s.loft : LOFT_MAX;
  game.seasonal.hungryNights = s?.hungryNights ?? 0;
  game.seasonal.fair = s?.fair ? s.fair.map((e) => ({ ...e })) : [];
  if (d.trials) {
    game.trials.won = [...d.trials.won];
    game.trials.cups = d.trials.cups;
    game.trials.lastPrizeDay = d.trials.last;
  }
  game.look = readLook(d.look);
  applyLook(game.look);
  game.decor = (d.decor ?? []).filter((x) => PIECES.some((p) => p.id === x.id));
  game.setTier(d.tier, false);
  game.discovery.load(game, d.discovery);
  game.projects.load(game, d.projects);
  game.loot.load(game, d.loot);
  mergeTravels(game); // places and keepsakes found visiting friends' ranches
  valleyLoad(game, d.valley);
  Object.assign(game.farmwork, d.farmwork ?? {});
  game.ranch.restamp();
  const door = game.doorPoint();
  game.helpers = d.helpers.map((h, i) => new Helper(h.name, door.x + (i ? 10 : -10), door.y + 6, h.mode, i));
  // Today's sky as it was saved (older saves: a clear day).
  const w = d.weather;
  if (w && SKIES.includes(w.sky) && !game.weather.forced) {
    game.weather.set(w.sky);
    game.weather.forecast = SKIES.includes(w.forecast) ? w.forecast : 'clear';
    [game.weather.dirX, game.weather.dirY] = w.dir;
    game.weather.snap();
  }
  game.startDay(true, false);
  // The morning's orders as they were; an older save gets fresh ones.
  if (d.orders) {
    game.orders.list = d.orders.map((o) => ({ ...o }));
    game.orders.nextId = d.nextOrder ?? game.orders.list.length + 1;
  } else morningOrders(game);
  game.achievements.backfill(game); // badges an older save had already earned
  saveGame(game);
  return true;
}

// Rebuild the ranch's buildings from a save: keep the region gates and the
// farmhouse, replace the rest. `pen` fills each pen with its stock.
function buildRanch(game: Game, d: SaveData, pen?: (b: Pen, sb: SaveData['buildings'][number]) => void) {
  game.ranch.buildings = game.ranch.buildings.filter((b) => b.kind === 'regiongate' || b.kind === 'farmhouse');
  for (const sb of d.buildings) {
    const def = defOfKind(sb.kind);
    if (!def) continue;
    const b = makeBuilding(def, sb.tx, sb.ty, sb.rot);
    b.level = sb.level;
    game.ranch.buildings.push(b);
    if (b instanceof Pen) {
      // An old save's pen is an 8x7 paddock with its gate in the middle.
      if (sb.w && sb.h) {
        b.w = sb.w;
        b.h = sb.h;
      }
      b.gateAt = sb.gate ?? null;
      if (sb.fixtures) b.fixtures = sb.fixtures.map((f) => ({ ...f }));
      else b.hasTrough = !!sb.trough;
      b.goods = sb.goods ?? 0;
      b.goodsBy = { ...(sb.goodsBy ?? {}) };
      b.hungry = !!sb.hungry;
      pen?.(b, sb);
    }
    if (b instanceof Haystack && sb.bales !== undefined) b.bales = sb.bales;
  }
}

// A co-op guest's copy of the host's ranch: the buildings, the ranch's
// looks and decor, the tier, the places found and the sky. No animals,
// helpers or orders: those come in the host's snapshots. `dog` is the
// guest's own dog (name and markings), which stays theirs.
export function loadWorld(game: Game, d: SaveData, dog: Look) {
  game.loading = true;
  game.day.day = d.day;
  game.coins = d.coins;
  game.won = d.won;
  game.totals = { ...newTotals(), ...d.totals };
  game.upgrades = { ...game.upgrades, ...d.upgrades };
  game.applyUpgrades();
  game.owned = new Set(d.owned);
  game.favour.load(d.favour);
  buildRanch(game, d);
  const host = readLook(d.look);
  game.look = { ...host, name: dog.name, dog: { ...dog.dog } };
  applyLook(game.look);
  game.decor = (d.decor ?? []).filter((x) => PIECES.some((p) => p.id === x.id));
  game.setTier(d.tier, false);
  game.discovery.load(game, d.discovery ? { ...d.discovery, out: [] } : undefined);
  valleyLoad(game, d.valley);
  game.projects.load(game, d.projects);
  game.ranch.restamp();
  if (d.trials) {
    game.trials.won = [...d.trials.won];
    game.trials.cups = d.trials.cups;
    game.trials.lastPrizeDay = d.trials.last;
  }
  if (d.orders) game.orders.list = d.orders.map((o) => ({ ...o }));
  if (d.seasonal) {
    game.seasonal.loft = d.seasonal.loft;
    game.seasonal.fair = d.seasonal.fair.map((e) => ({ ...e }));
  }
  const w = d.weather;
  if (w && SKIES.includes(w.sky)) {
    game.weather.set(w.sky);
    game.weather.forecast = SKIES.includes(w.forecast) ? w.forecast : 'clear';
    [game.weather.dirX, game.weather.dirY] = w.dir;
    game.weather.snap();
  }
  game.loading = false;
}
