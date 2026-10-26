import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { heading, headingWidth, text, textWidth } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import type { Game } from '../game';
import { animalSprites } from '../art/animals';
import { drawGoodIcon } from '../art/goods';
import { coin } from './hudart';
import { panel } from './frame';
import { safeArea } from './safe';
import type { Summary } from './summary';

// The day's goods sold, as a moment before the journal: the buyer's pony
// cart rolls in, each paddock's goods arc into it, coins fly from the cart
// to the purse (which counts up as they land), and the cart rolls on. A tap
// or a key skips to the journal. It plays inside the summary (the mode
// stays 'summary', so friends wait as before).

export interface SaleFrom { x: number; y: number; kinds: string[] } // a paddock's goods (world px), one entry a good
export interface Sale { value: number; mill?: number; market: boolean; from: SaleFrom[] }

const IN = 0.8; // the cart rolls in
const GOODS = 0.75; // goods start flying
const COINS = 1.75; // coins start flying
const OUT = 2.75; // the cart rolls on
export const SALE_LEN = 3.3;

export function saleLen(s: Summary | null): number {
  return s?.sale && s.sale.value > 0 && !s.saleSkipped ? SALE_LEN : 0;
}

// Before the journal takes keys: a press during the sale skips it. True
// while keys should be held back (the sale, then the journal's first beat).
export function summaryHold(game: Game, dt: number, ready: number): boolean {
  const s = game.summary;
  const len = saleLen(s);
  game.summaryT += dt;
  const inp = game.input;
  if (len && game.summaryT < len) {
    const tapped = [...inp.ptrs.values()].some((p) => p.justDown);
    if (game.summaryT > 0.3 && (inp.pressed('confirm') || inp.pressed('bark') || inp.pressed('cancel') || tapped)) {
      s!.saleSkipped = true;
      game.summaryT = 0;
    }
    inp.clearQueue();
    return true;
  }
  if (game.summaryT - len < ready) {
    inp.clearQueue();
    return true;
  }
  return false;
}

