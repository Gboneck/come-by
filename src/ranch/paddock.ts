import type { Game } from '../game';
import { TS, type SpeciesId } from '../world/map';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import { FIXTURE_SIZE, GATE_TILES, Pen, paddockCapacity, type FixtureKind, type PenFixture, type Rot } from './buildings';
import { defOf, type BuildDef } from './catalog';

// Paddocks you size yourself: the rules, for build mode to call. Drag out a
// rectangle (at least about the old pen's size, at most what your land
// allows), put its gate on any side at any point along it, extend it later
// and pay only for the new fence. Room grows with the area, the price with
// the fence, so one big paddock holds more for less than a yard full of
// small ones. Fixtures go inside: a trough, a field shelter, a hay rack.
//
// Tiles throughout, fence line included. A gate is { side, at }: side as
// for pens (0 south, 1 west, 2 north, 3 east), `at` the gate's first tile
// along that side counted from its west (or north) corner; never on a
// corner tile. A paddock is a Pen (ranch/buildings.ts): `new Pen(tx, ty,
// side, w, h)` with `gateAt`, or makePaddock(r, gate), draws through
// buildingDrawables at any size.

export type Side = Rot;
export interface PRect { tx: number; ty: number; w: number; h: number }
export interface GateAt { side: Side; at: number }
export type Paddock = Pen;
export type FixtureId = FixtureKind;

export const PADDOCK = { minW: 6, minH: 6, maxW: 28, maxH: 28, minArea: 48, gateW: GATE_TILES, fence: 0.8, gate: 1 };

export { paddockCapacity };

const perimeter = (r: PRect) => 2 * (r.w + r.h);

// The fence round it and its gate: 8x7 costs 25$, as the old pen did.
export function paddockPrice(r: PRect): number {
  return Math.round(PADDOCK.fence * perimeter(r) + PADDOCK.gate);
}

// How many of each kind it would hold on its own, in the order they come.
export function holds(r: PRect): { sp: SpeciesId; n: number }[] {
  const cap = paddockCapacity(r.w, r.h);
  return SPECIES_ORDER.map((sp) => ({ sp, n: Math.floor(cap / SPECIES[sp].space) }));
}

// The `at` values a gate may take on a side (clear of the corners).
export function gateRange(r: PRect, side: Side): [number, number] {
  const len = side % 2 === 0 ? r.w : r.h;
  return [1, len - GATE_TILES - 1];
}

export function defaultGate(r: PRect, side: Side): GateAt {
  const [lo, hi] = gateRange(r, side);
  return { side, at: Math.max(lo, Math.min(hi, Math.round((side % 2 === 0 ? r.w : r.h) / 2) - 1)) };
}

// A paddock (not placed) of this size and gate, for previews and checks.
export function makePaddock(r: PRect, gate: GateAt): Pen {
  const p = new Pen(r.tx, r.ty, gate.side, r.w, r.h);
  p.gateAt = gate.at;
  return p;
}

function sizeProblem(r: PRect): string | null {
  if (r.w < PADDOCK.minW || r.h < PADDOCK.minH) return `AT LEAST ${PADDOCK.minW} BY ${PADDOCK.minH}`;
  if (r.w * r.h < PADDOCK.minArea) return `AT LEAST ${PADDOCK.minArea} SQUARES`;
  if (r.w > PADDOCK.maxW || r.h > PADDOCK.maxH) return `AT MOST ${PADDOCK.maxW} ACROSS`;
  return null;
}

// Why a paddock cannot go here (null: it can). `land(tx, ty)` is build
// mode's ranch-land test (the default: game.build.buildable). `self`: the
// paddock being extended or re-gated, whose own fence and stock are not in
// the way. Money is not checked here; buildPaddock checks it.
export function paddockProblem(game: Game, r: PRect, gate: GateAt, land?: (tx: number, ty: number) => boolean, self?: Pen): string | null {
  const size = sizeProblem(r);
  if (size) return size;
  const [lo, hi] = gateRange(r, gate.side);
  if (gate.at < lo || gate.at > hi) return 'THE GATE CANNOT GO ON A CORNER';
  const ok = land ?? ((x: number, y: number) => game.build.buildable(game, x, y));
  for (let y = r.ty; y < r.ty + r.h; y++)
    for (let x = r.tx; x < r.tx + r.w; x++) if (!ok(x, y)) return 'NOT ON RANCH LAND';
  for (const b of game.ranch.buildings) if (b !== self && b.kind !== 'regiongate' && b.overlapsTiles(r.tx, r.ty, r.w, r.h)) return 'SOMETHING IS IN THE WAY';
  const p = makePaddock(r, gate);
  if (self) p.id = self.id; // its own fence is no wall in the gate's way
  const why = game.ranch.placementProblem('pen', r.tx, r.ty, r.w, r.h, gate.side, p);
  if (why) return why;
  const X0 = r.tx * TS - 3, Y0 = r.ty * TS - 3, X1 = (r.tx + r.w) * TS + 3, Y1 = (r.ty + r.h) * TS + 3;
  const inside = (x: number, y: number) => x > X0 && x < X1 && y > Y0 && y < Y1;
  if (!self && inside(game.dog.x, game.dog.y)) return 'YOUR DOG IS IN THE WAY';
  if (game.animals.some((a) => !a.gone && !a.pen && inside(a.x, a.y))) return 'ANIMALS IN THE WAY';
  return null;
}

