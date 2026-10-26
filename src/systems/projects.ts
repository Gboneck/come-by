import { C } from '../palette';
import type { Game } from '../game';
import { Animal } from '../entities/animal';
import type { SpeciesId } from '../world/map';
import { WORKS, inPlace, placeById, type PlaceId, type ProjectView } from '../world/places';
import type { Season } from './season';

// Valley projects: work out in the world, done by herding, that changes a
// place for good and opens something new. Two kinds of work:
//  graze: keep a flock calmly on a patch until it is grazed (browsed,
//         paddled, trampled) clear, at the same per-species rates as the
//         ranch's overgrown paddocks (src/systems/valley.ts, GRAZE)
//  haul:  walk animals past a pile so each takes a load (a slate, a stone),
//         then on to the site; a load is dropped by an animal that panics,
//         so calm gets it there
// They open in steps by tier and season; the Ledger lists them with the
// village and the paddocks as one valley. State that guests need goes
// through src/net/shared.ts. (The ford's old bridge is valley.ts's.)

export type ProjectId = 'reeds' | 'orchard' | 'scrub' | 'hut' | 'mill' | 'circle';
export type Load = 'slate' | 'stone';

interface Common {
  id: ProjectId;
  name: string; // what to do
  label: string; // its line in the Ledger's valley list
  where: string;
  place: PlaceId | null; // must be found first (null: out in the open)
  tier: number;
  seasons: Season[] | null; // when the work can be done (null: any time)
  species: SpeciesId;
  needs: string; // for the Ledger
  brings: string;
  result: string; // the Ledger's status once done
  verb: string; // the Ledger's status while under way: "40% GRAZED"
  done: string; // the banner when it is done
  tip: string; // when the site is first seen
  doneTip: string; // what it brings, said when it is done
  mark: [number, number]; // px: where it is on the map
}
export interface GrazeProject extends Common {
  kind: 'graze';
  need: number; // work, in the paddocks' units (a rate of 1/60 is a sixtieth a second)
  zone: { x: number; y: number; rx: number; ry: number }; // px ellipse
  only?: boolean; // only `species` does this work (else any kind, at its GRAZE rate)
  wet?: boolean; // the work is done standing in the water
}
export interface HaulProject extends Common {
  kind: 'haul';
  piles: { x: number; y: number; n: number }[]; // px, loads waiting there
  site: { x: number; y: number; r: number }; // px, where loads are brought
  load: Load;
}
export type Project = GrazeProject | HaulProject;

const FIELD_STONES = WORKS.filter((p) => p.kind === 'fieldstone').map((p) => ({ x: p.x, y: p.y, n: 1 }));

// How fast each kind grazes scrub down: the same table as the ranch's
// overgrown paddocks (src/systems/valley.ts, GRAZE; keep the two in step).
// Ducks eat bugs, not scrub, but they will paddle a reed bed down.
export const GRAZE: Record<SpeciesId, number> = { duck: 0, sheep: 1 / 60, goat: 2 / 60, cow: 1.5 / 60, pony: 1 / 60 };
const PADDLE = 1 / 60; // ducks on Willow Pool's reeds

