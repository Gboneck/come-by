import type { Game } from '../game';
import { calmRating } from '../game';
import type { Animal } from '../entities/animal';
import type { Predator } from '../entities/predator';
import { MAX_UP } from './economy';
import { CLASSES, type Run, type TrialResult } from './trials';
import { KEEPSAKES } from '../world/places';
import { BUYER_IDS, type BuyerId } from './favour';
import { travelBadges, travelRibbons, travelStamps } from '../net/travels';
import type { GuestNet } from '../net/guest';
import { ownAchievements } from './save';
import type { BadgeGroup, IconId } from '../art/badges';
import { quality } from '../gfx/quality';
import { whatsThisUp } from '../ui/whatsthis';
import { buzz } from '../ui/settings';

// Achievements: one list of the notable things a ranch can do, each with a
// badge drawn in code. Most are read from the lifetime record (so an older
// save is credited with what it already did); a few are moments caught as
// they happen (a day without a bark, a coyote made to drop its prey). Each
// one earned comes in as a card with a stamp (ui/achievements.ts), sits on
// the Ledger's BADGES page and pins itself to the board by the farmhouse.
//
// A co-op guest earns only the ones marked `guest` (visiting, the brace):
// those go to their own save through net/travels.ts.

export type Group = BadgeGroup;
export const GROUPS: Group[] = ['herding', 'trials', 'ranch', 'valley', 'seasons', 'coop'];

export interface AchDef {
  id: string;
  name: string;
  what: string; // how it is earned
  group: Group;
  icon: IconId;
  big?: boolean; // a big one: the full fanfare
  secret?: string; // the hint shown while it is locked
  value?: (g: Game) => number; // progress, read from the game (with target)
  target?: number | (() => number); // a function when it reads another module's list
  guest?: boolean; // can be earned on a friend's ranch
}

const delivered = (g: Game) => Object.values(g.totals.delivered).reduce((s, n) => s + (n ?? 0), 0);
const placed = (g: Game) => g.totals.ribbons.reduce((s, n) => s + n, 0);
const trained = (g: Game) => Object.values(g.upgrades).reduce((s, l) => s + l - 1, 0);
const levels = (g: Game) => Math.max(...BUYER_IDS.map((id) => g.favour.level(id)));
const rareKept = (g: Game) => g.totals.rareBought + g.animals.filter((a) => a.rare && !a.gone && (a.pen || a.home)).length;

// Other sessions' state, read without depending on it: the valley's
// projects (systems/projects.ts) and the village (systems/valley.ts).
interface Elsewhere {
  projects?: { done?: Set<string> | string[] };
  ranch: { village?: { built?: Set<string> } };
}
const projectsDone = (g: Game) => {
  const d = (g as unknown as Elsewhere).projects?.done;
  return d ? (d instanceof Set ? d.size : d.length) : 0;
};
const villageBuilt = (g: Game) => (g as unknown as Elsewhere).ranch.village?.built?.size ?? 0;

