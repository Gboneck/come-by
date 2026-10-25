import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';

export interface Light {
  x: number; // screen coords
  y: number;
  r: number;
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

  constructor() {
    [this.c, this.g] = makeCanvas(1, 1);
    this.img = this.g.createImageData(1, 1);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  private ensure(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.c.width = W;
    this.c.height = H;
    this.img = this.g.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, o: SkyOpts) {
    const base = o.dark < 1 / 16 ? 0 : o.dark * 16;
    const over = o.overcast ?? 0, fog = (o.fog ?? 0) * 16, flash = o.flash ?? 0;
    if (base <= 0 && over < 0.5 && fog < 0.5 && flash <= 0) return;
    this.ensure(W, H);
    const buf = this.buf, plum = U32.plum, fogCol = o.fogNight ? U32.sage : U32.wool, wool = U32.wool, butter = U32.butter;
    const slope = o.slope ?? 0;
    const L = o.lights.filter((l) => l.x + l.r > 0 && l.x - l.r < W && l.y + l.r > 0 && l.y - l.r < H);
    const SY = 1 / 0.78;
    const WT = this.wisps;
    const fx = Math.floor(o.fogX ?? 0);
    const hw = W / 2, hh = H / 2;
    for (let y = 0; y < H; y++) {
      const by = ((y + oy) & 3) * 4;
      const wy = y + oy;
      const ey = ((y - hh) / hh) ** 2;
      for (let x = 0; x < W; x++) {
        const thr = BAYER4[by + ((x + ox) & 3)];
        const i = y * W + x;
        if (thr < flash) {
          buf[i] = thr < flash * 0.3 ? butter : wool;
          continue;
        }
        let dark = base > 0 ? base * (1 + slope * (0.5 - x / W) * 2) : 0;
        let level = over;
        const wx = x + ox;
        let f = 0;
        if (fog > 0) {
          const ex = ((x - hw) / hw) ** 2;
          const n = WT[((((wx - fx) % NS) + NS) % NS) + ((((wy >> 1) % NS) + NS) % NS) * NS] / 255;
          f = fog * (0.25 + 0.55 * Math.min(1, ex + ey)) * (0.5 + 0.8 * n);
        }
        if ((dark > 0 || f > 0) && L.length) {
          let hole = 0;
          for (let k = 0; k < L.length; k++) {
            const l = L[k];
            const dx = x - l.x, dy = (y - l.y) * SY;
            const d2 = dx * dx + dy * dy;
            if (d2 < l.r * l.r) hole = Math.max(hole, Math.min(1, (1 - Math.sqrt(d2) / l.r) * 1.8));
          }
          if (hole > 0) {
            dark -= 16 * hole;
            f *= 1 - hole;
          }
        }
        if (dark > 0) level += dark;
        // Night and fog together never cover more than ~2/3 of the pixels,
        // so the ground still reads between them.
        if (dark > 0 && level + f > 10) f = Math.max(0, 10 - level);
        buf[i] = thr < level ? plum : thr < level + f ? fogCol : 0;
      }
    }
    this.g.putImageData(this.img, 0, 0);
    g.drawImage(this.c, 0, 0);
  }
}
