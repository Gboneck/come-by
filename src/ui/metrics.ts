import { lineHeight, type TextSize } from '../gfx/font';
import type { Game } from '../game';

// Layout measures that follow the text and the screen. Text sizes are roles
// (gfx/font.ts): in the wide view on a phone each steps up a face, so lines
// are spaced by lineHeight, never by a fixed 6 or 7; and a finger is the
// same size in either view, so touch targets grow when world pixels shrink.

// Distance from one line of text to the next (7 for body text in the close
// view, as the layouts were first drawn).
export const pitch = (size: TextSize = 'body') => lineHeight(size) + 1;

// A one-line box: its height, and where its text's top goes in it.
export const boxH = (min: number, size: TextSize = 'body') => Math.max(min, lineHeight(size) + 5);
export const textIn = (h: number, size: TextSize = 'body') => Math.floor((h - lineHeight(size)) / 2) + 1;

// How much to enlarge touch targets so they keep their size under a finger
// (1 in the close view on a phone held upright; about 1.5 in the wide view).
export function touchScale(game: Game): number {
  const c = game.screen.cssPerFine;
  return c > 0 ? Math.max(1, Math.min(1.8, 1 / c)) : 1;
}
