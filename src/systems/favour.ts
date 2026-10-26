import { C } from '../palette';
import { calmRating, type Game } from '../game';
import { Animal } from '../entities/animal';
import { RARE_BREEDS, SPECIES } from '../entities/species';
import type { Coat } from '../art/animals';
import type { FolkId } from '../entities/folk';
import type { YardId } from '../world/map';
import { MAX_UP, UPGRADES } from './economy';
import { hourToT, yardOf, type Order } from './orders';

// Buyers' favour. Each buyer keeps a tally of how you treat them: a filled
// order raises it, calm stock and an early delivery raise it more, a missed
// order costs a little (never a level once reached). Each level brings
// something you can see and use: better prices, special orders, the
// buyer's yard dressing up, a gift, and at the top your ranch's name on
// their sign, "a friend of the valley". The shearer, who comes only in
// summer, has a shorter track.
//
// orders.ts calls in at four points (favourOrders, favourTakes, favourHead,
// onOrderFilled / onOrderMissed); the rest is here and in art/favour.ts.

export type BuyerId = YardId | 'shear';
export type Special = 'rush' | 'show' | 'drove';
export const BUYER_IDS: BuyerId[] = ['mill', 'drover', 'sale', 'shear'];

interface Step {
  perk: string; // what this level brings (the Ledger, the card)
  line: string; // what the buyer says when you reach it
}

export interface BuyerDef {
  id: BuyerId;
  name: string;
  folk: FolkId | null; // who stands at the yard (the shearer comes and goes)
  at: number[]; // points to reach each level, 1..max
  pay: number[]; // % over the price, by level
  steps: Step[];
}

export const TITLES = ['NEW FACE', 'REGULAR', 'TRUSTED', 'GOOD FRIEND'];
export const FRIEND = 'FRIEND OF THE VALLEY';

export const BUYERS: BuyerDef[] = [
  {
    id: 'mill', name: 'THE MILLER', folk: 'miller', at: [5, 12, 21, 32], pay: [0, 10, 15, 20, 30],
    steps: [
      { perk: 'PAYS 10% OVER', line: "YOU'LL DO. I'LL PAY A BIT OVER FROM NOW ON." },
      { perk: 'RUSH ORDERS AT DOUBLE PAY', line: "IF I'M SHORT I'LL SEND FOR YOU EARLY. DOUBLE PAY, MIND." },
      { perk: 'A GIFT: HIS OLD MILLSTONE', line: "HAVE MY OLD MILLSTONE. IT'D LOOK GRAND BY YOUR DOOR." },
      { perk: 'YOUR NAME UP, MEAL EACH WINTER', line: "THERE'S YOUR NAME ON MY MILL. AND MEAL FOR YOUR LOFT EVERY WINTER." },
    ],
  },
  {
    id: 'drover', name: 'THE DROVER', folk: 'drover', at: [5, 12, 21, 32], pay: [0, 10, 15, 20, 30],
    steps: [
      { perk: 'PAYS 10% OVER', line: "STEADY STOCK, THAT. I'LL REMEMBER YOUR NAME." },
      { perk: 'BIG DROVES AT 1.5X PAY', line: "I'VE BIGGER DROVES TO MAKE UP. FANCY IT?" },
      { perk: 'A GIFT: A RARE BREED', line: 'FOUND YOU SOMETHING SPECIAL ON THE ROAD. WALK IT HOME.' },
      { perk: 'YOUR NAME UP, FREE DOG TRAINING', line: "MY OLD DOG'S TAUGHT YOURS A TRICK. FRIENDS FOR LIFE, EH?" },
    ],
  },
  {
    id: 'sale', name: 'THE SALE YARD', folk: 'auctioneer', at: [5, 12, 21, 32], pay: [0, 10, 15, 20, 30],
    steps: [
      { perk: 'PAYS 10% OVER', line: 'SOLD! AND A LITTLE EXTRA FOR QUALITY.' },
      { perk: 'SHOW ORDERS: CALM ONLY, 2X PAY', line: "BRING ME SHOW STOCK, CALM AS YOU LIKE. I'LL PAY DOUBLE." },
      { perk: 'A GIFT: THE OLD SHOW BELL', line: 'TAKE THE OLD SHOW BELL. RING IT FOR ME NOW AND THEN.' },
      { perk: 'YOUR NAME UP, THE VALLEY ROSETTE', line: "BEST STOCK IN THE VALLEY. IT'S ON THE BOARD FOR ALL TO SEE." },
    ],
  },
  {
    id: 'shear', name: 'THE SHEARER', folk: null, at: [4, 9, 15], pay: [0, 25, 30, 40],
    steps: [
      { perk: 'PAYS 25% MORE A FLEECE', line: 'LOVELY FLEECES. A BIT MORE FOR THOSE.' },
      { perk: 'A SECOND CLIP EACH SUMMER', line: "I'LL BE BACK MID-SUMMER FOR ANOTHER CLIP." },
      { perk: 'A GIFT: A FLEECE BALE', line: 'HAVE A BALE ON ME. FRIENDS OF THE FLOCK, WE ARE.' },
    ],
  },
];

