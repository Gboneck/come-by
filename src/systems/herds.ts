import type { Game } from '../game';
import { Animal } from '../entities/animal';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import type { Coat } from '../art/animals';
import { REGIONS, type SpeciesId } from '../world/map';
import { ri } from '../rng';
import { flockSize } from './spawner';
import { isFairDay, type MorningBanner } from './seasonal';
import { yardOf } from './orders';

// More stock about as the valley grows (with bigger wild flocks in
// spawner.ts and young born at home in seasonal.ts):
//
// - The sale yard has a lot for sale each morning from tier 2 (the fair
//   has its rare breeds instead): a few head of one kind, round in turn
//   through the kinds you can get, at four times what one pays delivered.
//   NIP at the fence buys the head you stand by; walk it home.
// - From tier 3, now and then a big drove comes into a region: one flock
//   two and a half times the size, a herding job worth the walk.

export const LOT_MARKUP = 4;
const LOT_SIZE: Record<SpeciesId, [number, number]> = { duck: [4, 6], sheep: [3, 4], goat: [3, 4], cow: [2, 3], pony: [2, 2] };
export const DROVE_CHANCE = 0.3;
const DROVE_SIZE = 2.5;

export const lotPrice = (id: SpeciesId) => SPECIES[id].value * LOT_MARKUP;

export class Herds {
  lot: SpeciesId | null = null; // today's lot at the sale yard
  drove: { species: SpeciesId; region: string; day: number; n: number } | null = null; // the last big drove
}

// Each morning, and on loading a save (the lot is not saved: it is set out
// again).
export function herdsMorning(g: Game, fresh: boolean): MorningBanner[] {
  stockLot(g);
  const d = fresh ? bigDrove(g) : null;
  return d ? [d] : [];
}

// Kinds whose region is open: what the yard can get in.
function kindsOpen(g: Game): SpeciesId[] {
  return SPECIES_ORDER.filter((id) => REGIONS.some((r) => r.species === id && g.isUnlocked(r)));
}

function stockLot(g: Game) {
  const yard = g.ranch.yards.find((y) => y.site.id === 'sale');
  if (g.tier < 2 || !yard || isFairDay(g) || (yard.site.region && !REGIONS.some((r) => r.id === yard.site.region && g.isUnlocked(r)))) return;
  const p = yardOf(g, 'sale').pen;
  if (p.animals.some((a) => a.forSale)) {
    g.herds.lot = p.animals.find((a) => a.forSale && !a.rare)?.sp.id ?? null;
    return;
  }
  g.herds.lot = null;
  const kinds = kindsOpen(g);
  if (!kinds.length) return;
  const id = kinds[g.day.day % kinds.length];
  const n = ri(LOT_SIZE[id][0], LOT_SIZE[id][1]);
  for (let i = 0; i < n; i++) {
    const coat = Math.floor(Math.random() * SPECIES[id].coats) as Coat;
    const a = new Animal(id, p.ix0 + 6 + (i % 3) * 10, p.iy0 + 6 + Math.floor(i / 3) * 9, coat);
    a.forSale = lotPrice(id);
    a.wanderer = false;
    a.pen = p;
    p.animals.push(a);
    g.animals.push(a);
  }
  g.herds.lot = id;
  if (!g.tipsSeen.has('lot') && !g.tip) {
    g.tipsSeen.add('lot');
    g.tip = { text: `THE SALE YARD HAS STOCK FOR SALE EACH DAY. STAND BY ONE AND BUY IT WITH ${g.input.touchMode ? 'NIP' : 'E'} AT THE FENCE, THEN WALK IT HOME.`, t: 9 };
  }
}

// A big flock in one open region (never the ranch's newest, whose flocks
// are its pen goal; never in winter, on fair day or two mornings running).
function bigDrove(g: Game): MorningBanner | null {
  const h = g.herds;
  if (g.tier < 3 || g.season.season === 'winter' || isFairDay(g) || (h.drove && g.day.day - h.drove.day < 2) || Math.random() > DROVE_CHANCE) return null;
  const regs = REGIONS.filter((r) => r.species && g.isUnlocked(r) && r.tier < g.tier);
  if (!regs.length) return null;
  const reg = regs[Math.floor(Math.random() * regs.length)];
  const wild = g.animals.filter((a) => !a.pen && !a.gone && g.map.regionAt(a.x, a.y) === reg);
  const pts = (g.map.spawns[reg.id] ?? []).filter((p) => !wild.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 110));
  if (!pts.length) return null;
  const at = pts[Math.floor(Math.random() * pts.length)];
  const sp = SPECIES[reg.species!];
  const n = Math.round(flockSize(reg, g.tier) * DROVE_SIZE);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (6 + n * 1.1);
    g.animals.push(new Animal(sp.id, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, Math.floor(Math.random() * sp.coats) as Coat));
  }
  h.drove = { species: sp.id, region: reg.id, day: g.day.day, n };
  return { big: 'A BIG DROVE', small: `${n} ${sp.plural.toUpperCase()} IN THE ${reg.name.toUpperCase()}: BRING THEM HOME`, prio: 2 };
}

export interface HerdsSave {
  drove: Herds['drove'];
}
export const herdsSave = (g: Game): HerdsSave => ({ drove: g.herds.drove });
export function herdsLoad(g: Game, d: HerdsSave | undefined) {
  g.herds = new Herds();
  g.herds.drove = d?.drove ?? null;
}
