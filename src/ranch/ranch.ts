import type { Animal } from '../entities/animal';
import { BLOCK_ANIMAL, CW, CH, REGIONS, TS, type WorldMap } from '../world/map';
import { Building, Farmhouse, Pen, RegionGate, type Rot } from './buildings';
import { FieldGate } from './structures';

export type RanchEvent =
  | { kind: 'penned'; animal: Animal; pen: Pen }
  | { kind: 'shut'; pen: Pen; batch: Animal[] }
  | { kind: 'open'; pen: Pen };

export class Ranch {
  buildings: Building[] = [];
  regionGates: RegionGate[] = [];

  constructor(public map: WorldMap) {
    for (const r of REGIONS) {
      if (!r.gate) continue;
      const span = this.gateSpan(r.gate.x, r.gate.y, r.gate.vertical);
      const g = r.gate.vertical
        ? new RegionGate(r.id, r.gate.x, span[0], 1, span[1] - span[0] + 1, true)
        : new RegionGate(r.id, span[0], r.gate.y, span[1] - span[0] + 1, 1, false);
      this.regionGates.push(g);
      this.buildings.push(g);
    }
  }

  // Extend a region gate across the whole corridor, wall to wall.
  private gateSpan(x: number, y: number, vertical: boolean): [number, number] {
    const open = (tx: number, ty: number) => !this.map.blockedPx(tx * TS + 4, ty * TS + 4, BLOCK_ANIMAL);
    let a = vertical ? y : x, b = a;
    while (vertical ? open(x, a - 1) : open(a - 1, y)) a--;
    while (vertical ? open(x, b + 1) : open(b + 1, y)) b++;
    return [a, b];
  }

  get pens(): Pen[] {
    return this.buildings.filter((b): b is Pen => b instanceof Pen);
  }

  // Room kept free around the farmhouse so it can grow.
  private lot: { x0: number; y0: number; x1: number; y1: number } | null = null;
  farmhouseLot() {
    return this.lot;
  }

  // The house grows a size at tier 3.
  growFarmhouse(tier: number) {
    const f = this.farmhouse;
    if (!f) return;
    f.level = tier;
    if (tier >= 3 && f.w === 7) {
      f.tx -= 1;
      f.ty -= 1;
      f.w = 9;
      f.h = 5;
    }
  }

  get fieldGates(): FieldGate[] {
    return this.buildings.filter((b): b is FieldGate => b instanceof FieldGate);
  }

  get farmhouse(): Farmhouse | undefined {
    return this.buildings.find((b): b is Farmhouse => b instanceof Farmhouse);
  }

  add(b: Building) {
    this.buildings.push(b);
    this.restamp();
    return b;
  }

  remove(b: Building) {
    this.buildings = this.buildings.filter((x) => x !== b);
    this.restamp();
  }

  restamp() {
    this.map.structFlags.fill(0, 0, CW * CH);
    for (const b of this.buildings) b.stamp(this.map);
  }

  setupStarter() {
    this.add(new Farmhouse(86, 95));
    this.lot = { x0: 84, y0: 92, x1: 96, y1: 101 };
    this.add(new Pen(104, 93, 0 as Rot));
  }

  update(dt: number, animals: Animal[], night: boolean, dogX = -1e9, dogY = -1e9): RanchEvent[] {
    const ev: RanchEvent[] = [];
    // Penning.
    for (const a of animals) {
      if (a.pen || a.gone || a.carried) continue;
      for (const p of this.pens) {
        if (p.contains(a.x, a.y)) {
          a.pen = p;
          a.penT = 0;
          a.stray = false;
          p.animals.push(a);
          if (!p.species) p.species = a.sp.id;
          p.batch.push(a);
          ev.push({ kind: 'penned', animal: a, pen: p });
          break;
        }
      }
    }
    // Gates.
    for (const p of this.pens) {
      p.animals = p.animals.filter((a) => !a.gone && a.pen === p);
      if (p.animals.length === 0 && p.batch.length === 0) p.species = null;
      const gp = p.gatePoint(0);
      let waiting = 0, inGateway = 0;
      for (const a of animals) {
        if (a.gone || a.carried) continue;
        const d = Math.hypot(a.x - gp.x, a.y - gp.y);
        if (!a.pen && d < 60 && p.hasRoomFor(a)) waiting++;
        if (!a.pen && d < a.sp.r + 9) inGateway++;
      }
      const was = p.open;
      if (night || (p.full && p.batch.length === 0)) {
        if (inGateway === 0) p.open = false;
      } else if (waiting > 0) {
        p.open = true;
        p.quietT = 0;
      } else if (p.batch.length > 0) {
        p.quietT += dt;
        if (p.quietT > 0.6 && inGateway === 0) {
          p.open = false;
          ev.push({ kind: 'shut', pen: p, batch: p.batch });
          p.batch = [];
          p.shutFlash = 1;
        }
      }
      if (!was && p.open) ev.push({ kind: 'open', pen: p });
      const before = p.swing;
      p.swing = Math.max(0, Math.min(1, p.swing + (p.open ? 1 : -1) * dt * 2.2));
      if ((before > 0.85) !== (p.swing > 0.85)) p.applyGate(this.map);
      p.shutFlash = Math.max(0, p.shutFlash - dt * 1.5);
    }
    // Field gates open for the dog and for animals being driven through.
    for (const gt of this.fieldGates) {
      let want = !night && Math.hypot(dogX - gt.cx, dogY - gt.cy) < 22;
      if (!night && !want)
        for (const a of animals)
          if (!a.pen && !a.gone && (a.pressure > 0.05 || a.fleeT > 0) && Math.hypot(a.x - gt.cx, a.y - gt.cy) < 30) { want = true; break; }
      if (want) gt.open = true;
      else if (gt.open) {
        let blocked = Math.hypot(dogX - gt.cx, dogY - gt.cy) < 10;
        for (const a of animals) if (!a.gone && Math.hypot(a.x - gt.cx, a.y - gt.cy) < a.sp.r + 8) blocked = true;
        if (!blocked) gt.open = false;
      }
      const before = gt.swing;
      gt.swing = Math.max(0, Math.min(1, gt.swing + (gt.open ? 1 : -1) * dt * 3));
      if ((before > 0.85) !== (gt.swing > 0.85)) this.restamp();
    }
    // Region gates swing open once unlocked.
    for (const g of this.regionGates) {
      if (g.unlocked && g.swing < 1) {
        const before = g.swing;
        g.swing = Math.min(1, g.swing + dt * 0.8);
        if (before < 0.9 && g.swing >= 0.9) this.restamp();
      }
    }
    return ev;
  }
}
