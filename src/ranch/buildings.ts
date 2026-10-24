import { CS, GATE, PEN, SOLID, TS, type SpeciesId, type WorldMap } from '../world/map';
import type { Animal, Enclosure } from '../entities/animal';
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
const GATE_TILES = 2;

export class Pen extends Building implements Enclosure {
  animals: Animal[] = [];
  species: SpeciesId | null = null;
  open = true; // gate target state
  swing = 1; // 0 closed .. 1 open (animated)
  batch: Animal[] = []; // arrivals since the gate last opened
  quietT = 0; // time with nobody waiting at the gate
  shutFlash = 0;
  goods = 0; // produce waiting to be collected (whole units)
  goodsFrac = 0;
  hasTrough = false;
  sheltered = false; // within a barn's protection

  constructor(tx: number, ty: number, rot: Rot = 0) {
    super('pen', tx, ty, rot % 2 === 0 ? PEN_W : PEN_H, rot % 2 === 0 ? PEN_H : PEN_W, rot);
  }

  get capacity() {
    return this.level >= 2 ? 24 : 16;
  }

  get used() {
    return this.animals.reduce((s, a) => s + a.sp.space, 0);
  }

  hasRoomFor(a: Animal) {
    return this.used + a.sp.space <= this.capacity && (this.species === null || this.species === a.sp.id);
  }

  get full() {
    return this.species ? this.used + SPECIES[this.species].space > this.capacity : false;
  }

  // Interior in pixels (inside the 4px fence band).
  get ix0() { return this.x0 + CS; }
  get iy0() { return this.y0 + CS; }
  get ix1() { return this.x1 - CS; }
  get iy1() { return this.y1 - CS; }

  contains(x: number, y: number) {
    return x > this.ix0 + 1 && x < this.ix1 - 1 && y > this.iy0 + 1 && y < this.iy1 - 1;
  }

  // Gate opening span in pixels, along the gate side.
  gateSpan(): { x0: number; y0: number; x1: number; y1: number } {
    const g = GATE_TILES * TS;
    switch (this.rot) {
      case 0: { const m = Math.round(this.cx / TS) * TS - g / 2; return { x0: m, y0: this.y1 - CS, x1: m + g, y1: this.y1 }; }
      case 2: { const m = Math.round(this.cx / TS) * TS - g / 2; return { x0: m, y0: this.y0, x1: m + g, y1: this.y0 + CS }; }
      case 1: { const m = Math.round(this.cy / TS) * TS - g / 2; return { x0: this.x0, y0: m, x1: this.x0 + CS, y1: m + g }; }
      default: { const m = Math.round(this.cy / TS) * TS - g / 2; return { x0: this.x1 - CS, y0: m, x1: this.x1, y1: m + g }; }
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
    return !a.pen && this.hasRoomFor(a);
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
