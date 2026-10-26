import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { fbm, hash2, mulberry32 } from '../rng';
import { EDGES, edgeAt, type Baked, type FineData } from './terrain';
import { REGIONS, TS, WORLD_H, WORLD_W } from './map';

// The ground at double density: two fine pixels to a world pixel. It paints
// any rectangle (in fine pixels) on demand, so the world is drawn in chunks
// around the camera rather than held whole at four times the memory.
//
// The look is shapes, not speckle. Every outline (paths, banks, water, rock)
// is the same smooth function the world data uses, drawn at fine density
// with no per-pixel jitter. Detail is placed as small drawn things on a
// jittered grid (clover, stones, molehills, ferns, logs), each one decided
// by its grid cell in world space, so neighbouring chunks agree. Dithering
// is kept for shading and gradients only (shallows, the hills' rims, tonal
// patches of darker grass).

export const FINE = 2;

// What the ground looks like now, in small steps: a change of step repaints.
export interface Look { snow: number; leaves: number; bloom: number; wet: number; golden: number }
export const lookKey = (l: Look) => `${l.snow}${l.leaves}${l.bloom}${l.wet}${l.golden}`;

const enum K { Grass = 0, Path = 1, Shallow = 2, Deep = 3, Rock = 4 }

const { meadow, moss, sage, teal, plum, wool, butter } = U32;
const COL: Record<string, number> = { m: meadow, o: moss, s: sage, t: teal, p: plum, w: wool, y: butter };
const W = WORLD_W, H = WORLD_H;
const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)] / 16;

// A paint job: the rectangle plus a margin, so edges and stamps near the
// border come out the same as in the chunk next door.
const M = 16;
interface Job {
  d: FineData;
  x0: number; // fine px of buf[0]
  y0: number;
  bw: number;
  bh: number;
  cls: Uint8Array;
  px: Uint32Array;
  look: Look;
}

export function paintGround(b: Baked, fx0: number, fy0: number, fw: number, fh: number, look: Look): Uint32Array {
  const d = b.fine;
  const bw = fw + 2 * M, bh = fh + 2 * M;
  const j: Job = { d, x0: fx0 - M, y0: fy0 - M, bw, bh, cls: new Uint8Array(bw * bh), px: new Uint32Array(bw * bh), look };
  classify(j);
  base(j);
  stamps(j);
  const out = new Uint32Array(fw * fh);
  for (let y = 0; y < fh; y++) out.set(j.px.subarray((y + M) * bw + M, (y + M) * bw + M + fw), y * fw);
  return out;
}

// ---- What each fine pixel is ----

function classify(j: Job) {
  const { d, cls, bw, bh } = j;
  const f = d.fields;
  // Per world pixel: whether a mask is the same all round (then its fine
  // pixels take its value), else each fine pixel asks the outline itself.
  const fine = (m: Uint8Array, field: Float32Array, e: typeof EDGES.rock, wx: number, wy: number, fx: number, fy: number) => {
    const i = wy * W + wx;
    const v = m[i];
    if (wx > 0 && wy > 0 && wx < W - 1 && wy < H - 1 && m[i - 1] === v && m[i + 1] === v && m[i - W] === v && m[i + W] === v) return v;
    return edgeAt(field, e, fx / FINE, fy / FINE) ? 1 : 0;
  };
  for (let y = 0; y < bh; y++) {
    const fy = j.y0 + y;
    const wy = Math.min(H - 1, Math.max(0, fy >> 1));
    for (let x = 0; x < bw; x++) {
      const fx = j.x0 + x;
      const wx = Math.min(W - 1, Math.max(0, fx >> 1));
      let k: K = K.Grass;
      if (fine(d.rock, f.rock, EDGES.rock, wx, wy, fx, fy)) k = K.Rock;
      else if (fine(d.water, f.water, EDGES.water, wx, wy, fx, fy)) k = fine(d.deep, f.deep, EDGES.deep, wx, wy, fx, fy) ? K.Deep : K.Shallow;
      else if (fine(d.path, f.path, EDGES.path, wx, wy, fx, fy)) k = K.Path;
      cls[y * bw + x] = k;
    }
  }
}