export const buyerDef = (id: BuyerId) => BUYERS.find((b) => b.id === id)!;
export const buyerOf = (o: Order): BuyerId => (o.kind === 'shear' ? 'shear' : o.yard);
export const maxLevel = (id: BuyerId) => buyerDef(id).at.length;
export const titleOf = (id: BuyerId, level: number) => (level >= maxLevel(id) ? FRIEND : TITLES[level]);

// What a filled order earns: filled, all calm, early, and a special order.
export const PTS = { fill: 3, calm: 2, early: 1, special: 1, missed: -2, short: -1 };
export const SPECIAL_PAY: Record<Special, number> = { rush: 2, show: 2, drove: 1.5 };
export const SPECIAL_WORD: Record<Special, string> = { rush: 'RUSH', show: 'SHOW', drove: 'BIG DROVE' };
const MEAL = 6; // bales the miller sends at the start of winter

export interface FavourSave {
  pts: Partial<Record<BuyerId, number>>;
  filled?: Partial<Record<BuyerId, number>>;
  specials?: Special[]; // kinds of special order filled at least once
  given?: string[]; // one-off gifts handed over
  meal?: number; // the last year the miller sent meal
}

export class Favour {
  pts: Record<BuyerId, number> = { mill: 0, drover: 0, sale: 0, shear: 0 };
  filled: Record<BuyerId, number> = { mill: 0, drover: 0, sale: 0, shear: 0 };
  specials = new Set<Special>();
  given = new Set<string>();
  meal = 0;
  // Lines waiting for the buyer to be on screen.
  private lines: { who: FolkId; text: string; t: number }[] = [];
  private refused = new WeakSet<Animal>();

  level(id: BuyerId): number {
    const at = buyerDef(id).at;
    let l = 0;
    while (l < at.length && this.pts[id] >= at[l]) l++;
    return l;
  }

  // Points into this level and the points the next one needs (null at the top).
  progress(id: BuyerId): { level: number; have: number; need: number | null } {
    const at = buyerDef(id).at, l = this.level(id);
    const from = l ? at[l - 1] : 0;
    return { level: l, have: this.pts[id] - from, need: l < at.length ? at[l] - from : null };
  }

  pay(id: BuyerId): number {
    return buyerDef(id).pay[this.level(id)];
  }

  friends(): number {
    return BUYER_IDS.filter((id) => this.level(id) >= maxLevel(id)).length;
  }

  // Add (or take) points; a level once reached is never lost.
  add(game: Game, id: BuyerId, n: number) {
    const was = this.level(id);
    const floor = was ? buyerDef(id).at[was - 1] : 0;
    this.pts[id] = Math.max(floor, this.pts[id] + n);
    for (let l = was + 1; l <= this.level(id); l++) levelUp(game, id, l);
  }

  say(who: FolkId, text: string, t: number) {
    this.lines.push({ who, text, t });
  }

  update(game: Game, dt: number) {
    // The buyer's line, said when they are in view (a few tries).
    for (const l of this.lines) {
      l.t -= dt;
      const p = game.folk.people.find((x) => x.id === l.who);
      if (p && game.folk.say(game, p, l.text, true)) l.t = -1;
    }
    this.lines = this.lines.filter((l) => l.t > 0);
    // Show orders: rattled stock in the yard is not taken until it settles.
    for (const o of game.orders.open) {
      if (o.special !== 'show') continue;
      const p = yardOf(game, o.yard).pen;
      for (const a of game.animals) {
        if (a.pen || a.gone || a.sp.id !== o.species || this.refused.has(a) || !p.contains(a.x, a.y)) continue;
        if (calmRating(a.peakStress).mult > 1) continue;
        this.refused.add(a);
        game.fx.float(a.x, a.y - 12, 'TOO RATTLED: LET IT SETTLE', C.wool, 1.6);
      }
    }
    // The miller's meal on the first morning of winter.
    const s = game.season;
    if (s.season === 'winter' && s.dayOf === 1 && this.level('mill') >= 4 && this.meal !== s.year && game.net?.role !== 'guest') {
      this.meal = s.year;
      game.seasonal.loft += MEAL;
      game.tip = { text: `THE MILLER SENT MEAL FOR THE WINTER: ${MEAL} MORE BALES IN THE LOFT.`, t: 7 };
    }
  }