export const PROJECTS: Project[] = [
  {
    id: 'reeds', kind: 'graze', name: 'CLEAR THE REED BED', where: 'WILLOW POOL', place: 'willow', tier: 2, seasons: ['spring', 'summer'], species: 'duck',
    label: 'WILLOW POOL REEDS', result: 'CLEAR, HAY EACH AUTUMN', verb: 'CLEARED',
    need: 6, only: true, zone: { x: 1468, y: 834, rx: 40, ry: 36 }, mark: [1468, 834],
    needs: 'KEEP DUCKS ON THE POOL TO EAT THE REEDS DOWN',
    brings: 'A HAY MEADOW: 8 MORE BALES IN THE LOFT EACH AUTUMN',
    done: 'THE REED BED IS CLEAR',
    tip: 'REEDS ARE CHOKING WILLOW POOL. KEEP A FLOCK OF DUCKS ON IT A WHILE AND THEY WILL EAT THEM DOWN.',
    doneTip: 'THE POOL RUNS CLEAR AND ITS BOGGY EDGE IS HAY MEADOW NOW: 8 MORE BALES IN THE LOFT EVERY AUTUMN.',
  },
  {
    id: 'orchard', kind: 'graze', name: 'GRAZE THE ORCHARD CLEAR', where: 'THE OLD ORCHARD', place: 'orchard', tier: 2, seasons: ['spring', 'summer', 'autumn'], species: 'sheep',
    label: 'THE OLD ORCHARD', result: 'PASTURE, A FLOCK EACH MORNING', verb: 'GRAZED',
    need: 12, zone: { x: 1414, y: 1060, rx: 50, ry: 40 }, mark: [1414, 1060],
    needs: 'KEEP A FLOCK GRAZING AMONG THE OLD TREES',
    brings: 'GOOD PASTURE: A FLOCK GRAZES THERE EVERY MORNING BUT IN WINTER, BY HOME',
    done: 'THE OLD ORCHARD IS PASTURE AGAIN',
    tip: 'BRAMBLES AND RANK GRASS HAVE TAKEN THE ORCHARD. A FLOCK OF SHEEP GRAZING HERE A WHILE WOULD CLEAR IT.',
    doneTip: 'WILDFLOWERS ARE BACK AMONG THE TREES. A FLOCK OF SHEEP WILL GRAZE HERE EVERY MORNING BUT IN WINTER, CLOSE TO HOME.',
  },
  {
    id: 'scrub', kind: 'graze', name: 'BROWSE BACK THE SCRUB', where: 'THE HIDDEN VALLEY', place: 'valley', tier: 3, seasons: ['spring', 'summer', 'autumn'], species: 'goat',
    label: 'HIDDEN VALLEY SCRUB', result: 'OPEN, WILD GOATS EVERY DAY', verb: 'BROWSED',
    need: 12, zone: { x: 76, y: 672, rx: 40, ry: 42 }, mark: [96, 672],
    needs: 'HOLD A FLOCK IN THE SCRUB (GOATS ARE QUICKEST)',
    brings: 'NEW GRAZING: THE WILD GOATS COME BACK EVERY DAY, SEVEN OF THEM',
    done: 'THE HIDDEN VALLEY IS OPEN GRAZING',
    tip: 'SCRUB HAS SWALLOWED THE WEST END OF THE VALLEY. GOATS LOVE TO BROWSE IT: HOLD SOME HERE AND THEY WILL CLEAR IT.',
    doneTip: 'THE VALLEY IS OPEN GRAZING NOW. ITS WILD GOATS WILL BE BACK EVERY MORNING, SEVEN OF THEM.',
  },
  {
    id: 'hut', kind: 'haul', name: 'MEND THE SHEPHERD\'S HUT', where: 'THE SHEPHERD\'S HUT', place: 'hut', tier: 3, seasons: null, species: 'goat',
    label: 'THE SHEPHERD\'S HUT', result: 'MENDED, A WAYSTATION', verb: 'SLATES',
    piles: [{ x: 452, y: 532, n: 5 }], site: { x: 272, y: 680, r: 20 }, load: 'slate', mark: [272, 660],
    needs: 'GOATS CARRY SLATE FROM THE QUARRY ON ROCKY RISE TO THE HUT',
    brings: 'A WAYSTATION: REST THERE AS AT HOME, AND A FOLD WITH A GATE (E) TO HOLD A FLOCK',
    done: 'THE SHEPHERD\'S HUT IS MENDED',
    tip: 'THE HUT NEEDS SLATE FOR ITS ROOF. THERE IS A QUARRY UNDER THE OUTCROP ON ROCKY RISE: WALK GOATS PAST IT, THEN HERE.',
    doneTip: 'A WAYSTATION: LIE DOWN BY THE HUT TO REST AS AT HOME. THE FOLD HAS A GATE: E SHUTS IT ON A FLOCK WHILE YOU FETCH THE REST.',
  },
  {
    id: 'mill', kind: 'graze', name: 'PUDDLE THE MILL POND', where: 'THE WATERFALL POOL', place: 'falls', tier: 4, seasons: ['spring', 'summer', 'autumn'], species: 'cow',
    label: 'THE MILL POND', result: 'THE WHEEL TURNS, GOODS +25%', verb: 'PUDDLED',
    need: 6, only: true, wet: true, zone: { x: 432, y: 676, rx: 44, ry: 38 }, mark: [436, 668],
    needs: 'HOLD CATTLE IN THE POOL: THEIR HOOVES PUDDLE THE CLAY WATERTIGHT',
    brings: 'A MILL: THE WATERWHEEL FULLS THE WOOL AND TURNS THE CHURN, SO GOODS SELL FOR A QUARTER MORE',
    done: 'THE WATERWHEEL TURNS AT THE FALLS',
    tip: 'THE OLD MILL POOL LEAKS. CATTLE STANDING IN IT PUDDLE THE CLAY WATERTIGHT: NIP THEM IN (E) AND HOLD THEM THERE.',
    doneTip: 'THE POOL HOLDS AND THE WHEEL TURNS: IT FULLS THE WOOL AND WORKS THE CHURN, SO THE PENS\' GOODS SELL FOR A QUARTER MORE.',
  },
  {
    id: 'circle', kind: 'haul', name: 'RAISE THE STONE CIRCLE', where: 'THE STONE CIRCLE', place: 'circle', tier: 5, seasons: null, species: 'pony',
    label: 'THE STONE CIRCLE', result: 'RAISED, MIDSUMMER IN SUMMER', verb: 'STONES',
    piles: FIELD_STONES, site: { x: 1468, y: 340, r: 22 }, load: 'stone', mark: [1468, 340],
    needs: 'PONIES DRAG THE FOUR FALLEN STONES BACK FROM THE HILLS',
    brings: 'MIDSUMMER: ON SUMMER\'S SECOND DAY, FLOCKS WALKED THROUGH THE RING PAY DOUBLE',
    done: 'THE STONE CIRCLE STANDS AGAIN',
    tip: 'FOUR STONES ARE MISSING FROM THE RING: THEY LIE FALLEN ABOUT THE ROLLING HILLS. PONIES COULD DRAG THEM BACK.',
    doneTip: 'EVERY SUMMER, ON ITS SECOND DAY, THE VALLEY GATHERS AT THE RING. FLOCKS WALKED THROUGH IT THAT DAY PAY DOUBLE.',
  },
];
export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export const LOAD_OF: Partial<Record<SpeciesId, Load>> = { goat: 'slate', pony: 'stone' };
export const HAY_MEADOW = 8; // extra bales each autumn from Willow Pool's meadow
export const MILL_SHARE = 0.25; // the mill at the falls: goods sell for a quarter more
export const FOLD_GATE = { x: 313, y: 676 }; // px, the middle of the fold's gateway
const FOLD_IN = { x: 313, y: 664 }; // inside the fold, for drawing stock in
const WAYSTATION = { x: 266, y: 686, r: 34 }; // where lying down rests the dog
const RING = { x: 1468, y: 340, r: 28 };

