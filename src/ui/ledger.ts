import { C, U32 } from '../palette';
import { ditherRect, rect, px } from '../gfx/draw';
import { panel, paper } from './frame';
import { heading, text, textWidth, wrap } from '../gfx/font';
import { makeCanvas } from '../gfx/screen';
import type { Game } from '../game';
import { MH, MW, REGIONS, TS, Ter, type WorldMap } from '../world/map';
import { TIERS, goalDone, tierOf } from '../systems/progression';
import { jobsLedger } from './jobs';
import { yardOf } from '../systems/orders';
import { currentClass, prizeToday } from '../systems/trials';
import { safeArea } from './safe';
import { SKY_WORD, skyIcon } from './icons';
import type { Sky } from '../systems/weather';
import { dimView } from './feel';
import { discoveryLines, drawPaperFog, drawPlaceMarks, drawProjectMarks, projectLines } from './discovery';
import { travelLines } from '../net/travels';
import { valleyLedger } from './valley';

let mini: HTMLCanvasElement | null = null;

// The valley drawn in ink on the Ledger's paper, two tiles a pixel: woods
// as stippled sage inside a plum edge, water in teal with wool ripples,
// rock as plum dots, the roads dotted in plum, open ground left as paper.
function inkMap(map: WorldMap): HTMLCanvasElement {
  if (mini) return mini;
  const w = MW / 2, h = MH / 2;
  const [c, g] = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer);
  const ter = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? Ter.Forest : map.t(x * 2, y * 2));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = ter(x, y);
      const path = map.path[y * 2 * MW + x * 2];
      let col = U32.wool;
      if (t === Ter.Forest) {
        const edge = ter(x - 1, y) !== Ter.Forest || ter(x + 1, y) !== Ter.Forest || ter(x, y - 1) !== Ter.Forest || ter(x, y + 1) !== Ter.Forest;
        col = edge ? U32.plum : (x * 3 + y * 5) % 7 === 0 ? U32.teal : (x + y * 2) % 3 === 0 ? U32.sage : U32.wool;
      } else if (t === Ter.Water) col = (x + y * 3) % 9 === 0 ? U32.wool : U32.teal;
      else if (t === Ter.Shallow) col = (x + y) % 2 ? U32.teal : U32.sage;
      else if (t === Ter.Rock) col = (x + y) % 2 === 0 ? U32.plum : U32.sage;
      else if (path) col = (x + y) % 2 === 0 ? U32.plum : U32.wool;
      buf[y * w + x] = col;
    }
  g.putImageData(img, 0, 0);
  mini = c;
  return c;
}