  save(): FavourSave {
    return { pts: { ...this.pts }, filled: { ...this.filled }, specials: [...this.specials], given: [...this.given], meal: this.meal };
  }

  load(d: FavourSave | undefined) {
    for (const id of BUYER_IDS) {
      this.pts[id] = Math.max(0, d?.pts[id] ?? 0);
      this.filled[id] = d?.filled?.[id] ?? 0;
    }
    this.specials = new Set((d?.specials ?? []).filter((s) => s in SPECIAL_PAY));
    this.given = new Set(d?.given ?? []);
    this.meal = d?.meal ?? 0;
  }
}

// ---- A level reached ----

function levelUp(game: Game, id: BuyerId, level: number) {
  const def = buyerDef(id), step = def.steps[level - 1];
  // One-off gifts.
  const once = (key: string, give: () => void) => {
    if (game.favour.given.has(key)) return;
    game.favour.given.add(key);
    give();
  };
  if (id === 'drover' && level === 3) once('breed', () => giveBreed(game));
  if (id === 'drover' && level === 4) once('training', () => giveTraining(game));
  game.achievements.favourCard(id, level);
  if (def.folk) game.favour.say(def.folk, step.line, 25);
}

// The drover walks a rare breed of a kind you keep to his yard's gate.
function giveBreed(game: Game) {
  const kept = new Set(game.ranch.pens.filter((p) => p.animals.length).map((p) => p.species));
  const ok = RARE_BREEDS.filter((b) => b.tier <= game.tier);
  const b = ok.filter((x) => kept.has(x.species)).pop() ?? ok[0];
  if (!b) return;
  const out = yardOf(game, 'drover').pen.gatePoint(16);
  const a = new Animal(b.species, out.x, out.y, b.coat as Coat);
  a.home = true;
  a.stress = 0.1;
  game.animals.push(a);
  game.fx.float(out.x, out.y - 14, b.name, C.butter, 3);
}

// The drover's old dog teaches yours: a level of training, free.
function giveTraining(game: Game) {
  const u = [...UPGRADES].sort((a, b) => game.upgrades[a.key] - game.upgrades[b.key])[0];
  if (u && game.upgrades[u.key] < MAX_UP) {
    game.upgrades[u.key]++;
    game.totals.upgrades++;
    game.applyUpgrades();
  } else game.earn(100);
}

// ---- The hooks orders.ts calls ----

// After the morning's orders are drawn up: a trusted buyer may make one of
// them special, and a trusted shearer comes back for a second clip.
export function favourOrders(game: Game) {
  const f = game.favour;
  const s = game.season;
  if (s.season === 'summer' && s.dayOf === 3 && game.tier >= 2 && f.level('shear') >= 2) secondClip(game);
  for (const o of game.orders.list) {
    if (o.state !== 'open' || o.kind || o.special || f.level(o.yard) < 2 || Math.random() < 0.5) continue;
    const penned = game.ranch.pens.reduce((n, p) => n + p.animals.filter((a) => a.sp.id === o.species && !a.young).length, 0);
    if (o.yard === 'mill') {
      // Only when there is stock at home to send: a rush order from the far pastures would be cruel.
      if (penned < 2) continue;
      o.n = Math.max(2, Math.min(o.n - 1, penned));
      o.due = hourToT(9.5 + Math.random());
      o.special = 'rush';
    } else if (o.yard === 'sale') {
      o.n = Math.max(2, o.n - 1);
      o.special = 'show';
    } else {
      o.n += 3;
      o.due = Math.max(o.due, hourToT(17));
      o.special = 'drove';
    }
    const sp = SPECIES[o.species];
    const tip = `special-${o.special}`;
    if (!game.tipsSeen.has(tip)) {
      game.tipsSeen.add(tip);
      const what = o.special === 'rush' ? 'NEEDS THEM EARLY: DOUBLE PAY' : o.special === 'show' ? 'WANTS SHOW STOCK: CALM ONLY, DOUBLE PAY' : 'WANTS A BIG DROVE: HALF AGAIN THE PAY';
      game.tip = { text: `${yardOf(game, o.yard).site.name} ${what}. ${o.n} ${sp.plural.toUpperCase()}.`, t: 8 };
    }
    break; // one special a day
  }
}

