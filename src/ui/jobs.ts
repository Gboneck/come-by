import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import type { Game } from '../game';
import { edgeArrow } from './hud';
import { SPECIES } from '../entities/species';
import { tToClock, yardOf, type Order } from '../systems/orders';
import { CLASSES, PARTS, classLabel, currentClass, isTrialDay, nextTrialDay, prizeToday, type TrialResult } from '../systems/trials';
import { LEGACY, goalDone } from '../systems/progression';

// Orders and trials on screen: a small card at the top centre, edge arrows
// to where the work is, the trial result card, and lines for the Ledger.

const YARD_SHORT = { mill: 'MILL', drover: 'DROVER', sale: 'SALE' } as const;
const ORD = ['1ST', '2ND', '3RD', '4TH'];

function orderLine(o: Order, compact: boolean): string {
  const sp = SPECIES[o.species];
  const what = (o.n === 1 ? sp.name : sp.plural).toUpperCase();
  return compact ? `${YARD_SHORT[o.yard]} ${o.got}/${o.n} ${what} ${tToClock(o.due)}` : `${YARD_SHORT[o.yard]}: ${o.n} ${what} ${o.got}/${o.n} BY ${tToClock(o.due)}`;
}

function cardLines(game: Game, W: number): { s: string; c: string }[] {
  const out: { s: string; c: string }[] = [];
  const r = game.trials.run;
  if (r) {
    const left = Math.max(0, Math.ceil(r.cls.limit - r.t));
    const clock = `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}`;
    out.push({ s: `${r.cls.name}${r.prize ? '' : ' PRACTICE'}  ${clock}`, c: left < 20 && Math.floor(game.t * 3) % 2 === 0 ? C.butter : C.wool });
    const score = r.scores.reduce((s, v) => s + v, 0);
    const part = PARTS[r.step];
    out.push({ s: part ? `${part.short}  ${score} PTS` : `${score} PTS`, c: C.butter });
    return out;
  }
  const compact = W < 300;
  for (const o of game.orders.open) {
    const soon = o.due - game.day.t < 25 && Math.floor(game.t * 3) % 2 === 0;
    out.push({ s: orderLine(o, compact), c: soon ? C.butter : C.wool });
  }
  // On a phone two lines is the room there is under the goal tracker; the
  // TRIAL arrow still points the way.
  if (prizeToday(game) && currentClass(game) && (!compact || out.length < 2)) out.push({ s: compact ? 'TRIAL DAY: SHOW GROUND' : 'TRIAL DAY AT THE SHOW GROUND', c: C.butter });
  return out;
}

function arrows(game: Game, g: CanvasRenderingContext2D) {
  const top = 30;
  const r = game.trials.run;
  const c = game.ranch.course;
  if (r) {
    const id = PARTS[r.step]?.id;
    if (!id) return;
    if (id === 'post') edgeArrow(g, game, c.post.x, c.post.y, C.butter, 'POST', top);
    else if (id === 'pen') {
      const gp = c.pen.gatePoint(8);
      edgeArrow(g, game, gp.x, gp.y, C.butter, 'PEN', top);
    } else {
      const gt = c.gates.find((x) => x.id === (id === 'lift' ? 'fetch' : id))!;
      edgeArrow(g, game, gt.x, gt.y, C.butter, 'GATE', top);
    }
    return;
  }
  const gr = game.nearestGroup(90);
  if (gr) {
    const o = game.orders.open.find((x) => x.species === gr.species);
    if (o) {
      const gp = yardOf(game, o.yard).pen.gatePoint(10);
      edgeArrow(g, game, gp.x, gp.y, C.butter, YARD_SHORT[o.yard], top);
    }
  } else if (prizeToday(game) && currentClass(game) && game.map.regionAt(game.dog.x, game.dog.y)?.id !== 'show') {
    edgeArrow(g, game, c.post.x, c.post.y, C.butter, 'TRIAL', top);
  }
}

export function drawJobs(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  if (game.trials.result) return drawResult(game, g, W, H, game.trials.result);
  const lines = cardLines(game, W);
  if (lines.length) {
    const w = Math.max(...lines.map((l) => textWidth(l.s))) + 10;
    const h = lines.length * 7 + 4;
    const x = Math.round(W / 2 - w / 2);
    panel(g, x, 2, w, h, C.plum, C.butter);
    lines.forEach((l, i) => text(g, l.s, W / 2, 5 + i * 7, l.c, { align: 'center', iconColor: C.butter }));
  }
  arrows(game, g);
  return false;
}

