import { C } from '../palette';
import { calmRating, type Game } from '../game';
import { Animal } from '../entities/animal';
import type { Coat } from '../art/animals';
import { MH, MW, REGIONS, regionById } from '../world/map';
import { FINDS, FLOCK_EVERY, KEEPSAKES, PLACES, inPlace, keepsakeById, placeById, type Finder, type KeepsakeId, type PlaceDef, type PlaceId } from '../world/places';

// Exploring: hidden places, keepsakes, the fog over the Ledger's map, and the
// rare strays and wild flocks that live in the hidden places.

// Fog cells are two tiles square, the same as the Ledger map's pixels.
export const FW = MW / 2;
export const FH = MH / 2;
const WALK_R = 9; // fog cells cleared round the dog
const LOOK_R = 48; // glimpsed from the lookout
export const SEEN = 2; // walked near
export const GLIMPSED = 1; // seen from afar (the lookout)

const CALM = PLACES.filter((p) => p.calm);

export interface DiscoverySave {
  found: PlaceId[];
  keep: KeepsakeId[];
  home: PlaceId[]; // strays brought home
  flock: Partial<Record<PlaceId, number>>; // day each wild flock may come back
  fog: string;
  out: { place: PlaceId; coat: number; x: number; y: number; stress: number }[];
}

// Fog as runs: "<value><count in base 36>," repeated.
function packFog(f: Uint8Array): string {
  let s = '', v = f[0], n = 0;
  for (let i = 0; i <= f.length; i++) {
    if (i < f.length && f[i] === v) { n++; continue; }
    s += `${v}${n.toString(36)},`;
    v = f[i];
    n = 1;
  }
  return s;
}
function unpackFog(s: string, f: Uint8Array) {
  let i = 0;
  for (const run of s.split(',')) {
    if (!run) continue;
    const v = Number(run[0]), n = parseInt(run.slice(1), 36);
    f.fill(v, i, Math.min(f.length, i + n));
    i += n;
  }
}

const noE = (game: Game, s: string) => (game.input.touchMode ? s.replace(' (E)', '') : s);

export class Discovery {
  found = new Set<PlaceId>();
  keepsakes = new Set<KeepsakeId>();
  home = new Set<PlaceId>();
  flockDay: Partial<Record<PlaceId, number>> = {};
  fog = new Uint8Array(FW * FH);
  fogVer = 0;
  // Rare strays and wild flock members still out, by the place they came from.
  tracked = new Map<Animal, PlaceId>();
  hurdleSwing = 0; // 0 latched .. 1 swung open (drawing)
  private cell = -1;
  private inside: PlaceDef | null = null;
  private latchT = 0;
  private pruneT = 0;
  private sparkT = 0;

  constructor() {
    this.revealStart();
  }

  count(region?: string): { found: number; total: number } {
    const list = region ? PLACES.filter((p) => p.region === region) : PLACES;
    return { found: list.filter((p) => this.found.has(p.id)).length, total: list.length };
  }

  // ---- Fog ----

  // Has this pixel been seen, close up or from the lookout?
  known(x: number, y: number): boolean {
    const fx = Math.floor(x / 16), fy = Math.floor(y / 16);
    return fx >= 0 && fy >= 0 && fx < FW && fy < FH && this.fog[fy * FW + fx] > 0;
  }

  reveal(cx: number, cy: number, r: number, v: number) {
    let changed = false;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(FH - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(FW - 1, Math.ceil(cx + r)); x++) {
        const i = y * FW + x;
        if (this.fog[i] >= v || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        this.fog[i] = v;
        changed = true;
      }
    if (changed) this.fogVer++;
  }

  // A new game knows the ranch and the way to the Home Meadow.
  private revealStart() {
    const r = regionById('ranch');
    this.reveal(r.cx / 2, r.cy / 2, 15, SEEN);
  }

  // An old save (from before exploring) knows every open region and the
  // roads between them, but none of the hidden places.
  private revealOld(game: Game) {
    for (const r of REGIONS) {
      if (r.tier > game.tier) continue;
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const dx = (x * 2 + 1 - r.cx) / (r.rx * 1.15), dy = (y * 2 + 1 - r.cy) / (r.ry * 1.15);
          if (dx * dx + dy * dy < 1) this.fog[y * FW + x] = SEEN;
        }
    }
    const m = game.map;
    for (let ty = 0; ty < MH; ty += 2)
      for (let tx = 0; tx < MW; tx += 2) {
        if (!m.path[ty * MW + tx]) continue;
        const reg = m.regionAt(tx * 8 + 4, ty * 8 + 4);
        if (reg && reg.tier > game.tier) continue;
        if (PLACES.some((p) => p.pathFrom !== undefined && p.way.some(([wx, wy]) => Math.hypot(wx - tx, wy - ty) < 6))) continue;
        this.reveal(tx / 2, ty / 2, 3, SEEN);
      }
    this.fogVer++;
  }

  // ---- Every frame of play ----

