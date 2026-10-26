import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { TS } from '../world/map';
import type { Drawable } from './buildings';

// Goods as things you can see: what a paddock's stock has made today waits
// inside its fence until the cart comes at the end of the day. Eggs in a
// nest box, wool in bales, cheese in wheels on a board, milk in churns. One
// piece for each good up to a handful, then a count on the pile. Icons of
// the same goods for the "+1" over an animal and the HUD's tally.

export type GoodKind = 'duck' | 'sheep' | 'goat' | 'cow';
const ROOM: Record<GoodKind, number> = { duck: 6, sheep: 6, goat: 6, cow: 3 };

// Small icons in fine pixels (two to a world pixel), outlined in plum so
// they read on grass and on a panel alike; anchored bottom centre.
const ICON_ROWS: Record<GoodKind, string[]> = {
  duck: [
    '...pp...',
    '..pwwp..',
    '.pwwwwp.',
    '.pwwwwp.',
    'pwwwwwwp',
    'pwwwwwsp',
    'pwwwwssp',
    '.pwssp..',
    '..ppp...',
  ],
  sheep: [
    '..pppppp..',
    '.pwwwwwwp.',
    'pwwwwwwwwp',
    'pwwswwswwp',
    'pwwwwwwwwp',
    'pswwswwswp',
    '.pssssssp.',
    '..pppppp..',
  ],
  goat: [
    '.......pp.',
    '.....ppyyp',
    '...ppyyyyp',
    '.ppyyyyoyp',
    'pyyyyyyyyp',
    'pyoyyyyyyp',
    'poooooooop',
    'pppppppppp',
  ],
  cow: [
    '..pppp..',
    '..pwwp..',
    '.pppppp.',
    '.pwwwwp.',
    '.pwwwsp.',
    '.pppppp.',
    '.pwwwwp.',
    '.pwwwsp.',
    '.pssssp.',
    '..pppp..',
  ],
};
const icons = new Map<string, Sprite>();
export function goodIcon(kind: string): Sprite | null {
  const rows = ICON_ROWS[kind as GoodKind];
  if (!rows) return null;
  let s = icons.get(kind);
  if (!s) icons.set(kind, (s = spr(rows, undefined, undefined, { density: 2 })));
  return s;
}

// ---- The piles ----
// Each draws with its bottom-left at (x, y) and is about 10px wide.

function nestBox(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  // The box: a plum frame with a sage front board, straw heaped inside.
  rect(g, x + 1, y + 1, 9, 1, C.sage);
  rect(g, x, y - 5, 11, 6, C.plum);
  rect(g, x + 1, y - 2, 9, 2, C.sage);
  px(g, x + 3, y - 1, C.plum);
  px(g, x + 7, y - 1, C.plum);
  rect(g, x + 1, y - 4, 9, 2, C.moss);
  px(g, x - 1, y - 5, C.moss);
  px(g, x + 11, y - 4, C.moss);
  // Eggs in the straw, a second row peeping over the first.
  const k = Math.min(n, ROOM.duck);
  for (let i = 0; i < k; i++) {
    const row = i < 3 ? 1 : 0;
    const ex = x + 1 + (i % 3) * 3 + (row ? 0 : 1), ey = y - 6 + row * 2;
    rect(g, ex, ey, 2, 2, C.wool);
    if (row) px(g, ex + 1, ey + 1, C.sage);
  }
}

function bale(g: CanvasRenderingContext2D, x: number, y: number) {
  rect(g, x + 1, y - 3, 3, 1, C.wool);
  rect(g, x, y - 2, 5, 2, C.wool);
  px(g, x + 1, y - 1, C.sage);
  px(g, x + 3, y - 1, C.sage);
  rect(g, x + 1, y, 3, 1, C.sage);
}

function wheel(g: CanvasRenderingContext2D, x: number, y: number) {
  rect(g, x + 1, y - 2, 3, 1, C.butter);
  rect(g, x, y - 1, 5, 1, C.butter);
  rect(g, x, y, 5, 1, C.moss);
  px(g, x + 4, y - 2, C.moss);
}

// Bales or wheels stacked three, two, one.
function stack(g: CanvasRenderingContext2D, x: number, y: number, n: number, one: (g: CanvasRenderingContext2D, x: number, y: number) => void, board: boolean) {
  const spots = [[0, 0], [4, 0], [8, 0], [2, -3], [6, -3], [4, -6]];
  const k = Math.min(n, spots.length);
  // A shadow (or the cheese board) under just the bottom row.
  const bw = Math.min(k, 3) * 4 + 1;
  if (board) {
    rect(g, x - 1, y + 1, bw + 2, 1, C.plum);
    rect(g, x, y + 2, bw, 1, C.sage);
  } else rect(g, x + 1, y + 1, bw - 2, 1, C.sage);
  for (let i = 0; i < k; i++) one(g, x + spots[i][0], y + spots[i][1]);
}

