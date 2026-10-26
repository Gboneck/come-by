import type { Game } from '../game';
import { Person, type Folk, type FolkId, type VillageId } from './folk';
import { ARCH, PLOTS, SPOTS, doorOf, type Plot, type StepId } from '../ranch/village';
import { BRIDGE_LOGS, isFestival, isMarketDay, nextStep } from '../systems/valley';
import { BLOCK_DOG, TS } from '../world/map';
import { collideCircle } from '../world/collide';

// The villagers' days. Each step of the village brings its people (the
// morning it is built they walk in up the road). They keep house, draw
// water, mind the stalls, work the anvil and sit out on the bench; on
// market day everyone goes to the stalls; on festival day they line the
// green and cheer a parade through the arch; at dusk they go home, the
// warden last, round the green with a lantern. Like all the townsfolk
// they change nothing in the sim, and they roll their own dice, so a
// seeded run plays the same with a village as without.

const RESIDENTS: Record<StepId, VillageId[]> = {
  cottage1: ['cottager1', 'cottager2'],
  square: ['baker', 'grocer'],
  smithy: ['smith'],
  cottage2: ['cottager4', 'cottager3'],
  cottage3: ['cottager5', 'cottager6'],
  hall: ['warden', 'weaver'],
};
const ORDER = Object.values(RESIDENTS).flat();
const CHILD = new Set<FolkId>(['cottager3', 'cottager6']);
// The stallholders live up the road and come in for the day.
const STALL_OF: Partial<Record<FolkId, number>> = { baker: 0, grocer: 1 };
export const isVillager = (id: FolkId) => (ORDER as FolkId[]).includes(id);

type Facing = 'd' | 'u' | 'l' | 'r';
type Pt = { x: number; y: number };
type Steps = Parameters<Person['go']>[0];

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pickOf = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const near = (a: Pt, b: Pt, r: number) => Math.hypot(a.x - b.x, a.y - b.y) < r;

const STALLS = PLOTS.filter((p) => p.kind === 'stall');
// Minding a stall: stood at one end, facing the customers (the first
// stall's west end, clear of the awning of the one in front of it).
const minding = (p: Plot): Pt => ({ x: p === STALLS[0] ? p.tx * TS - 3 : (p.tx + p.w) * TS + 3, y: (p.ty + p.h) * TS - 1 });
// Buying at one: in front of the counter, facing it.
const buying = (p: Plot): Pt => ({ x: (p.tx + p.w / 2) * TS, y: (p.ty + p.h) * TS + 4 });
const stepPlot = (s: StepId) => PLOTS.find((p) => p.step === s)!;

function homeOf(id: VillageId): Pt {
  if (STALL_OF[id] !== undefined) return { ...SPOTS.road };
  const step = (Object.keys(RESIDENTS) as StepId[]).find((s) => RESIDENTS[s].includes(id))!;
  return doorOf(stepPlot(step));
}

// Where the green's spectators stand on festival day: along the north
// edge, the south-west corner and either side of the lane past the arch,
// clear of the way a parade comes.
const CROWD: (Pt & { face: Facing })[] = [
  { x: 697, y: 621, face: 'd' },
  { x: 707, y: 621, face: 'd' },
  { x: 717, y: 621, face: 'd' },
  { x: 727, y: 621, face: 'd' },
  { x: 694, y: 647, face: 'u' },
  { x: 704, y: 647, face: 'u' },
  { x: 669, y: 627, face: 'd' },
  { x: 664, y: 646, face: 'u' },
  { x: 674, y: 646, face: 'u' },
];
const CROWD_AT: Partial<Record<FolkId, number>> = { cottager1: 0, cottager2: 1, weaver: 2, cottager4: 4, cottager5: 7 };
// The bench on the green seats two.
const SEATS: Pt[] = [-3, 3].map((dx) => ({ x: SPOTS.bench.x + dx, y: SPOTS.bench.y }));
function freeSeat(game: Game, p: Person): Pt | null {
  const taken = (s: Pt) => game.folk.people.some((q) => q !== p && q.shown && ((q.pose === 'sit' && near(q, s, 2)) || q.steps.some((t) => t.x === s.x && t.y === s.y)));
  return SEATS.find((s) => !taken(s)) ?? null;
}
// Where children run about.
const PLAY: Pt[] = [
  { x: 700, y: 632 },
  { x: 728, y: 640 },
  { x: 744, y: 630 },
  { x: 714, y: 644 },
  { x: 660, y: 636 },
  { x: 652, y: 650 },
];

