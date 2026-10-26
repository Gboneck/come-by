import { C } from '../palette';
import { hash2 } from '../rng';
import { PX, fine } from '../gfx/screen';

// The season as the art sees it, set once a frame by render/world.ts from
// `game.season`: things drawn every frame (roofs, fences, decor) read it to
// put snow on top, blossom out, or turn their leaves.
export const seasonLook = { snow: 0, leaves: 0, bloom: 0 };

// The light as the art sees it: where shadows fall (a vector in px for
// something about a building's height), and how golden the hour is.
export const lightLook = { dx: -5, dy: 6, golden: 0 };

export function setSeasonLook(s: { snow: number; leaves: number; bloom: number }) {
  seasonLook.snow = s.snow;
  seasonLook.leaves = s.leaves;
  seasonLook.bloom = s.bloom;
}

// Snow lying along the top of something `w` wide at row `y`: a wool line,
// thicker and in soft lumps as winter deepens. Below it, at `drip`, icicles.
// Drawn on the fine grid, so the lumps and icicles are fine.
export function snowCap(g: CanvasRenderingContext2D, x: number, y: number, w: number, drip?: number) {
  const s = seasonLook.snow;
  if (s < 0.25) return;
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX, Wd = w * PX;
    fg.fillStyle = C.wool;
    // In runs per height, so a long roof is a few rects, not hundreds.
    const lumpAt = (i: number) => Math.sin((X + i) * 0.45) + Math.sin((X + i) * 0.17 + 2);
    const rows: [number, (l: number) => boolean][] = [
      [0, (l) => s >= 0.6 || l >= (0.6 - s) * 5 - 1],
      [-1, (l) => s > 0.5 && l > 1.1 - s],
      [-2, (l) => s > 0.8 && l > 1.4],
    ];
    for (const [dy, on] of rows) {
      let run = -1;
      for (let i = 0; i <= Wd; i++) {
        const v = i < Wd && on(lumpAt(i));
        if (v && run < 0) run = i;
        else if (!v && run >= 0) { fg.fillRect(X + run, Y + dy, i - run, dy === 0 ? 2 : 1); run = -1; }
      }
    }
    if (drip === undefined || s < 0.6) return;
    const D = drip * PX;
    for (let i = 2; i < Wd - 2; i++) {
      const h = hash2(X + i, D, 503);
      if ((X + i) % 4 !== 1 || h > 0.55) continue;
      const len = 1 + Math.floor(h * 6);
      fg.fillStyle = C.wool;
      fg.fillRect(X + i, D, 1, len);
      fg.fillStyle = C.sage;
      fg.fillRect(X + i, D + len, 1, 1);
    }
  });
}
