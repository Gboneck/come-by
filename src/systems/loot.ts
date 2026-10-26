import { C } from '../palette';
import { calmRating, type Game } from '../game';
import { Animal } from '../entities/animal';
import type { Dog, DogStats } from '../entities/dog';
import { hash2, mulberry32 } from '../rng';
import { CS, CW, DEEP, MH, MW, ROCK, SHALLOW, SOLID, TS, Ter, VILLAGE, YARDS, YARD_H, YARD_W, regionById, type SpeciesId, type WorldMap } from '../world/map';
import { PLACES, inPlace, placeById, type PlaceId } from '../world/places';
import type { Season } from './season';

// Sniffing and digging. Each morning things lie buried about the valley: a
// few near the ranch, some out in the regions, richer ones in the hidden
// places (which change with the season), and more after rain. A dog walking
// slowly near one catches its scent (faint wisps drifting to it), and a dog
// that stops sniffs harder and further; standing on it, NIP digs (DIG on a
// phone), unless an animal is at the dog's nose. What comes up is loot:
// coins (modestly), bones to bury and dig up again, seeds that become decor,
// things to wear, two relics that help with the herding, curios for the
// collection, and the pages of an old shepherd's map that lead to lost
// animals, a hidden place and, at the last, a hoard.
//
// Every roll here is seeded (the day, the spot), never Math.random, so a
// seeded tune or pace run is the same with or without loot. The same day's
// spots come out the same on a co-op guest's screen, so both dogs dig the
// same holes; each digger keeps what they find (a guest's goes to their own
// save through src/net/travels.ts).

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
export type LootKind = 'coin' | 'bone' | 'curio' | 'seed' | 'wear' | 'relic' | 'page';

export interface LootItem {
  id: string;
  name: string;
  short: string;
  rarity: Rarity;
  kind: LootKind;
  blurb: string;
  coins?: [number, number]; // coin it is worth when it comes up
  once?: boolean; // found once only (then it drops out of the pool)
  w?: number; // weight within its rarity (default 1)
}