interface V {
  wake: number; // seconds into the day they come out
  spoke: number; // the day they last had a word with the dog
  waved: number; // game time they last waved
  dusk: number; // the day their evening began
  cheered: number; // the festival they cheered
  fair: number; // the festival day they took their place
}
const state = new WeakMap<Person, V>();
function vs(p: Person): V {
  let v = state.get(p);
  if (!v) state.set(p, (v = { wake: 3 + ORDER.indexOf(p.id as VillageId) * 3, spoke: -1, waved: -99, dusk: -1, cheered: -1, fair: -1 }));
  return v;
}

// Everyone whose step is built, there once; newcomers walk in from the road
// the morning their step goes up and say hello.
export function villageCast(game: Game, folk: Folk) {
  const vil = game.ranch.village, nc = game.valley.newcomer;
  for (const step of Object.keys(RESIDENTS) as StepId[]) {
    if (!vil.has(step)) continue;
    for (const id of RESIDENTS[step]) {
      if (folk.people.some((p) => p.id === id)) continue;
      // Their door, nudged out onto open ground (the south row's fronts are
      // tight against the wood).
      const door = homeOf(id);
      const home = { x: door.x + 0.25, y: door.y - 0.25, vx: 0, vy: 0 }; // off the cell edges, where no push happens
      collideCircle(game.map, home, 2.5, BLOCK_DOG);
      const fresh = nc?.step === step && nc.day === game.day.day && game.day.phase === 'day';
      const p = new Person(id, fresh ? SPOTS.road.x + (folk.people.length % 3) * 6 : home.x, fresh ? SPOTS.road.y : home.y);
      p.home = { x: home.x, y: home.y };
      if (fresh) {
        vs(p).wake = 0;
        p.go([{ x: home.x, y: home.y, t: 2, face: 'd', done: () => folk.say(game, p, CHILD.has(id) ? 'IS THIS OUR NEW HOUSE?' : "HELLO! WE'VE JUST MOVED IN.", true) }]);
      }
      folk.people.push(p);
    }
  }
}

export function villageBrain(game: Game, folk: Folk, p: Person, dt: number) {
  const v = vs(p), day = game.day;
  if (day.phase === 'night' || (day.phase === 'day' && day.t < v.wake)) {
    // The warden sees the green safe first, lantern in hand.
    if (p.id === 'warden' && day.phase === 'night' && day.nightT < 26) {
      p.shown = true;
      p.lantern = true;
      if (p.run(game, dt)) p.go(lanternRound());
      return;
    }
    indoors(game, p, dt);
    return;
  }
  if (!p.shown) {
    if (day.phase === 'dusk') return;
    // Out of the door (or in up the road) in the morning.
    p.shown = true;
    p.x = p.home.x;
    p.y = p.home.y;
    p.steps = [];
  }
  if (day.phase === 'dusk') {
    if (v.dusk !== day.day) {
      v.dusk = day.day;
      p.go(evening(game, p));
    }
    if (p.run(game, dt)) {
      if (p.id === 'warden') p.go(lanternRound());
      else indoors(game, p, dt);
    }
    talk(game, folk, p, v);
    return;
  }
  p.lantern = false;
  const festival = isFestival(game);
  if (festival && game.valley.paradeDone && v.cheered !== day.day) {
    // A parade! Everyone on the green cheers it.
    v.cheered = day.day;
    p.go([{ x: p.x, y: p.y, pose: 'wave', t: 2.5 + rnd() * 2 }]);
    if (p.id === 'warden') folk.say(game, p, 'HOORAY! A FINE PARADE!', true);
  }
  if (festival && v.fair !== day.day && !CHILD.has(p.id)) {
    v.fair = day.day;
    p.steps = [];
  }
  wave(game, p, v);
  talk(game, folk, p, v);
  if (!p.run(game, dt)) return;
  p.go(festival ? festivalErrand(p) : errand(game, p));
}

// Home and in at the door (stallholders off up the road).
function indoors(game: Game, p: Person, dt: number) {
  p.lantern = false;
  p.steps = [];
  if (!p.shown) return;
  if (!near(p, p.home, 5) && !p.walk(game, p.home.x, p.home.y, dt)) return;
  p.shown = false;
}