// City-block distance inside (or outside) a set of classes, capped.
function dist(j: Job, inside: (k: number) => boolean, cap: number): Uint8Array {
  const { cls, bw, bh } = j;
  const dd = new Uint8Array(bw * bh);
  for (let i = 0; i < bw * bh; i++) dd[i] = inside(cls[i]) ? cap : 0;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (!dd[i]) continue;
      let v = dd[i];
      if (x > 0) v = Math.min(v, dd[i - 1] + 1);
      if (y > 0) v = Math.min(v, dd[i - bw] + 1);
      dd[i] = v;
    }
  for (let y = bh - 1; y >= 0; y--)
    for (let x = bw - 1; x >= 0; x--) {
      const i = y * bw + x;
      if (!dd[i]) continue;
      let v = dd[i];
      if (x < bw - 1) v = Math.min(v, dd[i + 1] + 1);
      if (y < bh - 1) v = Math.min(v, dd[i + bw] + 1);
      dd[i] = v;
    }
  return dd;
}

// ---- The ground's colour, pixel by pixel ----

function base(j: Job) {
  const { d, cls, px, bw, bh } = j;
  const isWater = (k: number) => k === K.Shallow || k === K.Deep;
  const inPath = dist(j, (k) => k === K.Path, 24);
  const inWater = dist(j, isWater, 12);
  const outWater = dist(j, (k) => !isWater(k), 10);
  const outPath = dist(j, (k) => k !== K.Path, 4);
  const hills = d.hills;
  const [sx0, sx1, sy0] = d.showBox;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? -1 : cls[y * bw + x]);

  for (let y = 0; y < bh; y++) {
    const fy = j.y0 + y, wyf = fy / FINE;
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      const fx = j.x0 + x, wxf = fx / FINE;
      const k = cls[i];
      let c = meadow;
      if (k === K.Rock) c = rockColor(j, x, y);
      else if (k === K.Deep || k === K.Shallow) {
        const dw = inWater[i];
        // The bank's lip overhangs the water on the north side.
        const lip = !isWater(at(x, y - 1)) || !isWater(at(x, y - 2)) || (k === K.Deep && !isWater(at(x, y - 3)));
        if (lip) c = plum;
        else if (k === K.Shallow) c = dw <= 2 ? sage : bayer(fx, fy) < 0.5 ? sage : teal;
        else c = dw <= 2 ? sage : dw <= 5 && bayer(fx, fy) < (6 - dw) / 5 ? sage : teal;
      } else if (k === K.Path) {
        const dp = inPath[i];
        c = moss;
        // Two wheel ruts a little in from each side, and the worn lip of
        // the track where it dips on its shady (lower, left) edges.
        if (dp === 4 || (dp === 5 && ((fx >> 1) + (fy >> 1)) % 7 === 0)) c = sage;
        else if (dp === 1 && (at(x, y + 1) === K.Grass || at(x - 1, y) === K.Grass)) c = sage;
      } else {
        // Grass. Banks first: a wet sage line at the water, mud beyond it,
        // and where the water lies below, a face of earth dropping to it.
        const ow = outWater[i];
        if (ow > 0 && ow <= 6) {
          const below = isWater(at(x, y + 1)) || isWater(at(x, y + 2)) || isWater(at(x, y + 3));
          if (below) c = isWater(at(x, y + 1)) ? plum : isWater(at(x, y + 2)) ? sage : (fx & 3) === 0 ? plum : sage;
          else if (ow <= 2) c = sage;
          else if (ow <= 4) c = bayer(fx, fy) < (5 - ow) / 3 ? moss : meadow;
        }
        if (c === meadow) {
          // The edge of a track: the grass lip on its shady side.
          if (outPath[i] === 1 && (at(x, y - 1) === K.Path || at(x + 1, y) === K.Path)) c = sage;
          else if (outPath[i] === 1) c = moss;
          else c = grassTone(d, fx, fy, wxf, wyf, hills, sx0, sx1, sy0);
        }
      }
      px[i] = c;
    }
  }
  rockShadows(j);
}