  update(game: Game, dt: number) {
    const d = game.dog;
    const c = Math.floor(d.y / 16) * FW + Math.floor(d.x / 16);
    if (c !== this.cell) {
      this.cell = c;
      this.reveal(d.x / 16, d.y / 16, WALK_R, SEEN);
    }
    const at = PLACES.find((p) => inPlace(p, d.x, d.y, 0.85)) ?? null;
    if (at !== this.inside) {
      this.inside = at;
      if (at) {
        game.place = { text: at.name, t: 2.4 };
        if (!this.found.has(at.id)) this.discover(game, at);
      }
    }
    for (const p of PLACES) {
      if (!p.keepsake || !p.item || this.keepsakes.has(p.keepsake) || !this.found.has(p.id)) continue;
      if (Math.hypot(d.x - p.item[0], d.y - p.item[1]) < 11) this.take(game, p.keepsake, p.item);
    }
    this.updateHurdle(game, dt);
    this.updateCalm(game, dt);
    this.updateTracked(game, dt);
    this.waymarkTip(game);
  }

  private discover(game: Game, p: PlaceDef) {
    this.found.add(p.id);
    const { found, total } = this.count();
    const reward = 5 * regionById(p.region).tier;
    game.earn(reward);
    game.showBanner(p.name, `HIDDEN PLACE ${found}/${total}  +${reward}$`, 3.2);
    game.tip = { text: noE(game, p.tip), t: 10 };
    game.ledgerNew = true;
    game.audio?.stinger('steady');
    game.fx.ring(game.dog.x, game.dog.y - 2, 34, C.butter, 0.7, 4);
    if (p.kind === 'lookout') this.reveal(p.cx / 2, p.cy / 2, LOOK_R, GLIMPSED);
    if (p.rx) this.reveal(p.cx / 2, p.cy / 2, Math.max(p.rx, p.ry) / 2 + 2, SEEN);
  }

  private take(game: Game, id: KeepsakeId, at: [number, number]) {
    this.keepsakes.add(id);
    const k = keepsakeById(id);
    game.showBanner(`FOUND ${k.name}`, `KEEPSAKE ${this.keepsakes.size}/${KEEPSAKES.length}: IT IS IN THE LEDGER`, 3);
    game.tip = { text: `${k.blurb}.`, t: 6 };
    game.ledgerNew = true;
    game.audio?.play('coin', { x: at[0], y: at[1] });
    game.fx.float(at[0], at[1] - 10, k.short, C.butter, 1.4);
    for (let i = 0; i < 10; i++)
      game.fx.add({ kind: 'spark', x: at[0], y: at[1] - 4, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 45, max: 0.5, color: C.butter });
  }

  // The Drove Trail's hurdle is latched on the trail side: walk up to it from
  // the hills and it swings open for good; from the ranch it will not budge.
  private updateHurdle(game: Game, dt: number) {
    const map = game.map;
    if (map.hurdleOpen) {
      this.hurdleSwing = Math.min(1, this.hurdleSwing + dt * 2.5);
      return;
    }
    const d = game.dog;
    const [x0, x1] = map.hurdleSpan();
    const hy = map.hurdleY - 4; // the middle of its two rows of cells
    this.latchT = Math.max(0, this.latchT - dt);
    if (d.x < x0 - 6 || d.x > x1 + 6 || Math.abs(d.y - hy) > 12) return;
    if (d.y < hy) {
      map.setHurdle(true);
      game.audio?.play('creak-long', { x: (x0 + x1) / 2, y: hy });
      this.discover(game, placeById('trail'));
      game.showBanner('SHORTCUT OPENED', `THE DROVE TRAIL  ${this.count().found}/${PLACES.length}`, 3.2);
    } else if (this.latchT <= 0 && !game.input.override) {
      game.tip = { text: 'THE HURDLE IS LATCHED FROM THE FAR SIDE. WHERE DOES THIS TRAIL COME FROM?', t: 6 };
      this.latchT = 20;
    }
  }

  // Sweet grass: anything resting in a calm place settles, and the pay it is
  // on (from its peak stress on the way home) recovers.
  private updateCalm(game: Game, dt: number) {
    this.sparkT -= dt;
    const spark = this.sparkT <= 0;
    if (spark) this.sparkT = 0.35;
    for (const a of game.animals) {
      if (a.pen || a.gone || a.trial || a.carried || a.pressure > 0.05 || a.panicT > 0) continue;
      if (!CALM.some((p) => inPlace(p, a.x, a.y))) continue;
      const was = a.peakStress;
      a.stress = Math.max(0, a.stress - 0.1 * dt);
      a.peakStress = Math.max(a.stress, a.peakStress - 0.07 * dt);
      if (spark && was > 0.3 && Math.random() < 0.3 && game.isOnScreen(a.x, a.y))
        game.fx.add({ kind: 'spark', x: a.x, y: a.y - a.sp.r * 2 - 2, vx: 0, vy: -10, max: 0.6, color: C.butter });
    }
  }

