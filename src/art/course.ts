import { C } from '../palette';
import { line, rect, px, ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { penDrawables, type Drawable } from './buildings';
import type { Game } from '../game';
import type { CourseGate, Yard } from '../ranch/fixtures';
import { PARTS } from '../systems/trials';
import { SHOW_ENTRY } from '../world/map';

// Show Ground course furniture and the buyers' yards, drawn in code.

// A course post with a pennant. `state`: 0 waiting, 1 the next target
// (bright and flapping), 2 judged (flag lowered).
function coursePost(g: CanvasRenderingContext2D, x: number, y: number, state: number, side: number, t: number) {
  rect(g, x - 2, y + 1, 4, 1, C.sage);
  rect(g, x - 1, y - 9, 2, 10, C.plum);
  px(g, x - 1, y - 9, C.moss);
  const col = state === 1 ? C.butter : state === 2 ? C.sage : C.wool;
  const fy = state === 2 ? y - 4 : y - 9;
  const flap = state === 1 && Math.floor(t * 4 + x) % 2 === 0;
  const fx = side > 0 ? x + 1 : x - 2;
  const s = side > 0 ? 1 : -1;
  rect(g, side > 0 ? fx : fx - 2, fy, 3, 1, col);
  rect(g, side > 0 ? fx : fx - 1, fy + 1, flap ? 3 : 2, 1, col);
  px(g, fx + (flap ? s * 2 : 0), fy + 2, col);
}

// Dotted line on the ground between a gate's posts.
function gateLine(g: CanvasRenderingContext2D, gt: CourseGate, hot: boolean, t: number) {
  const [a, b] = gt.posts;
  const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3);
  const on = !hot || Math.floor(t * 3) % 2 === 0;
  for (let i = 1; i < n; i++) {
    if (!on && i % 2) continue;
    px(g, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, hot ? C.wool : C.moss);
  }
}

// The handler's post: a shepherd's crook planted in the ground.
function crook(g: CanvasRenderingContext2D, x: number, y: number) {
  rect(g, x - 1, y + 1, 4, 1, C.sage);
  rect(g, x, y - 12, 1, 13, C.plum);
  rect(g, x + 1, y - 14, 2, 1, C.plum);
  px(g, x + 3, y - 13, C.plum);
  px(g, x + 3, y - 12, C.plum);
  px(g, x + 2, y - 11, C.plum);
  px(g, x, y - 13, C.plum);
}

// Bunting strung between two poles.
function bunting(g: CanvasRenderingContext2D, xa: number, xb: number, y: number) {
  rect(g, xa, y - 14, 1, 15, C.plum);
  rect(g, xb, y - 14, 1, 15, C.plum);
  rect(g, xa - 1, y + 1, 3, 1, C.sage);
  rect(g, xb - 1, y + 1, 3, 1, C.sage);
  const cols = [C.butter, C.wool, C.teal];
  const w = xb - xa;
  for (let x = xa + 1; x < xb; x++) {
    const u = (x - xa) / w;
    const sag = Math.round(4 * 4 * u * (1 - u));
    px(g, x, y - 13 + sag, C.plum);
    const k = x - xa - 2;
    if (k >= 0 && k % 6 < 3) {
      const col = cols[Math.floor(k / 6) % 3];
      const h = k % 6 === 1 ? 3 : 2;
      rect(g, x, y - 12 + sag, 1, h, col);
    }
  }
}

