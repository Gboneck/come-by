import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Drawable } from './buildings';
import { penDrawables } from './paddock';
import type { Game } from '../game';
import { isFairDay } from '../systems/seasonal';

// The show ring on the Show Ground and its rosettes. (Gameplay drew this;
// Graphics may polish it.) On fair day the board lights and pennants fly
// from the corner posts; each kind judged hangs its rosette on the east rail.

const ROSETTE = [C.butter, C.wool, C.teal, C.sage];

function rosette(g: CanvasRenderingContext2D, x: number, y: number, col: string) {
  rect(g, x - 1, y - 1, 3, 3, col);
  px(g, x, y, C.plum);
  px(g, x - 1, y + 2, col);
  px(g, x + 1, y + 2, col);
  px(g, x - 1, y + 3, col);
  px(g, x + 1, y + 3, col);
}

function pennant(g: CanvasRenderingContext2D, x: number, y: number, col: string, t: number) {
  rect(g, x, y - 12, 1, 12, C.plum);
  const flap = Math.floor(t * 3 + x) % 2;
  rect(g, x + 1, y - 12, 3, 1, col);
  rect(g, x + 1, y - 11, 2 + flap, 1, col);
  px(g, x + 1, y - 10, col);
}

export function fairDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const p = game.ranch.ring.pen;
  const { ox, oy, W, H } = game.view();
  if (p.x1 < ox - 40 || p.x0 > ox + W + 40 || p.y1 < oy - 40 || p.y0 > oy + H + 40) return [];
  const t = game.t;
  const on = isFairDay(game);
  const out = penDrawables(g, p, t, false);
  const label = on ? 'JUDGING TODAY' : 'SHOW RING';
  // The board stands below the ring (the gate is in the north fence).
  const bx = Math.round(p.cx), by = p.y1 + 12;
  out.push({
    y: by,
    draw: () => {
      const w = textWidth(label) + 4, l = bx - Math.floor(w / 2);
      rect(g, l, by - 10, w, 9, C.plum);
      rect(g, l + 1, by - 9, w - 2, 7, on ? C.butter : C.wool);
      rect(g, l + 2, by - 1, 1, 2, C.plum);
      rect(g, l + w - 3, by - 1, 1, 2, C.plum);
      text(g, label, bx, by - 8, C.plum, { align: 'center' });
    },
  });
  if (on) {
    const cols = [C.butter, C.teal, C.wool, C.butter];
    [[p.x0 + 1, p.y0 + 8], [p.x1 - 2, p.y0 + 8], [p.x0 + 1, p.y1], [p.x1 - 2, p.y1]].forEach(([x, y], i) =>
      out.push({ y, draw: () => pennant(g, x, y, cols[i], t) }));
  }
  game.seasonal.fair.forEach((e, i) => {
    const x = p.x1 + 2, y = p.y0 + 12 + i * 7;
    out.push({ y: y + 4, draw: () => rosette(g, x, y, ROSETTE[Math.min(3, e.place - 1)]) });
  });
  return out;
}
