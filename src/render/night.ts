import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { makeCanvas } from '../gfx/screen';

export interface Light {
  x: number; // screen coords
  y: number;
  r: number;
}

// Dusk and night: an ordered dither of plum pixels anchored to the world so
// it does not crawl as the camera moves. Lights cut soft-edged holes, a
// little wider than tall because the ground is seen at a slant. `slope`
// darkens one side of the screen (dawn and dusk come from one side).
export class NightOverlay {
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  private W = 0;
  private H = 0;

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

  draw(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, darkness: number, lights: Light[], slope = 0) {
    if (darkness < 1 / 16) return;
    this.ensure(W, H);
    const buf = this.buf, plum = U32.plum;
    const base = darkness * 16;
    const L = lights.filter((l) => l.x + l.r > 0 && l.x - l.r < W && l.y + l.r > 0 && l.y - l.r < H);
    const SY = 1 / 0.78;
    for (let y = 0; y < H; y++) {
      const by = ((y + oy) & 3) * 4;
      for (let x = 0; x < W; x++) {
        let level = base * (1 + slope * (0.5 - x / W) * 2);
        for (let i = 0; i < L.length; i++) {
          const l = L[i];
          const dx = x - l.x, dy = (y - l.y) * SY;
          const d2 = dx * dx + dy * dy;
          if (d2 < l.r * l.r) {
            const k = 1 - Math.sqrt(d2) / l.r;
            level -= 16 * Math.min(1, k * 1.8);
          }
        }
        buf[y * W + x] = BAYER4[by + ((x + ox) & 3)] < level ? plum : 0;
      }
    }
    this.g.putImageData(this.img, 0, 0);
    g.drawImage(this.c, 0, 0);
  }
}
