import { C, U32 } from '../palette';
import { fbm, hash2, mulberry32, vnoise } from '../rng';
import { makeCanvas } from '../gfx/screen';
import { stampCrown, stampPine, pineCovers, type CanopyBuf } from '../art/trees';
import { makeWaterAnim, type WaterAnim } from '../art/water';
import { COURSE, FORD_Y0, FORD_Y1, MH, MW, REGIONS, TS, Ter, WORLD_H, WORLD_W, riverX, type RegionDef, type WorldMap } from './map';

// Canopy shadows fall down-left, as in the reference.
export const SHADOW_DX = -5;
export const SHADOW_DY = 6;

// Grass, flowers and reeds are not baked: they are drawn each frame so the
// wind can move them. A blade is a column `h` px tall; `head` recolours its
// top `headH` px (a flower, a cattail).
export interface Blade {
  dx: number;
  h: number;
  c: string;
  head?: string;
  headH?: number;
}
export interface SwayItem {
  x: number;
  y: number;
  blades: Blade[];
  reed?: boolean;
}
export interface SwayGrid {
  cell: number;
  cols: number;
  rows: number;
  cells: SwayItem[][];
}

export interface Baked {
  ground: HTMLCanvasElement;
  canopy: HTMLCanvasElement;
  water: WaterAnim[];
  sway: SwayGrid;
  // What the ground is made of, for footprints: 0 grass, 1 path or mud
  // (moss), 2 wet bank (sage), 3 water, 4 rock.
  soil: Uint8Array;
  // Low spots on paths and banks where puddles gather in the rain.
  puddles: { x: number; y: number; r: number }[];
  groundPx: Uint32Array; // the baked ground's pixels (for the wet look)
  // For the seasons (render/seasons.ts): the canopy's pixels and what owns
  // each (1 forest, 2 broadleaf crown, 3 pine), and water depth from the bank.
  canopyPx: Uint32Array;
  canopyKind: Uint8Array;
  waterDist: Uint8Array;
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

// City-block distance from the edge of a mask, inside it (capped).
function insideDist(m: Uint8Array, W: number, H: number, cap = 15): Uint8Array {
  const d = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = m[i] ? cap : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) v = Math.min(v, d[i - W] + 1);
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) v = Math.min(v, d[i + W] + 1);
      d[i] = v;
    }
  return d;
}

// Separable box blur, repeated: a cheap soft height field from a mask.
function blur(src: Uint8Array | Float32Array, W: number, H: number, r: number, passes: number): Float32Array {
  let a = Float32Array.from(src);
  const b = new Float32Array(W * H);
  const n = r * 2 + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      const row = y * W;
      for (let x = -r; x <= r; x++) s += a[row + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        b[row + x] = s / n;
        s += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / n;
        s += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}

// 0..1 weight of a region at a pixel: full inside, fading out at its rim.
function regionWeight(r: RegionDef, x: number, y: number, inner = 0.8, outer = 1.1): number {
  const dx = (x / TS - r.cx) / r.rx, dy = (y / TS - r.cy) / r.ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, (outer - d) / (outer - inner)));
}

// Connected components of tiles matching `pred` (4-neighbour).
function components(map: WorldMap, pred: (t: Ter) => boolean): { id: Int32Array; size: number[]; box: number[][] } {
  const id = new Int32Array(MW * MH).fill(-1);
  const size: number[] = [], box: number[][] = [];
  const stack: number[] = [];
  for (let i = 0; i < MW * MH; i++) {
    if (id[i] >= 0 || !pred(map.ter[i])) continue;
    const k = size.length;
    let n = 0;
    const bb = [MW, MH, -1, -1];
    id[i] = k;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const x = j % MW, y = (j / MW) | 0;
      bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
        const q = yy * MW + xx;
        if (id[q] < 0 && pred(map.ter[q])) { id[q] = k; stack.push(q); }
      }
    }
    size.push(n);
    box.push(bb);
  }
  return { id, size, box };
}

// Conifers take over towards the High Range (north). 1 = pines.
function pineZone(x: number, y: number): boolean {
  const p = Math.max(0, Math.min(1, (37 * TS - y) / (7 * TS)));
  return p + (vnoise(x * 0.035, y * 0.035, 7) - 0.5) * 0.7 > 0.5;
}

// The map is generated from a fixed seed, so the bake is cached: starting a
// game from the title screen does not bake the world twice.
let cache: { key: number; baked: Baked } | null = null;
function mapKey(map: WorldMap): number {
  let h = 17;
  for (let i = 0; i < map.ter.length; i++) h = (Math.imul(h, 31) + map.ter[i] * 3 + map.path[i]) | 0;
  return h;
}

export function bake(map: WorldMap): Baked {
  const key = mapKey(map);
  if (cache && cache.key === key) return cache.baked;
  const baked = bakeWorld(map);
  cache = { key, baked };
  return baked;
}

