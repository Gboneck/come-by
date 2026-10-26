import { spr, type Sprite } from '../gfx/sprite';
import { PX, fine } from '../gfx/screen';

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

// A sprite from a fine-pixel grid, anchored in fine pixels: drawn at a
// world position, its anchor lands on the nearest fine pixel.
export function spr2(rows: Grid, ax: number, ay: number): Sprite {
  return spr(rows, ax, ay, { density: PX });
}

// Fine-pixel drawing from inside the world's frame. `x, y` are world
// positions; offsets are in fine pixels.
const fx0 = (x: number) => Math.round(x * PX);

// Only the top `rows` grid rows of a sprite (wading: the legs under water),
// placed exactly as drawSpr would place it. Returns where it went, in fine
// pixels: left, top, and fine pixels per grid pixel.
export function drawSprTop(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, flip: boolean, rows: number): { left: number; top: number; k: number } {
  const k = PX / (s.d ?? 1);
  const left = fx0(x) - (flip ? s.w - 1 - s.ax : s.ax) * k, top = fx0(y) - s.ay * k;
  const h = Math.max(0, Math.min(s.h, rows));
  fine(g, (fg) => {
    if (!h) return;
    if (!flip) fg.drawImage(s.img, 0, 0, s.w, h, left, top, s.w * k, h * k);
    else {
      fg.translate(left + s.w * k, top);
      fg.scale(-1, 1);
      fg.drawImage(s.img, 0, 0, s.w, h, 0, 0, s.w * k, h * k);
    }
  });
  return { left, top, k };
}

// Single fine pixels (drips, ripples, wakes) at fine coordinates.
export function finePixels(g: CanvasRenderingContext2D, color: string, pts: number[]) {
  fine(g, (fg) => {
    fg.fillStyle = color;
    for (let i = 0; i < pts.length; i += 2) fg.fillRect(pts[i], pts[i + 1], 1, 1);
  });
}
export const toFinePx = fx0;

// A shadow on the ground in fine pixels: an ellipse rx by ry fine pixels
// round world (x, y), its edge as smooth as the fine grid allows.
export function fineShadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  const cx = fx0(x), cy = fx0(y);
  fine(g, (fg) => {
    fg.fillStyle = color;
    const iry = Math.max(0, Math.round(ry));
    for (let dy = -iry; dy <= iry; dy++) {
      const t = iry === 0 ? 0 : dy / (ry + 0.5);
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      fg.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  });
}