// Open grass: the Rolling Hills' mounds shaded on their lower rims, the Show
// Ground's bare spots, and broad soft patches where the grass grows darker.
function grassTone(d: FineData, fx: number, fy: number, wxf: number, wyf: number, hills: FineData['hills'], sx0: number, sx1: number, sy0: number): number {
  const wx = fx >> 1, wy = fy >> 1;
  if (wx >= hills.x0 && wy >= hills.y0 && wx < hills.x0 + hills.w && wy < hills.y0 + hills.h) {
    // The frontmost mound under this fine pixel.
    let best = -1;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const lx = wx + ox - hills.x0, ly = wy + oy - hills.y0;
      if (lx < 0 || ly < 0 || lx >= hills.w || ly >= hills.h) continue;
      const o = hills.owner[ly * hills.w + lx];
      if (o > best) {
        const m = hills.mounds[o];
        if (Math.hypot((wxf - m.x) / m.rx, (wyf - m.y) / m.ry) <= 1) best = o;
      }
    }
    if (best >= 0) {
      const m = hills.mounds[best];
      const dx = (wxf - m.x) / m.rx, dy = (wyf - m.y) / m.ry;
      const dd = Math.hypot(dx, dy);
      const side = (-dx * 0.5 + dy) / (dd || 1);
      // The shaded rim: solid at the edge, dithering out up the slope.
      if (dd > 0.92 && side > 0.5) return moss;
      if (dd > 0.8 && side > 0.25) return bayer(fx, fy) < (dd - 0.8) / 0.12 * Math.min(1, side * 2) ? moss : meadow;
      return meadow;
    }
  }
  if (wyf > sy0 && wxf > sx0 && wxf < sx1) {
    for (const p of d.worn) {
      const dd = Math.hypot((wxf - p.x) / p.rx, (wyf - p.y) / p.ry);
      if (dd < 0.75) return moss;
      if (dd < 1) return bayer(fx, fy) < (1 - dd) * 3 ? moss : meadow;
    }
  }
  // Soft patches of darker grass, edged with a short dithered fade.
  const n = fbm(wxf / 70, wyf / 64, 701, 2);
  if (n > 0.62) return moss;
  if (n > 0.585) return bayer(fx, fy) < (n - 0.585) / 0.035 ? moss : meadow;
  return meadow;
}

// Rock, lit from the upper right: a plum outline on the lower and left
// edges, a pale rim on the upper and right, the south face seen a little
// from the front (taller on the big outcrops, with a pale band of strata),
// and the top broken into facets with cracks along some seams.
function rockColor(j: Job, x: number, y: number): number {
  const { cls, bw, bh, d } = j;
  const isRock = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= bw || yy >= bh || cls[yy * bw + xx] === K.Rock;
  const fx = j.x0 + x, fy = j.y0 + y;
  if (!isRock(x, y + 1) || !isRock(x - 1, y)) return plum;
  const wx = Math.min(W - 2, Math.max(1, fx >> 1)), wy = Math.min(H - 2, Math.max(1, fy >> 1));
  const rh = d.rh[wy * W + wx];
  const faceH = rh > 0.8 ? 10 : rh > 0.55 ? 6 : 4;
  let fd = 1;
  while (fd <= faceH && isRock(x, y + fd + 1)) fd++;
  if (fd <= faceH) {
    // The face: vertical fissures, a pale strata band on the tall cliffs.
    if (faceH === 10 && (fd === 5 || fd === 6) && hash2(fx >> 3, fy >> 2, 64) < 0.75) return wool;
    if (hash2(fx >> 1, 0, 63) < 0.18) return plum;
    return fd === 1 ? plum : sage;
  }
  if (!isRock(x, y - 1) || !isRock(x + 1, y)) return wool;
  const gx = d.rh[wy * W + wx + 1] - d.rh[wy * W + wx - 1], gy = d.rh[(wy + 1) * W + wx] - d.rh[(wy - 1) * W + wx];
  const f = facet(fx, fy);
  const L = (-gx + gy) * 9 + 0.2 + (f.lit - 0.5) * 0.7;
  if (f.seam < 1.2 && f.crack) return plum;
  if (f.seam < 1.2 && L > 0.05) return sage;
  return L > 0.05 ? wool : sage;
}

