import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { PX, makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';
import { quality } from '../gfx/quality';

export interface Light {
  x: number; // screen coords (world px from the view's top-left)
  y: number;
  r: number; // world px
  warm?: boolean; // a flame: its pool ends in a dithered buttercup ring
  power?: number; // 0..1: how much of the dark it lifts at its heart (1)
  soft?: number; // 0..1: how much of the radius is falloff (0.8); 1 is all
}

// Everything that changes the light, in one ordered-dither pass so the
// screen stays inside the palette:
// - dusk and night: plum, anchored to the world so it does not crawl as the
//   camera moves; lights cut soft-edged pools, a little wider than tall
//   because the ground is seen at a slant, their fall graded from the
//   ground through teal to plum; `slope` darkens one side of the screen
//   (dawn and dusk come from one side); the edges of the screen a little
//   darker than round the dog;
// - overcast and wet weather: a few more plum pixels everywhere;
// - fog: a wool (sage at night) veil in drifting banks, thicker where the
//   place is foggy (setFogField: by water, in hollows), thin round the dog
//   and the lamps, lying in short level streaks of mist on a ramp of its
//   own (mist()) that slide with the drift;
// - lightning: a frame of wool and buttercup over everything.
//
// The light is worked out per world pixel, then (at GRAPHICS HIGH) dithered
// over its fine pixels with an 8x8 ordered ramp: 64 steps from clear to
// solid, so pools fall off smoothly and the dark reads as a gradient, not a
// checkerboard. MEDIUM and LOW dither per world pixel with the 4x4 ramp,
// for a quarter of the work.
export interface SkyOpts {
  dark: number; // 0..1, as DayCycle.darkness()
  lights: Light[];
  slope?: number;
  overcast?: number; // extra plum, in Bayer steps (0..16)
  fog?: number; // 0..1
  fogNight?: boolean;
  fogX?: number; // drift of the wisps (world px)
  flash?: number; // lightning, in Bayer steps
  blue?: number; // 0..1 the blue hour: the dark comes in partly teal
}

// 8x8 ordered dither (0..63), and its thresholds on the 0..16 scale.
const BAYER8 = (() => {
  const out: number[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      let v = 0;
      for (let b = 0, xx = x, yy = y; b < 3; b++, xx >>= 1, yy >>= 1) v = (v << 2) | ((((xx & 1) ^ (yy & 1)) << 1) | (yy & 1));
      out.push(v);
    }
  return out;
})();
const T8 = new Float32Array(BAYER8.map((v) => (v + 0.5) / 4));

// Fog's own ramp, so mist lies in short level runs (4 fine pixels; 2 world
// pixels at MEDIUM/LOW) rather than the night's even dots: the 8x8 ramp
// over runs instead of pixels, each band of 8 rows shifted along by a hash
// so the runs do not line up in columns, and the whole sliding with the
// drift. 64 rows by one period (8 runs); rebuilt each frame for the drift.
function mist(t: Float32Array, run: number, shift: number) {
  const n = 8 << run;
  for (let r = 0; r < 64; r++) {
    const off = Math.floor(hash2(r >> 3, 0, 913) * n) - shift, row = (r & 7) * 8;
    for (let c = 0; c < n; c++) t[r * n + c] = T8[row + (((c + off) >> run) & 7)];
  }
}

// Fog by place: a quarter-resolution field of 0..1 over the world, set by
// whoever knows the land (the default leans on water and the high ground).
let fogField: { w: number; h: number; data: Float32Array } | null = null;
export function setFogField(worldW: number, worldH: number, density: (wx: number, wy: number) => number) {
  const w = Math.ceil(worldW / 4), h = Math.ceil(worldH / 4);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.max(0, Math.min(1, density(x * 4 + 2, y * 4 + 2)));
  fogField = { w, h, data };
}
export const hasFogField = () => !!fogField;

// Tileable value noise, 0..255, for clouds and fog wisps.
export const NS = 128;
export function tileNoise(cell: number, seed: number): Uint8Array {
  const out = new Uint8Array(NS * NS);
  const P = NS / cell;
  const h = (x: number, y: number) => hash2(((x % P) + P) % P, ((y % P) + P) % P, seed);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < NS; y++)
    for (let x = 0; x < NS; x++) {
      const fx = x / cell, fy = y / cell;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = sm(fx - x0), ty = sm(fy - y0);
      const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      const v = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      const f2x = x / (cell / 2), f2y = y / (cell / 2);
      const P2 = P * 2;
      const h2 = (xx: number, yy: number) => hash2(((xx % P2) + P2) % P2, ((yy % P2) + P2) % P2, seed + 1);
      const u0 = Math.floor(f2x), v0 = Math.floor(f2y);
      const ux = sm(f2x - u0), vy = sm(f2y - v0);
      const a2 = h2(u0, v0), b2 = h2(u0 + 1, v0), c2 = h2(u0, v0 + 1), d2 = h2(u0 + 1, v0 + 1);
      const w = a2 + (b2 - a2) * ux + (c2 - a2) * vy + (a2 - b2 - c2 + d2) * ux * vy;
      out[y * NS + x] = Math.round((v * 0.7 + w * 0.3) * 255);
    }
  // Stretch to the full range.
  let lo = 255, hi = 0;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = Math.round(((out[i] - lo) / Math.max(1, hi - lo)) * 255);
  return out;
}

