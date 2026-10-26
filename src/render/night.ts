import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { PX, makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';
import { quality } from '../gfx/quality';

export interface Light {
  x: number; // screen coords
  y: number;
  r: number;
  warm?: boolean; // a flame: its pool ends in a dithered buttercup ring
}

// Everything that changes the light, in one ordered-dither pass so the
// screen stays inside the palette:
// - dusk and night: plum, anchored to the world so it does not crawl as the
//   camera moves; lights cut soft-edged holes, a little wider than tall
//   because the ground is seen at a slant; `slope` darkens one side of the
//   screen (dawn and dusk come from one side);
// - overcast and wet weather: a few more plum pixels everywhere;
// - fog: a wool (sage at night) veil, thin round the dog and the lamps,
//   thick towards the edges of the screen, drifting in wisps;
// - lightning: a frame of wool and buttercup over everything.
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

export class NightOverlay {
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  private W = 0;
  private H = 0;
  private wisps = tileNoise(16, 911);
  // Per-pixel scratch, kept between frames: each light's hole is stamped
  // only over its own box, not tested at every pixel of the screen.
  private hole = new Float64Array(1);
  private warm = new Float32Array(1); // how strongly a lamp's ring glows here
  private exs = new Float32Array(1);
  private col = new Float32Array(1);

  constructor() {
    [this.c, this.g] = makeCanvas(1, 1);
    this.img = this.g.createImageData(1, 1);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  // The light is worked out per world pixel (W x H); the dither is laid in
  // fine pixels (PX x PX each), so it is twice as fine as the world.
  // (At MEDIUM and LOW, gfx/quality.ts, the dither is laid in world pixels:
  // a quarter of the work.)
  private d = 0;
  private ensure(W: number, H: number, d: number) {
    if (W === this.W && H === this.H && d === this.d) return;
    this.W = W;
    this.H = H;
    this.d = d;
    this.c.width = W * d;
    this.c.height = H * d;
    this.img = this.g.createImageData(W * d, H * d);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.hole = new Float64Array(W * H);
    this.warm = new Float32Array(W * H);
    this.exs = new Float32Array(W);
    this.col = new Float32Array(W);
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, o: SkyOpts) {
    const base = o.dark < 1 / 16 ? 0 : o.dark * 16;
    const over = o.overcast ?? 0, fog = (o.fog ?? 0) * 16, flash = o.flash ?? 0;
    if (base <= 0 && over < 0.5 && fog < 0.5 && flash <= 0) return;
    const d = quality.fineSky ? PX : 1;
    this.ensure(W, H, d);
    const blue = o.blue ?? 0, teal = U32.teal;
    const buf = this.buf, plum = U32.plum, fogCol = o.fogNight ? U32.sage : U32.wool, wool = U32.wool, butter = U32.butter;
    const slope = o.slope ?? 0;
    const L = o.lights.filter((l) => l.x + l.r > 0 && l.x - l.r < W && l.y + l.r > 0 && l.y - l.r < H);
    const SY = 1 / 0.78;
    const WT = this.wisps;
    const fx = Math.floor(o.fogX ?? 0);
    const hw = W / 2, hh = H / 2;
    const exs = this.exs;
    for (let x = 0; x < W; x++) exs[x] = ((x - hw) / hw) ** 2;
    const hole = this.hole, warm = this.warm;
    const anyWarm = base > 0 && L.some((l) => l.warm);
    if (L.length) {
      hole.fill(0);
      if (anyWarm) warm.fill(0);
      for (const l of L) {
        const ry = l.r / SY, r2 = l.r * l.r;
        const x0 = Math.max(0, Math.floor(l.x - l.r)), x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
        const y0 = Math.max(0, Math.floor(l.y - ry)), y1 = Math.min(H - 1, Math.ceil(l.y + ry));
        for (let y = y0; y <= y1; y++) {
          const dy = (y - l.y) * SY, dy2 = dy * dy;
          for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
            const dx = x - l.x, d2 = dx * dx + dy2;
            if (d2 < r2) {
              const k = 1 - Math.sqrt(d2) / l.r;
              const h = Math.min(1, k * 1.8);
              if (h > hole[i]) hole[i] = h;
              // The edge of a lamp's pool: a ring of warm light falling off.
              if (l.warm && k < 0.34) {
                const r = 1 - Math.abs(k - 0.17) / 0.17;
                if (r > warm[i]) warm[i] = r;
              }
            }
          }
        }
      }
    }
    const M = NS - 1; // NS is a power of two: & wraps negatives too
    const FW = W * d;
    // The night's level down each column (dawn and dusk come from one side).
    const col = this.col;
    for (let x = 0; x < W; x++) col[x] = base > 0 ? base * (1 + slope * (0.5 - x / W) * 2) : 0;
    // Plain darkness (no fog, flash, warm rings or blue hour) is most of a
    // night: those pixels take the short way.
    const plain = flash <= 0 && fog <= 0 && !anyWarm && blue <= 0;
    const B = BAYER4;
    for (let y = 0; y < H; y++) {
      const wy = y + oy;
      const ey = ((y - hh) / hh) ** 2;
      // The Bayer rows of this world row's fine pair (or its one row).
      const by = d === 1 ? (wy & 3) * 4 : (wy & 1) * 8;
      const o0 = y * d * FW;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let dark = col[x];
        let f = 0;
        if (fog > 0) {
          const n = WT[((x + ox - fx) & M) + ((wy >> 1) & M) * NS] / 255;
          f = fog * (0.25 + 0.55 * Math.min(1, exs[x] + ey)) * (0.5 + 0.8 * n);
        }
        if (L.length && (dark > 0 || f > 0)) {
          const h = hole[i];
          if (h > 0) {
            dark -= 16 * h;
            f *= 1 - h;
          }
        }
        let level = over;
        if (dark > 0) level += dark;
        const o = o0 + x * d;
        if (d === 1) {
          const thr = B[by + ((x + ox) & 3)];
          if (plain) buf[o] = thr < level ? plum : 0;
          else {
            if (dark > 0 && level + f > 10) f = Math.max(0, 10 - level);
            const blueAt = blue > 0 && dark > 0 ? level * (1 - blue * 0.7) : Infinity;
            buf[o] = thr < flash ? (thr < flash * 0.3 ? butter : wool) : thr < level ? (thr >= blueAt ? teal : plum) : anyWarm && thr < warm[i] * 3.2 ? butter : thr < level + f ? fogCol : 0;
          }
          continue;
        }
        const k = by + ((x + ox) & 1) * 2;
        // The four fine pixels, each with its own threshold (anchored to the
        // world, in fine pixels, so the dither does not crawl).
        if (plain) {
          buf[o] = B[k] < level ? plum : 0;
          buf[o + 1] = B[k + 1] < level ? plum : 0;
          buf[o + FW] = B[k + 4] < level ? plum : 0;
          buf[o + FW + 1] = B[k + 5] < level ? plum : 0;
          continue;
        }
        // Night and fog together never cover more than ~2/3 of the pixels,
        // so the ground still reads between them.
        if (dark > 0 && level + f > 10) f = Math.max(0, 10 - level);
        const blueAt = blue > 0 && dark > 0 ? level * (1 - blue * 0.7) : Infinity;
        const warmAt = anyWarm ? warm[i] * 3.2 : 0;
        const lf = level + f;
        for (let j = 0; j < 4; j++) {
          const thr = B[k + (j >> 1) * 4 + (j & 1)];
          buf[o + (j >> 1) * FW + (j & 1)] =
            thr < flash ? (thr < flash * 0.3 ? butter : wool) : thr < level ? (thr >= blueAt ? teal : plum) : thr < warmAt ? butter : thr < lf ? fogCol : 0;
        }
      }
    }
    this.g.putImageData(this.img, 0, 0);
    g.drawImage(this.c, 0, 0, W, H);
  }
}