export const LOOT: LootItem[] = [
  // Common.
  { id: 'coin', name: 'A COIN', short: 'COIN', rarity: 'common', kind: 'coin', blurb: 'SOMEBODY\'S POCKET HAD A HOLE IN IT.', coins: [1, 3], w: 4 },
  { id: 'bone', name: 'A BONE', short: 'BONE', rarity: 'common', kind: 'bone', blurb: 'A GOOD ONE. BURY IT ON THE RANCH (STAND STILL, NIP) AND DIG IT UP ANOTHER DAY.', w: 4 },
  { id: 'button', name: 'A BRASS BUTTON', short: 'BUTTON', rarity: 'common', kind: 'curio', blurb: 'OFF A DROVER\'S COAT, LONG AGO.', w: 2 },
  { id: 'horseshoe', name: 'AN OLD HORSESHOE', short: 'HORSESHOE', rarity: 'common', kind: 'curio', blurb: 'HUNG POINTS UP, IT KEEPS THE LUCK IN.', w: 2 },
  { id: 'marble', name: 'A GLASS MARBLE', short: 'MARBLE', rarity: 'common', kind: 'curio', blurb: 'A SHEPHERD\'S CHILD LOST IT HERE.', w: 2 },
  { id: 'pipe', name: 'A CLAY PIPE', short: 'PIPE', rarity: 'common', kind: 'curio', blurb: 'THE BOWL STILL SMELLS OF SMOKE.', w: 1 },
  { id: 'agedbone', name: 'A WELL-AGED BONE', short: 'AGED BONE', rarity: 'common', kind: 'bone', blurb: 'YOUR OWN BURIED BONE, BETTER FOR THE WAIT.', w: 0 },
  // Uncommon.
  { id: 'oldcoin', name: 'AN OLD COIN', short: 'OLD COIN', rarity: 'uncommon', kind: 'coin', blurb: 'A KING NOBODY REMEMBERS.', coins: [6, 10], w: 4 },
  { id: 'thimble', name: 'A SILVER THIMBLE', short: 'THIMBLE', rarity: 'uncommon', kind: 'curio', blurb: 'TINY AND BRIGHT UNDER THE MUD.', w: 2 },
  { id: 'arrowhead', name: 'A FLINT ARROWHEAD', short: 'ARROWHEAD', rarity: 'uncommon', kind: 'curio', blurb: 'OLDER THAN THE FARM, OLDER THAN THE VILLAGE.', w: 2 },
  { id: 'seed-sunflower', name: 'SUNFLOWER SEEDS', short: 'SUNFLOWERS', rarity: 'uncommon', kind: 'seed', blurb: 'A TWIST OF PAPER FULL OF SEED. A SUNFLOWER BED, IN BUILD MODE\'S DECOR.', once: true },
  { id: 'seed-herbs', name: 'HERB SEEDS', short: 'HERBS', rarity: 'uncommon', kind: 'seed', blurb: 'THYME, SAGE AND MINT. A HERB GARDEN, IN BUILD MODE\'S DECOR.', once: true },
  { id: 'tag-brass', name: 'A BRASS COLLAR TAG', short: 'BRASS TAG', rarity: 'uncommon', kind: 'wear', blurb: 'NO NAME ON IT YET. FOR YOUR DOG\'S COLLAR.', once: true },
  { id: 'photo-socks', name: 'A FADED PHOTOGRAPH', short: 'PHOTOGRAPH', rarity: 'uncommon', kind: 'wear', blurb: 'A HEELER IN WHITE SOCKS. YOURS COULD WEAR THEM TOO.', once: true },
  // Rare.
  { id: 'purse', name: 'A PURSE OF OLD COINS', short: 'PURSE', rarity: 'rare', kind: 'coin', blurb: 'TIED WITH STRING. SOMEBODY\'S SAVINGS.', coins: [20, 30], w: 3 },
  { id: 'seed-roses', name: 'ROSE CUTTINGS', short: 'ROSES', rarity: 'rare', kind: 'seed', blurb: 'STILL GREEN AT THE HEART. A ROSE ARCH, IN BUILD MODE\'S DECOR.', once: true },
  { id: 'seed-apple', name: 'A PIPPIN', short: 'PIPPIN', rarity: 'rare', kind: 'seed', blurb: 'FROM THE OLD ORCHARD\'S TREES. AN APPLE SAPLING, IN BUILD MODE\'S DECOR.', once: true },
  { id: 'fossil', name: 'A FOSSIL', short: 'FOSSIL', rarity: 'rare', kind: 'curio', blurb: 'A SHELL TURNED TO STONE, FROM WHEN THE VALLEY WAS SEA. FOR THE RANCH, IN BUILD MODE\'S DECOR.', once: true },
  { id: 'tag-bone', name: 'A BONE-SHAPED TAG', short: 'BONE TAG', rarity: 'rare', kind: 'wear', blurb: 'THE BEST KIND OF TAG. FOR YOUR DOG\'S COLLAR.', once: true },
  { id: 'kerchief', name: 'A SPOTTED KERCHIEF', short: 'KERCHIEF', rarity: 'rare', kind: 'wear', blurb: 'RED WITH WHITE SPOTS, AND HARDLY FADED.', once: true },
  { id: 'photo-blaze', name: 'AN OLD PHOTOGRAPH', short: 'OLD PHOTO', rarity: 'rare', kind: 'wear', blurb: 'A HEELER WITH A WHITE BLAZE DOWN ITS FACE.', once: true },
  { id: 'whistle', name: 'THE SHEPHERD\'S WHISTLE', short: 'WHISTLE', rarity: 'rare', kind: 'relic', blurb: 'A TIN WHISTLE WORN SMOOTH. WITH IT YOUR BARK CARRIES A TENTH FURTHER.', once: true },
  { id: 'bell', name: 'THE BELLWETHER\'S BELL', short: 'BELL', rarity: 'rare', kind: 'relic', blurb: 'FROM THE LEAD EWE OF A FLOCK LONG GONE. THE FLOCK YOU WORK SETTLES QUICKER.', once: true },
  // The old shepherd's map, in four pages (each found where the last said).
  { id: 'page1', name: 'A PAGE OF AN OLD MAP', short: 'PAGE 1', rarity: 'rare', kind: 'page', blurb: 'AN OLD SHEPHERD\'S MAP: A EWE LOST IN THE OLD ORCHARD, AND THE NEXT PAGE BY THE STANDING STONES.', once: true },
  { id: 'page2', name: 'THE MAP\'S SECOND PAGE', short: 'PAGE 2', rarity: 'rare', kind: 'page', blurb: 'IT SHOWS A WAY TO A HIDDEN PLACE, AND THE NEXT PAGE AT THE SHEPHERD\'S HUT.', once: true, w: 0 },
  { id: 'page3', name: 'THE MAP\'S THIRD PAGE', short: 'PAGE 3', rarity: 'rare', kind: 'page', blurb: 'A BILLY GOAT STRAYED TO THE HIDDEN VALLEY. THE LAST PAGE LIES BY THE FALLS.', once: true, w: 0 },
  { id: 'page4', name: 'THE MAP\'S LAST PAGE', short: 'PAGE 4', rarity: 'rare', kind: 'page', blurb: 'X MARKS THE SPOT: BY THE CAIRN ON LOOKOUT KNOLL.', once: true, w: 0 },
  // Legendary.
  { id: 'hoard', name: 'THE SHEPHERD\'S HOARD', short: 'HOARD', rarity: 'legendary', kind: 'coin', blurb: 'A TIN BOX OF COINS AND A GOLDEN TAG, WHERE THE MAP SAID.', coins: [100, 100], once: true, w: 0 },
  { id: 'tag-gold', name: 'A GOLDEN COLLAR TAG', short: 'GOLD TAG', rarity: 'legendary', kind: 'wear', blurb: 'FROM THE HOARD. FOR THE FINEST DOG IN THE VALLEY.', once: true, w: 0 },
];
export const lootById = (id: string) => LOOT.find((l) => l.id === id);