// A light's falloff by distance squared (0 at the heart, LUT_N at the edge):
// the hole it cuts (a full pool, then a smoothstep fall to the edge, `soft`
// of the radius), and a flame's ring of warmth in its outer third.
const LUT_N = 512;
const luts = new Map<string, { h: Float32Array; ring: Float32Array }>();
function falloff(power: number, soft: number) {
  const key = `${power.toFixed(2)},${soft.toFixed(2)}`;
  let t = luts.get(key);
  if (!t) {
    const h = new Float32Array(LUT_N + 1), ring = new Float32Array(LUT_N + 1), sf = Math.max(0.05, soft);
    for (let j = 0; j <= LUT_N; j++) {
      const k = 1 - Math.sqrt(j / LUT_N); // 1 at the heart, 0 at the edge
      const u = Math.min(1, k / sf);
      h[j] = power * u * u * (3 - 2 * u);
      ring[j] = k < 0.34 ? 1 - Math.abs(k - 0.17) / 0.17 : 0;
    }
    luts.set(key, (t = { h, ring }));
  }
  return t;
}

export class NightOverlay {
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  private W = 0;
  private H = 0;
  private d = 0;
  private wisps = tileNoise(16, 911);
  private banks = tileNoise(32, 912);
  // Per world pixel, kept between frames: the night's level (0..16), the
  // fog's (0..16), and a lamp ring's warmth (0..1). Each light is stamped
  // only over its own box.
  private hole = new Float32Array(1);
  private warm = new Float32Array(1);
  private L = new Float32Array(1);
  private F = new Float32Array(1);
  private E = new Float32Array(1); // 0..1: in a pool's falloff (for the cool rim)
  private exs = new Float32Array(1);
  private col = new Float32Array(1);
  private mistF = new Float32Array(64 * 32); // fog's ramp in fine pixels
  private mistW = new Float32Array(64 * 16); // and in world pixels

