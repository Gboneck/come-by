import { fbm, hash2, mulberry32, type Rng } from '../rng';
import { PLACES, PROPS } from './places';

// Terrain is authored on 8px tiles; collision runs on 4px cells so fences can
// be thin.
export const TS = 8;
export const CS = 4;
export const MW = 192;
export const MH = 168;
export const CW = MW * 2;
export const CH = MH * 2;
export const WORLD_W = MW * TS;
export const WORLD_H = MH * TS;

export const enum Ter {
  Grass = 0,
  Forest = 1,
  Rock = 2,
  Water = 3,
  Shallow = 4,
}

// Collision cell flags.
export const SOLID = 1;
export const ROCK = 2; // blocks all but climbers (goats)
export const SHALLOW = 4; // slows; cattle balk
export const DEEP = 8;
export const GATE = 16; // pen gate cell: always blocks penned animals
export const PEN = 32; // inside a pen
export const RANCH = 64; // buildable ranch ground

export const BLOCK_DOG = SOLID | DEEP | ROCK;
export const BLOCK_ANIMAL = SOLID | DEEP | ROCK;
export const BLOCK_CLIMBER = SOLID | DEEP;

export type SpeciesId = 'duck' | 'sheep' | 'goat' | 'cow' | 'pony';
export type RegionId = 'ranch' | 'meadow' | 'hills' | 'rocky' | 'ford' | 'high' | 'show';

export interface RegionDef {
  id: RegionId;
  index: number;
  name: string;
  tier: number; // tier at which the region opens
  species: SpeciesId | null;
  cx: number; // tile centre
  cy: number;
  rx: number; // tile radii
  ry: number;
  // Locked region gate: a line of tiles across the access corridor.
  gate: { x: number; y: number; vertical: boolean; span: number } | null;
}

export const REGIONS: RegionDef[] = [
  { id: 'ranch', index: 1, name: 'The Ranch', tier: 1, species: null, cx: 96, cy: 104, rx: 24, ry: 18, gate: null },
  { id: 'meadow', index: 2, name: 'Home Meadow', tier: 1, species: 'duck', cx: 148, cy: 106, rx: 25, ry: 18, gate: null },
  { id: 'hills', index: 3, name: 'Rolling Hills', tier: 2, species: 'sheep', cx: 144, cy: 52, rx: 32, ry: 19, gate: { x: 110, y: 66, vertical: true, span: 7 } },
  { id: 'rocky', index: 4, name: 'Rocky Rise', tier: 3, species: 'goat', cx: 46, cy: 52, rx: 32, ry: 19, gate: { x: 82, y: 66, vertical: true, span: 7 } },
  { id: 'ford', index: 5, name: 'River Ford', tier: 4, species: 'cow', cx: 38, cy: 124, rx: 31, ry: 29, gate: { x: 71, y: 104, vertical: true, span: 7 } },
  { id: 'high', index: 6, name: 'High Range', tier: 5, species: 'pony', cx: 96, cy: 15, rx: 72, ry: 11, gate: { x: 96, y: 37, vertical: false, span: 7 } },
  // Trial course and sale yard, reached through the Home Meadow.
  { id: 'show', index: 7, name: 'Show Ground', tier: 2, species: null, cx: 120, cy: 148, rx: 40, ry: 17, gate: { x: 140, y: 128, vertical: false, span: 7 } },
];

// ---- Show Ground trial course (pixels) ----
// Release point at the top, fetch gate, handler's post, drive gate (left),
// cross-drive gate (right), then the trial pen beside the post. Each gate is
// a mid point and the direction the flock should pass through it.
export const COURSE = {
  release: { x: 832, y: 1124 },
  post: { x: 832, y: 1256 },
  gates: [
    { id: 'fetch', name: 'FETCH GATE', x: 832, y: 1184, dx: 0, dy: 1 },
    { id: 'drive', name: 'DRIVE GATE', x: 712, y: 1146, dx: -0.77, dy: -0.64 },
    { id: 'cross', name: 'CROSS GATE', x: 952, y: 1146, dx: 1, dy: 0 },
  ],
  // Trial pen, in tiles, gate to the north.
  pen: { tx: 110, ty: 153, w: 6, h: 5 },
} as const;
// Where the corridor from the Home Meadow opens onto the Show Ground.
export const SHOW_ENTRY = { x0: 1094, x1: 1146, y: 1090 };