// Things to wear found by digging, for the look screen (the neck piece stays
// Bandana red; tags are buttercup or wool, markings wool).
export const WEARABLES = LOOT.filter((l) => l.kind === 'wear').map((l) => l.id);

// Where the map's pages lie, and what each points to (px; tier of its region).
interface PageDef { at: [number, number]; tier: number; lost?: { species: SpeciesId; coat: number; place: PlaceId; label: string; bonus: number } }
export const PAGES: PageDef[] = [
  { at: [0, 0], tier: 1, lost: { species: 'sheep', coat: 0, place: 'orchard', label: 'THE LOST EWE', bonus: 20 } }, // page 1: a rare find anywhere rich
  { at: [1478, 352], tier: 2 }, // page 2, inside the standing stones: shows a hidden place
  { at: [262, 684], tier: 3, lost: { species: 'goat', coat: 0, place: 'valley', label: 'THE BILLY GOAT', bonus: 30 } }, // page 3, before the hut
  { at: [418, 694], tier: 4 }, // page 4, by the falls
];
export const HOARD_AT: [number, number] = [1344, 238]; // by the cairn on Lookout Knoll

// ---- Dig spots ----

export type SpotKind = 'near' | 'wild' | 'rich' | 'page' | 'hoard' | 'bone';
export interface Spot { x: number; y: number; kind: SpotKind; i: number; place?: PlaceId; tier?: number }

// Which hidden places are richer in each season.
const RICH_BY_SEASON: Record<Season, PlaceId[]> = {
  spring: ['willow', 'orchard', 'valley', 'watermeadow'],
  summer: ['circle', 'knoll', 'hanging', 'cairn'],
  autumn: ['orchard', 'hut', 'wagon', 'falls'],
  winter: ['knoll', 'hut', 'cairn', 'wagon'],
};

// Rarity weights by kind of spot.
const ODDS: Record<'near' | 'wild' | 'rich', [number, number, number]> = {
  near: [75, 22, 3],
  wild: [55, 35, 10],
  rich: [30, 45, 25],
};

// Open ground for spots, worked out once per map: tiles near the ranch
// (the meadow and the roads, not the ranch, the village, the yards), each
// region's own ground, and each hidden place.
interface Pools { near: number[]; wild: Record<string, number[]>; rich: Record<string, number[]> }
const pools = new WeakMap<WorldMap, Pools>();
function poolsFor(map: WorldMap): Pools {
  let p = pools.get(map);
  if (p) return p;
  p = { near: [], wild: {}, rich: {} };
  const ranch = regionById('ranch');
  const open = (tx: number, ty: number) => {
    for (let cy = ty * 2; cy < ty * 2 + 2; cy++)
      for (let cx = tx * 2; cx < tx * 2 + 2; cx++) if (map.terFlags[cy * CW + cx] & (SOLID | ROCK | DEEP | SHALLOW)) return false;
    return map.t(tx, ty) === Ter.Grass;
  };
  for (let ty = 4; ty < MH - 4; ty++)
    for (let tx = 4; tx < MW - 4; tx++) {
      if (!open(tx, ty) || !open(tx - 1, ty) || !open(tx + 1, ty) || !open(tx, ty - 1) || !open(tx, ty + 1)) continue;
      const i = ty * MW + tx;
      const pl = PLACES.find((q) => q.rx && inPlace(q, tx * TS + 4, ty * TS + 4, 0.8));
      if (pl) {
        (p.rich[pl.id] ??= []).push(i);
        continue;
      }
      if (YARDS.some((y) => tx >= y.tx - 2 && tx < y.tx + YARD_W + 2 && ty >= y.ty - 2 && ty < y.ty + YARD_H + 2)) continue;
      if (((tx - VILLAGE.cx) / (VILLAGE.rx + 3)) ** 2 + ((ty - VILLAGE.cy) / (VILLAGE.ry + 3)) ** 2 < 1) continue;
      const reg = map.regionAt(tx * TS + 4, ty * TS + 4);
      if (reg?.id === 'ranch' || reg?.id === 'show') continue; // the ranch is built on; the show ground is the course
      if (reg && reg.id !== 'meadow') (p.wild[reg.id] ??= []).push(i);
      else if (Math.hypot(tx - ranch.cx, ty - ranch.cy) < 44 && !(map.path[i] && !reg)) p.near.push(i);
    }
  pools.set(map, p);
  return p;
}