// The judge's card at the end of a run. True when it is dismissed by tap.
function drawResult(game: Game, g: CanvasRenderingContext2D, W: number, H: number, r: TrialResult): boolean {
  const pw = Math.min(W - 12, 178);
  const rows: { k: string; v?: string; c?: string; gap?: boolean }[] = [];
  if (r.retired) rows.push({ k: 'RETIRED: YOU LEFT THE FIELD', c: C.butter });
  else if (r.timeUp) rows.push({ k: 'TIME! THE JUDGE CALLED IT', c: C.butter });
  for (const p of r.parts) rows.push({ k: p.name, v: `${p.got}/${p.max}`, c: p.got === p.max ? C.butter : C.wool });
  if (r.faults) rows.push({ k: 'FAULTS', v: `-${r.faults}`, c: C.wool });
  rows.push({ k: 'TOTAL', v: `${r.total}`, c: C.butter, gap: true });
  if (r.prize && !r.retired) {
    const table = [...r.rivals, { name: 'YOU', score: r.total }].sort((a, b) => b.score - a.score || (a.name === 'YOU' ? -1 : 1));
    table.forEach((e, i) => rows.push({ k: `${ORD[i]}  ${e.name}`, v: `${e.score}`, c: e.name === 'YOU' ? C.butter : C.sage, gap: i === 0 }));
    rows.push({ k: r.coins ? `${ORD[r.place - 1]} PLACE: +${r.coins}$ AND A RIBBON` : 'NO PLACING THIS TIME', c: r.coins ? C.butter : C.wool, gap: true });
    if (r.unlocked) {
      const tierOk = r.unlocked.tier <= game.tier;
      rows.push({ k: tierOk ? `NEXT: ${classLabel(r.unlocked)}` : `${r.unlocked.name} CLASS OPENS AT TIER ${r.unlocked.tier}`, c: C.wool });
    } else if (r.place === 1 && r.cls.id === 'cup') rows.push({ k: `VALLEY CUP WINS: ${game.trials.cups}`, c: C.butter });
  } else if (!r.retired) {
    rows.push({ k: `PRACTICE. TRIAL DAY IS DAY ${nextTrialDay(isTrialDay(game.day.day) ? game.day.day + 1 : game.day.day)}`, c: C.sage, gap: true });
  }
  if (r.best && r.total > 0) rows.push({ k: 'YOUR BEST SCORE YET!', c: C.butter });
  const lines: { k: string; v?: string; c?: string; gap?: boolean }[] = [];
  for (const row of rows) {
    if (row.v) lines.push(row);
    else wrap(row.k, pw - 14).forEach((l, i) => lines.push({ k: l, c: row.c, gap: i === 0 && row.gap }));
  }
  const gaps = lines.filter((l) => l.gap).length;
  const ph = 18 + lines.length * 7 + gaps * 3 + 20;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2, Math.round(H / 2 - ph / 2));
  panel(g, x0, y0, pw, ph);
  text(g, `${r.cls.name} CLASS${r.prize ? '' : ' (PRACTICE)'}`, W / 2, y0 + 4, C.butter, { align: 'center' });
  rect(g, x0 + 5, y0 + 11, pw - 10, 1, C.sage);
  let y = y0 + 15;
  for (const l of lines) {
    if (l.gap) {
      rect(g, x0 + 7, y, pw - 14, 1, C.sage);
      y += 3;
    }
    text(g, l.k, x0 + 7, y, l.c ?? C.wool, { iconColor: C.butter });
    if (l.v) text(g, l.v, x0 + pw - 7, y, l.c ?? C.wool, { align: 'right' });
    y += 7;
  }
  const label = "THAT'LL DO";
  const bw = textWidth(label) + 12, bx = Math.round(W / 2 - bw / 2), by = y0 + ph - 15;
  panel(g, bx, by, bw, 11, game.ui.isActive('trial-ok') ? C.teal : C.plum, C.butter);
  text(g, label, W / 2, by + 3, C.wool, { align: 'center' });
  return game.ui.click('trial-ok', bx, by, bw, 11) || game.ui.captureAll('trial-card');
}

// Extra lines for the Ranch Ledger.
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
  const c = currentClass(game);
  if (c) add(prizeToday(game) ? `TRIAL DAY TODAY: ${classLabel(c)}` : `TRIALS: ${c.name} CLASS ON DAY ${nextTrialDay(isTrialDay(game.day.day) ? game.day.day + 1 : game.day.day)}`, C.butter);
  const [a, b, d] = game.totals.ribbons;
  const won = CLASSES.filter((x) => game.trials.won.includes(x.id)).map((x) => x.name);
  add(`RIBBONS ${a} 1ST ${b} 2ND ${d} 3RD  BEST ${game.totals.bestTrial}`, C.sage);
  if (won.length) add(`WON: ${won.join(', ')}`, C.sage);
  add(`ORDERS FILLED ${game.totals.orders}${game.totals.calmOrders ? ` (${game.totals.calmOrders} CALM)` : ''}`, C.sage);
  for (const o of game.orders.open) add(`${orderLine(o, false)} (${yardOf(game, o.yard).site.place})`, C.wool);
  return out;
}