// Animals with a load, and animals blessed at midsummer: read by the art
// and sent to guests (src/net/snapshot.ts, bits 2 and 3 of animalExtra).
export const loaded = new WeakSet<Animal>();
export const blessed = new WeakSet<Animal>();

// Animal.load (valley.ts's log behind a cow) makes a loaded animal lean into
// it and walk a little slower; a slate or a stone sets it too.
export function setLoad(a: Animal, l: Load | null) {
  (a as unknown as { load?: string | null }).load = l;
  if (l) loaded.add(a);
  else loaded.delete(a);
}

export interface ProjectsSave {
  g: Partial<Record<ProjectId, number>>; // grazed
  d: Partial<Record<ProjectId, number[]>>; // loads delivered from each pile
  done: ProjectId[];
  a: ProjectId[]; // announced
  f: boolean; // fold gate shut
}

const noE = (game: Game, s: string) => (game.input.touchMode ? s.replace(' (E)', '') : s);

export class Projects implements ProjectView {
  grazed: Partial<Record<ProjectId, number>> = {};
  deliveredFrom: Partial<Record<ProjectId, number[]>> = {};
  done = new Set<ProjectId>();
  announced = new Set<ProjectId>();
  foldShut = false;
  carrying = new Map<Animal, { id: ProjectId; pile: number }>();
  private blessedOut = new Set<Animal>(); // blessed, not yet home
  justDone: { name: string; brings: string; t: number } | null = null;
  celebrated: Partial<Record<ProjectId, number>> = {}; // day the ceremony was held
  private pruneT = 0;
  private sparkT = 0;
  private placeT = 0;
  private synced = false; // a guest's first copy from the host is not news

  isDone(id: string): boolean {
    return this.done.has(id as ProjectId);
  }