function drawMap(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number) {
  const m = inkMap(game.map);
  // An inked border, double ruled.
  rect(g, x0 - 3, y0 - 3, m.width + 6, m.height + 6, C.plum);
  rect(g, x0 - 2, y0 - 2, m.width + 4, m.height + 4, C.wool);
  rect(g, x0 - 1, y0 - 1, m.width + 2, m.height + 2, C.plum);
  g.drawImage(m, x0, y0);
  drawPaperFog(game, g, x0, y0);
  for (const r of REGIONS) {
    const cx = x0 + Math.round(r.cx / 2), cy = y0 + Math.round(r.cy / 2);
    if (r.tier > game.tier) {
      ditherRect(g, cx - r.rx / 2, cy - r.ry / 2, r.rx, r.ry, 6, C.sage);
      // Padlock, inked.
      rect(g, cx - 2, cy - 1, 5, 4, C.plum);
      rect(g, cx - 1, cy - 3, 3, 1, C.plum);
      px(g, cx - 1, cy - 2, C.plum);
      px(g, cx + 1, cy - 2, C.plum);
      px(g, cx, cy, C.wool);
      text(g, `T${r.tier}`, cx, cy + 5, C.plum, { align: 'center' });
    }
  }
  drawPlaceMarks(game, g, x0, y0);
  drawProjectMarks(game, g, x0, y0);
  // Flocks out in the pastures, as ink dots.
  for (const gr of game.groups) {
    if (!game.discovery.known(gr.x, gr.y)) continue; // no flocks in the fog
    const gx = x0 + Math.round(gr.x / TS / 2), gy = y0 + Math.round(gr.y / TS / 2);
    rect(g, gx - 1, gy - 1, 2, 2, C.plum);
  }
  // Where today's jobs are: buyers waiting, and the crook on a trial day.
  const spot = (wx: number, wy: number) => {
    const sx = x0 + Math.round(wx / TS / 2), sy = y0 + Math.round(wy / TS / 2);
    rect(g, sx - 2, sy - 2, 4, 4, C.plum);
    rect(g, sx - 1, sy - 1, 2, 2, C.butter);
  };
  for (const o of game.orders.open) {
    const gp = yardOf(game, o.yard).pen.gatePoint(0);
    spot(gp.x, gp.y);
  }
  if (prizeToday(game) && currentClass(game)) spot(game.ranch.course.post.x, game.ranch.course.post.y);
  const f = game.ranch.farmhouse;
  if (f) {
    // The farmhouse as a little inked house.
    const hx = x0 + Math.round(f.cx / TS / 2), hy = y0 + Math.round(f.cy / TS / 2);
    rect(g, hx - 2, hy - 1, 5, 3, C.plum);
    rect(g, hx - 1, hy, 3, 2, C.wool);
    rect(g, hx - 1, hy - 2, 3, 1, C.plum);
    px(g, hx, hy - 3, C.plum);
  }
  // A compass in the top right corner.
  const nx = x0 + m.width - 6, ny = y0 + 3;
  rect(g, nx - 3, ny - 1, 7, 9, C.wool);
  text(g, 'N', nx, ny, C.plum, { align: 'center' });
  px(g, nx, ny + 6, C.plum);
  if (Math.floor(game.t * 3) % 2 === 0) rect(g, x0 + Math.round(game.dog.x / TS / 2) - 1, y0 + Math.round(game.dog.y / TS / 2) - 1, 3, 3, C.red);
}

interface Line { s: string; c: string; x?: number; sky?: Sky }

// Lines are written for a dark panel; on the Ledger's paper the same
// meanings take ink: wool is plum, buttercup (what matters) is teal.
const INK: Record<string, string> = { [C.wool]: C.plum, [C.butter]: C.teal, [C.sage]: C.plum, [C.teal]: C.teal, [C.plum]: C.plum };
const ink = (c: string) => INK[c] ?? C.plum;
const COIN = { iconColor: C.butter, iconRim: C.plum };

function drawLines(g: CanvasRenderingContext2D, lines: Line[], x0: number, y: number): number {
  for (const l of lines) {
    if (l.sky) {
      rect(g, x0 - 1, y - 2, 9, 9, C.plum);
      skyIcon(g, l.sky, x0, y - 1);
      text(g, l.s, x0 + 10, y, ink(l.c));
    } else if (l.s) {
      if (l.s.startsWith('#') || l.s.startsWith('- ')) {
        // A tick box, inked; a done goal is ticked in teal.
        const done = l.s.startsWith('#');
        rect(g, x0, y, 5, 5, C.plum);
        rect(g, x0 + 1, y + 1, 3, 3, C.wool);
        if (done) {
          g.fillStyle = C.teal;
          for (const [tx, ty] of [[1, 2], [2, 3], [3, 2], [4, 1], [5, 0]]) g.fillRect(x0 + tx, y + ty, 1, 1);
        }
        text(g, l.s.slice(2), x0 + 8, y, ink(l.c), COIN);
      } else text(g, l.s, x0 + (l.x ?? 0) + (l.x ? 8 : 0), y, ink(l.c), COIN);
    }
    y += l.sky ? 9 : 7;
  }
  return y;
}

