import { Pen, type Rot } from '../ranch/buildings';
import { CATALOG, defOf, type BuildDef, type ItemId } from '../ranch/catalog';
import { SPECIES } from '../entities/species';
import { CS, TS, Ter, type SpeciesId } from '../world/map';
import type { Game } from '../game';
import { setPaddockRules, type GateAt, type Holding, type PRect, type PaddockLike, type PaddockRules, type Side } from './paddockbuild';

// A stand-in for the ranch's paddock rules, for trying the build UI before
// the real rules land: a pen stretched to the rectangle, its gate where the
// draft put it. Debug and test scripts only (nothing in the game imports
// this file): `(await import('/src/ui/paddockdev.ts')).useDevPaddocks()`.

const SIZE = { minW: 5, minH: 4, maxW: 20, maxH: 16, gateW: 2 };
const KINDS: SpeciesId[] = ['sheep', 'duck', 'goat', 'cow', 'pony'];

// Two spaces a tile inside the fence.
const spaces = (r: PRect) => Math.max(0, (r.w - 1) * (r.h - 1)) * 2 - 8;

// Written to compile against the old fixed pen and the new paddock alike.
class DevPaddock extends Pen implements PaddockLike {
  devFixtures: { id: string; tx: number; ty: number }[] = [];
  private g: GateAt;
  constructor(r: PRect, gate: GateAt) {
    super(r.tx, r.ty, gate.side as Rot);
    this.g = { ...gate };
    this.w = r.w;
    this.h = r.h;
  }
  get gate(): GateAt {
    return this.g;
  }
  set gate(v: GateAt) {
    this.g = { ...v };
    this.rot = v.side as Rot;
  }
  // @ts-ignore: an old pen's room is fixed; a stand-in paddock's grows
  get capacity(): number {
    return spaces(this);
  }
  mix(): Holding[] {
    const m = new Map<SpeciesId, number>();
    for (const a of this.animals) m.set(a.sp.id, (m.get(a.sp.id) ?? 0) + 1);
    return [...m].map(([sp, n]) => ({ sp, n }));
  }
  gateSpan() {
    const a = this.gate.at * TS, l = SIZE.gateW * TS;
    switch (this.gate.side) {
      case 0: return { x0: this.x0 + a, y0: this.y1 - CS, x1: this.x0 + a + l, y1: this.y1 };
      case 2: return { x0: this.x0 + a, y0: this.y0, x1: this.x0 + a + l, y1: this.y0 + CS };
      case 1: return { x0: this.x0, y0: this.y0 + a, x1: this.x0 + CS, y1: this.y0 + a + l };
      default: return { x0: this.x1 - CS, y0: this.y0 + a, x1: this.x1, y1: this.y0 + a + l };
    }
  }
}

const price = (r: PRect) => 2 * (r.w + r.h) * 2 + 6;

const RULES: PaddockRules = {
  tool: 'paddock',
  size: SIZE,
  price,
  holds: (r) => KINDS.map((sp) => ({ sp, n: Math.floor(spaces(r) / SPECIES[sp].space) })),
  gateRange: (r, side: Side) => [1, (side % 2 === 0 ? r.w : r.h) - SIZE.gateW - 1],
  problem(game: Game, r, gate, land) {
    for (let y = r.ty; y < r.ty + r.h; y++)
      for (let x = r.tx; x < r.tx + r.w; x++) {
        if (!land(x, y)) return 'NOT ON RANCH LAND';
        if (game.ranch.onRoad(x, y)) return 'KEEP THE DROVE ROAD CLEAR';
      }
    for (const b of game.ranch.buildings) if (b.kind !== 'regiongate' && b.overlapsTiles(r.tx, r.ty, r.w, r.h)) return 'SOMETHING IS IN THE WAY';
    const p = new DevPaddock(r, gate);
    const gp = p.gatePoint(12);
    if (game.map.t(Math.floor(gp.x / TS), Math.floor(gp.y / TS)) !== Ter.Grass) return 'THE GATE WOULD OPEN ONTO TREES';
    return null;
  },
  build(game, r, gate) {
    game.coins -= price(r);
    game.stats.built++;
    game.onBuilt('pen');
    return game.ranch.add(new DevPaddock(r, gate));
  },
  extendPrice: (p, r) => Math.max(0, price(r) - price(p)),
  extendProblem(game, p, r, land) {
    for (let y = r.ty; y < r.ty + r.h; y++)
      for (let x = r.tx; x < r.tx + r.w; x++) {
        if (p.overlapsTiles(x, y, 1, 1)) continue;
        if (!land(x, y)) return 'NOT ON RANCH LAND';
        if (game.ranch.onRoad(x, y)) return 'KEEP THE DROVE ROAD CLEAR';
      }
    for (const b of game.ranch.buildings) if (b !== p && b.kind !== 'regiongate' && b.overlapsTiles(r.tx, r.ty, r.w, r.h)) return 'SOMETHING IS IN THE WAY';
    return null;
  },
  extend(game, p, r) {
    game.coins -= Math.max(0, price(r) - price(p));
    p.tx = r.tx; p.ty = r.ty; p.w = r.w; p.h = r.h;
    game.ranch.restamp();
    return true;
  },
  moveGate(game, p, gate) {
    (p as DevPaddock).gate = gate;
    game.ranch.restamp();
    return null;
  },
  remove(game, p) {
    if ((p as unknown as Pen).animals.length) return 'SELL OR MOVE THEM FIRST';
    game.ranch.remove(p);
    game.coins += Math.floor(price(p) / 2);
    return null;
  },
  is: (b): b is PaddockLike => b instanceof DevPaddock,
  fixtureNames: (p) => (p as DevPaddock).devFixtures.map((f) => f.id.toUpperCase()),
  fixtures: ['trough'],
  fixtureProblem(game, p, id, tx, ty) {
    const d = defOf(id as ItemId);
    if (tx <= p.tx || ty <= p.ty || tx + d.w >= p.tx + p.w || ty + d.h >= p.ty + p.h) return 'INSIDE THE FENCE, PLEASE';
    if ((p as DevPaddock).devFixtures.some((f) => tx < f.tx + 2 && tx + d.w > f.tx && ty < f.ty + 1 && ty + d.h > f.ty)) return 'SOMETHING IS IN THE WAY';
    return null;
  },
  placeFixture(game, p, id, tx, ty) {
    (p as DevPaddock).devFixtures.push({ id, tx, ty });
    if (id === 'trough') (p as unknown as Pen).hasTrough = true;
  },
  ghost: (r, gate) => new DevPaddock(r, gate),
};

export function useDevPaddocks() {
  setPaddockRules(RULES);
  if (!CATALOG.some((d) => (d.id as string) === 'paddock')) {
    const pen = defOf('pen');
    const def: BuildDef = { ...pen, id: 'paddock' as ItemId, name: 'PADDOCK', cost: price({ tx: 0, ty: 0, w: SIZE.minW, h: SIZE.minH }), desc: 'A FIELD YOU MARK OUT YOURSELF.', rotates: false, upgrade: undefined };
    CATALOG.splice(CATALOG.indexOf(pen) + 1, 0, def);
  }
}
