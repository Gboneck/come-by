import type { SwayGrid } from '../world/terrain';
import type { WaterAnim } from '../art/water';
import { WATER_FPS, WATER_FRAMES } from '../art/water';
import { gust } from './wind';

// Grass tips, flower heads and reeds lean one pixel (reeds two) downwind as
// a gust passes over them. Bases never move, so nothing looks rubbery.
export function drawSway(g: CanvasRenderingContext2D, grid: SwayGrid, ox: number, oy: number, W: number, H: number, t: number) {
  const c0 = Math.max(0, Math.floor((ox - 8) / grid.cell)), c1 = Math.min(grid.cols - 1, Math.floor((ox + W + 8) / grid.cell));
  const r0 = Math.max(0, Math.floor((oy - 8) / grid.cell)), r1 = Math.min(grid.rows - 1, Math.floor((oy + H + 8) / grid.cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      for (const it of grid.cells[r * grid.cols + c]) {
        if (it.x < ox - 8 || it.x > ox + W + 2 || it.y < oy - 2 || it.y > oy + H + 8) continue;
        const gs = gust(it.x, it.y, t);
        // Reeds also nod on their own now and then.
        const nod = it.reed && Math.sin(t * 1.3 + it.x * 0.7) > 0.93 ? 1 : 0;
        const lean = it.reed ? Math.min(2, (gs > 0.3 ? 1 : 0) + (gs > 0.75 ? 1 : 0) + nod) : gs > 0.45 ? 1 : 0;
        const x = Math.round(it.x), y = Math.round(it.y);
        for (const b of it.blades) {
          for (let k = 0; k < b.h; k++) {
            const top = b.h - 1 - k; // 0 at the tip
            const dx = top === 0 ? lean : top === 1 && lean > 1 ? 1 : 0;
            g.fillStyle = b.head && top < (b.headH ?? 1) ? b.head : b.c;
            g.fillRect(x + b.dx + dx, y - k, 1, 1);
          }
        }
      }
    }
  }
}

// The loop of water highlights for every body of water in view.
export function drawWater(g: CanvasRenderingContext2D, anims: WaterAnim[], ox: number, oy: number, W: number, H: number, t: number) {
  const f = Math.floor(t * WATER_FPS) % WATER_FRAMES;
  for (const a of anims) {
    if (a.x + a.w < ox || a.x > ox + W || a.y + a.h < oy || a.y > oy + H) continue;
    g.drawImage(a.frames[f], a.x - ox, a.y - oy);
  }
}