function evening(game: Game, p: Person): Steps {
  const home = { ...p.home, face: 'd' as Facing };
  if (p.id === 'warden') {
    p.lantern = true;
    return lanternRound();
  }
  if (CHILD.has(p.id) || STALL_OF[p.id] !== undefined) return [{ ...home, t: 0 }];
  // A sit on the bench as the light goes, or a while at the door.
  const seat = rnd() < 0.5 ? freeSeat(game, p) : null;
  return seat ? [{ ...seat, pose: 'sit', face: 'd', t: 12 + rnd() * 14 }, { ...home, t: 1 }] : [{ ...home, t: 8 + rnd() * 12 }];
}

function lanternRound(): Steps {
  return [
    { x: ARCH.x + 6, y: (ARCH.y0 + ARCH.y1) / 2, t: 3, face: 'l' },
    { ...SPOTS.well, t: 3, face: 'l' },
    { ...SPOTS.green, t: 3, face: 'd' },
    { x: SPOTS.road.x + 20, y: SPOTS.road.y - 22, t: 3, face: 'r' },
    { ...SPOTS.hallDoor, t: 4, face: 'd' },
  ];
}

// The next thing to do on an ordinary day (and on market day).
function errand(game: Game, p: Person): Steps {
  const vil = game.ranch.village, market = isMarketDay(game);
  const home = p.home, r = rnd();
  const stalls = vil.has('square') ? STALLS : [];
  const shop = (): Steps => {
    const s = buying(pickOf(stalls));
    return [{ ...s, face: 'u', t: 3 + rnd() * 3 }, { ...home, item: 'y', face: 'd', t: 1 }];
  };
  const water = (): Steps => [{ ...SPOTS.well, pose: 'crouch', face: 'l', t: 3 }, { ...home, item: 't', face: 'd', t: 1 }];
  const bench = (t: number): Steps => {
    const seat = freeSeat(game, p);
    return seat ? [{ ...seat, pose: 'sit', face: 'd', t }] : water();
  };
  if (CHILD.has(p.id)) {
    // Running about; now and then off to the well, or home for a bite.
    if (r < 0.75) return [{ ...pickOf(PLAY), run: true, t: 1 + rnd() * 3, face: pickOf(['d', 'l', 'r'] as Facing[]) }];
    if (r < 0.9) return [{ ...SPOTS.well, run: true, pose: 'crouch', face: 'l', t: 2 }];
    return [{ ...home, t: 6 + rnd() * 8, face: 'd' }];
  }
  switch (p.id) {
    case 'smith':
      // Bouts at the anvil with a breather between.
      if (r < 0.8) return [{ ...SPOTS.anvil, pose: 'work', face: 'r', t: 7 + rnd() * 8 }, { x: SPOTS.anvil.x - 3, y: SPOTS.anvil.y + 3, face: 'd', t: 3 + rnd() * 4 }];
      return water();
    case 'baker':
    case 'grocer': {
      const s = STALLS[STALL_OF[p.id]!];
      if (r < 0.85 || market) return [{ ...minding(s), face: 'd', t: 18 + rnd() * 20 }];
      return [{ ...SPOTS.well, pose: 'crouch', face: 'l', t: 3 }, { ...minding(s), item: 't', face: 'd', t: 6 }];
    }
    case 'weaver':
      if (market && stalls.length) return [{ ...minding(STALLS[2]), face: 'd', t: 25 + rnd() * 20 }];
      if (r < 0.55) return bench(20 + rnd() * 20);
      return r < 0.8 ? water() : [{ ...home, t: 10, face: 'd' }];
    case 'warden':
      return [
        { ...SPOTS.hallDoor, t: 10 + rnd() * 10, face: 'd' },
        { x: ARCH.x + 8, y: ARCH.y0 + 6, t: 4, face: 'l' },
        { ...pickOf([SPOTS.well, SPOTS.green, buying(STALLS[0])]), t: 5, face: 'd' },
      ];
  }
  // The cottagers: water, the garden, the bench, a chat, the shops.
  if (stalls.length && r < (market ? 0.6 : 0.15)) return shop();
  if (r < 0.4) return water();
  if (r < 0.6) return [{ x: home.x + (rnd() < 0.5 ? -9 : 9), y: home.y, pose: 'crouch', face: 'u', t: 6 + rnd() * 6 }, { ...home, t: 1, face: 'd' }];
  if (r < 0.8) return bench(10 + rnd() * 12);
  // Across to whoever else is out, for a word.
  const other = game.folk.people.find((q) => q !== p && q.shown && isVillager(q.id) && !CHILD.has(q.id) && q.pose !== 'walk' && rnd() < 0.5);
  if (other) {
    const side = other.x < p.x ? 1 : -1;
    return [{ x: other.x + side * 9, y: other.y + 1, face: side > 0 ? 'l' : 'r', t: 6 + rnd() * 6 }];
  }
  return [{ ...home, t: 8, face: 'd' }];
}

