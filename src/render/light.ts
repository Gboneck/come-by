import { C } from '../palette';
import { makeCanvas } from '../gfx/screen';
import type { Baked } from '../world/terrain';

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
