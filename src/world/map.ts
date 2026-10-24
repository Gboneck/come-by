import { fbm, hash2, mulberry32, type Rng } from '../rng';

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
export type RegionId = 'ranch' | 'meadow' | 'hills' | 'rocky' | 'ford' | 'high';

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
];

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

    // A ring of guaranteed forest at the map edge.
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++)
        if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) this.setT(x, y, Ter.Forest);
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
