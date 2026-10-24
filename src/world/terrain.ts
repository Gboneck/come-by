import { U32 } from '../palette';
import { fbm, hash2, mulberry32, vnoise } from '../rng';
import { makeCanvas } from '../gfx/screen';
import { MH, MW, TS, Ter, WORLD_H, WORLD_W, type WorldMap } from './map';

// Canopy shadows fall down-left, as in the reference.
export const SHADOW_DX = -5;
export const SHADOW_DY = 6;

export interface Baked {
  ground: HTMLCanvasElement;
  canopy: HTMLCanvasElement;
}

function tileField(map: WorldMap, pred: (t: Ter, i: number) => boolean): Float32Array {
  const f = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) f[i] = pred(map.ter[i], i) ? 1 : 0;
  return f;
}

// Bilinear sample of a tile field at a pixel position.
function sample(f: Float32Array, x: number, y: number): number {
  const fx = x / TS - 0.5, fy = y / TS - 0.5;
  let x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const x1 = Math.min(MW - 1, Math.max(0, x0 + 1)), y1 = Math.min(MH - 1, Math.max(0, y0 + 1));
  x0 = Math.min(MW - 1, Math.max(0, x0));
  y0 = Math.min(MH - 1, Math.max(0, y0));
  const a = f[y0 * MW + x0], b = f[y0 * MW + x1], c = f[y1 * MW + x0], d = f[y1 * MW + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function edgeMask(field: Float32Array, threshold: number, seed: number, scale: number, amp: number, jitter: number): Uint8Array {
  const W = WORLD_W, H = WORLD_H;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = sample(field, x, y);
      if (f <= 0.001) continue;
      if (f >= 0.999) { m[y * W + x] = 1; continue; }
      const n = (fbm(x * scale, y * scale, seed, 2) - 0.5) * amp + (hash2(x, y, seed + 3) - 0.5) * jitter;
      if (f + n > threshold) m[y * W + x] = 1;
    }
  }
  return m;
}