function bakeWorld(map: WorldMap): Baked {
  const W = WORLD_W, H = WORLD_H;
  const at = (m: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : m[y * W + x]);
  const atw = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : water[y * W + x]);

  const forest = edgeMask(tileField(map, (t) => t === Ter.Forest), 0.36, 5, 0.11, 0.75, 0.18);
  const rock = edgeMask(tileField(map, (t) => t === Ter.Rock), 0.45, 21, 0.2, 0.5, 0.1);
  const water = edgeMask(tileField(map, (t) => t === Ter.Water || t === Ter.Shallow), 0.5, 31, 0.15, 0.35, 0.05);
  const deep = edgeMask(tileField(map, (t) => t === Ter.Water), 0.55, 37, 0.15, 0.3, 0.05);
  const path = edgeMask(tileField(map, (_t, i) => map.path[i] === 1), 0.42, 41, 0.25, 0.45, 0.22);

  // ---- Canopy ----
  const cb = bakeCanopy(map, forest);
  const cm = cb.cm;

  // ---- Ground ----
  const [ground, gg] = makeCanvas(W, H);
  const gimg = gg.createImageData(W, H);
  const gp = new Uint32Array(gimg.data.buffer);
  const shadow = new Uint8Array(W * H);
  const skip = new Uint8Array(W * H); // water pixels never to highlight
  const wdist = insideDist(water, W, H);
  const rh = blur(rock, W, H, 2, 2); // soft rock height
  const near = blur(rock, W, H, 5, 1); // rock proximity, for scree

  // Rolling Hills: overlapping mounds, back to front. Each one's shaded rim
  // (lower left) is a crescent of moss and its body hides the mounds behind
  // it, so the hills read as rows of rises without any new colour.
  const hills = REGIONS.find((r) => r.id === 'hills')!;
  const hx0 = (hills.cx - hills.rx - 6) * TS, hy0 = (hills.cy - hills.ry - 6) * TS;
  const hw = (hills.rx + 6) * 2 * TS, hh = (hills.ry + 6) * 2 * TS;
  const hm = new Uint8Array(hw * hh); // 0 flat, 1 dithered shade, 2 shade
  {
    const mounds: { x: number; y: number; rx: number; ry: number }[] = [];
    const S = 44;
    for (let gy = 0; gy * S < hh; gy++)
      for (let gx = 0; gx * S < hw; gx++) {
        const x = hx0 + (gx + 0.15 + hash2(gx, gy, 500) * 0.7) * S + (gy & 1) * S * 0.5;
        const y = hy0 + (gy + 0.15 + hash2(gx, gy, 501) * 0.7) * S;
        if (regionWeight(hills, x, y, 0.6, 1.0) < 0.5 || hash2(gx, gy, 502) < 0.15) continue;
        const rx = 26 + hash2(gx, gy, 503) * 30;
        mounds.push({ x, y, rx, ry: rx * (0.5 + hash2(gx, gy, 504) * 0.2) });
      }
    mounds.sort((p, q) => p.y + p.ry - (q.y + q.ry));
    for (const m of mounds) {
      for (let y = Math.floor(m.y - m.ry); y <= m.y + m.ry; y++)
        for (let x = Math.floor(m.x - m.rx); x <= m.x + m.rx; x++) {
          const lx = x - hx0, ly = y - hy0;
          if (lx < 0 || ly < 0 || lx >= hw || ly >= hh) continue;
          const dx = (x - m.x) / m.rx, dy = (y - m.y) / m.ry;
          const d = Math.sqrt(dx * dx + dy * dy) + (hash2(x >> 1, y >> 1, 505) - 0.5) * 0.04;
          if (d > 1) continue;
          const side = (-dx * 0.5 + dy) / (d || 1);
          let v = 0;
          if (d > 0.84 && side > 0.25) v = d > 0.92 && side > 0.5 ? 2 : 1;
          else if (d > 0.74 && side > 0.75) v = 1;
          hm[ly * hw + lx] = v;
        }
    }
  }
  const hillAt = (x: number, y: number) => {
    const lx = x - hx0, ly = y - hy0;
    return lx < 0 || ly < 0 || lx >= hw || ly >= hh ? 0 : hm[ly * hw + lx];
  };

  // Show Ground: mown short (few tufts, see below), the grass worn bare at
  // the handler's post, the release point and the trial pen's gate.
  const show = REGIONS.find((r) => r.id === 'show')!;
  const sx0 = (show.cx - show.rx - 4) * TS, sx1 = (show.cx + show.rx + 4) * TS, sy0 = (show.cy - show.ry - 4) * TS;
  const worn = [
    { x: COURSE.post.x, y: COURSE.post.y + 3, rx: 17, ry: 9 },
    { x: COURSE.release.x, y: COURSE.release.y + 2, rx: 11, ry: 6 },
    { x: (COURSE.pen.tx + COURSE.pen.w / 2) * TS, y: COURSE.pen.ty * TS - 4, rx: 10, ry: 5 },
  ];
  function showGround(x: number, y: number): number {
    const w = regionWeight(show, x, y, 0.75, 0.95);
    if (w <= 0) return U32.meadow;
    for (const p of worn) {
      const d = Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry) + (hash2(x, y, 46) - 0.5) * 0.25;
      if (d < 0.7) return hash2(x, y, 47) < 0.06 ? U32.sage : U32.moss;
      if (d < 1) return ((x + y) & 1) === 0 ? U32.moss : U32.meadow;
    }
    return U32.meadow;
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c = U32.meadow;
      if (y >= hy0 && y < hy0 + hh && x >= hx0 && x < hx0 + hw) {
        const v = hillAt(x, y);
        if (v === 2 || (v === 1 && ((x + y) & 1) === 0)) c = U32.moss;
      } else if (y > sy0 && x > sx0 && x < sx1) c = showGround(x, y);
      if (path[i]) c = hash2(x, y, 44) < 0.035 ? U32.sage : U32.moss;
      else if (at(path, x - 1, y) + at(path, x + 1, y) + at(path, x, y - 1) + at(path, x, y + 1) > 0 && ((x + y) & 1) === 0) c = U32.moss;
      if (water[i]) {
        const wd = wdist[i];
        if (deep[i]) {
          c = U32.teal;
          // A dark lip where the north bank overhangs.
          if (!at(water, x, y - 1) || !at(water, x, y - 2)) c = U32.plum;
          else if (wd <= 1 && ((x + y) & 1) === 0) c = U32.sage;
        } else {
          c = ((x + y) & 1) === 0 ? U32.teal : U32.sage;
          if (!at(water, x, y - 1)) c = U32.plum;
        }
      } else if (!rock[i]) {
        // Banks: a wet sage line where grass meets water, mud beyond it.
        if (atw(x, y - 1) || atw(x - 1, y) || atw(x + 1, y)) c = U32.sage;
        else if ((atw(x, y - 2) || atw(x - 2, y) || atw(x + 2, y)) && ((x + y) & 1) === 0) c = U32.moss;
      }
      if (rock[i]) c = rockColor(x, y);
      gp[i] = c;
    }
  }

  function rockColor(x: number, y: number): number {
    const i = y * W + x;
    if (!at(rock, x, y + 1) || !at(rock, x - 1, y)) return U32.plum;
    // The south face of the outcrop, seen a little from the front.
    const faceH = rh[i] > 0.55 ? 3 : 2;
    let fd = 1;
    while (fd <= faceH && at(rock, x, y + fd + 1)) fd++;
    if (fd <= faceH) return hash2(x, 0, 63) < 0.25 ? U32.plum : U32.sage;
    if (!at(rock, x, y - 1) || !at(rock, x + 1, y)) return U32.wool;
    // The top, lit from the upper right, broken into facets that each catch
    // the light differently, with cracks along some of their seams.
    const gx = rh[i + 1] - rh[i - 1], gy = rh[i + W] - rh[i - W];
    const f = facet(x, y);
    const L = (-gx + gy) * 9 + 0.2 + (f.lit - 0.5) * 0.7;
    if (f.seam < 1 && f.crack && L < 0.6) return U32.plum;
    if (L > 0.05) return U32.wool;
    if (L > -0.12) return ((x + y) & 1) === 0 ? U32.sage : U32.wool;
    return U32.sage;
  }

  // Nearest and second-nearest of a jittered grid of points: facets.
  function facet(x: number, y: number): { lit: number; seam: number; crack: boolean } {
    const S = 11;
    const gx = Math.floor(x / S), gy = Math.floor(y / S);
    let d1 = 1e9, d2 = 1e9, k1 = 0, k2 = 0;
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const cx = gx + k, cy = gy + j;
        const px = (cx + 0.2 + hash2(cx, cy, 68) * 0.6) * S, py = (cy + 0.2 + hash2(cx, cy, 69) * 0.6) * S;
        const d = Math.hypot(x - px, y - py);
        const id = cy * 4096 + cx;
        if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = id; }
        else if (d < d2) { d2 = d; k2 = id; }
      }
    return { lit: hash2(k1, 0, 72), seam: d2 - d1, crack: hash2(Math.min(k1, k2), Math.max(k1, k2), 73) < 0.3 };
  }

  // Small things on the ground, by kind of ground rather than by place, so
  // new areas get them too: wheel ruts and grass down the middle of the
  // tracks, a worn shoulder; tonal speckle, clover, stones, molehill runs
  // and bare patches on open meadow; boulders, roots and fallen logs along
  // the forest edges; stones on the banks.
  function groundDetail() {
    const meadow = U32.meadow, moss = U32.moss, sage = U32.sage;
    const open = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && gp[y * W + x] === meadow && !path[y * W + x] && !water[y * W + x] && !cm[y * W + x];
    const pd = insideDist(path, W, H, 6);
    const notCanopy = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) notCanopy[i] = cm[i] ? 0 : 1;
    const cd = insideDist(notCanopy, W, H, 10);
    // The speckle's noise, on a coarse 4px grid (it is soft anyway).
    const BW = (W >> 2) + 1;
    const tone = new Float32Array(BW * ((H >> 2) + 1));
    for (let by = 0; by * 4 < H; by++) for (let bx = 0; bx < BW; bx++) tone[by * BW + bx] = fbm((bx * 4) / 70, (by * 4) / 64, 701, 2);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (water[i] || rock[i] || cm[i]) continue;
        if (path[i]) {
          // Two ruts worn by cart wheels, grass coming back between them.
          const d = pd[i];
          if (d === 2 && hash2(x >> 1, y >> 1, 140) < 0.8) gp[i] = sage;
          else if (d >= 4 && hash2(x, y, 141) < 0.07) gp[i] = meadow;
          continue;
        }
        if (gp[i] !== meadow) continue;
        // A worn shoulder beside the tracks.
        if (pd[i] === 0 && (path[i - 1] || path[i + 1] || path[i - W] || path[i + W] || path[i - 2] || path[i + 2]) && hash2(x, y, 142) < 0.3) {
          gp[i] = moss;
          continue;
        }
        // Tonal speckle: soft patches where the grass is a shade darker.
        const r = hash2(x, y, 143);
        if (r > 0.3) continue;
        const n = tone[(y >> 2) * BW + (x >> 2)];
        if (n > 0.56 && r < (n - 0.56) * 0.7) gp[i] = moss;
      }
    }
    for (let y = 2; y < H - 3; y++) {
      for (let x = 2; x < W - 3; x++) {
        const i = y * W + x;
        // Stones in the grass.
        if (open(x, y) && open(x, y + 1) && hash2(x, y, 144) < 0.0006) {
          plot(x, y, U32.wool);
          plot(x, y + 1, sage);
          if (hash2(x, y, 145) < 0.4 && open(x + 1, y) && open(x + 1, y + 1)) { plot(x + 1, y, U32.wool); plot(x + 1, y + 1, U32.plum); }
        }
        // Along the forest edge: boulders, roots and a fallen log now and then.
        const c = cd[i];
        if (c >= 1 && c <= 4 && hash2(x, y, 146) < 0.0035 && isGround(x + 3, y + 2) && isGround(x, y + 2)) {
          ['.ww.', 'swww', '.pp.'].forEach((r, yy) => [...r].forEach((ch, xx) => {
            if (ch !== '.') plot(x + xx, y + yy, ch === 'w' ? U32.wool : ch === 's' ? sage : U32.plum);
          }));
          plot(x - 1, y + 2, sage);
        } else if (c === 1 && cm[i - W] && hash2(x, y, 147) < 0.035 && isGround(x, y + 2)) {
          plot(x, y, U32.plum);
          const s2 = hash2(x, y, 148) < 0.5 ? -1 : 1;
          plot(x + s2, y + 1, U32.plum);
          if (hash2(x, y, 149) < 0.5) plot(x + s2 * 2, y + 2, U32.plum);
        }
      }
    }
    // Fallen logs, clover, molehill runs and bare patches, on a coarse grid.
    for (let gy = 0; gy * 23 < H; gy++) {
      for (let gx = 0; gx * 29 < W; gx++) {
        const x = gx * 29 + Math.floor(hash2(gx, gy, 150) * 20), y = gy * 23 + Math.floor(hash2(gx, gy, 151) * 16);
        if (x < 4 || y < 4 || x >= W - 16 || y >= H - 8) continue;
        const k = hash2(gx, gy, 152);
        const reg = map.regionAt(x, y)?.id;
        const c = cd[y * W + x];
        if (c >= 2 && c <= 7 && k < 0.5) {
          // A log, mossed on top, its cut end pale.
          let ok = true;
          for (let yy = -1; yy < 4 && ok; yy++) for (let xx = -1; xx < 13 && ok; xx++) if (!isGround(x + xx, y + yy) || path[(y + yy) * W + x + xx]) ok = false;
          if (!ok) continue;
          for (let xx = 0; xx < 12; xx++) {
            const end = xx >= 10;
            plot(x + xx, y + 3, sage);
            if (end && xx === 10) plot(x + xx, y, U32.wool);
            plot(x + xx, y + 1, end ? (xx === 10 ? U32.wool : U32.butter) : hash2(x + xx, y, 153) < 0.25 ? U32.teal : U32.plum);
            plot(x + xx, y + 2, end ? U32.wool : U32.plum);
            if (!end && xx > 0) plot(x + xx, y, hash2(x + xx, y, 154) < 0.6 ? moss : U32.plum);
          }
          plot(x + 11, y + 1, U32.wool);
          continue;
        }
        if (!open(x, y)) continue;
        if (k < 0.2) {
          // Clover: little trefoils, a white head or two.
          for (let j = 0; j < 6; j++) {
            const cx = x + Math.round((hash2(x + j, y, 155) - 0.5) * 9), cy = y + Math.round((hash2(x, y + j, 156) - 0.5) * 6);
            if (!open(cx, cy) || !open(cx + 1, cy + 1)) continue;
            plot(cx, cy, moss); plot(cx + 1, cy, moss); plot(cx, cy + 1, moss);
            if (hash2(cx, cy, 157) < 0.25) plot(cx + 1, cy - 1, U32.wool);
          }
        } else if (k < 0.27 && reg !== 'ranch' && reg !== 'show') {
          // A molehill run across the field.
          const a = hash2(gx, gy, 158) * Math.PI * 2;
          let mx = x, my = y;
          const n = 3 + Math.floor(hash2(gx, gy, 159) * 3);
          for (let j = 0; j < n; j++) {
            if (open(mx, my) && open(mx + 3, my + 2)) {
              ['.oo.', 'ooos', '.ss.'].forEach((r, yy) => [...r].forEach((ch, xx) => {
                if (ch !== '.') plot(mx + xx, my + yy, ch === 'o' ? moss : sage);
              }));
            }
            mx = Math.round(mx + Math.cos(a + (hash2(mx, my, 160) - 0.5)) * 9);
            my = Math.round(my + Math.sin(a + (hash2(mx, my, 160) - 0.5)) * 6);
          }
        } else if (k < 0.32) {
          // A bare patch where the grass has worn away.
          const r = 3 + hash2(gx, gy, 161) * 4;
          for (let yy = -Math.ceil(r * 0.6); yy <= r * 0.6; yy++)
            for (let xx = -Math.ceil(r); xx <= r; xx++) {
              const d = Math.hypot(xx / r, yy / (r * 0.6)) + (hash2(x + xx, y + yy, 162) - 0.5) * 0.35;
              if (d > 1 || !open(x + xx, y + yy)) continue;
              plot(x + xx, y + yy, d < 0.6 ? (hash2(x + xx, y + yy, 163) < 0.12 ? sage : moss) : ((x + xx + y + yy) & 1) === 0 ? moss : meadow);
            }
        }
      }
    }
    // Stones on the banks.
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        if (water[i] || rock[i] || cm[i] || path[i]) continue;
        if (!(water[i - 1] || water[i + 1] || water[i + W] || water[i - W] || water[i + 2 * W])) continue;
        if (hash2(x, y, 164) < 0.04) { plot(x, y, U32.wool); if (!water[i + W]) plot(x, y + 1, U32.plum); }
      }
  }

  // Canopy and rock shadows (down-left), sage on grass, plum on water.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cm[i]) continue;
      const fromTree = at(cm, x - SHADOW_DX, y - SHADOW_DY) === 1;
      const fromRock = !rock[i] && (at(rock, x + 2, y - 3) === 1 || (y >= 3 && x < W - 3 && rh[i - 3 * W + 3] > 0.62));
      if (fromTree || fromRock) {
        shadow[i] = 1;
        gp[i] = water[i] ? U32.plum : U32.sage;
      }
    }
  }

  const plot = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    gp[y * W + x] = c;
  };
  const isGround = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x;
    return !water[i] && !rock[i] && !cm[i];
  };

  // Scree: loose stones spilling from the outcrops, mostly downhill.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (rock[i] || near[i] < 0.03 || !isGround(x, y) || !isGround(x, y + 1)) continue;
      const below = at(rock, x, y - 4) || at(rock, x + 1, y - 6);
      if (hash2(x, y, 70) > (below ? near[i] * 0.05 + 0.02 : near[i] * 0.012)) continue;
      const k = hash2(x, y, 71);
      if (k < 0.55) { plot(x, y, U32.wool); plot(x, y + 1, U32.plum); }
      else if (k < 0.8) plot(x, y, shadow[i] ? U32.moss : U32.sage);
      else if (isGround(x + 1, y) && isGround(x + 1, y + 1)) {
        plot(x, y, U32.wool); plot(x + 1, y, U32.wool); plot(x, y + 1, U32.plum); plot(x + 1, y + 1, U32.plum);
      }
    }
  }

  // Pebbles on the paths.
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (path[i] && !water[i] && hash2(x, y, 45) < 0.004 && path[i + W]) { gp[i] = U32.wool; gp[i + W] = U32.sage; }
    }

  // The forest floor: ferns and the odd mushroom in the shade of the trees.
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (!shadow[i] || !isGround(x, y) || path[i]) continue;
      const k = hash2(x, y, 80);
      if (k < 0.006 && isGround(x - 1, y - 1) && isGround(x + 1, y - 1)) {
        plot(x - 1, y - 1, U32.teal); plot(x + 1, y - 1, U32.teal); plot(x, y, U32.teal);
        if (hash2(x, y, 81) < 0.5) { plot(x - 2, y - 2, U32.teal); plot(x + 2, y - 2, U32.teal); }
      } else if (k < 0.0075) {
        plot(x, y, U32.wool);
        plot(x, y + 1, U32.plum);
      }
    }
  }

  groundDetail();

  // River Ford: stepping stones along the path where it crosses.
  const stones: { x: number; y: number }[] = [];
  {
    const ty = (FORD_Y0 + FORD_Y1) / 2 + 0.5;
    const cy = Math.round(ty * TS);
    const rx = riverX(ty) * TS;
    for (let x = Math.round(rx - 2.6 * TS) + 2, n = 0; x < rx + 2.6 * TS - 4; x += 6 + (n % 2), n++) {
      const y = cy + Math.round(Math.sin(n * 1.9) * 2);
      if (!water[y * W + x] || !water[(y + 2) * W + x + 3]) continue;
      stones.push({ x, y });
      const rows = ['.ww.', 'swww', '.pp.'];
      rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
        if (ch === '.') return;
        const j = (y + yy) * W + x + xx;
        gp[j] = ch === 'w' ? U32.wool : ch === 's' ? U32.sage : U32.plum;
        skip[j] = 1;
        if (yy < 2) skip[j - W] = 1;
      }));
    }
  }

  // Home Meadow pond: lily pads, one or two in flower.
  for (let y = 0; y < H; y++) {
    for (let x = W >> 1; x < W; x++) {
      if ((x % 9) || (y % 7)) continue;
      const cx = x + Math.floor(hash2(x, y, 90) * 5), cy = y + Math.floor(hash2(x, y, 91) * 4);
      if (hash2(x, y, 92) > 0.45) continue;
      let ok = true;
      for (let yy = -1; yy < 4 && ok; yy++) for (let xx = -1; xx < 5 && ok; xx++) if (!deep[(cy + yy) * W + cx + xx] || wdist[(cy + yy) * W + cx + xx] < 2) ok = false;
      if (!ok) continue;
      const rows = hash2(x, y, 93) < 0.5 ? ['.sss', 'sos.', '.sss'] : ['.ss.', 'soss', 's.s.'];
      rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
        if (ch === '.') return;
        const j = (cy + yy) * W + cx + xx;
        gp[j] = ch === 's' ? U32.sage : U32.moss;
        skip[j] = 1;
      }));
      if (hash2(x, y, 94) < 0.3) gp[cy * W + cx + 1] = hash2(x, y, 95) < 0.5 ? U32.wool : U32.butter;
    }
  }
  gg.putImageData(gimg, 0, 0);

  const soil = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (water[i]) soil[i] = 3;
    else if (rock[i]) soil[i] = 4;
    else if (path[i]) soil[i] = 1;
    else if (wdist[i] === 0 && (water[i - 1] || water[i + 1] || water[i - W] || water[i - 2] || water[i + 2] || water[i - 2 * W])) soil[i] = gp[i] === U32.sage ? 2 : 1;
  }

  const puddles: { x: number; y: number; r: number }[] = [];
  for (let gy = 8; gy < H - 8; gy += 7)
    for (let gx = 8; gx < W - 8; gx += 9) {
      const x = gx + Math.floor(hash2(gx, gy, 132) * 5), y = gy + Math.floor(hash2(gx, gy, 133) * 4);
      if (hash2(x, y, 130) > 0.2) continue;
      const r = 2 + Math.floor(hash2(x, y, 131) * 4);
      let ok = true;
      for (let dy = -Math.ceil(r * 0.5) - 1; dy <= Math.ceil(r * 0.5) + 1 && ok; dy++)
        for (let dx = -r - 1; dx <= r + 1 && ok; dx++) {
          const sv = soil[(y + dy) * W + x + dx];
          if (sv !== 1 && sv !== 2) ok = false;
        }
      if (ok) puddles.push({ x, y, r });
    }

  // ---- Swaying grass, flowers and reeds ----
  const sway = makeSwayGrid(W, H);
  const add = (it: SwayItem) => {
    const c = Math.floor(it.x / sway.cell) + Math.floor(it.y / sway.cell) * sway.cols;
    sway.cells[c]?.push(it);
  };
  const isOpenGrass = (x: number, y: number) => {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (map.t(tx, ty) !== Ter.Grass || x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x;
    return !path[i] && !water[i] && !rock[i] && !cm[i] && gp[i] !== U32.wool && gp[i] !== U32.plum;
  };
  const R = mulberry32(9);
  const tufts = Math.floor((W * H) / 900);
  for (let k = 0; k < tufts; k++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H);
    const r1 = R(), r2 = R();
    if (!isOpenGrass(x, y) || !isOpenGrass(x + 6, y)) continue;
    const reg = map.regionAt(x, y)?.id;
    if (reg === 'rocky' && r1 < 0.4) continue;
    if (reg === 'show' && r1 < 0.75) continue; // mown
    const high = reg === 'high';
    const valley = reg === 'hills' && hillAt(x, y) > 0;
    const inShadow = shadow[y * W + x];
    const n = 3 + Math.floor(r2 * 2) + (valley ? 1 : 0);
    const blades: Blade[] = [];
    let ox = 0;
    const flowerFirst = R() < (high ? 0.55 : 0.3);
    for (let j = 0; j < n; j++) {
      if (j === 0 && flowerFirst) {
        const head = high && R() < 0.5 ? C.wool : C.butter;
        blades.push({ dx: ox, h: high ? 2 : 1, c: C.sage, head, headH: 1 });
      } else {
        const h = Math.max(1, Math.min(4, 1 + Math.floor(R() * 3) + (valley ? 1 : 0) - (high && R() < 0.5 ? 1 : 0)));
        blades.push({ dx: ox, h, c: inShadow ? C.moss : R() < 0.75 ? C.sage : C.moss });
      }
      ox += 1 + (R() < 0.6 ? 1 : 0);
    }
    add({ x, y, blades });
  }
  // Loose flowers: buttercups everywhere, thicker in the Home Meadow, daisy
  // drifts on the alpine meadow.
  const flowers = Math.floor((W * H) / 1400);
  for (let k = 0; k < flowers; k++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H);
    const r1 = R(), r2 = R(), r3 = R();
    if (!isOpenGrass(x, y) || shadow[y * W + x]) continue;
    const reg = map.regionAt(x, y)?.id;
    const high = reg === 'high';
    const drift = high ? fbm(x * 0.02, y * 0.03, 611, 2) : 0;
    if (reg !== 'meadow' && !(high && drift > 0.5) && r1 < 0.55) continue;
    const head = high ? (r2 < 0.6 ? C.wool : C.butter) : reg === 'meadow' && r2 < 0.25 ? C.wool : C.butter;
    const blades: Blade[] = [{ dx: 0, h: 2, c: C.sage, head, headH: 1 }];
    if (r3 < 0.35) blades.push({ dx: 2, h: 1, c: C.sage, head, headH: 1 });
    add({ x, y, blades });
  }
  // Reeds and cattails along the river and the pond.
  for (let y = 4; y < H - 4; y += 2) {
    for (let x = 4; x < W - 4; x++) {
      const i = y * W + x;
      if (water[i] || rock[i] || cm[i] || path[i]) continue;
      if (!(water[i - 1] || water[i + 1] || water[i - 2] || water[i + 2] || water[i - W])) continue;
      const ty = y / TS;
      if (ty > FORD_Y0 - 2 && ty < FORD_Y1 + 2 && x < W / 2) continue; // keep the crossing clear
      if (hash2(x, y, 120) > 0.13) continue;
      const blades: Blade[] = [];
      const n = 2 + Math.floor(hash2(x, y, 121) * 3);
      for (let j = 0; j < n; j++) {
        const h = 3 + Math.floor(hash2(x + j, y, 122) * 4);
        const cat = hash2(x + j, y, 123) < 0.35 && h >= 5;
        blades.push({ dx: j * 2 - (hash2(x, y, 124) < 0.5 ? 1 : 0), h, c: hash2(x + j, y, 125) < 0.5 ? C.teal : C.sage, head: cat ? C.plum : undefined, headH: cat ? 2 : 0 });
      }
      add({ x, y, blades, reed: true });
      x += 4;
    }
  }
  for (const cell of sway.cells) cell.sort((a, b) => a.y - b.y);

  // ---- Animated water ----
  const comps = components(map, (t) => t === Ter.Water || t === Ter.Shallow);
  const waterAnims: WaterAnim[] = [];
  const src = { W, water, deep, wdist, ground: gp, skip };
  comps.box.forEach((bb) => {
    const x0 = Math.max(0, bb[0] * TS - 6), y0 = Math.max(0, bb[1] * TS - 6);
    const x1 = Math.min(W, (bb[2] + 1) * TS + 6), y1 = Math.min(H, (bb[3] + 1) * TS + 6);
    const flowing = bb[3] - bb[1] > 20;
    waterAnims.push(makeWaterAnim(src, x0, y0, x1 - x0, y1 - y0, flowing, flowing ? stones : []));
  });

  return { ground, canopy: cb.canvas, water: waterAnims, sway, soil, puddles, groundPx: gp, canopyPx: cb.cp, canopyKind: cb.kind, waterDist: wdist };
}

