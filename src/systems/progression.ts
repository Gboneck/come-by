import type { Game } from '../game';
import type { RegionId, SpeciesId } from '../world/map';
import { SPECIES } from '../entities/species';

// Lifetime record, kept in the save.
export interface Totals {
  days: number;
  delivered: Partial<Record<SpeciesId, number>>;
  earned: number;
  calmBatches: number;
  upgrades: number;
  nightsNoLoss: number;
  lost: number;
  orders: number; // orders filled
  calmOrders: number; // ... with every head calm
  ribbons: [number, number, number]; // trial placings: 1st, 2nd, 3rd
  bestTrial: number; // best trial score, practice included
  trialRuns: number;
  legacy: string[]; // legacy goals reached (labels)
}

export const newTotals = (): Totals => ({
  days: 0, delivered: {}, earned: 0, calmBatches: 0, upgrades: 0, nightsNoLoss: 0, lost: 0,
  orders: 0, calmOrders: 0, ribbons: [0, 0, 0], bestTrial: 0, trialRuns: 0, legacy: [],
});

export interface Goal {
  label: string; // short, for the HUD tracker
  target: number;
  value: (g: Game) => number;
}

export interface Tier {
  n: number;
  name: string;
  species: SpeciesId;
  region: RegionId;
  blurb: string;
  goals: Goal[];
  // What reaching this tier brings (shown as "next" on the tier before).
  brings: string[];
}

const penned = (id: SpeciesId) => (g: Game) => g.ranch.pens.reduce((n, p) => n + p.animals.filter((a) => a.sp.id === id && !a.gone).length, 0);
const owns = (kind: string) => (g: Game) => (g.ranch.buildings.some((b) => b.kind === kind) ? 1 : 0);
const allPenned = (g: Game) => g.ranch.pens.reduce((n, p) => n + p.animals.filter((a) => !a.gone).length, 0);

const penGoal = (id: SpeciesId, n: number): Goal => ({ label: `PEN ${n} ${SPECIES[id].plural.toUpperCase()}`, target: n, value: penned(id) });
const ribbons = (g: Game) => g.totals.ribbons[0] + g.totals.ribbons[1] + g.totals.ribbons[2];
const won = (id: string) => (g: Game) => (g.trials.won.includes(id as never) ? 1 : 0);

export const TIERS: Tier[] = [
  {
    n: 1, name: 'HOMESTEAD', species: 'duck', region: 'meadow',
    blurb: 'A CABIN, A PEN AND A FEW DUCKS.',
    goals: [
      penGoal('duck', 6),
      { label: 'A CALM DRIVE HOME', target: 1, value: (g) => g.totals.calmBatches },
      { label: 'BUILD A KENNEL', target: 1, value: owns('kennel') },
    ],
    brings: [],
  },
  {
    n: 2, name: 'SMALLHOLDING', species: 'sheep', region: 'hills',
    blurb: 'SHEEP COME DOWN FROM THE ROLLING HILLS.',
    goals: [
      penGoal('sheep', 8),
      { label: 'EARN 150$ IN ALL', target: 150, value: (g) => g.totals.earned },
      { label: 'BUILD A MARKET', target: 1, value: owns('market') },
    ],
    brings: ['SHEEP IN THE ROLLING HILLS', 'MARKET STALL, BARN', 'BUYERS WANTING STOCK', 'SHEEPDOG TRIALS AT THE SHOW GROUND', 'COYOTES BY NIGHT'],
  },
  {
    n: 3, name: 'FARMSTEAD', species: 'goat', region: 'rocky',
    blurb: 'GOATS ON THE ROCKY RISE. THEY CLIMB.',
    goals: [
      penGoal('goat', 8),
      { label: 'BUILD A BARN', target: 1, value: owns('barn') },
      { label: 'TRAIN YOUR DOG 3X', target: 3, value: (g) => g.totals.upgrades },
      { label: 'FILL AN ORDER', target: 1, value: (g) => g.totals.orders },
    ],
    brings: ['GOATS ON THE ROCKY RISE', 'GATES, PEN + BARN UPGRADES', 'A BIGGER FARMHOUSE'],
  },
  {
    n: 4, name: 'RANCH', species: 'cow', region: 'ford',
    blurb: 'CATTLE AT THE RIVER FORD. NIP THEIR HEELS.',
    goals: [
      penGoal('cow', 6),
      { label: 'A NIGHT WITH NO LOSSES', target: 1, value: (g) => g.totals.nightsNoLoss },
      { label: 'HIRE A HELPER DOG', target: 1, value: (g) => g.helpers.length },
      { label: 'PLACE IN A TRIAL', target: 1, value: (g) => Math.min(1, ribbons(g)) },
    ],
    brings: ['CATTLE AT THE RIVER FORD', 'HELPER DOGS', 'WOLVES BY NIGHT'],
  },
  {
    n: 5, name: 'VALLEY ESTATE', species: 'pony', region: 'high',
    blurb: 'WILD PONIES RUN THE HIGH RANGE.',
    goals: [
      penGoal('pony', 6),
      { label: '50 ANIMALS PENNED', target: 50, value: allPenned },
      { label: 'BUILD THE WINDMILL', target: 1, value: owns('windmill') },
    ],
    brings: ['WILD PONIES IN THE HIGH RANGE', 'THE WINDMILL'],
  },
];

