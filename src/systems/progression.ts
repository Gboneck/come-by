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
}

export const newTotals = (): Totals => ({ days: 0, delivered: {}, earned: 0, calmBatches: 0, upgrades: 0, nightsNoLoss: 0, lost: 0 });

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
    brings: ['SHEEP IN THE ROLLING HILLS', 'MARKET STALL, BARN', 'COYOTES BY NIGHT'],
  },
  {
    n: 3, name: 'FARMSTEAD', species: 'goat', region: 'rocky',
    blurb: 'GOATS ON THE ROCKY RISE. THEY CLIMB.',
    goals: [
      penGoal('goat', 8),
      { label: 'BUILD A BARN', target: 1, value: owns('barn') },
      { label: 'TRAIN YOUR DOG 3X', target: 3, value: (g) => g.totals.upgrades },
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

// The first goal still open: what the HUD shows.
export function nextGoal(g: Game): { goal: Goal; value: number } | null {
  for (const goal of tierOf(g.tier).goals) {
    const v = goal.value(g);
    if (v < goal.target) return { goal, value: v };
  }
  return null;
}
