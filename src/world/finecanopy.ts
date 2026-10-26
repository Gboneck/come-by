import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { hash2 } from '../rng';
import { EDGES, edgeAt, type Baked, type FineData } from './terrain';
import { WORLD_H, WORLD_W } from './map';
import type { Look } from './fineground';

// The canopy at double density, painted for any rectangle like the ground.
//
// The forest is drawn as leaf clumps rather than speckle: overlapping round
// clumps laid back to front, each lit from the upper right (a sage crescent
// where the light catches it) with a plum rim on its shaded lower left, so
// the mass reads as heaped foliage with a scalloped edge. Broadleaf trees on
// the forest edges and in the groves are rosettes of clumps; willows trail
// strands; the northern forest is tiered pines over dark gaps. The seasons
// recolour whole clumps (autumn), cap their tops (snow) or set blossom on
// them (spring), so they stay shapes too.

const F = 2;
const W = WORLD_W, H = WORLD_H;
const { teal, sage, plum, wool, butter, moss } = U32;
const MC = 2; // margin: the outline looks one pixel round (trees come from their lists)
const REACH = 26; // how far a crown spreads from its centre, fine px

interface Buf {
  x0: number;
  y0: number;
  bw: number;
  bh: number;
  px: Uint32Array;
  kind: Uint8Array; // 1 forest mass, 2 broadleaf, 3 pine
}

// Lower-left side is the shade: > 0 facing away from the light.
const shadeOf = (dx: number, dy: number, d: number) => (-dx * 0.6 + dy * 0.8) / (d || 1);

export function paintCanopy(b: Baked, fx0: number, fy0: number, fw: number, fh: number, look: Look): Uint32Array {
  const d = b.fine;
  const bw = fw + 2 * MC, bh = fh + 2 * MC;
  const buf: Buf = { x0: fx0 - MC, y0: fy0 - MC, bw, bh, px: new Uint32Array(bw * bh), kind: new Uint8Array(bw * bh) };
  mass(buf, d);
  massClumps(buf, d, look);
  crowns(buf, d, look);
  pines(buf, d, look);
  outline(buf);
  const out = new Uint32Array(fw * fh);
  for (let y = 0; y < fh; y++) out.set(buf.px.subarray((y + MC) * bw + MC, (y + MC) * bw + MC + fw), y * fw);
  return out;
}

// The forest mass's own outline at fine density; dark gaps in the pine zone.
function mass(buf: Buf, d: FineData) {
  const f = d.fields.forest, e = EDGES.forest;
  for (let y = 0; y < buf.bh; y++) {
    const fy = buf.y0 + y, wy = Math.min(H - 1, Math.max(0, fy >> 1));
    for (let x = 0; x < buf.bw; x++) {
      const fx = buf.x0 + x, wx = Math.min(W - 1, Math.max(0, fx >> 1));
      const i = wy * W + wx;
      const v = d.forest[i];
      const uniform = wx > 0 && wy > 0 && wx < W - 1 && wy < H - 1 && d.forest[i - 1] === v && d.forest[i + 1] === v && d.forest[i - W] === v && d.forest[i + W] === v;
      const inside = uniform ? v === 1 : edgeAt(f, e, fx / F, fy / F);
      if (!inside) continue;
      const k = y * buf.bw + x;
      buf.kind[k] = 1;
      buf.px[k] = d.pz[i] ? plum : teal;
    }
  }
}

// One clump of leaves at fine (cx, cy), radius r.
interface Clump { x: number; y: number; r: number; lit: boolean; seed: number; tone: number }

