import { C } from '../palette';
import { px } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
import { Pen, type Rot } from '../ranch/buildings';
import type { Ranch } from '../ranch/ranch';
import { TS } from '../world/map';

// Build mode: the drove road's edges (nothing may be built on it), and
// which way a pen's gate opens.

// Both on the fine grid (two fine pixels to a world pixel).
export function drawRoad(g: CanvasRenderingContext2D, ranch: Ranch, t0x: number, t0y: number, t1x: number, t1y: number, t: number) {
  const on = (x: number, y: number) => ranch.onRoad(x, y);
  const shift = Math.floor(t * 8) % 8; // the dashes creep along, like a drove
  const N = TS * PX;
  fine(g, (fg) => {
    fg.fillStyle = C.butter;
    for (let ty = t0y; ty < t1y; ty++)
      for (let tx = t0x; tx < t1x; tx++) {
        if (!on(tx, ty)) continue;
        const X = tx * N, Y = ty * N;
        for (let i = 0; i < N; i += 2) {
          if ((i + shift) % 8 >= 4) continue;
          if (!on(tx, ty - 1)) fg.fillRect(X + i, Y, 2, 1);
          if (!on(tx, ty + 1)) fg.fillRect(X + i, Y + N - 1, 2, 1);
          if (!on(tx - 1, ty)) fg.fillRect(X, Y + i, 1, 2);
          if (!on(tx + 1, ty)) fg.fillRect(X + N - 1, Y + i, 1, 2);
        }
      }
  });
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
  const x = Math.round((a.x + dx * bob) * PX), y = Math.round((a.y + dy * bob) * PX);
  const col = ok ? C.butter : C.wool;
  fine(g, (fg) => {
    // A plum-edged shaft and head (head points out of the pen).
    const at = (i: number, j: number, c: string) => px(fg, x + dx * i - dy * j, y + dy * i + dx * j, c);
    for (let i = -1; i < 10; i++) for (const j of [-2, 2]) at(i, j, C.plum);
    for (let i = 0; i < 9; i++) for (const j of [-1, 0, 1]) at(i, j, col);
    for (let k = 1; k <= 5; k++) for (let j = -k; j <= k; j++) at(9 + 5 - k, j, Math.abs(j) === k ? C.plum : col);
  });
}
