import { CS, GATE, PEN, SOLID, TS, type SpeciesId, type WorldMap } from '../world/map';
import { spaceOf, type Animal, type Enclosure } from '../entities/animal';
import { SPECIES } from '../entities/species';

export type BuildingKind =
  | 'farmhouse'
  | 'pen'
  | 'fence'
  | 'gate'
  | 'trough'
  | 'barn'
  | 'kennel'
  | 'market'
  | 'windmill'
  | 'haystack'
  | 'shed'
  | 'dairy'
  | 'agility'
  | 'shelter'
  | 'rack'
  | 'regiongate';

// Pens open on one side: 0 = south, 1 = west, 2 = north, 3 = east.
export type Rot = 0 | 1 | 2 | 3;

let nextId = 1;

export class Building {
  id = nextId++;
  level = 1;
  constructor(
    public kind: BuildingKind,
    public tx: number,
    public ty: number,
    public w: number,
    public h: number,
    public rot: Rot = 0,
  ) {}

  get x0() { return this.tx * TS; }
  get y0() { return this.ty * TS; }
  get x1() { return (this.tx + this.w) * TS; }
  get y1() { return (this.ty + this.h) * TS; }
  get cx() { return (this.x0 + this.x1) / 2; }
  get cy() { return (this.y0 + this.y1) / 2; }

  // Collision for the footprint; pens and gates override.
  stamp(map: WorldMap) {
    fillCells(map, this.x0, this.y0, this.x1, this.y1, SOLID);
  }

  overlapsTiles(tx: number, ty: number, w: number, h: number) {
    return tx < this.tx + this.w && tx + w > this.tx && ty < this.ty + this.h && ty + h > this.ty;
  }
}

export function fillCells(map: WorldMap, x0: number, y0: number, x1: number, y1: number, flag: number) {
  for (let cy = Math.floor(y0 / CS); cy < Math.ceil(y1 / CS); cy++)
    for (let cx = Math.floor(x0 / CS); cx < Math.ceil(x1 / CS); cx++)
      if (cx >= 0 && cy >= 0 && cx < 384 && cy < 336) map.structFlags[cy * 384 + cx] |= flag;
}

export function clearCells(map: WorldMap, x0: number, y0: number, x1: number, y1: number, flag: number) {
  for (let cy = Math.floor(y0 / CS); cy < Math.ceil(y1 / CS); cy++)
    for (let cx = Math.floor(x0 / CS); cx < Math.ceil(x1 / CS); cx++)
      if (cx >= 0 && cy >= 0 && cx < 384 && cy < 336) map.structFlags[cy * 384 + cx] &= ~flag;
}

export const PEN_W = 8;
export const PEN_H = 7;
export const GATE_TILES = 2;

// Who may share a paddock: ducks with anyone, sheep with goats, cattle with
// ponies. Other mixes are refused at the gate.
export function getsAlong(a: SpeciesId, b: SpeciesId) {
  if (a === b || a === 'duck' || b === 'duck') return true;
  const pair = (x: SpeciesId, y: SpeciesId) => (a === x && b === y) || (a === y && b === x);
  return pair('sheep', 'goat') || pair('cow', 'pony');
}

// Room in a paddock scales with its area (the old 8x7 pen holds 16 space),
// and a big one packs a little more a tile, as less of it is lost to the
// fence: up to half again at four times the old pen's area (what the old
// pen upgrade gave). An old upgraded (sturdy) pen keeps its half again.
export function paddockCapacity(w: number, h: number, level = 1) {
  const a = w * h, base = PEN_W * PEN_H;
  const big = 1 + 0.5 * Math.max(0, Math.min(1, (a - base) / (3 * base)));
  return Math.round(((a * 16) / base) * big * (level >= 2 ? 1.5 : 1));
}

// Fixtures placed inside a paddock (src/ranch/paddock.ts): a trough (more
// goods, calmer stock), a field shelter (safe at night, as in a barn's
// ring) and a hay rack (less hay wasted in winter).
export type FixtureKind = 'trough' | 'shelter' | 'rack';
export interface PenFixture { kind: FixtureKind; tx: number; ty: number }