function drawClump(buf: Buf, c: Clump, kind: number, look: Look, clip?: (k: number) => boolean) {
  const R = Math.ceil(c.r) + 1;
  const ph = (c.seed % 628) / 100;
  // Autumn turns whole clumps: gold, rust or a late green.
  const scheme = look.leaves > 0 ? autumnScheme(c, look.leaves) : 0;
  const body = scheme === 1 ? butter : scheme === 2 ? sage : teal;
  const hi = scheme === 1 ? wool : scheme === 2 ? moss : sage;
  const rim = plum;
  for (let dy = -R; dy <= R; dy++) {
    const y = Math.round(c.y) + dy - buf.y0;
    if (y < 0 || y >= buf.bh) continue;
    for (let dx = -R; dx <= R; dx++) {
      const x = Math.round(c.x) + dx - buf.x0;
      if (x < 0 || x >= buf.bw) continue;
      const dd = Math.hypot(dx, dy * 1.1);
      const a = Math.atan2(dy, dx);
      const rr = c.r * (1 + 0.1 * Math.sin(3 * a + ph) + 0.06 * Math.sin(5 * a + ph * 2));
      if (dd > rr) continue;
      const k = y * buf.bw + x;
      if (clip && !clip(k)) continue;
      const s = shadeOf(dx, dy, dd);
      let col = body;
      if (dd > rr - 1.3 && s > -0.15) col = rim;
      else if (dd > rr - 2.4 && s > 0.6) col = rim;
      else if (c.lit && dd > rr - 3.2 && dd < rr - 1.2 && s < -0.5) col = hi;
      else if (c.tone > 0.8 && dd < rr * 0.45 && s < -0.2) col = hi;
      // Snow lies on the top of each clump.
      if (look.snow > 0 && dy < 0 && dd > rr - 1.5 - look.snow * 0.6 && s < 0.45) col = wool;
      buf.px[k] = col;
      buf.kind[k] = kind;
    }
  }
  // Spring: a few blossoms on the lit side, little flowers not specks.
  if (look.bloom > 0 && kind === 2) {
    const n = Math.round((c.r / 9) * look.bloom * (c.tone > 0.5 ? 1 : 0.4));
    for (let k = 0; k < n; k++) {
      const a = -0.6 - hash2(c.seed, k, 712) * 2.2, rr = c.r * (0.3 + hash2(c.seed, k, 713) * 0.55);
      blossom(buf, Math.round(c.x + Math.cos(a) * rr), Math.round(c.y + Math.sin(a) * rr));
    }
  }
}

function blossom(buf: Buf, x: number, y: number) {
  for (const [dx, dy, col] of [[0, -1, wool], [-1, 0, wool], [1, 0, wool], [0, 1, wool], [0, 0, butter]] as const) {
    const bx = x + dx - buf.x0, by = y + dy - buf.y0;
    if (bx < 0 || by < 0 || bx >= buf.bw || by >= buf.bh || !buf.kind[by * buf.bw + bx]) continue;
    buf.px[by * buf.bw + bx] = col;
  }
}

function autumnScheme(c: Clump, leaves: number): number {
  // Even at the height of autumn a fifth of the clumps stay green, and of
  // the rest about half go gold, half a late sage.
  const h = hash2(c.seed, 1, 714);
  const turned = h < (leaves / 4) * 0.8;
  if (!turned) return 0;
  return hash2(c.seed, 2, 715) < 0.5 ? 1 : 2;
}