  delivered(id: string): number {
    return (this.deliveredFrom[id as ProjectId] ?? []).reduce((s, n) => s + n, 0);
  }

  // How far along, 0..1.
  frac(id: ProjectId): number {
    if (this.done.has(id)) return 1;
    const p = projectById(id);
    if (p.kind === 'graze') return Math.min(1, (this.grazed[id] ?? 0) / p.need);
    return this.delivered(id) / p.piles.reduce((s, q) => s + q.n, 0);
  }

  // Loads still lying at a pile (not carried off, not delivered).
  atPile(id: ProjectId, pile: number): number {
    const p = projectById(id);
    if (p.kind !== 'haul') return 0;
    let away = this.deliveredFrom[id]?.[pile] ?? 0;
    for (const c of this.carrying.values()) if (c.id === id && c.pile === pile) away++;
    return Math.max(0, p.piles[pile].n - away);
  }

  // Can the work be done now? (`why` says what is in the way.)
  open(game: Game, p: Project): { ok: boolean; why: string } {
    if (this.done.has(p.id)) return { ok: false, why: 'DONE' };
    if (game.tier < p.tier) return { ok: false, why: `AT TIER ${p.tier}` };
    if (p.place && !game.discovery.found.has(p.place)) return { ok: false, why: `FIND ${placeById(p.place).name}` };
    if (p.seasons && !p.seasons.includes(game.season.season)) return { ok: false, why: `IN ${p.seasons.map((s) => s.toUpperCase()).join(' OR ')}` };
    return { ok: true, why: '' };
  }

  // The one in hand: open, and furthest along.
  inHand(game: Game): Project | null {
    let best: Project | null = null;
    for (const p of PROJECTS) if (this.open(game, p).ok && (!best || this.frac(p.id) > this.frac(best.id))) best = p;
    return best;
  }

  // ---- Every frame of play (the host's world, or single player) ----

  update(game: Game, dt: number) {
    if (this.justDone && (this.justDone.t -= dt) <= 0) this.justDone = null;
    if ((this.pruneT -= dt) <= 0) {
      this.pruneT = 1;
      this.prune(game);
    }
    this.sparkT -= dt;
    const spark = this.sparkT <= 0;
    if (spark) this.sparkT = 0.3;
    for (const p of PROJECTS) {
      if (!this.open(game, p).ok) continue;
      if (p.kind === 'graze') this.graze(game, p, dt, spark);
      else this.pickUp(game, p);
    }
    this.carry(game);
    this.midsummer(game);
    this.siteTips(game, dt);
  }

  // Grazing as on the paddocks: calm, and slow enough to be eating.
  private graze(game: Game, p: GrazeProject, dt: number, spark: boolean) {
    const z = p.zone;
    let work = 0;
    for (const a of game.animals) {
      if (a.pen || a.gone || a.trial || a.carried || a.stress > 0.45 || a.panicT > 0) continue;
      if (p.only && a.sp.id !== p.species) continue;
      const rate = (p.id === 'reeds' ? PADDLE : GRAZE[a.sp.id]) * (a.young ? 0.5 : 1);
      if (!rate || Math.hypot(a.vx, a.vy) > a.sp.walk * 0.7 || (p.wet && !a.inWater)) continue;
      const dx = (a.x - z.x) / z.rx, dy = (a.y - z.y) / z.ry;
      if (dx * dx + dy * dy >= 1) continue;
      work += rate;
      if (spark && Math.random() < 0.12 && game.isOnScreen(a.x, a.y))
        game.fx.add({ kind: 'spark', x: a.x + (Math.random() - 0.5) * 6, y: a.y - 2, vx: (Math.random() - 0.5) * 16, vy: -12, max: 0.5, color: p.wet ? C.wool : p.id === 'reeds' ? C.sage : C.moss });
    }
    if (!work) return;
    this.grazed[p.id] = (this.grazed[p.id] ?? 0) + work * dt;
    if ((this.grazed[p.id] ?? 0) >= p.need) this.complete(game, p);
  }