  private updateTracked(game: Game, dt: number) {
    if ((this.pruneT -= dt) <= 0) {
      this.pruneT = 2;
      this.prune(game);
    }
    for (const [a, id] of this.tracked) {
      if (!a.pen && !a.gone) continue;
      this.tracked.delete(a);
      if (!a.pen || a.home) continue;
      const f = FINDS.find((f) => f.place === id)!;
      if (f.bonus) {
        // A stray brought home.
        const { mult, label } = calmRating(a.peakStress);
        const bonus = Math.round(f.bonus * mult);
        game.earn(bonus);
        game.stats.deliveredValue += bonus;
        this.home.add(id);
        game.fx.float(a.x, a.y - 18, `+${bonus}$`, C.butter, 1.6);
        game.tip = { text: `${f.label} IS HOME! +${bonus}$ (${label})`, t: 6 };
        game.ledgerNew = true;
      } else if (a.deliveryValue > 0) {
        // Wild-bred stock pays twice.
        const bonus = a.deliveryValue;
        game.earn(bonus);
        game.stats.deliveredValue += bonus;
        game.fx.float(a.x, a.y - 18, `WILD +${bonus}$`, C.butter, 1.4);
      }
    }
  }

  // Forget anything that has left the game (bot resets, loads).
  private prune(game: Game) {
    if (!this.tracked.size) return;
    const live = new Set(game.animals);
    for (const a of this.tracked.keys()) if (!live.has(a)) this.tracked.delete(a);
  }

  private waymarkTip(game: Game) {
    if (game.tipsSeen.has('waymark') || game.input.override || game.tut < 7) return; // not over the first-day lessons
    const d = game.dog;
    for (const p of PLACES) {
      if (this.found.has(p.id) || regionById(p.region).tier > game.tier) continue;
      if (Math.hypot(d.x - (p.mark[0] * 8 + 4), d.y - (p.mark[1] * 8 + 4)) > 36) continue;
      game.tipsSeen.add('waymark');
      game.tip = { text: 'A LITTLE CAIRN BY THE TREES... IS THERE A WAY THROUGH?', t: 7 };
      return;
    }
  }

  // ---- Mornings: strays and wild flocks turn up in their places ----

  morning(game: Game) {
    this.prune(game);
    const day = game.day.day;
    for (const f of FINDS) {
      if (regionById(placeById(f.place).region).tier > game.tier) continue;
      if ([...this.tracked.values()].includes(f.place)) continue;
      if (f.bonus) {
        if (this.home.has(f.place)) continue;
      } else {
        if (day < (this.flockDay[f.place] ?? 0)) continue;
        this.flockDay[f.place] = day + FLOCK_EVERY;
      }
      this.spawn(game, f);
    }
  }

  private spawn(game: Game, f: Finder) {
    for (let i = 0; i < f.n; i++) {
      const ang = Math.random() * Math.PI * 2, r = f.n > 1 ? Math.sqrt(Math.random()) * (5 + f.n * 1.3) : 0;
      this.add(game, f, f.coat, f.x + Math.cos(ang) * r, f.y + Math.sin(ang) * r, 0);
    }
  }

  private add(game: Game, f: Finder, coat: number, x: number, y: number, stress: number) {
    const a = new Animal(f.species, x, y, coat as Coat);
    a.wanderer = false;
    a.stress = stress;
    game.animals.push(a);
    this.tracked.set(a, f.place);
  }

  // ---- Save ----

  save(game: Game): DiscoverySave {
    const live = new Set(game.animals);
    return {
      found: [...this.found],
      keep: [...this.keepsakes],
      home: [...this.home],
      flock: { ...this.flockDay },
      fog: packFog(this.fog),
      out: [...this.tracked]
        .filter(([a]) => live.has(a) && !a.pen && !a.gone)
        .map(([a, place]) => ({ place, coat: a.coat, x: Math.round(a.x), y: Math.round(a.y), stress: +a.stress.toFixed(2) })),
    };
  }

  // After the save's animals and tier are in. An older save has no record of
  // exploring: it starts knowing its open regions and their roads.
  load(game: Game, d?: DiscoverySave) {
    this.found.clear();
    this.keepsakes.clear();
    this.home.clear();
    this.tracked.clear();
    this.flockDay = {};
    this.fog.fill(0);
    this.cell = -1;
    this.inside = null;
    if (!d) {
      this.revealStart();
      this.revealOld(game);
    } else {
      const ok = <T extends string>(ids: string[], all: T[]) => ids.filter((x): x is T => all.includes(x as T));
      for (const id of ok(d.found ?? [], PLACES.map((p) => p.id))) this.found.add(id);
      for (const id of ok(d.keep ?? [], KEEPSAKES.map((k) => k.id))) this.keepsakes.add(id);
      for (const id of ok(d.home ?? [], PLACES.map((p) => p.id))) this.home.add(id);
      this.flockDay = { ...(d.flock ?? {}) };
      if (d.fog) unpackFog(d.fog, this.fog);
      else this.revealOld(game);
      for (const o of d.out ?? []) {
        const f = FINDS.find((f) => f.place === o.place);
        if (f) this.add(game, f, o.coat, o.x, o.y, o.stress);
      }
    }
    game.map.setHurdle(this.found.has('trail'));
    this.hurdleSwing = game.map.hurdleOpen ? 1 : 0;
    this.fogVer++;
  }
}