const linesH = (lines: Line[]) => lines.reduce((h, l) => h + (l.sky ? 9 : 7), 0);

// More pages of the Ledger after the first (the ranch, built in): other
// features add an entry here. Each page draws into the book's paper (`r`,
// with `spine` the x of the fold on a wide screen, else 0) in ink (`PAPER_INK`:
// plum writing, teal for what matters, sage for what is not yet). `keys`
// gets the first look at the keys while its page is open (arrows, confirm,
// cancel: what it takes with `pressed()` the book never sees) and returns
// true when it used confirm or cancel, so the book stays open. `dot` puts a
// buttercup dot on its tab (something new to see).
export interface LedgerInk { text: string; accent: string; dim: string }
export const PAPER_INK: LedgerInk = { text: C.plum, accent: C.teal, dim: C.sage };
export interface LedgerPage {
  id: string;
  tab: string;
  draw: (game: Game, g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number; spine: number }, ink: LedgerInk) => void;
  keys?: (game: Game) => boolean;
  dot?: (game: Game) => boolean;
}
export const LEDGER_PAGES: LedgerPage[] = [];
// The open page (0: the ranch). The book stays open where you left it.
export const ledgerView = { page: 0 };

// The Ledger's keys; true when it should close. Q/E ([ ], LB/RB) turn the
// pages.
export function ledgerKeys(game: Game): boolean {
  const inp = game.input;
  if (inp.pressed('ledger')) return true;
  const n = LEDGER_PAGES.length + 1;
  // Read each key once: pressed() uses the press up.
  const step = inp.pressed('next') ? 1 : inp.pressed('prev') ? n - 1 : 0;
  if (n > 1 && step) {
    ledgerView.page = (ledgerView.page + step) % n;
    game.audio?.play('click');
  }
  ledgerView.page = Math.min(ledgerView.page, n - 1);
  const page = LEDGER_PAGES[ledgerView.page - 1];
  if (page?.keys?.(game)) return false;
  return inp.pressed('cancel') || inp.pressed('confirm');
}