function facet(x: number, y: number): { lit: number; seam: number; crack: boolean } {
  const S = 22;
  const gx = Math.floor(x / S), gy = Math.floor(y / S);
  let d1 = 1e9, d2 = 1e9, k1 = 0, k2 = 0;
  for (let jy = -1; jy <= 1; jy++)
    for (let kx = -1; kx <= 1; kx++) {
      const cx = gx + kx, cy = gy + jy;
      const qx = (cx + 0.2 + hash2(cx, cy, 68) * 0.6) * S, qy = (cy + 0.2 + hash2(cx, cy, 69) * 0.6) * S;
      const dd = Math.hypot(x - qx, y - qy);
      const id = cy * 4096 + cx;
      if (dd < d1) { d2 = d1; k2 = k1; d1 = dd; k1 = id; }
      else if (dd < d2) { d2 = dd; k2 = id; }
    }
  return { lit: hash2(k1, 0, 72), seam: d2 - d1, crack: hash2(Math.min(k1, k2), Math.max(k1, k2), 73) < 0.35 };
}

// Outcrops throw a shadow down and to the left, sage on grass, plum on water.
function rockShadows(j: Job) {
  const { cls, px, bw, bh, d } = j;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      const k = cls[i];
      if (k === K.Rock) continue;
      const sx = x + 4, sy = y - 6;
      let s = sx < bw && sy >= 0 && cls[sy * bw + sx] === K.Rock;
      if (!s) {
        const wx = (j.x0 + x) >> 1, wy = (j.y0 + y) >> 1;
        if (wy >= 3 && wx < W - 3 && wx >= 0 && wy < H && d.rh[(wy - 3) * W + wx + 3] > 0.62) s = true;
      }
      if (s) px[i] = k === K.Deep || k === K.Shallow ? plum : sage;
    }
}

// ---- Small drawn things ----

// A little picture in palette letters, one fine pixel each ('.' is clear).
function put(j: Job, fx: number, fy: number, rows: readonly string[], ok?: (k: number) => boolean, flip = false) {
  const { bw, bh, px, cls } = j;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const y = fy + r - j.y0;
    if (y < 0 || y >= bh) continue;
    for (let c = 0; c < row.length; c++) {
      const ch = flip ? row[row.length - 1 - c] : row[c];
      if (ch === '.') continue;
      const x = fx + c - j.x0;
      if (x < 0 || x >= bw) continue;
      const i = y * bw + x;
      if (ok && !ok(cls[i])) continue;
      px[i] = COL[ch];
    }
  }
}

// Visit a jittered grid of cells (world px) whose point falls inside the job
// (with `pad` fine px of slack for the size of what is drawn there).
function cells(j: Job, cw: number, ch: number, seed: number, pad: number, fn: (wx: number, wy: number, gx: number, gy: number) => void) {
  const wx0 = Math.floor((j.x0 - pad) / FINE), wy0 = Math.floor((j.y0 - pad) / FINE);
  const wx1 = Math.ceil((j.x0 + j.bw + pad) / FINE), wy1 = Math.ceil((j.y0 + j.bh + pad) / FINE);
  for (let gy = Math.floor(wy0 / ch) - 1; gy * ch <= wy1; gy++)
    for (let gx = Math.floor(wx0 / cw) - 1; gx * cw <= wx1; gx++) {
      const wx = Math.floor(gx * cw + hash2(gx, gy, seed) * cw * 0.8), wy = Math.floor(gy * ch + hash2(gx, gy, seed + 1) * ch * 0.8);
      if (wx < wx0 || wy < wy0 || wx > wx1 || wy > wy1 || wx < 2 || wy < 2 || wx >= W - 2 || wy >= H - 2) continue;
      fn(wx, wy, gx, gy);
    }
}

