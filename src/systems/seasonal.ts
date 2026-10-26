import { C } from '../palette';
import type { Game } from '../game';
import { Animal } from '../entities/animal';
import { RARE_BREEDS, SPECIES, SPECIES_ORDER, type Breed } from '../entities/species';
import type { Coat } from '../art/animals';
import type { SpeciesId } from '../world/map';
import { Barn, Haystack } from '../ranch/structures';
import type { Pen } from '../ranch/buildings';
import { defOf } from '../ranch/catalog';
import { admit, swingGate } from '../ranch/fixtures';
import { DAY_PACE, SEASON_DAYS } from './season';
import { hourToT, yardOf } from './orders';
import { mulberry32 } from '../rng';

// What each season brings to the ranch (the calendar is in season.ts):
//
// - Spring: ewes in your pens drop lambs over the first two mornings, and
//   wild ewes out on the hills come with lambs at foot. A lamb keeps to its
//   mother; a ewe cut off from her lamb turns back and frets, so a flock
//   with lambs has to be driven as pairs. Lambs grow up when autumn comes.
// - Summer: on the first morning the shearer waits at a buyer's yard. Bring
//   your sheep (up to eight): each pays a wool bonus, calm ones more, and
//   they come back out shorn, to be walked home again.
// - Autumn: on the second day the fair is on at the Show Ground. Drive your
//   best animal of each kind into the show ring to be judged against the
//   valley's (calm counts for most, a rare breed for more), and the
//   breeders' pen at the sale yard has rare breeds for sale: buy one and
//   walk it home.
// - Winter: snow slows everyone a little, days are short, fewer wild flocks
//   come down, and every night each pen eats a bale of hay for every four
//   places of stock in it: from the farmhouse loft (filled again each
//   autumn), then the haystacks you built. Stacks out of a barn's ring lose bales to the snow. A pen that
//   goes without makes no goods the next day and is restless.

export const HAY_PER = 4; // pen space one bale feeds for a night
export const LOFT_MAX = 10; // bales the farmhouse loft holds (full at the start and every autumn)
export const HAY_SPOIL = 2; // bales a stack out of a barn's ring loses a night
export const HAY_PRICE = 40; // a stack (catalog.ts), before winter; double in winter
export const FAIR_DAY = 2; // the day of autumn the fair is on
export const SHEAR_PAY = 6; // per head, before the calm multiplier
const FAIR_BASE: Record<SpeciesId, number> = { duck: 30, sheep: 38, goat: 40, cow: 44, pony: 46 };
const FAIR_PRIZE = [40, 20, 10];
const FAIR_RIVALS = ['THE MILLER', 'OLD TOM', 'MAGS', 'THE BROWN FARM', 'IVY', 'THE DROVER', 'WILL', 'ROSE'];

export interface FairEntry {
  species: SpeciesId;
  score: number;
  place: number; // 1-4
  prize: number;
  rivals: { name: string; score: number }[];
  rare: boolean;
}

// Seasonal state the save keeps (the calendar itself comes from the day).
export class Seasonal {
  loft = LOFT_MAX; // bales in the farmhouse loft
  loftBonus = 0; // extra bales each autumn (set by the valley's projects)
  hungryNights = 0; // this winter
  fair: FairEntry[] = []; // this year's fair, once judged
  news: string | null = null; // last night's feeding, for the morning
}

// The action button's name: E on a keyboard, NIP on a phone.
const keyE = (g: Game) => (g.input.touchMode ? 'NIP' : 'E');

export const isFairDay = (g: Game) => g.tier >= 2 && g.season.season === 'autumn' && g.season.dayOf === FAIR_DAY;
const isWinterTier = (g: Game) => g.tier >= 2; // hay comes with tier 2 (barns, nights)

export function shelteredSpot(g: Game, x: number, y: number) {
  return g.ranch.buildings.some((b) => b instanceof Barn && Math.hypot(b.cx - x, b.cy - y) <= b.shelterRadius);
}

export function stacks(g: Game): Haystack[] {
  return g.ranch.buildings.filter((b): b is Haystack => b instanceof Haystack);
}

export function hayHeld(g: Game) {
  return g.seasonal.loft + stacks(g).reduce((s, h) => s + h.bales, 0);
}

