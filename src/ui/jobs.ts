import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import type { Game } from '../game';
import { edgeArrow, type Margins } from './hud';
import { safeArea } from './safe';
import { touchLayout } from './touch';
import { drawCover } from './feel';
import { buzz } from './settings';
import { SPECIES } from '../entities/species';
import { tToClock, yardOf, type Order } from '../systems/orders';
import { CLASSES, PARTS, classLabel, currentClass, isTrialDay, nextTrialDay, prizeToday, type TrialResult } from '../systems/trials';
import { LEGACY, goalDone } from '../systems/progression';

// Orders and trials on screen: a card in the HUD's left column (under the
// goal tracker), edge arrows to where the work is, the judge's card at the
// end of a run, and lines for the Ledger. The in-world markers for the
// same jobs live in coach.ts.

const YARD_SHORT = { mill: 'MILL', drover: 'DROVER', sale: 'SALE' } as const;
const ORD = ['1ST', '2ND', '3RD', '4TH'];

function orderLine(o: Order, compact: boolean): string {
  const sp = SPECIES[o.species];
  const what = (o.n === 1 ? sp.name : sp.plural).toUpperCase();
  return compact ? `${o.got}/${o.n} ${what} ${tToClock(o.due)}` : `${o.n} ${what} ${o.got}/${o.n} BY ${tToClock(o.due)}`;
}

const nextTrial = (game: Game) => nextTrialDay(isTrialDay(game.day.day) ? game.day.day + 1 : game.day.day);

// The jobs card at (x, y). Returns the height it took (0 for none).
export function jobCard(game: Game, g: CanvasRenderingContext2D, x: number, y: number, W: number): number {
  const r = game.trials.run;
  const blink = Math.floor(game.t * 3) % 2 === 0;
  if (r) {
    // A run: class and clock, the six parts as pips, the score so far.
    const left = Math.max(0, Math.ceil(r.cls.limit - r.t));
    const clock = `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}`;
    const name = `${r.cls.name}${r.prize ? '' : ' PRACTICE'}`;
    const score = `${r.scores.reduce((s, v) => s + v, 0)} PTS`;
    const pipsW = PARTS.length * 5 - 1;
    const w = Math.max(textWidth(name) + textWidth(clock) + 6, pipsW + textWidth(score) + 6) + 8;
    panel(g, x, y, w, 19, C.plum, C.butter);
    text(g, name, x + 4, y + 3, C.wool);
    text(g, clock, x + w - 4, y + 3, left < 20 && blink ? C.butter : C.wool, { align: 'right' });
    PARTS.forEach((_, i) => {
      const done = i < r.step, now = i === r.step;
      rect(g, x + 4 + i * 5, y + 12, 4, 3, done ? C.butter : now && blink ? C.wool : C.sage);
    });
    text(g, score, x + w - 4, y + 11, C.butter, { align: 'right' });
    return 21;
  }
  const lines: { tag: string; s: string; c: string }[] = [];
  const compact = W < 300;
  for (const o of game.orders.open) {
    const soon = o.due - game.day.t < 25 && blink;
    lines.push({ tag: YARD_SHORT[o.yard], s: orderLine(o, compact), c: soon ? C.butter : C.wool });
  }
  if (prizeToday(game) && currentClass(game) && game.day.phase !== 'night')
    lines.push({ tag: 'TRIAL DAY', s: compact ? 'SHOW GROUND' : 'AT THE SHOW GROUND', c: C.wool });
  if (!lines.length) return 0;
  const tagW = Math.max(...lines.map((l) => textWidth(l.tag)));
  const w = tagW + 4 + Math.max(...lines.map((l) => textWidth(l.s))) + 8;
  const h = lines.length * 7 + 5;
  panel(g, x, y, w, h, C.plum, C.butter);
  lines.forEach((l, i) => {
    text(g, l.tag, x + 4, y + 3 + i * 7, C.butter);
    text(g, l.s, x + 8 + tagW, y + 3 + i * 7, l.c, { iconColor: C.butter });
  });
  return h + 2;
}

function arrows(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  // Clear of the HUD at the top, the safe areas and the thumb controls.
  const S = safeArea(game.screen);
  const TL = game.input.touchMode ? touchLayout(game, W, H) : null;
  const M: Margins = { top: S.top + 14, bottom: TL ? H - TL.top + 2 : S.bottom + 8, left: S.left, right: S.right };
  const r = game.trials.run;
  const c = game.ranch.course;
  if (r) {
    const id = PARTS[r.step]?.id;
    if (!id) return;
    if (id === 'post') edgeArrow(g, game, c.post.x, c.post.y, C.butter, 'POST', M);
    else if (id === 'pen') {
      const gp = c.pen.gatePoint(8);
      edgeArrow(g, game, gp.x, gp.y, C.butter, 'PEN', M);
    } else {
      const gt = c.gates.find((x) => x.id === (id === 'lift' ? 'fetch' : id))!;
      edgeArrow(g, game, gt.x, gt.y, C.butter, 'GATE', M);
    }
    return;
  }
  const gr = game.nearestGroup(90);
  const inShow = game.map.regionAt(game.dog.x, game.dog.y)?.id === 'show';
  if (gr) {
    const o = game.orders.open.find((x) => x.species === gr.species);
    if (o) {
      const gp = yardOf(game, o.yard).pen.gatePoint(10);
      edgeArrow(g, game, gp.x, gp.y, C.butter, YARD_SHORT[o.yard], M);
    }
  } else if (inShow && currentClass(game) && game.day.phase !== 'night') {
    edgeArrow(g, game, c.post.x, c.post.y + 4, C.butter, 'CROOK', M);
  } else if (prizeToday(game) && currentClass(game) && game.day.phase !== 'night') {
    edgeArrow(g, game, c.post.x, c.post.y, C.butter, 'TRIAL', M);
  }
}

