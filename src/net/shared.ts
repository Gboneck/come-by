import type { Game } from '../game';
import type { PenFixture, Rot } from '../ranch/buildings';
import type { SpeciesId } from '../world/map';
import { stacks, type Seasonal } from '../systems/seasonal';
import { valleyApply, valleyShared, type ValleySave } from '../systems/valley';
import type { FavourSave } from '../systems/favour';
import type { Group } from '../systems/achievements';

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
  // Buyers' favour (their yards dress up) and the board by the farmhouse.
  { key: 'favour', get: (g) => g.favour.save(), set: (g, v) => g.favour.load(v as FavourSave) },
  { key: 'pins', get: (g) => g.achievements.pins(g), set: (g, v) => (g.achievements.hostPins = v as Group[]) },
  // Winter feed and this year's fair (systems/seasonal.ts).
  { key: 'seasonal', get: (g) => ({ loft: g.seasonal.loft, hungryNights: g.seasonal.hungryNights, fair: g.seasonal.fair }), set: (g, v) => Object.assign(g.seasonal, v as Partial<Seasonal>) },
  // Bales left in each haystack, in building order.
  { key: 'hay', get: (g) => stacks(g).map((h) => h.bales), set: (g, v) => stacks(g).forEach((h, i) => (h.bales = (v as number[])[i] ?? h.bales)) },
  // Each paddock's size, gate and fixtures, in building order: extending a
  // side or moving a gate does not add a building, so it is sent here.
  { key: 'paddocks', get: (g) => g.ranch.pens.map((p) => [p.tx, p.ty, p.w, p.h, p.rot, p.gateAt, p.fixtures]), set: (g, v) => applyPaddocks(g, v as PaddockRec[]) },
  // Each paddock's goods by the kind that made them, in building order (the
  // snapshot has only the total): what a mixed paddock's piles show.
  { key: 'goodsBy', get: (g) => g.ranch.pens.map((p) => p.goodsBy), set: (g, v) => g.ranch.pens.forEach((p, i) => (p.goodsBy = { ...((v as Partial<Record<SpeciesId, number>>[])[i] ?? {}) })) },
  // The village, the paddocks' scrub, the old bridge (systems/valley.ts).
  { key: 'valley', get: (g) => valleyShared(g), set: (g, v) => valleyApply(g, v as ValleySave) },
  // Valley projects: progress, what is done, the fold's gate (systems/projects.ts).
  { key: 'projects', get: (g) => g.projects.shared(), set: (g, v) => g.projects.applyShared(g, v) },
];

type PaddockRec = [number, number, number, number, Rot, number | null, PenFixture[]];
function applyPaddocks(g: Game, recs: PaddockRec[]) {
  let changed = false;
  g.ranch.pens.forEach((p, i) => {
    const r = recs[i];
    if (!r) return;
    const [tx, ty, w, h, rot, gateAt, fixtures] = r;
    if (p.tx !== tx || p.ty !== ty || p.w !== w || p.h !== h || p.rot !== rot || p.gateAt !== gateAt || JSON.stringify(p.fixtures) !== JSON.stringify(fixtures)) {
      Object.assign(p, { tx, ty, w, h, rot, gateAt, fixtures });
      changed = true;
    }
  });
  if (changed) g.ranch.restamp();
}

export function sharedOut(game: Game): Record<string, unknown> {
  return Object.fromEntries(SHARED.map((s) => [s.key, s.get(game)]));
}

export function sharedIn(game: Game, data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const s of SHARED) if (s.key in data) s.set(game, data[s.key]);
}