// Bales a pen eats in a winter night: one per HAY_PER places of stock, a
// third less from a hay rack (less trodden into the mud).
export const penHay = (p: Pen) => (p.animals.length ? Math.ceil((p.used / HAY_PER) * (p.has('hayrack') ? 2 / 3 : 1)) : 0);

// Bales the pens eat in a winter night, as they stand.
export function hayNeed(g: Game) {
  return g.ranch.pens.reduce((s, p) => s + penHay(p), 0);
}

// ---- The day ----

// A morning banner and how much it matters: the morning shows only its most
// important one (jobsMorning). 3: winter's feeding, the shearer, the fair;
// 1: a new season.
export interface MorningBanner {
  big: string;
  small: string;
  prio: number;
}

// Each morning (and on loading a save): the calendar, the day's length, the
// season's work. Returns the season's banner for the morning, if any.
export function seasonalMorning(g: Game, fresh: boolean): MorningBanner | null {
  const S = g.season;
  const was = S.season;
  S.morning(g.day.day);
  const P = DAY_PACE[S.season];
  g.day.pace = P.pace;
  g.day.duskAt = P.duskAt;
  defOf('hay').cost = S.winter ? HAY_PRICE * 2 : HAY_PRICE;
  if (!fresh) {
    S.snap();
    if (isFairDay(g)) setOutBreeders(g);
    return null;
  }
  let banner: MorningBanner | null = null;
  const turned = S.season !== was || S.dayOf === 1;
  // Last night's feeding.
  for (const p of g.ranch.pens) if (p.hungry) for (const a of p.animals) a.stress = Math.min(1, a.stress + 0.25);
  if (g.seasonal.news) {
    banner = { big: g.seasonal.news.startsWith('HUNGRY') ? 'A HUNGRY NIGHT' : 'HAY', small: g.seasonal.news, prio: 3 };
    g.seasonal.news = null;
  } else if (turned && S.dayOf === 1 && g.day.day > 1) banner = { big: `${S.season.toUpperCase()}, YEAR ${S.year}`, small: SEASON_LINE[S.season], prio: 1 }; // not over a new game's welcome
  if (S.season === 'spring' && S.dayOf <= 2 && g.tier >= 2) lambing(g);
  if (S.season === 'autumn' && S.dayOf === 1) {
    growUp(g);
    g.seasonal.loft = LOFT_MAX + g.seasonal.loftBonus; // the farm's own hay, cut in the summer
  }
  if (isFairDay(g)) {
    g.seasonal.fair = [];
    setOutBreeders(g);
    banner = { big: 'THE AUTUMN FAIR', small: 'AT THE SHOW GROUND: YOUR BEST ANIMAL TO THE SHOW RING, RARE BREEDS AT THE SALE YARD', prio: 3 };
  }
  if (S.season === 'winter' && S.dayOf === 1) g.seasonal.hungryNights = 0;
  // Tips, once each.
  const tip = (id: string, text: string) => {
    if (g.tipsSeen.has(id) || g.tip) return;
    g.tipsSeen.add(id);
    g.tip = { text, t: 10 };
  };
  if (S.season === 'autumn' && S.dayOf >= SEASON_DAYS - 1 && isWinterTier(g)) tip('hay', `WINTER IS COMING: PENNED STOCK EATS HAY EVERY NIGHT. BUILD HAYSTACKS NOW (DOUBLE PRICE IN WINTER) AND KEEP THEM IN A BARN'S RING.`);
  if (S.winter && isWinterTier(g)) tip('winter', `WINTER: EVERY NIGHT EACH PEN EATS A BALE FOR EVERY ${HAY_PER} PLACES OF STOCK. YOU HAVE ${hayHeld(g)} BALES, THE PENS NEED ${hayNeed(g)} A NIGHT.`);
  if (isFairDay(g)) tip('fair', `THE FAIR: DRIVE ONE ANIMAL OF A KIND INTO THE SHOW RING TO BE JUDGED. CALM COUNTS FOR MOST. THE SALE YARD SELLS RARE BREEDS: STAND BY ONE AT THE FENCE AND PRESS ${keyE(g)}.`);
  return banner;
}