  constructor() {
    [this.c, this.g] = makeCanvas(1, 1);
    this.img = this.g.createImageData(1, 1);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  private ensure(W: number, H: number, d: number) {
    if (W === this.W && H === this.H && d === this.d) return;
    this.W = W;
    this.H = H;
    this.d = d;
    this.c.width = W * d;
    this.c.height = H * d;
    this.img = this.g.createImageData(W * d, H * d);
    this.buf = new Uint32Array(this.img.data.buffer);
    for (const k of ['hole', 'warm', 'L', 'F', 'E'] as const) this[k] = new Float32Array(W * H);
    for (const k of ['exs', 'col'] as const) this[k] = new Float32Array(W);
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, o: SkyOpts) {
    const base = o.dark < 1 / 16 ? 0 : o.dark * 16;
    const over = o.overcast ?? 0, fog = (o.fog ?? 0) * 16, flash = o.flash ?? 0;
    if (base <= 0 && over < 0.5 && fog < 0.5 && flash <= 0) return;
    const d = quality.fineSky ? PX : 1;
    this.ensure(W, H, d);
    const blue = o.blue ?? 0;
    const slope = o.slope ?? 0;
    const L = o.lights.filter((l) => l.x + l.r > 0 && l.x - l.r < W && l.y + l.r > 0 && l.y - l.r < H);
    const SY = 1 / 0.78;
    const hole = this.hole, warm = this.warm;
    const anyWarm = base > 0 && L.some((l) => l.warm);
    if (L.length) {
      hole.fill(0);
      if (anyWarm) warm.fill(0);
      for (const l of L) {
        const ry = l.r / SY, r2 = l.r * l.r, inv = LUT_N / r2;
        const lut = falloff(l.power ?? 1, l.soft ?? 0.8);
        const x0 = Math.max(0, Math.floor(l.x - l.r)), x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
        const y0 = Math.max(0, Math.floor(l.y - ry)), y1 = Math.min(H - 1, Math.ceil(l.y + ry));
        for (let y = y0; y <= y1; y++) {
          const dy = (y - l.y) * SY, dy2 = dy * dy;
          for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
            const dx = x - l.x, d2 = dx * dx + dy2;
            if (d2 >= r2) continue;
            const j = (d2 * inv) | 0; // the falloff, looked up by distance squared
            const h = lut.h[j];
            if (h > hole[i]) hole[i] = h;
            if (l.warm) {
              const r = lut.ring[j];
              if (r > warm[i]) warm[i] = r;
            }
          }
        }
      }
    }
    // ---- The light, per world pixel ----
    const LL = this.L, FF = this.F, EE = this.E, col = this.col, exs = this.exs;
    const rim = base > 0 && L.length > 0;
    const hw = W / 2, hh = H / 2;
    for (let x = 0; x < W; x++) {
      col[x] = base > 0 ? base * (1 + slope * (0.5 - x / W) * 2) : 0;
      exs[x] = ((x - hw) / hw) ** 2;
    }
    // The night deepens a little towards the screen's edges (up to 1.5 of
    // the 16 steps in the corners), so it reads as a gradient round the
    // dog rather than one flat level.
    const vig = base > 0 ? 1.5 * Math.min(1, base / 8) : 0;
    const WT = this.wisps, BT = this.banks, M = NS - 1; // NS is a power of two: & wraps negatives too
    const fx = Math.floor(o.fogX ?? 0), fbx = Math.floor((o.fogX ?? 0) * 0.3);
    const ff = fogField;
    for (let y = 0; y < H; y++) {
      const wy = y + oy;
      const ey = ((y - hh) / hh) ** 2;
      const nrow = ((wy >> 1) & M) * NS, brow = ((wy >> 3) & M) * NS;
      const frow = ff ? Math.max(0, Math.min(ff.h - 1, wy >> 2)) * ff.w : 0;
      for (let x = 0, i = y * W; x < W; x++, i++) {
        const wx = x + ox;
        const edge = Math.min(1, exs[x] + ey);
        let dark = col[x] > 0 ? col[x] + vig * edge : 0;
        let f = 0;
        if (fog > 0) {
          // Drifting banks with clean edges: big slow banks and finer wisps
          // through them, sharpened, so there are thick drifts and clearer
          // lanes between; thicker where the place is foggy, a little towards
          // the screen's edges so the field round the dog stays clearer.
          const n = 0.65 * BT[(((wx >> 2) - fbx) & M) + brow] + 0.35 * WT[((wx - fx) & M) + nrow];
          let bank = (n / 255 - 0.4) / 0.16;
          bank = bank <= 0 ? 0 : bank >= 1 ? 1 : bank * bank * (3 - 2 * bank);
          const place = ff ? ff.data[frow + Math.max(0, Math.min(ff.w - 1, wx >> 2))] : 0.7;
          f = fog * (0.08 + 0.92 * bank) * (0.4 + 0.85 * place) * (0.75 + 0.4 * edge);
        }
        let e = 0;
        if (L.length) {
          const h = hole[i];
          if (h > 0) {
            dark -= 16 * h;
            f *= 1 - h;
            e = 4 * h * (1 - h); // most halfway down a pool's falloff
          }
        }
        if (rim) EE[i] = e;
        let level = over;
        if (dark > 0) {
          // A bank at night catches what light there is (the moon, the
          // lamps): it stands in for some of the dark rather than hiding
          // under it, so fog nights show their banks.
          if (f > 0) dark -= Math.min(dark, f * 0.45);
          level += dark;
        }
        // Night and fog together never cover more than ~2/3 of the pixels,
        // so the ground still reads between them.
        if (dark > 0 && level + f > 10) f = Math.max(0, 10 - level);
        LL[i] = level;
        // Fog is dithered on its own ramp over what the night leaves clear,
        // so it is scaled up to still cover f of the 16 steps.
        FF[i] = f > 0 && level < 16 ? (f * 16) / (16 - level) : 0;
      }
    }
    const buf = this.buf, plum = U32.plum, teal = U32.teal, fogCol = o.fogNight ? U32.sage : U32.wool, wool = U32.wool, butter = U32.butter;
    const blueK = blue > 0 ? 1 - blue * 0.7 : 0;
    const anyFog = fog > 0;
    if (d === 1) {
      // MEDIUM and LOW: one threshold a world pixel, the 4x4 ramp.
      const MW = this.mistW;
      if (anyFog) mist(MW, 1, fx);
      for (let y = 0; y < H; y++) {
        const by = ((y + oy) & 3) * 4, mrow = ((y + oy) & 63) * 16;
        for (let x = 0, i = y * W; x < W; x++, i++) {
          const thr = BAYER4[by + ((x + ox) & 3)], l = LL[i];
          buf[i] =
            thr < flash ? (thr < flash * 0.3 ? butter : wool)
            : thr < l ? (anyWarm && thr >= l - warm[i] * 3.2 ? butter : (blueK && l > over && thr >= l * blueK) || (rim && thr >= l * (1 - 0.55 * EE[i])) ? teal : plum)
            : anyWarm && thr < warm[i] * 3.2 ? butter
            : anyFog && MW[mrow + ((x + ox) & 15)] < FF[i] ? fogCol : 0;
        }
      }
    } else {
      // HIGH: each world pixel's light dithered over its four fine pixels
      // with the 8x8 ramp, anchored to the world (64 steps: the light
      // changes slowly enough that easing between world pixels is not
      // worth its cost).
      const FW = W * PX, MF = this.mistF;
      if (anyFog) mist(MF, 2, Math.floor((o.fogX ?? 0) * PX));
      for (let y = 0; y < H; y++) {
        const fy = (y + oy) * PX, by = fy & 7, o0 = y * PX * FW;
        const tA = by * 8, tB = ((by + 1) & 7) * 8; // the two Bayer rows
        const mA = (fy & 63) * 32, mB = ((fy + 1) & 63) * 32; // and the fog's
        for (let x = 0, i = y * W; x < W; x++, i++) {
          const l = LL[i];
          const bx = ((x + ox) * PX) & 7, o = o0 + x * PX, c = ((x + ox) * PX) & 31;
          const t0 = T8[tA + bx], t1 = T8[tA + bx + 1], t2 = T8[tB + bx], t3 = T8[tB + bx + 1];
          const wr = anyWarm ? warm[i] * 3.2 : 0, f = anyFog ? FF[i] : 0, e = rim ? EE[i] : 0;
          if (flash <= 0 && !wr && !f && !e && !blueK) {
            // Plain darkness: the short way.
            buf[o] = t0 < l ? plum : 0;
            buf[o + 1] = t1 < l ? plum : 0;
            buf[o + FW] = t2 < l ? plum : 0;
            buf[o + FW + 1] = t3 < l ? plum : 0;
            continue;
          }
          // A flame's ring warms the edge of its pool (buttercup in place of
          // some of the dark); the outer part of any pool's fall cools to
          // teal before the plum; the blue hour's dark comes in partly teal.
          const warmAt = wr ? l - wr : Infinity;
          const coolAt = Math.min(e > 0 ? l * (1 - 0.55 * e) : Infinity, blueK && l > over ? l * blueK : Infinity);
          const hiAt = Math.min(warmAt, coolAt);
          if (flash > 0) {
            for (let j = 0; j < 4; j++) {
              const t = j === 0 ? t0 : j === 1 ? t1 : j === 2 ? t2 : t3;
              const fogAt = f > 0 && MF[(j >> 1 ? mB : mA) + c + (j & 1)] < f;
              buf[o + (j >> 1) * FW + (j & 1)] = t < flash ? (t < flash * 0.3 ? butter : wool) : t < l ? (t < hiAt ? plum : t >= warmAt ? butter : teal) : t < wr ? butter : fogAt ? fogCol : 0;
            }
            continue;
          }
          buf[o] = t0 < l ? (t0 < hiAt ? plum : t0 >= warmAt ? butter : teal) : t0 < wr ? butter : f > 0 && MF[mA + c] < f ? fogCol : 0;
          buf[o + 1] = t1 < l ? (t1 < hiAt ? plum : t1 >= warmAt ? butter : teal) : t1 < wr ? butter : f > 0 && MF[mA + c + 1] < f ? fogCol : 0;
          buf[o + FW] = t2 < l ? (t2 < hiAt ? plum : t2 >= warmAt ? butter : teal) : t2 < wr ? butter : f > 0 && MF[mB + c] < f ? fogCol : 0;
          buf[o + FW + 1] = t3 < l ? (t3 < hiAt ? plum : t3 >= warmAt ? butter : teal) : t3 < wr ? butter : f > 0 && MF[mB + c + 1] < f ? fogCol : 0;
        }
      }
    }
    this.g.putImageData(this.img, 0, 0);
    g.drawImage(this.c, 0, 0, W, H);
  }
}

