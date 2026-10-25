import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { hash2 } from '../rng';
import type { Drawable } from '../art/buildings';
import { gust } from '../render/wind';
import { seasonLook, snowCap } from '../art/seasonlook';
import { TS } from '../world/map';

// Little touches that make the ranch visibly grow with each tier. They do
// not collide, and hide when the player builds over them.
export type DecorKind =
  | 'sign' | 'mailbox' | 'lantern' | 'flowers' | 'hay' | 'well' | 'bench' | 'flag'
  | 'woodpile' | 'stones' | 'garden' | 'barrels' | 'cart' | 'line' | 'hives';

export interface Decor {
  kind: DecorKind;
  x: number; // tile coords (ground point)
  y: number;
  tier: number;
  w?: number; // footprint in tiles, for hiding under buildings (default 1)
  h?: number;
}

export const DECOR: Decor[] = [
  { kind: 'sign', x: 119, y: 99, tier: 1 },
  { kind: 'mailbox', x: 92, y: 100, tier: 1 },
  { kind: 'woodpile', x: 81, y: 101, tier: 1 },
  { kind: 'stones', x: 89, y: 100, tier: 1, h: 3 },
  { kind: 'flowers', x: 87, y: 100, tier: 2 },
  { kind: 'flowers', x: 94, y: 99, tier: 2 },
  { kind: 'hay', x: 84, y: 97, tier: 2 },
  { kind: 'lantern', x: 99, y: 102, tier: 2 },
  { kind: 'lantern', x: 115, y: 102, tier: 2 },
  { kind: 'garden', x: 78, y: 94, tier: 2, w: 4, h: 2 },
  { kind: 'well', x: 84, y: 101, tier: 3 },
  { kind: 'lantern', x: 99, y: 88, tier: 3 },
  { kind: 'hay', x: 85, y: 93, tier: 3 },
  { kind: 'barrels', x: 101, y: 98, tier: 3 },
  { kind: 'cart', x: 88, y: 108, tier: 3, w: 2 },
  { kind: 'lantern', x: 77, y: 102, tier: 4 },
  { kind: 'flowers', x: 90, y: 101, tier: 4 },
  { kind: 'bench', x: 95, y: 101, tier: 4 },
  { kind: 'lantern', x: 92, y: 110, tier: 4 },
  { kind: 'line', x: 78, y: 98, tier: 4, w: 5 },
  { kind: 'flag', x: 99, y: 100, tier: 5 },
  { kind: 'flowers', x: 101, y: 106, tier: 5 },
  { kind: 'lantern', x: 108, y: 116, tier: 5 },
  { kind: 'lantern', x: 80, y: 114, tier: 5 },
  { kind: 'hives', x: 100, y: 93, tier: 5, w: 3 },
];

export function decorDrawable(g: CanvasRenderingContext2D, d: Decor, t: number, tierName: string, night: boolean): Drawable {
  const x = d.x * TS + 4, y = d.y * TS + 6;
  // The garden and the stepping stones lie flat: everything walks over them.
  const flat = d.kind === 'garden' || d.kind === 'stones';
  return { y: flat ? -1e8 : y, draw: () => drawDecor(g, d.kind, x, y, t, tierName, night) };
}