const SEASON_LINE: Record<string, string> = {
  spring: 'LAMBING TIME. LAMBS KEEP TO THEIR MOTHERS',
  summer: 'THE SHEARER COMES. LONG DAYS',
  autumn: 'THE FAIR IS ON THE SECOND DAY. STOCK UP ON HAY',
  winter: 'SHORT DAYS, SNOW. THE PENS NEED HAY EACH NIGHT',
};

export function seasonalUpdate(g: Game, dt: number) {
  g.season.tick(g.day.phase === 'night' ? 1 : g.day.frac);
  g.dog.drag = 0.08 * g.season.snow;
  // The show ring is open on fair day.
  const ring = g.ranch.ring.pen;
  const fair = isFairDay(g) && g.day.phase !== 'night';
  ring.open = fair || ringBusy(g);
  if (fair)
    for (const a of admit(ring, g.animals, (a) => !a.trial && !a.young && !a.forSale && !g.seasonal.fair.some((e) => e.species === a.sp.id))) judge(g, a);
  swingGate(ring, dt, g.map);
}

// Someone in the ring's gateway: do not shut it on them.
function ringBusy(g: Game) {
  const gp = g.ranch.ring.pen.gatePoint(0);
  return g.animals.some((a) => !a.gone && !a.pen && Math.hypot(a.x - gp.x, a.y - gp.y) < a.r + 9);
}

// At the day's end (before the summary): winter feed, the fair packs up.
export function seasonalEvening(g: Game) {
  const S = g.season;
  for (const p of g.ranch.pens) p.hungry = false;
  if (S.winter && isWinterTier(g)) feed(g);
  // The fair packs up: entries go home to a pen of their kind, unsold
  // breeds go back with their breeders.
  const ring = g.ranch.ring.pen;
  for (const a of ring.animals) sendHome(g, a);
  ring.animals = [];
  const sale = yardOf(g, 'sale').pen;
  for (const a of sale.animals) if (a.forSale) a.gone = true;
  sale.animals = sale.animals.filter((a) => !a.gone);
  if (S.winter && S.dayOf === SEASON_DAYS && isWinterTier(g) && g.seasonal.hungryNights === 0 && g.ranch.pens.some((p) => p.animals.length)) g.totals.wintersFed++;
}

// ---- Winter feed ----

function feed(g: Game) {
  const sources = [
    ...stacks(g).filter((h) => shelteredSpot(g, h.cx, h.cy)),
    ...stacks(g).filter((h) => !shelteredSpot(g, h.cx, h.cy)),
  ];
  let ate = 0, hungry = 0;
  for (const p of g.ranch.pens) {
    if (!p.animals.length) continue;
    let need = penHay(p);
    const fromLoft = Math.min(need, g.seasonal.loft);
    g.seasonal.loft -= fromLoft;
    need -= fromLoft;
    ate += fromLoft;
    for (const h of sources) {
      if (need <= 0) break;
      const k = Math.min(need, h.bales);
      h.bales -= k;
      need -= k;
      ate += k;
    }
    if (need > 0) {
      p.hungry = true;
      hungry++;
    }
  }
  // Snow gets into stacks out of a barn's ring.
  let spoiled = 0;
  for (const h of stacks(g)) {
    if (shelteredSpot(g, h.cx, h.cy) || h.bales <= 0) continue;
    const k = Math.min(HAY_SPOIL, h.bales);
    h.bales -= k;
    spoiled += k;
  }
  // Empty stacks are cleared away.
  const empty = stacks(g).filter((h) => h.bales <= 0);
  for (const h of empty) g.ranch.remove(h);
  if (hungry) g.seasonal.hungryNights++;
  const left = hayHeld(g);
  g.seasonal.news = hungry
    ? `HUNGRY: ${hungry} PEN${hungry > 1 ? 'S' : ''} WENT WITHOUT HAY. NO GOODS FROM THEM TODAY`
    : `THE PENS ATE ${ate} BALES${spoiled ? `, THE SNOW SPOILED ${spoiled}` : ''}. ${left} LEFT`;
}

// ---- Spring: lambs ----

