import { C } from '../palette';
import { px } from '../gfx/draw';
import { Pen, type Rot } from '../ranch/buildings';
import type { Ranch } from '../ranch/ranch';
import { TS } from '../world/map';

// Build mode: the drove road's edges (nothing may be built on it), and
// which way a pen's gate opens.

export function drawRoad(g: CanvasRenderingContext2D, ranch: Ranch, t0x: number, t0y: number, t1x: number, t1y: number, t: number) {
  const on = (x: number, y: number) => ranch.onRoad(x, y);
  const shift = Math.floor(t * 4) % 4; // the dashes creep along, like a drove
  for (let ty = t0y; ty < t1y; ty++)
    for (let tx = t0x; tx < t1x; tx++) {
      if (!on(tx, ty)) continue;
      const X = tx * TS, Y = ty * TS;
      g.fillStyle = C.butter;
      for (let i = 0; i < TS; i++) {
        if ((i + shift) % 4 >= 2) continue;
        if (!on(tx, ty - 1)) g.fillRect(X + i, Y, 1, 1);
        if (!on(tx, ty + 1)) g.fillRect(X + i, Y + TS - 1, 1, 1);
        if (!on(tx - 1, ty)) g.fillRect(X, Y + i, 1, 1);
        if (!on(tx + 1, ty)) g.fillRect(X + TS - 1, Y + i, 1, 1);
      }
      // A faint wear pattern down the middle of the road.
      if ((tx + ty) % 2 === 0) px(g, X + 4, Y + 4, C.moss);
    }
}

// An arrow just outside a pen's gate, pointing the way the stock walks out.
// `size`: a paddock's size and its gate's place along the side (`at`, as in
// ranch/paddock.ts); the old 8x7 pen with a centred gate if left out.
export function drawGateMark(g: CanvasRenderingContext2D, tx: number, ty: number, rot: Rot, ok: boolean, t: number, size?: { w: number; h: number; at?: number }) {
  const p = new Pen(tx, ty, rot, size?.w, size?.h);
  if (size?.at !== undefined) p.gateAt = size.at;
  const a = p.gatePoint(5), b = p.gatePoint(11);
  const dx = Math.sign(Math.round(b.x - a.x)), dy = Math.sign(Math.round(b.y - a.y));
  const bob = Math.floor(t * 3) % 2;
  const x = Math.round(a.x + dx * bob), y = Math.round(a.y + dy * bob);
  const col = ok ? C.butter : C.wool;
  // Shaft and head (head points out of the pen).
  for (let i = 0; i < 5; i++) px(g, x + dx * i, y + dy * i, col);
  const hx = x + dx * 4, hy = y + dy * 4;
  for (let k = 1; k <= 2; k++) {
    px(g, hx - dx * k + dy * k, hy - dy * k + dx * k, col);
    px(g, hx - dx * k - dy * k, hy - dy * k - dx * k, col);
  }
}