function drawDecor(g: CanvasRenderingContext2D, kind: DecorKind, x: number, y: number, t: number, tierName: string, night: boolean) {
  switch (kind) {
    case 'sign': {
      const label = `COME BY ${tierName}`;
      const w = label.length * 4 + 5;
      rect(g, x - 4, y + 1, w + 2, 1, C.sage);
      rect(g, x - 1, y - 9, 2, 10, C.plum);
      rect(g, x + w - 6, y - 9, 2, 10, C.plum);
      rect(g, x - 3, y - 16, w + 2, 9, C.plum);
      rect(g, x - 2, y - 15, w, 7, C.wool);
      rect(g, x - 2, y - 9, w, 1, C.sage);
      text(g, label, x + 1, y - 14, C.plum);
      px(g, x - 2, y - 15, C.butter);
      px(g, x + w - 3, y - 15, C.butter);
      snowCap(g, x - 3, y - 17, w + 2, y - 7);
      break;
    }
    case 'mailbox':
      rect(g, x - 1, y + 1, 3, 1, C.sage);
      rect(g, x, y - 6, 1, 7, C.plum);
      rect(g, x - 2, y - 9, 5, 3, C.wool);
      rect(g, x - 2, y - 9, 5, 1, C.plum);
      px(g, x - 2, y - 7, C.sage);
      px(g, x + 3, y - 10, C.butter);
      px(g, x + 3, y - 9, C.butter);
      break;
    case 'lantern': {
      rect(g, x - 2, y + 1, 4, 1, C.sage);
      rect(g, x, y - 10, 1, 11, C.plum);
      rect(g, x - 1, y - 1, 3, 1, C.plum);
      rect(g, x - 1, y - 13, 3, 3, night ? C.butter : C.wool);
      if (!night) px(g, x + 1, y - 13, C.sage);
      rect(g, x - 2, y - 14, 5, 1, C.plum);
      px(g, x, y - 15, C.plum);
      snowCap(g, x - 2, y - 15, 5);
      break;
    }
    case 'flowers':
      if (seasonLook.snow > 0.5) break;
      for (let i = 0; i < (seasonLook.bloom > 0.5 ? 11 : 7); i++) {
        const fx = x - 5 + ((i * 5) % 11), fy = y - (i % 3);
        px(g, fx, fy, C.sage);
        // Heads nod as a gust goes by.
        const lean = gust(fx, fy, t) > 0.5 ? 1 : 0;
        px(g, fx + lean, fy - 1, i % 3 === 0 ? C.wool : C.butter);
      }
      break;
    case 'hay':
      rect(g, x - 5, y + 1, 9, 1, C.sage);
      rect(g, x - 4, y - 4, 8, 5, C.butter);
      for (let i = 0; i < 8; i += 2) px(g, x - 4 + i, y - 4 + (i % 4 ? 1 : 0), C.wool);
      line(g, x - 4, y - 2, x + 3, y - 2, C.moss);
      rect(g, x - 1, y - 4, 1, 5, C.plum);
      rect(g, x - 4, y, 8, 1, C.moss);
      // Loose wisps at the ends and scattered round it.
      px(g, x - 5, y - 3, C.butter);
      px(g, x + 4, y - 2, C.butter);
      px(g, x + 4, y - 4, C.butter);
      px(g, x - 6, y + 1, C.butter);
      px(g, x + 6, y, C.butter);
      px(g, x + 2, y + 2, C.butter);
      snowCap(g, x - 4, y - 5, 8);
      break;
    case 'well':
      rect(g, x - 6, y + 1, 11, 1, C.sage);
      rect(g, x - 5, y - 4, 10, 5, C.wool);
      for (let i = 0; i < 10; i += 3) px(g, x - 5 + i, y - 2, C.sage);
      rect(g, x - 5, y - 4, 1, 5, C.sage);
      rect(g, x - 4, y - 4, 8, 2, C.teal);
      px(g, x + 2, y - 4, C.wool);
      rect(g, x - 5, y - 12, 1, 9, C.plum);
      rect(g, x + 4, y - 12, 1, 9, C.plum);
      // A little roof over the winch, a rope and a bucket.
      rect(g, x - 6, y - 14, 12, 1, C.plum);
      rect(g, x - 5, y - 15, 10, 1, C.teal);
      rect(g, x - 3, y - 16, 6, 1, C.plum);
      snowCap(g, x - 5, y - 16, 10, y - 13);
      rect(g, x - 4, y - 11, 8, 1, C.plum);
      rect(g, x, y - 10, 1, 4, C.wool);
      rect(g, x - 1, y - 7, 3, 2, C.teal);
      px(g, x - 1, y - 7, C.plum);
      break;
    case 'bench':
      rect(g, x - 5, y + 1, 10, 1, C.sage);
      rect(g, x - 4, y - 3, 9, 2, C.plum);
      rect(g, x - 4, y - 3, 9, 1, C.moss);
      rect(g, x - 4, y - 1, 1, 2, C.plum);
      rect(g, x + 4, y - 1, 1, 2, C.plum);
      rect(g, x - 4, y - 6, 9, 1, C.plum);
      rect(g, x - 4, y - 5, 1, 2, C.plum);
      rect(g, x + 4, y - 5, 1, 2, C.plum);
      snowCap(g, x - 4, y - 4, 9);
      break;
    case 'flag': {
      rect(g, x - 1, y + 1, 3, 1, C.sage);
      rect(g, x, y - 18, 1, 19, C.plum);
      px(g, x, y - 19, C.butter);
      const wave = gust(x, y, t) > 0.5 ? 1 : Math.floor(t * 3) % 2;
      rect(g, x + 1, y - 18, 6, 2, C.butter);
      rect(g, x + 1, y - 16 + wave, 6, 2, C.wool);
      px(g, x + 7, y - 17 + wave, C.butter);
      break;
    }
    case 'woodpile':
      // Split logs stacked by the chopping block, an axe in it.
      rect(g, x - 7, y + 1, 12, 1, C.sage);
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 4 - r; i++) {
          const lx = x - 6 + i * 3 + r, ly = y - 1 - r * 2;
          rect(g, lx, ly, 2, 2, C.plum);
          px(g, lx, ly, C.butter);
        }
      rect(g, x + 4, y - 2, 3, 3, C.plum);
      rect(g, x + 4, y - 2, 3, 1, C.butter);
      px(g, x + 5, y - 4, C.plum);
      px(g, x + 5, y - 3, C.plum);
      px(g, x + 6, y - 4, C.wool);
      break;
    case 'stones':
      // Stepping stones from the door down to the road.
      for (let i = 0; i < 4; i++) {
        const sx = x - 1 + (i % 2 ? 2 : 0), sy = y - 4 + i * 6;
        rect(g, sx, sy, 3, 2, C.wool);
        px(g, sx, sy + 1, C.sage);
        rect(g, sx, sy + 2, 3, 1, C.moss);
      }
      break;
    case 'garden': {
      // Rows of vegetables in dark soil behind a low wattle fence.
      const x0 = x - 4, y0 = y - 6, w = 32, h = 13;
      rect(g, x0 - 1, y0 + h, w + 2, 1, C.sage);
      for (let r = 0; r < 3; r++) {
        const ry = y0 + 2 + r * 4;
        rect(g, x0 + 1, ry + 1, w - 2, 2, C.moss);
        rect(g, x0 + 1, ry + 2, w - 2, 1, C.sage);
        for (let i = x0 + 2; i < x0 + w - 2; i += 3) {
          const k = hash2(i, ry, 7);
          px(g, i, ry, r === 1 ? C.teal : C.sage);
          px(g, i - 1, ry + 1, r === 1 ? C.teal : C.sage);
          px(g, i + 1, ry + 1, r === 1 ? C.teal : C.sage);
          if (r === 2 && k < 0.5) px(g, i, ry + 1, C.butter);
          if (r === 0 && k < 0.3) px(g, i, ry - 1, C.wool);
        }
      }
      for (let i = x0; i < x0 + w; i += 2) px(g, i, y0 + h - 1, C.plum);
      rect(g, x0, y0 + h - 2, w, 1, C.plum);
      rect(g, x0, y0 + 1, 1, h - 1, C.plum);
      rect(g, x0 + w - 1, y0 + 1, 1, h - 1, C.plum);
      if (seasonLook.snow > 0.4) for (let yy = y0 + 1; yy < y0 + h - 2; yy++) for (let xx = x0 + 1; xx < x0 + w - 1; xx++) if (hash2(xx, yy, 9) < seasonLook.snow * 0.9) px(g, xx, yy, C.wool);
      break;
    }
    case 'barrels':
      rect(g, x - 6, y + 1, 12, 1, C.sage);
      for (const bx of [x - 5, x + 1]) {
        rect(g, bx, y - 6, 5, 7, C.plum);
        rect(g, bx, y - 6, 5, 1, C.moss);
        rect(g, bx, y - 4, 5, 1, C.sage);
        rect(g, bx, y - 1, 5, 1, C.sage);
        px(g, bx + 3, y - 5, C.teal);
      }
      rect(g, x - 2, y - 11, 5, 5, C.plum);
      rect(g, x - 2, y - 11, 5, 1, C.wool);
      rect(g, x - 2, y - 8, 5, 1, C.wool);
      snowCap(g, x - 5, y - 7, 10);
      snowCap(g, x - 2, y - 12, 5);
      break;
    case 'cart': {
      // A hay cart resting on its shafts.
      rect(g, x - 6, y + 1, 16, 1, C.sage);
      rect(g, x - 5, y - 7, 13, 4, C.plum);
      rect(g, x - 5, y - 7, 13, 1, C.moss);
      for (let i = 0; i < 12; i++) px(g, x - 4 + i, y - 8 - (i % 3 === 0 ? 1 : 0), C.butter);
      rect(g, x - 4, y - 9, 11, 1, C.butter);
      line(g, x + 8, y - 4, x + 13, y, C.plum);
      for (const wx of [x - 3, x + 4]) {
        rect(g, wx - 1, y - 4, 4, 5, C.plum);
        rect(g, wx, y - 3, 2, 3, C.wool);
        px(g, wx, y - 2, C.plum);
      }
      break;
    }
    case 'line': {
      // Washing on a line between two posts, flapping in the gusts.
      const x1 = x + 32;
      rect(g, x - 1, y + 1, 3, 1, C.sage);
      rect(g, x1 - 1, y + 1, 3, 1, C.sage);
      rect(g, x, y - 12, 1, 13, C.plum);
      rect(g, x1, y - 12, 1, 13, C.plum);
      for (let i = 1; i < 32; i++) px(g, x + i, y - 11 + (i > 6 && i < 26 ? 1 : 0), C.wool);
      const cloth: [number, number, string][] = [[5, 4, C.wool], [11, 5, C.butter], [18, 4, C.teal], [24, 3, C.wool]];
      for (const [cx, w, col] of cloth) {
        const gx = x + cx;
        const lift = gust(gx, y, t) > 0.45 ? 1 : 0;
        for (let i = 0; i < w; i++) {
          const hgt = 5 - (lift && i === w - 1 ? 2 : 0);
          rect(g, gx + i + (lift && i > 0 ? 1 : 0), y - 10, 1, hgt, col);
        }
        px(g, gx, y - 10, C.plum);
      }
      break;
    }
    case 'hives': {
      // Three skeps and their bees, busy by day.
      for (let i = 0; i < 3; i++) {
        const hx = x - 2 + i * 8;
        rect(g, hx - 3, y + 1, 7, 1, C.sage);
        rect(g, hx - 3, y - 3, 7, 4, C.butter);
        rect(g, hx - 2, y - 5, 5, 2, C.butter);
        rect(g, hx - 1, y - 6, 3, 1, C.butter);
        rect(g, hx - 3, y - 2, 7, 1, C.moss);
        rect(g, hx - 2, y - 4, 5, 1, C.moss);
        px(g, hx, y, C.plum);
        snowCap(g, hx - 1, y - 7, 3);
      }
      if (!night && seasonLook.snow < 0.3)
        for (let k = 0; k < 5; k++) {
          const bx = x + 6 + Math.round(Math.sin(t * (3 + k) + k * 2) * 10);
          const by = y - 6 + Math.round(Math.cos(t * (2.3 + k * 0.7) + k) * 4);
          px(g, bx, by, Math.floor(t * 12 + k) % 2 ? C.plum : C.butter);
        }
      break;
    }
  }
}

// Night light from decor (lanterns) in world pixels: a pool on the ground
// round the lantern's foot.
export function decorLights(tier: number): { x: number; y: number; r: number }[] {
  return DECOR.filter((d) => d.kind === 'lantern' && d.tier <= tier).map((d) => ({ x: d.x * TS + 4, y: d.y * TS + 2, r: 36 }));
}

// The lit lanterns' own glow, drawn above the dark.
export function drawLampGlow(g: CanvasRenderingContext2D, tier: number, t: number) {
  for (const d of DECOR) {
    if (d.kind !== 'lantern' || d.tier > tier) continue;
    const x = d.x * TS + 4, y = d.y * TS + 6 - 12;
    rect(g, x - 1, y - 1, 3, 3, C.butter);
    if (Math.sin(t * 9 + d.x) > -0.6) {
      px(g, x, y - 3, C.butter);
      px(g, x - 3, y, C.butter);
      px(g, x + 3, y, C.butter);
    }
  }
}
