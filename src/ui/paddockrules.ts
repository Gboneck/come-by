import type { Game } from '../game';
import { Pen, type Building } from '../ranch/buildings';
import { CATALOG } from '../ranch/catalog';
import { setPaddockRules, type GateAt, type Holding, type PRect, type PaddockLike, type Side } from './paddockbuild';

// The ranch's paddock rules (src/ranch/paddock.ts), plugged into build
// mode's paddock editor. Looked up with a glob so build mode still builds
// in a checkout without them (the paddock tool then stays the old pen).

type Land = (tx: number, ty: number) => boolean;
interface RanchPaddocks {
  PADDOCK: { minW: number; minH: number; maxW: number; maxH: number; minArea: number; gateW: number };
  paddockPrice(r: PRect): number;
  holds(r: PRect): Holding[];
  gateRange(r: PRect, side: Side): [number, number];
  paddockProblem(game: Game, r: PRect, gate: GateAt, land?: Land, self?: Building): string | null;
  buildPaddock(game: Game, r: PRect, gate: GateAt): Building | null;
  removePaddock(game: Game, p: Building): string | null;
  extendPrice(p: PRect, r: PRect): number;
  extendProblem(game: Game, p: Building, r: PRect, land?: Land): string | null;
  extendPaddock(game: Game, p: Building, r: PRect): boolean;
  moveGate(game: Game, p: Building, gate: GateAt): string | null;
  makePaddock(r: PRect, gate: GateAt): Building;
  FIXTURE_IDS: string[];
  fixtureProblem(game: Game, p: Building | null, id: string, tx: number, ty: number): string | null;
  placeFixture(game: Game, p: Building | null, id: string, tx: number, ty: number): boolean;
}

const P = Object.values(import.meta.glob<RanchPaddocks>('../ranch/paddock.ts', { eager: true }))[0];

if (P)
  setPaddockRules({
    tool: 'pen',
    size: P.PADDOCK,
    price: (r) => P.paddockPrice(r),
    holds: (r) => P.holds(r),
    gateRange: (r, side) => P.gateRange(r, side),
    problem: (game, r, gate, land) => P.paddockProblem(game, r, gate, land),
    build: (game, r, gate) => P.buildPaddock(game, r, gate),
    extendPrice: (p, r) => P.extendPrice(p, r),
    extendProblem: (game, p, r, land) => P.extendProblem(game, p, r, land),
    extend: (game, p, r) => P.extendPaddock(game, p, r),
    moveGate: (game, p, gate) => P.moveGate(game, p, gate),
    remove: (game, p) => P.removePaddock(game, p),
    is: (b): b is PaddockLike => b instanceof Pen,
    fixtureNames: (p) => ((p as unknown as { fixtures?: { kind: string }[] }).fixtures ?? []).map((f) => CATALOG.find((d) => d.id === f.kind)?.name ?? f.kind.toUpperCase()),
    ghost: (r, gate) => P.makePaddock(r, gate),
    fixtures: P.FIXTURE_IDS,
    fixtureProblem: (game, p, id, tx, ty) => P.fixtureProblem(game, p, id, tx, ty),
    placeFixture: (game, p, id, tx, ty) => { P.placeFixture(game, p, id, tx, ty); },
  });
