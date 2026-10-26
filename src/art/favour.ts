import { C } from '../palette';
import { line, px, rect, ring } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
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

// All drawn on the fine grid (two fine pixels to a world pixel).
function bunting(g: CanvasRenderingContext2D, p: Pen, t: number) {
  fine(g, (fg) => {
    const X0 = (p.x0 + 2) * PX, X1 = (p.x1 - 2) * PX, Y = (p.y0 - 8) * PX;
    rect(fg, X0 - 2, Y - 2, 2, 18, C.plum);
    rect(fg, X1, Y - 2, 2, 18, C.plum);
    for (let x = X0; x < X1; x++) {
      const u = (x - X0) / (X1 - X0);
      const sag = Math.round(4 * u * (1 - u) * 6);
      px(fg, x, Y + sag, C.plum);
      if ((x - X0) % 8 === 2 && x < X1 - 5) {
        const col = PENNANTS[((x - X0) >> 3) % PENNANTS.length];
        const flap = gust(x >> 1, Y >> 1, t) > 0.5 ? 1 : 0;
        rect(fg, x, Y + sag + 1, 5, 1, col);
        rect(fg, x + flap, Y + sag + 2, 4, 1, col);
        rect(fg, x + 1 + flap, Y + sag + 3, 2, 2, col);
        px(fg, x + 1 + flap, Y + sag + 5, col);
      }
    }
  });
}

// The cart's 2x2 tile corner is (x, y) in px.
function awning(g: CanvasRenderingContext2D, x: number, y: number) {
  fine(g, (fg) => {
    const L = (x - 3) * PX, R = (x + 18) * PX, Y = y * PX;
    for (const px0 of [L, R]) { rect(fg, px0, Y - 8, 2, 38, C.plum); px(fg, px0 + 1, Y - 6, C.sage); }
    rect(fg, L - 2, Y - 16, R - L + 6, 2, C.plum);
    for (let i = L; i <= R + 3; i++) {
      const col = ((i - L) >> 2) % 2 ? C.wool : C.teal;
      rect(fg, i, Y - 14, 1, 6, col);
      const sc = (i - L) % 4;
      if (sc === 1 || sc === 2) px(fg, i, Y - 8, col);
    }
    rect(fg, L - 2, Y - 14, 2, 6, C.plum);
    rect(fg, R + 4, Y - 14, 2, 6, C.plum);
    rect(fg, L, Y - 13, R - L + 4, 1, C.sage);
  });
}

function nameBoard(g: CanvasRenderingContext2D, cx: number, y: number, name: string) {
  const w = textWidth(name) + 6;
  const l = Math.round(cx - w / 2);
  fine(g, (fg) => {
    const L = l * PX, Y = y * PX, Wd = w * PX;
    rect(fg, L, Y - 18, Wd, 16, C.plum);
    rect(fg, L + 2, Y - 16, Wd - 4, 12, C.wool);
    rect(fg, L + 2, Y - 6, Wd - 4, 1, C.sage);
    for (const cx2 of [L + 2, L + Wd - 3]) px(fg, cx2, Y - 16, C.butter);
    rect(fg, L + 4, Y - 2, 2, 2, C.plum);
    rect(fg, L + Wd - 6, Y - 2, 2, 2, C.plum);
  });
  text(g, name, cx, y - 7, C.plum, { align: 'center' });
}

function tub(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX;
    // A half-barrel of soil, hooped, flowers nodding in it.
    rect(fg, X - 6, Y - 6, 13, 8, C.plum);
    rect(fg, X - 6, Y - 6, 13, 1, C.moss);
    rect(fg, X - 6, Y - 2, 13, 1, C.sage);
    rect(fg, X - 5, Y - 5, 11, 2, C.sage);
    rect(fg, X + 5, Y - 5, 1, 7, C.teal);
    rect(fg, X - 6, Y + 2, 13, 1, C.sage);
    const nod = gust(x, y, t) > 0.6 ? 1 : 0;
    for (const [dx, col] of [[-4, C.butter], [0, C.wool], [4, C.butter], [-2, C.wool], [2, C.butter]] as const) {
      const tall = Math.abs(dx) === 2 ? 4 : 6;
      rect(fg, X + dx, Y - 5 - tall, 1, tall, C.moss);
      px(fg, X + dx - 1, Y - 7, C.moss);
      rect(fg, X + dx - 1 + nod, Y - 6 - tall, 3, 1, col);
      rect(fg, X + dx + nod, Y - 7 - tall, 1, 3, col);
      px(fg, X + dx + nod, Y - 6 - tall, col === C.wool ? C.butter : C.moss);
    }
  });
}

