import { Animal, findGroups } from '../entities/animal';
import { SPECIES } from '../entities/species';
import type { Coat } from '../art/animals';
import { REGIONS, type RegionDef, type WorldMap } from '../world/map';
import { ri } from '../rng';
import type { Season } from './season';
import { lambFor } from './seasonal';

// How many groups a region holds in the morning, by day and tier. Fewer
// come down in winter.
export function groupsFor(reg: RegionDef, day: number, tier: number, season?: Season): number {
  const age = tier - reg.tier; // tiers since this region opened
  // A region that has just opened always has two flocks out, so its pen goal
  // can be met on the day it opens.
  if (age === 0 && reg.tier > 1) return 2;
  const n = Math.min(3, 1 + Math.floor(age / 2) + (day > 2 ? 1 : 0));
  return season === 'winter' ? Math.max(1, n - 1) : n;
}

// `season` is given for a morning's spawn (not a region opening): in spring
// some wild ewes come with lambs at foot.
const WILD_LAMBS = 0.4;

// `keep` marks wild animals that must stay put (a hidden place's flock).
export function spawnMorning(map: WorldMap, animals: Animal[], day: number, tier: number, unlocked: (r: RegionDef) => boolean, season?: Season, keep?: (a: Animal) => boolean): Animal[] {
  const born: Animal[] = [];
  for (const reg of REGIONS) {
    if (!reg.species || !unlocked(reg)) continue;
    const sp = SPECIES[reg.species];
    if (season === 'winter') winterThin(map, animals, reg, groupsFor(reg, day, tier, season), keep);
    const wild = animals.filter((a) => !a.pen && !a.gone && !a.young && map.regionAt(a.x, a.y) === reg);
    const target = groupsFor(reg, day, tier, season);
    const have = Math.round(wild.length / ((sp.spawnGroup[0] + sp.spawnGroup[1]) / 2));
    const pts = [...(map.spawns[reg.id] ?? [])].sort(() => Math.random() - 0.5);
    let made = 0;
    for (const p of pts) {
      if (have + made >= target) break;
      if ([...wild, ...born].some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 90)) continue;
      const n = ri(sp.spawnGroup[0], sp.spawnGroup[1]);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (5 + n * 1.3);
        const coat = Math.floor(Math.random() * sp.coats) as Coat;
        const ani = new Animal(reg.species, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, coat);
        born.push(ani);
        if (season === 'spring' && reg.species === 'sheep' && Math.random() < WILD_LAMBS) born.push(lambFor(ani));
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
function winterThin(map: WorldMap, animals: Animal[], reg: RegionDef, target: number, keep?: (a: Animal) => boolean) {
  const sp = SPECIES[reg.species!];
  const per = (sp.spawnGroup[0] + sp.spawnGroup[1]) / 2;
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