// A good lying in a paddock where it was laid (an egg, a fleece, a cheese, a
// pail of milk), world px, until it is sold at day's end or taken
// (systems/economy.ts). `id` is unique in the game; `t` when it was laid.
export interface GoodItem { id: number; sp: SpeciesId; x: number; y: number; t: number }
export const ITEMS_MAX = 48; // a paddock shows at most this many (its goods count on)
export const FIXTURE_SIZE: Record<FixtureKind, { w: number; h: number }> = { trough: { w: 2, h: 1 }, shelter: { w: 3, h: 2 }, rack: { w: 2, h: 1 } };

// A paddock: any size (src/ranch/paddock.ts has the rules), its gate on
// any side at any point along it. `rot` is the gate's side, `gateAt` how
// many tiles along that side (from its west or north end) the gate starts.
export class Pen extends Building implements Enclosure {
  animals: Animal[] = [];
  species: SpeciesId | null = null; // the kind that came first (signs, goods' look)
  open = true; // gate target state
  swing = 1; // 0 closed .. 1 open (animated)
  batch: Animal[] = []; // arrivals since the gate last opened
  quietT = 0; // time with nobody waiting at the gate
  shutFlash = 0;
  goods = 0; // produce waiting to be collected (whole units)
  goodsBy: Partial<Record<SpeciesId, number>> = {}; // ... by the kind that made it
  goodsFrac = 0;
  items: GoodItem[] = []; // the goods you can see, where they lie
  fixtures: PenFixture[] = [];
  sheltered = false; // within a barn's protection
  hungry = false; // went without hay last winter night: no goods today
  letOut = false; // gate held open so the stock can be driven out
  letOutQuiet = 0; // time with the dog gone and the gateway clear
  gateAt: number | null = null; // null: the gate in the middle of its side

  constructor(tx: number, ty: number, rot: Rot = 0, w?: number, h?: number) {
    super('pen', tx, ty, w ?? (rot % 2 === 0 ? PEN_W : PEN_H), h ?? (rot % 2 === 0 ? PEN_H : PEN_W), rot);
  }

  has(kind: FixtureKind) {
    return this.fixtures.some((f) => f.kind === kind);
  }
  get hasTrough() {
    return this.has('trough');
  }
  set hasTrough(on: boolean) {
    this.fixtures = this.fixtures.filter((f) => f.kind !== 'trough');
    if (on) this.fixtures.push({ kind: 'trough', tx: Math.round(this.cx / TS) - 1, ty: this.ty + 1 });
  }

  get capacity() {
    return paddockCapacity(this.w, this.h, this.level);
  }

  get used() {
    return this.animals.reduce((s, a) => s + spaceOf(a), 0);
  }

  // The kinds in it now.
  get kinds(): SpeciesId[] {
    return [...new Set(this.animals.map((a) => a.sp.id))];
  }

  canHold(sp: SpeciesId) {
    return this.animals.every((a) => getsAlong(a.sp.id, sp));
  }
  canShare(sp: SpeciesId) {
    return this.canHold(sp);
  }
  // What is in it, by kind.
  mix(): { sp: SpeciesId; n: number }[] {
    return this.kinds.map((sp) => ({ sp, n: this.animals.filter((a) => a.sp.id === sp).length }));
  }
  get gate(): { side: Rot; at: number } {
    return { side: this.rot, at: this.gateStart };
  }

  hasRoomFor(a: Animal) {
    if (a.trial) return false;
    return this.used + spaceOf(a) <= this.capacity && this.canHold(a.sp.id);
  }

  get full() {
    return this.species ? this.used + SPECIES[this.species].space > this.capacity : false;
  }

  // Goods waiting, one entry a unit, by the kind that made them.
  goodsList(): SpeciesId[] {
    const out: SpeciesId[] = [];
    for (const [k, n] of Object.entries(this.goodsBy) as [SpeciesId, number][]) for (let i = 0; i < n; i++) out.push(k);
    while (out.length < this.goods && this.species) out.push(this.species);
    return out.slice(0, this.goods);
  }

  // Interior in pixels (inside the 4px fence band).
  get ix0() { return this.x0 + CS; }
  get iy0() { return this.y0 + CS; }
  get ix1() { return this.x1 - CS; }
  get iy1() { return this.y1 - CS; }