function lambing(g: Game) {
  const year = g.season.year;
  let born = 0;
  for (const p of g.ranch.pens) {
    for (const ewe of [...p.animals]) {
      if (ewe.sp.id !== 'sheep' || ewe.young || ewe.lambedYear === year) continue;
      // Half lamb on the first morning, nearly all the rest on the second.
      if (Math.random() > (g.season.dayOf === 1 ? 0.5 : 0.85)) continue;
      ewe.lambedYear = year;
      const n = Math.random() < 0.15 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const l = lambFor(ewe);
        l.pen = p;
        l.home = true;
        p.animals.push(l);
        g.animals.push(l);
        born++;
      }
    }
  }
  if (born) {
    g.totals.lambs += born;
    g.fx.float(g.dog.x, g.dog.y - 16, `${born} LAMB${born > 1 ? 'S' : ''} BORN`, C.butter, 2);
    if (!g.tipsSeen.has('lambs')) {
      g.tipsSeen.add('lambs');
      g.tip = { text: 'LAMBS! A LAMB KEEPS TO ITS MOTHER, AND A EWE CUT OFF FROM HER LAMB TURNS BACK FOR IT. DRIVE THEM AS PAIRS, GENTLY.', t: 10 };
    }
  }
}

export function lambFor(ewe: Animal): Animal {
  const a = Math.random() * Math.PI * 2;
  const l = new Animal('sheep', ewe.x + Math.cos(a) * 4, ewe.y + Math.sin(a) * 4, ewe.coat as Coat);
  l.young = true;
  l.mother = ewe;
  l.wanderer = false;
  if (!ewe.lamb || ewe.lamb.gone) ewe.lamb = l;
  return l;
}

function growUp(g: Game) {
  let n = 0;
  for (const a of g.animals) {
    if (a.young) {
      a.young = false;
      a.mother = null;
      n++;
    }
    a.lamb = null;
  }
  if (n) g.fx.float(g.dog.x, g.dog.y - 16, `${n} LAMBS GROWN`, C.wool, 2);
}

// ---- Summer: the shearer ----

// After the morning's orders are drawn up: the shearer on summer's first day.
export function seasonalOrders(g: Game): MorningBanner | null {
  const S = g.season;
  if (S.season === 'summer' && S.dayOf === 1 && g.tier >= 2) return shearingOrder(g);
  return null;
}

function shearingOrder(g: Game): MorningBanner | null {
  const year = g.season.year;
  const owned = g.ranch.pens.reduce((s, p) => s + p.animals.filter((a) => a.sp.id === 'sheep' && !a.young && a.shorn !== year).length, 0);
  if (owned < 3) return null;
  const yard = g.orders.list.some((o) => o.yard === 'drover' && o.state === 'open') ? 'mill' : 'drover';
  g.orders.list = g.orders.list.filter((o) => o.yard !== yard);
  g.orders.list.push({ id: g.orders.nextId++, yard, species: 'sheep', n: Math.min(8, owned), due: hourToT(17), got: 0, paid: 0, state: 'open', kind: 'shear' });
  if (!g.tipsSeen.has('shear')) {
    g.tipsSeen.add('shear');
    g.tip = { text: `THE SHEARER PAYS A WOOL BONUS FOR EACH SHEEP YOU BRING (CALM ONES MORE). LET THEM OUT OF THEIR PEN WITH ${keyE(g)} AT THE GATE, AND WALK THEM HOME AFTER.`, t: 10 };
  }
  return { big: 'THE SHEARER IS HERE', small: `AT ${yardOf(g, yard).site.name}: BRING YOUR SHEEP. THEY COME BACK SHORN`, prio: 3 };
}

// ---- Autumn: the fair ----

function setOutBreeders(g: Game) {
  const p = yardOf(g, 'sale').pen;
  if (p.animals.some((a) => a.forSale)) return;
  RARE_BREEDS.filter((b) => b.tier <= g.tier).forEach((b, i) => {
    const a = new Animal(b.species, p.ix0 + 6 + (i % 3) * 10, p.iy0 + 6 + Math.floor(i / 3) * 10, b.coat as Coat);
    a.forSale = b.price;
    a.wanderer = false;
    a.pen = p;
    p.animals.push(a);
    g.animals.push(a);
  });
}