const grassOnly = (k: number) => k === K.Grass;
const pathOnly = (k: number) => k === K.Path;

const CLOVER = ['o.o', '.o.'];
const CLOVER_HEAD = ['ww', 'ow'];
const STONE = ['..ww..', '.wwwws', 'wwwwss', 'swssss', '.pppp.'];
// Grass marks: a few blades together, darker than the ground they grow on.
const TUFTS = [
  ['o.o', 'o.o'],
  ['.o..', 'o.o.', 'o.oo'],
  ['..o.', 'o.o.', 'oo.o'],
  ['o...o', 'o.o.o', '.ooo.'],
  ['.o.', 'ooo'],
  ['o..', 'o.o', '.oo'],
];
const PEBBLE = ['ws', 'pp'];
const PEBBLE2 = ['.w.', 'wws', '.p.'];
const MOLEHILL = ['..oo..', '.ooso.', 'osssso', '.pppp.'];
const FERN = ['t...t', '.t.t.', 't.t.t', '.ttt.', '..t..'];
const FERN2 = ['.t...t.', 't.t.t.t', '.t.t.t.', '..ttt..', '...t...'];
const MUSHROOM = ['.ww.', 'wwww', '.wp.', '.pp.'];
const BOULDER = ['..www...', '.wwwww..', 'swwwwws.', 'ssswwsss', 'ssssssss', '.pppppp.'];
const GORSE = ['..ty.t..', '.tttytt.', 'tyttttyt', 'tttttyts', '.tttsss.', '..pppp..'];
const LILY = ['.sss.', 'ssoss', 'sooss', '.ss..'];
const LILY2 = ['..ss.', '.soss', 'ssoss', '.sss.'];
const STEP = ['.wwww.', 'wwwwws', 'swwwss', 'ssssss', '.pppp.'];