// ---- Buyers' yards (tiles): small pens where orders are delivered ----
export type YardId = 'mill' | 'drover' | 'sale';
export interface YardSite {
  id: YardId;
  name: string; // the buyer
  place: string; // where to find them
  region: RegionId | null; // must be open for orders to go there
  tx: number;
  ty: number;
  rot: 0 | 1 | 2 | 3; // gate side, as for pens
  cart: { tx: number; ty: number }; // the buyer's cart, 2x2 tiles
}
export const YARDS: YardSite[] = [
  { id: 'mill', name: 'THE MILLER', place: 'HOME MEADOW', region: 'meadow', tx: 158, ty: 99, rot: 1, cart: { tx: 165, ty: 101 } },
  { id: 'drover', name: 'THE DROVER', place: 'THE CROSSROADS', region: null, tx: 105, ty: 75, rot: 1, cart: { tx: 112, ty: 77 } },
  { id: 'sale', name: 'THE SALE YARD', place: 'SHOW GROUND', region: 'show', tx: 148, ty: 141, rot: 1, cart: { tx: 155, ty: 143 } },
];
export const YARD_W = 6;
export const YARD_H = 5;

// ---- The valley grows (src/systems/valley.ts) ----
// The village green south-west of the crossroads, west of the north road
// (tiles). The village is built on it one step at a time.
export const VILLAGE = { cx: 86, cy: 78.5, rx: 11.5, ry: 6.5 };
// Fields past the clearing, off the ranch's south side: land to buy, under
// scrub until stock has grazed it clear (src/systems/valley.ts).
export interface PaddockSite { id: 'southwest' | 'southeast'; name: string; price: number; cx: number; cy: number; rx: number; ry: number }
export const PADDOCKS: PaddockSite[] = [
  { id: 'southwest', name: 'THE SOUTH-WEST FIELD', price: 200, cx: 78, cy: 119, rx: 8, ry: 5 },
  { id: 'southeast', name: 'THE SOUTH-EAST FIELD', price: 300, cx: 116, cy: 118, rx: 8, ry: 5 },
];
// The old bridge over the ford (tiles across the river on the ford road),
// and the woodpile in the ford meadow its timber comes from.
export const BRIDGE = { y0: 103, y1: 106 };
export const WOODPILE = { tx: 31, ty: 100 };

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id)!;

// River centre line x as a function of tile y (only below its spring).
export const RIVER_SPRING_Y = 92;
export function riverX(ty: number): number {
  return 58 + Math.sin(ty * 0.11) * 2.2 + Math.sin(ty * 0.031 + 1) * 3;
}
export const FORD_Y0 = 100;
export const FORD_Y1 = 108;

export class WorldMap {
  ter = new Uint8Array(MW * MH);
  region = new Uint8Array(MW * MH); // REGIONS index, 0 = wild forest / corridor
  path = new Uint8Array(MW * MH);
  // Collision cells: terrain flags, then structure flags layered on top.
  terFlags = new Uint8Array(CW * CH);
  structFlags = new Uint8Array(CW * CH);
  // Spawn points per region (pixel coords) where groups can appear.
  spawns: Record<string, { x: number; y: number }[]> = {};
  rng: Rng;

  constructor(seed = 1337) {
    this.rng = mulberry32(seed);
    this.generate();
    this.computeTerFlags();
    this.findSpawns();
  }