// The breed for sale the dog is standing by, at the sale yard's fence.
export function breedNear(g: Game): { a: Animal; breed: Breed } | null {
  if (!isFairDay(g)) return null;
  const p = yardOf(g, 'sale').pen;
  const d = g.dog;
  if (d.x < p.x0 - 12 || d.x > p.x1 + 12 || d.y < p.y0 - 12 || d.y > p.y1 + 12) return null;
  const on = p.animals.filter((a) => a.forSale && Math.hypot(a.x - d.x, a.y - d.y) < 30).sort((x, y) => Math.hypot(x.x - d.x, x.y - d.y) - Math.hypot(y.x - d.x, y.y - d.y))[0];
  const breed = on && RARE_BREEDS.find((b) => b.species === on.sp.id && b.coat === on.coat);
  return on && breed ? { a: on, breed } : null;
}

// E by the sale yard's fence on fair day: buy the breed you are standing
// by. It comes out of the gate, to be walked home.
export function buyBreed(g: Game): boolean {
  const at = breedNear(g);
  if (!at) return false;
  const { a, breed } = at;
  if (g.coins < a.forSale) {
    g.showBanner(`${breed.name}: ${a.forSale}$`, `YOU HAVE ${g.coins}$`, 1.8);
    g.audio?.play('deny');
    return true;
  }
  g.coins -= a.forSale;
  g.totals.rareBought++;
  const p = yardOf(g, 'sale').pen;
  p.animals = p.animals.filter((x) => x !== a);
  a.forSale = 0;
  a.pen = null;
  a.home = true;
  const out = p.gatePoint(14);
  a.x = out.x;
  a.y = out.y;
  a.stress = 0.1;
  g.showBanner(`BOUGHT A ${breed.name}`, 'WALK IT HOME TO A PEN OF ITS KIND', 2.6);
  g.audio?.play('coin');
  return true;
}

function judge(g: Game, a: Animal) {
  const sp = a.sp.id;
  const rng = mulberry32(g.season.year * 977 + SPECIES_ORDER.indexOf(sp) * 131 + 7);
  const calm = 1 - Math.min(1, Math.max(a.peakStress, a.stress));
  const score = Math.round(FAIR_BASE[sp] + calm * 34 + (a.rare ? 14 : 0) + (rng() - 0.5) * 8);
  const lift = Math.min(12, (g.season.year - 1) * 3);
  const names = [...FAIR_RIVALS];
  const rivals = [0, 1, 2].map(() => ({
    name: names.splice(Math.floor(rng() * names.length), 1)[0],
    score: Math.round(FAIR_BASE[sp] + 10 + lift + rng() * 28),
  })).sort((x, y) => y.score - x.score);
  const place = 1 + rivals.filter((r) => r.score > score).length;
  const prize = place <= 3 ? FAIR_PRIZE[place - 1] : 0;
  if (prize) {
    g.earn(prize);
    g.totals.fairRibbons[place - 1]++;
  }
  g.seasonal.fair.push({ species: sp, score, place, prize, rivals, rare: a.rare });
  const kind = SPECIES[sp].name.toUpperCase();
  g.showBanner(place === 1 ? `BEST ${kind} AT THE FAIR!` : place <= 3 ? `${['', '1ST', '2ND', '3RD'][place]} FOR YOUR ${kind}` : `NO RIBBON FOR YOUR ${kind}`, `SCORE ${score}, BEST RIVAL ${rivals[0].score}${prize ? `  +${prize}$` : ''}`, 3.2);
  g.audio?.play(place === 1 ? 'tierup' : 'coin');
}

// A judged animal goes home: into a pen of its kind with room, or loose by
// the farmhouse door.
function sendHome(g: Game, a: Animal) {
  a.pen = null;
  a.home = true;
  const pen: Pen | undefined = g.ranch.pens.find((p) => p.hasRoomFor(a) && p.species === a.sp.id) ?? g.ranch.pens.find((p) => p.hasRoomFor(a));
  if (pen) {
    a.x = pen.cx + (Math.random() - 0.5) * 12;
    a.y = pen.cy + (Math.random() - 0.5) * 8;
    a.pen = pen;
    pen.animals.push(a);
    if (!pen.species) pen.species = a.sp.id;
  } else {
    const d = g.doorPoint();
    a.x = d.x + (Math.random() - 0.5) * 20;
    a.y = d.y + 20;
  }
}
