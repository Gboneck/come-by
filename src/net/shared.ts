import type { Game } from '../game';

// Ranch state that guests need but that is neither the herd nor the world
// in the snapshot: plain JSON, sent with the ranch's numbers whenever it
// changes (about four times a second at most). Round three adds its lines
// here, e.g. { key: 'feed', get: (g) => g.feed, set: (g, v) => (g.feed = v as Feed) }.
export interface Shared {
  key: string;
  get(game: Game): unknown;
  set(game: Game, value: unknown): void;
}

export const SHARED: Shared[] = [];

export function sharedOut(game: Game): Record<string, unknown> {
  return Object.fromEntries(SHARED.map((s) => [s.key, s.get(game)]));
}

export function sharedIn(game: Game, data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const s of SHARED) if (s.key in data) s.set(game, data[s.key]);
}
