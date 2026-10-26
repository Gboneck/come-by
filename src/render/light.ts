import { C } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { makeCanvas } from '../gfx/screen';
import { WORLD_H, WORLD_W } from '../world/map';
import type { Baked } from '../world/terrain';

// Shafts of low sun slanting through the canopy at golden hour and in the
// early morning: narrow bands along the light's direction where the leaves
// catch it, a sparse dither of buttercup and wool over the treetops. Only
// the pixels inside the bands are visited, so it costs little.
export function drawShafts(g: CanvasRenderingContext2D, baked: Baked, ox: number, oy: number, W: number, H: number, dx: number, dy: number, strength: number, t: number) {
  if (strength < 0.15) return;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  if (ny < 0.2) return;
  const kind = baked.canopyKind;
  const SPACE = 64, WIDE = 5;
  const shift = (t * 3) % SPACE;
  const lv = 2 + strength * 3;
  for (let y = 0; y < H; y++) {
    const wy = y + oy;
    if (wy < 0 || wy >= WORLD_H) continue;
    // u = x*ny - y*nx is constant along the light; bands of u are shafts.
    const uMin = 0 * ny - wy * nx, uMax = WORLD_W * ny - wy * nx;
    for (let k = Math.floor((Math.min(uMin, uMax) - shift) / SPACE); k * SPACE + shift < Math.max(uMin, uMax); k++) {
      const u0 = k * SPACE + shift + (((k * 37) % 11) - 5);
      const xa = Math.ceil((u0 + wy * nx) / ny), xb = Math.floor((u0 + WIDE + wy * nx) / ny);
      for (let wx = Math.max(xa, ox); wx <= Math.min(xb, ox + W - 1); wx++) {
        if (wx < 0 || wx >= WORLD_W || !kind[wy * WORLD_W + wx]) continue;
        const thr = BAYER4[(wy & 3) * 4 + (wx & 3)];
        if (thr >= lv) continue;
        g.fillStyle = thr < 1 ? C.wool : C.butter;
        g.fillRect(wx - ox, y, 1, 1);
      }
    }
  }
}

// The ground with the trees' shadows on it, moving with the sun: the
// canopy's silhouette (baked once in sage) laid over the ground shifted by
// the sun's vector, long to the west at sunrise, short at noon, long to the
// east in the golden hour. Composed into one world-sized picture, so a frame
// draws the ground as one image as it always did. When the sun moves a
// pixel the picture is redone a strip at a time over the next frames (the
// strips differ by a pixel, which no one can see); a new season's ground is
// redone at once.
const STRIP = 32;

export class LitGround {
  private c: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private src: HTMLCanvasElement | null = null;
  private key = '';
  private row = 0;
  private dx = 0;
  private dy = 0;

  picture(baked: Baked, src: HTMLCanvasElement, dx: number, dy: number, sun: boolean): HTMLCanvasElement {
    if (!this.c) {
      [this.c, this.g] = makeCanvas(WORLD_W, WORLD_H);
      this.src = null;
    }
    const key = sun ? `${dx},${dy}` : 'none';
    if (src !== this.src) {
      this.src = src;
      this.key = key;
      this.set(dx, dy, sun);
      this.strips(baked, WORLD_H);
    } else if (key !== this.key) {
      this.key = key;
      this.set(dx, dy, sun);
    }
    if (this.row < WORLD_H) this.strips(baked, STRIP);
    return this.c!;
  }

  private set(dx: number, dy: number, sun: boolean) {
    this.dx = sun ? dx : 1e5; // far off: no shadow
    this.dy = sun ? dy : 1e5;
    this.row = 0;
  }

  private strips(baked: Baked, rows: number) {
    const g = this.g!, W = WORLD_W, H = WORLD_H;
    const y0 = this.row, y1 = Math.min(H, y0 + rows);
    g.drawImage(this.src!, 0, y0, W, y1 - y0, 0, y0, W, y1 - y0);
    const dx = this.dx, dy = this.dy;
    const ax = Math.max(0, dx), bx = Math.min(W, W + dx), ay = Math.max(y0, dy), by = Math.min(y1, H + dy);
    if (bx > ax && by > ay) g.drawImage(baked.canopyShadow, ax - dx, ay - dy, bx - ax, by - ay, ax, ay, bx - ax, by - ay);
    this.row = y1;
  }
}
