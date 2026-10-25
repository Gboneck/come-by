import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { DayStats, Game } from '../game';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import { nextGoal } from '../systems/progression';
import { drawCover } from './feel';
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
}

const ROW_STEP = 0.07; // rows of the card arrive one after another
export const SUMMARY_READY = 0.6; // matches the input delay in game.ts

// End-of-day card. Every day ends with a choice: build, or go again.
export function drawSummary(game: Game, g: CanvasRenderingContext2D, W: number, H: number): 'next' | 'build' | null {
  const s = game.summary!;
  const ui = game.ui;
  const age = game.summaryT;
  const touch = game.input.touchMode;
  const pw = Math.min(W - 16, 168);
  const lines: [string, string, string?][] = [];
  const delivered = SPECIES_ORDER.filter((id) => s.stats.delivered[id]);
  if (delivered.length === 0) lines.push(['DELIVERED', 'NONE']);
  for (const id of delivered) {
    const n = s.stats.delivered[id]!;
    lines.push(['DELIVERED', `${n} ${(n === 1 ? SPECIES[id].name : SPECIES[id].plural).toUpperCase()}`]);
  }
  if (s.stats.calm > 0) lines.push(['  CALM BONUS', `${s.stats.calm} X1.5`, C.butter]);
  const lost = SPECIES_ORDER.reduce((n, id) => n + (s.stats.lost[id] ?? 0), 0);
  lines.push(['LOST', `${lost}`, lost ? C.butter : undefined]);
  lines.push(['LEFT OUT', `${s.leftOut}`]);
  lines.push(['PENNED', `${s.penned}`]);
  if (s.stats.goodsValue) lines.push(['GOODS SOLD', `+${s.stats.goodsValue}$`, C.butter]);
  // The day's takings count up once their row is in.
  const earned = s.stats.deliveredValue + s.stats.goodsValue;
  const earnAge = age - (lines.length + 1) * ROW_STEP;
  const counted = Math.round(earned * Math.min(1, Math.max(0, earnAge / 0.5)));
  lines.push(['EARNED', `+${counted}$`, C.butter]);
  lines.push(['PURSE', `${s.coins}$`, C.butter]);
  const ng = nextGoal(game);
  const goal = ng ? `${ng.goal.label}${ng.goal.target > 1 ? ` ${Math.min(ng.value, ng.goal.target)}/${ng.goal.target}` : ''}` : null;
  const build = s.buildable ?? [];
  const bh = touch ? 15 : 13;
  const ph = 30 + lines.length * 8 + 5 + (goal ? 7 : 0) + 9 + (build.length ? 12 + Math.ceil(build.length / 2) * 8 : 0) + bh + 9;
  const px0 = Math.round(W / 2 - pw / 2);
  // The card drops in as the fade clears.
  const drop = Math.round(Math.max(0, 1 - age / 0.25) * -16);
  const py0 = Math.round(H / 2 - ph / 2) + drop;
  drawCover(g, W, H, Math.min(8, age * 40));
  panel(g, px0, py0, pw, ph);
  text(g, `DAY ${s.day} IS DONE`, W / 2, py0 + 6, C.butter, { align: 'center', scale: 1 });
  rect(g, px0 + 6, py0 + 14, pw - 12, 1, C.sage);
  let y = py0 + 20;
  lines.forEach(([k, v, col], i) => {
    if (age >= (i + 1) * ROW_STEP) {
      text(g, k, px0 + 8, y, C.wool);
      text(g, v, px0 + pw - 8, y, col ?? C.wool, { align: 'right', iconColor: C.butter });
    }
    y += 8;
  });
  const late = age >= (lines.length + 2) * ROW_STEP;
  // What comes next: the goal, and tomorrow's sky.
  rect(g, px0 + 6, y + 1, pw - 12, 1, C.sage);
  y += 5;
  if (goal) {
    if (late) {
      text(g, 'NEXT GOAL', px0 + 8, y, C.sage);
      text(g, goal, px0 + pw - 8, y, C.wool, { align: 'right', iconColor: C.butter });
    }
    y += 7;
  }
  if (late) {
    const sky = game.weather.forecast, word = SKY_WORD[sky];
    text(g, 'TOMORROW', px0 + 8, y + 1, C.sage);
    text(g, word, px0 + pw - 8, y + 1, C.wool, { align: 'right' });
    skyIcon(g, sky, px0 + pw - 8 - textWidth(word) - 10, y);
  }
  y += 9;
  if (build.length) {
    rect(g, px0 + 6, y + 1, pw - 12, 1, C.sage);
    y += 5;
    if (late) {
      text(g, 'NOW YOU CAN BUILD', px0 + 8, y, C.butter);
      build.forEach((b, i) => {
        text(g, b, px0 + 8 + (i % 2) * (pw / 2 - 4), y + 8 + Math.floor(i / 2) * 8, C.wool, { iconColor: C.butter });
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
