import type { DayCycle } from '../systems/day';

// The light over the valley, for drawing only. On top of the day cycle's own
// dusk and night, the first seconds of each morning are a dawn: the dark
// lifts from the east first, as at dusk it gathers in the east first.
const DAWN = 16;

export function skyDarkness(day: DayCycle): number {
  const dawn = day.phase === 'day' && day.t < DAWN ? (1 - day.t / DAWN) * 0.45 : 0;
  return Math.max(day.darkness(), dawn);
}

// -1..1: how much darker the west (left) side of the screen is than the
// east. Positive at dawn (the east lightens first), negative at dusk (the
// west keeps the last of the light).
export function skySlope(day: DayCycle): number {
  if (day.phase === 'night') return 0;
  if (day.t < DAWN) return 0.6 * (1 - day.t / DAWN);
  // Fades out as dusk deepens, so nightfall itself is seamless.
  return day.phase === 'dusk' ? -0.6 * Math.max(0, 1 - day.darkness() / 0.5) : 0;
}