// A buyer's covered cart, shafts to the left. `x, y` is its 2x2 tile corner.
function cart(g: CanvasRenderingContext2D, x: number, y: number, flag: boolean, t: number) {
  const b = y + 14;
  rect(g, x + 1, b + 1, 14, 1, C.sage);
  line(g, x + 2, b - 6, x - 4, b - 3, C.plum);
  // Canvas cover on hoops.
  rect(g, x + 3, b - 15, 10, 1, C.wool);
  rect(g, x + 2, b - 14, 12, 6, C.wool);
  for (const hx of [x + 5, x + 8, x + 11]) rect(g, hx, b - 14, 1, 6, C.sage);
  rect(g, x + 2, b - 15, 1, 1, C.plum);
  rect(g, x + 13, b - 15, 1, 1, C.plum);
  // Bed and wheels.
  rect(g, x + 1, b - 8, 14, 4, C.plum);
  rect(g, x + 1, b - 8, 14, 1, C.moss);
  for (const wx of [x + 4, x + 12]) {
    ring(g, wx, b - 2, 2, C.plum);
    px(g, wx, b - 2, C.wool);
  }
  if (flag) {
    // A pennant on the cart: this buyer is waiting for stock.
    rect(g, x + 13, b - 22, 1, 7, C.plum);
    const f = Math.floor(t * 4) % 2;
    rect(g, x + 14, b - 22, 4, 1, C.butter);
    rect(g, x + 14, b - 21, f ? 4 : 3, 1, C.butter);
    px(g, x + 14, b - 20, C.butter);
  }
}

// Name board on a post.
function board(g: CanvasRenderingContext2D, x: number, y: number, label: string, hot: boolean) {
  const w = textWidth(label) + 4;
  rect(g, x, y - 4, 1, 5, C.plum);
  rect(g, x - Math.floor(w / 2) - 1, y - 12, w + 2, 9, C.plum);
  rect(g, x - Math.floor(w / 2), y - 11, w, 7, hot ? C.butter : C.wool);
  text(g, label, x, y - 10, C.plum, { align: 'center' });
}

const YARD_LABEL = { mill: 'MILL', drover: 'DROVER', sale: 'SALE YARD' } as const;

function yardDrawables(game: Game, g: CanvasRenderingContext2D, y: Yard, t: number): Drawable[] {
  const ord = game.orders.forYard(y.site.id);
  const out = penDrawables(g, y.pen, t, false);
  const cx = y.site.cart.tx * 8, cy = y.site.cart.ty * 8;
  out.push({ y: cy + 14, draw: () => cart(g, cx, cy, !!ord, t) });
  const label = ord ? `${YARD_LABEL[y.site.id]} ${ord.got}/${ord.n}` : YARD_LABEL[y.site.id];
  const bx = y.pen.x0 + 6, by = y.pen.y0 + 1;
  out.push({ y: by, draw: () => board(g, bx, by, label, !!ord) });
  return out;
}

export function courseDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const seen = (x0: number, y0: number, x1: number, y1: number) => x1 > ox - 40 && x0 < ox + W + 40 && y1 > oy - 40 && y0 < oy + H + 40;
  const t = game.t;
  const out: Drawable[] = [];
  for (const y of game.ranch.yards) {
    const p = y.pen;
    if (seen(p.x0, p.y0, (y.site.cart.tx + 3) * 8, p.y1 + 8)) out.push(...yardDrawables(game, g, y, t));
  }
  const c = game.ranch.course;
  // Bunting over the way in from the Home Meadow.
  const e = SHOW_ENTRY;
  if (seen(e.x0, e.y - 20, e.x1, e.y)) out.push({ y: e.y, draw: () => bunting(g, e.x0, e.x1, e.y) });
  if (!seen(c.gates[1].x - 40, c.release.y - 40, c.pen.x1 + 40, c.post.y + 40)) return out;
  const r = game.trials.run;
  const step = r ? r.step : -1;
  c.gates.forEach((gt, i) => {
    const part = PARTS.findIndex((p) => p.id === gt.id);
    // The lift heads for the fetch gate, so it is lit from the start.
    const state = !r ? 0 : step === part || (step === 0 && i === 0) ? 1 : step > part ? 2 : 0;
    out.push({ y: -1e9 + 1, draw: () => gateLine(g, gt, state === 1, t) });
    gt.posts.forEach((p, k) => out.push({ y: p.y, draw: () => coursePost(g, p.x, p.y, state, k ? 1 : -1, t + i) }));
  });
  const post = c.post;
  if (!r) out.push({ y: -1e9 + 2, draw: () => ring(g, post.x, post.y + 4, 13, C.moss, 4) });
  out.push({ y: post.y, draw: () => crook(g, post.x, post.y) });
  out.push(...penDrawables(g, c.pen, t, false));
  return out;
}
