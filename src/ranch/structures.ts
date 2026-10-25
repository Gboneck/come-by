import { CS, SOLID, type WorldMap } from '../world/map';
import { Building, clearCells, fillCells, type Rot } from './buildings';

// A single fence panel, one tile long. rot 0/2 = east-west, 1/3 = north-south.
export class Fence extends Building {
  constructor(tx: number, ty: number, rot: Rot = 0) {
    super('fence', tx, ty, 1, 1, rot);
  }
  get vertical() {
    return this.rot % 2 === 1;
  }
  stamp(map: WorldMap) {
    if (this.vertical) fillCells(map, this.x0 + CS, this.y0, this.x1, this.y1, SOLID);
    else fillCells(map, this.x0, this.y0 + CS, this.x1, this.y1, SOLID);
  }
}

// Field gate, two tiles wide. Opens itself for the dog and for animals being
// driven through, closes behind them.
export class FieldGate extends Building {
  open = false;
  swing = 0;
  constructor(tx: number, ty: number, rot: Rot = 0) {
    super('gate', tx, ty, rot % 2 === 1 ? 1 : 2, rot % 2 === 1 ? 2 : 1, rot);
  }
  get vertical() {
    return this.rot % 2 === 1;
  }
  band() {
    return this.vertical
      ? { x0: this.x0 + CS, y0: this.y0, x1: this.x1, y1: this.y1 }
      : { x0: this.x0, y0: this.y0 + CS, x1: this.x1, y1: this.y1 };
  }
  stamp(map: WorldMap) {
    const b = this.band();
    if (this.swing > 0.85) clearCells(map, b.x0, b.y0, b.x1, b.y1, SOLID);
    else fillCells(map, b.x0, b.y0, b.x1, b.y1, SOLID);
  }
}

export class Barn extends Building {
  constructor(tx: number, ty: number) {
    super('barn', tx, ty, 6, 5);
  }
  // Pens within this radius are safe at night.
  get shelterRadius() {
    return this.level >= 2 ? 120 : 84;
  }
}

export class Kennel extends Building {
  constructor(tx: number, ty: number) {
    super('kennel', tx, ty, 3, 3);
  }
}

export class Market extends Building {
  constructor(tx: number, ty: number) {
    super('market', tx, ty, 4, 3);
  }
}

export class Windmill extends Building {
  constructor(tx: number, ty: number) {
    super('windmill', tx, ty, 3, 3);
  }
}

// Winter feed: a stack of hay bales. Penned stock eats from it every winter
// night; out of a barn's ring the snow spoils some each night.
export const STACK_BALES = 20;
export class Haystack extends Building {
  bales = STACK_BALES;
  constructor(tx: number, ty: number) {
    super('haystack', tx, ty, 2, 2);
  }
}