// Clumps over the broadleaf forest mass on a jittered grid, back to front.
function massClumps(buf: Buf, d: FineData, look: Look) {
  const CW = 5, CH = 4; // world px
  const wx0 = Math.floor(buf.x0 / F) - 6, wy0 = Math.floor(buf.y0 / F) - 6;
  const wx1 = Math.ceil((buf.x0 + buf.bw) / F) + 6, wy1 = Math.ceil((buf.y0 + buf.bh) / F) + 6;
  const list: Clump[] = [];
  for (let gy = Math.floor(wy0 / CH); gy * CH <= wy1; gy++)
    for (let gx = Math.floor(wx0 / CW); gx * CW <= wx1; gx++) {
      const wx = Math.floor((gx + 0.1 + hash2(gx, gy, 90) * 0.8) * CW + (gy & 1) * 2), wy = Math.floor((gy + 0.1 + hash2(gx, gy, 91) * 0.8) * CH);
      if (wx < 0 || wy < 0 || wx >= W || wy >= H) continue;
      const i = wy * W + wx;
      if (!d.forest[i] || d.pz[i]) continue;
      const seed = (gx * 7919 + gy * 104729) >>> 0;
      list.push({ x: wx * F + 1, y: wy * F + 1, r: 5 + hash2(gx, gy, 92) * 3.5, lit: hash2(gx, gy, 93) < 0.7, seed, tone: hash2(gx, gy, 94) });
    }
  list.sort((p, q) => p.y - q.y || p.x - q.x);
  // Clumps may bulge past the mass's outline, which scallops its edge.
  for (const c of list) drawClump(buf, c, 1, look, (k) => buf.kind[k] !== 3);
}

// Broadleaf trees: a rosette of clumps round a centre clump. Willows by the
// water: taller, their lower half hanging in strands.
function crowns(buf: Buf, d: FineData, look: Look) {
  const fx0 = buf.x0 - REACH, fy0 = buf.y0 - REACH, fx1 = buf.x0 + buf.bw + REACH, fy1 = buf.y0 + buf.bh + REACH;
  for (const c of d.crowns) {
    const cx = c.x * F + 1, cy = c.y * F + 1, R = c.r * F;
    if (cx < fx0 || cx > fx1 || cy < fy0 || cy > fy1) continue;
    const seed = (c.x * 73856093) ^ (c.y * 19349663);
    if (c.willow) {
      willow(buf, cx, cy, R, seed >>> 0, look);
      continue;
    }
    const n = R > 11 ? 6 : 5;
    const parts: Clump[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + hash2(seed, k, 720) * 0.6;
      const dd = R * (0.42 + hash2(seed, k, 721) * 0.12);
      parts.push({ x: cx + Math.cos(a) * dd, y: cy + Math.sin(a) * dd * 0.9, r: R * (0.5 + hash2(seed, k, 722) * 0.12), lit: true, seed: (seed + k * 31) >>> 0, tone: c.light ? 0.9 : hash2(seed, k, 723) });
    }
    parts.sort((p, q) => p.y - q.y);
    // The back clumps, then the centre, then the front.
    const back = parts.filter((p) => p.y < cy), front = parts.filter((p) => p.y >= cy);
    for (const p of back) drawClump(buf, p, 2, look);
    drawClump(buf, { x: cx, y: cy - R * 0.08, r: R * 0.62, lit: true, seed: (seed + 99) >>> 0, tone: c.light ? 0.95 : 0.6 }, 2, look);
    for (const p of front) drawClump(buf, p, 2, look);
  }
}

function willow(buf: Buf, cx: number, cy: number, R: number, seed: number, look: Look) {
  // The crown above.
  drawClump(buf, { x: cx, y: cy - R * 0.25, r: R * 0.75, lit: true, seed, tone: 0.9 }, 2, look);
  // Strands hanging from it, sage where the light finds them.
  for (let x = Math.round(cx - R); x <= cx + R; x++) {
    const u = (x - cx) / R;
    if (Math.abs(u) > 0.98) continue;
    const top = Math.round(cy - R * 0.25 + Math.sqrt(1 - u * u) * R * 0.45);
    const len = Math.round(R * (0.55 + hash2(x, seed, 730) * 0.35));
    const strand = ((x + seed) & 1) === 0;
    for (let y = top; y < top + len; y++) {
      const bx = x - buf.x0, by = y - buf.y0;
      if (bx < 0 || by < 0 || bx >= buf.bw || by >= buf.bh) continue;
      const k = by * buf.bw + bx;
      let col = strand ? (u > 0.1 ? sage : teal) : plum;
      if (look.leaves > 1 && strand && hash2(x, seed, 731) < look.leaves / 6) col = butter;
      if (look.snow > 1 && y === top) col = wool;
      buf.px[k] = col;
      buf.kind[k] = 2;
    }
  }
}

