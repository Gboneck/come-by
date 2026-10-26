import { SOLID, TS, type WorldMap } from '../world/map';
import { fillCells } from './buildings';
import type { Fixture } from './fixtures';

// The village at the crossroads, on the green south-west of the junction
// (map.ts carves it). It starts as a well; each step of it is built when
// the player has done something (src/systems/valley.ts decides when). The
// buildings are fixtures: stamped solid once they stand.

export type StepId = 'cottage1' | 'square' | 'smithy' | 'cottage2' | 'cottage3' | 'hall';
export type PlotKind = 'well' | 'cottage' | 'stall' | 'smithy' | 'hall';

export interface Plot {
  step: StepId | null; // null: there from the start
  kind: PlotKind;
  tx: number;
  ty: number;
  w: number;
  h: number;
}

// Tiles. The north road runs down x 96; keep x 94-99 clear. Two rows
// round the green with a lane between them (the festival arch stands in it).
export const PLOTS: Plot[] = [
  { step: null, kind: 'well', tx: 79, ty: 79, w: 2, h: 2 },
  { step: 'cottage1', kind: 'cottage', tx: 78, ty: 75, w: 4, h: 3 },
  { step: 'square', kind: 'stall', tx: 89, ty: 81, w: 2, h: 1 },
  { step: 'square', kind: 'stall', tx: 92, ty: 81, w: 2, h: 1 },
  { step: 'square', kind: 'stall', tx: 90, ty: 83, w: 2, h: 1 },
  { step: 'smithy', kind: 'smithy', tx: 90, ty: 74, w: 4, h: 3 },
  { step: 'cottage2', kind: 'cottage', tx: 78, ty: 81, w: 4, h: 3 },
  { step: 'cottage3', kind: 'cottage', tx: 83, ty: 81, w: 4, h: 3 },
  { step: 'hall', kind: 'hall', tx: 83, ty: 74, w: 6, h: 4 },
];

// The festival arch in the lane (pixels): a flock paraded through it, east
// to west or back, on festival day. Two posts with a garland between.
export const ARCH = { x: 85 * TS + 4, y0: 78 * TS, y1: 81 * TS };

// Where villagers stand about (pixels), for the townsfolk to use.
export const SPOTS = {
  well: { x: 82 * TS, y: 80 * TS + 4 },
  stall1: { x: 90 * TS, y: 82 * TS + 4 },
  stall2: { x: 93 * TS, y: 82 * TS + 4 },
  stall3: { x: 91 * TS, y: 84 * TS + 4 },
  anvil: { x: 91 * TS, y: 77 * TS + 6 },
  hallDoor: { x: 86 * TS, y: 78 * TS + 4 },
  bench: { x: 88 * TS + 4, y: 79 * TS + 4 },
  green: { x: 88 * TS, y: 79 * TS + 4 },
  road: { x: 96 * TS, y: 86 * TS }, // where newcomers walk in from
};

export const doorOf = (p: Plot) => ({ x: (p.tx + p.w / 2) * TS, y: (p.ty + p.h) * TS + 4 });

export class Village implements Fixture {
  built = new Set<StepId>();
  builtDay: Partial<Record<StepId, number>> = {};

  has(step: StepId) {
    return this.built.has(step);
  }

  plots(): Plot[] {
    return PLOTS.filter((p) => !p.step || this.built.has(p.step));
  }

  stamp(map: WorldMap) {
    for (const p of this.plots()) {
      const x0 = p.tx * TS, y0 = p.ty * TS;
      // Stalls and the well block only their lower half: you can walk
      // close behind them.
      const top = p.kind === 'stall' || p.kind === 'well' ? y0 + 4 : y0;
      fillCells(map, x0, top, x0 + p.w * TS, y0 + p.h * TS, SOLID);
    }
    if (this.built.has('hall'))
      for (const y of [ARCH.y0, ARCH.y1 - 4]) fillCells(map, ARCH.x - 1, y, ARCH.x + 2, y + 4, SOLID);
  }
}