export const ACHIEVEMENTS: AchDef[] = [
  // ---- Herding ----
  { id: 'home', name: 'HOME AT LAST', what: 'BRING YOUR FIRST ANIMALS HOME', group: 'herding', icon: 'home', value: delivered, target: 1 },
  { id: 'steady', name: 'STEADY HANDS', what: '10 CALM DRIVES HOME', group: 'herding', icon: 'waves', value: (g) => g.totals.calmBatches, target: 10 },
  { id: 'quiet', name: 'NOT A WORD', what: "A DAY'S HERDING WITHOUT ONE BARK (6 OR MORE HOME)", group: 'herding', icon: 'hush' },
  { id: 'perfect', name: 'STILL WATERS', what: 'DRIVE 10 OR MORE HOME AT ONCE, EVERY ONE CALM', group: 'herding', icon: 'sheep', big: true },
  { id: 'road', name: 'THE LONG ROAD', what: '300 HEAD BROUGHT HOME IN ALL', group: 'herding', icon: 'road', value: delivered, target: 300 },
  { id: 'watch', name: 'NIGHT WATCH', what: '5 NIGHTS WITH NO STOCK LOST', group: 'herding', icon: 'moon', value: (g) => g.totals.nightsNoLoss, target: 5 },
  { id: 'saved', name: 'NOT TONIGHT', what: 'MAKE A COYOTE OR WOLF DROP WHAT IT CARRIED', group: 'herding', icon: 'lantern', secret: 'SOMETHING IS CARRIED OFF INTO THE DARK...' },
  { id: 'storm', name: 'STORM DOG', what: 'A CALM DRIVE HOME IN A STORM', group: 'herding', icon: 'bolt', secret: 'WHEN THE SKY IS AT ITS WORST...' },
  { id: 'nap', name: 'FORTY WINKS', what: 'REST ON THE RANCH TILL THE SUN GOES DOWN', group: 'herding', icon: 'zzz', secret: 'A TIRED DOG KNOWS BEST.' },
  // ---- Trials ----
  { id: 'ribbon', name: 'FIRST RIBBON', what: 'PLACE IN THE TOP THREE AT A TRIAL', group: 'trials', icon: 'flag', value: placed, target: 1 },
  { id: 'hundred', name: 'A PERFECT 100', what: 'SCORE 100 IN A TRIAL', group: 'trials', icon: 'star', big: true, value: (g) => g.totals.bestTrial, target: 100 },
  { id: 'soft', name: 'SOFT HANDS', what: 'WIN THE CATTLE CLASS WITHOUT A SINGLE NIP', group: 'trials', icon: 'cow', big: true },
  { id: 'cup', name: 'THE VALLEY CUP', what: 'WIN THE VALLEY CUP', group: 'trials', icon: 'cup', big: true, value: (g) => g.trials.cups, target: 1 },
  { id: 'classes', name: 'BEST IN SHOW', what: 'WIN EVERY CLASS AT THE SHOW GROUND', group: 'trials', icon: 'crook', value: (g) => CLASSES.filter((c) => g.trials.won.includes(c.id)).length, target: () => CLASSES.length },
  // ---- The ranch ----
  { id: 'topdog', name: 'TOP DOG', what: 'TRAIN YOUR DOG TO THE TOP IN EVERYTHING', group: 'ranch', icon: 'dog', value: trained, target: () => 4 * (MAX_UP - 1) },
  { id: 'pack', name: 'THE PACK', what: 'HIRE BOTH HELPER DOGS', group: 'ranch', icon: 'paws', value: (g) => g.helpers.length, target: 2 },
  { id: 'thrive', name: 'THE VALLEY THRIVES', what: 'FINISH THE LAST TIER', group: 'ranch', icon: 'sun', big: true, value: (g) => (g.won ? 1 : 0), target: 1 },
  { id: 'decor', name: 'HOME SWEET HOME', what: 'PLACE 12 PIECES OF DECOR', group: 'ranch', icon: 'flower', value: (g) => g.decor.length, target: 12 },
  { id: 'purse', name: 'A FULL PURSE', what: 'EARN 5000$ IN ALL', group: 'ranch', icon: 'coin', value: (g) => g.totals.earned, target: 5000 },
  // ---- The valley ----
  { id: 'sold', name: 'SOLD!', what: 'FILL YOUR FIRST ORDER', group: 'valley', icon: 'cart', value: (g) => g.totals.orders, target: 1 },
  { id: 'trusted', name: 'TRUSTED', what: "WIN A BUYER'S TRUST (FAVOUR 2)", group: 'valley', icon: 'heart', value: levels, target: 2 },
  { id: 'friend', name: 'FRIEND OF THE VALLEY', what: "A BUYER'S TOP FAVOUR: YOUR NAME ON THEIR SIGN", group: 'valley', icon: 'sign', big: true, value: (g) => g.favour.friends(), target: 1 },
  { id: 'everyone', name: "EVERYBODY'S FRIEND", what: 'TOP FAVOUR WITH EVERY BUYER, THE SHEARER TOO', group: 'valley', icon: 'hearts', big: true, value: (g) => g.favour.friends(), target: () => BUYER_IDS.length },
  { id: 'specials', name: 'ALL SORTS', what: 'FILL A RUSH ORDER, A SHOW ORDER AND A BIG DROVE', group: 'valley', icon: 'clock', value: (g) => g.favour.specials.size, target: 3 },
  { id: 'places', name: 'OFF THE BEATEN TRACK', what: 'FIND 6 HIDDEN PLACES', group: 'valley', icon: 'compass', value: (g) => g.discovery.found.size, target: 6 },
  { id: 'magpie', name: 'MAGPIE', what: 'FIND EVERY KEEPSAKE', group: 'valley', icon: 'key', value: (g) => g.discovery.keepsakes.size, target: () => KEEPSAKES.length },
  { id: 'works', name: 'VALLEY WORKS', what: 'FINISH A VALLEY PROJECT', group: 'valley', icon: 'spade', value: projectsDone, target: 1 },
  { id: 'village', name: 'A VILLAGE GROWS', what: 'SEE THREE NEW BUILDINGS IN THE VILLAGE', group: 'valley', icon: 'cottages', value: villageBuilt, target: 3 },
  // ---- Seasons ----
  { id: 'winter', name: 'SNUG AS A BUG', what: 'A WINTER WITH NO PEN GOING HUNGRY', group: 'seasons', icon: 'snow', value: (g) => g.totals.wintersFed, target: 1 },
  { id: 'lambs', name: 'SPRING LAMBS', what: '10 LAMBS BORN ON THE RANCH', group: 'seasons', icon: 'lamb', value: (g) => g.totals.lambs, target: 10 },
  { id: 'fair', name: 'BEST IN CLASS', what: 'TAKE FIRST AT THE AUTUMN FAIR', group: 'seasons', icon: 'rosette', value: (g) => g.totals.fairRibbons[0], target: 1 },
  { id: 'rare', name: 'RARE BREED', what: 'KEEP A RARE BREED', group: 'seasons', icon: 'blacksheep', value: rareKept, target: 1 },
  { id: 'year', name: 'A YEAR ON THE RANCH', what: 'SEE THE SEASONS COME ROUND TO SPRING', group: 'seasons', icon: 'leaf', value: (g) => g.season.year - 1, target: 1 },
  // ---- Co-op ----
  { id: 'visit', name: 'GOOD NEIGHBOUR', what: "HERD ON A FRIEND'S RANCH", group: 'coop', icon: 'gate', guest: true, value: () => travelStamps().length, target: 1 },
  { id: 'host', name: 'OPEN GATE', what: 'A FRIEND HERDS ON YOUR RANCH', group: 'coop', icon: 'door' },
  { id: 'brace', name: 'A BRACE OF DOGS', what: 'TAKE A RIBBON IN THE BRACE CLASS WITH A FRIEND', group: 'coop', icon: 'dogs', guest: true },
  { id: 'stamps', name: 'WELL TRAVELLED', what: 'VISIT THREE DIFFERENT RANCHES', group: 'coop', icon: 'stamp', guest: true, value: () => travelStamps().length, target: 3 },
];

