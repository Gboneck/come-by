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

// The trees' shadows, moving with the sun: the canopy's silhouette, shifted
// by the sun's vector, laid over the ground in sage (and in plum where it
// falls on water). Long and to the west at sunrise, short at noon, long to
// the east in the golden hour. Two small screen-sized canvases and a few
// drawImage calls a frame: no per-pixel work.
export class SunShadows {
  private s1: [HTMLCanvasElement, CanvasRenderingContext2D] = makeCanvas(1, 1);
  private s2: [HTMLCanvasElement, CanvasRenderingContext2D] = makeCanvas(1, 1);

  private fit(W: number, H: number) {
    for (const s of [this.s1, this.s2])
      if (s[0].width !== W || s[0].height !== H) {
        s[0].width = W;
        s[0].height = H;
        s[1].imageSmoothingEnabled = false;
      }
  }

  draw(g: CanvasRenderingContext2D, baked: Baked, ox: number, oy: number, W: number, H: number, dx: number, dy: number) {
    this.fit(W, H);
    const [c1, g1] = this.s1;
    g1.globalCompositeOperation = 'source-over';
    g1.clearRect(0, 0, W, H);
    // The screen pixel (x, y) is in shadow if the canopy is at (x - dx, y - dy).
    g1.drawImage(baked.canopy, ox - dx, oy - dy, W, H, 0, 0, W, H);
    g1.globalCompositeOperation = 'source-in';
    g1.fillStyle = C.sage;
    g1.fillRect(0, 0, W, H);
    g1.globalCompositeOperation = 'source-over';
    g.drawImage(c1, 0, 0);
    // Where it falls on water, plum.
    const m = baked.waterMask;
    if (m.x < ox + W && m.x + m.c.width > ox && m.y < oy + H && m.y + m.c.height > oy) {
      const [c2, g2] = this.s2;
      g2.globalCompositeOperation = 'source-over';
      g2.clearRect(0, 0, W, H);
      g2.drawImage(m.c, m.x - ox, m.y - oy);
      g2.globalCompositeOperation = 'destination-in';
      g2.drawImage(c1, 0, 0);
      g2.globalCompositeOperation = 'source-over';
      g.drawImage(c2, 0, 0);
    }
  }
}
