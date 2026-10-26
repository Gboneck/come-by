import type { DayCycle } from '../systems/day';

// The light over the valley, for drawing only. On top of the day cycle's own
// dusk and night, the first seconds of each morning after a night are a
// dawn: the dark lifts from the east first, as at dusk it gathers in the
// east first. Day 1 starts in full light.
const DAWN = 14;
const dawning = (day: DayCycle) => day.day > 1 && day.phase === 'day' && day.t < DAWN;

export function skyDarkness(day: DayCycle): number {
  const dawn = dawning(day) ? (1 - day.t / DAWN) * 0.42 : 0;
  return Math.max(day.darkness(), dawn);
}

// -1..1: how much darker the west (left) side of the screen is than the
// east. Positive at dawn (the east lightens first), negative at dusk (the
// west keeps the last of the light).
export function skySlope(day: DayCycle): number {
  if (day.phase === 'night') return 0;
  if (dawning(day)) return 0.6 * (1 - day.t / DAWN);
  // Fades out as dusk deepens, so nightfall itself is seamless.
  return day.phase === 'dusk' ? -0.6 * Math.max(0, 1 - day.darkness() / 0.5) : 0;
}

// Where shadows fall through the day, in px, for something a building's
// height: long to the west at sunrise, short at noon, long to the east as
// the sun goes down. (At night, the old down-left look.)
export function sunShadow(day: DayCycle): { dx: number; dy: number } {
  if (day.phase === 'night') return { dx: -5, dy: 6 };
  const a = Math.max(-1, Math.min(1, (day.frac - 0.45) / 0.45));
  const m = Math.abs(a);
  return { dx: Math.round(-1 + a * (3 + 7 * m)), dy: Math.round(6 - 3 * m) };
}

// 0..1: the warm late light before dusk (and a touch of it at sunrise).
export function goldenHour(day: DayCycle): number {
  if (day.phase === 'night') return 0;
  const f = day.frac;
  const eve = f < 0.62 ? 0 : f < 0.74 ? (f - 0.62) / 0.12 : f < 0.86 ? 1 - (f - 0.74) / 0.12 : 0;
  const morn = f < 0.06 ? 0.35 * (f / 0.06) : f < 0.14 ? 0.35 * (1 - (f - 0.06) / 0.08) : 0;
  return Math.max(eve, morn);
}

// 0..1: the blue hour, just after sunset and just before sunrise, when the
// dark comes in teal before it turns plum.
export function blueHour(day: DayCycle): number {
  if (day.phase === 'dusk') return Math.max(0, 1 - day.darkness() / 0.42);
  if (day.phase === 'night') return Math.max(0, 1 - Math.min(day.nightT, 10) / 10) * 0.5;
  return day.day > 1 && day.t < 14 ? 1 - day.t / 14 : 0;
}
