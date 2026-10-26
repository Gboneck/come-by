import type { Game } from '../game';
import { TS } from '../world/map';
import { FIXTURE_SIZE, GATE_TILES, Pen, paddockCapacity, type FixtureKind, type Rot } from './buildings';

// Paddocks you size yourself: the rules, for build mode to call. Drag out a
// rectangle (at least about the old pen's size, at most what your land
// allows), put its gate on any side at any point along it, extend a side
// later and pay only for the new fence. Capacity grows with the area, the
// price with the fence, so one big paddock holds more for less than a yard
// full of small ones. Fixtures go inside: a trough, a field shelter, a hay
// rack.
//
// Tiles throughout. A gate is { side, at }: side as for pens (0 south,
// 1 west, 2 north, 3 east), `at` how many tiles from the side's west (or
// north) end its two tiles start; never on a corner tile.

export const PADDOCK = { min: 6, max: 28, minArea: 48, fence: 0.8, gate: 1 };
export interface Rect { tx: number; ty: number; w: number; h: number }
export interface GateSpec { side: Rot; at: number }

export { paddockCapacity };

// The fence round it and its gate: 8x7 costs 25$, as the old pen did.
export function paddockPrice(w: number, h: number) {
  return Math.round(PADDOCK.fence * 2 * (w + h) + PADDOCK.gate);
}

export function defaultGate(w: number, h: number, side: Rot): GateSpec {
  const len = side % 2 === 0 ? w : h;
  return { side, at: Math.round(len / 2) - 1 };
}

const sideLen = (r: Rect, side: Rot) => (side % 2 === 0 ? r.w : r.h);
const gateFits = (r: Rect, g: GateSpec) => g.at >= 1 && g.at <= sideLen(r, g.side) - GATE_TILES - 1;

// A paddock (not placed) of this size and gate, for previews and checks.
export function makePaddock(r: Rect, g: GateSpec): Pen {
  const p = new Pen(r.tx, r.ty, g.side, r.w, r.h);
  p.gateAt = g.at;
  return p;
}

function sizeProblem(r: Rect): string | null {
  if (r.w < PADDOCK.min || r.h < PADDOCK.min) return `AT LEAST ${PADDOCK.min} BY ${PADDOCK.min}`;
  if (r.w * r.h < PADDOCK.minArea) return `AT LEAST ${PADDOCK.minArea} SQUARES`;
  if (r.w > PADDOCK.max || r.h > PADDOCK.max) return `AT MOST ${PADDOCK.max} ACROSS`;
  return null;
}

// Why a paddock cannot go here (null: it can). `ignore`: the paddock being
// extended or re-gated (its own fence and stock are not in the way).
function rectProblem(game: Game, r: Rect, g: GateSpec, ignore?: Pen): string | null {
  const size = sizeProblem(r);
  if (size) return size;
  if (!gateFits(r, g)) return 'THE GATE CANNOT GO ON A CORNER';
  for (let y = r.ty; y < r.ty + r.h; y++)
    for (let x = r.tx; x < r.tx + r.w; x++) if (!game.build.buildable(game, x, y)) return 'NOT ON RANCH LAND';
  for (const b of game.ranch.buildings) if (b !== ignore && b.kind !== 'regiongate' && b.overlapsTiles(r.tx, r.ty, r.w, r.h)) return 'SOMETHING IS IN THE WAY';
  const p = makePaddock(r, g);
  const why = game.ranch.placementProblem('pen', r.tx, r.ty, r.w, r.h, g.side, ignore ? Object.assign(p, { id: ignore.id }) : p);
  if (why) return why;
  const X0 = r.tx * TS - 3, Y0 = r.ty * TS - 3, X1 = (r.tx + r.w) * TS + 3, Y1 = (r.ty + r.h) * TS + 3;
  const inside = (x: number, y: number) => x > X0 && x < X1 && y > Y0 && y < Y1;
  if (!ignore && inside(game.dog.x, game.dog.y)) return 'YOUR DOG IS IN THE WAY';
  if (game.animals.some((a) => !a.gone && a.pen !== ignore && !(a.pen && a.pen !== ignore) && inside(a.x, a.y))) return 'ANIMALS IN THE WAY';
  return null;
}

export function placeProblem(game: Game, r: Rect, g: GateSpec): string | null {
  const why = rectProblem(game, r, g);
  if (why) return why;
  const cost = paddockPrice(r.w, r.h);
  return game.coins < cost ? `NEED ${cost}$` : null;
}