// The Ranch Ledger: where you are, what to do, what comes next. On a wide
// screen the goals sit on the left, the map and the day's jobs on the right.
export function drawLedger(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  const ui = game.ui;
  const tier = tierOf(game.tier);
  const next = TIERS[game.tier] ?? null;
  const wide = W >= 300;
  const mapW = MW / 2, mapH = MH / 2;
  const colW = wide ? Math.min(170, W - mapW - 30) : Math.min(W - 16, 200);
  const rightW = wide ? Math.max(mapW, Math.min(140, W - colW - 34)) : colW;
  const pw = wide ? colW + rightW + 22 : colW;
  const A: Line[] = [];
  const add = (s: string, c: string = C.wool, x = 0) => A.push({ s, c, x });

  add(`TIER ${tier.n}: ${tier.name}`, C.butter);
  for (const l of wrap(tier.blurb, colW - 12)) add(l, C.sage);
  add('');
  for (const goal of tier.goals) {
    const v = Math.min(goal.target, goal.value(game));
    const done = goalDone(game, goal);
    add(`${done ? '#' : '-'} ${goal.label}`, done ? C.butter : C.wool);
    if (goal.target > 1) add(`${v}/${goal.target}`, done ? C.butter : C.sage, 8);
  }
  add('');
  if (next) {
    add(`NEXT: ${next.name}`, C.butter);
    for (const b of next.brings) for (const l of wrap(`+ ${b}`, colW - 12)) add(l, C.wool);
  } else {
    add(game.won ? 'THE VALLEY THRIVES!' : 'THE LAST TIER', C.butter);
    add('KEEP THE RANCH GROWING', C.wool);
  }
  add('');
  for (const l of valleyLedger(game, colW - 12)) add(l.s, l.c);
  add('');
  for (const l of discoveryLines(game, colW - 12)) add(l.s, l.c);
  for (const l of travelLines(colW - 12)) add(l.s, l.c);
  for (const l of projectLines(game, colW - 12)) add(l.s, l.c); // the valley projects, in the hidden places
  add('');
  const tot = game.totals;
  const deliv = Object.values(tot.delivered).reduce((s, n) => s + (n ?? 0), 0);
  add(`DAY ${game.day.day}  HOME ${deliv}  EARNED ${tot.earned}$`, C.sage);

  // The day: weather, then trials and orders.
  const B: Line[] = [
    { s: `TODAY: ${SKY_WORD[game.weather.sky]}`, c: C.wool, sky: game.weather.sky },
    { s: `TOMORROW: ${SKY_WORD[game.weather.forecast]}`, c: C.wool, sky: game.weather.forecast },
    ...jobsLedger(game, (wide ? rightW : colW) - (wide ? 2 : 12)),
  ];

  const S = safeArea(game.screen);
  const top = 16, foot = 16;
  const ph = wide ? Math.max(top + linesH(A), top + 2 + mapH + 6 + linesH(B)) + foot : top + linesH(A) + 4 + linesH(B) + 4 + mapH + 4 + foot;
  const tabs = LEDGER_PAGES.length > 0;
  const touch = game.input.touchMode;
  const tabH = touch ? 12 : 10;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2 + S.top + (tabs ? tabH + 3 : 0), Math.round(H / 2 - ph / 2));
  dimView(g, game.view());
  const page = LEDGER_PAGES[Math.min(ledgerView.page, LEDGER_PAGES.length) - 1];
  if (tabs) drawTabs(game, g, x0, y0 - 4, pw, tabH);
  book(g, x0, y0, pw, ph, wide ? colW + 11 : 0, game.t);
  heading(g, page ? page.tab : 'RANCH LEDGER', x0 + (wide ? (colW + 11) / 2 : pw / 2), y0 + 4, C.plum, { align: 'center', shade: C.teal });
  // Tier pips, inked.
  for (let i = 0; i < TIERS.length; i++) {
    const tx = x0 + pw - 7 - (TIERS.length - i) * 5;
    rect(g, tx, y0 + 5, 4, 4, C.plum);
    if (i >= game.tier) rect(g, tx + 1, y0 + 6, 2, 2, C.wool);
  }
  if (page) page.draw(game, g, { x: x0 + 7, y: y0 + top, w: pw - 14, h: ph - top - foot - 2, spine: wide ? colW + 11 - 7 : 0 }, PAPER_INK);
  else if (wide) {
    drawLines(g, A, x0 + 7, y0 + top);
    const mx = x0 + colW + 12 + Math.round((rightW - mapW) / 2);
    drawMap(game, g, mx, y0 + top + 2);
    drawLines(g, B, x0 + colW + 12, y0 + top + 2 + mapH + 6);
  } else {
    let y = drawLines(g, A, x0 + 7, y0 + top);
    y = drawLines(g, B, x0 + 7, y + 4);
    drawMap(game, g, Math.round(W / 2 - mapW / 2), y + 4);
  }

  // Close.
  const label = touch ? 'CLOSE' : tabs ? 'Q/E: PAGE  TAB: CLOSE' : 'TAB: CLOSE';
  const bw = textWidth(label) + (touch ? 16 : 10), bh = touch ? 13 : 11;
  const bx = Math.round(x0 + pw / 2 - bw / 2), by = y0 + ph - bh - 2;
  panel(g, bx, by, bw, bh, ui.isActive('ledger-close') ? C.teal : C.plum, C.butter);
  text(g, label, bx + bw / 2, by + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
  return ui.click('ledger-close', bx, by, bw, bh) || ui.captureAll('ledger-bg');
}

