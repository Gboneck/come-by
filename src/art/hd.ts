import { spr, type Sprite } from '../gfx/sprite';

// Double density for the character art: grids of template letters drawn in
// fine pixels (two per world pixel).
//
// up2 is Scale2x (EPX) on letters: each pixel becomes four, and a corner
// takes its neighbours' letter where they agree, so diagonals and round
// shapes come out smooth instead of stair-stepped, and nothing new is
// invented (every letter is one that was there). The poses, gaits and
// layers built at world scale carry straight over; detail is then drawn
// over the top at fine scale (faces, eyes, coats).

export type Grid = string[];

export function up2(rows: Grid): Grid {
  const H = rows.length, W = Math.max(0, ...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y < 0 || y >= H ? '.' : rows[y][x] ?? '.');
  const out: string[][] = Array.from({ length: H * 2 }, () => Array<string>(W * 2).fill('.'));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
      let e1 = p, e2 = p, e3 = p, e4 = p;
      if (c === a && c !== d && a !== b) e1 = a;
      if (a === b && a !== c && b !== d) e2 = b;
      if (d === c && d !== b && c !== a) e3 = c;
      if (b === d && b !== a && d !== c) e4 = d;
      out[y * 2][x * 2] = e1;
      out[y * 2][x * 2 + 1] = e2;
      out[y * 2 + 1][x * 2] = e3;
      out[y * 2 + 1][x * 2 + 1] = e4;
    }
  return out.map((r) => r.join(''));
}

// Plain doubling (no rounding), for parts that must stay square.
export function x2(rows: Grid): Grid {
  const out: string[] = [];
  for (const r of rows) {
    const w = [...r].map((c) => c + c).join('');
    out.push(w, w);
  }
  return out;
}

// Lay `top` over `base` at (dx, dy) in fine pixels; '.' lets the base show,
// '_' cuts a hole.
export function stamp(base: Grid, top: Grid, dx: number, dy: number): Grid {
  const g = base.map((r) => r.split(''));
  top.forEach((row, j) => {
    const y = j + dy;
    if (y < 0 || y >= g.length) return;
    for (let i = 0; i < row.length; i++) {
      const x = i + dx, ch = row[i];
      if (ch === '.' || x < 0 || x >= g[y].length) continue;
      g[y][x] = ch === '_' ? '.' : ch;
    }
  });
  return g.map((r) => r.join(''));
}

// A sprite from a fine-pixel grid, anchored in fine pixels. Everything at
// double density is built through here, so the pipeline's switch (spr's
// density option) is made in one place.
export function spr2(rows: Grid, ax: number, ay: number): Sprite {
  return spr(rows, ax, ay);
}