export function bake(map: WorldMap): Baked {
  const W = WORLD_W, H = WORLD_H;
  const at = (m: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : m[y * W + x]);

  const forest = edgeMask(tileField(map, (t) => t === Ter.Forest), 0.36, 5, 0.11, 0.75, 0.18);
  const rock = edgeMask(tileField(map, (t) => t === Ter.Rock), 0.45, 21, 0.2, 0.5, 0.1);
  const water = edgeMask(tileField(map, (t) => t === Ter.Water || t === Ter.Shallow), 0.5, 31, 0.15, 0.35, 0.05);
  const deep = edgeMask(tileField(map, (t) => t === Ter.Water), 0.55, 37, 0.15, 0.3, 0.05);
  const path = edgeMask(tileField(map, (_t, i) => map.path[i] === 1), 0.42, 41, 0.25, 0.45, 0.22);

  // ---- Ground ----
  const [ground, gg] = makeCanvas(W, H);
  const gimg = gg.createImageData(W, H);
  const gp = new Uint32Array(gimg.data.buffer);
  const shadow = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c = U32.meadow;
      if (path[i]) c = hash2(x, y, 44) < 0.035 ? U32.sage : U32.moss;
      if (water[i]) {
        if (deep[i]) {
          c = U32.teal;
          // A dark lip where the north bank overhangs.
          if (!at(water, x, y - 1) || !at(water, x, y - 2)) c = U32.plum;
          else if (hash2(x >> 2, y, 51) < 0.05 && (x & 3) !== 0) c = U32.wool;
        } else {
          c = ((x + y) & 1) === 0 ? U32.teal : U32.sage;
          if (!at(water, x, y - 1)) c = U32.plum;
          else if (hash2(x >> 1, y, 53) < 0.09) c = U32.wool;
        }
      }
      if (rock[i]) {
        const below = at(rock, x, y + 1), below2 = at(rock, x, y + 2), left = at(rock, x - 1, y);
        const above = at(rock, x, y - 1);
        if (!below || !left) c = U32.plum;
        else if (!below2) c = U32.sage;
        else if (!above) c = U32.wool;
        else {
          const n = vnoise(x * 0.3, y * 0.3, 61);
          if (Math.abs(n - 0.5) < 0.035) c = U32.plum;
          else if (n < 0.38) c = U32.sage;
          else c = U32.wool;
        }
      }
      gp[i] = c;
    }
  }

  // Canopy and rock shadows (down-left), sage on grass, plum on water.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (forest[i]) continue;
      const fromTree = at(forest, x - SHADOW_DX, y - SHADOW_DY) === 1;
      const fromRock = !rock[i] && at(rock, x + 2, y - 3) === 1;
      if (fromTree || fromRock) {
        shadow[i] = 1;
        gp[i] = water[i] ? U32.plum : rock[i] ? U32.sage : U32.sage;
      }
    }
  }

  // Grass tufts: little vertical strokes in clusters, now and then a buttercup.
  const plot = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    gp[y * W + x] = c;
  };
  const isOpenGrass = (x: number, y: number) => {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (map.t(tx, ty) !== Ter.Grass) return false;
    const i = y * W + x;
    return !path[i] && !water[i] && !rock[i] && !forest[i];
  };
  const R = mulberry32(9);
  const tufts = Math.floor((W * H) / 1100);
  for (let k = 0; k < tufts; k++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H);
    if (!isOpenGrass(x, y) || !isOpenGrass(x + 6, y)) continue;
    const inShadow = shadow[y * W + x];
    const n = 3 + Math.floor(R() * 2);
    let ox = 0;
    const flowerFirst = R() < 0.3;
    for (let j = 0; j < n; j++) {
      if (j === 0 && flowerFirst) {
        plot(x + ox, y, U32.butter);
      } else {
        const h = 1 + Math.floor(R() * 3);
        const col = inShadow ? U32.moss : R() < 0.75 ? U32.sage : U32.moss;
        for (let t = 0; t < h; t++) plot(x + ox, y - t, col);
      }
      ox += 1 + (R() < 0.6 ? 1 : 0);
    }
  }
  // Loose buttercups, thicker in the Home Meadow.
  const flowers = Math.floor((W * H) / 1800);
  for (let k = 0; k < flowers; k++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H);
    if (!isOpenGrass(x, y) || shadow[y * W + x]) continue;
    const reg = map.regionAt(x, y);
    if (reg?.id !== 'meadow' && R() < 0.55) continue;
    plot(x, y, U32.butter);
    if (R() < 0.35) plot(x + 2, y + 1, U32.butter);
    if (R() < 0.5) plot(x, y + 1, U32.sage);
  }
  gg.putImageData(gimg, 0, 0);

  // ---- Canopy ----
  // Mostly teal. Plum is drawn the way the reference does it: thin hand-drawn
  // marks, i.e. the lower arcs of leaf clumps, little chevrons and specks,
  // getting denser on the shaded lower-left side of each mass.
  const [canopy, cg] = makeCanvas(W, H);
  const cimg = cg.createImageData(W, H);
  const cp = new Uint32Array(cimg.data.buffer);
  for (let i = 0; i < W * H; i++) if (forest[i]) cp[i] = U32.teal;
  const plum = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (forest[i]) cp[i] = U32.plum;
  };
  // Edges and the shaded side.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!forest[i]) continue;
      if (!at(forest, x, y + 1) || !at(forest, x - 1, y)) cp[i] = U32.plum;
      else if (!at(forest, x - 3, y + 3) && vnoise(x * 0.5, y * 0.5, 81) < 0.5) cp[i] = U32.plum;
      else if (!at(forest, x - 7, y + 7) && vnoise(x * 0.45, y * 0.45, 82) < 0.28) cp[i] = U32.plum;
    }
  }
  // Leaf clumps on a jittered grid.
  const CELL = 6;
  for (let gy = 0; gy < H / CELL + 1; gy++) {
    for (let gx = 0; gx < W / CELL + 1; gx++) {
      const h1 = hash2(gx, gy, 91), h2 = hash2(gx, gy, 92), h3 = hash2(gx, gy, 93);
      const cx = Math.floor((gx + 0.15 + h1 * 0.7) * CELL + (gy & 1) * 3);
      const cy = Math.floor((gy + 0.15 + h2 * 0.7) * CELL);
      if (!at(forest, cx, cy) || cx >= W || cy >= H) continue;
      const kind = h3;
      if (kind < 0.62) {
        // Lower arc of a clump: a little "U".
        const r = 2 + Math.floor(hash2(gx, gy, 94) * 2.5);
        const a0 = 0.25 + hash2(gx, gy, 95) * 0.4, a1 = Math.PI - 0.25 - hash2(gx, gy, 96) * 0.4;
        let lx = -999, ly = -999;
        for (let a = a0; a <= a1; a += 0.08) {
          const px = Math.round(cx + Math.cos(a) * r * 1.15), py = Math.round(cy + Math.sin(a) * r * 0.95);
          if (px === lx && py === ly) continue;
          lx = px; ly = py;
          if (hash2(px, py, 97) < 0.88) plum(px, py);
        }
      } else if (kind < 0.8) {
        // Chevron "v".
        plum(cx - 1, cy - 1); plum(cx, cy); plum(cx + 1, cy - 1);
        if (h1 < 0.5) { plum(cx - 2, cy - 2); plum(cx + 2, cy - 2); }
      } else if (kind < 0.9) {
        // Short dash.
        plum(cx, cy); plum(cx + 1, cy); if (h2 < 0.5) plum(cx + 2, cy + 1);
      } else {
        plum(cx, cy);
      }
    }
  }
  cg.putImageData(cimg, 0, 0);

  return { ground, canopy };
}
