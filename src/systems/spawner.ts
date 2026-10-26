import { Animal, findGroups } from '../entities/animal';
import { SPECIES } from '../entities/species';
import type { Coat } from '../art/animals';
import { REGIONS, type RegionDef, type WorldMap } from '../world/map';
import { ri } from '../rng';
import type { Season } from './season';
import { BREED, youngFor } from './seasonal';

// How many groups a region holds in the morning, by day and tier: a third
// by the second day, a fourth once the region has been open three tiers.
// Fewer come down in winter.
export function groupsFor(reg: RegionDef, day: number, tier: number, season?: Season): number {
  const age = tier - reg.tier; // tiers since this region opened
  // A region that has just opened always has two flocks out, so its pen goal
  // can be met on the day it opens.
  if (age === 0 && reg.tier > 1) return 2;
  const n = Math.min(age >= 3 ? 4 : 3, 1 + Math.floor(age / 2) + (day > 2 ? 1 : 0));
  return season === 'winter' ? Math.max(1, n - 1) : n;
}

// Flocks grow as the valley does: a sixth bigger for each tier the region
// has been open, up to two-thirds again.
export const flockGrowth = (reg: RegionDef, tier: number) => 1 + Math.min(4, Math.max(0, tier - reg.tier)) / 6;
export const flockSize = (reg: RegionDef, tier: number) => {
  const g = SPECIES[reg.species!].spawnGroup;
  return Math.round(ri(g[0], g[1]) * flockGrowth(reg, tier));
};
const meanFlock = (reg: RegionDef, tier: number) => {
  const g = SPECIES[reg.species!].spawnGroup;
  return ((g[0] + g[1]) / 2) * flockGrowth(reg, tier);
};

// `season` is given for a morning's spawn (not a region opening): in a
// species' breeding season (spring; summer for ponies) some wild mothers
// come with young at foot, from tier 2 (day one's ducks come alone).
const WILD_YOUNG = 0.4;

// `keep` marks wild animals that must stay put (a hidden place's flock).
export function spawnMorning(map: WorldMap, animals: Animal[], day: number, tier: number, unlocked: (r: RegionDef) => boolean, season?: Season, keep?: (a: Animal) => boolean): Animal[] {
  const born: Animal[] = [];
  for (const reg of REGIONS) {
    if (!reg.species || !unlocked(reg)) continue;
    const sp = SPECIES[reg.species];
    if (season === 'winter') winterThin(map, animals, reg, groupsFor(reg, day, tier, season), meanFlock(reg, tier), keep);
    const wild = animals.filter((a) => !a.pen && !a.gone && !a.young && map.regionAt(a.x, a.y) === reg);
    const target = groupsFor(reg, day, tier, season);
    const have = Math.round(wild.length / meanFlock(reg, tier));
    const pts = [...(map.spawns[reg.id] ?? [])].sort(() => Math.random() - 0.5);
    let made = 0;
    for (const p of pts) {
      if (have + made >= target) break;
      if ([...wild, ...born].some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 90)) continue;
      const n = flockSize(reg, tier);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (5 + n * 1.3);
        const coat = Math.floor(Math.random() * sp.coats) as Coat;
        const ani = new Animal(reg.species, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, coat);
        born.push(ani);
        if (tier >= 2 && season === BREED[reg.species].season && Math.random() < WILD_YOUNG) born.push(youngFor(ani));
      }
      made++;
    }
  }
  return born;
}

// Winter: wild stock over a region's winter number of flocks goes down
// the valley until spring: the smallest flocks first, and a flock bigger
// than what has to go is only thinned (never your own strays, a hidden
// place's flock, or anyone penned).
function winterThin(map: WorldMap, animals: Animal[], reg: RegionDef, target: number, per: number, keep?: (a: Animal) => boolean) {
  const free = animals.filter((a) => !a.pen && !a.gone && !a.home && !a.trial && !a.young && !keep?.(a) && map.regionAt(a.x, a.y) === reg);
  let excess = free.length - Math.round(target * per);
  const leave = (a: Animal) => {
    a.gone = true;
    if (a.lamb) a.lamb.gone = true;
    excess--;
  };
  for (const gr of findGroups(free).sort((x, y) => x.members.length - y.members.length)) {
    if (excess <= 0) break;
    if (gr.members.length <= excess) gr.members.forEach(leave);
    else {
      // The outskirts of a big flock wander off.
      const c = gr.members.reduce((s, a) => ({ x: s.x + a.x / gr.members.length, y: s.y + a.y / gr.members.length }), { x: 0, y: 0 });
      gr.members.sort((x, y) => Math.hypot(y.x - c.x, y.y - c.y) - Math.hypot(x.x - c.x, x.y - c.y)).slice(0, excess).forEach(leave);
    }
  }
}