// The day's spots everyone shares (the same on every screen). They are
// laid over the whole valley whatever the tier, so their numbering never
// changes with it; spots in regions not yet open are left out where used.
export function sharedSpots(game: Game): Spot[] {
  const P = poolsFor(game.map);
  const day = game.day.day, season = game.season.season;
  const wet = game.weather.sky === 'rain' || game.weather.sky === 'storm';
  const r = mulberry32(day * 7919 + 131);
  const out: Spot[] = [];
  const at = (i: number, kind: SpotKind, place?: PlaceId) => {
    const x = (i % MW) * TS + 4, y = Math.floor(i / MW) * TS + 4;
    const reg = place ? regionById(placeById(place).region) : game.map.regionAt(x, y);
    out.push({ x, y, kind, i: out.length, place, tier: reg?.tier ?? 1 });
  };
  const winter = season === 'winter';
  const take = (pool: number[] | undefined, n: number, kind: SpotKind, place?: PlaceId) => {
    if (!pool?.length) return;
    for (let k = 0; k < n; k++) {
      const i = pool[Math.floor(r() * pool.length)];
      if (out.some((s) => Math.hypot(s.x - ((i % MW) * TS + 4), s.y - (Math.floor(i / MW) * TS + 4)) < 40)) continue;
      at(i, kind, place);
    }
  };
  take(P.near, (winter ? 2 : 3) + (wet ? 1 : 0), 'near');
  const regions = Object.keys(P.wild).sort();
  for (let k = 0; k < (winter ? 2 : 3) + (wet ? 1 : 0) && regions.length; k++) take(P.wild[regions[Math.floor(r() * regions.length)]], 1, 'wild');
  const rich = RICH_BY_SEASON[season].filter((id) => P.rich[id]?.length);
  for (let k = 0; k < (winter ? 1 : 2) + (wet ? 1 : 0) && rich.length; k++) {
    const id = rich[Math.floor(r() * rich.length)];
    take(P.rich[id], 1, 'rich', id);
  }
  return out;
}

const roll = (seed: number) => mulberry32(seed);

export interface LootSave {
  got: Record<string, number>; // how many of each found (ever)
  bones: number; // in the stash
  buried: { x: number; y: number; day: number }[];
  dug: { day: number; spots: number[] }; // today's shared spots already dug
  home: string[]; // lost animals brought home (page labels)
  first?: number; // day of the first find
}

export class Loot {
  got = new Map<string, number>();
  bones = 0;
  buried: { x: number; y: number; day: number }[] = [];
  dug = new Set<number>(); // today's shared spots dug (by anyone)
  dugDay = 0;
  home = new Set<string>();
  // Per frame, for the art.
  scent: { x: number; y: number; k: number }[] = [];
  sniffing = 0; // 0..1
  digging: { t: number; x: number; y: number; spot: Spot } | null = null;
  pops: { id: string; x: number; y: number; t: number }[] = [];
  justFound: { id: string; name: string; rarity: Rarity; t: number } | null = null;
  lost = new Map<Animal, number>(); // lost animals from the map, by page
  sel = 0; // the find picked on the Ledger's FINDS page
  unseen = 0; // new kinds found since the page was last open
  private spotsKey = '';
  private spots: Spot[] = [];
  private still = 0;
  private pruneT = 0;

  has(id: string): boolean {
    return (this.got.get(id) ?? 0) > 0;
  }
  get pages(): number {
    return ['page1', 'page2', 'page3', 'page4'].filter((p) => this.has(p)).length;
  }
  get kinds(): number {
    return [...this.got.keys()].filter((id) => lootById(id)).length;
  }