export const achById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
export const targetOf = (a: AchDef) => (typeof a.target === 'function' ? a.target() : a.target ?? 0);

// A card waiting to slide in: a badge, a buyer's new level, or (once, on an
// older save's first load) the badges it had already earned.
export type Card =
  | { kind: 'badge'; id: string }
  | { kind: 'favour'; buyer: BuyerId; level: number }
  | { kind: 'past'; n: number };

export interface AchSave {
  got: Record<string, number>; // id -> day earned (0: worked out from an older save)
}

export class Achievements {
  got = new Map<string, number>();
  queue: Card[] = [];
  card: Card | null = null;
  cardT = 0; // age of the card on screen
  sel = 0; // the BADGES page's selection
  unseen = 0; // earned since the BADGES page was last looked at
  hostPins: Group[] | null = null; // co-op guest: the host's board
  private checkT = 0;
  private day = 0;
  private dayBarks = 0;
  private dayHome = 0;
  private nipped = new WeakSet<Run>();
  private results = new WeakSet<TrialResult>();
  private carrying = new Map<Predator, Animal>();
  private phase = '';
  private loaded = false; // own save read (a guest's copy)

  has(id: string) {
    return this.got.has(id);
  }

  // Earn one. `quiet` (worked out on loading an older save): no card.
  grant(game: Game, id: string, quiet = false): boolean {
    const def = achById(id);
    if (!def || this.got.has(id) || game.demo) return false;
    const guest = game.net?.role === 'guest';
    if (guest && !def.guest) return false;
    this.got.set(id, quiet ? 0 : game.day.day);
    if (guest) (game.net as GuestNet).travels.badge(id);
    if (!quiet) this.queue.push({ kind: 'badge', id });
    this.unseen++;
    game.ledgerNew = true;
    return true;
  }

