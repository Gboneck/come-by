import { C } from '../palette';
import { px, rect } from '../gfx/draw';
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

function cup(g: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  // (x, y): the foot, on the shelf.
  if (big) {
    rect(g, x - 1, y - 1, 3, 1, C.butter);
    px(g, x, y - 2, C.butter);
    rect(g, x - 2, y - 6, 5, 4, C.butter);
    px(g, x - 3, y - 5, C.butter);
    px(g, x + 3, y - 5, C.butter);
    px(g, x - 1, y - 5, C.wool);
  } else {
    rect(g, x - 1, y - 1, 3, 1, C.butter);
    rect(g, x - 1, y - 4, 3, 3, C.butter);
    px(g, x - 1, y - 4, C.wool);
  }
}

function shears(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x, y, C.butter);
  px(g, x + 1, y + 1, C.butter);
  px(g, x + 2, y + 2, C.wool);
  px(g, x + 3, y + 3, C.wool);
  px(g, x + 3, y, C.butter);
  px(g, x + 2, y + 1, C.butter);
  px(g, x + 1, y + 2, C.wool);
  px(g, x, y + 3, C.wool);
}

// One board on two posts; (x, y) is the ground at its middle.
function board(g: CanvasRenderingContext2D, x: number, y: number, ros: string[][], cups: number, bigCup: boolean, pins: BadgeGroup[], sh: boolean) {
  const l = x - Math.floor(FACE_W / 2), top = y - 5 - FACE_H;
  // Its shadow, thrown as the houses' are.
  const sx = Math.round(LIGHT.dx * 0.8), sy = Math.round(LIGHT.dy * 0.5);
  rect(g, l + sx, y + sy - 1, FACE_W, 2, C.sage);
  for (const p of [l + 3, l + FACE_W - 4]) for (let k = 0; k <= Math.abs(sy); k++) px(g, p + Math.round((sx * k) / Math.max(1, Math.abs(sy))), y + k, C.sage);
  rect(g, l + 3, y - 5, 1, 6, C.plum);
  rect(g, l + FACE_W - 4, y - 5, 1, 6, C.plum);
  // The face: a plum frame, a teal cloth, a moss rail under the rosettes.
  rect(g, l, top, FACE_W, FACE_H, C.plum);
  rect(g, l + 1, top + 1, FACE_W - 2, FACE_H - 2, C.teal);
  for (let i = l + 2; i < l + FACE_W - 2; i += 3) px(g, i, top + 1, C.sage);
  snowCap(g, l, top - 1, FACE_W);
  ros.slice(0, PER).forEach(([petal, mid], i) => rosette(g, l + 4 + i * 5, top + 3, petal, mid));
  // The shelf.
  rect(g, l + 1, top + 14, FACE_W - 2, 1, C.moss);
  let cx = l + 4;
  if (bigCup) {
    cup(g, cx + 1, top + 14, true);
    cx += 7;
  }
  for (let i = 0; i < Math.min(cups, 3); i++, cx += 4) cup(g, cx, top + 14, false);
  if (sh) shears(g, l + FACE_W - 7, top + 9);
  // The badge pins.
  pins.slice(0, PINS).forEach((gr, i) => {
    const row = Math.floor(i / 10);
    px(g, l + 2 + row + (i % 10) * 2, top + 15 + row, groupRim(gr));
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
