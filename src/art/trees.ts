import { U32 } from '../palette';
import { hash2 } from '../rng';

// Procedural trees stamped into the baked canopy, lit from the upper right
// so the shade gathers on the lower left. `kind` records what owns each
// canopy pixel: 1 forest mass, 2 broadleaf crown, 3 pine.

export interface CanopyBuf {
  W: number;
  H: number;
  cp: Uint32Array; // colours
  cm: Uint8Array; // canopy coverage
  kind: Uint8Array;
}

// > 0 on the side facing away from the light (lower left).
const shade = (dx: number, dy: number, d: number) => (-dx * 0.6 + dy * 0.8) / (d || 1);

// A round broadleaf crown seen from above, drawn like the reference's
// bushes: mostly teal, a plum crescent along its shaded rim (so neighbouring
// crowns read as separate trees), one or two little leaf arcs inside and a
// few sage glints on the lit side.
export function stampCrown(b: CanopyBuf, cx: number, cy: number, r: number, seed: number, light = false) {
  const { W, H, cp, cm, kind } = b;
  const R = Math.ceil(r) + 1;
  const put = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (kind[i] === 2) cp[i] = c;
  };
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(dx, dy * 1.08);
      const rr = r + (hash2(x, y, seed) - 0.5) * 0.8;
      if (d > rr) continue;
      const i = y * W + x;
      const s = shade(dx, dy, d);
      cm[i] = 1;
      kind[i] = 2;
      let c = U32.teal;
      if (d > rr - 1.1 && s > 0.1) c = U32.plum;
      else if (d > rr - 2.2 && s > 0.7) c = hash2(x, y, seed + 1) < 0.4 ? U32.plum : U32.teal;
      else if (d > rr - 1.5 && s < -0.5 && hash2(x, y, seed + 3) < (light ? 0.7 : 0.35)) c = U32.sage;
      else if (light && s < -0.2 && d > rr * 0.4 && hash2(x, y, seed + 2) < 0.18) c = U32.sage;
      cp[i] = c;
    }
  }
  // Leaf arcs: little "u" marks in the lower half of the crown.
  const n = r > 5 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const ax = cx + Math.round((hash2(cx, cy, seed + 10 + k) - 0.5) * r * 0.9);
    const ay = cy + Math.round(hash2(cx, cy, seed + 20 + k) * r * 0.45);
    const w = 1 + (hash2(cx, cy, seed + 30 + k) < 0.5 ? 1 : 0);
    put(ax - w, ay - 1, U32.plum);
    for (let x = ax - w + 1; x < ax + w; x++) put(x, ay, U32.plum);
    put(ax + w, ay - 1, U32.plum);
  }
}

// Conifers stand up a little, like the buildings: a narrow cone of three
// tiers, the top row of each lower tier in the shade of the one above, the
// left side dark, the right edge catching the light. (bx, by) is the base.
export function pineShape(h: number): string[] {
  const M = h >= 14 ? 5 : 4;
  const a = Math.round(h * 0.34), b = Math.round(h * 0.67);
  const tiers: [number, number][] = [[0, a], [a, b], [b, h]];
  const rows: string[] = [];
  tiers.forEach(([s, e], k) => {
    for (let r = s; r < e; r++) {
      const u = (r - s) / Math.max(1, e - s - 1);
      const wTop = k === 0 ? 0 : M * (0.15 + 0.15 * k);
      const wBot = M * (k === 0 ? 0.55 : k === 1 ? 0.8 : 1);
      const w = Math.round(wTop + (wBot - wTop) * u);
      let row = '';
      for (let dx = -M; dx <= M; dx++) {
        if (Math.abs(dx) > w) { row += '.'; continue; }
        let c = 't';
        if (r === 0) c = 't';
        else if (k > 0 && r === s) c = dx < w ? 'p' : 's';
        else if (dx === -w) c = 'p';
        else if (r === e - 1 && k === 2 && dx < w * 0.3) c = 'p';
        else if (u > 0.45 && dx < -w * 0.4 && ((dx + r) & 1) === 0) c = 'p';
        else if (dx === w && u < 0.85) c = 's';
        row += c;
      }
      rows.push(row);
    }
  });
  return rows;
}

const shapes = new Map<number, string[]>();
const shapeOf = (h: number) => {
  let s = shapes.get(h);
  if (!s) shapes.set(h, (s = pineShape(h)));
  return s;
};

export function stampPine(b: CanopyBuf, bx: number, by: number, h: number) {
  const { W, H, cp, cm, kind } = b;
  const rows = shapeOf(h);
  const M = (rows[0].length - 1) / 2;
  for (let r = 0; r < rows.length; r++) {
    const y = by - rows.length + 1 + r;
    if (y < 0 || y >= H) continue;
    const row = rows[r];
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (ch === '.') continue;
      const x = bx - M + k;
      if (x < 0 || x >= W) continue;
      const i = y * W + x;
      cm[i] = 1;
      kind[i] = 3;
      cp[i] = ch === 'p' ? U32.plum : ch === 's' ? U32.sage : U32.teal;
    }
  }
}

// Rough coverage of a pine (for packing), without drawing.
export function pineCovers(cov: Uint8Array, W: number, H: number, bx: number, by: number, h: number) {
  const rows = shapeOf(h);
  const M = (rows[0].length - 1) / 2;
  for (let r = Math.floor(rows.length * 0.3); r < rows.length; r++) {
    const y = by - rows.length + 1 + r;
    if (y < 0 || y >= H) continue;
    for (let k = 1; k < rows[r].length - 1; k++) {
      const x = bx - M + k;
      if (rows[r][k] !== '.' && x >= 0 && x < W) cov[y * W + x] = 1;
    }
  }
}

// A willow by the water: a round crown taller than wide, its lower half
// hanging in strands that trail below the outline, sage-lit on the sunny
// side, a plum crescent of shade.
export function stampWillow(b: CanopyBuf, cx: number, cy: number, r: number, seed: number) {
  const { W, H, cp, cm, kind } = b;
  const R = Math.ceil(r) + 1;
  for (let dy = -R; dy <= R + 3; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const strand = ((x + Math.floor(hash2(x, 0, seed) * 2)) & 1) === 0;
      const d = Math.hypot(dx, dy * 0.9);
      const hang = dy > 0 && strand ? Math.floor(hash2(x, cy, seed + 1) * 4) : 0;
      if (d > r + (dy > 0 ? hang : 0) + (hash2(x, y, seed) - 0.5) * 0.7) continue;
      const i = y * W + x;
      const s = (-dx * 0.6 + dy * 0.8) / (d || 1);
      cm[i] = 1;
      kind[i] = 2;
      let c = U32.teal;
      if (dy > -r * 0.2) c = strand ? (s < -0.2 && hash2(x, y, seed + 2) < 0.6 ? U32.sage : U32.teal) : U32.plum;
      if (d > r - 1.2 && s > 0.2 && dy < 1) c = U32.plum;
      else if (d > r - 1.5 && s < -0.5 && hash2(x, y, seed + 3) < 0.4) c = U32.sage;
      cp[i] = c;
    }
  }
}