function makeSwayGrid(W: number, H: number): SwayGrid {
  const cell = 64;
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  return { cell, cols, rows, cells: Array.from({ length: cols * rows }, () => []) };
}

// ---- Canopy ----
// The forest is one teal mass. Plum is drawn the way the reference does it:
// thin hand-drawn marks, i.e. the lower arcs of leaf clumps, little chevrons
// and specks, getting denser on the shaded lower-left side of each mass.
// Round crowns bulge from its edges and make up the small groves; towards
// the High Range it turns to pines.
function bakeCanopy(map: WorldMap, forest: Uint8Array): CanopyBuf & { canvas: HTMLCanvasElement } {
  const W = WORLD_W, H = WORLD_H;
  const [canvas, cg] = makeCanvas(W, H);
  const cimg = cg.createImageData(W, H);
  const cp = new Uint32Array(cimg.data.buffer);
  const b: CanopyBuf = { W, H, cp, cm: new Uint8Array(W * H), kind: new Uint8Array(W * H) };
  const { cm, kind } = b;
  const pz = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!forest[i]) continue;
      cm[i] = 1;
      kind[i] = 1;
      if (y < 44 * TS && pineZone(x, y)) {
        pz[i] = 1;
        cp[i] = ((x + y) & 1) === 0 ? U32.plum : U32.teal; // dark gaps between the pines
      } else cp[i] = U32.teal;
    }
  const at = (m: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : m[y * W + x]);

  // Broadleaf crowns on the forest edges, and whole small groves of them.
  const comps = components(map, (t) => t === Ter.Forest);
  const crowns: { x: number; y: number; r: number; light: boolean }[] = [];
  for (let ty = 1; ty < MH - 1; ty++) {
    for (let tx = 1; tx < MW - 1; tx++) {
      if (map.t(tx, ty) !== Ter.Forest) continue;
      const px = tx * TS + 4, py = ty * TS + 4;
      if (pineZone(px, py) && py < 44 * TS) continue;
      const h = hash2(tx, ty, 200);
      const small = comps.size[comps.id[ty * MW + tx]] < 40;
      let nx = 0, ny = 0, edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (map.t(tx + dx, ty + dy) !== Ter.Forest) { nx += dx; ny += dy; edge = true; }
      }
      const jx = Math.round((hash2(tx, ty, 201) - 0.5) * 4), jy = Math.round((hash2(tx, ty, 202) - 0.5) * 4);
      const light = hash2(tx, ty, 203) < 0.18;
      if (small) crowns.push({ x: px + jx, y: py + jy, r: 4.5 + h * 2.5, light });
      else if (edge && h < 0.6) crowns.push({ x: px + nx * 2 + jx, y: py + ny * 2 + jy, r: 4 + h * 3, light });
    }
  }
  crowns.sort((p, q) => p.y - q.y);
  for (const c of crowns) stampCrown(b, c.x, c.y, c.r, 210 + (c.x & 15), c.light);

  // Pines packed in rows over the northern forest, back to front; any gap
  // left gets a pine of its own.
  const pines: { x: number; y: number; h: number }[] = [];
  const cov = new Uint8Array(W * H);
  const SX = 6, SY = 5;
  for (let gy = 0; gy * SY < 47 * TS; gy++) {
    for (let gx = 0; gx * SX < W; gx++) {
      const x = gx * SX + (gy & 1) * 3 + Math.round((hash2(gx, gy, 220) - 0.5) * 3);
      const y = gy * SY + Math.round((hash2(gx, gy, 221) - 0.5) * 3);
      if (x < 0 || y < 0 || x >= W || y >= H || !pz[y * W + x]) continue;
      const h = 11 + Math.floor(hash2(gx, gy, 222) * 5);
      pines.push({ x, y, h });
      pineCovers(cov, W, H, x, y, h);
    }
  }
  for (let y = 0; y < 47 * TS; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!pz[i] || cov[i]) continue;
      pines.push({ x, y: y + 3, h: 11 });
      pineCovers(cov, W, H, x, y + 3, 11);
    }
  pines.sort((p, q) => p.y - q.y);
  for (const p of pines) stampPine(b, p.x, p.y, p.h);

  // Edges and the shaded side.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!cm[i]) continue;
      if (!at(cm, x, y + 1) || !at(cm, x - 1, y)) cp[i] = U32.plum;
      else if (kind[i] !== 1) continue;
      else if (!at(cm, x - 3, y + 3) && vnoise(x * 0.5, y * 0.5, 81) < 0.5) cp[i] = U32.plum;
      else if (!at(cm, x - 7, y + 7) && vnoise(x * 0.45, y * 0.45, 82) < 0.28) cp[i] = U32.plum;
    }
  }
  const plum = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (cm[i] && kind[i] !== 3 && !pz[i]) cp[i] = U32.plum;
  };
  // Leaf clumps on a jittered grid.
  const CELL = 6;
  for (let gy = 0; gy < H / CELL + 1; gy++) {
    for (let gx = 0; gx < W / CELL + 1; gx++) {
      const h1 = hash2(gx, gy, 91), h2 = hash2(gx, gy, 92), h3 = hash2(gx, gy, 93);
      const cx = Math.floor((gx + 0.15 + h1 * 0.7) * CELL + (gy & 1) * 3);
      const cy = Math.floor((gy + 0.15 + h2 * 0.7) * CELL);
      if (!at(cm, cx, cy) || cx >= W || cy >= H) continue;
      // Crowns carry their own leaf marks.
      if (kind[cy * W + cx] === 2) continue;
      const k = h3;
      if (k < 0.62) {
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
      } else if (k < 0.8) {
        // Chevron "v".
        plum(cx - 1, cy - 1); plum(cx, cy); plum(cx + 1, cy - 1);
        if (h1 < 0.5) { plum(cx - 2, cy - 2); plum(cx + 2, cy - 2); }
      } else if (k < 0.9) {
        // Short dash.
        plum(cx, cy); plum(cx + 1, cy); if (h2 < 0.5) plum(cx + 2, cy + 1);
      } else {
        plum(cx, cy);
      }
    }
  }
  cg.putImageData(cimg, 0, 0);
  return { ...b, canvas };
}