// The page tabs: cloth tabs standing up from the cover's top edge, the open
// page's tab in paper, joined to its page. Tap one to turn to it.
function drawTabs(game: Game, g: CanvasRenderingContext2D, x0: number, top: number, pw: number, th: number) {
  const names = ['RANCH', ...LEDGER_PAGES.map((p) => p.tab)];
  const ws = names.map((n) => textWidth(n) + (game.input.touchMode ? 10 : 8));
  let x = x0 + 4;
  // Too many for the cover: share it out evenly.
  const total = ws.reduce((a, b) => a + b + 2, 0);
  const squeeze = total > pw - 8 ? (pw - 8) / total : 1;
  names.forEach((n, i) => {
    const w = Math.floor(ws[i] * squeeze), on = i === ledgerView.page;
    const y = top - th + (on ? 0 : 1); // the open one stands a pixel taller
    rect(g, x, y, w, th + 2, C.plum);
    rect(g, x + 1, y + 1, w - 2, th + 1, on ? C.wool : C.teal);
    if (!on) for (let k = 2; k < w - 2; k += 3) px(g, x + k, y + 1, C.sage);
    text(g, n, x + w / 2, y + Math.floor((th - 5) / 2) + 1, on ? C.plum : C.wool, { align: 'center' });
    const pg = LEDGER_PAGES[i - 1];
    if (!on && pg?.dot?.(game) && Math.floor(game.t * 2) % 2 === 0) {
      rect(g, x + w - 4, y + 2, 2, 2, C.butter);
    }
    if (game.ui.click(`ledger-tab-${i}`, x, y - 2, w, th + 4) && i !== ledgerView.page) {
      ledgerView.page = i;
      game.audio?.play('click');
    }
    x += w + 2;
  });
}

// The Ledger's binding: a teal cloth cover a few pixels proud of the pages,
// buttercup corner caps, the pages themselves (two, either side of a spine,
// when `spine` is set) and a ribbon bookmark hanging from the top.
function book(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, spine: number, t: number) {
  const m = 4;
  // Cover.
  rect(g, x - m - 1, y - m, w + m * 2 + 2, h + m * 2, C.plum);
  rect(g, x - m, y - m - 1, w + m * 2, h + m * 2 + 2, C.plum);
  rect(g, x - m + 1, y - m + 1, w + m * 2 - 2, h + m * 2 - 2, C.teal);
  for (let i = 0; i < w + m * 2 - 2; i += 3) px(g, x - m + 1 + i, y - m + 1, C.sage);
  for (const [cx, cy, dx, dy] of [[x - m, y - m, 1, 1], [x + w + m - 1, y - m, -1, 1], [x - m, y + h + m - 1, 1, -1], [x + w + m - 1, y + h + m - 1, -1, -1]]) {
    rect(g, Math.min(cx, cx + dx * 3), cy, 4, 1, C.butter);
    rect(g, cx, Math.min(cy, cy + dy * 3), 1, 4, C.butter);
  }
  // Pages.
  if (spine) {
    paper(g, x, y, spine, h, { lines: 7, top: 22 });
    paper(g, x + spine, y, w - spine, h, { lines: 7, top: 22 });
    // The gutter: shade either side of the fold.
    rect(g, x + spine - 1, y + 1, 2, h - 2, C.plum);
    for (let j = 1; j < h - 1; j += 2) {
      px(g, x + spine - 2, y + j, C.sage);
      px(g, x + spine + 1, y + j + 1, C.sage);
    }
  } else paper(g, x, y, w, h, { lines: 7, top: 22 });
  // The ribbon, stirring a little.
  const rx = spine ? x + spine + 4 : x + w - 12;
  const sway = Math.floor(t * 1.5) % 2;
  rect(g, rx, y - m - 1, 3, m + 13, C.butter);
  px(g, rx + 1, y + 11, C.moss);
  rect(g, rx + sway, y + 12, 1, 2, C.butter);
  rect(g, rx + 2 - sway, y + 12, 1, 2, C.butter);
}
