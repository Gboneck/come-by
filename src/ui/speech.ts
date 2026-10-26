import { C } from '../palette';
import { rect } from '../gfx/draw';
import { panel } from './frame';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import type { View } from '../render/world';

// Speech bubbles over the townsfolk, in the pixel font: wool with a plum
// rim and a little tail down to whoever is talking. Drawn above the canopy
// and the night, under the HUD; kept on screen at the edges.
export function drawSpeech(game: Game, g: CanvasRenderingContext2D, v: View) {
  for (const p of game.folk.people) {
    const b = p.bubble;
    if (!b || !p.shown) continue;
    const lines = wrap(b.text, 66);
    const w = Math.max(...lines.map((l) => textWidth(l))) + 6;
    const h = lines.length * 7 + 3;
    const sx = Math.round(p.x - v.ox), sy = Math.round(p.y - v.oy);
    // Pop up from the head over the first few frames.
    const rise = Math.min(1, b.t / 0.08);
    const x = Math.max(2, Math.min(v.W - w - 2, sx - Math.floor(w / 2)));
    const y = Math.max(2, Math.round(sy - 17 - h + (1 - rise) * 3));
    panel(g, x, y, w, h, C.wool, C.plum);
    lines.forEach((l, i) => text(g, l, x + 3, y + 2 + i * 7, C.plum));
    // The tail.
    const tx = Math.max(x + 3, Math.min(x + w - 4, sx));
    rect(g, tx - 1, y + h - 1, 3, 1, C.wool);
    rect(g, tx - 2, y + h - 1, 1, 1, C.plum);
    rect(g, tx + 2, y + h - 1, 1, 1, C.plum);
    rect(g, tx - 1, y + h, 1, 1, C.plum);
    rect(g, tx, y + h, 1, 1, C.wool);
    rect(g, tx + 1, y + h, 1, 1, C.plum);
    rect(g, tx, y + h + 1, 1, 1, C.plum);
  }
}

function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next) > max) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
