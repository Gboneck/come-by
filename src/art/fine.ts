import { C } from '../palette';

// Pixel pictures on the fine grid: rows of palette letters, one fine pixel
// each ('.' is clear). Drawn as runs, so a picture is a few rects a row
// rather than one per pixel (art drawn through cached() is recorded every
// frame, so fewer calls is cheaper).
export const FC: Record<string, string> = {
  m: C.meadow,
  o: C.moss,
  s: C.sage,
  t: C.teal,
  p: C.plum,
  w: C.wool,
  y: C.butter,
};

// Draw `rows` with its top-left at fine (X, Y). `map` recolours letters
// (night glass, a chosen trim); `flip` mirrors it.
export function grid(fg: CanvasRenderingContext2D, rows: readonly string[], X: number, Y: number, map?: Record<string, string>, flip = false) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const n = row.length;
    let run = -1, ch = '.';
    for (let k = 0; k <= n; k++) {
      const c = k < n ? (flip ? row[n - 1 - k] : row[k]) : '.';
      if (c === ch) continue;
      if (ch !== '.' && run >= 0) {
        fg.fillStyle = map?.[ch] ?? FC[ch];
        fg.fillRect(X + run, Y + r, k - run, 1);
      }
      ch = c;
      run = k;
    }
  }
}

// The same, anchored at the middle of its bottom row (a foot on the ground).
export function gridAt(fg: CanvasRenderingContext2D, rows: readonly string[], X: number, B: number, map?: Record<string, string>, flip = false) {
  grid(fg, rows, X - (rows[0].length >> 1), B - rows.length + 1, map, flip);
}
