import type { Game } from '../game';
import { BASE_STATS, type DogStats } from '../entities/dog';
import type { Pen } from '../ranch/buildings';
import type { SpeciesId } from '../world/map';
import { SPECIES } from '../entities/species';
import { valueOf, type Animal } from '../entities/animal';
import { isMarketDay } from './valley';

// ---- Goods ----

// Penned animals make goods during the day. Calm animals make more; a
// trough helps, and so does the windmill. A packed paddock makes less: full
// rate up to three-fifths of its room, half when it is full, so a paddock
// with room to spare makes as much as a crowded one (and has room for young).
export const CROWD_FROM = 0.6;
export function crowding(p: Pen): number {
  return 1 - 0.5 * Math.max(0, Math.min(1, (p.used / Math.max(1, p.capacity) - CROWD_FROM) / (1 - CROWD_FROM)));
}

export function updateProduce(game: Game, dt: number) {
  const mill = game.ranch.buildings.some((b) => b.kind === 'windmill') ? 1.2 : 1;
  for (const p of game.ranch.pens) {
    const crowd = crowding(p);
    for (const a of p.animals) {
      const sp = a.sp;
      if (!sp.good || a.young || p.hungry) continue; // lambs make nothing; a hungry pen neither
      const rate = (1 - 0.75 * a.stress) * (p.hasTrough ? 1.4 : 1) * mill * (a.rare ? 1.5 : 1) * crowd;
      a.produceT += dt * rate;
      if (a.produceT >= sp.goodEvery) {
        a.produceT -= sp.goodEvery;
        p.goods++;
        p.goodsBy[sp.id] = (p.goodsBy[sp.id] ?? 0) + 1;
        if (game.isOnScreen(a.x, a.y)) game.fx.good(a.x, a.y - 8, sp.id); // its icon and a +1
      }
    }
  }
}

export function priceMult(game: Game): number {
  return game.ranch.buildings.some((b) => b.kind === 'market') ? 1.5 : 1;
}

export function penGoodsValue(game: Game, p: Pen): number {
  if (!p.goods) return 0;
  return Math.round(p.goodsList().reduce((s, sp) => s + SPECIES[sp].goodValue, 0) * priceMult(game));
}

// Sold at the end of each day.
export function sellAllGoods(game: Game): { value: number; counts: Partial<Record<SpeciesId, number>> } {
  let value = 0;
  const counts: Partial<Record<SpeciesId, number>> = {};
  for (const p of game.ranch.pens) {
    if (!p.goods) continue;
    value += penGoodsValue(game, p);
    for (const sp of p.goodsList()) counts[sp] = (counts[sp] ?? 0) + 1;
    p.goods = 0;
    p.goodsBy = {};
  }
  if (isMarketDay(game)) value = Math.round(value * 1.25); // market day: goods sell dearer
  return { value, counts };
}

// Selling livestock at the market frees pen space.
export function livestockPrice(game: Game, id: SpeciesId, a?: Animal): number {
  return Math.round((a ? valueOf(a) : SPECIES[id].value) * 2 * priceMult(game));
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
