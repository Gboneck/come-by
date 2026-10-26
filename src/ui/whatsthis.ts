import { C } from '../palette';
import { prose } from './case';
import { rect } from '../gfx/draw';
import { heading, headingWidth, text } from '../gfx/font';
import type { Game } from '../game';
import { CATALOG } from '../ranch/catalog';
import { REGIONS } from '../world/map';
import { panel } from './frame';

// "What's this": the first time something new is on screen near the dog (a
// paddock, a building, a buyer's yard, the trial crook, a locked gate), a
// little card points at it with its name and what it is for. One at a time,
// once each (remembered with the save's tips). Other features can add their
// own things to THINGS.

export interface Thing { id: string; x: number; y: number; name: string; line: string }

const LINES: Record<string, string> = {
  farmhouse: 'YOUR HOME. LIE DOWN NEAR IT WITH NO STOCK ABOUT TO REST: THE DAY GOES BY QUICKLY.',
  pen: "DRIVE STOCK IN THROUGH THE GATE. PENNED STOCK MAKE GOODS, AND GOODS SELL AT DAY'S END.",
};

function ranchThings(game: Game): Thing[] {
  const out: Thing[] = [];
  const kinds = new Set<string>();
  for (const b of game.ranch.buildings) {
    if (b.kind === 'regiongate' || b.kind === 'fence' || kinds.has(b.kind)) continue;
    kinds.add(b.kind);
    const def = CATALOG.find((d) => d.kind === b.kind);
    const line = LINES[b.kind] ?? def?.desc;
    if (!line) continue;
    const name = b.kind === 'farmhouse' ? 'FARMHOUSE' : b.kind === 'pen' ? 'PADDOCK' : def!.name;
    out.push({ id: `b-${b.kind}`, x: b.cx, y: b.y0 + 4, name, line });
  }
  for (const y of game.ranch.yards) {
    const gp = y.pen.gatePoint(0);
    out.push({ id: `y-${y.site.id}`, x: gp.x, y: gp.y, name: y.site.name, line: 'A BUYER. WHEN THEY ASK FOR STOCK, DRIVE IT INTO THIS YARD BEFORE THE TIME SHOWN, CALM FOR MORE PAY.' });
  }
  const post = game.ranch.course.post;
  out.push({ id: 'crook', x: post.x, y: post.y, name: 'THE CROOK', line: 'TRIALS START HERE: STAND BY IT AND NIP. GUIDE THE SHEEP ROUND THE GATES AND INTO THE PEN.' });
  for (const g of game.ranch.regionGates) {
    if (g.unlocked) continue;
    const r = REGIONS.find((x) => x.id === g.region);
    if (r) out.push({ id: `gate-${r.id}`, x: g.cx, y: g.cy, name: 'A LOCKED GATE', line: `${r.name.toUpperCase()} LIES BEYOND. IT OPENS AT TIER ${r.tier}.` });
  }
  return out;
}

// The first goods in a paddock: what they are and where they go.
const GOOD_NAME: Record<string, string> = { duck: 'EGGS', sheep: 'WOOL', goat: 'CHEESE', cow: 'MILK' };
function goodsThings(game: Game): Thing[] {
  const p = game.ranch.pens.find((x) => x.goods > 0);
  if (!p) return [];
  const kind = Object.keys(p.goodsBy ?? {}).find((k) => (p.goodsBy[k as keyof typeof p.goodsBy] ?? 0) > 0) ?? p.species ?? 'duck';
  const name = GOOD_NAME[kind] ?? 'GOODS';
  return [{ id: 'goods', x: p.cx, y: p.iy0 + 6, name, line: `YOUR STOCK MADE THESE. A CART BUYS ALL THE GOODS AT DAY'S END: THE COUNT BY YOUR COINS SAYS WHAT THEY WILL FETCH.` }];
}

export const THINGS: ((game: Game) => Thing[])[] = [goodsThings, ranchThings];

let cur: { th: Thing; t: number } | null = null;
let gap = 0;
let scan = 0;
const SHOW = 6.5;

export function updateWhatsThis(game: Game, dt: number) {
  if (cur) {
    cur.t += dt;
    const d = Math.hypot(cur.th.x - game.dog.x, cur.th.y - game.dog.y);
    if (cur.t > SHOW || d > 220 || game.mode !== 'play') {
      cur = null;
      gap = 2;
    }
    return;
  }
  if ((gap -= dt) > 0 || (scan -= dt) > 0) return;
  scan = 0.3;
  // Not over the first steps, a trial run, the night or a menu.
  if (game.mode !== 'play' || game.tut < 4 || game.banner || game.trials.run || game.day.phase === 'night' || game.demo || game.input.override) return;
  const { ox, oy, W, H } = game.view();
  for (const source of THINGS)
    for (const th of source(game)) {
      if (game.tipsSeen.has(`w-${th.id}`)) continue;
      const sx = th.x - ox, sy = th.y - oy;
      if (sx < 30 || sx > W - 30 || sy < 60 || sy > H - 70) continue;
      if (Math.hypot(th.x - game.dog.x, th.y - game.dog.y) > 150) continue;
      game.tipsSeen.add(`w-${th.id}`);
      cur = { th, t: 0 };
      return;
    }
}

// The card over the thing, with a tail down to it. Tapping it puts it away.
export function drawWhatsThis(game: Game, g: CanvasRenderingContext2D, top: number, bottom: number) {
  if (!cur || game.mode !== 'play') return;
  const { th, t } = cur;
  const { ox, oy, W } = game.view();
  const sx = Math.round(th.x - ox), sy = Math.round(th.y - oy);
  const pw = Math.min(W - 8, 150);
  const lines = prose(th.line, pw - 10).slice(0, 4);
  const ph = 13 + lines.length * 7 + 2;
  const drop = Math.round(Math.max(0, 1 - t / 0.2) * -6);
  let x0 = Math.round(Math.max(4, Math.min(W - pw - 4, sx - pw / 2)));
  let y0 = sy - 16 - ph + drop;
  const below = y0 < top + 4;
  if (below) y0 = Math.min(bottom - ph - 4, sy + 14);
  // Blink out at the end.
  if (t > SHOW - 0.5 && Math.floor(t * 10) % 2) return;
  // The tail: a plum stem to the thing, a buttercup dot on it.
  const tx = Math.max(x0 + 6, Math.min(x0 + pw - 6, sx));
  const ty0 = below ? sy + 3 : y0 + ph, ty1 = below ? y0 : sy - 3;
  rect(g, tx, Math.min(ty0, ty1), 1, Math.abs(ty1 - ty0), C.plum);
  rect(g, sx - 1, sy - 1, 3, 3, C.plum);
  rect(g, sx, sy, 1, 1, C.butter);
  panel(g, x0, y0, pw, ph, C.plum, C.butter);
  const name = headingWidth(th.name) <= pw - 10 ? th.name : '';
  if (name) heading(g, name, x0 + 5, y0 + 3, C.butter, { shade: C.moss });
  else text(g, th.name, x0 + 5, y0 + 4, C.butter);
  lines.forEach((l, i) => text(g, l, x0 + 5, y0 + 13 + i * 7, C.wool, { iconColor: C.butter }));
  if (game.ui.click('whatsthis', x0, y0, pw, ph)) {
    cur = null;
    gap = 2;
  }
}
