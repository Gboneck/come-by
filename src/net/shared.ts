import type { Game } from '../game';
import { stacks, type Seasonal } from '../systems/seasonal';

// Ranch state that guests need but that is neither the herd nor the world
// in the snapshot: plain JSON, sent with the ranch's numbers whenever it
// changes (about four times a second at most). Round three adds its lines
// here, e.g. { key: 'feed', get: (g) => g.feed, set: (g, v) => (g.feed = v as Feed) }.
export interface Shared {
  key: string;
  get(game: Game): unknown;
  set(game: Game, value: unknown): void;
}

export const SHARED: Shared[] = [
  // Winter feed and this year's fair (systems/seasonal.ts).
  { key: 'seasonal', get: (g) => ({ loft: g.seasonal.loft, hungryNights: g.seasonal.hungryNights, fair: g.seasonal.fair }), set: (g, v) => Object.assign(g.seasonal, v as Partial<Seasonal>) },
  // Bales left in each haystack, in building order.
  { key: 'hay', get: (g) => stacks(g).map((h) => h.bales), set: (g, v) => stacks(g).forEach((h, i) => (h.bales = (v as number[])[i] ?? h.bales)) },
  // Valley projects: progress, what is done, the fold's gate (systems/projects.ts).
  { key: 'projects', get: (g) => g.projects.shared(), set: (g, v) => g.projects.applyShared(g, v) },
];

export function sharedOut(game: Game): Record<string, unknown> {
  return Object.fromEntries(SHARED.map((s) => [s.key, s.get(game)]));
}

export function sharedIn(game: Game, data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const s of SHARED) if (s.key in data) s.set(game, data[s.key]);
}