  // A pin on the board by the farmhouse for each badge (the host's, on a
  // friend's ranch).
  pins(game: Game): Group[] {
    if (game.net?.role === 'guest') return this.hostPins ?? [];
    return ACHIEVEMENTS.filter((a) => this.got.has(a.id)).map((a) => a.group);
  }

  favourCard(buyer: BuyerId, level: number) {
    this.queue.push({ kind: 'favour', buyer, level });
  }

  // Progress on one: [value, target], or null if it is caught as it happens.
  progress(game: Game, def: AchDef): [number, number] | null {
    const t = targetOf(def);
    if (!def.value || !t) return null;
    return [Math.max(0, Math.min(t, Math.floor(def.value(game)))), t];
  }

  // Everything read from the game, granted.
  private check(game: Game, quiet: boolean): number {
    let n = 0;
    for (const def of ACHIEVEMENTS) {
      if (this.got.has(def.id) || !def.value || !def.target) continue;
      if (def.value(game) >= targetOf(def) && this.grant(game, def.id, quiet)) n++;
    }
    // The brace, from a ribbon there (or one carried home from a friend's).
    if (game.trials.won.includes('brace') || travelRibbons() > 0) if (this.grant(game, 'brace', quiet)) n++;
    return n;
  }

  // ---- Moments, as the game reports them ----

  // The player's dog barked or nipped (game.ts, onDogEvent).
  dogEvent(game: Game, ev: 'bark' | 'nip') {
    if (ev === 'bark') this.dayBarks++;
    const r = game.trials.run;
    if (ev === 'nip' && r && r.cls.species === 'cow') this.nipped.add(r);
  }

  // A pen shut on a drive home (game.ts, onRanchEvent).
  drive(game: Game, batch: Animal[], label: string) {
    const calm = batch.every((a) => calmRating(a.peakStress).mult > 1);
    if (batch.length >= 10 && calm) this.grant(game, 'perfect');
    if (label === 'CALM' && game.weather.sky === 'storm') this.grant(game, 'storm');
  }

  // ---- The frame ----

  update(game: Game, dt: number) {
    if (game.demo) return;
    // A new day: was yesterday's herding done without a bark?
    if (game.day.day !== this.day) {
      if (this.day && !this.dayBarks && delivered(game) - this.dayHome >= 6) this.grant(game, 'quiet');
      this.day = game.day.day;
      this.dayBarks = 0;
      this.dayHome = delivered(game);
    }
    // Resting right through to the dusk.
    const ph = game.day.phase;
    if (ph === 'dusk' && this.phase === 'day' && game.rest > 1.5) this.grant(game, 'nap');
    this.phase = ph;
    // A thief made to let go: it was carrying, now it is not, and the
    // animal is still with us, by a dog.
    for (const p of game.predators) {
      const was = this.carrying.get(p);
      if (p.carry) this.carrying.set(p, p.carry);
      else if (was) {
        this.carrying.delete(p);
        const near = [game.dog, ...game.coop].some((d) => Math.hypot(d.x - was.x, d.y - was.y) < 30);
        if (!was.gone && near) this.grant(game, 'saved');
      }
    }
    if (!game.predators.length) this.carrying.clear();
    // The judge's card: the cattle class won without a nip, a brace ribbon.
    this.results_(game);
    if (game.net?.role === 'host' && game.net.dogs.length) this.grant(game, 'host');
    if ((this.checkT -= dt) <= 0) {
      this.checkT = 0.5;
      this.check(game, false);
    }
    this.cards(game, dt);
  }

