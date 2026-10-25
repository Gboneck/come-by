import { C } from '../palette';
import { calmRating, type Game } from '../game';
import { SPECIES, SPECIES_ORDER } from '../entities/species';
import { REGIONS, type SpeciesId, type YardId } from '../world/map';
import type { Pen } from '../ranch/buildings';
import { admit, evict, swingGate, type Yard } from '../ranch/fixtures';
import { DAY_LEN } from './day';
import { tierOf } from './progression';
import { pick, ri } from '../rng';

// Buyers around the valley ask for a few head by a set hour. You can bring
// them in from the pastures or let them out of your own pens (E at the
// gate); either way they have to be driven to the buyer's yard. Calm stock
// pays half again, rattled stock less.
export interface Order {
  id: number;
  yard: YardId;
  species: SpeciesId;
  n: number;
  due: number; // seconds into the daylight
  got: number;
  paid: number;
  state: 'open' | 'done' | 'gone';
}

// Per head, times the species value, before the calm multiplier.
export const ORDER_RATE = 2.5;
const COUNTS: Record<SpeciesId, [number, number]> = { duck: [4, 6], sheep: [3, 5], goat: [3, 4], cow: [2, 3], pony: [2, 3] };

export const hourToT = (h: number) => ((h - 6) / 14) * DAY_LEN;
export const tToClock = (t: number) => {
  const h = 6 + (t / DAY_LEN) * 14;
  const m = Math.round(((h % 1) * 60) / 10) * 10;
  return `${Math.floor(h) + (m === 60 ? 1 : 0)}:${(m % 60).toString().padStart(2, '0')}`;
};

export class Orders {
  list: Order[] = [];
  nextId = 1;

  get open(): Order[] {
    return this.list.filter((o) => o.state === 'open');
  }

  forYard(id: YardId): Order | undefined {
    return this.list.find((o) => o.yard === id && o.state === 'open');
  }
}

export function yardOf(game: Game, id: YardId): Yard {
  return game.ranch.yards.find((y) => y.site.id === id)!;
}

const regionOpen = (game: Game, id: string | null) => !id || REGIONS.some((r) => r.id === id && r.tier <= game.tier);

// Each morning from tier 2: one order, two from tier 4. Penned species are
// the likeliest, so there is usually something you can let out.
export function morningOrders(game: Game) {
  const o = game.orders;
  o.list = [];
  if (game.tier < 2) return;
  // Buyers do not ask for the kind this tier's pen goal still needs: an
  // order should not pull against the goal.
  const goal = tierOf(game.tier).goals.find((x) => x.label.startsWith('PEN ') && x.value(game) < x.target);
  const wanted = goal ? tierOf(game.tier).species : null;
  let species = SPECIES_ORDER.filter((id) => REGIONS.some((r) => r.species === id && r.tier <= game.tier) && id !== wanted);
  if (!species.length) species = SPECIES_ORDER.filter((id) => REGIONS.some((r) => r.species === id && r.tier <= game.tier));
  const yards = game.ranch.yards.filter((y) => regionOpen(game, y.site.region));
  const want = game.tier >= 4 ? 2 : 1;
  const weights = species.map((id) => 1 + 2 * Math.min(3, game.ranch.pens.filter((p) => p.species === id).length));
  for (let k = 0; k < want; k++) {
    const freeYards = yards.filter((y) => !o.list.some((x) => x.yard === y.site.id));
    if (!freeYards.length) break;
    let r = Math.random() * weights.reduce((s, w) => s + w, 0), sp = species[0];
    for (let i = 0; i < species.length; i++) if ((r -= weights[i]) < 0) { sp = species[i]; break; }
    if (o.list.some((x) => x.species === sp) && species.length > 1) sp = pick(species.filter((s) => s !== sp));
    const yard = pick(freeYards);
    const [lo, hi] = COUNTS[sp];
    // Nearer buyers want them sooner.
    const early = yard.site.id === 'mill' ? 11 : yard.site.id === 'drover' ? 12 : 13;
    o.list.push({ id: o.nextId++, yard: yard.site.id, species: sp, n: ri(lo, hi), due: hourToT(ri(early, early + 3)), got: 0, paid: 0, state: 'open' });
  }
  if (o.list.length && !game.tipsSeen.has('orders')) {
    game.tipsSeen.add('orders');
    const e = game.input.touchMode ? 'NIP' : 'E';
    game.tip = { text: `A BUYER WANTS STOCK (TOP OF THE SCREEN). DRIVE THEM TO THE YARD IN TIME. ${e} AT A PEN GATE LETS YOUR OWN STOCK OUT.`, t: 10 };
  }
}

