import { vnoise } from '../rng';

// Gusts roll across the valley from the west, one front every few seconds.
// Grass, reeds, smoke and butterflies all read the same wind, so a gust
// visibly travels across the screen.
export const WIND_X = 1;
export const WIND_Y = 0.3;

const PERIOD = 260; // px between fronts
const SPEED = 0.22; // fronts per second (~57 px/s)

// 0 = still air, ~1.4 at the heart of a strong gust.
export function gust(x: number, y: number, t: number): number {
  const p = (x * WIND_X + y * WIND_Y) / PERIOD - t * SPEED;
  const k = Math.floor(p);
  const f = p - k;
  const band = 1 - Math.abs(f - 0.5) * 5;
  if (band <= 0) return 0;
  // Each front is stronger in some places than others along its length.
  return band * (0.35 + vnoise(k * 1.7, (y - x * 0.3) / 380, 5));
}

// Gentle steady breeze plus gusts, for things that drift (smoke, wings).
export function drift(x: number, y: number, t: number): number {
  return 4 + gust(x, y, t) * 14;
}