// Pays, adds and restamps. Null if it cannot go there or cannot be paid for.
export function buildPaddock(game: Game, r: PRect, gate: GateAt): Pen | null {
  const cost = paddockPrice(r);
  if (paddockProblem(game, r, gate) || game.coins < cost) return null;
  game.coins -= cost;
  const p = makePaddock(r, gate);
  game.ranch.add(p);
  game.stats.built++;
  game.onBuilt('pen');
  return p;
}

// Empty paddocks only; half the fence comes back.
export function removePaddock(game: Game, p: Pen): string | null {
  if (p.animals.some((a) => !a.gone)) return 'EMPTY IT FIRST';
  game.coins += Math.floor(paddockPrice(p) / 2);
  game.ranch.remove(p);
  return null;
}

// ---- Extending ----

// The rectangle with one side moved out `n` tiles (a convenience).
export function extendRect(p: PRect, side: Side, n: number): PRect {
  const r = { tx: p.tx, ty: p.ty, w: p.w, h: p.h };
  if (side === 0) r.h += n;
  else if (side === 2) { r.ty -= n; r.h += n; }
  else if (side === 1) { r.tx -= n; r.w += n; }
  else r.w += n;
  return r;
}

const contains = (r: PRect, p: PRect) => r.tx <= p.tx && r.ty <= p.ty && r.tx + r.w >= p.tx + p.w && r.ty + r.h >= p.ty + p.h;

// The gate after growing to `r`: on its own side, which may have moved;
// counted again from the corner if the west or north side moved out.
function gateAfter(p: Pen, r: PRect): GateAt {
  const g = { side: p.rot, at: p.gateStart };
  if (g.side % 2 === 0) g.at += p.tx - r.tx;
  else g.at += p.ty - r.ty;
  return g;
}

// Only the new fence is paid for: the growth in the perimeter.
export function extendPrice(p: PRect, r: PRect): number {
  return Math.max(1, Math.round(PADDOCK.fence * (perimeter(r) - perimeter(p))));
}

export function extendProblem(game: Game, p: Pen, r: PRect, land?: (tx: number, ty: number) => boolean): string | null {
  if (!contains(r, p) || (r.w === p.w && r.h === p.h)) return 'DRAG A SIDE OUTWARDS';
  return paddockProblem(game, r, gateAfter(p, r), land, p);
}

export function extendPaddock(game: Game, p: Pen, r: PRect): boolean {
  const cost = extendPrice(p, r);
  if (extendProblem(game, p, r) || game.coins < cost) return false;
  game.coins -= cost;
  const g = gateAfter(p, r);
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

export function moveGate(game: Game, p: Pen, gate: GateAt): string | null {
  const why = paddockProblem(game, { tx: p.tx, ty: p.ty, w: p.w, h: p.h }, gate, undefined, p);
  if (why) return why;
  p.rot = gate.side;
  p.gateAt = gate.at;
  game.ranch.restamp();
  return null;
}

// ---- Fixtures inside ----

export const FIXTURE_IDS: FixtureId[] = ['trough', 'shelter', 'rack'];
export const isFixture = (id: string): id is FixtureId => (FIXTURE_IDS as string[]).includes(id);
// Their catalog entries: id, name, cost, tier, w, h, desc, icon.
export const FIXTURES: BuildDef[] = FIXTURE_IDS.map((id) => defOf(id));

// The paddock at a tile (fence included).
export const paddockAt = (game: Game, tx: number, ty: number): Pen | null =>
  game.ranch.pens.find((p) => tx >= p.tx && tx < p.tx + p.w && ty >= p.ty && ty < p.ty + p.h) ?? null;

// Why a fixture with its top-left at (tx, ty) cannot go in `p` (null: it
// can). `p` null: whichever paddock is at that tile.
export function fixtureProblem(game: Game, p: Pen | null, id: FixtureId, tx: number, ty: number): string | null {
  const pen = p ?? paddockAt(game, tx, ty);
  if (!pen) return 'PLACE IT IN A PADDOCK';
  const z = FIXTURE_SIZE[id];
  if (pen.has(id)) return 'THIS PADDOCK HAS ONE';
  // Inside the fence, clear of the gate's approach and the other fixtures.
  if (tx < pen.tx + 1 || ty < pen.ty + 1 || tx + z.w > pen.tx + pen.w - 1 || ty + z.h > pen.ty + pen.h - 1) return 'INSIDE THE FENCE';
  const gp = pen.gatePoint(-8);
  const gx = Math.floor(gp.x / TS), gy = Math.floor(gp.y / TS);
  if (gx >= tx - 1 && gx <= tx + z.w && gy >= ty - 1 && gy <= ty + z.h) return 'NOT IN THE GATEWAY';
  for (const f of pen.fixtures) {
    const fz = FIXTURE_SIZE[f.kind];
    if (tx < f.tx + fz.w && tx + z.w > f.tx && ty < f.ty + fz.h && ty + z.h > f.ty) return 'SOMETHING IS IN THE WAY';
  }
  return null;
}

// Puts it in (the caller pays the catalog price, as for any building).
export function placeFixture(game: Game, p: Pen | null, id: FixtureId, tx: number, ty: number): boolean {
  const pen = p ?? paddockAt(game, tx, ty);
  if (!pen || fixtureProblem(game, pen, id, tx, ty)) return false;
  pen.fixtures.push({ kind: id, tx, ty });
  game.ranch.restamp();
  return true;
}

// Takes it out; half its price comes back (returned).
export function removeFixture(game: Game, p: Pen, f: PenFixture): number {
  if (!p.fixtures.includes(f)) return 0;
  p.fixtures = p.fixtures.filter((x) => x !== f);
  game.ranch.restamp();
  const refund = Math.floor(defOf(f.kind).cost / 2);
  game.coins += refund;
  return refund;
}
