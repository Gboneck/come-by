import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { hash2 } from '../rng';
import type { Drawable } from '../art/buildings';
import { gust } from '../render/wind';
import { seasonLook, snowCap } from '../art/seasonlook';
import { TS } from '../world/map';
import { PX, fine } from '../gfx/screen';
import { grid, gridAt } from '../art/fine';

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

// The ranch's little things, on the fine grid (two fine pixels to a world
// pixel). (x, y) is the foot in world pixels.
const MAILBOX = [
  '......yy..',
  '......yp..',
  '..wwwwwp..',
  '.wwwwwwws.',
  '.wppppwws.',
  '.wwwwwwws.',
  '..sssssss.',
  '....ps....',
  '....ps....',
  '....ps....',
  '....ps....',
  '....ps....',
  '....ps....',
  '...ppps...',
];
const LANTERN = [
  '....p....',
  '...ppp...',
  '..ppppp..',
  '..pGGGp..',
  '..pGgGp..',
  '..pGGGp..',
  '..ppppp..',
  '...ppp...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '....ps...',
  '...ppps..',
  '..ppppps.',
];
const HAYBALE = [
  '..y.yy..y.yy..y...',
  '.yyyyyyyyyyyyyyyy.',
  'yywyyyyywyyyyyywyy',
  'yyyyyppyyyyyyppyyy',
  'yoyyyppyyyoyyppyoy',
  'yyyyyppyyyyyyppyyy',
  'yyyoyppyyyyoyppyyy',
  'oooooppoooooopoooo',
  '.ooooppoooooopooo.',
];
const WELL_STONES = [
  '..wwwwwwwwwwwwwwww..',
  '.wtttttttttttttttts.',
  'wwwttttttttwttttttsw',
  'wswwswwwswwwswwwswws',
  'wwswwwswwwswwwswwwsw',
  'swwwswwwswwwswwwswws',
  'wwswwwswwwswwwswwwss',
  '.ssssssssssssssssss.',
];
const BENCH = [
  'pppppppppppppppppp',
  'ooooooooooooooooop',
  'p................p',
  'p................p',
  'pppppppppppppppppp',
  'ooooooooooooooooos',
  'pppppppppppppppppp',
  'p.p............p.p',
  'p.p............p.p',
  'p.p............p.p',
];
const BARREL = [
  '.wwwwwwww.',
  'wppppppppw',
  'pspppppstp',
  'ssssssssss',
  'pppppppptp',
  'ppspppppsp',
  'pppppppptp',
  'ssssssssss',
  'pppppppptp',
  'ppppspppsp',
  'pppppppptp',
  'ssssssssss',
  '.pppppppp.',
];
const SKEP = [
  '....yyy....',
  '...yyyyy...',
  '..ooooooo..',
  '..yyyyyyy..',
  '.ooooooooo.',
  '.yyyyyyyyy.',
  'ooooooooooo',
  'yyyyyyyyyyy',
  'yyyyyppyyyy',
  'ooooopppooo',
];