// What one head is worth to this buyer, given how calm it arrived.
export function headPrice(id: SpeciesId, peakStress: number): number {
  return Math.max(1, Math.round(SPECIES[id].value * ORDER_RATE * calmRating(peakStress).mult));
}

export function updateOrders(game: Game, dt: number) {
  const o = game.orders;
  const night = game.day.phase === 'night';
  for (const y of game.ranch.yards) {
    const ord = o.forYard(y.site.id);
    const p = y.pen;
    if (ord) {
      for (const a of admit(p, game.animals, (a) => !a.trial && a.sp.id === ord.species && ord.got < ord.n)) {
        ord.got++;
        const v = headPrice(a.sp.id, a.peakStress);
        ord.paid += v;
        game.earn(v);
        game.fx.float(a.x, a.y - 10, `+${v}$`, C.butter, 1.1);
        game.audio?.play('coin', { x: a.x, y: a.y, vol: 0.7 });
      }
      if (ord.got >= ord.n) finish(game, ord, y);
    }
    // Open while the order wants more, or while someone is in the gateway.
    const gp = p.gatePoint(0);
    const inGate = game.animals.some((a) => !a.gone && !a.pen && Math.hypot(a.x - gp.x, a.y - gp.y) < a.sp.r + 9);
    const wasOpen = p.open;
    p.open = (!!ord && !night) || inGate;
    if (wasOpen && !p.open) evict(p, game.animals);
    swingGate(p, dt, game.map);
    // The buyer leads the stock away soon after the order is closed.
    if (!o.forYard(y.site.id) && p.animals.length && (y.leaveT -= dt) <= 0) leadAway(game, p);
  }
  for (const ord of o.open) {
    if (game.day.t < ord.due && !night) continue;
    ord.state = 'gone';
    const y = yardOf(game, ord.yard);
    y.leaveT = 1.5;
    const who = y.site.name;
    game.showBanner(`${who} HAS GONE`, ord.got ? `TOOK ${ord.got} OF ${ord.n}  +${ord.paid}$` : 'THE ORDER WAS MISSED', 2.6);
  }
}

function finish(game: Game, ord: Order, y: Yard) {
  ord.state = 'done';
  y.leaveT = 2.2;
  y.pen.shutFlash = 1;
  game.totals.orders = (game.totals.orders ?? 0) + 1;
  const sp = SPECIES[ord.species];
  const calm = y.pen.animals.every((a) => calmRating(a.peakStress).mult > 1);
  if (calm) game.totals.calmOrders = (game.totals.calmOrders ?? 0) + 1;
  game.showBanner('SOLD!', `${ord.n} ${(ord.n === 1 ? sp.name : sp.plural).toUpperCase()} TO ${y.site.name}${calm ? '  ALL CALM' : ''}  +${ord.paid}$`, 3);
  game.audio?.play('gate', { x: y.pen.cx, y: y.pen.cy });
  setTimeout(() => game.audio?.play('thatlldo'), 180);
}

function leadAway(game: Game, p: Pen) {
  for (const a of p.animals) {
    a.gone = true;
    game.fx.dust(a.x, a.y + 2);
  }
  p.animals = [];
}

// The pen gate the dog is standing at, if any.
export function penGateAt(game: Game): Pen | null {
  const d = game.dog;
  let best: Pen | null = null, bd = 16;
  for (const p of game.ranch.pens) {
    const out = p.gatePoint(6), inn = p.gatePoint(-6);
    const dd = Math.min(Math.hypot(out.x - d.x, out.y - d.y), Math.hypot(inn.x - d.x, inn.y - d.y));
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}

// E at a pen gate: hold it open to let the stock out, or shut it again.
// Only when there is no loose animal at the dog's nose to nip instead.
export function gateAction(game: Game): boolean {
  const p = penGateAt(game);
  if (!p) return false;
  const d = game.dog;
  if (!p.letOut && !p.animals.length) return false;
  const nose = game.animals.some((a) => !a.pen && !a.gone && Math.hypot(a.x - (d.x + d.hx * 4), a.y - (d.y + d.hy * 4)) < a.sp.r + 9);
  if (nose && !p.letOut) return false;
  game.ranch.setLetOut(p, !p.letOut);
  game.audio?.play('gate', { x: p.cx, y: p.cy });
  const gp = p.gatePoint(0);
  game.fx.float(gp.x, gp.y - 10, p.letOut ? 'GATE OPEN' : 'GATE SHUT', C.wool, 1);
  return true;
}

// Which order, if any, wants this species.
export function orderFor(game: Game, id: SpeciesId): Order | undefined {
  return game.orders.open.find((o) => o.species === id);
}