  private pickUp(game: Game, p: HaulProject) {
    p.piles.forEach((pile, i) => {
      if (this.atPile(p.id, i) <= 0) return;
      for (const a of game.animals) {
        if (a.sp.id !== p.species || a.pen || a.gone || a.trial || a.carried || a.young || this.carrying.has(a) || a.stress >= 0.6) continue;
        if (Math.hypot(a.x - pile.x, a.y - pile.y) > 20) continue;
        this.carrying.set(a, { id: p.id, pile: i });
        setLoad(a, p.load);
        if (game.isOnScreen(a.x, a.y)) game.fx.float(a.x, a.y - 12, p.load.toUpperCase(), C.wool, 0.9);
        game.audio?.play('click', { x: a.x, y: a.y });
        if (this.atPile(p.id, i) <= 0) break;
      }
    });
  }

  private carry(game: Game) {
    for (const [a, c] of this.carrying) {
      const p = projectById(c.id) as HaulProject;
      if (a.gone || a.pen || a.trial || a.carried) {
        this.drop(a);
        continue;
      }
      if (a.panicT > 0 || a.stress > 0.8) {
        this.drop(a);
        game.fx.float(a.x, a.y - 12, 'DROPPED', C.wool, 1);
        if (!game.tipsSeen.has('proj-drop')) {
          game.tipsSeen.add('proj-drop');
          game.tip = { text: 'A PANICKED ANIMAL DROPS ITS LOAD, AND IT GOES BACK TO THE PILE. CALM GETS IT THERE.', t: 7 };
        }
        continue;
      }
      if (Math.hypot(a.x - p.site.x, a.y - p.site.y) > p.site.r) continue;
      this.drop(a);
      const d = (this.deliveredFrom[c.id] ??= p.piles.map(() => 0));
      d[c.pile]++;
      const got = this.delivered(c.id), all = p.piles.reduce((s, q) => s + q.n, 0);
      game.fx.float(p.site.x, p.site.y - 14, `${got}/${all}`, C.butter, 1.2);
      game.audio?.play('coin', { x: p.site.x, y: p.site.y, vol: 0.6 });
      if (c.id === 'circle') game.map.setProjects(this); // a ring stone stands up
      if (got >= all) this.complete(game, p);
    }
  }

  private drop(a: Animal) {
    this.carrying.delete(a);
    setLoad(a, null);
  }

  private prune(game: Game) {
    if (!this.carrying.size && !this.blessedOut.size) return;
    const live = new Set(game.animals);
    for (const a of this.carrying.keys()) if (!live.has(a)) this.drop(a);
    for (const a of this.blessedOut) if (!live.has(a)) this.blessedOut.delete(a);
  }

  // First sight of a site (or of a fallen stone in the hills): what it wants.
  private siteTips(game: Game, dt: number) {
    const d = game.dog;
    if (game.input.override) return;
    for (const p of PROJECTS) {
      if (this.done.has(p.id) || game.tier < p.tier) continue;
      const near = p.place ? inPlace(placeById(p.place), d.x, d.y, 0.9) : Math.hypot(d.x - p.mark[0], d.y - p.mark[1]) < 70;
      if (!near) continue;
      if (!game.tipsSeen.has(`proj-${p.id}`) && !game.tip) {
        game.tipsSeen.add(`proj-${p.id}`);
        game.tip = { text: noE(game, p.tip), t: 10 };
        game.ledgerNew = true;
      }
      // How far along, in the place name at the top while you are there.
      if ((this.placeT -= dt) <= 0 && this.open(game, p).ok) {
        this.placeT = 0.5;
        game.place = { text: `${p.where} ${Math.floor(this.frac(p.id) * 100)}%`, t: 1 };
      }
    }
    if (!game.tipsSeen.has('fieldstone') && !game.tip && FIELD_STONES.some((s, i) => this.atPile('circle', i) && Math.hypot(d.x - s.x, d.y - s.y) < 40)) {
      game.tipsSeen.add('fieldstone');
      game.tip = { text: 'A FALLEN STANDING STONE, HALF SUNK IN THE TURF. IT LOOKS AS IF IT BELONGS SOMEWHERE.', t: 8 };
    }
  }

  // ---- Done: a little ceremony ----