  // ---- Spots ----

  // The day's shared spots (cached until the day, season, sky or tier
  // changes), plus our own: the next map page, the hoard, bones we buried.
  allSpots(game: Game, own = true): Spot[] {
    const key = `${game.day.day}|${game.season.season}|${game.weather.sky}`;
    if (key !== this.spotsKey) {
      this.spotsKey = key;
      this.spots = sharedSpots(game);
    }
    if (this.dugDay !== game.day.day) {
      this.dugDay = game.day.day;
      this.dug.clear();
    }
    const out = this.spots.filter((s) => !this.dug.has(s.i) && (s.tier ?? 1) <= game.tier);
    if (!own) return out;
    const p = this.pages;
    if (p >= 1 && p < 4 && game.tier >= PAGES[p].tier) out.push({ x: PAGES[p].at[0], y: PAGES[p].at[1], kind: 'page', i: -1 - p });
    if (p === 4 && !this.has('hoard') && game.tier >= 2) out.push({ x: HOARD_AT[0], y: HOARD_AT[1], kind: 'hoard', i: -10 });
    this.buried.forEach((b, k) => { if (b.day < game.day.day) out.push({ x: b.x, y: b.y, kind: 'bone', i: -100 - k }); });
    return out;
  }

  // The undug spot under the dog, if it could dig there now.
  spotUnder(game: Game, d: Dog = game.dog, own = true): Spot | null {
    if (d.lying || this.digging) return null;
    let best: Spot | null = null, bd = 8;
    for (const s of this.allSpots(game, own)) {
      const dd = Math.hypot(s.x - d.x, s.y - d.y);
      if (dd < bd) { bd = dd; best = s; }
    }
    if (!best) return null;
    // An animal at the dog's nose (or a fox at its heels) gets nipped instead.
    const nose = game.animals.some((a) => !a.pen && !a.gone && Math.hypot(a.x - (d.x + d.hx * 4), a.y - (d.y + d.hy * 4)) < a.sp.r + 9);
    const fox = game.predators.some((p) => p.active && Math.hypot(p.x - d.x, p.y - d.y) < 16);
    return nose || fox ? null : best;
  }

  canDig(game: Game): boolean {
    return game.mode === 'play' && !game.input.override && !!this.spotUnder(game, game.dog, game.net?.role !== 'guest');
  }

  // ---- Every frame (host, single player, and a guest's own dog) ----

