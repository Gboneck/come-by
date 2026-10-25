import type { Animal } from '../entities/animal';
import { COURSE, SOLID, TS, YARD_H, YARD_W, type WorldMap, type YardSite } from '../world/map';
import { Pen, fillCells, type Rot } from './buildings';
import { clamp } from '../util';

// Things out in the valley that are not the player's buildings: buyers'
// yards and the Show Ground's trial course. Stamped with the ranch.
export interface Fixture {
  stamp(map: WorldMap): void;
}

function smallPen(tx: number, ty: number, w: number, h: number, rot: Rot): Pen {
  const p = new Pen(tx, ty, rot);
  p.w = w;
  p.h = h;
  p.open = false;
  p.swing = 0;
  return p;
}

// A fixture pen's gate swings like a ranch pen's.
export function swingGate(p: Pen, dt: number, map: WorldMap) {
  const before = p.swing;
  p.swing = clamp(p.swing + (p.open ? 1 : -1) * dt * 2.2, 0, 1);
  if ((before > 0.85) !== (p.swing > 0.85)) p.applyGate(map);
  p.shutFlash = Math.max(0, p.shutFlash - dt * 1.5);
}

// Pen whoever `ok` allows that has walked inside. Returns the newcomers.
export function admit(p: Pen, animals: Animal[], ok: (a: Animal) => boolean): Animal[] {
  const got: Animal[] = [];
  for (const a of animals) {
    if (a.pen || a.gone || a.carried || !ok(a) || !p.contains(a.x, a.y)) continue;
    a.pen = p;
    a.penT = 0;
    a.stray = false;
    p.animals.push(a);
    got.push(a);
  }
  return got;
}

// Anyone shut in a fixture pen without being penned there (they wandered
// in) is put back outside its gate.
export function evict(p: Pen, animals: Animal[]) {
  const out = p.gatePoint(10);
  for (const a of animals)
    if (!a.gone && a.pen !== p && p.covers(a.x, a.y)) {
      a.x = out.x + (Math.random() - 0.5) * 6;
      a.y = out.y + (Math.random() - 0.5) * 6;
    }
}

// A buyer's yard: a small pen beside the buyer's cart.
export class Yard implements Fixture {
  pen: Pen;
  leaveT = 0; // countdown to the buyer leading the stock away
  constructor(public site: YardSite) {
    this.pen = smallPen(site.tx, site.ty, YARD_W, YARD_H, site.rot);
  }
  get cartX() {
    return (this.site.cart.tx + 1) * TS;
  }
  get cartY() {
    return (this.site.cart.ty + 1) * TS;
  }
  stamp(map: WorldMap) {
    this.pen.stamp(map);
    const x = this.site.cart.tx * TS, y = this.site.cart.ty * TS;
    fillCells(map, x, y + 4, x + 16, y + 14, SOLID);
  }
}

export interface CourseGate {
  id: string;
  name: string;
  x: number;
  y: number;
  dx: number; // the way through
  dy: number;
  half: number; // half the opening
  posts: { x: number; y: number }[];
}

export const GATE_HALF = 14;

// Fetch gate, drive gate, cross-drive gate, the handler's post and the
// trial pen. The posts are solid; the pen opens for the last leg.
export class Course implements Fixture {
  gates: CourseGate[];
  pen: Pen;
  post = COURSE.post;
  release = COURSE.release;
  constructor() {
    this.gates = COURSE.gates.map((g) => {
      const l = Math.hypot(g.dx, g.dy);
      const dx = g.dx / l, dy = g.dy / l;
      const s = GATE_HALF + 1;
      return {
        id: g.id, name: g.name, x: g.x, y: g.y, dx, dy, half: GATE_HALF,
        posts: [
          { x: Math.round(g.x - dy * s), y: Math.round(g.y + dx * s) },
          { x: Math.round(g.x + dy * s), y: Math.round(g.y - dx * s) },
        ],
      };
    });
    const c = COURSE.pen;
    this.pen = smallPen(c.tx, c.ty, c.w, c.h, 2);
  }
  stamp(map: WorldMap) {
    for (const g of this.gates) for (const p of g.posts) fillCells(map, p.x - 1, p.y - 2, p.x + 2, p.y + 1, SOLID);
    fillCells(map, this.post.x - 1, this.post.y - 2, this.post.x + 2, this.post.y + 1, SOLID);
    this.pen.stamp(map);
  }
}
