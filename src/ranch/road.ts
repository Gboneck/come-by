import { MH, MW, Ter, regionById, type WorldMap } from '../world/map';
import { Pen, type Building, type BuildingKind, type Rot } from './buildings';

// The drove road: the ranch's dirt roads, kept clear so a flock can always
// be walked from any pen out of the clearing. Nothing may be built on it
// but a field gate. Saves keep whatever was built before the rule.
export const ROAD_HALF = 2; // tiles either side of the worn track

export function roadMask(map: WorldMap): Uint8Array {
  const m = new Uint8Array(MW * MH);
  const ranch = regionById('ranch').index;
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      if (!map.path[ty * MW + tx]) continue;
      for (let dy = -ROAD_HALF; dy <= ROAD_HALF; dy++)
        for (let dx = -ROAD_HALF; dx <= ROAD_HALF; dx++) {
          const x = tx + dx, y = ty + dy;
          if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
          if (map.region[y * MW + x] === ranch) m[y * MW + x] = 1;
        }
    }
  return m;
}

// Why a new building cannot go here (null: it can). Build mode asks this on
// top of its own checks.
export function placementProblem(map: WorldMap, road: Uint8Array, buildings: Building[], kind: BuildingKind, tx: number, ty: number, w: number, h: number, rot: Rot, pen?: Pen): string | null {
  if (kind !== 'gate' && kind !== 'trough')
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (road[y * MW + x]) return 'KEEP THE DROVE ROAD CLEAR';
  if (kind === 'pen') {
    // The gate must open onto open ground: two tiles out, the gate's width.
    const p = pen ?? new Pen(tx, ty, rot);
    for (const out of [6, 14]) {
      const gp = p.gatePoint(out);
      for (const side of [-5, 5]) {
        const along = rot % 2 === 0 ? { x: gp.x + side, y: gp.y } : { x: gp.x, y: gp.y + side };
        const gx = Math.floor(along.x / 8), gy = Math.floor(along.y / 8);
        if (map.t(gx, gy) !== Ter.Grass) return 'THE GATE WOULD OPEN ONTO TREES';
        if (buildings.some((b) => b !== pen && b.id !== pen?.id && b.kind !== 'regiongate' && b.overlapsTiles(gx, gy, 1, 1))) return 'THE GATE WOULD OPEN ONTO A WALL';
      }
    }
  }
  return null;
}