  contains(x: number, y: number) {
    return x > this.ix0 + 1 && x < this.ix1 - 1 && y > this.iy0 + 1 && y < this.iy1 - 1;
  }

  // The gate's side length, and where along it the gate starts (tiles): never
  // on a corner tile.
  get sideLen() {
    return this.rot % 2 === 0 ? this.w : this.h;
  }
  get gateStart() {
    const len = this.sideLen;
    const at = this.gateAt ?? Math.round(len / 2) - 1;
    return Math.max(1, Math.min(len - GATE_TILES - 1, at));
  }

  // Gate opening span in pixels, along the gate side.
  gateSpan(): { x0: number; y0: number; x1: number; y1: number } {
    const g = GATE_TILES * TS;
    const m = (this.rot % 2 === 0 ? this.tx : this.ty) * TS + this.gateStart * TS;
    switch (this.rot) {
      case 0: return { x0: m, y0: this.y1 - CS, x1: m + g, y1: this.y1 };
      case 2: return { x0: m, y0: this.y0, x1: m + g, y1: this.y0 + CS };
      case 1: return { x0: this.x0, y0: m, x1: this.x0 + CS, y1: m + g };
      default: return { x0: this.x1 - CS, y0: m, x1: this.x1, y1: m + g };
    }
  }

  // Point just outside the gate, where arriving animals gather.
  gatePoint(out = 6): { x: number; y: number } {
    const s = this.gateSpan();
    const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    const [dx, dy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][this.rot];
    return { x: mx + dx * out, y: my + dy * out };
  }

  stamp(map: WorldMap) {
    const { x0, y0, x1, y1 } = this;
    fillCells(map, x0, y0, x1, y0 + CS, SOLID);
    fillCells(map, x0, y1 - CS, x1, y1, SOLID);
    fillCells(map, x0, y0, x0 + CS, y1, SOLID);
    fillCells(map, x1 - CS, y0, x1, y1, SOLID);
    fillCells(map, this.ix0, this.iy0, this.ix1, this.iy1, PEN);
    // A hay rack stands solid inside, and a shelter's back wall (stock
    // stands under its roof, open to the south); a trough is walked over.
    for (const f of this.fixtures) {
      if (f.kind === 'trough') continue;
      const z = FIXTURE_SIZE[f.kind];
      const h = f.kind === 'shelter' ? TS / 2 : z.h * TS - 2;
      fillCells(map, f.tx * TS + 1, f.ty * TS + 2, (f.tx + z.w) * TS - 1, f.ty * TS + 2 + h, SOLID);
    }
    const s = this.gateSpan();
    clearCells(map, s.x0, s.y0, s.x1, s.y1, SOLID);
    fillCells(map, s.x0, s.y0, s.x1, s.y1, GATE);
    this.applyGate(map);
  }

  applyGate(map: WorldMap) {
    const s = this.gateSpan();
    // Solid unless fully swung open.
    if (this.swing > 0.85) clearCells(map, s.x0, s.y0, s.x1, s.y1, SOLID);
    else fillCells(map, s.x0, s.y0, s.x1, s.y1, SOLID);
  }

  accepts(a: Animal) {
    return !a.pen && !this.letOut && this.hasRoomFor(a);
  }

  // Whether a point is anywhere on the pen's footprint, fences included.
  covers(x: number, y: number, m = 0) {
    return x > this.x0 - m && x < this.x1 + m && y > this.y0 - m && y < this.y1 + m;
  }
}

export class Farmhouse extends Building {
  constructor(tx: number, ty: number) {
    super('farmhouse', tx, ty, 7, 4);
  }
}

// Region gates: a locked fence across a corridor that swings open when the
// region unlocks.
export class RegionGate extends Building {
  unlocked = false;
  swing = 0;
  constructor(public region: string, tx: number, ty: number, w: number, h: number, public vertical: boolean) {
    super('regiongate', tx, ty, w, h);
  }
  stamp(map: WorldMap) {
    if (this.swing < 0.9) {
      if (this.vertical) fillCells(map, this.cx - 2, this.y0, this.cx + 2, this.y1, SOLID);
      else fillCells(map, this.x0, this.cy - 2, this.x1, this.cy + 2, SOLID);
    }
  }
}