// Pines stand up a little like the buildings: tiered cones, the left side in
// shade, the right edge catching the light, a dark band under each tier.
function pines(buf: Buf, d: FineData, look: Look) {
  const fx0 = buf.x0 - 24, fy0 = buf.y0 - 8, fx1 = buf.x0 + buf.bw + 24, fy1 = buf.y0 + buf.bh + 40;
  for (const p of d.pines) {
    const bx = p.x * F + 1, by = p.y * F + 1;
    if (bx < fx0 || bx > fx1 || by < fy0 || by > fy1) continue;
    const rows = pineRows(p.h, look.snow);
    const M = (rows[0].length - 1) / 2;
    for (let r = 0; r < rows.length; r++) {
      const y = by - rows.length + 1 + r - buf.y0;
      if (y < 0 || y >= buf.bh) continue;
      const row = rows[r];
      for (let k = 0; k < row.length; k++) {
        const ch = row[k];
        if (ch === '.') continue;
        const x = bx - M + k - buf.x0;
        if (x < 0 || x >= buf.bw) continue;
        const i = y * buf.bw + x;
        buf.px[i] = ch === 'p' ? plum : ch === 's' ? sage : ch === 'w' ? wool : teal;
        buf.kind[i] = 3;
      }
    }
  }
}

const pineCache = new Map<string, string[]>();
function pineRows(h: number, snow: number): string[] {
  const key = `${h},${snow}`;
  let rows = pineCache.get(key);
  if (rows) return rows;
  const hf = h * F;
  const M = (h >= 14 ? 5 : 4) * F;
  const cut = [0, Math.round(hf * 0.3), Math.round(hf * 0.62), hf];
  rows = [];
  for (let t = 0; t < 3; t++) {
    const s = cut[t], e = cut[t + 1];
    for (let r = s; r < e; r++) {
      const u = (r - s) / Math.max(1, e - s - 1);
      const wTop = t === 0 ? 0 : M * (0.2 + 0.12 * t);
      const wBot = M * (t === 0 ? 0.55 : t === 1 ? 0.8 : 1);
      const w = wTop + (wBot - wTop) * u;
      let row = '';
      for (let dx = -M; dx <= M; dx++) {
        if (Math.abs(dx) > w + 0.3) { row += '.'; continue; }
        let c = 't';
        const edgeL = dx <= -w + 0.7, edgeR = dx >= w - 0.7;
        if (snow > 0 && (r - s) < (t === 0 ? 2 : 1) + (snow > 2 ? 1 : 0) && dx > -w * 0.7) c = 'w';
        else if (t > 0 && r === s) c = 'p'; // the shadow of the tier above
        else if (edgeL) c = 'p';
        else if (r === e - 1 && dx < w * 0.4) c = 'p';
        else if (dx < -w * 0.35 && u > 0.35) c = BAYER4[(r & 3) * 4 + ((dx + 16) & 3)] < 8 ? 'p' : 't';
        else if (edgeR && u < 0.9) c = 's';
        else if (dx > w * 0.35 && ((r - s) % 3 === 1)) c = 's'; // boughs catching the light
        row += c;
      }
      rows.push(row);
    }
  }
  pineCache.set(key, rows);
  return rows;
}

// The canopy's plum outline wherever it ends against the ground below or to
// the left (the shaded side), so trees sit clearly on the grass.
function outline(buf: Buf) {
  const { px, kind, bw, bh } = buf;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const k = y * bw + x;
      if (!kind[k] || kind[k] === 3) continue;
      const below = y + 1 < bh ? kind[k + bw] : 1, left = x > 0 ? kind[k - 1] : 1;
      if (!below || !left) px[k] = plum;
    }
}
