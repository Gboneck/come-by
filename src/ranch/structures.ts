import { CS, SOLID, type WorldMap } from '../world/map';
import { Building, clearCells, fillCells, type Pen, type Rot } from './buildings';
import { smallPen } from './fixtures';

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

// The shearing shed: a long shed with a chute along its south side, open at
// both ends, the rail splaying out into wings at each end so a flock can be
// funnelled in. In summer, sheep walked through the chute are shorn as they
// pass the shearer's door (src/systems/farmwork.ts).
export const SHED_LANE = { y0: 16, y1: 36 }; // the chute, pixels down from the top
export class ShearingShed extends Building {
  constructor(tx: number, ty: number) {
    super('shed', tx, ty, 8, 6);
  }
  get lane() {
    return { x0: this.x0, y0: this.y0 + SHED_LANE.y0, x1: this.x1, y1: this.y0 + SHED_LANE.y1 };
  }
  // Where along the chute the shearer works.
  get shearX0() {
    return this.x0 + 20;
  }
  get shearX1() {
    return this.x1 - 20;
  }
  // The rail's wings, pixels: from its ends out to the footprint's corners.
  wings(): [number, number, number, number][] {
    const ry = this.y0 + SHED_LANE.y1 + 2;
    return [[this.x0 + 12, ry, this.x0 + 1, this.y1 - 2], [this.x1 - 12, ry, this.x1 - 1, this.y1 - 2]];
  }
  stamp(map: WorldMap) {
    fillCells(map, this.x0, this.y0, this.x1, this.y0 + SHED_LANE.y0, SOLID); // the shed
    fillCells(map, this.x0 + 12, this.y0 + SHED_LANE.y1, this.x1 - 12, this.y0 + SHED_LANE.y1 + 4, SOLID); // the rail
    for (const [ax, ay, bx, by] of this.wings())
      for (let i = 0; i <= 8; i++) {
        const x = ax + ((bx - ax) * i) / 8, y = ay + ((by - ay) * i) / 8;
        fillCells(map, x - 1, y - 1, x + 2, y + 2, SOLID);
      }
  }
}

// The dairy: a milking parlour with a small yard in front, its gate to the
// south. Mornings, cows walked into the yard are milked and let back out.
export class Dairy extends Building {
  yard: Pen;
  constructor(tx: number, ty: number) {
    super('dairy', tx, ty, 7, 7);
    this.yard = smallPen(tx, ty + 2, 7, 5, 0);
  }
  stamp(map: WorldMap) {
    fillCells(map, this.x0, this.y0, this.x1, this.y0 + 16, SOLID);
    this.yard.stamp(map);
  }
}

// The agility yard: a fenced ring (way in on the south side) with jumps,
// weave poles and a tunnel. The dog runs the course against the clock.
// Course pieces in pixels from the yard's top-left corner.
export const AGILITY = {
  post: { x: 16, y: 52 }, // start and finish
  gate: { x0: 8, x1: 28 }, // the way in, along the south fence
  // Anticlockwise from the post: a jump, the weave, a jump up the east side,
  // the tunnel back west, a last jump, home. Each is two posts, crossed in
  // the given direction (the tunnel's is its far mouth).
  jumps: [
    { id: 'jump', a: { x: 30, y: 40 }, b: { x: 30, y: 54 }, dx: 1, dy: 0 },
    { id: 'jump', a: { x: 75, y: 34 }, b: { x: 91, y: 34 }, dx: 0, dy: -1 },
    { id: 'tunnel', a: { x: 60, y: 10 }, b: { x: 60, y: 22 }, dx: -1, dy: 0 },
    { id: 'jump', a: { x: 36, y: 10 }, b: { x: 36, y: 24 }, dx: -1, dy: 0 },
  ],
  // Weave poles, staggered: passed west to east, between the two rows.
  weave: [{ x: 42, y: 40 }, { x: 54, y: 54 }, { x: 66, y: 40 }, { x: 78, y: 54 }],
  weaveAfter: 0, // the weave comes after this jump
  tunnel: { x0: 60, x1: 80, y0: 10, y1: 22 }, // its walls are the top and bottom
};
export class AgilityYard extends Building {
  constructor(tx: number, ty: number) {
    super('agility', tx, ty, 12, 8);
  }
  at(p: { x: number; y: number }) {
    return { x: this.x0 + p.x, y: this.y0 + p.y };
  }
  // Every pole (jump wings, weave poles) as pixels.
  poles(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const j of AGILITY.jumps) if (j.id === 'jump') out.push(this.at(j.a), this.at(j.b));
    for (const w of AGILITY.weave) out.push(this.at(w));
    return out;
  }
  stamp(map: WorldMap) {
    const { x0, y0, x1, y1 } = this;
    const g = AGILITY.gate;
    fillCells(map, x0, y0, x1, y0 + CS, SOLID);
    fillCells(map, x0, y1 - CS, x0 + g.x0, y1, SOLID);
    fillCells(map, x0 + g.x1, y1 - CS, x1, y1, SOLID);
    fillCells(map, x0, y0, x0 + CS, y1, SOLID);
    fillCells(map, x1 - CS, y0, x1, y1, SOLID);
    for (const p of this.poles()) fillCells(map, p.x - 1, p.y - 1, p.x + 1, p.y + 1, SOLID);
    const t = AGILITY.tunnel;
    fillCells(map, x0 + t.x0, y0 + t.y0 - 2, x0 + t.x1, y0 + t.y0, SOLID);
    fillCells(map, x0 + t.x0, y0 + t.y1, x0 + t.x1, y0 + t.y1 + 2, SOLID);
  }
}
