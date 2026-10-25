import { C } from '../palette';
import type { Game } from '../game';
import { BASE_STATS, type DogStats } from '../entities/dog';
import type { Pen } from '../ranch/buildings';
import type { SpeciesId } from '../world/map';
import { SPECIES } from '../entities/species';

// ---- Goods ----

// Penned animals make goods during the day. Calm animals make more; a
// trough helps, and so does the windmill.
export function updateProduce(game: Game, dt: number) {
  const mill = game.ranch.buildings.some((b) => b.kind === 'windmill') ? 1.2 : 1;
  for (const p of game.ranch.pens) {
    for (const a of p.animals) {
      const sp = a.sp;
      if (!sp.good) continue;
      const rate = (1 - 0.75 * a.stress) * (p.hasTrough ? 1.4 : 1) * mill;
      a.produceT += dt * rate;
      if (a.produceT >= sp.goodEvery) {
        a.produceT -= sp.goodEvery;
        p.goods++;
        if (game.isOnScreen(a.x, a.y)) game.fx.float(a.x, a.y - 8, `+1 ${sp.good.toUpperCase().replace(/S$/, '')}`, C.wool, 0.9);
      }
    }
  }
}

export function priceMult(game: Game): number {
  return game.ranch.buildings.some((b) => b.kind === 'market') ? 1.5 : 1;
}

export function penGoodsValue(game: Game, p: Pen): number {
  if (!p.species || !p.goods) return 0;
  return Math.round(p.goods * SPECIES[p.species].goodValue * priceMult(game));
}

// Sold at the end of each day.
export function sellAllGoods(game: Game): { value: number; counts: Partial<Record<SpeciesId, number>> } {
  let value = 0;
  const counts: Partial<Record<SpeciesId, number>> = {};
  for (const p of game.ranch.pens) {
    if (!p.goods || !p.species) continue;
    value += penGoodsValue(game, p);
    counts[p.species] = (counts[p.species] ?? 0) + p.goods;
    p.goods = 0;
  }
  return { value, counts };
}

// Selling livestock at the market frees pen space.
export function livestockPrice(game: Game, id: SpeciesId): number {
  return Math.round(SPECIES[id].value * 2 * priceMult(game));
}

// ---- Kennel upgrades ----

export type UpKey = 'stamina' | 'speed' | 'bark' | 'nip';

export interface UpgradeDef {
  key: UpKey;
  name: string;
  costs: number[]; // price of level 2, 3, 4
  desc: (lvl: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  { key: 'stamina', name: 'STAMINA', costs: [15, 35, 110], desc: (l) => `${[100, 130, 165, 200][l - 1]} WIND` },
  { key: 'speed', name: 'SPEED', costs: [20, 45, 120], desc: (l) => `${[46, 49, 52, 55][l - 1]} PACE` },
  { key: 'bark', name: 'BARK', costs: [15, 35, 110], desc: (l) => `${[54, 64, 74, 86][l - 1]} REACH` },
  { key: 'nip', name: 'NIP', costs: [15, 30, 100], desc: (l) => `X${[1, 1.3, 1.6, 2][l - 1]} SHOVE` },
];

export const MAX_UP = 4;

export function dogStatsFor(levels: Record<UpKey, number>): DogStats {
  const s = { ...BASE_STATS };
  s.stamina = [100, 130, 165, 200][levels.stamina - 1];
  s.walk = [46, 49, 52, 55][levels.speed - 1];
  s.sprint = [80, 86, 92, 98][levels.speed - 1];
  s.barkRange = [54, 64, 74, 86][levels.bark - 1];
  s.nipPower = [1, 1.3, 1.6, 2][levels.nip - 1];
  return s;
}