function stamps(j: Job) {
  const d = j.d;
  grassMarks(j);
  const open = (wx: number, wy: number) => {
    const i = wy * W + wx;
    return !d.path[i] && !d.water[i] && !d.rock[i] && !d.cm[i];
  };
  const openBox = (wx: number, wy: number, w: number, h: number) => {
    for (let y = wy; y < wy + h; y++) for (let x = wx; x < wx + w; x++) if (x < 0 || y < 0 || x >= W || y >= H || !open(x, y)) return false;
    return true;
  };
  const region = (wx: number, wy: number) => d.map.regionAt(wx, wy)?.id;

  // Clover: little trefoils with a white head or two.
  cells(j, 23, 19, 150, 16, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 152) > 0.22 || !openBox(wx - 4, wy - 3, 8, 6)) return;
    for (let k = 0; k < 7; k++) {
      const cx = wx * FINE + Math.round((hash2(gx, gy, 155 + k) - 0.5) * 14), cy = wy * FINE + Math.round((hash2(gx, gy, 165 + k) - 0.5) * 9);
      put(j, cx, cy, hash2(gx, gy, 175 + k) < 0.22 ? CLOVER_HEAD : CLOVER, grassOnly);
    }
  });
  // Stones lying in the grass.
  cells(j, 41, 37, 144, 8, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 145) > 0.35 || !openBox(wx, wy, 3, 3)) return;
    put(j, wx * FINE, wy * FINE, hash2(gx, gy, 146) < 0.5 ? STONE : PEBBLE2, grassOnly);
  });
  // Molehill runs across the fields, away from the ranch and the Show Ground.
  cells(j, 61, 53, 158, 40, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 159) > 0.25) return;
    const reg = region(wx, wy);
    if (reg === 'ranch' || reg === 'show') return;
    const a = hash2(gx, gy, 160) * Math.PI * 2;
    let mx = wx, my = wy;
    const n = 3 + Math.floor(hash2(gx, gy, 161) * 3);
    for (let k = 0; k < n; k++) {
      if (openBox(mx, my, 4, 3)) put(j, mx * FINE, my * FINE, MOLEHILL, grassOnly);
      mx = Math.round(mx + Math.cos(a + (hash2(gx + k, gy, 162) - 0.5)) * 9);
      my = Math.round(my + Math.sin(a + (hash2(gx, gy + k, 163) - 0.5)) * 6);
    }
  });
  // Worn bare patches with a clean edge, darker on their lower rim.
  cells(j, 53, 47, 166, 30, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 167) > 0.18) return;
    const r = 6 + hash2(gx, gy, 168) * 8; // fine px
    const cx = wx * FINE, cy = wy * FINE;
    if (!openBox(wx - 4, wy - 3, 9, 6)) return;
    for (let y = Math.floor(cy - r * 0.6) - 1; y <= cy + r * 0.6 + 1; y++)
      for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
        const dd = Math.hypot((x - cx) / r, (y - cy) / (r * 0.6));
        if (dd > 1) continue;
        const bx = x - j.x0, by = y - j.y0;
        if (bx < 0 || by < 0 || bx >= j.bw || by >= j.bh || j.cls[by * j.bw + bx] !== K.Grass) continue;
        j.px[by * j.bw + bx] = dd > 0.82 && y > cy ? sage : moss;
      }
  });
  // Pebbles on the tracks.
  cells(j, 13, 11, 45, 6, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 46) > 0.3 || !d.path[wy * W + wx]) return;
    put(j, wx * FINE + (gx & 1), wy * FINE, hash2(gx, gy, 47) < 0.6 ? PEBBLE : PEBBLE2, pathOnly);
  });
  // Stones along the banks.
  cells(j, 9, 7, 164, 6, (wx, wy, gx, gy) => {
    const i = wy * W + wx;
    if (d.water[i] || d.rock[i] || d.path[i] || hash2(gx, gy, 165) > 0.3) return;
    if (!(d.water[i - 1] || d.water[i + 1] || d.water[i + W] || d.water[i - W] || d.water[i + 2 * W])) return;
    put(j, wx * FINE, wy * FINE, PEBBLE2);
  });
  // Scree spilling from the outcrops, mostly downhill.
  cells(j, 5, 5, 70, 6, (wx, wy, gx, gy) => {
    const i = wy * W + wx;
    if (d.rock[i] || d.near[i] < 0.03 || !open(wx, wy)) return;
    const below = d.rock[Math.max(0, wy - 4) * W + wx] || d.rock[Math.max(0, wy - 6) * W + wx + 1];
    if (hash2(gx, gy, 71) > (below ? d.near[i] * 0.6 + 0.15 : d.near[i] * 0.15)) return;
    put(j, wx * FINE, wy * FINE, hash2(gx, gy, 72) < 0.6 ? PEBBLE : PEBBLE2, grassOnly);
  });
  // The forest floor in the trees' shade: ferns and the odd mushroom.
  cells(j, 11, 9, 80, 10, (wx, wy, gx, gy) => {
    const i = wy * W + wx;
    if (!d.shade[i] || !open(wx, wy) || hash2(gx, gy, 81) > 0.3) return;
    const k = hash2(gx, gy, 82);
    put(j, wx * FINE, wy * FINE, k < 0.45 ? FERN : k < 0.85 ? FERN2 : MUSHROOM, grassOnly, (gx & 1) === 1);
  });
  // The forest's edge: boulders and fallen logs in the grass beside it.
  cells(j, 29, 23, 146, 30, (wx, wy, gx, gy) => {
    const k = hash2(gx, gy, 147);
    if (k > 0.5 || !openBox(wx, wy, 12, 4)) return;
    let edge = false;
    for (let dy = -10; dy <= 0 && !edge; dy += 2) for (let dx = -2; dx <= 12 && !edge; dx += 4) if (d.cm[Math.max(0, wy + dy) * W + Math.min(W - 1, Math.max(0, wx + dx))]) edge = true;
    if (!edge) return;
    if (k < 0.2) put(j, wx * FINE, wy * FINE, BOULDER, grassOnly);
    else if (k < 0.32) fallenLog(j, wx * FINE, wy * FINE, 20 + Math.floor(hash2(gx, gy, 148) * 8));
  });
  trunks(j);
  // Gorse among the rocks.
  cells(j, 17, 13, 172, 16, (wx, wy, gx, gy) => {
    if (region(wx, wy) !== 'rocky' || hash2(gx, gy, 174) > 0.14 || !openBox(wx, wy - 1, 5, 4)) return;
    put(j, wx * FINE, wy * FINE - 2, GORSE, grassOnly, (gx & 1) === 1);
  });
  sheepTracks(j);
  // Lily pads on the deep, still water, one or two in flower.
  cells(j, 9, 7, 90, 10, (wx, wy, gx, gy) => {
    if (hash2(gx, gy, 92) > 0.4) return;
    for (let yy = -1; yy < 4; yy++) for (let xx = -1; xx < 5; xx++) {
      const i = (wy + yy) * W + wx + xx;
      if (!d.deep[i]) return;
    }
    // Only still water: the pond, not the river.
    if (region(wx, wy) === 'ford') return;
    const fx = wx * FINE, fy = wy * FINE;
    put(j, fx, fy, hash2(gx, gy, 93) < 0.5 ? LILY : LILY2, (k) => k === K.Deep);
    if (hash2(gx, gy, 94) < 0.3) put(j, fx + 2, fy, [hash2(gx, gy, 95) < 0.5 ? 'w' : 'y']);
  });
  for (const s of d.stones) put(j, s.x * FINE - 1, s.y * FINE - 1, STEP);
}