function churns(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  const k = Math.min(n, ROOM.cow);
  rect(g, x, y + 1, k * 4 - 1, 1, C.sage);
  for (let i = 0; i < k; i++) {
    const cx = x + i * 4, cy = y - (i % 2);
    px(g, cx + 1, cy - 6, C.plum);
    rect(g, cx, cy - 5, 3, 1, C.plum);
    rect(g, cx, cy - 4, 3, 2, C.wool);
    rect(g, cx, cy - 2, 3, 1, C.plum);
    rect(g, cx, cy - 1, 3, 2, C.wool);
    px(g, cx, cy, C.sage);
    px(g, cx + 2, cy, C.sage);
  }
}

function pile(g: CanvasRenderingContext2D, kind: GoodKind, x: number, y: number, n: number) {
  if (kind === 'duck') nestBox(g, x, y, n);
  else if (kind === 'sheep') stack(g, x, y, n, bale, false);
  else if (kind === 'goat') stack(g, x, y, n, wheel, true);
  else churns(g, x, y, n);
  // More than the pile shows: the count on a little tag.
  if (n > ROOM[kind]) text(g, `${n}`, x + 5, y - 13, C.wool, { align: 'center', shadow: C.plum });
}

// ---- In a paddock ----

interface PenLike {
  x0: number; y0: number; x1: number; y1: number;
  ix0: number; iy0: number; ix1: number; iy1: number;
  rot: number;
  goods: number;
  goodsBy: Partial<Record<string, number>>;
  species: string | null;
  items?: { sp: string }[]; // goods as laid (Gameplay's), which reach a co-op guest
}

// What a paddock holds, by kind: its own count, else (on a friend's copy
// of the ranch) counted from the goods laid, else all of its first kind.
export function goodsByKind(p: PenLike): [string, number][] {
  const by = Object.entries(p.goodsBy ?? {}).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  if (by.length || !p.goods) return by;
  if (p.items?.length) {
    const m = new Map<string, number>();
    for (const it of p.items) m.set(it.sp, (m.get(it.sp) ?? 0) + 1);
    return [...m];
  }
  return p.species ? [[p.species, p.goods]] : [];
}

// The goods waiting in a paddock, each kind's pile along the back fence (the
// side away from the gate), clear of the fixtures. `blocked(tx, ty)`: a tile
// a fixture stands on.
export function goodsDrawables(g: CanvasRenderingContext2D, p: PenLike, blocked: (tx: number, ty: number) => boolean): Drawable[] {
  const by = goodsByKind(p).filter(([k]) => k in ROOM) as [GoodKind, number][];
  if (!by.length) return [];
  // Spots along the back fence, 12px apart, that a pile can stand on.
  const W = 11, Hh = 12;
  const back = p.rot === 0 ? 2 : p.rot === 2 ? 0 : p.rot === 1 ? 3 : 1; // the side facing the gate's
  const spots: { x: number; y: number }[] = [];
  const free = (x: number, y: number) => {
    for (let yy = y - Hh; yy <= y; yy += 4)
      for (let xx = x; xx <= x + W; xx += 4) if (blocked(Math.floor(xx / TS), Math.floor(yy / TS))) return false;
    return x >= p.ix0 + 1 && x + W <= p.ix1 - 1 && y - Hh >= p.iy0 - 2 && y <= p.iy1 - 1;
  };
  if (back === 0 || back === 2) {
    const y = back === 2 ? p.iy0 + Hh : p.iy1 - 2;
    for (let x = p.ix0 + 2; x + W <= p.ix1 - 1; x += W + 1) if (free(x, y)) spots.push({ x, y });
  } else {
    const x = back === 3 ? p.ix1 - W - 2 : p.ix0 + 2;
    for (let y = p.iy0 + Hh; y <= p.iy1 - 2; y += Hh + 1) if (free(x, y)) spots.push({ x, y });
  }
  const out: Drawable[] = [];
  by.slice(0, spots.length).forEach(([kind, n], i) => {
    const s = spots[i];
    out.push({ y: s.y, draw: () => pile(g, kind, Math.round(s.x), Math.round(s.y), n) });
  });
  return out;
}

// The icon for a kind, by its bottom centre (the "+1" and the HUD).
export function drawGoodIcon(g: CanvasRenderingContext2D, kind: string, x: number, y: number) {
  const s = goodIcon(kind);
  if (s) drawSpr(g, s, Math.round(x), Math.round(y));
}
