import { C, U32 } from '../palette';
import { ditherRect, panel, rect, px } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
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
import { discoveryLines, drawFog, drawPlaceMarks, drawProjectMarks, projectLines } from './discovery';
import { travelLines } from '../net/travels';

let mini: HTMLCanvasElement | null = null;

// Two tiles per pixel.
function minimap(map: WorldMap): HTMLCanvasElement {
  if (mini) return mini;
  const w = MW / 2, h = MH / 2;
  const [c, g] = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = map.t(x * 2, y * 2);
      const path = map.path[y * 2 * MW + x * 2];
      buf[y * w + x] = t === Ter.Forest ? ((x + y) % 3 === 0 ? U32.plum : U32.teal)
        : t === Ter.Rock ? U32.wool
        : t === Ter.Water ? U32.plum
        : t === Ter.Shallow ? U32.sage
        : path ? U32.moss : U32.meadow;
    }
  g.putImageData(img, 0, 0);
  mini = c;
  return c;
}

function drawMap(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number) {
  const m = minimap(game.map);
  rect(g, x0 - 1, y0 - 1, m.width + 2, m.height + 2, C.plum);
  g.drawImage(m, x0, y0);
  drawFog(game, g, x0, y0);
  for (const r of REGIONS) {
    const cx = x0 + Math.round(r.cx / 2), cy = y0 + Math.round(r.cy / 2);
    if (r.tier > game.tier) {
      ditherRect(g, cx - r.rx / 2, cy - r.ry / 2, r.rx, r.ry, 9, C.plum);
      // Padlock.
      rect(g, cx - 2, cy - 1, 5, 4, C.butter);
      rect(g, cx - 1, cy - 3, 3, 1, C.butter);
      px(g, cx - 1, cy - 2, C.butter);
      px(g, cx + 1, cy - 2, C.butter);
      text(g, `T${r.tier}`, cx, cy + 5, C.wool, { align: 'center' });
    }
  }
  drawPlaceMarks(game, g, x0, y0);
  drawProjectMarks(game, g, x0, y0);
  // Groups out in the pastures, then the dog (blinking bandana red).
  for (const gr of game.groups) {
    if (!game.discovery.known(gr.x, gr.y)) continue; // no flocks in the fog
    const gx = x0 + Math.round(gr.x / TS / 2), gy = y0 + Math.round(gr.y / TS / 2);
    rect(g, gx - 1, gy - 1, 2, 2, C.wool);
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
    const hx = x0 + Math.round(f.cx / TS / 2), hy = y0 + Math.round(f.cy / TS / 2);
    rect(g, hx - 2, hy - 1, 5, 3, C.wool);
    rect(g, hx - 1, hy - 2, 3, 1, C.plum);
  }
  if (Math.floor(game.t * 3) % 2 === 0) rect(g, x0 + Math.round(game.dog.x / TS / 2) - 1, y0 + Math.round(game.dog.y / TS / 2) - 1, 3, 3, C.red);
}

interface Line { s: string; c: string; x?: number; sky?: Sky }

function drawLines(g: CanvasRenderingContext2D, lines: Line[], x0: number, y: number): number {
  for (const l of lines) {
    if (l.sky) {
      skyIcon(g, l.sky, x0, y - 1);
      text(g, l.s, x0 + 10, y, l.c);
    } else if (l.s) {
      if (l.s.startsWith('#') || l.s.startsWith('- ')) {
        const done = l.s.startsWith('#');
        rect(g, x0, y, 5, 5, done ? C.butter : C.sage);
        if (!done) rect(g, x0 + 1, y + 1, 3, 3, C.plum);
        text(g, l.s.slice(2), x0 + 8, y, l.c, { iconColor: C.butter });
      } else text(g, l.s, x0 + (l.x ?? 0) + (l.x ? 8 : 0), y, l.c, { iconColor: C.butter });
    }
    y += l.sky ? 9 : 7;
  }
  return y;
}

const linesH = (lines: Line[]) => lines.reduce((h, l) => h + (l.sky ? 9 : 7), 0);

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
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2 + S.top, Math.round(H / 2 - ph / 2));
  dimView(g, game.view());
  panel(g, x0, y0, pw, ph);
  text(g, 'RANCH LEDGER', x0 + pw / 2, y0 + 4, C.butter, { align: 'center' });
  rect(g, x0 + 5, y0 + 11, pw - 10, 1, C.sage);
  // Tier pips.
  for (let i = 0; i < TIERS.length; i++) rect(g, x0 + pw - 8 - (TIERS.length - i) * 5, y0 + 4, 4, 4, i < game.tier ? C.butter : C.sage);
  if (wide) {
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
  const touch = game.input.touchMode;
  const label = touch ? 'CLOSE' : 'TAB: CLOSE';
  const bw = textWidth(label) + (touch ? 16 : 10), bh = touch ? 13 : 11;
  const bx = Math.round(x0 + pw / 2 - bw / 2), by = y0 + ph - bh - 2;
  panel(g, bx, by, bw, bh, ui.isActive('ledger-close') ? C.teal : C.plum, C.butter);
  text(g, label, bx + bw / 2, by + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
  return ui.click('ledger-close', bx, by, bw, bh) || ui.captureAll('ledger-bg');
}