function secondClip(game: Game) {
  const year = game.season.year;
  if (game.orders.list.some((o) => o.kind === 'shear')) return;
  const owned = game.ranch.pens.reduce((s, p) => s + p.animals.filter((a) => a.sp.id === 'sheep' && !a.young && a.shorn !== year).length, 0);
  if (owned < 3) return;
  const yard: YardId = game.orders.list.some((o) => o.yard === 'mill') ? 'drover' : 'mill';
  game.orders.list = game.orders.list.filter((o) => o.yard !== yard);
  game.orders.list.push({ id: game.orders.nextId++, yard, species: 'sheep', n: Math.min(8, owned), due: hourToT(17), got: 0, paid: 0, state: 'open', kind: 'shear' });
  game.tip = { text: `THE SHEARER IS BACK FOR A SECOND CLIP, AT ${yardOf(game, yard).site.name}.`, t: 7 };
}

// Will this buyer take this animal? (A show order takes calm stock only.)
export function favourTakes(o: Order, a: Animal): boolean {
  return o.special !== 'show' || calmRating(a.peakStress).mult > 1;
}

// One head taken (worth `v`): the buyer's favour and any special pay on top.
export function favourHead(game: Game, o: Order, a: Animal, v: number) {
  const pct = game.favour.pay(buyerOf(o)) / 100;
  const mult = o.special ? SPECIAL_PAY[o.special] - 1 : 0;
  const bonus = Math.round(v * (pct + mult));
  if (bonus <= 0) return;
  o.paid += bonus;
  game.earn(bonus);
  game.fx.float(a.x, a.y - 17, `+${bonus}$ ${o.special ? SPECIAL_WORD[o.special] : '@'}`, C.wool, 1.2);
}

export function onOrderFilled(game: Game, o: Order, calm: boolean) {
  const id = buyerOf(o), f = game.favour;
  let n = PTS.fill + (calm ? PTS.calm : 0);
  if (o.due - game.day.t >= hourToT(8) - hourToT(6) && o.special !== 'rush') n += PTS.early; // two hours to spare
  if (o.special) {
    n += PTS.special;
    f.specials.add(o.special);
  }
  f.filled[id]++;
  const gp = yardOf(game, o.yard).pen.gatePoint(0);
  game.fx.float(gp.x, gp.y - 22, `+${n} @ ${buyerDef(id).name}`, C.butter, 2.2);
  f.add(game, id, n);
}

export function onOrderMissed(game: Game, o: Order) {
  const id = buyerOf(o);
  if (o.kind === 'shear') {
    // The shearer is glad of whatever came; nothing at all is a wasted trip.
    game.favour.add(game, id, o.got ? 1 + Math.floor((2 * o.got) / o.n) : PTS.short);
    return;
  }
  game.favour.add(game, id, o.got ? PTS.short : PTS.missed);
}

// The jobs card's tag for an order: the yard, and the special if it is one.
export function orderTag(o: Order, yard: string): string {
  return o.special ? `${yard} ${SPECIAL_WORD[o.special]}` : yard;
}

// ---- For the Ledger ----

export interface BuyerLine {
  def: BuyerDef;
  level: number;
  title: string;
  have: number;
  need: number | null;
  next: string | null; // what the next level brings
  pay: number;
  filled: number;
  met: boolean; // seen at all yet (the shearer only from the first summer)
}

export function buyerLines(game: Game): BuyerLine[] {
  const f = game.favour;
  return BUYERS.map((def) => {
    const p = f.progress(def.id);
    const met = game.tier >= 2 && (def.id !== 'shear' || f.pts.shear > 0 || f.filled.shear > 0 || game.season.year > 1 || game.season.season !== 'spring');
    return { def, level: p.level, title: titleOf(def.id, p.level), have: p.have, need: p.need, next: p.level < def.steps.length ? def.steps[p.level].perk : null, pay: f.pay(def.id), filled: f.filled[def.id], met };
  });
}
