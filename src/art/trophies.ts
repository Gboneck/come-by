import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
import { grid, gridAt } from './fine';
import { cached } from '../gfx/picture';
import type { Drawable } from './buildings';
import type { Game } from '../game';
import { rosette } from './favour';
import { groupRim, type BadgeGroup } from './badges';
import { snowCap } from './seasonlook';
import { lightLook } from './seasonlook';

// The board by the farmhouse door that fills up as the ranch does well:
// rosettes along the top (trial placings, the fair, the valley rosette and
// each buyer who calls you a friend), cups on a little shelf (the classes
// won, the Valley Cup larger), and a pin for every badge, in the colour of
// its kind, across the bottom. It goes up with the first thing to show and
// grows a second board once there is more than one can hold.

export interface BoardContents {
  rosettes: string[][]; // [petal, middle] colours, in order won
  cups: number; // classes won
  bigCup: boolean; // the Valley Cup
  pins: BadgeGroup[];
  shears: boolean; // the shearer's friendship
}

export function boardContents(game: Game): BoardContents {
  const [a, b, c] = game.totals.ribbons;
  const rosettes: string[][] = [];
  const add = (n: number, petal: string, mid: string) => {
    for (let i = 0; i < n; i++) rosettes.push([petal, mid]);
  };
  if (game.favour.level('sale') >= 4) add(1, C.butter, C.teal); // the valley rosette
  add(game.totals.fairRibbons[0], C.teal, C.butter);
  add(Math.min(4, a), C.butter, C.plum);
  add(Math.min(3, b), C.wool, C.plum);
  add(Math.min(3, c), C.sage, C.plum);
  for (const id of ['mill', 'drover'] as const) if (game.favour.level(id) >= 4) add(1, C.wool, C.butter);
  const classes = game.trials.won.filter((id) => id !== 'cup' && id !== 'brace').length;
  return { rosettes, cups: classes, bigCup: game.trials.cups > 0, pins: game.achievements.pins(game), shears: game.favour.level('shear') >= 3 };
}

const FACE_W = 24, FACE_H = 18;
const PER = 4; // rosettes on one board
const PINS = 20; // pins on one board, two rows
// Where the sun puts shadows. (World and light's round four moves this with
// the sun as `lightLook` in seasonlook.ts; read it from there on a merge.)
const LIGHT = lightLook;

// A cup on the shelf, (x, y) its foot; fine.
const CUP = ['.yyyyy.', 'yywyyyy', 'yywyyyy', '.yyyyy.', '..yyy..', '...y...', '..yyy..'];
const BIG_CUP = ['y.yyyyyyy.y', 'yyywyyyyyyy', 'y.ywyyyyyy.', '..ywyyyyy..', '...yyyyy...', '....yyy....', '.....y.....', '....yyy....', '...yyyyy...'];
function cup(g: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  fine(g, (fg) => gridAt(fg, big ? BIG_CUP : CUP, x * PX, y * PX - 1));
}

const SHEARS = ['y.....y', '.y...y.', '..y.y..', '...w...', '..w.w..', '.ww.ww.', '.ww.ww.'];
function shears(g: CanvasRenderingContext2D, x: number, y: number) {
  fine(g, (fg) => grid(fg, SHEARS, x * PX, y * PX));
}

// One board on two posts; (x, y) is the ground at its middle. Fine grid.
function board(g: CanvasRenderingContext2D, x: number, y: number, ros: string[][], cups: number, bigCup: boolean, pins: BadgeGroup[], sh: boolean) {
  const l = x - Math.floor(FACE_W / 2), top = y - 5 - FACE_H;
  fine(g, (fg) => {
    const L = l * PX, T = top * PX, Y = y * PX + 1, FW = FACE_W * PX, FH = FACE_H * PX;
    // Its shadow, thrown as the houses' are.
    const sx = Math.round(LIGHT.dx * 0.8) * PX, sy = Math.round(LIGHT.dy * 0.5) * PX;
    rect(fg, L + sx, Y + sy - 2, FW, 3, C.sage);
    for (const p0 of [L + 6, L + FW - 8]) {
      for (let k = 0; k <= Math.abs(sy); k++) px(fg, p0 + Math.round((sx * k) / Math.max(1, Math.abs(sy))), Y + k, C.sage);
      rect(fg, p0, Y - 10, 2, 11, C.plum);
      px(fg, p0 + 1, Y - 9, C.sage);
    }
    // The face: a plum frame, a teal cloth with its weave, a moss shelf.
    rect(fg, L, T, FW, FH, C.plum);
    rect(fg, L + 2, T + 2, FW - 4, FH - 4, C.teal);
    for (let i = L + 3; i < L + FW - 3; i += 4) for (let j = T + 4; j < T + FH - 4; j += 4) px(fg, i + ((j >> 2) & 1) * 2, j, C.sage);
    rect(fg, L + 2, T + 28, FW - 4, 2, C.moss);
    rect(fg, L + 2, T + 30, FW - 4, 1, C.plum);
  });
  snowCap(g, l, top - 1, FACE_W);
  ros.slice(0, PER).forEach(([petal, mid], i) => rosette(g, l + 4 + i * 5, top + 3, petal, mid));
  let cx = l + 4;
  if (bigCup) {
    cup(g, cx + 1, top + 14, true);
    cx += 7;
  }
  for (let i = 0; i < Math.min(cups, 3); i++, cx += 4) cup(g, cx, top + 14, false);
  if (sh) shears(g, l + FACE_W - 7, top + 9);
  // The badge pins: a little round head each, in its kind's colour.
  fine(g, (fg) => {
    pins.slice(0, PINS).forEach((gr, i) => {
      const row = Math.floor(i / 10);
      const X = (l + 2 + row + (i % 10) * 2) * PX, Y = (top + 15 + row) * PX;
      rect(fg, X, Y, 2, 2, groupRim(gr));
      px(fg, X, Y, C.wool);
    });
  });
}

export function trophyDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const f = game.ranch.farmhouse;
  if (!f) return [];
  const b = boardContents(game);
  if (!b.rosettes.length && !b.cups && !b.bigCup && !b.pins.length) return [];
  const { ox, oy, W, H } = game.view();
  // Just past the house's front right corner (its left post at x1 + 2, its
  // foot at y1 + 1), clear of the windows and the porch; the farmhouse lot
  // keeps that strip free of buildings. It moves as the house grows.
  const x = Math.round(f.x1 + 2 - 3 + Math.floor(FACE_W / 2)), y = Math.round(f.y1 + 1);
  if (x + 60 < ox || x - 60 > ox + W || y + 10 < oy || y - 40 > oy + H) return [];
  // A second board, to the right, once the first is full.
  const more = b.rosettes.length > PER || b.pins.length > PINS;
  return cached(g, 'trophies', (cg) => {
    const out: Drawable[] = [{ y, draw: () => board(cg, x, y, b.rosettes, b.cups, b.bigCup, b.pins, b.shears) }];
    if (more) out.push({ y, draw: () => board(cg, x + FACE_W + 2, y, b.rosettes.slice(PER), 0, false, b.pins.slice(PINS), false) });
    return out;
  });
}
