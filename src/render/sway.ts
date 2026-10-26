import type { SwayGrid } from '../world/terrain';
import type { WaterAnim } from '../art/water';
import { WATER_FPS, WATER_FRAMES } from '../art/water';
import type { FineData } from '../world/terrain';
import { WORLD_H, WORLD_W } from '../world/map';
import { hash2 } from '../rng';
import { gust, windStrength } from './wind';
import { C } from '../palette';
import { seasonLook } from '../art/seasonlook';
import { quality } from '../gfx/quality';
import { PX, fine } from '../gfx/screen';
import { px, rect } from '../gfx/draw';

// Grass tips, flower heads and reeds lean one pixel (reeds two) downwind as
// a gust passes over them. Bases never move, so nothing looks rubbery.
export function drawSway(g: CanvasRenderingContext2D, grid: SwayGrid, ox: number, oy: number, W: number, H: number, t: number) {
  const ws = quality.sway ? windStrength() : 0;
  // Snow buries most of the grass; autumn dries some blades to buttercup.
  const snow = seasonLook.snow, dry = seasonLook.leaves > 0.3;
  const c0 = Math.max(0, Math.floor((ox - 8) / grid.cell)), c1 = Math.min(grid.cols - 1, Math.floor((ox + W + 8) / grid.cell));
  const r0 = Math.max(0, Math.floor((oy - 8) / grid.cell)), r1 = Math.min(grid.rows - 1, Math.floor((oy + H + 8) / grid.cell));
  // On the fine grid: thin blades with a lighter one beside them, bending
  // at the tip (half as much halfway up) in a gust; little flowers.
  fine(g, (fg) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (const it of grid.cells[r * grid.cols + c]) {
          if (it.x < ox - 8 || it.x > ox + W + 2 || it.y < oy - 2 || it.y > oy + H + 8) continue;
          if (snow > 0.3 && !it.reed && ((it.x * 7 + it.y * 13) % 100) < snow * 92) continue;
          const gs = quality.sway ? gust(it.x, it.y, t) : 0;
          // Reeds also nod on their own now and then; on a windy day grass
          // flutters between gusts and reeds stay bent.
          const nod = it.reed && quality.sway && Math.sin(t * 1.3 + it.x * 0.7) > 0.93 ? 1 : 0;
          const flutter = ws > 0.55 && Math.floor(t * 7 + it.x * 0.37 + it.y * 0.11) % 3 === 0 ? 1 : 0;
          const lean = it.reed ? Math.min(2, (gs > 0.3 || ws > 0.7 ? 1 : 0) + (gs > 0.75 ? 1 : 0) + nod) : gs > 0.45 ? 1 : flutter;
          const X = Math.round(it.x) * PX, Y = Math.round(it.y) * PX + 1;
          for (const b of it.blades) {
            const bx = X + b.dx * PX;
            const Hh = b.h * PX;
            const col = dry && ((it.x + b.dx) & 3) === 0 ? C.butter : b.c;
            const head = b.head ? (snow > 0.5 ? C.wool : b.head) : null;
            const L = lean * PX;
            if (it.reed) {
              // A slim stalk; a cattail's head sits on top.
              blade(fg, bx, Y, Hh, L, col);
              if (head) {
                const hx = bx + L, hy = Y - Hh + 1;
                rect(fg, hx - 1, hy, 2, (b.headH ?? 1) * PX + 1, head);
                px(fg, hx, hy - 1, col);
              }
              continue;
            }
            if (head) {
              blade(fg, bx, Y, Hh, L, col);
              flower(fg, bx + L, Y - Hh, head);
              continue;
            }
            blade(fg, bx, Y, Hh, L, col);
            if (Hh > 2) blade(fg, bx + 1, Y, Hh - 2, L >> 1, col === C.sage ? C.moss : C.sage);
          }
        }
      }
    }
  });
}

// One blade, base at (x, y) going up h fine pixels, its top third leaning
// `lean` and its middle third half that.
function blade(fg: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number, col: string) {
  fg.fillStyle = col;
  const a = Math.ceil(h / 3), b = Math.ceil((h - a) / 2), c = h - a - b;
  fg.fillRect(x, y - a + 1, 1, a);
  fg.fillRect(x + (lean >> 1), y - a - b + 1, 1, b);
  if (c > 0) fg.fillRect(x + lean, y - h + 1, 1, c);
}

// A five-pixel flower: petals round a heart.
function flower(fg: CanvasRenderingContext2D, x: number, y: number, petal: string) {
  fg.fillStyle = petal;
  fg.fillRect(x - 1, y, 3, 1);
  fg.fillRect(x, y - 1, 1, 3);
  fg.fillStyle = petal === C.wool ? C.butter : C.moss;
  fg.fillRect(x, y, 1, 1);
}

