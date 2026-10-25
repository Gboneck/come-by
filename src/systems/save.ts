import type { Game } from '../game';
import { Animal } from '../entities/animal';
import type { Coat } from '../art/animals';
import { Pen, type BuildingKind, type Rot } from '../ranch/buildings';
import { defOfKind } from '../ranch/catalog';
import { makeBuilding } from '../ui/build';
import { Helper, type HelperMode } from '../entities/helper';
import type { SpeciesId } from '../world/map';
import { newTotals, type Totals } from './progression';
import type { UpKey } from './economy';
import { morningOrders, type Order } from './orders';
import type { ClassId } from './trials';
import { SKIES, type Sky } from './weather';

// A save is "the morning of day N": the ranch, the herds where they stand,
// goods waiting in the pens, upgrades and the lifetime record.
const KEY = 'comeby-save-v1';

interface SavedAnimal { id: SpeciesId; coat: Coat; stress: number; x?: number; y?: number; wanderer?: boolean; produceT?: number; home?: boolean }

interface SaveData {
  v: 1;
  day: number;
  tier: number;
  coins: number;
  won: boolean;
  tut: number;
  tips: string[];
  totals: Totals;
  upgrades: Record<UpKey, number>;
  owned: string[];
  buildings: { kind: BuildingKind; tx: number; ty: number; rot: Rot; level: number; trough?: boolean; goods?: number; animals?: SavedAnimal[] }[];
  wild: SavedAnimal[];
  helpers: { name: string; mode: HelperMode }[];
  // Added with orders and trials; older saves lack them.
  orders?: Order[];
  nextOrder?: number;
  trials?: { won: ClassId[]; cups: number; last: number };
  weather?: { sky: Sky; forecast: Sky; dir: [number, number] };
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(game: Game) {
  if (game.demo || game.loading) return;
  const data: SaveData = {
    v: 1,
    day: game.day.day,
    tier: game.tier,
    coins: game.coins,
    won: game.won,
    tut: game.tut,
    tips: [...game.tipsSeen],
    totals: game.totals,
    upgrades: game.upgrades,
    owned: [...game.owned],
    buildings: game.ranch.buildings
      .filter((b) => b.kind !== 'regiongate' && b.kind !== 'farmhouse')
      .map((b) => {
        const out: SaveData['buildings'][number] = { kind: b.kind, tx: b.tx, ty: b.ty, rot: b.rot, level: b.level };
        if (b instanceof Pen) {
          out.trough = b.hasTrough;
          out.goods = b.goods;
          out.animals = b.animals.filter((a) => !a.gone).map((a) => ({ id: a.sp.id, coat: a.coat, stress: +a.stress.toFixed(2), produceT: Math.round(a.produceT) }));
        }
        return out;
      }),
    wild: game.animals
      .filter((a) => !a.pen && !a.gone && !a.trial)
      .map((a) => ({ id: a.sp.id, coat: a.coat, stress: +a.stress.toFixed(2), x: Math.round(a.x), y: Math.round(a.y), wanderer: a.wanderer, ...(a.home ? { home: true } : {}) })),
    helpers: game.helpers.map((h) => ({ name: h.name, mode: h.mode })),
    orders: game.orders.list,
    nextOrder: game.orders.nextId,
    trials: { won: game.trials.won, cups: game.trials.cups, last: game.trials.lastPrizeDay },
    weather: { sky: game.weather.sky, forecast: game.weather.forecast, dir: [+game.weather.dirX.toFixed(3), +game.weather.dirY.toFixed(3)] },
  };
  try {
    store()?.setItem(KEY, JSON.stringify(data));
  } catch { /* quota or blocked: play on */ }
}

function read(): SaveData | null {
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function saveInfo(): { day: number; tier: number } | null {
  const d = read();
  return d ? { day: d.day, tier: d.tier } : null;
}

export function clearSave() {
  try {
    store()?.removeItem(KEY);
  } catch { /* ignore */ }
}

export function loadInto(game: Game): boolean {
  const d = read();
  if (!d) return false;
  game.day.day = d.day;
  game.coins = d.coins;
  game.won = d.won;
  game.tut = d.tut;
  game.tipsSeen = new Set(d.tips);
  game.totals = { ...newTotals(), ...d.totals };
  game.upgrades = { ...game.upgrades, ...d.upgrades };
  game.applyUpgrades();
  game.owned = new Set(d.owned);

  // Rebuild the ranch: keep region gates and the farmhouse, replace the rest.
  game.ranch.buildings = game.ranch.buildings.filter((b) => b.kind === 'regiongate' || b.kind === 'farmhouse');
  game.animals = [];
  for (const sb of d.buildings) {
    const def = defOfKind(sb.kind);
    if (!def) continue;
    const b = makeBuilding(def, sb.tx, sb.ty, sb.rot);
    b.level = sb.level;
    game.ranch.buildings.push(b);
    if (b instanceof Pen) {
      b.hasTrough = !!sb.trough;
      b.goods = sb.goods ?? 0;
      for (const sa of sb.animals ?? []) {
        const x = b.ix0 + 4 + Math.random() * (b.ix1 - b.ix0 - 8);
        const y = b.iy0 + 4 + Math.random() * (b.iy1 - b.iy0 - 8);
        const a = new Animal(sa.id, x, y, sa.coat);
        a.stress = sa.stress;
        a.produceT = sa.produceT ?? 0;
        a.pen = b;
        b.animals.push(a);
        b.species = sa.id;
        game.animals.push(a);
      }
    }
  }
  for (const sa of d.wild) {
    const a = new Animal(sa.id, sa.x ?? 0, sa.y ?? 0, sa.coat);
    a.stress = sa.stress;
    if (sa.wanderer !== undefined) a.wanderer = sa.wanderer;
    a.home = !!sa.home;
    game.animals.push(a);
  }
  if (d.trials) {
    game.trials.won = [...d.trials.won];
    game.trials.cups = d.trials.cups;
    game.trials.lastPrizeDay = d.trials.last;
  }
  game.setTier(d.tier, false);
  game.ranch.restamp();
  const door = game.doorPoint();
  game.helpers = d.helpers.map((h, i) => new Helper(h.name, door.x + (i ? 10 : -10), door.y + 6, h.mode, i));
  // Today's sky as it was saved (older saves: a clear day).
  const w = d.weather;
  if (w && SKIES.includes(w.sky) && !game.weather.forced) {
    game.weather.set(w.sky);
    game.weather.forecast = SKIES.includes(w.forecast) ? w.forecast : 'clear';
    [game.weather.dirX, game.weather.dirY] = w.dir;
    game.weather.snap();
  }
  game.startDay(true, false);
  // The morning's orders as they were; an older save gets fresh ones.
  if (d.orders) {
    game.orders.list = d.orders.map((o) => ({ ...o }));
    game.orders.nextId = d.nextOrder ?? game.orders.list.length + 1;
  } else morningOrders(game);
  saveGame(game);
  return true;
}
