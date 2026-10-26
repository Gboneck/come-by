import { C } from '../palette';
import { line, px, rect, ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { cached } from '../gfx/picture';
import { gust } from '../render/wind';
import type { Drawable } from './buildings';
import type { Game } from '../game';
import type { Yard } from '../ranch/fixtures';
import type { Pen } from '../ranch/buildings';
import type { Special } from '../systems/favour';
import type { Piece } from '../ui/decorbuild';
import { STALLS as STALL_SPOTS } from '../ranch/village';

// Buyers' yards dressing up as their favour grows (systems/favour.ts):
//   1 bunting along the yard's fence
//   2 a striped awning over the cart: a stall
//   3 flower tubs at the gate
//   4 your ranch's name on a board on the yard's front fence (the sale
//     yard also pins up the valley rosette), and over their market stall
//     in the village once the square stands
// and, on a day with a special order, its word by the cart's pennant.
// Also the gifts, as decor pieces for build mode.

const PENNANTS = [C.butter, C.wool, C.teal];
const WORD: Record<Special, string> = { rush: 'RUSH!', show: 'SHOW STOCK', drove: 'BIG DROVE' };

function bunting(g: CanvasRenderingContext2D, p: Pen, t: number) {
  const x0 = p.x0 + 2, x1 = p.x1 - 2, y = p.y0 - 8;
  rect(g, x0 - 1, y - 1, 1, 9, C.plum);
  rect(g, x1, y - 1, 1, 9, C.plum);
  for (let x = x0; x < x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const sag = Math.round(4 * u * (1 - u) * 3);
    px(g, x, y + sag, C.plum);
    if ((x - x0) % 4 === 1 && x < x1 - 2) {
      const col = PENNANTS[((x - x0) >> 2) % PENNANTS.length];
      const flap = gust(x, y, t) > 0.5 ? 1 : 0;
      rect(g, x, y + sag + 1, 3, 1, col);
      rect(g, x + flap, y + sag + 2, 2, 1, col);
      px(g, x + 1 + flap, y + sag + 3, col);
    }
  }
}

// The cart's 2x2 tile corner is (x, y) in px.
function awning(g: CanvasRenderingContext2D, x: number, y: number) {
  const l = x - 3, r = x + 18;
  rect(g, l, y - 4, 1, 19, C.plum);
  rect(g, r, y - 4, 1, 19, C.plum);
  rect(g, l - 1, y - 8, r - l + 3, 1, C.plum);
  for (let i = l; i <= r + 1; i++) {
    const col = ((i - l) >> 1) % 2 ? C.wool : C.teal;
    rect(g, i, y - 7, 1, 3, col);
    // A scalloped edge.
    if ((i - l) % 2 === 0) px(g, i, y - 4, col);
  }
  rect(g, l - 1, y - 7, 1, 3, C.plum);
  rect(g, r + 2, y - 7, 1, 3, C.plum);
}

function nameBoard(g: CanvasRenderingContext2D, cx: number, y: number, name: string) {
  const w = textWidth(name) + 6;
  const l = Math.round(cx - w / 2);
  rect(g, l, y - 9, w, 8, C.plum);
  rect(g, l + 1, y - 8, w - 2, 6, C.wool);
  rect(g, l + 1, y - 3, w - 2, 1, C.sage);
  text(g, name, cx, y - 7, C.plum, { align: 'center' });
  px(g, l + 2, y - 1, C.plum);
  px(g, l + w - 3, y - 1, C.plum);
}

function tub(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  rect(g, x - 3, y - 3, 7, 4, C.plum);
  rect(g, x - 2, y - 3, 5, 3, C.teal);
  rect(g, x - 2, y - 3, 5, 1, C.sage);
  const nod = gust(x, y, t) > 0.6 ? 1 : 0;
  for (const [dx, col] of [[-2, C.butter], [0, C.wool], [2, C.butter]] as const) {
    px(g, x + dx + nod, y - 6, col);
    px(g, x + dx, y - 5, C.moss);
    px(g, x + dx, y - 4, C.moss);
  }
}

export function rosette(g: CanvasRenderingContext2D, x: number, y: number, petal: string, mid: string) {
  // A round of petals with a heart of another colour, two tails below.
  rect(g, x - 1, y - 2, 3, 5, petal);
  rect(g, x - 2, y - 1, 5, 3, petal);
  px(g, x, y, mid);
  px(g, x - 1, y + 3, mid);
  px(g, x - 1, y + 4, mid);
  px(g, x + 1, y + 3, mid);
  px(g, x + 1, y + 4, mid);
}

function yardDressing(game: Game, g: CanvasRenderingContext2D, y: Yard, t: number): Drawable[] {
  const id = y.site.id;
  const lv = game.favour.level(id);
  const p = y.pen;
  const cx = y.site.cart.tx * 8, cy = y.site.cart.ty * 8;
  const out: Drawable[] = [];
  if (lv >= 1) out.push({ y: p.y0 - 0.5, draw: () => bunting(g, p, t) });
  if (lv >= 2) out.push({ y: cy + 14.5, draw: () => awning(g, cx, cy) });
  if (lv >= 3) {
    // Either side of the gate, outside.
    const gp = p.gatePoint(8), mx = (p.x0 + p.x1) / 2, my = (p.y0 + p.y1) / 2;
    const side = Math.abs(gp.x - mx) > Math.abs(gp.y - my);
    const a = side ? { x: gp.x, y: gp.y - 12 } : { x: gp.x - 12, y: gp.y };
    const b = side ? { x: gp.x, y: gp.y + 13 } : { x: gp.x + 12, y: gp.y };
    for (const q of [a, b]) out.push({ y: q.y, draw: () => tub(g, Math.round(q.x), Math.round(q.y), t) });
  }
  if (lv >= 4) {
    const name = game.look.ranch || 'YOUR RANCH';
    // Hung on the yard's front fence, where you come up to it.
    out.push({ y: p.y1 + 1, draw: () => nameBoard(g, Math.round((p.x0 + p.x1) / 2), p.y1 + 4, name) });
    if (id === 'sale') {
      const sx = cx + 4, sy = (y.site.cart.ty + 2) * 8 - 6;
      out.push({ y: sy + 12, draw: () => rosette(g, sx, sy, C.butter, C.teal) });
    }
  }
  return out;
}

// The market square's three stalls, the miller's, the drover's and the sale
// yard's (Gameplay's village, round four: STALLS in ranch/village.ts, their
// ground points). A buyer who calls you friend puts your ranch's name up
// over their stall once the square stands. On a merge with the village this
// list is `STALLS` from there; until then there is no square.

const STALL_OF = { mill: 0, drover: 1, sale: 2 } as const;
interface Square {
  village?: { has?: (step: string) => boolean };
}

function stallBoards(game: Game, g: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean): Drawable[] {
  if (!STALL_SPOTS.length || !(game.ranch as unknown as Square).village?.has?.('square')) return [];
  const name = game.look.ranch || 'YOUR RANCH';
  const out: Drawable[] = [];
  for (const id of ['mill', 'drover', 'sale'] as const) {
    const s = STALL_SPOTS[STALL_OF[id]];
    if (!s || game.favour.level(id) < 4 || !inView(s.x, s.y)) continue;
    out.push({ y: s.y + 1, draw: () => nameBoard(g, Math.round(s.x), Math.round(s.y - 20), name) });
  }
  return out;
}

// A special order's word by the cart's pennant, in buttercup.
function specialWord(g: CanvasRenderingContext2D, x: number, y: number, word: string, t: number) {
  if (Math.floor(t * 2) % 4 === 3) return;
  text(g, word, x + 21, y - 10, C.butter, { shadow: C.plum });
}

export function favourDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const t = game.t;
  const out: Drawable[] = stallBoards(game, g, (x, y) => x > ox - 60 && x < ox + W + 60 && y > oy - 20 && y < oy + H + 40);
  for (const y of game.ranch.yards) {
    const p = y.pen;
    if (p.x1 + 40 < ox || p.x0 - 40 > ox + W || p.y1 + 30 < oy || p.y0 - 30 > oy + H) continue;
    // The dressing changes only with a gust (the pennants), so it is cached.
    out.push(...cached(g, `fav-${y.site.id}`, (cg) => yardDressing(game, cg, y, t)));
    const o = game.orders.forYard(y.site.id);
    if (o?.special) {
      const cx = y.site.cart.tx * 8, cy = y.site.cart.ty * 8;
      const word = WORD[o.special];
      out.push({ y: cy + 15, draw: () => specialWord(g, cx, cy, word, t) });
    }
  }
  return out;
}