// A round of petals with a heart of another colour, two tails below; fine.
export function rosette(g: CanvasRenderingContext2D, x: number, y: number, petal: string, mid: string) {
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX;
    rect(fg, X - 2, Y - 4, 5, 9, petal);
    rect(fg, X - 4, Y - 2, 9, 5, petal);
    rect(fg, X - 3, Y - 3, 7, 7, petal);
    for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) px(fg, X + dx, Y + dy, C.plum);
    rect(fg, X - 1, Y - 1, 3, 3, mid);
    px(fg, X, Y - 1, C.wool);
    rect(fg, X - 2, Y + 5, 2, 5, mid);
    rect(fg, X + 1, Y + 5, 2, 5, mid);
    px(fg, X - 2, Y + 10, mid);
    px(fg, X + 2, Y + 10, mid);
  });
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
  fine(g, (fg) => {
    const X = x * PX, B = y * PX + 1;
    switch (id) {
      case 'millstone': {
        // An old millstone stood on its edge, its dressing grooves, a chock
        // either side.
        rect(fg, X - 10, B + 1, 21, 1, C.sage);
        for (let r = 10; r >= 2; r--) ring(fg, X, B - 10, r, r === 10 ? C.plum : r === 9 ? C.wool : r % 3 === 0 ? C.sage : C.wool);
        for (const [a0, a1] of [[-6, -14], [-4, -16], [-2, -18]]) line(fg, X + a0 + 4, B - 10 + a0 / 2, X + a1 + 20, B - 10 + a1 / 4, C.sage);
        rect(fg, X - 2, B - 12, 4, 4, C.plum);
        px(fg, X - 4, B - 17, C.wool);
        rect(fg, X - 12, B - 3, 4, 4, C.plum);
        rect(fg, X + 9, B - 3, 4, 4, C.plum);
        break;
      }
      case 'bell': {
        // A bell under a little gallows of two posts and a beam.
        rect(fg, X - 10, B + 1, 21, 1, C.sage);
        for (const px0 of [X - 8, X + 7]) { rect(fg, px0, B - 24, 2, 25, C.plum); px(fg, px0 + 1, B - 22, C.sage); }
        rect(fg, X - 10, B - 26, 22, 2, C.plum);
        rect(fg, X - 10, B - 26, 22, 1, C.moss);
        rect(fg, X, B - 24, 1, 2, C.plum);
        const sw = Math.floor(t * 1.2) % 6 === 0 ? 2 : 0;
        rect(fg, X - 2 + sw, B - 22, 5, 2, C.butter);
        rect(fg, X - 4 + sw, B - 20, 9, 6, C.butter);
        rect(fg, X - 5 + sw, B - 14, 11, 2, C.butter);
        rect(fg, X - 3 + sw, B - 20, 1, 5, C.wool);
        rect(fg, X + 2 + sw, B - 19, 2, 5, C.moss);
        rect(fg, X + sw, B - 12, 2, 2, C.plum);
        break;
      }
      case 'fleece': {
        // A bale of fleeces tied with twine.
        rect(fg, X - 10, B + 1, 21, 1, C.sage);
        rect(fg, X - 10, B - 12, 21, 13, C.plum);
        rect(fg, X - 8, B - 12, 17, 12, C.wool);
        for (let i = -8; i <= 8; i += 3) { px(fg, X + i, B - 12, C.sage); px(fg, X + i + 1, B - 8, C.sage); }
        rect(fg, X - 8, B - 2, 17, 2, C.sage);
        rect(fg, X - 1, B - 12, 2, 12, C.plum);
        rect(fg, X - 8, B - 6, 17, 1, C.plum);
        rect(fg, X - 2, B - 15, 2, 3, C.butter);
        rect(fg, X, B - 16, 2, 2, C.butter);
        break;
      }
    }
  });
}