// Grass marks in drifts: thick where the cluster noise is high, none in
// the bare middles. Moss on the meadow, sage on the darker patches.
function grassMarks(j: Job) {
  const d = j.d;
  cells(j, 6, 5, 300, 8, (wx, wy, gx, gy) => {
    const i = wy * W + wx;
    if (d.path[i] || d.water[i] || d.rock[i] || d.cm[i]) return;
    const drift = fbm(wx / 26, wy / 22, 301, 2);
    if (hash2(gx, gy, 302) > (drift - 0.35) * 1.6) return;
    const reg = d.map.regionAt(wx, wy)?.id;
    if (reg === 'show' && hash2(gx, gy, 303) < 0.8) return; // mown
    const t = TUFTS[Math.floor(hash2(gx, gy, 304) * TUFTS.length)];
    const fx = wx * FINE + (gx & 1), fy = wy * FINE;
    for (let r = 0; r < t.length; r++)
      for (let c = 0; c < t[r].length; c++) {
        if (t[r][c] === '.') continue;
        const x = fx + c - j.x0, y = fy + r - j.y0;
        if (x < 0 || y < 0 || x >= j.bw || y >= j.bh) continue;
        const k = y * j.bw + x;
        if (j.cls[k] !== K.Grass) continue;
        const under = j.px[k];
        if (under === meadow) j.px[k] = moss;
        else if (under === moss) j.px[k] = sage;
      }
  });
}

// A fallen log, mossed along its top, the cut end pale with rings.
function fallenLog(j: Job, fx: number, fy: number, len: number) {
  const rows: string[] = ['', '', '', '', '', ''];
  for (let x = 0; x < len; x++) {
    const end = x >= len - 3;
    const h = hash2(fx + x, fy, 153);
    rows[0] += end ? '.' : h < 0.5 ? 'o' : '.';
    rows[1] += end ? (x === len - 3 ? '.' : 'w') : h < 0.7 ? 'o' : 'p';
    rows[2] += end ? (x === len - 2 ? 'y' : 'w') : (x % 5 === 2 ? 't' : 'p');
    rows[3] += end ? 'w' : 'p';
    rows[4] += end ? (x === len - 3 ? '.' : 's') : 'p';
    rows[5] += 's';
  }
  put(j, fx, fy, rows, grassOnly);
}

