import { C } from '../palette';
import { rect } from '../gfx/draw';
import { panel, paper, rule, stamp } from './frame';
import { heading, text, textWidth } from '../gfx/font';
import { calendar } from '../systems/season';
import type { DayStats, Game } from '../game';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import { nextGoal } from '../systems/progression';
import { dimView } from './feel';
import { drawSale, saleLen, type Sale } from './sale';
import { sentence } from './case';
import { SKY_WORD, skyIcon } from './icons';

export interface Summary {
  day: number;
  stats: DayStats;
  leftOut: number;
  strays: number;
  coins: number;
  penned: number;
  buildable?: string[];
  lost?: number;
  sale?: Sale; // the day's goods, sold as the cart comes by
  saleSkipped?: boolean;
}

const ROW_STEP = 0.07; // rows of the card arrive one after another
export const SUMMARY_READY = 0.6; // matches the input delay in game.ts

// Tape at a corner of the page: a strip of teal, dithered so it reads as
// paper tape and not a block.
function tape(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  for (let i = 0; i < w; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 3 === 0 ? C.sage : C.teal;
      g.fillRect(x + i, y + j, 1, 1);
    }
}

// End-of-day card: a page from the ranch journal. Every day ends with a
// choice: build, or go again.
export function drawSummary(game: Game, g: CanvasRenderingContext2D, W: number, H: number): 'next' | 'build' | null {
  const s = game.summary!;
  const ui = game.ui;
  // First the cart comes for the day's goods (ui/sale.ts).
  const sale = saleLen(s);
  if (game.summaryT < sale) {
    drawSale(game, g, W, H, game.summaryT);
    return null;
  }
  const age = game.summaryT - sale;
  const touch = game.input.touchMode;
  const pw = Math.min(W - 16, 168);
  const lines: [string, string, string?][] = [];
  const delivered = SPECIES_ORDER.filter((id) => s.stats.delivered[id]);
  if (delivered.length === 0) lines.push(['DELIVERED', 'NONE']);
  for (const id of delivered) {
    const n = s.stats.delivered[id]!;
    lines.push(['DELIVERED', `${n} ${(n === 1 ? SPECIES[id].name : SPECIES[id].plural).toUpperCase()}`]);
  }
  if (s.stats.calm > 0) lines.push(['  CALM BONUS', `${s.stats.calm} X1.5`, C.teal]);
  const lost = SPECIES_ORDER.reduce((n, id) => n + (s.stats.lost[id] ?? 0), 0);
  lines.push(['LOST', `${lost}`, lost ? C.teal : undefined]);
  lines.push(['LEFT OUT', `${s.leftOut}`]);
  lines.push(['PENNED', `${s.penned}`]);
  if (s.stats.goodsValue) lines.push(['GOODS SOLD', `+${s.stats.goodsValue}$`, C.teal]);
  // The day's takings count up once their row is in.
  const earned = s.stats.deliveredValue + s.stats.goodsValue;
  const earnAge = age - (lines.length + 1) * ROW_STEP;
  const counted = Math.round(earned * Math.min(1, Math.max(0, earnAge / 0.5)));
  lines.push(['EARNED', `+${counted}$`, C.teal]);
  lines.push(['PURSE', `${s.coins}$`, C.plum]);
  const ng = nextGoal(game);
  const goal = ng ? `${ng.goal.label}${ng.goal.target > 1 ? ` ${Math.min(ng.value, ng.goal.target)}/${ng.goal.target}` : ''}` : null;
  const build = s.buildable ?? [];
  const bh = touch ? 15 : 13;
  const ph = 34 + lines.length * 8 + 5 + (goal ? 8 : 0) + 9 + (build.length ? 12 + Math.ceil(build.length / 2) * 8 : 0) + bh + 9;
  const px0 = Math.round(W / 2 - pw / 2);
  // The card drops in as the fade clears.
  const drop = Math.round(Math.max(0, 1 - age / 0.25) * -16);
  const py0 = Math.round(H / 2 - ph / 2) + drop;
  dimView(g, game.view(), Math.min(8, age * 40));
  // The page: ruled, a margin, tape at the top corners.
  paper(g, px0, py0, pw, ph, { lines: 8, top: 30, margin: true });
  tape(g, px0 - 3, py0 - 2, 12);
  tape(g, px0 + pw - 9, py0 - 2, 12);
  const ink = C.plum, ink2 = C.teal;
  const cal = calendar(s.day);
  const dw = heading(g, `DAY ${s.day}`, px0 + 13, py0 + 6, ink, { shade: ink2 });
  // The season beside the day; a calm day's stamp at the right.
  text(g, `${cal.season[0].toUpperCase()}${cal.season.slice(1)}, year ${cal.year}`, px0 + 13 + dw + 6, py0 + 8, C.sage);
  rect(g, px0 + 4, py0 + 16, pw - 8, 1, ink);
  rect(g, px0 + 4, py0 + 18, pw - 8, 1, ink);
  let y = py0 + 24;
  const iconOpts = { iconColor: C.butter, iconRim: C.plum };
  lines.forEach(([k, v, col], i) => {
    if (age >= (i + 1) * ROW_STEP) {
      text(g, sentence(k), px0 + 13, y, ink, iconOpts);
      text(g, sentence(v), px0 + pw - 6, y, col ?? ink, { align: 'right', ...iconOpts });
    }
    y += 8;
  });
  const late = age >= (lines.length + 2) * ROW_STEP;
  // A calm day earns the page a stamp.
  if (s.stats.calm > 0 && late) stamp(g, 'CALM', px0 + pw - 24, py0 + 9, C.teal);
  // What comes next: the goal, and tomorrow's sky.
  rule(g, px0 + 4, y + 1, pw - 8, C.plum);
  y += 5;
  if (goal) {
    if (late) {
      text(g, 'Next goal', px0 + 13, y, ink2);
      text(g, sentence(goal), px0 + pw - 6, y, ink, { align: 'right', ...iconOpts });
    }
    y += 8;
  }
  if (late) {
    const sky = game.weather.forecast, word = sentence(SKY_WORD[sky]);
    text(g, 'Tomorrow', px0 + 13, y + 1, ink2);
    text(g, word, px0 + pw - 6, y + 1, ink, { align: 'right' });
    g.fillStyle = C.plum;
    g.fillRect(px0 + pw - 6 - textWidth(word) - 11, y - 1, 9, 9);
    skyIcon(g, sky, px0 + pw - 6 - textWidth(word) - 10, y);
  }
  y += 9;
  if (build.length) {
    rule(g, px0 + 4, y + 1, pw - 8, C.plum);
    y += 5;
    if (late) {
      text(g, 'Now you can build', px0 + 13, y, ink2);
      build.forEach((b, i) => {
        text(g, sentence(b), px0 + 13 + (i % 2) * (pw / 2 - 6), y + 8 + Math.floor(i / 2) * 8, ink, iconOpts);
      });
    }
    y += 8 + Math.ceil(build.length / 2) * 8;
  }
  // Buttons: BUILD is the recommended choice when something is affordable.
  // They only take input once the card is fully in.
  const ready = age >= SUMMARY_READY;
  const bw = Math.min(74, (pw - 18) / 2), by = py0 + ph - bh - 5;
  const bx1 = Math.round(W / 2 - bw - 3), bx2 = Math.round(W / 2 + 3);
  const pulse = ready && Math.floor(game.t * 2) % 2 === 0;
  const wantBuild = build.length > 0;
  const ty = by + Math.floor((bh - 5) / 2);
  const hot1 = ui.isActive('sbuild') || (ready && ui.hovering(bx1, by, bw, bh)), hot2 = ui.isActive('next') || (ready && ui.hovering(bx2, by, bw, bh));
  panel(g, bx1, by, bw, bh, hot1 || (wantBuild && pulse) ? C.teal : C.plum, wantBuild ? C.butter : C.sage);
  text(g, touch ? 'BUILD' : 'B: BUILD', bx1 + bw / 2, ty, ready ? C.wool : C.sage, { align: 'center' });
  panel(g, bx2, by, bw, bh, hot2 || (!wantBuild && pulse) ? C.teal : C.plum, wantBuild ? C.sage : C.butter);
  text(g, touch ? 'NEXT DAY' : 'SPACE: NEXT DAY', bx2 + bw / 2, ty, ready ? C.wool : C.sage, { align: 'center' });
  const p = touch ? 3 : 0;
  if (ui.click('sbuild', bx1 - p, by - p, bw + p, bh + p * 2) && ready) return 'build';
  if (ui.click('next', bx2, by - p, bw + p, bh + p * 2) && ready) return 'next';
  ui.captureAll('summary-bg');
  return null;
}
