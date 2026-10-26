import { C } from '../palette';
import { panel } from './frame';
import { text } from '../gfx/font';
import type { Game } from '../game';

// "LABEL   < VALUE >" rows for the look and ranch screens. A tap on the
// left arrow steps back, anywhere else on the row steps on; left/right keys
// do the same for the selected row.
export function optionRow(game: Game, g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, label: string, value: string, sel: boolean, step: (d: -1 | 1) => void): boolean {
  const ui = game.ui;
  const hot = ui.isActive(`${id}-l`) || ui.isActive(`${id}-r`);
  panel(g, x, y, w, h, sel || hot ? C.teal : C.plum, sel ? C.butter : C.sage);
  const ty = y + Math.floor((h - 5) / 2);
  text(g, label, x + 4, ty, C.sage);
  const vx = x + Math.round(w * 0.42);
  text(g, '<', vx, ty, sel ? C.butter : C.sage);
  text(g, '>', x + w - 7, ty, sel ? C.butter : C.sage);
  text(g, value, Math.round((vx + 4 + x + w - 7) / 2), ty, C.wool, { align: 'center' });
  const p = game.input.touchMode ? 2 : 0;
  if (ui.click(`${id}-l`, vx - 6, y - p, 16, h + p * 2)) { step(-1); return true; }
  if (ui.click(`${id}-r`, x - p, y - p, w + p * 2, h + p * 2)) { step(1); return true; }
  return ui.hovering(x, y, w, h);
}

export function cycle<T>(list: readonly T[], v: T, d: number): T {
  const i = list.indexOf(v);
  return list[(i + d + list.length) % list.length];
}
