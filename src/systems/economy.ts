import { C } from '../palette';
import type { Game } from '../game';
import { BASE_STATS, type DogStats } from '../entities/dog';
import { FIXTURE_SIZE, ITEMS_MAX, type GoodItem, type Pen } from '../ranch/buildings';
import { TS } from '../world/map';
import type { SpeciesId } from '../world/map';
import { SPECIES } from '../entities/species';
import { valueOf, type Animal } from '../entities/animal';
import { isMarketDay } from './valley';

// ---- Goods ----

// Penned animals make goods during the day. Calm animals make more; a
// trough helps, and so does the windmill. Each good is laid where its
// animal stands, as an item in the paddock (Pen.items) that lies there
// until the goods are sold at day's end, or someone takes it.

// What happened to a good, for whoever shows it (the UI's animations, a
// co-op guest's copy): 'laid' at the animal, 'taken' from the paddock now,
// 'sold' once per paddock at day's end (item null, at the paddock's middle).
export interface GoodEvent { kind: 'laid' | 'taken' | 'sold'; pen: Pen; item: GoodItem | null; sp: SpeciesId; x: number; y: number; animal?: Animal }
const listeners: ((g: Game, e: GoodEvent) => void)[] = [];
export function onGood(fn: (g: Game, e: GoodEvent) => void): () => void {
  listeners.push(fn);
  return () => listeners.splice(listeners.indexOf(fn), 1);
}
const tell = (g: Game, e: GoodEvent) => {
  for (const fn of listeners) fn(g, e);
};

let nextItem = 1;
export const itemId = () => nextItem++;

// Where a good lands: under the animal, inside the fence, off the fixtures.
function itemSpot(p: Pen, a: Animal): { x: number; y: number } {
  let x = Math.round(Math.max(p.ix0 + 3, Math.min(p.ix1 - 3, a.x + (a.face === 'l' ? 3 : -3))));
  let y = Math.round(Math.max(p.iy0 + 3, Math.min(p.iy1 - 2, a.y + 1)));
  for (const f of p.fixtures) {
    const z = FIXTURE_SIZE[f.kind], x0 = f.tx * TS - 2, y0 = f.ty * TS - 2, x1 = (f.tx + z.w) * TS + 2, y1 = (f.ty + z.h) * TS + 2;
    if (x > x0 && x < x1 && y > y0 && y < y1) y = y1 + 1 < p.iy1 - 2 ? y1 + 1 : y0 - 1;
  }
  return { x, y };
}

export function updateProduce(game: Game, dt: number) {
  const mill = game.ranch.buildings.some((b) => b.kind === 'windmill') ? 1.2 : 1;
  for (const p of game.ranch.pens) {
    for (const a of p.animals) {
      const sp = a.sp;
      if (!sp.good || a.young || p.hungry) continue; // the young make nothing; a hungry pen neither
      const rate = (1 - 0.75 * a.stress) * (p.hasTrough ? 1.4 : 1) * mill * (a.rare ? 1.5 : 1);
      a.produceT += dt * rate;
      if (a.produceT >= sp.goodEvery) {
        a.produceT -= sp.goodEvery;
        p.goods++;
        p.goodsBy[sp.id] = (p.goodsBy[sp.id] ?? 0) + 1;
        let item: GoodItem | null = null;
        if (p.items.length < ITEMS_MAX) {
          item = { id: itemId(), sp: sp.id, ...itemSpot(p, a), t: game.t };
          p.items.push(item);
        }
        tell(game, { kind: 'laid', pen: p, item, sp: sp.id, x: item?.x ?? a.x, y: item?.y ?? a.y, animal: a });
        if (game.isOnScreen(a.x, a.y)) game.fx.float(a.x, a.y - 8, `+1 ${sp.good.toUpperCase().replace(/S$/, '')}`, C.wool, 0.9);
      }
    }
  }
}

// One good's price now (what it would fetch at day's end).
export function goodPrice(game: Game, sp: SpeciesId): number {
  return Math.round(SPECIES[sp].goodValue * priceMult(game) * (isMarketDay(game) ? 1.25 : 1));
}

// Take a good from a paddock now: it is paid for at once (the summary
// counts it with the day's goods) and leaves the paddock.
export function takeGood(game: Game, p: Pen, item: GoodItem): number {
  const i = p.items.indexOf(item);
  if (i < 0) return 0;
  p.items.splice(i, 1);
  p.goods = Math.max(0, p.goods - 1);
  if (p.goodsBy[item.sp]) p.goodsBy[item.sp]!--;
  const v = goodPrice(game, item.sp);
  game.earn(v);
  game.stats.goodsValue += v;
  tell(game, { kind: 'taken', pen: p, item, sp: item.sp, x: item.x, y: item.y });
  return v;
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
    const list = p.goodsList();
    for (const sp of list) counts[sp] = (counts[sp] ?? 0) + 1;
    p.goods = 0;
    p.goodsBy = {};
    p.items = [];
    tell(game, { kind: 'sold', pen: p, item: null, sp: list[0] ?? p.species ?? 'duck', x: p.cx, y: p.cy });
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
