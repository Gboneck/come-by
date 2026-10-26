import { C } from '../palette';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import { penGoodsValue } from '../systems/economy';
import { isMarketDay } from '../systems/valley';
import { drawGoodIcon, goodIcon, goodsByKind } from '../art/goods';
import { sprW } from '../gfx/sprite';
import { panel } from './frame';

// Today's goods in the HUD: an icon and a count for each kind the stock has
// made, and what it all fetches when the cart comes at day's end. The card
// flashes as a new good comes in.

export interface Tally { kinds: { kind: string; n: number }[]; value: number; total: number }

export function goodsTally(game: Game): Tally {
  const by = new Map<string, number>();
  let value = 0, total = 0;
  for (const p of game.ranch.pens) {
    if (!p.goods) continue;
    total += p.goods;
    value += penGoodsValue(game, p);
    for (const [k, n] of goodsByKind(p)) by.set(k, (by.get(k) ?? 0) + n);
  }
  if (isMarketDay(game)) value = Math.round(value * 1.25);
  const order = ['duck', 'sheep', 'goat', 'cow'];
  const kinds = [...by].map(([kind, n]) => ({ kind, n })).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { kinds, value, total };
}

let seen = 0;
let flash = 0;
let lastT = 0;

// Right-aligned at (R, y); returns the height it took (0 when there are none).
export function drawGoodsTally(game: Game, g: CanvasRenderingContext2D, R: number, y: number, wide: boolean): number {
  const t = goodsTally(game);
  const dt = Math.min(0.1, Math.max(0, game.t - lastT));
  lastT = game.t;
  if (t.total > seen) flash = 0.5;
  seen = t.total;
  flash = Math.max(0, flash - dt);
  if (!t.total) return 0;
  const tail = wide ? ` ${t.value}$ AT DUSK` : ` ${t.value}$`;
  const parts = t.kinds.map((k) => {
    const ic = goodIcon(k.kind);
    return { ...k, s: `${k.n}`, iw: (ic ? Math.ceil(sprW(ic)) : 0) + 1 };
  });
  const w = parts.reduce((s, p) => s + p.iw + textWidth(p.s) + 3, 0) + textWidth(tail) + 7;
  const h = 11, x0 = R - w;
  const hot = flash > 0 && Math.floor(flash * 12) % 2 === 0;
  panel(g, x0, y, w, h, C.plum, hot ? C.butter : C.sage);
  let x = x0 + 4;
  for (const p of parts) {
    const s = goodIcon(p.kind);
    if (s) drawGoodIcon(g, p.kind, x + sprW(s) / 2, y + 8);
    x += p.iw;
    text(g, p.s, x, y + 3, C.wool);
    x += textWidth(p.s) + 3;
  }
  text(g, tail, x - 2, y + 3, C.butter, { iconColor: C.butter });
  return h;
}