export function drawJobs(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  let tapped = false;
  if (game.trials.result) tapped = drawResult(game, g, W, H, game.trials.result);
  else arrows(game, g, W, H);
  // Coins in flight and confetti go over everything, the judge's card too.
  game.feel.drawTop(g);
  return tapped;
}

// ---- The judge's card ----

const ROW_STEP = 0.06;
export const RESULT_READY = 0.7; // input waits this long (see game.ts)

let shown: TrialResult | null = null;
let age = 0;
let paid = false;
let flown = false;

// Seconds the current result card has been up (game.ts ticks it with dt).
export function resultAge(game: Game, dt = 0): number {
  if (game.trials.result !== shown) {
    shown = game.trials.result;
    age = 0;
    paid = false;
    flown = false;
  }
  age += dt;
  return age;
}

interface Row { k: string; v?: string; c?: string; gap?: boolean; big?: boolean; total?: boolean; place?: boolean }

// The judge's card at the end of a run. True when it is dismissed by tap.
function drawResult(game: Game, g: CanvasRenderingContext2D, W: number, H: number, r: TrialResult): boolean {
  const t = resultAge(game);
  const touch = game.input.touchMode;
  const pw = Math.min(W - 12, 178);
  const rows: Row[] = [];
  if (r.retired) rows.push({ k: 'RETIRED: YOU LEFT THE FIELD', c: C.butter });
  else if (r.timeUp) rows.push({ k: 'TIME! THE JUDGE CALLED IT', c: C.butter });
  for (const p of r.parts) rows.push({ k: p.name, v: `${p.got}/${p.max}`, c: p.got === p.max ? C.butter : C.wool });
  if (r.faults) rows.push({ k: 'FAULTS', v: `-${r.faults}`, c: C.wool });
  rows.push({ k: 'TOTAL', v: `${r.total}`, c: C.butter, gap: true, total: true });
  if (r.prize && !r.retired) {
    const table = [...r.rivals, { name: 'YOU', score: r.total }].sort((a, b) => b.score - a.score || (a.name === 'YOU' ? -1 : 1));
    table.forEach((e, i) => rows.push({ k: `${ORD[i]}  ${e.name}`, v: `${e.score}`, c: e.name === 'YOU' ? C.butter : C.sage, gap: i === 0 }));
    if (r.coins) {
      rows.push({ k: `${ORD[r.place - 1]} PLACE!`, c: C.butter, gap: true, big: true, place: true });
      rows.push({ k: `+${r.coins}$ AND A RIBBON`, c: C.butter });
    } else rows.push({ k: 'NO PLACING THIS TIME', c: C.wool, gap: true, place: true });
    if (r.unlocked) {
      const tierOk = r.unlocked.tier <= game.tier;
      rows.push({ k: tierOk ? `NEXT: ${classLabel(r.unlocked)}` : `${r.unlocked.name} CLASS OPENS AT TIER ${r.unlocked.tier}`, c: C.wool });
    } else if (r.place === 1 && r.cls.id === 'cup') rows.push({ k: `VALLEY CUP WINS: ${game.trials.cups}`, c: C.butter });
  } else if (!r.retired) {
    rows.push({ k: `PRACTICE. TRIAL DAY IS DAY ${nextTrial(game)}`, c: C.sage, gap: true });
  }
  if (r.best && r.total > 0) rows.push({ k: 'YOUR BEST SCORE YET!', c: C.butter });
  const lines: Row[] = [];
  for (const row of rows) {
    if (row.v || row.big) lines.push(row);
    else wrap(row.k, pw - 14).forEach((l, i) => lines.push({ ...row, k: l, gap: i === 0 && row.gap }));
  }
  const big = (l: Row) => l.big && textWidth(l.k, 2) <= pw - 14;
  const bh = touch ? 15 : 11;
  const gaps = lines.filter((l) => l.gap).length;
  const ph = 18 + lines.reduce((s, l) => s + (big(l) ? 12 : 7), 0) + gaps * 3 + bh + 9;
  const S = safeArea(game.screen);
  const drop = Math.round(Math.max(0, 1 - t / 0.25) * -16);
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2 + S.top, Math.round(H / 2 - ph / 2)) + drop;
  drawCover(g, W, H, Math.min(8, t * 40));
  panel(g, x0, y0, pw, ph);
  if (!flown) {
    // The prize money leaves the card at once and lands as the placing
    // stamps in, so the purse ticks up with it.
    flown = true;
    if (r.coins) game.feel.flyCoins(W / 2, y0 + ph - 30, r.coins, 5, 0.45);
  }
  text(g, `${r.cls.name} CLASS${r.prize ? '' : ' (PRACTICE)'}`, W / 2, y0 + 4, C.butter, { align: 'center' });
  rect(g, x0 + 5, y0 + 11, pw - 10, 1, C.sage);
  // Rows arrive one after another; the total counts up, the placing stamps.
  let y = y0 + 15;
  lines.forEach((l, i) => {
    const at = (i + 1) * ROW_STEP;
    if (l.gap) {
      rect(g, x0 + 7, y, pw - 14, 1, C.sage);
      y += 3;
    }
    const lh = big(l) ? 12 : 7;
    if (t >= at) {
      let v = l.v;
      if (l.total) v = `${Math.round(r.total * Math.min(1, (t - at) / 0.5))}`;
      if (big(l)) {
        const stamp = t - at < 0.09 && textWidth(l.k, 3) <= pw - 10 ? 1 : 0;
        text(g, l.k, W / 2, y - stamp * 3, C.butter, { align: 'center', scale: 2 + stamp, shadow: C.teal });
      } else {
        text(g, l.k, x0 + 7, y, l.c ?? C.wool, { iconColor: C.butter });
        if (v) text(g, v, x0 + pw - 7, y, l.c ?? C.wool, { align: 'right' });
      }
      if (l.place && !paid) {
        // The prize money flies to the purse as the placing lands.
        paid = true;
        if (r.coins) {
          game.feel.kick(0, 2, 0.16);
          buzz(touch, r.place === 1 ? [30, 60, 30, 60, 90] : [18, 50, 36]);
        }
      }
    }
    y += lh;
  });
  const ready = t >= RESULT_READY;
  const label = "THAT'LL DO";
  const bw = textWidth(label) + (touch ? 20 : 12), bx = Math.round(W / 2 - bw / 2), by = y0 + ph - bh - 4;
  const hot = game.ui.isActive('trial-ok') || (ready && game.ui.hovering(bx, by, bw, bh));
  panel(g, bx, by, bw, bh, hot ? C.teal : C.plum, ready ? C.butter : C.sage);
  text(g, label, W / 2, by + Math.floor((bh - 5) / 2), ready ? C.wool : C.sage, { align: 'center' });
  const p = touch ? 3 : 0;
  return game.ui.click('trial-ok', bx - p, by - p, bw + p * 2, bh + p * 2) || game.ui.captureAll('trial-card');
}

