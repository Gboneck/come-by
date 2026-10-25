import { C } from '../palette';
import { hash2 } from '../rng';

// The season as the art sees it, set once a frame by render/world.ts from
// `game.season`: things drawn every frame (roofs, fences, decor) read it to
// put snow on top, blossom out, or turn their leaves.
export const seasonLook = { snow: 0, leaves: 0, bloom: 0 };

export function setSeasonLook(s: { snow: number; leaves: number; bloom: number }) {
  seasonLook.snow = s.snow;
  seasonLook.leaves = s.leaves;
  seasonLook.bloom = s.bloom;
}

// Snow lying along the top of something `w` wide at row `y`: a wool line,
// thicker and lumpier as winter deepens. Below it, at `drip`, icicles.
export function snowCap(g: CanvasRenderingContext2D, x: number, y: number, w: number, drip?: number) {
  const s = seasonLook.snow;
  if (s < 0.25) return;
  g.fillStyle = C.wool;
  for (let i = 0; i < w; i++) {
    if (s < 0.6 && hash2(x + i, y, 501) > s * 1.4) continue;
    g.fillRect(x + i, y, 1, 1);
    if (s > 0.7 && hash2(x + i, y, 502) < 0.35) g.fillRect(x + i, y - 1, 1, 1);
  }
  if (drip === undefined || s < 0.6) return;
  for (let i = 1; i < w - 1; i++) {
    const h = hash2(x + i, drip, 503);
    if (h > 0.22) continue;
    g.fillStyle = C.wool;
    g.fillRect(x + i, drip, 1, 1);
    if (h < 0.1) {
      g.fillStyle = C.sage;
      g.fillRect(x + i, drip + 1, 1, 1);
    }
  }
}
