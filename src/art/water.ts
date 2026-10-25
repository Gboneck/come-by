import { U32 } from '../palette';
import { hash2 } from '../rng';
import { makeCanvas } from '../gfx/screen';

// Animated water: a loop of sparse wool highlights laid over the baked water
// for one body of water. The river carries little dashes downstream and
// ripples round the stepping stones; still water glints and twinkles.

export const WATER_FRAMES = 16;
export const WATER_FPS = 8;

export interface WaterAnim {
  x: number;
  y: number;
  w: number;
  h: number;
  frames: HTMLCanvasElement[];
}

export interface WaterSrc {
  W: number; // world width (stride of the masks)
  water: Uint8Array;
  deep: Uint8Array;
  wdist: Uint8Array; // distance from the bank, inside the water
  ground: Uint32Array; // baked ground colours
  skip: Uint8Array; // lily pads, stones: never highlighted
}

// A highlight that drifts `speed` px per frame along y and lives `life`
// frames out of the loop. One per grid cell (if the cell has one at all).
function drifting(x: number, y: number, f: number, cw: number, ch: number, p: number, maxLen: number, life: number, speed: number, seed: number): boolean {
  const cx = Math.floor(x / cw);
  const cy0 = Math.floor(y / ch);
  const reach = Math.ceil((life * speed) / ch) + 1;
  for (let cy = cy0; cy >= cy0 - reach; cy--) {
    if (hash2(cx, cy, seed) > p) continue;
    const ph = (f + Math.floor(hash2(cx, cy, seed + 1) * WATER_FRAMES)) % WATER_FRAMES;
    if (ph >= life) continue;
    const by = cy * ch + Math.floor(hash2(cx, cy, seed + 2) * (ch - 2)) + ph * speed;
    if (y !== by) continue;
    const bx = cx * cw + Math.floor(hash2(cx, cy, seed + 3) * Math.max(1, cw - maxLen));
    const len = ph < 2 || ph > life - 3 ? 1 : maxLen - (hash2(cx, cy, seed + 4) < 0.5 ? 1 : 0);
    if (x >= bx && x < bx + len) return true;
  }
  return false;
}

// A glint that grows and shrinks in place (still water).
const GLINT = [1, 2, 3, 3, 2, 1];
function glint(x: number, y: number, f: number, seed: number): boolean {
  const cw = 8, ch = 5;
  const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
  if (hash2(cx, cy, seed) > 0.4) return false;
  const ph = (f + Math.floor(hash2(cx, cy, seed + 1) * WATER_FRAMES)) % WATER_FRAMES;
  if (ph >= GLINT.length) return false;
  const len = GLINT[ph];
  const bx = cx * cw + 2 + Math.floor(hash2(cx, cy, seed + 2) * 3) - (len >> 1);
  const by = cy * ch + 1 + Math.floor(hash2(cx, cy, seed + 3) * 3);
  return y === by && x >= bx && x < bx + len;
}

export function makeWaterAnim(src: WaterSrc, x0: number, y0: number, w: number, h: number, flowing: boolean, stones: { x: number; y: number }[]): WaterAnim {
  const { W, water, deep, wdist, ground, skip } = src;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    const [c, g] = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    for (let yy = 0; yy < h; yy++) {
      const y = y0 + yy;
      for (let xx = 0; xx < w; xx++) {
        const x = x0 + xx;
        const i = y * W + x;
        if (!water[i] || skip[i] || ground[i] === U32.plum) continue;
        let on = false;
        const wd = wdist[i];
        if (flowing) {
          if (deep[i]) on = drifting(x, y, f, 6, 10, 0.5, 3, 10, 1, 300);
          else on = drifting(x, y, f, 4, 7, 0.45, 2, 6, 2, 320);
          // Foam flickering along the banks.
          if (!on && wd === 1) on = hash2(x, y, 340) < 0.3 && (Math.floor(hash2(x, y, 341) * 8) + f) % 8 < 2;
        } else {
          on = deep[i] ? glint(x, y, f, 360) : hash2(x, y, 370) < 0.04 && (Math.floor(hash2(x, y, 371) * 16) + f) % 16 < 2;
        }
        if (on) buf[yy * w + xx] = U32.wool;
      }
    }
    // Rings spreading near the banks, where insects touch down by the reeds.
    for (let cy = Math.floor(y0 / 9); cy * 9 < y0 + h; cy++)
      for (let cx = Math.floor(x0 / 11); cx * 11 < x0 + w; cx++) {
        if (hash2(cx, cy, 380) > 0.3) continue;
        const px = cx * 11 + Math.floor(hash2(cx, cy, 381) * 11), py = cy * 9 + Math.floor(hash2(cx, cy, 382) * 9);
        if (px < x0 || py < y0 || px >= x0 + w || py >= y0 + h) continue;
        const wd = wdist[py * W + px];
        if (!water[py * W + px] || wd < 2 || wd > (flowing ? 3 : 5)) continue;
        const ph = (f + Math.floor(hash2(cx, cy, 383) * WATER_FRAMES)) % WATER_FRAMES;
        if (ph >= 6) continue;
        const r = 1 + (ph >> 1), ry = Math.max(1, r >> 1);
        for (let a = 0; a < 12; a++) {
          if (ph >= 4 && a % 2) continue;
          const ang = (a / 12) * Math.PI * 2;
          const x = Math.round(px + Math.cos(ang) * r), y = Math.round(py + Math.sin(ang) * ry);
          const xx = x - x0, yy = y - y0;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const i = y * W + x;
          if (water[i] && !skip[i] && ground[i] !== U32.plum) buf[yy * w + xx] = U32.wool;
        }
      }
    // Ripples trailing downstream of each stepping stone.
    for (const s of stones) {
      const k = (f >> 1) % 4;
      const put = (x: number, y: number) => {
        const xx = x - x0, yy = y - y0;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
        const i = y * W + x;
        if (water[i] && !skip[i]) buf[yy * w + xx] = U32.wool;
      };
      if (k < 3) {
        put(s.x - k, s.y + 3 + k);
        put(s.x + 3 + k, s.y + 3 + k);
      }
      if ((f & 3) === 0) put(s.x + 1 + ((f >> 2) & 1), s.y - 1);
    }
    g.putImageData(img, 0, 0);
    frames.push(c);
  }
  return { x: x0, y: y0, w, h, frames };
}