  private results_(game: Game) {
    const res = game.trials.result;
    if (!res || this.results.has(res)) return;
    this.results.add(res);
    const r = game.trials.run;
    if (res.cls.id === 'cattle' && res.place === 1 && r && !this.nipped.has(r)) this.grant(game, 'soft');
    if (res.cls.id === 'brace' && res.place >= 1 && res.place <= 3) this.grant(game, 'brace');
  }

  // On a friend's ranch: only what is ours to earn there.
  guestUpdate(game: Game, dt: number) {
    if (!this.loaded) {
      this.loaded = true;
      this.load(game, ownAchievements());
      for (const id of travelBadges()) if (achById(id)) this.got.set(id, this.got.get(id) ?? 0);
    }
    this.results_(game);
    if ((this.checkT -= dt) <= 0) {
      this.checkT = 0.5;
      for (const def of ACHIEVEMENTS) if (def.guest && def.value && def.target && !this.got.has(def.id) && def.value(game) >= targetOf(def)) this.grant(game, def.id);
    }
    this.cards(game, dt);
  }

  // The card on screen ages while it can be seen (not behind the tier card,
  // the judge's card, a banner or a what's-this card); then the next comes in.
  private cards(game: Game, dt: number) {
    if (game.mode !== 'play' || game.feel.tierCard || game.trials.result || game.banner || whatsThisUp() || game.feel.fading) return;
    if (this.card) {
      this.cardT += dt;
      if (this.cardT > cardLife(this.card)) this.card = null;
    }
    if (!this.card && this.queue.length) {
      this.card = this.queue.shift()!;
      this.cardT = 0;
      fanfare(game, this.card);
    }
  }

  dismiss() {
    if (this.card && this.cardT > 0.6) this.cardT = Math.max(this.cardT, cardLife(this.card) - 0.25);
  }

  // ---- Saving ----

  save(): AchSave {
    return { got: Object.fromEntries(this.got) };
  }

  load(game: Game, d: AchSave | undefined) {
    this.got = new Map(Object.entries(d?.got ?? {}).filter(([id]) => achById(id)));
    this.queue = [];
    this.card = null;
    this.day = 0;
  }

  // After a load: anything the save had already done, credited quietly,
  // with one card to say so.
  backfill(game: Game) {
    const n = this.check(game, true);
    if (n) this.queue.push({ kind: 'past', n });
  }
}

export const cardLife = (c: Card) => (c.kind === 'favour' ? 6 : c.kind === 'past' ? 4.5 : 5);
export const isBig = (c: Card) => (c.kind === 'badge' ? !!achById(c.id)?.big : c.kind === 'favour' ? c.level >= 4 || (c.buyer === 'shear' && c.level >= 3) : false);

// The moment a card comes in: a stinger, confetti (as much as GRAPHICS
// allows), a buzz on a phone. Not under the bots.
function fanfare(game: Game, c: Card) {
  if (game.input.override) return; // the bots (tuning runs stay exact)
  const big = isBig(c);
  const W = game.screen.W;
  if (c.kind === 'past') {
    game.audio?.play('click');
    return;
  }
  if (big) {
    game.audio?.play('tierup');
    game.feel.shake(1, 0.3);
  } else if (c.kind === 'favour') game.audio?.stinger('sold');
  else game.audio?.play('thatlldo');
  game.feel.confetti(W, Math.round((big ? 70 : 28) * quality.fx));
  buzz(game.input.touchMode, big ? [30, 60, 30, 60, 90] : [20, 40, 30]);
}