// The water's highlights for every body of water in view, on the fine grid:
// dashes drifting downstream on the river (shorter and quicker in the
// shallows), foam flickering at its banks, wakes behind the stepping stones;
// glints swelling and fading on still water; rings spreading near the banks.
export function drawWater(g: CanvasRenderingContext2D, anims: WaterAnim[], d: FineData, wdist: Uint8Array, ox: number, oy: number, W: number, H: number, t: number) {
  const f = Math.floor(t * WATER_FPS);
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H && d.water[y * WORLD_W + x] === 1 && wdist[y * WORLD_W + x] >= 1;
  fine(g, (fg) => {
    fg.fillStyle = C.wool;
    for (const a of anims) {
      if (a.x + a.w < ox || a.x > ox + W || a.y + a.h < oy || a.y > oy + H) continue;
      const x0 = Math.max(a.x, ox - 4), x1 = Math.min(a.x + a.w, ox + W + 4), y0 = Math.max(a.y, oy - 12), y1 = Math.min(a.y + a.h, oy + H + 4);
      if (a.flowing) {
        dashes(fg, x0, y0, x1, y1, f, 6, 10, 0.55, 6, 10, 2, 300, (x, y) => isWater(x, y) && d.deep[y * WORLD_W + x] === 1);
        dashes(fg, x0, y0, x1, y1, f, 4, 7, 0.5, 3, 6, 4, 320, (x, y) => isWater(x, y) && !d.deep[y * WORLD_W + x]);
        // Foam flickering along the banks.
        for (let y = y0; y < y1; y += 2)
          for (let x = x0; x < x1; x++) {
            const i = y * WORLD_W + x;
            if (!d.water[i] || wdist[i] !== 1 || hash2(x, y, 340) > 0.25) continue;
            if ((Math.floor(hash2(x, y, 341) * 8) + f) % 8 < 2) fg.fillRect(x * PX + (f & 1), y * PX, 2, 1);
          }
        // Wakes behind each stepping stone.
        for (const s of a.stones) {
          const k = (f >> 1) % 4;
          if (k < 3) {
            fg.fillRect(s.x * PX - 1 - k * 2, s.y * PX + 7 + k * 2, 2, 1);
            fg.fillRect(s.x * PX + 7 + k * 2, s.y * PX + 7 + k * 2, 2, 1);
          }
          if ((f & 3) === 0) fg.fillRect(s.x * PX + 2 + ((f >> 2) & 1) * 2, s.y * PX - 2, 3, 1);
        }
      } else {
        // Glints that swell and fade in place on the still water.
        const GL = [1, 3, 5, 5, 3, 1];
        for (let cy = Math.floor(y0 / 5); cy * 5 < y1; cy++)
          for (let cx = Math.floor(x0 / 8); cx * 8 < x1; cx++) {
            if (hash2(cx, cy, 360) > 0.4) continue;
            const ph = (f + Math.floor(hash2(cx, cy, 361) * WATER_FRAMES)) % WATER_FRAMES;
            if (ph >= GL.length) continue;
            const x = cx * 8 + 2 + Math.floor(hash2(cx, cy, 362) * 3), y = cy * 5 + 1 + Math.floor(hash2(cx, cy, 363) * 3);
            if (!isWater(x, y) || !isWater(x + 2, y)) continue;
            fg.fillRect(x * PX + 2 - (GL[ph] >> 1), y * PX, GL[ph], 1);
          }
      }
      // Rings spreading near the banks, where insects touch down by the reeds.
      for (let cy = Math.floor(y0 / 9); cy * 9 < y1; cy++)
        for (let cx = Math.floor(x0 / 11); cx * 11 < x1; cx++) {
          if (hash2(cx, cy, 380) > 0.3) continue;
          const x = cx * 11 + Math.floor(hash2(cx, cy, 381) * 11), y = cy * 9 + Math.floor(hash2(cx, cy, 382) * 9);
          const i = y * WORLD_W + x;
          if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H || !d.water[i] || wdist[i] < 2 || wdist[i] > (a.flowing ? 3 : 5)) continue;
          const ph = (f + Math.floor(hash2(cx, cy, 383) * WATER_FRAMES)) % WATER_FRAMES;
          if (ph >= 8) continue;
          ring(fg, x * PX, y * PX, 1 + ph, Math.max(1, (1 + ph) >> 1), ph >= 5);
        }
    }
  });
}

// Dashes drifting `speed` fine px a frame down the cells of a grid (world
// px), each living `life` frames, short as it appears and fades.
function dashes(fg: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, f: number, cw: number, ch: number, p: number, len: number, life: number, speed: number, seed: number, ok: (x: number, y: number) => boolean) {
  const reach = Math.ceil((life * speed) / (ch * PX)) + 1;
  for (let cy = Math.floor(y0 / ch) - reach; cy * ch < y1; cy++)
    for (let cx = Math.floor(x0 / cw); cx * cw < x1; cx++) {
      if (hash2(cx, cy, seed) > p) continue;
      const ph = (f + Math.floor(hash2(cx, cy, seed + 1) * WATER_FRAMES)) % WATER_FRAMES;
      if (ph >= life) continue;
      const fy = (cy * ch + Math.floor(hash2(cx, cy, seed + 2) * (ch - 2))) * PX + ph * speed;
      const fx = (cx * cw + Math.floor(hash2(cx, cy, seed + 3) * Math.max(1, cw - 3))) * PX;
      const l = ph < 2 || ph > life - 3 ? Math.max(1, len >> 2) : len - (hash2(cx, cy, seed + 4) < 0.5 ? 1 : 0);
      if (!ok(fx >> 1, fy >> 1) || !ok((fx + l) >> 1, fy >> 1)) continue;
      fg.fillRect(fx, fy, l, 1);
    }
}

// A dotted ring, broken up as it fades.
function ring(fg: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, broken: boolean) {
  for (let a = 0; a < 16; a++) {
    if (broken && a % 2) continue;
    const ang = (a / 16) * Math.PI * 2;
    fg.fillRect(Math.round(cx + Math.cos(ang) * rx), Math.round(cy + Math.sin(ang) * ry), 1, 1);
  }
}
