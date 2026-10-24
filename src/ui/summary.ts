import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import type { DayStats } from '../game';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import type { UI } from './ui';

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

// End-of-day card. Returns true when the player taps "next day".
export function drawSummary(g: CanvasRenderingContext2D, ui: UI, s: Summary, W: number, H: number, t: number): boolean {
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
  lines.push(['EARNED', `+${s.stats.deliveredValue + s.stats.goodsValue}$`, C.butter]);
  lines.push(['PURSE', `${s.coins}$`, C.butter]);
  const build = s.buildable ?? [];
  const ph = 30 + lines.length * 8 + (build.length ? 12 + Math.ceil(build.length / 2) * 8 : 0) + 22;
  const px0 = Math.round(W / 2 - pw / 2), py0 = Math.round(H / 2 - ph / 2);
  panel(g, px0, py0, pw, ph);
  text(g, `DAY ${s.day} IS DONE`, W / 2, py0 + 6, C.butter, { align: 'center', scale: 1 });
  rect(g, px0 + 6, py0 + 14, pw - 12, 1, C.sage);
  let y = py0 + 20;
  for (const [k, v, col] of lines) {
    text(g, k, px0 + 8, y, C.wool);
    text(g, v, px0 + pw - 8, y, col ?? C.wool, { align: 'right', iconColor: C.butter });
    y += 8;
  }
  if (build.length) {
    rect(g, px0 + 6, y + 1, pw - 12, 1, C.sage);
    y += 5;
    text(g, 'NOW YOU CAN BUILD', px0 + 8, y, C.butter);
    y += 8;
    build.forEach((b, i) => {
      text(g, b, px0 + 8 + (i % 2) * (pw / 2 - 4), y + Math.floor(i / 2) * 8, C.wool, { iconColor: C.butter });
    });
    y += Math.ceil(build.length / 2) * 8;
  }
  // Button.
  const bw = 70, bh = 13, bx = Math.round(W / 2 - bw / 2), by = py0 + ph - 18;
  const hot = ui.isActive('next') || Math.floor(t * 2) % 2 === 0;
  panel(g, bx, by, bw, bh, hot ? C.teal : C.plum, C.butter);
  text(g, 'NEXT DAY', W / 2, by + 4, C.wool, { align: 'center' });
  return ui.click('next', bx, by, bw, bh);
}