function drawDecor(g: CanvasRenderingContext2D, kind: DecorKind, x: number, y: number, t: number, tierName: string, night: boolean) {
  const X = x * PX, B = y * PX + 1;
  switch (kind) {
    case 'sign': {
      const label = `COME BY ${tierName}`;
      const w = label.length * 4 + 5;
      fine(g, (fg) => {
        const L = (x - 3) * PX, R = (x + w - 1) * PX, T = (y - 16) * PX;
        rect(fg, L - 2, B + 1, R - L + 4, 1, C.sage);
        for (const px0 of [X - 2, (x + w - 6) * PX]) {
          rect(fg, px0, T + 16, 4, B - T - 15, C.plum);
          rect(fg, px0 + 3, T + 16, 1, B - T - 15, C.sage);
        }
        // A board with a plum frame, its planks' seams, brass corners.
        rect(fg, L, T, R - L, 18, C.plum);
        rect(fg, L + 2, T + 2, R - L - 4, 14, C.wool);
        rect(fg, L + 2, T + 8, R - L - 4, 1, C.sage);
        rect(fg, L + 2, T + 15, R - L - 4, 1, C.sage);
        for (const cx of [L + 2, R - 3]) for (const cy of [T + 2, T + 14]) px(fg, cx, cy, C.butter);
      });
      text(g, label, x + 1, y - 14, C.plum);
      snowCap(g, x - 3, y - 17, w + 2, y - 7);
      break;
    }
    case 'mailbox':
      fine(g, (fg) => {
        rect(fg, X - 3, B + 1, 8, 1, C.sage);
        gridAt(fg, MAILBOX, X, B);
      });
      break;
    case 'lantern':
      fine(g, (fg) => {
        rect(fg, X - 4, B + 1, 9, 1, C.sage);
        gridAt(fg, LANTERN, X, B, night ? { G: C.butter, g: C.wool } : { G: C.wool, g: C.sage });
      });
      snowCap(g, x - 2, y - 15, 5);
      break;
    case 'flowers':
      if (seasonLook.snow > 0.5) break;
      fine(g, (fg) => {
        const n = seasonLook.bloom > 0.5 ? 11 : 7;
        for (let i = 0; i < n; i++) {
          const fx = X - 10 + ((i * 9) % 21), fy = B - (i % 3) * 2;
          // Heads nod as a gust goes by.
          const lean = gust(fx >> 1, fy >> 1, t) > 0.5 ? 1 : 0;
          rect(fg, fx, fy - 3, 1, 4, C.sage);
          px(fg, fx - 1, fy - 1, C.moss);
          const col = i % 3 === 0 ? C.wool : C.butter;
          rect(fg, fx - 1 + lean, fy - 5, 3, 1, col);
          rect(fg, fx + lean, fy - 6, 1, 3, col);
          px(fg, fx + lean, fy - 5, col === C.wool ? C.butter : C.moss);
        }
      });
      break;
    case 'hay':
      fine(g, (fg) => {
        rect(fg, X - 10, B + 1, 19, 1, C.sage);
        gridAt(fg, HAYBALE, X, B);
        // Loose wisps at the ends and scattered round it.
        for (const [wx, wy] of [[-11, -6], [9, -4], [9, -8], [-12, 1], [12, 0], [4, 3], [-6, 2]]) {
          px(fg, X + wx, B + wy, C.butter);
          px(fg, X + wx + 1, B + wy - 1, C.butter);
        }
      });
      snowCap(g, x - 4, y - 5, 8);
      break;
    case 'well':
      fine(g, (fg) => {
        rect(fg, X - 12, B + 1, 23, 1, C.sage);
        grid(fg, WELL_STONES, X - 10, B - 7);
        // Posts, a little roof over the winch, a rope and a bucket.
        for (const px0 of [X - 10, X + 8]) {
          rect(fg, px0, B - 24, 2, 18, C.plum);
          px(fg, px0 + 1, B - 22, C.sage);
        }
        rect(fg, X - 12, B - 28, 24, 2, C.plum);
        rect(fg, X - 10, B - 30, 20, 2, C.teal);
        rect(fg, X - 10, B - 30, 20, 1, C.sage);
        rect(fg, X - 6, B - 32, 12, 2, C.plum);
        rect(fg, X - 8, B - 22, 16, 2, C.plum);
        rect(fg, X - 2, B - 21, 2, 2, C.sage);
        rect(fg, X, B - 20, 1, 8, C.wool);
        rect(fg, X - 2, B - 13, 5, 4, C.teal);
        rect(fg, X - 2, B - 13, 5, 1, C.plum);
        px(fg, X + 2, B - 12, C.wool);
      });
      snowCap(g, x - 5, y - 16, 10, y - 13);
      break;
    case 'bench':
      fine(g, (fg) => {
        rect(fg, X - 10, B + 1, 20, 1, C.sage);
        grid(fg, BENCH, X - 8, B - 9);
      });
      snowCap(g, x - 4, y - 4, 9);
      break;
    case 'flag':
      fine(g, (fg) => {
        rect(fg, X - 2, B + 1, 5, 1, C.sage);
        rect(fg, X, B - 37, 2, 38, C.plum);
        rect(fg, X + 1, B - 37, 1, 38, C.sage);
        rect(fg, X - 1, B - 39, 4, 2, C.butter);
        const wave = gust(x, y, t) > 0.5 ? 1 : Math.floor(t * 3) % 2;
        for (let r = 0; r < 8; r++) {
          const off = (r + wave) % 4 < 2 ? 0 : 1;
          const len = 12 - (r > 5 ? (r - 5) * 2 : 0) + (wave && r > 3 ? 1 : 0);
          rect(fg, X + 2, B - 36 + r + off, len, 1, r < 4 ? C.butter : C.wool);
        }
      });
      break;
    case 'woodpile':
      fine(g, (fg) => {
        // Split logs stacked by the chopping block, an axe in it.
        rect(fg, X - 14, B + 1, 24, 1, C.sage);
        for (let r = 0; r < 3; r++)
          for (let i = 0; i < 4 - r; i++) {
            const lx = X - 12 + i * 6 + r * 3, ly = B - 3 - r * 4;
            rect(fg, lx, ly, 5, 4, C.plum);
            rect(fg, lx + 1, ly, 3, 3, C.butter);
            px(fg, lx + 2, ly + 1, C.plum); // the rings
          }
        rect(fg, X + 8, B - 5, 7, 6, C.plum);
        rect(fg, X + 8, B - 5, 7, 2, C.butter);
        px(fg, X + 11, B - 4, C.moss);
        rect(fg, X + 11, B - 10, 1, 5, C.plum);
        rect(fg, X + 12, B - 10, 3, 2, C.wool);
        px(fg, X + 14, B - 8, C.sage);
      });
      break;
    case 'stones':
      fine(g, (fg) => {
        // Stepping stones from the door down to the road.
        for (let i = 0; i < 4; i++) {
          const sx = X - 2 + (i % 2 ? 4 : 0), sy = B - 9 + i * 12;
          rect(fg, sx + 1, sy, 5, 1, C.wool);
          rect(fg, sx, sy + 1, 7, 2, C.wool);
          rect(fg, sx + 4, sy + 1, 3, 2, C.sage);
          px(fg, sx + 1, sy + 1, C.sage);
          rect(fg, sx + 1, sy + 3, 5, 1, C.sage);
          rect(fg, sx, sy + 4, 7, 1, C.moss);
        }
      });
      break;
    case 'garden':
      fine(g, (fg) => {
        // Rows of vegetables in dark soil behind a low wattle fence: a row
        // of cabbages, one of carrots' feathery tops, one of beans in flower.
        const X0 = (x - 4) * PX, Y0 = (y - 6) * PX, Wd = 64, Hd = 26;
        rect(fg, X0 - 2, Y0 + Hd, Wd + 4, 1, C.sage);
        for (let r = 0; r < 3; r++) {
          const ry = Y0 + 4 + r * 7;
          rect(fg, X0 + 2, ry + 2, Wd - 4, 3, C.sage);
          rect(fg, X0 + 2, ry + 2, Wd - 4, 1, C.moss);
          for (let i = X0 + 4; i < X0 + Wd - 4; i += 6) {
            const snowy = seasonLook.snow > 0.4;
            if (r === 0) {
              rect(fg, i - 1, ry - 1, 4, 3, snowy ? C.wool : C.teal);
              px(fg, i, ry, C.sage);
              px(fg, i + 2, ry - 1, C.sage);
            } else if (r === 1) {
              for (const [dx, dy] of [[0, 0], [1, -1], [2, 0], [-1, -1], [1, -2]]) px(fg, i + dx, ry + dy, snowy ? C.wool : C.moss);
              px(fg, i + 1, ry + 1, C.butter);
            } else {
              rect(fg, i, ry - 3, 1, 4, C.teal);
              px(fg, i + 1, ry - 2, C.teal);
              if (hash2(i, ry, 7) < 0.6) px(fg, i - 1, ry - 3, C.wool);
            }
          }
        }
        // The wattle: woven plum withies on stakes.
        rect(fg, X0, Y0 + 2, 2, Hd - 2, C.plum);
        rect(fg, X0 + Wd - 2, Y0 + 2, 2, Hd - 2, C.plum);
        for (let i = X0; i < X0 + Wd; i += 4) {
          rect(fg, i, Y0 + Hd - 4, 2, 1, C.plum);
          rect(fg, i + 2, Y0 + Hd - 3, 2, 1, C.plum);
        }
        rect(fg, X0, Y0 + Hd - 2, Wd, 1, C.plum);
      });
      break;
    case 'barrels':
      fine(g, (fg) => {
        rect(fg, X - 12, B + 1, 24, 1, C.sage);
        grid(fg, BARREL, X - 11, B - 12);
        grid(fg, BARREL, X + 1, B - 12);
        grid(fg, BARREL, X - 5, B - 22);
      });
      snowCap(g, x - 5, y - 7, 10);
      snowCap(g, x - 2, y - 12, 5);
      break;
    case 'cart':
      fine(g, (fg) => {
        // A hay cart resting on its shafts: a plank bed heaped with hay,
        // two spoked wheels.
        rect(fg, X - 12, B + 1, 32, 1, C.sage);
        rect(fg, X - 10, B - 14, 26, 8, C.plum);
        rect(fg, X - 10, B - 14, 26, 1, C.moss);
        for (let r = B - 12; r < B - 6; r += 3) rect(fg, X - 9, r, 24, 1, C.sage);
        for (let i = 0; i < 24; i++) {
          const h = 2 + Math.round(Math.sin(i * 0.5) + Math.sin(i * 1.3)) + (i > 3 && i < 20 ? 2 : 0);
          rect(fg, X - 9 + i, B - 15 - h, 1, h, C.butter);
          if (i % 5 === 2) px(fg, X - 9 + i, B - 15 - h, C.wool);
        }
        line(fg, X + 16, B - 8, X + 27, B, C.plum);
        line(fg, X + 16, B - 9, X + 27, B - 1, C.plum);
        for (const wx of [X - 6, X + 8]) {
          rect(fg, wx - 1, B - 8, 9, 9, C.plum);
          rect(fg, wx, B - 7, 7, 7, C.wool);
          rect(fg, wx + 3, B - 7, 1, 7, C.plum);
          rect(fg, wx, B - 4, 7, 1, C.plum);
          px(fg, wx + 1, B - 6, C.plum);
          px(fg, wx + 5, B - 2, C.plum);
          rect(fg, wx + 2, B - 5, 3, 3, C.plum);
        }
      });
      break;
    case 'line':
      fine(g, (fg) => {
        // Washing on a line between two posts, flapping in the gusts.
        const X1 = X + 64;
        for (const px0 of [X, X1]) {
          rect(fg, px0 - 2, B + 1, 5, 1, C.sage);
          rect(fg, px0, B - 24, 2, 25, C.plum);
          rect(fg, px0 + 1, B - 24, 1, 25, C.sage);
        }
        for (let i = 2; i < 64; i++) px(fg, X + i, B - 23 + Math.round(Math.sin((i / 64) * Math.PI) * 2), C.wool);
        const cloth: [number, number, string][] = [[10, 8, C.wool], [22, 10, C.butter], [36, 8, C.teal], [48, 6, C.wool]];
        for (const [cx, w, col] of cloth) {
          const gx = X + cx;
          const lift = gust((gx >> 1), y, t) > 0.45 ? 1 : 0;
          const top = B - 21 + Math.round(Math.sin((cx / 64) * Math.PI) * 2);
          for (let i = 0; i < w; i++) {
            const hgt = 10 - (lift && i >= w - 2 ? 4 : lift && i >= w - 4 ? 2 : 0);
            rect(fg, gx + i + (lift && i > w / 2 ? 1 : 0), top, 1, hgt, col);
          }
          rect(fg, gx, top + 9, w, 1, col === C.teal ? C.plum : C.sage);
          px(fg, gx + 1, top - 1, C.plum);
          px(fg, gx + w - 2, top - 1, C.plum);
        }
      });
      break;
    case 'hives':
      fine(g, (fg) => {
        // Three skeps of coiled straw and their bees, busy by day.
        for (let i = 0; i < 3; i++) {
          const hx = X - 4 + i * 16;
          rect(fg, hx - 6, B + 1, 13, 1, C.sage);
          gridAt(fg, SKEP, hx, B);
        }
        if (!night && seasonLook.snow < 0.3)
          for (let k = 0; k < 6; k++) {
            const bx = X + 12 + Math.round(Math.sin(t * (3 + k) + k * 2) * 20);
            const by = B - 12 + Math.round(Math.cos(t * (2.3 + k * 0.7) + k) * 8);
            px(fg, bx, by, C.plum);
            px(fg, bx + 1, by, Math.floor(t * 12 + k) % 2 ? C.wool : C.butter);
          }
      });
      for (let i = 0; i < 3; i++) snowCap(g, x - 3 + i * 8, y - 6, 4);
      break;
  }
}

// Night light from decor (lanterns) in world pixels: a pool on the ground
// round the lantern's foot.
export function decorLights(tier: number): { x: number; y: number; r: number }[] {
  return DECOR.filter((d) => d.kind === 'lantern' && d.tier <= tier).map((d) => ({ x: d.x * TS + 4, y: d.y * TS + 2, r: 36 }));
}

// The lit lanterns' own glow, drawn above the dark: the glass lit, a few
// rays flickering round it.
export function drawLampGlow(g: CanvasRenderingContext2D, tier: number, t: number) {
  fine(g, (fg) => {
    for (const d of DECOR) {
      if (d.kind !== 'lantern' || d.tier > tier) continue;
      const X = (d.x * TS + 4) * PX, Y = (d.y * TS + 6) * PX + 1 - 19;
      rect(fg, X - 2, Y - 2, 5, 5, C.butter);
      px(fg, X, Y, C.wool);
      if (Math.sin(t * 9 + d.x) > -0.6) {
        for (const [dx, dy] of [[0, -5], [-5, 0], [5, 0], [-4, -4], [4, -4]]) px(fg, X + dx, Y + dy, C.butter);
      }
    }
  });
}
