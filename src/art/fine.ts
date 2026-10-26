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

// Each picture is read into runs once ([letter, row, from, length]) and
// kept, since art drawn through cached() is drawn (recorded) every frame.
type Runs = { ch: string; r: number; x: number; n: number }[];
const compiled = new WeakMap<readonly string[], [Runs | null, Runs | null]>();
function runsOf(rows: readonly string[], flip: boolean): Runs {
  let pair = compiled.get(rows);
  if (!pair) compiled.set(rows, (pair = [null, null]));
  const k = flip ? 1 : 0;
  const have = pair[k];
  if (have) return have;
  const out: Runs = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const n = row.length;
    let run = -1, ch = '.';
    for (let i = 0; i <= n; i++) {
      const c = i < n ? (flip ? row[n - 1 - i] : row[i]) : '.';
      if (c === ch) continue;
      if (ch !== '.' && run >= 0) out.push({ ch, r, x: run, n: i - run });
      ch = c;
      run = i;
    }
  }
  pair[k] = out;
  return out;
}

// Draw `rows` with its top-left at fine (X, Y). `map` recolours letters
// (night glass, a chosen trim); `flip` mirrors it.
export function grid(fg: CanvasRenderingContext2D, rows: readonly string[], X: number, Y: number, map?: Record<string, string>, flip = false) {
  let last = '';
  for (const run of runsOf(rows, flip)) {
    const col = map?.[run.ch] ?? FC[run.ch];
    if (col !== last) fg.fillStyle = last = col;
    fg.fillRect(X + run.x, Y + run.r, run.n, 1);
  }
}

// The same, anchored at the middle of its bottom row (a foot on the ground).
export function gridAt(fg: CanvasRenderingContext2D, rows: readonly string[], X: number, B: number, map?: Record<string, string>, flip = false) {
  grid(fg, rows, X - (rows[0].length >> 1), B - rows.length + 1, map, flip);
}