  complete(game: Game, p: Project) {
    this.done.add(p.id);
    for (const [a, c] of this.carrying) if (c.id === p.id) this.drop(a);
    this.hayMeadow(game, false);
    game.map.setProjects(this);
    if (p.id === 'hut' && !game.discovery.keepsakes.has('crook')) game.discovery.keepsakes.add('crook'); // turned up while mending
    const n = this.done.size;
    game.showBanner(p.done, `VALLEY PROJECT ${n}/${PROJECTS.length}`, 4);
    game.tip = { text: noE(game, p.doneTip), t: 11 };
    this.justDone = { name: p.done, brings: p.brings, t: 6 };
    this.celebrated[p.id] = game.day.day;
    game.ledgerNew = true;
    game.audio?.stinger('tierup');
    game.feel.confetti(game.screen.W);
    game.feel.shake(1, 0.3);
    const [x, y] = p.mark;
    game.fx.ring(x, y, 40, C.butter, 0.8, 4);
    for (let i = 0; i < 16; i++) game.fx.add({ kind: 'spark', x, y: y - 6, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, max: 0.7, color: i % 3 ? C.butter : C.wool });
  }

  // ---- The fold's gate (the mended hut): E at it shuts or opens it ----

  gateAction(game: Game): boolean {
    if (!this.done.has('hut')) return false;
    const d = game.dog;
    if (Math.hypot(d.x - FOLD_GATE.x, d.y - FOLD_GATE.y) > 13) return false;
    this.foldShut = !this.foldShut;
    game.map.setProjects(this);
    game.audio?.play('gate', { x: FOLD_GATE.x, y: FOLD_GATE.y });
    game.fx.float(FOLD_GATE.x, FOLD_GATE.y - 12, this.foldShut ? 'GATE SHUT' : 'GATE OPEN', C.wool, 1);
    return true;
  }

  // The open fold draws driven stock in, as a pen gate does.
  gates(): { x: number; y: number; open: boolean; accepts(a: Animal): boolean }[] {
    if (!this.done.has('hut') || this.foldShut) return [];
    return [{ x: FOLD_IN.x, y: FOLD_IN.y, open: true, accepts: (a) => !a.pen && !a.trial && !a.forSale }];
  }

  // Lying down by the mended hut rests the dog as at home.
  restsHere(x: number, y: number): boolean {
    return this.done.has('hut') && Math.hypot(x - WAYSTATION.x, y - WAYSTATION.y) < WAYSTATION.r;
  }

  // ---- Midsummer at the raised stone circle ----

  isMidsummer(game: Game): boolean {
    return this.done.has('circle') && game.season.season === 'summer' && game.season.dayOf === 2;
  }

  private midsummer(game: Game) {
    if (!this.isMidsummer(game)) return;
    for (const a of game.animals) {
      if (a.pen || a.gone || a.trial || a.carried || blessed.has(a)) continue;
      if (Math.hypot(a.x - RING.x, a.y - RING.y) > RING.r) continue;
      blessed.add(a);
      this.blessedOut.add(a);
      if (game.isOnScreen(a.x, a.y)) game.fx.add({ kind: 'spark', x: a.x, y: a.y - 8, vx: 0, vy: -14, max: 0.7, color: C.butter });
    }
    for (const a of this.blessedOut) {
      if (!a.pen && !a.gone) continue;
      this.blessedOut.delete(a);
      if (!a.pen || a.home || a.deliveryValue <= 0) continue;
      const bonus = a.deliveryValue;
      game.earn(bonus);
      game.stats.deliveredValue += bonus;
      game.fx.float(a.x, a.y - 18, `MIDSUMMER +${bonus}$`, C.butter, 1.4);
    }
  }

  // ---- Evenings: the mill at the falls ----

  // The day's goods have just sold for `value`: the mill adds its share.
  evening(game: Game, value: number) {
    if (!this.done.has('mill') || value <= 0) return;
    const more = Math.round(value * MILL_SHARE);
    game.earn(more);
    game.stats.goodsValue += more;
  }

  // ---- Mornings ----