// ---- Gifts: decor pieces, free in build mode once given ----

export type GiftId = 'millstone' | 'bell' | 'fleece';

export const GIFT_PIECES: Piece[] = [
  { id: 'millstone', name: 'MILLSTONE', cost: 0, w: 1, h: 1, desc: "THE MILLER'S OLD STONE. A GIFT.", open: (g) => g.favour.level('mill') >= 3, lock: "THE MILLER'S GIFT: FAVOUR 3" },
  { id: 'bell', name: 'SHOW BELL', cost: 0, w: 1, h: 1, desc: "THE SALE YARD'S OLD BELL. A GIFT.", open: (g) => g.favour.level('sale') >= 3, lock: "THE SALE YARD'S GIFT: FAVOUR 3" },
  { id: 'fleece', name: 'FLEECE BALE', cost: 0, w: 1, h: 1, desc: "FROM THE SHEARER, WITH THANKS. A GIFT.", open: (g) => g.favour.level('shear') >= 3, lock: "THE SHEARER'S GIFT: FAVOUR 3" },
];

export function drawGift(g: CanvasRenderingContext2D, id: GiftId, x: number, y: number, t: number) {
  switch (id) {
    case 'millstone': {
      // An old millstone stood on its edge, a chock either side.
      rect(g, x - 5, y + 1, 11, 1, C.sage);
      ring(g, x, y - 5, 5, C.plum);
      for (let r = 1; r <= 4; r++) ring(g, x, y - 5, r, r === 4 ? C.wool : C.sage);
      line(g, x - 3, y - 7, x + 2, y - 2, C.plum);
      line(g, x - 2, y - 8, x + 3, y - 3, C.wool);
      rect(g, x - 1, y - 6, 2, 2, C.plum);
      px(g, x - 2, y - 9, C.wool);
      rect(g, x - 6, y - 1, 2, 2, C.plum);
      rect(g, x + 5, y - 1, 2, 2, C.plum);
      break;
    }
    case 'bell': {
      // A bell under a little gallows of two posts and a beam.
      rect(g, x - 5, y + 1, 11, 1, C.sage);
      rect(g, x - 4, y - 12, 1, 13, C.plum);
      rect(g, x + 4, y - 12, 1, 13, C.plum);
      rect(g, x - 5, y - 13, 11, 1, C.plum);
      rect(g, x - 5, y - 13, 11, 1, C.moss);
      px(g, x, y - 12, C.plum);
      const sw = Math.floor(t * 1.2) % 6 === 0 ? 1 : 0;
      rect(g, x - 1 + sw, y - 11, 3, 1, C.butter);
      rect(g, x - 2 + sw, y - 10, 5, 3, C.butter);
      rect(g, x - 3 + sw, y - 7, 7, 1, C.butter);
      px(g, x - 1 + sw, y - 10, C.wool);
      px(g, x + sw, y - 6, C.plum);
      break;
    }
    case 'fleece': {
      // A bale of fleeces tied with twine.
      rect(g, x - 5, y + 1, 11, 1, C.sage);
      rect(g, x - 5, y - 6, 11, 7, C.plum);
      rect(g, x - 4, y - 6, 9, 6, C.wool);
      for (let i = -4; i <= 4; i += 2) px(g, x + i, y - 6, C.sage);
      rect(g, x - 4, y - 1, 9, 1, C.sage);
      rect(g, x - 1, y - 6, 1, 6, C.plum);
      rect(g, x - 4, y - 3, 9, 1, C.plum);
      px(g, x - 1, y - 7, C.butter);
      px(g, x, y - 8, C.butter);
      break;
    }
  }
}
