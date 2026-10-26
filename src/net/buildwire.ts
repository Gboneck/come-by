import type { Game } from '../game';
import type { BuildAction } from '../ui/build';

// Build actions between a guest and the host. Build mode names buildings by
// id, but each browser numbers its own buildings as it makes them, so on
// the wire a building goes by where it stands (its corner tile and kind)
// and each end turns that back into its own id.

type Where = [number, number, string];
export type WireAction = BuildAction & { at?: Where };

const where = (game: Game, id: number): Where | undefined => {
  const b = game.ranch.buildings.find((x) => x.id === id);
  return b ? [b.tx, b.ty, b.kind] : undefined;
};

const idAt = (game: Game, w: Where | undefined): number => {
  if (!w) return -1;
  return game.ranch.buildings.find((b) => b.tx === w[0] && b.ty === w[1] && b.kind === w[2])?.id ?? -1;
};

// Guest -> host.
export function toWire(game: Game, a: BuildAction): WireAction {
  if (a.k === 'extend' || a.k === 'remove' || a.k === 'upgrade') return { ...a, at: where(game, a.id) };
  if (a.k === 'sell') return { ...a, at: where(game, a.pen) };
  return a;
}

// On the host: the same building, by its id here.
export function fromWire(game: Game, a: WireAction): BuildAction {
  const { at, ...rest } = a;
  const b = rest as BuildAction;
  if (b.k === 'extend' || b.k === 'remove' || b.k === 'upgrade') return { ...b, id: idAt(game, at) };
  if (b.k === 'sell') return { ...b, pen: idAt(game, at) };
  return b;
}