const ease = (u: number) => 1 - (1 - u) * (1 - u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

// The cart's bed: where the goods land, by the cart's x.
function bed(x: number, y: number) {
  return { x: x - 6, y: y - 12 };
}

export function drawSale(game: Game, g: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const s = game.summary!;
  const sale = s.sale!;
  const S = safeArea(game.screen);
  const v = game.view();
  // The road the cart takes: across the lower part of the view.
  const ry = Math.round(H * 0.62);
  const stop = Math.round(W / 2);
  const cx = t < IN ? Math.round(-30 + (stop + 30) * ease(t / IN)) : t < OUT ? stop : Math.round(stop + (W + 60 - stop) * clamp01((t - OUT) / (SALE_LEN - OUT)) ** 2);
  const rolling = t < IN || t > OUT;

  // The goods, one by one, from their paddocks (or the edge of the view
  // nearest them) into the bed.
  const flights: { kind: string; sx: number; sy: number; t0: number }[] = [];
  let k = 0;
  for (const f of sale.from) {
    const sx = Math.max(10, Math.min(W - 10, f.x - v.ox)), sy = Math.max(30, Math.min(H - 30, f.y - v.oy));
    for (const kind of f.kinds.slice(0, 8)) flights.push({ kind, sx, sy, t0: GOODS + Math.min(0.8, k++ * 0.07) });
  }
  const b = bed(cx, ry);
  let landed = 0;
  for (const fl of flights) {
    const u = (t - fl.t0) / 0.45;
    if (u < 0) continue;
    if (u >= 1) { landed++; continue; }
    const e = ease(u);
    const x = fl.sx + (b.x - fl.sx) * e, y = fl.sy + (b.y - fl.sy) * e - Math.sin(u * Math.PI) * 26;
    drawGoodIcon(g, fl.kind, x, y);
  }

  drawCart(g, cx, ry, rolling, t, flights.slice(0, landed).map((f) => f.kind));

  // Coins from the cart to the purse, the purse counting up as they land.
  const pieces = Math.max(1, Math.min(10, Math.ceil(sale.value / 4)));
  const R = W - 2 - S.right, T = 2 + S.top;
  const px0 = R - 7, py0 = T + 5;
  let paid = 0;
  for (let i = 0; i < pieces; i++) {
    const t0 = COINS + i * 0.07;
    const u = (t - t0) / 0.5;
    const share = i === pieces - 1 ? sale.value - Math.floor(sale.value / pieces) * (pieces - 1) : Math.floor(sale.value / pieces);
    if (u < 0) continue;
    if (u >= 1) {
      paid += share;
      continue;
    }
    const e = ease(u);
    const x = b.x + 4 + (px0 - b.x - 4) * e, y = b.y + (py0 - b.y) * e - Math.sin(u * Math.PI) * 30;
    coin(g, x, y, t * 3 + i, u > 0.8);
    if (u > 0.95 && !landedOnce.has(i)) {
      landedOnce.add(i);
      game.audio?.play('coin', { vol: 0.5 });
    }
  }
  if (t < COINS) landedOnce.clear();
  // The purse, as in the HUD.
  const shown = s.coins - sale.value + paid;
  const str = `${shown}`;
  const pw = textWidth(`${s.coins}`) + 18;
  const ticking = paid > 0 && paid < sale.value;
  panel(g, R - pw, T, pw, 11, C.plum, ticking ? C.butter : C.sage);
  text(g, str, R - 12, T + 3, ticking ? C.butter : C.wool, { align: 'right' });
  coin(g, px0, py0, game.t, ticking);

  // What it came to, over the cart once the goods are in.
  if (t > GOODS + 0.3) {
    const title = 'GOODS SOLD';
    const sum = `+${sale.value}$${sale.market ? '  MARKET DAY X1.25' : ''}${sale.mill ? `  THE MILL +${sale.mill}$` : ''}`;
    const w = Math.max(headingWidth(title), textWidth(sum)) + 14;
    const y = ry - 46;
    const x = Math.round(Math.min(W - w - 4, Math.max(4, cx - w / 2)));
    panel(g, x, y, w, 21, C.plum, C.butter);
    heading(g, title, x + w / 2, y + 3, C.butter, { align: 'center', shade: C.moss });
    text(g, sum, x + w / 2, y + 12, C.wool, { align: 'center', iconColor: C.butter });
  }
  // How to skip it.
  if (t > 0.4) text(g, game.input.touchMode ? 'TAP TO GO ON' : 'SPACE: GO ON', W / 2, H - S.bottom - 12, C.wool, { align: 'center', shadow: C.plum });
}
const landedOnce = new Set<number>();

// The buyer's cart: a pony in the shafts, a plank bed on two spoked wheels,
// the day's goods heaped in it. (x, y): the road under the cart's middle.
function drawCart(g: CanvasRenderingContext2D, x: number, y: number, rolling: boolean, t: number, load: string[]) {
  // Shadow along the road.
  rect(g, x - 16, y + 1, 52, 2, C.sage);
  // The pony, walking while the cart rolls.
  const pony = animalSprites('pony', 0);
  const frames = rolling ? pony.side : pony.stand;
  const fr = frames[Math.floor(t * 8) % frames.length];
  drawSpr(g, fr, x + 26, y);
  // Shafts from the bed to the pony's shoulder.
  rect(g, x + 8, y - 8, 14, 1, C.plum);
  // The bed: plum frame, sage boards, a wool rim.
  rect(g, x - 15, y - 12, 24, 7, C.plum);
  rect(g, x - 14, y - 11, 22, 5, C.sage);
  for (let i = -12; i < 8; i += 5) rect(g, i + x, y - 11, 1, 5, C.moss);
  rect(g, x - 15, y - 12, 24, 1, C.wool);
  // The load, heaped from the middle outward.
  load.forEach((kind, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    drawGoodIcon(g, kind, x - 12 + col * 4, y - 12 - row * 3);
  });
  // Wheels: a plum rim, wool spokes turning as it goes.
  for (const wx of [x - 10, x + 4]) {
    const wy = y - 3;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      px(g, Math.round(wx + Math.cos(ang) * 4), Math.round(wy + Math.sin(ang) * 4), C.plum);
    }
    const spin = rolling ? Math.floor(t * 10) % 2 : 0;
    const sp = spin ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of sp) for (let r = 1; r < 4; r++) px(g, Math.round(wx + dx * r * (dx && dy ? 0.7 : 1)), Math.round(wy + dy * r * (dx && dy ? 0.7 : 1)), C.wool);
    px(g, wx, wy, C.plum);
  }
}