// ---- Ledger lines ----

export function jobsLedger(game: Game, w: number): { s: string; c: string; x?: number }[] {
  const out: { s: string; c: string; x?: number }[] = [];
  const add = (s: string, c: string) => wrap(s, w).forEach((l) => out.push({ s: l, c }));
  if (game.won) {
    const done = LEGACY.filter((goal) => goalDone(game, goal)).length;
    out.push({ s: '', c: C.wool });
    add(`LEGACY ${done}/${LEGACY.length}`, C.butter);
    for (const goal of LEGACY.filter((x) => !goalDone(game, x)).slice(0, 2)) {
      out.push({ s: `- ${goal.label}`, c: C.wool });
      if (goal.target > 1) out.push({ s: `${Math.min(goal.target, goal.value(game))}/${goal.target}`, c: C.sage, x: 8 });
    }
  }
  if (game.tier < 2) return out;
  out.push({ s: '', c: C.wool });
  add('TRIALS', C.butter);
  const c = currentClass(game);
  if (c) add(prizeToday(game) ? `TODAY: ${classLabel(c)}` : `DAY ${nextTrial(game)}: ${classLabel(c)}`, C.wool);
  const [a, b, d] = game.totals.ribbons;
  const won = CLASSES.filter((x) => game.trials.won.includes(x.id)).map((x) => x.name);
  add(`RIBBONS ${a}/${b}/${d}  BEST SCORE ${game.totals.bestTrial}`, C.sage);
  if (won.length) add(`WON: ${won.join(', ')}`, C.sage);
  out.push({ s: '', c: C.wool });
  add('ORDERS', C.butter);
  for (const o of game.orders.open) add(`${YARD_SHORT[o.yard]}: ${orderLine(o, false)} (${yardOf(game, o.yard).site.place})`, C.wool);
  if (!game.orders.open.length) add('NONE TODAY. NEW ONES EACH MORNING', C.sage);
  add(`FILLED ${game.totals.orders}${game.totals.calmOrders ? `, ${game.totals.calmOrders} ALL CALM` : ''}`, C.sage);
  return out;
}