// Trunks under the crowns and pines (only their foot shows below the
// leaves), and along the forest mass's lower edge a trunk every few paces.
const TRUNK = ['ps', 'ps', 'ps', 'ps', 'ps', 'pps', 'p.pp', '.ss'];
function trunks(j: Job) {
  const d = j.d;
  const ok = (k: number) => k === K.Grass || k === K.Path;
  const fx0 = j.x0 - 8, fy0 = j.y0 - 16, fx1 = j.x0 + j.bw + 8, fy1 = j.y0 + j.bh + 4;
  for (const t of d.trunks) {
    const fx = t.x * FINE - 1, fy = t.y * FINE;
    if (fx < fx0 || fx > fx1 || fy < fy0 || fy > fy1) continue;
    put(j, fx, fy, TRUNK, ok);
  }
  const wx0 = Math.max(2, (j.x0 >> 1) - 4), wy0 = Math.max(1, (j.y0 >> 1) - 8);
  const wx1 = Math.min(W - 3, ((j.x0 + j.bw) >> 1) + 4), wy1 = Math.min(H - 5, ((j.y0 + j.bh) >> 1) + 2);
  for (let wy = wy0; wy < wy1; wy++)
    for (let wx = wx0; wx < wx1; wx++) {
      const i = wy * W + wx;
      if (!d.cm[i] || d.cm[i + W] || !d.forest[i] || d.pz[i]) continue;
      if (hash2(wx, wy, 170) < 0.07) put(j, wx * FINE - 1, wy * FINE + 1, TRUNK.slice(hash2(wx, wy, 171) < 0.5 ? 2 : 1), ok);
    }
}

// Sheep tracks: narrow trodden lines wandering over the hills.
function sheepTracks(j: Job) {
  const hl = REGIONS.find((r) => r.id === 'hills');
  if (!hl) return;
  const bx0 = j.x0, by0 = j.y0, bx1 = j.x0 + j.bw, by1 = j.y0 + j.bh;
  if (bx1 < (hl.cx - hl.rx - 4) * TS * FINE || bx0 > (hl.cx + hl.rx + 4) * TS * FINE || by1 < (hl.cy - hl.ry - 4) * TS * FINE || by0 > (hl.cy + hl.ry + 4) * TS * FINE) return;
  const R = mulberry32(77);
  for (let k = 0; k < 7; k++) {
    let x = (hl.cx - hl.rx * 0.8 + R() * hl.rx * 1.6) * TS * FINE, y = (hl.cy - hl.ry * 0.8 + R() * hl.ry * 1.6) * TS * FINE;
    let a = R() * Math.PI * 2;
    for (let step = 0; step < 440; step++) {
      a += (R() - 0.5) * 0.25;
      x += Math.cos(a);
      y += Math.sin(a) * 0.7;
      const xi = Math.round(x), yi = Math.round(y);
      if (j.d.map.regionAt(xi >> 1, yi >> 1)?.id !== 'hills') break;
      const bx = xi - bx0, by = yi - by0;
      if (bx < 0 || by < 0 || bx >= j.bw || by >= j.bh) continue;
      const i = by * j.bw + bx;
      if (j.cls[i] === K.Grass && j.px[i] === meadow && !j.d.cm[(yi >> 1) * W + (xi >> 1)]) j.px[i] = moss;
    }
  }
}

// ---- The canopy (first pass: the 1x canopy doubled) ----

export function paintCanopy(b: Baked, fx0: number, fy0: number, fw: number, fh: number, _look: Look): Uint32Array {
  const out = new Uint32Array(fw * fh);
  const src = b.canopyPx;
  for (let y = 0; y < fh; y++) {
    const wy = (fy0 + y) >> 1;
    if (wy < 0 || wy >= H) continue;
    for (let x = 0; x < fw; x++) {
      const wx = (fx0 + x) >> 1;
      if (wx < 0 || wx >= W) continue;
      out[y * fw + x] = src[wy * W + wx];
    }
  }
  return out;
}