  t(x: number, y: number): Ter {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return Ter.Forest;
    return this.ter[y * MW + x];
  }
  setT(x: number, y: number, v: Ter) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return;
    this.ter[y * MW + x] = v;
  }

  regionAt(px: number, py: number): RegionDef | null {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return null;
    const i = this.region[ty * MW + tx];
    return i ? REGIONS[i - 1] : null;
  }

  private carveEllipse(cx: number, cy: number, rx: number, ry: number, regionIndex: number, wobble = 0.22, seed = 0) {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        if (x < 3 || y < 3 || x >= MW - 3 || y >= MH - 3) continue;
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        const n = (fbm(x * 0.12, y * 0.12, 77 + seed) - 0.5) * 2 * wobble;
        if (d < 1 + n) {
          this.setT(x, y, Ter.Grass);
          if (regionIndex) this.region[y * MW + x] = regionIndex;
        }
      }
    }
  }

  private carveCorridor(pts: [number, number][], r: number, path = true) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++) {
          for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
            const d = Math.hypot(xx - x, yy - y);
            const wob = (hash2(xx, yy, 5) - 0.5) * 0.8;
            if (d < r + wob && this.t(xx, yy) === Ter.Forest) this.setT(xx, yy, Ter.Grass);
            if (path && d < 0.9) this.path[yy * MW + xx] = 1;
          }
        }
      }
    }
  }

  private blob(cx: number, cy: number, r: number, v: Ter, onlyOn: Ter | null = Ter.Grass) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy) + (hash2(x, y, 11) - 0.5) * 0.9;
        if (d < r && (onlyOn === null || this.t(x, y) === onlyOn)) this.setT(x, y, v);
      }
    }
  }

  // Keep corridors, gates and spawn areas clear of clutter.
  private clearNear(x: number, y: number, r: number) {
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++)
        if (this.t(xx, yy) !== Ter.Grass && this.t(xx, yy) !== Ter.Water && this.t(xx, yy) !== Ter.Shallow) {
          if (this.region[yy * MW + xx]) this.setT(xx, yy, Ter.Grass);
        }
  }

  private generate() {
    const R = this.rng;
    this.ter.fill(Ter.Forest);

    for (const reg of REGIONS) {
      this.carveEllipse(reg.cx, reg.cy, reg.rx, reg.ry, reg.index, reg.id === 'ranch' ? 0.06 : 0.22, reg.index * 13);
    }

    // Corridors (tile coords). The crossroads clearing sits north of the ranch.
    this.carveEllipse(96, 70, 9, 6, 0, 0.15, 99);
    this.carveCorridor([[96, 104], [96, 84], [96, 70]], 3.6);
    this.carveCorridor([[96, 66], [104, 66], [118, 66], [126, 60]], 3.4);
    this.carveCorridor([[96, 66], [86, 66], [74, 66], [66, 60]], 3.4);
    this.carveCorridor([[96, 66], [96, 50], [96, 30], [96, 20]], 3.4);
    this.carveCorridor([[96, 104], [80, 104], [66, 104], [44, 106]], 3.6);
    this.carveCorridor([[96, 104], [120, 104], [140, 104]], 4.6);
    // Home Meadow down to the Show Ground, and the drover's nook off the
    // crossroads road.
    this.carveCorridor([[140, 104], [140, 124], [140, 138]], 3.4);
    this.carveEllipse(107, 77, 8, 5, 0, 0.12, 98);
    // The village green, and the overgrown paddocks (ranch ground). No RNG,
    // so everything after comes out as before.
    this.carveEllipse(VILLAGE.cx, VILLAGE.cy, VILLAGE.rx, VILLAGE.ry, 0, 0.1, 96);
    for (const [i, p] of PADDOCKS.entries()) this.carveEllipse(p.cx, p.cy, p.rx, p.ry, regionById('ranch').index, 0.1, 90 + i);

    // Home Meadow: a pond and a few groves.
    this.pond(158, 112, 4.2, 2.8);
    for (const [x, y, r] of [[133, 92, 2.2], [165, 96, 2.6], [137, 120, 1.6], [170, 116, 2], [150, 92, 1.2]] as const)
      this.blob(x, y, r, Ter.Forest);

    // Rolling Hills: scattered groves.
    for (let i = 0; i < 9; i++) {
      const a = R() * Math.PI * 2, d = 0.35 + R() * 0.55;
      this.blob(144 + Math.cos(a) * 30 * d, 52 + Math.sin(a) * 17 * d, 1.2 + R() * 1.8, Ter.Forest);
    }

    // Rocky Rise: rock outcrops that goats can climb, a few trees.
    for (let i = 0; i < 16; i++) {
      const a = R() * Math.PI * 2, d = 0.15 + R() * 0.8;
      this.blob(46 + Math.cos(a) * 30 * d, 52 + Math.sin(a) * 17 * d, 1.2 + R() * 2.2, Ter.Rock);
    }
    for (let i = 0; i < 5; i++) {
      const a = R() * Math.PI * 2, d = 0.4 + R() * 0.5;
      this.blob(46 + Math.cos(a) * 30 * d, 52 + Math.sin(a) * 17 * d, 1 + R() * 1.4, Ter.Forest);
    }

    // River Ford: the river runs north-south along the region's east side.
    this.river();
    for (let i = 0; i < 7; i++) {
      const a = R() * Math.PI * 2, d = 0.45 + R() * 0.45;
      this.blob(34 + Math.cos(a) * 24 * d, 126 + Math.sin(a) * 24 * d, 1.2 + R() * 1.6, Ter.Forest);
    }

    // High Range: lone trees and boulders.
    for (let i = 0; i < 14; i++) {
      const x = 32 + R() * 128, y = 7 + R() * 15;
      if (Math.abs(x - 96) < 8) continue;
      this.blob(x, y, 0.8 + R() * 1.4, R() < 0.6 ? Ter.Forest : Ter.Rock);
    }

    // Keep the important bits open.
    this.clearNear(96, 104, 14);
    for (const reg of REGIONS) if (reg.gate) this.clearNear(reg.gate.x, reg.gate.y, 5);
    this.clearNear(140, 104, 5);
    this.clearNear(140, 120, 4);
    // Yards and the trial course stay open ground.
    for (const y of YARDS) {
      this.clearRect(y.tx - 2, y.ty - 2, y.tx + YARD_W + 2, y.ty + YARD_H + 2);
      this.clearRect(y.cart.tx - 1, y.cart.ty - 1, y.cart.tx + 3, y.cart.ty + 3);
    }

    this.carvePlaces();

    // A ring of guaranteed forest at the map edge.
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++)
        if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) this.setT(x, y, Ter.Forest);
  }

  // Turn any trees or rocks in a tile rectangle back into grass.
  private clearRect(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const t = this.t(x, y);
        if (t === Ter.Forest || t === Ter.Rock) this.setT(x, y, Ter.Grass);
      }
  }

  // Hidden places (src/world/places.ts): a pocket in the forest, the narrow
  // way in, and its ponds, rocks, trees and streams. No RNG here, so the rest
  // of the map (and its spawn points) come out as before.
  private carvePlaces() {
    for (const p of PLACES) {
      if (p.rx) this.carveEllipse(p.cx, p.cy, p.rx, p.ry, 0, 0.2, 300 + p.cx);
      this.carveWay(p.way, p.wayR, p.pathFrom);
      for (const [x, y, rx, ry] of p.ponds ?? []) this.pond(x, y, rx, ry);
      for (const [x, y, r] of p.rocks ?? [])
        for (let ty = Math.floor(y - r - 1); ty <= y + r + 1; ty++)
          for (let tx = Math.floor(x - r - 1); tx <= x + r + 1; tx++) {
            const t = this.t(tx, ty);
            if ((t === Ter.Grass || t === Ter.Forest) && Math.hypot(tx - x, ty - y) + (hash2(tx, ty, 13) - 0.5) * 0.9 < r) this.setT(tx, ty, Ter.Rock);
          }
      for (const [x, y, r] of p.trees ?? []) this.blob(x, y, r, Ter.Forest);
      for (const [x, y] of p.stream ?? []) this.setT(x, y, Ter.Shallow);
    }
  }

  // A narrow way through trees and rocks; a trodden path from `pathFrom` on.
  private carveWay(pts: [number, number][], r: number, pathFrom = pts.length) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= steps; s++) {
        const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
        for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++)
          for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
            const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) + (hash2(xx, yy, 6) - 0.5) * 0.7;
            const t = this.t(xx, yy);
            if (d < r && (t === Ter.Forest || t === Ter.Rock)) this.setT(xx, yy, Ter.Grass);
            if (i >= pathFrom && d < 0.7 && this.t(xx, yy) === Ter.Grass) this.path[yy * MW + xx] = 1;
          }
      }
    }
  }

  // Standing stones, walls, trunks and the trail's hurdle block like trees.
  hurdleCells: number[] = [];
  hurdleOpen = false;
  hurdleY = 0; // px: its foot
  private stampProps() {
    for (const p of PROPS) {
      if (!p.solid) continue;
      const [dx, dy, w, h] = p.solid;
      for (let cy = Math.floor((p.y + dy) / CS); cy < Math.ceil((p.y + dy + h) / CS); cy++)
        for (let cx = Math.floor((p.x + dx) / CS); cx < Math.ceil((p.x + dx + w) / CS); cx++)
          if (cx >= 0 && cy >= 0 && cx < CW && cy < CH) this.terFlags[cy * CW + cx] |= SOLID;
    }
    // The Drove Trail's hurdle: two rows of cells across the trail at the
    // lowest point (nearest the ranch) where it is still walled in on both
    // sides, so no dead end is left below it.
    this.hurdleCells = [];
    const trail = PLACES.find((p) => p.id === 'trail')!.way;
    const [[ax, ay], [bx, by]] = [trail[trail.length - 2], trail[trail.length - 1]];
    const open = (cx: number, cy: number) => !(this.terFlags[cy * CW + cx] & SOLID);
    for (let cy = Math.floor((by * TS) / CS); cy > Math.floor((ay * TS) / CS); cy--) {
      const mid = Math.floor(((ax + ((bx - ax) * (cy * CS - ay * TS)) / ((by - ay) * TS)) * TS) / CS);
      const span: [number, number][] = [];
      for (const r of [cy - 1, cy]) {
        if (!open(mid, r)) break;
        let a = mid, b = mid;
        while (open(a - 1, r) && mid - a < 10) a--;
        while (open(b + 1, r) && b - mid < 10) b++;
        if (mid - a >= 10 || b - mid >= 10) break;
        span.push([a, b]);
      }
      if (span.length < 2) continue;
      span.forEach(([a, b], k) => { for (let x = a; x <= b; x++) this.hurdleCells.push((cy - 1 + k) * CW + x); });
      this.hurdleY = (cy + 1) * CS;
      break;
    }
    this.setHurdle(this.hurdleOpen);
  }

  setHurdle(open: boolean) {
    this.hurdleOpen = open;
    for (const i of this.hurdleCells) {
      if (open) this.terFlags[i] &= ~SOLID;
      else this.terFlags[i] |= SOLID;
    }
  }

  // Pixel span of the hurdle (for drawing).
  hurdleSpan(): [number, number] {
    let x0 = 1e9, x1 = -1e9;
    for (const i of this.hurdleCells) {
      x0 = Math.min(x0, (i % CW) * CS);
      x1 = Math.max(x1, (i % CW) * CS + CS);
    }
    return [x0, x1];
  }

  private pond(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (hash2(x, y, 3) - 0.5) * 0.25;
        if (d < 0.7) this.setT(x, y, Ter.Water);
        else if (d < 1) this.setT(x, y, Ter.Shallow);
      }
  }

  private river() {
    for (let y = RIVER_SPRING_Y; y < MH; y++) {
      const cx = riverX(y);
      const w = y < RIVER_SPRING_Y + 3 ? 1.2 + (y - RIVER_SPRING_Y) * 0.5 : 2.6;
      for (let x = Math.floor(cx - w - 2); x <= cx + w + 2; x++) {
        const d = Math.abs(x + 0.5 - cx);
        const ford = y >= FORD_Y0 && y <= FORD_Y1;
        if (d < w) this.setT(x, y, ford ? Ter.Shallow : Ter.Water);
        else if (d < w + 1.2 && this.t(x, y) === Ter.Forest) this.setT(x, y, Ter.Grass);
      }
    }
    // Spring pool.
    this.pond(riverX(RIVER_SPRING_Y), RIVER_SPRING_Y, 2.5, 2);
  }

  computeTerFlags() {
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const t = this.t(cx >> 1, cy >> 1);
        let f = 0;
        if (t === Ter.Forest) f = SOLID;
        else if (t === Ter.Rock) f = ROCK;
        else if (t === Ter.Water) f = DEEP;
        else if (t === Ter.Shallow) f = SHALLOW;
        this.terFlags[cy * CW + cx] = f;
      }
    }
    this.stampProps();
  }

  // The old bridge across the ford (src/systems/valley.ts mends it): under
  // its deck the shallows are dry going, so cattle no longer balk there.
  bridgeOn = false;
  bridgeSpan(): { x0: number; x1: number; y0: number; y1: number } {
    let x0 = MW, x1 = 0;
    for (let y = BRIDGE.y0; y < BRIDGE.y1; y++)
      for (let x = 40; x < 70; x++)
        if (this.t(x, y) === Ter.Shallow) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x + 1);
        }
    return { x0, x1, y0: BRIDGE.y0, y1: BRIDGE.y1 };
  }
  setBridge(on: boolean) {
    this.bridgeOn = on;
    const b = this.bridgeSpan();
    for (let cy = b.y0 * 2; cy < b.y1 * 2; cy++)
      for (let cx = b.x0 * 2; cx < b.x1 * 2; cx++) {
        if (this.t(cx >> 1, cy >> 1) !== Ter.Shallow) continue;
        if (on) this.terFlags[cy * CW + cx] &= ~SHALLOW;
        else this.terFlags[cy * CW + cx] |= SHALLOW;
      }
  }

  // Combined flags for a collision cell.
  cell(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return SOLID;
    const i = cy * CW + cx;
    return this.terFlags[i] | this.structFlags[i];
  }

  flagsAtPx(x: number, y: number): number {
    return this.cell(Math.floor(x / CS), Math.floor(y / CS));
  }

  blockedPx(x: number, y: number, mask: number): boolean {
    return (this.flagsAtPx(x, y) & mask) !== 0;
  }

  private findSpawns() {
    for (const reg of REGIONS) {
      if (!reg.species) continue;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 400 && pts.length < 24; i++) {
        const a = this.rng() * Math.PI * 2, d = Math.sqrt(this.rng()) * 0.75;
        const tx = Math.round(reg.cx + Math.cos(a) * reg.rx * d);
        const ty = Math.round(reg.cy + Math.sin(a) * reg.ry * d);
        if (reg.id === 'ford' && tx > riverX(ty) - 6) continue; // cattle start across the river
        if (YARDS.some((y) => tx > y.tx - 6 && tx < y.tx + YARD_W + 6 && ty > y.ty - 6 && ty < y.ty + YARD_H + 6)) continue;
        let ok = true;
        for (let yy = ty - 3; yy <= ty + 3 && ok; yy++)
          for (let xx = tx - 3; xx <= tx + 3 && ok; xx++)
            if (this.t(xx, yy) !== Ter.Grass || this.region[yy * MW + xx] !== reg.index) ok = false;
        if (ok) pts.push({ x: tx * TS + 4, y: ty * TS + 4 });
      }
      this.spawns[reg.id] = pts;
    }
  }
}