// The default fog by place: thick by water and in the low meadows, thin on
// the high ground and the rocks (the World session's land can replace it
// with setFogField). `soil` is the baked ground (3 water, 2 wet bank).
export function defaultFogField(worldW: number, worldH: number, soil: Uint8Array, region: (x: number, y: number) => string | undefined) {
  const w = Math.ceil(worldW / 4), h = Math.ceil(worldH / 4);
  let wet = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = soil[Math.min(worldH - 1, y * 4 + 2) * worldW + Math.min(worldW - 1, x * 4 + 2)];
      wet[y * w + x] = s === 3 ? 1 : s === 2 ? 0.7 : 0;
    }
  // Spread it over the land round the water: two box blurs, 9 cells wide.
  const R = 9;
  for (let pass = 0; pass < 2; pass++)
    for (const horiz of [true, false]) {
      const out = new Float32Array(w * h);
      const n = horiz ? w : h, m = horiz ? h : w;
      for (let j = 0; j < m; j++) {
        let acc = 0;
        const at = (k: number) => wet[horiz ? j * w + k : k * w + j];
        for (let k = -R; k <= R; k++) acc += at(Math.max(0, Math.min(n - 1, k)));
        for (let k = 0; k < n; k++) {
          out[horiz ? j * w + k : k * w + j] = acc / (2 * R + 1);
          acc += at(Math.min(n - 1, k + R + 1)) - at(Math.max(0, k - R));
        }
      }
      wet = out;
    }
  let top = 0;
  for (const v of wet) top = Math.max(top, v);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = region(x * 4 + 2, y * 4 + 2);
      const lift = r === 'high' ? 0.35 : r === 'rocky' ? 0.6 : r === 'hills' ? 0.8 : 1;
      data[y * w + x] = (0.45 + 0.55 * Math.min(1, (wet[y * w + x] / Math.max(1e-6, top)) * 1.6)) * lift;
    }
  fogField = { w, h, data };
}