  update(game: Game, dt: number) {
    const d = game.dog;
    const guest = game.net?.role === 'guest';
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.2);
    if (this.justFound && (this.justFound.t -= dt) <= 0) this.justFound = null;
    // Digging: the dog stays put until it is done.
    if (this.digging) {
      const dg = this.digging;
      dg.t -= dt;
      d.vx = d.vy = 0;
      d.x += (dg.x - d.x) * Math.min(1, dt * 12);
      d.y += (dg.y - d.y) * Math.min(1, dt * 12);
      d.dig = Math.max(0, dg.t); // for the dog's dig pose
      // Dust kicked up at the paws now and then (fx: the eye only).
      if (Math.floor(dg.t * 5) !== Math.floor((dg.t + dt) * 5)) game.fx.dust(dg.x - d.hx * 3, dg.y + 1, -d.hx * 20, 0);
      if (dg.t <= 0) {
        this.digging = null;
        this.finish(game, dg.spot, dg.x, dg.y);
      }
    } else d.dig = 0;
    // Scent: the nearest buried things within reach of the dog's nose.
    const slow = !d.lying && d.speed < d.stats.walk * 0.55;
    this.still = slow ? this.still + dt : 0;
    const sniff = this.still > 0.5;
    const wet = game.weather.sky === 'rain' || game.weather.sky === 'storm';
    const reach = (sniff ? 150 : 90) * (wet ? 1.3 : 1);
    this.scent = [];
    if (!d.lying && game.day.phase !== 'night') {
      for (const s of this.allSpots(game, !guest)) {
        const dd = Math.hypot(s.x - d.x, s.y - d.y);
        if (dd < reach && (slow || dd < 50)) this.scent.push({ x: s.x, y: s.y, k: 1 - dd / reach });
      }
      this.scent.sort((a, b) => b.k - a.k);
      this.scent.length = Math.min(3, this.scent.length);
    }
    const want = this.scent.length ? (sniff ? 1 : 0.4) : 0;
    this.sniffing += (want - this.sniffing) * Math.min(1, dt * 4);
    d.sniff = this.sniffing; // for the nose-down pose
    if (this.scent.length && !game.tipsSeen.has('scent') && !game.tip && !game.input.override) {
      game.tipsSeen.add('scent');
      game.tip = { text: game.input.touchMode ? 'A SCENT! WALK SLOWLY OR STAND STILL TO SNIFF. FOLLOW THE WISPS, THEN TAP DIG.' : 'A SCENT! WALK SLOWLY OR STAND STILL TO SNIFF. FOLLOW THE WISPS, THEN E TO DIG.', t: 9 };
    }
    if (guest) return;
    // The relic bell: the flock you are working settles quicker.
    if (this.has('bell')) {
      for (const a of game.animals) {
        if (a.pen || a.gone || a.trial || a.pressure > 0.4 || a.panicT > 0 || a.stress <= 0) continue;
        if (Math.abs(a.x - d.x) > 60 || Math.abs(a.y - d.y) > 60 || Math.hypot(a.x - d.x, a.y - d.y) > 60) continue;
        a.stress = Math.max(0, a.stress - 0.03 * dt);
      }
    }
    // Lost animals from the map, brought home.
    if ((this.pruneT -= dt) <= 0) {
      this.pruneT = 1;
      const live = new Set(game.animals);
      for (const a of this.lost.keys()) if (!live.has(a)) this.lost.delete(a);
    }
    for (const [a, page] of this.lost) {
      if (!a.pen && !a.gone) continue;
      this.lost.delete(a);
      const L = PAGES[page].lost!;
      if (!a.pen || a.home) continue;
      const { mult, label } = calmRating(a.peakStress);
      const bonus = Math.round(L.bonus * mult);
      game.earn(bonus);
      game.stats.deliveredValue += bonus;
      this.home.add(L.label);
      game.fx.float(a.x, a.y - 18, `+${bonus}$`, C.butter, 1.6);
      game.tip = { text: `${L.label} IS HOME, AS THE OLD MAP SAID! +${bonus}$ (${label})`, t: 7 };
    }
  }

  // ---- NIP: dig here, or bury a bone ----

  // The host's (or single player's) dog. True if the nip was used.
  dig(game: Game, give?: (id: string, coins: number) => void): boolean {
    if (this.digging) return true; // already at it
    if (game.input.override) return false; // a bot at the controls (tuning, the title) only nips
    const guest = game.net?.role === 'guest';
    const s = this.spotUnder(game, game.dog, !guest);
    if (s) {
      this.start(game, s, give);
      return true;
    }
    return !guest && this.bury(game);
  }

  private giveTo: ((id: string, coins: number) => void) | undefined;
  private start(game: Game, s: Spot, give?: (id: string, coins: number) => void) {
    this.digging = { t: 0.9, x: s.x, y: s.y, spot: s };
    this.giveTo = give;
    if (s.i >= 0) this.dug.add(s.i); // the hole is everybody's at once
    game.audio?.play('click', { x: s.x, y: s.y });
  }

  // A co-op guest dug a shared spot (on the host): it is gone for everyone;
  // what was in it is theirs (their own screen gave it them). True for a
  // hole already dug too, so a second nip mid-dig stays a dig.
  digBy(game: Game, x: number, y: number): boolean {
    this.allSpots(game, false);
    const s = this.spots.find((q) => (q.tier ?? 1) <= game.tier && Math.hypot(q.x - x, q.y - y) < 10);
    if (!s) return false;
    this.dug.add(s.i);
    return true;
  }

  // Bury a bone: on the ranch, standing still, nothing about to nip.
  private bury(game: Game): boolean {
    const d = game.dog;
    if (this.bones <= 0 || !game.inRanch() || d.speed > 4 || this.buried.length >= 6) return false;
    if (game.animals.some((a) => !a.pen && !a.gone && Math.hypot(a.x - d.x, a.y - d.y) < 30)) return false;
    this.bones--;
    this.buried.push({ x: Math.round(d.x), y: Math.round(d.y), day: game.day.day });
    this.digging = { t: 0.6, x: d.x, y: d.y, spot: { x: d.x, y: d.y, kind: 'bone', i: -99 } };
    this.buryingNow = true;
    if (!game.tipsSeen.has('bury')) {
      game.tipsSeen.add('bury');
      game.tip = { text: 'BURIED A BONE. IT WILL BE READY TO DIG UP FROM TOMORROW.', t: 6 };
    }
    return true;
  }
  private buryingNow = false;

  // The dig is done: what comes up.
  private finish(game: Game, s: Spot, x: number, y: number) {
    game.fx.puff(x, y + 1);
    if (this.buryingNow) {
      this.buryingNow = false;
      game.fx.float(x, y - 12, 'BURIED', C.wool, 1);
      return;
    }
    let id: string;
    if (s.kind === 'bone') {
      const k = -100 - s.i;
      this.buried.splice(k, 1);
      id = 'agedbone';
    } else if (s.kind === 'page') id = `page${this.pages + 1}`;
    else if (s.kind === 'hoard') id = 'hoard';
    else id = this.pick(game, s);
    this.grant(game, id, x, y);
    if (id === 'hoard') this.grant(game, 'tag-gold', x, y - 4);
  }

  // What a shared spot holds, for this digger: a seeded roll by rarity,
  // skipping what is found once and already ours.
  pick(game: Game, s: Spot): string {
    const r = roll(game.day.day * 104729 + s.i * 7907 + (s.place ? s.place.length * 31 : 0));
    const odds = ODDS[s.kind as 'near' | 'wild' | 'rich'] ?? ODDS.near;
    const sum = odds[0] + odds[1] + odds[2];
    let u = r() * sum;
    const rarity: Rarity = u < odds[0] ? 'common' : (u -= odds[0]) < odds[1] ? 'uncommon' : 'rare';
    const pool = LOOT.filter((l) => l.rarity === rarity && (l.w ?? 1) > 0 && !(l.once && this.has(l.id)));
    // The first page of the old map only turns up somewhere rich.
    if (s.kind === 'rich' && !this.has('page1') && rarity === 'rare' && r() < 0.5) return 'page1';
    const list = pool.filter((l) => l.id !== 'page1' || s.kind === 'rich');
    if (!list.length) return rarity === 'common' ? 'coin' : rarity === 'uncommon' ? 'oldcoin' : 'purse';
    let w = list.reduce((n, l) => n + (l.w ?? 1), 0) * r();
    for (const l of list) if ((w -= l.w ?? 1) < 0) return l.id;
    return list[0].id;
  }

  // Into the collection (or, for a guest, into their own save), with the
  // moment: it hops out of the hole with a sparkle, a banner names it.
  grant(game: Game, id: string, x: number, y: number) {
    const item = lootById(id)!;
    const guest = game.net?.role === 'guest';
    const first = !this.has(id);
    this.got.set(id, (this.got.get(id) ?? 0) + 1);
    if (first) this.unseen++;
    this.pops.push({ id, x, y, t: 0 });
    this.justFound = { id, name: item.name, rarity: item.rarity, t: 3 };
    const coins = item.coins ? Math.round(item.coins[0] + (item.coins[1] - item.coins[0]) * hash2(game.day.day, x | 0, y | 0)) : 0;
    this.giveTo?.(id, coins); // a guest's own save
    if (coins && !guest) {
      game.earn(coins);
      game.fx.float(x, y - 20, `+${coins}$`, C.butter, 1.2);
    }
    if (id === 'bone' && !guest) this.bones++;
    if (id === 'agedbone') {
      game.dog.stamina = game.dog.stats.stamina;
      game.fx.add({ kind: 'heart', x, y: y - 14, vx: 0, vy: -10, max: 1.2, color: C.butter });
    }
    const word = item.rarity === 'common' ? '' : `  ${item.rarity.toUpperCase()}`;
    const pay = coins ? `  +${coins}$${guest ? ' AT HOME' : ''}` : '';
    game.showBanner('FOUND IT!', `${item.name}${word}${pay}`, item.rarity === 'legendary' ? 4 : 2.4);
    if (item.rarity === 'legendary') {
      game.audio?.stinger('tierup');
      game.feel.confetti(game.screen.W);
    } else if (item.rarity === 'rare') game.audio?.stinger('steady');
    else game.audio?.play('coin', { x, y, vol: 0.7 });
    if (first && item.kind !== 'coin' && item.kind !== 'bone' && !game.tip) game.tip = { text: item.blurb, t: 7 };
    game.ledgerNew = true;
    if (!guest) this.onFound(game, id);
  }

  // What a find sets going in the world.
  private onFound(game: Game, id: string) {
    if (id === 'whistle') game.applyUpgrades();
    if (id === 'page1' || id === 'page3') this.spawnLost(game, id === 'page1' ? 0 : 2);
    if (id === 'page2') {
      // A way to a hidden place: the first one not yet found, glimpsed on the map.
      const p = PLACES.find((q) => q.rx && !game.discovery.found.has(q.id) && regionById(q.region).tier <= game.tier) ?? PLACES.find((q) => q.rx && !game.discovery.found.has(q.id));
      if (p) {
        game.discovery.reveal(p.cx / 2, p.cy / 2, Math.max(p.rx, p.ry) / 2 + 3, 1);
        game.tip = { text: `THE PAGE SHOWS A WAY TO ${p.name}: IT IS ON YOUR LEDGER MAP NOW.`, t: 8 };
      }
    }
  }

  // A lost animal from the map, waiting where the page said.
  private spawnLost(game: Game, page: number) {
    const L = PAGES[page].lost!;
    if (this.home.has(L.label) || [...this.lost.values()].includes(page)) return;
    const p = placeById(L.place);
    const a = new Animal(L.species, p.cx * TS + 4, p.cy * TS + 10, L.coat as 0);
    a.wanderer = false;
    game.animals.push(a);
    this.lost.set(a, page);
  }

  // The relic whistle: the bark carries a tenth further.
  tuneDog(stats: DogStats) {
    if (this.has('whistle')) stats.barkRange = Math.round(stats.barkRange * 1.1);
  }

  // ---- Mornings: holes fill in; lost animals wait where the map said ----

  morning(game: Game) {
    this.digging = null;
    this.buryingNow = false;
    poolsFor(game.map); // laid out once per map, here rather than mid-drive (30ms on a slow phone)
    if (game.net?.role === 'guest') return;
    for (const page of [0, 2]) if (this.has(`page${page + 1}`)) this.spawnLost(game, page);
  }

  // ---- Save, and co-op ----

  save(): LootSave {
    return { got: Object.fromEntries(this.got), bones: this.bones, buried: this.buried.map((b) => ({ ...b })), dug: { day: this.dugDay, spots: [...this.dug] }, home: [...this.home] };
  }

  load(game: Game, d?: LootSave) {
    this.got.clear();
    this.home.clear();
    this.lost.clear();
    this.dug.clear();
    this.bones = 0;
    this.buried = [];
    this.digging = null;
    this.pops = [];
    this.spotsKey = '';
    this.dugDay = game.day.day;
    if (d) {
      for (const [k, v] of Object.entries(d.got ?? {})) if (lootById(k) && v > 0) this.got.set(k, v);
      this.bones = Math.max(0, d.bones | 0);
      this.buried = (d.buried ?? []).slice(0, 6).map((b) => ({ x: +b.x, y: +b.y, day: +b.day }));
      for (const l of d.home ?? []) this.home.add(l);
      if (d.dug?.day === game.day.day) for (const i of d.dug.spots ?? []) this.dug.add(i);
    }
    game.applyUpgrades();
  }

  // Finds from a friend's ranch, folded into ours (src/net/travels.ts).
  merge(game: Game, ids: string[]) {
    for (const id of ids) {
      if (!lootById(id)) continue;
      this.got.set(id, (this.got.get(id) ?? 0) + 1);
      if (id === 'bone') this.bones++;
    }
    if (ids.includes('whistle')) game.applyUpgrades();
  }

  // What guests need: today's holes.
  shared(game: Game) {
    return { day: game.day.day, dug: [...this.dug] };
  }
  applyShared(game: Game, v: unknown) {
    const d = v as { day: number; dug: number[] };
    if (!d || d.day !== game.day.day) return;
    this.dugDay = d.day;
    for (const i of d.dug ?? []) this.dug.add(i);
  }

  // Holes dug today (for the art): shared ones, wherever they were.
  holes(game: Game): { x: number; y: number }[] {
    this.allSpots(game, false);
    return this.spots.filter((s) => this.dug.has(s.i)).map((s) => ({ x: s.x, y: s.y }));
  }
}

// A friend's dog drawn from co-op flags (host and guest): nose down while
// its sniff bit is on; a dig plays out from 0.9s when its bit comes on.
const digOn = new WeakSet<Dog>();
export function puppetAct(d: Dog, sniff: boolean, dig: boolean, dt: number) {
  d.sniff = sniff ? 1 : 0;
  d.dig = dig && !digOn.has(d) ? 0.9 : Math.max(0, d.dig - dt);
  if (dig) digOn.add(d);
  else digOn.delete(d);
}

// Collision cells under a spot, for tests: open ground.
export const spotOpen = (map: WorldMap, x: number, y: number) => !(map.terFlags[Math.floor(y / CS) * CW + Math.floor(x / CS)] & (SOLID | ROCK | DEEP));