export const tierOf = (n: number) => TIERS[Math.min(TIERS.length, Math.max(1, n)) - 1];

export function goalDone(g: Game, goal: Goal) {
  return goal.value(g) >= goal.target;
}

export function tierComplete(g: Game): boolean {
  return tierOf(g.tier).goals.every((goal) => goalDone(g, goal));
}

// Past the last tier: a ladder of trial wins and orders to keep going for.
export const LEGACY: Goal[] = [
  { label: 'WIN THE OPEN CLASS', target: 1, value: won('open') },
  { label: 'FILL 10 ORDERS', target: 10, value: (g) => g.totals.orders },
  { label: 'WIN THE CATTLE CLASS', target: 1, value: won('cattle') },
  { label: '5 ORDERS ALL CALM', target: 5, value: (g) => g.totals.calmOrders },
  { label: 'WIN THE VALLEY CUP', target: 1, value: (g) => g.trials.cups },
  { label: 'SCORE 90 IN A TRIAL', target: 90, value: (g) => g.totals.bestTrial },
  { label: 'FILL 40 ORDERS', target: 40, value: (g) => g.totals.orders },
  { label: 'WIN THE CUP 3 TIMES', target: 3, value: (g) => g.trials.cups },
];
export const LEGACY_PRIZE = 40;

// The first goal still open: what the HUD shows. Once the valley thrives,
// the legacy ladder takes over.
export function nextGoal(g: Game): { goal: Goal; value: number } | null {
  const list = g.won && g.tier >= TIERS.length ? LEGACY : tierOf(g.tier).goals;
  for (const goal of list) {
    const v = goal.value(g);
    if (v < goal.target) return { goal, value: v };
  }
  return null;
}

// Celebrate legacy goals as they fall (only once the valley thrives).
export function checkLegacy(g: Game) {
  if (!g.won) return;
  for (const goal of LEGACY) {
    if (g.totals.legacy.includes(goal.label) || !goalDone(g, goal)) continue;
    g.totals.legacy.push(goal.label);
    g.earn(LEGACY_PRIZE);
    const n = g.totals.legacy.length;
    g.showBanner(n >= LEGACY.length ? 'VALLEY LEGEND!' : 'LEGACY', `${goal.label}  +${LEGACY_PRIZE}$  (${n}/${LEGACY.length})`, 3.5);
    g.audio?.play('tierup');
    return;
  }
}
