import { vnoise } from '../rng';

// Gusts roll across the valley from the west, one front every few seconds.
// Grass, reeds, smoke, flags and butterflies all read the same wind, so a
// gust visibly travels across the screen. The weather's wind strength makes
// the gusts harder and more frequent; resting speeds the whole sky up.
export const WIND_X = 1;
export const WIND_Y = 0.3;

const PERIOD = 260; // px between fronts
const SPEED = 0.22; // fronts per second (~57 px/s) on a still day

const W = { phase: 0, strength: 0.25 };

// Advance the wind (called once per update step by render/life.ts).
export function stepWind(dt: number, strength: number) {
  W.strength = strength;
  W.phase += dt * SPEED * (0.75 + strength);
}

export const windStrength = () => W.strength;

// 0 = still air, ~1.4 at the heart of a strong gust on a calm day, more on a
// windy one. `t` is kept for callers; the fronts move with stepWind.
export function gust(x: number, y: number, _t?: number): number {
  const p = (x * WIND_X + y * WIND_Y) / PERIOD - W.phase;
  const k = Math.floor(p);
  const f = p - k;
  const band = 1 - Math.abs(f - 0.5) * (5 - W.strength * 2);
  if (band <= 0) return 0;
  // Each front is stronger in some places than others along its length.
  return band * (0.35 + vnoise(k * 1.7, (y - x * 0.3) / 380, 5)) * (0.6 + W.strength * 1.6);
}

// Steady breeze plus gusts, for things that drift (smoke, wings, feathers).
export function drift(x: number, y: number, t?: number): number {
  return 2 + W.strength * 10 + gust(x, y, t) * 12;
}
