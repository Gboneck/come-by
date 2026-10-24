import { Animal } from '../entities/animal';
import { SPECIES } from '../entities/species';
import type { Coat } from '../art/animals';
import { REGIONS, type RegionDef, type WorldMap } from '../world/map';
import { ri } from '../rng';

// How many groups a region holds in the morning, by day and tier.
export function groupsFor(reg: RegionDef, day: number, tier: number): number {
  const age = tier - reg.tier; // tiers since this region opened
  return Math.min(3, 1 + Math.floor(age / 2) + (day > 2 ? 1 : 0));
}

export function spawnMorning(map: WorldMap, animals: Animal[], day: number, tier: number, unlocked: (r: RegionDef) => boolean): Animal[] {
  const born: Animal[] = [];
  for (const reg of REGIONS) {
    if (!reg.species || !unlocked(reg)) continue;
    const sp = SPECIES[reg.species];
    const wild = animals.filter((a) => !a.pen && !a.gone && map.regionAt(a.x, a.y) === reg);
    const target = groupsFor(reg, day, tier);
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
        born.push(new Animal(reg.species, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, coat));
      }
      made++;
    }
  }
  return born;
}