export function placePaddock(game: Game, r: Rect, g: GateSpec): Pen | null {
  if (placeProblem(game, r, g)) return null;
  game.coins -= paddockPrice(r.w, r.h);
  const p = makePaddock(r, g);
  game.ranch.add(p);
  game.stats.built++;
  game.onBuilt('pen');
  return p;
}

// ---- Extending a side ----

export function extendRect(p: Pen, side: Rot, n: number): Rect {
  const r = { tx: p.tx, ty: p.ty, w: p.w, h: p.h };
  if (side === 0) r.h += n;
  else if (side === 2) { r.ty -= n; r.h += n; }
  else if (side === 1) { r.tx -= n; r.w += n; }
  else r.w += n;
  return r;
}

// The gate after a side moves: it goes with its own side, and stays put
// (its count from the far end grows) when the west or north side moves out.
function gateAfter(p: Pen, side: Rot, n: number): GateSpec {
  const g = { side: p.rot, at: p.gateStart };
  if ((side === 1 && g.side % 2 === 0) || (side === 2 && g.side % 2 === 1)) g.at += n;
  return g;
}

// Only the new fence is paid for: the two lengths along the new strip.
export function extendPrice(_p: Pen, _side: Rot, n: number) {
  return Math.max(1, Math.round(PADDOCK.fence * 2 * n));
}

export function extendProblem(game: Game, p: Pen, side: Rot, n: number): string | null {
  if (n < 1) return 'DRAG A SIDE OUTWARDS';
  const why = rectProblem(game, extendRect(p, side, n), gateAfter(p, side, n), p);
  if (why) return why;
  const cost = extendPrice(p, side, n);
  return game.coins < cost ? `NEED ${cost}$` : null;
}

export function extendPaddock(game: Game, p: Pen, side: Rot, n: number): boolean {
  if (extendProblem(game, p, side, n)) return false;
  game.coins -= extendPrice(p, side, n);
  const r = extendRect(p, side, n), g = gateAfter(p, side, n);
  p.tx = r.tx;
  p.ty = r.ty;
  p.w = r.w;
  p.h = r.h;
  p.gateAt = g.at;
  game.ranch.restamp();
  game.stats.built++;
  return true;
}

// ---- Moving the gate (free) ----

export function gateProblem(game: Game, p: Pen, g: GateSpec): string | null {
  return rectProblem(game, { tx: p.tx, ty: p.ty, w: p.w, h: p.h }, g, p);
}

export function moveGate(game: Game, p: Pen, g: GateSpec): boolean {
  if (gateProblem(game, p, g)) return false;
  p.rot = g.side;
  p.gateAt = g.at;
  game.ranch.restamp();
  return true;
}

// ---- Fixtures inside ----

export const FIXTURES: FixtureKind[] = ['trough', 'shelter', 'hayrack'];
export const isFixture = (id: string): id is FixtureKind => (FIXTURES as string[]).includes(id);

// The paddock a fixture at (tx, ty) would stand in, and why it cannot.
export function fixtureProblem(game: Game, kind: FixtureKind, tx: number, ty: number): { pen: Pen | null; why: string | null } {
  const z = FIXTURE_SIZE[kind];
  const pen = game.ranch.pens.find((p) => tx >= p.tx && tx < p.tx + p.w && ty >= p.ty && ty < p.ty + p.h) ?? null;
  if (!pen) return { pen, why: 'PLACE IT IN A PADDOCK' };
  if (pen.has(kind)) return { pen, why: 'THIS PADDOCK HAS ONE' };
  // Inside the fence, clear of the gate's approach and the other fixtures.
  if (tx < pen.tx + 1 || ty < pen.ty + 1 || tx + z.w > pen.tx + pen.w - 1 || ty + z.h > pen.ty + pen.h - 1) return { pen, why: 'INSIDE THE FENCE' };
  const gp = pen.gatePoint(-8);
  const gx = Math.floor(gp.x / TS), gy = Math.floor(gp.y / TS);
  if (gx >= tx - 1 && gx <= tx + z.w && gy >= ty - 1 && gy <= ty + z.h) return { pen, why: 'NOT IN THE GATEWAY' };
  for (const f of pen.fixtures) {
    const fz = FIXTURE_SIZE[f.kind];
    if (tx < f.tx + fz.w && tx + z.w > f.tx && ty < f.ty + fz.h && ty + z.h > f.ty) return { pen, why: 'SOMETHING IS IN THE WAY' };
  }
  return { pen, why: null };
}

export function placeFixture(game: Game, kind: FixtureKind, tx: number, ty: number): boolean {
  const { pen, why } = fixtureProblem(game, kind, tx, ty);
  if (!pen || why) return false;
  pen.fixtures.push({ kind, tx, ty });
  game.ranch.restamp();
  return true;
}
