import { fbm } from '../rng';
import type { Baked } from './terrain';
import { WORLD_H, WORLD_W } from './map';

// Where fog lies, 0..1, from the land: thickest over water and along its
// banks, pooled in the hollows between the Rolling Hills' mounds and hanging
// at the forest's feet; thin on the rock tops and up in the High Range. A
// slow wobble gives the banks shapes. Handed to the night overlay once
// (render/night.ts setFogField), which samples it at quarter resolution.

const Q = 4; // world px per cell

function blur(a: Float32Array, w: number, h: number, r: number) {
  let src = a;
  for (const horiz of [true, false]) {
    const out = new Float32Array(w * h);
    const n = horiz ? w : h, m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      const at = (k: number) => src[horiz ? j * w + k : k * w + j];
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += at(Math.max(0, Math.min(n - 1, k)));
      for (let k = 0; k < n; k++) {
        out[horiz ? j * w + k : k * w + j] = acc / (2 * r + 1);
        acc += at(Math.min(n - 1, k + r + 1)) - at(Math.max(0, k - r));
      }
    }
    src = out;
  }
  return src;
}

export function fogDensity(b: Baked): (wx: number, wy: number) => number {
  const d = b.fine;
  const w = Math.ceil(WORLD_W / Q), h = Math.ceil(WORLD_H / Q);
  const wet = new Float32Array(w * h), wood = new Float32Array(w * h), hollow = new Float32Array(w * h);
  const hl = d.hills;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const wx = Math.min(WORLD_W - 1, x * Q + 2), wy = Math.min(WORLD_H - 1, y * Q + 2);
      const i = wy * WORLD_W + wx;
      const s = b.soil[i];
      wet[y * w + x] = s === 3 ? 1 : s === 2 ? 0.8 : 0;
      wood[y * w + x] = d.cm[i] ? 1 : 0;
      // The hills: off the mounds is a hollow.
      const lx = wx - hl.x0, ly = wy - hl.y0;
      if (lx >= 0 && ly >= 0 && lx < hl.w && ly < hl.h && d.map.regionAt(wx, wy)?.id === 'hills') hollow[y * w + x] = hl.owner[ly * hl.w + lx] < 0 ? 1 : 0;
    }
  const wetB = blur(blur(wet, w, h, 6), w, h, 4);
  const woodB = blur(wood, w, h, 4);
  const hollowB = blur(hollow, w, h, 3);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const wx = x * Q + 2, wy = y * Q + 2;
      const i = Math.min(WORLD_H - 1, wy) * WORLD_W + Math.min(WORLD_W - 1, wx);
      const reg = d.map.regionAt(wx, wy)?.id;
      let v = 0.32;
      v = Math.max(v, Math.min(1, wetB[k] * 2.2)); // water and its banks
      if (!wood[k]) v += 0.35 * Math.max(0, 1 - Math.abs(woodB[k] - 0.35) / 0.3); // the forest's feet
      v = Math.max(v, hollowB[k] * 0.85); // the hills' hollows
      if (b.soil[i] === 4) v *= 0.35; // rock tops stand clear
      if (reg === 'high') v *= 0.45;
      else if (reg === 'rocky') v *= 0.7;
      // Banks with shapes, drifting thick and thin.
      v *= 0.7 + 0.6 * fbm(wx / 110, wy / 80, 777, 2);
      data[k] = Math.max(0, Math.min(1, v));
    }
  return (wx, wy) => {
    const x = Math.max(0, Math.min(w - 1, Math.floor(wx / Q))), y = Math.max(0, Math.min(h - 1, Math.floor(wy / Q)));
    return data[y * w + x];
  };
}