  morning(game: Game, fresh: boolean) {
    for (const a of this.carrying.keys()) this.drop(a); // loads go back to their piles overnight
    this.blessedOut.clear();
    this.hayMeadow(game, fresh);
    if (!fresh) return;
    const S = game.season;
    // A flock on the orchard pasture every morning (but in winter).
    if (this.done.has('orchard') && S.season !== 'winter' && game.tier >= 2) {
      const orch = placeById('orchard');
      const there = game.animals.filter((a) => a.sp.id === 'sheep' && !a.pen && !a.gone && inPlace(orch, a.x, a.y, 1.2)).length;
      if (there < 3) {
        const n = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 16;
          game.animals.push(new Animal('sheep', 1414 + Math.cos(ang) * r, 1064 + Math.sin(ang) * r));
        }
      }
    }
    if (this.isMidsummer(game) && !game.tip) game.tip = { text: 'MIDSUMMER! THE VALLEY GATHERS AT THE STONE CIRCLE. FLOCKS WALKED THROUGH THE RING TODAY PAY DOUBLE WHEN PENNED.', t: 10 };
    // A project that has just come within reach.
    for (const p of PROJECTS) {
      if (this.announced.has(p.id) || this.done.has(p.id) || game.tier < p.tier) continue;
      if (p.seasons && !p.seasons.includes(S.season)) continue;
      this.announced.add(p.id);
      game.ledgerNew = true;
      if (!game.tip) game.tip = { text: `A VALLEY PROJECT: ${p.name} (${p.where}). SEE THE LEDGER.`, t: 8 };
      break;
    }
  }

  // Willow Pool's hay meadow: its bales go into the loft each autumn.
  // seasonal.ts refills the loft to LOFT_MAX + loftBonus (Gameplay's, once
  // both branches are in); without that field, add them here on autumn's
  // first morning.
  private hayMeadow(game: Game, fresh: boolean) {
    const S = game.seasonal as { loft: number; loftBonus?: number };
    const bonus = this.done.has('reeds') ? HAY_MEADOW : 0;
    if ('loftBonus' in S) S.loftBonus = bonus;
    else if (fresh && bonus && game.season.season === 'autumn' && game.season.dayOf === 1) S.loft += bonus;
  }

  // ---- Save and co-op ----

  save(): ProjectsSave {
    return { g: { ...this.grazed }, d: Object.fromEntries(Object.entries(this.deliveredFrom).map(([k, v]) => [k, [...v]])), done: [...this.done], a: [...this.announced], f: this.foldShut };
  }

  // An older save has none: nothing started.
  load(game: Game, d?: ProjectsSave) {
    this.grazed = {};
    this.deliveredFrom = {};
    this.done.clear();
    this.announced.clear();
    this.carrying.clear();
    this.blessedOut.clear();
    this.foldShut = false;
    this.justDone = null;
    if (d) {
      const ids = PROJECTS.map((p) => p.id);
      for (const [k, v] of Object.entries(d.g ?? {})) if (ids.includes(k as ProjectId) && typeof v === 'number') this.grazed[k as ProjectId] = v;
      for (const [k, v] of Object.entries(d.d ?? {})) {
        const p = PROJECTS.find((q) => q.id === k);
        if (p?.kind === 'haul' && Array.isArray(v)) this.deliveredFrom[p.id] = p.piles.map((q, i) => Math.min(q.n, Number(v[i]) || 0));
      }
      for (const id of d.done ?? []) if (ids.includes(id)) this.done.add(id);
      for (const id of d.a ?? []) if (ids.includes(id)) this.announced.add(id);
      this.foldShut = !!d.f;
    }
    this.hayMeadow(game, false);
    game.map.setProjects(this);
  }

  // A guest's copy, from the host.
  applyShared(game: Game, v: unknown) {
    const d = v as ProjectsSave & { cel?: Partial<Record<ProjectId, number>> };
    const before = `${[...this.done].join()}|${this.foldShut}|${this.delivered('circle')}`;
    this.grazed = { ...(d.g ?? {}) };
    this.deliveredFrom = Object.fromEntries(Object.entries(d.d ?? {}).map(([k, a]) => [k, [...a]]));
    const was = new Set(this.done);
    this.done = new Set(d.done ?? []);
    this.foldShut = !!d.f;
    this.celebrated = { ...(d.cel ?? {}) };
    for (const id of this.done) if (!was.has(id) && this.synced) {
      const p = projectById(id);
      game.audio?.stinger('tierup');
      game.feel.confetti(game.screen.W);
      this.justDone = { name: p.done, brings: p.brings, t: 6 };
    }
    if (before !== `${[...this.done].join()}|${this.foldShut}|${this.delivered('circle')}` || !this.synced) game.map.setProjects(this);
    this.synced = true;
  }

  shared(): ProjectsSave & { cel: Partial<Record<ProjectId, number>> } {
    return { ...this.save(), cel: { ...this.celebrated } };
  }
}