// Festival day: everyone takes a place along the green and stays there
// (shifting about) to watch for a parade; the children run about anyway.
function festivalErrand(p: Person): Steps {
  if (CHILD.has(p.id)) return [{ ...pickOf(PLAY), run: true, t: 2 + rnd() * 3, face: 'd' }];
  if (p.id === 'smith') return [{ ...SPOTS.anvil, face: 'd', t: 20 }];
  if (STALL_OF[p.id] !== undefined) return [{ ...minding(STALLS[STALL_OF[p.id]!]), face: 'd', t: 30 }];
  if (p.id === 'warden') return [{ x: ARCH.x + 6, y: ARCH.y0 + 4, face: 'd', t: 30 }];
  const c = CROWD[CROWD_AT[p.id] ?? 3];
  return [{ x: c.x + Math.round((rnd() - 0.5) * 4), y: c.y, face: c.face, t: 8 + rnd() * 8 }, { ...c, pose: rnd() < 0.3 ? 'wave' : 'stand', face: c.face, t: 2 }];
}

// Children wave at the dog when it comes by (and everyone does at a parade).
function wave(game: Game, p: Person, v: V) {
  if (!CHILD.has(p.id) || game.t - v.waved < 25 || !near(p, game.dog, 36) || p.pose === 'walk') return;
  v.waved = game.t;
  p.face = game.dog.x < p.x ? 'l' : 'r';
  p.steps.unshift({ x: p.x, y: p.y, pose: 'wave', face: p.face, t: 2 });
  p.stepT = 0;
  p.walkT = 0;
}

// A word with the dog, once a day each.
function talk(game: Game, folk: Folk, p: Person, v: V) {
  if (v.spoke === game.day.day || !near(p, game.dog, 56) || folk.people.some((q) => q.bubble)) return;
  const text = line(game, p);
  if (text && folk.say(game, p, text)) v.spoke = game.day.day;
}

function line(game: Game, p: Person): string | null {
  const v = game.valley, market = isMarketDay(game), festival = isFestival(game);
  const season = game.season.season;
  if (festival && !v.paradeDone) {
    if (p.id === 'warden') return 'FIVE OF A KIND THROUGH THE ARCH, IF YOU PLEASE!';
    if (!CHILD.has(p.id)) return 'WILL THERE BE A PARADE?';
  }
  if (game.day.phase === 'dusk') return CHILD.has(p.id) ? 'NIGHT NIGHT, DOG!' : pickOf(['EVENING!', 'HOME BEFORE DARK.', 'A FINE DAY.']);
  switch (p.id) {
    case 'cottager1': {
      // The first family knows what the village is waiting for.
      const s = nextStep(game);
      return s ? `${s.deed} AND WE'LL GET ${s.name}!` : 'LOOK HOW THE VILLAGE HAS GROWN!';
    }
    case 'smith':
      if (v.bridge) return "THAT BRIDGE WILL OUTLAST US ALL.";
      return v.logs ? `${BRIDGE_LOGS - v.logs} MORE LOGS FOR THE BRIDGE.` : 'THE YOKE IS READY. BRING CATTLE TO THE WOODPILE.';
    case 'baker':
      return market ? 'MARKET DAY! THE DROVER PAYS MORE TODAY.' : 'FRESH LOAVES! MARKET DAY IS THE THIRD OF THE SEASON.';
    case 'grocer':
      return market ? 'GOODS FETCH MORE ON MARKET DAY!' : season === 'autumn' ? 'APPLES ARE IN!' : 'EGGS! CHEESE! WOOL!';
    case 'weaver':
      return season === 'winter' ? 'A SCARF FOR THE COLD?' : 'LOVELY WOOL FROM YOUR FLOCK.';
    case 'warden':
      return 'THE FESTIVAL IS THE LAST DAY OF EACH SEASON.';
    case 'cottager3':
    case 'cottager6':
      return pickOf(['IS THAT YOUR DOG?', 'GOOD DOG!', 'WHAT A CLEVER DOG!']);
  }
  return season === 'winter' ? 'COLD ONE TODAY.' : season === 'spring' ? 'LAMBS ABOUT!' : pickOf(['LOVELY DAY FOR IT.', 'MORNING!']);
}
