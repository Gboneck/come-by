import { C } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { fine, makeCanvas } from '../gfx/screen';

// Moonlight on edges at night: roof ridges, fence rails and the canopy's
// clumps catch a cool glint that shows through the dark. Art adds
// its top edges (world-fine pixels) as it draws, when `moon.on` (set once a
// frame by render/world.ts); they are drawn above the night overlay as a
// dither of wool and teal, stronger the darker it is.

export const moon = { on: 0, flash: 0 };
const segs: number[] = []; // x, y, length (horizontal runs, world-fine px)

export function moonEdge(fx: number, fy: number, len: number) {
  if (moon.on > 0 && len > 0) segs.push(fx, fy, len);
}

export function moonFrame(on: number, flash: number) {
  moon.on = on;
  moon.flash = flash;
  segs.length = 0;
}

// Draw what was gathered this frame (the frame's transform has no
// translation; ox, oy are the view's corner in world px). Each run is one
// image: a slice of a strip already dithered at this frame's strength, cut
// at the run's own place in the 4x4 pattern.
const STRIP = 512;
let strip: HTMLCanvasElement | null = null, stripLv = -1;
export function drawMoonEdges(g: CanvasRenderingContext2D, ox: number, oy: number, PX: number) {
  if (!segs.length) return;
  const lv = moon.flash ? 16 : Math.round(4 + moon.on * 8); // of 16
  if (lv !== stripLv || !strip) {
    const [c, cg] = strip ? [strip, strip.getContext('2d')!] : makeCanvas(STRIP + 4, 4);
    cg.clearRect(0, 0, STRIP + 4, 4);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < STRIP + 4; x++) {
        const t = BAYER4[y * 4 + (x & 3)];
        if (t >= lv) continue;
        cg.fillStyle = t < lv * 0.4 ? C.wool : C.teal;
        cg.fillRect(x, y, 1, 1);
      }
    strip = c;
    stripLv = lv;
  }
  // Runs on the same row that touch (or nearly: a rail past a post) are
  // drawn as one.
  const order: number[] = [];
  for (let k = 0; k < segs.length; k += 3) order.push(k);
  order.sort((a, b) => segs[a + 1] - segs[b + 1] || segs[a] - segs[b]);
  const s = strip;
  fine(g, (fg) => {
    const X0 = ox * PX, Y0 = oy * PX;
    const put = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i += STRIP) {
        const w = Math.min(STRIP, n - i);
        fg.drawImage(s, (x + i) & 3, y & 3, w, 1, x + i - X0, y - Y0, w, 1);
      }
    };
    let rx = 0, ry = 0, re = -1; // the run being gathered (none while re < 0)
    for (const k of order) {
      const x = segs[k], y = segs[k + 1], e = x + segs[k + 2];
      if (re >= 0 && y === ry && x <= re + 3) re = Math.max(re, e);
      else {
        if (re >= 0) put(rx, ry, re - rx);
        rx = x;
        ry = y;
        re = e;
      }
    }
    if (re >= 0) put(rx, ry, re - rx);
  });
}
