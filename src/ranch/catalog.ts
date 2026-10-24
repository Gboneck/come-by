import { spr, type Sprite } from '../gfx/sprite';
import type { BuildingKind, Rot } from './buildings';

export type ItemId = 'pen' | 'fence' | 'trough' | 'kennel' | 'gate' | 'market' | 'barn' | 'windmill';

export interface BuildDef {
  id: ItemId;
  kind: BuildingKind;
  name: string;
  cost: number;
  tier: number; // ranch tier that unlocks it
  w: number;
  h: number;
  rotates: boolean;
  max?: number; // how many you may own
  upgrade?: { cost: number; tier: number; desc: string };
  desc: string;
  icon: () => Sprite;
}

const icons: Record<string, Sprite> = {};
const icon = (id: string, rows: string[]) => () => (icons[id] ??= spr(rows, 0, 0));

export const CATALOG: BuildDef[] = [
  {
    id: 'pen', kind: 'pen', name: 'PEN', cost: 25, tier: 1, w: 8, h: 7, rotates: true,
    upgrade: { cost: 30, tier: 3, desc: 'BIGGER, STURDIER' },
    desc: 'HOLDS ONE KIND. THE GATE SHUTS BEHIND THEM.',
    icon: icon('pen', ['p.p.p.p.p', 'wwwwwwwww', 'p.......p', 'w.......w', 'p.......p', 'wwww..www', 'p.p...p.p']),
  },
  {
    id: 'fence', kind: 'fence', name: 'FENCE', cost: 2, tier: 1, w: 1, h: 1, rotates: true,
    desc: 'BUILD WINGS THAT FUNNEL A FLOCK TO A GATE.',
    icon: icon('fence', ['.........', 'p...p...p', 'wwwwwwwww', 'p...p...p', 'wwwwwwwww', 'p...p...p']),
  },
  {
    id: 'trough', kind: 'trough', name: 'TROUGH', cost: 12, tier: 1, w: 2, h: 1, rotates: false,
    desc: 'PUT IN A PEN: MORE GOODS, CALMER ANIMALS.',
    icon: icon('trough', ['.........', '.........', 'ptttttttp', 'pwtwtwtwp', '.ppppppp.', '.p.....p.']),
  },
  {
    id: 'kennel', kind: 'kennel', name: 'KENNEL', cost: 20, tier: 1, w: 3, h: 3, rotates: false, max: 1,
    desc: 'TRAIN YOUR DOG: STAMINA, SPEED, BARK, NIP.',
    icon: icon('kennel', ['....p....', '...ppp...', '..ppppp..', '.ppppppp.', '.wwwwwww.', '.ww.p.ww.', '.wwpppww.']),
  },
  {
    id: 'market', kind: 'market', name: 'MARKET', cost: 40, tier: 2, w: 4, h: 3, rotates: false, max: 1,
    desc: 'GOODS SELL FOR HALF AGAIN. SELL STOCK HERE.',
    icon: icon('market', ['ywywywywy', 'ywywywywy', '.p.....p.', '.p.....p.', 'ppppppppp', '.pwyw.yp.']),
  },
  {
    id: 'barn', kind: 'barn', name: 'BARN', cost: 80, tier: 2, w: 6, h: 5, rotates: false,
    upgrade: { cost: 50, tier: 3, desc: 'SHELTERS A WIDER RING' },
    desc: 'PENS INSIDE ITS RING ARE SAFE AT NIGHT.',
    icon: icon('barn', ['....p....', '..ppppp..', '.ppppppp.', 'ppppppppp', '.wwwwwww.', '.wpwwwpw.', '.wwpwpww.']),
  },
  {
    id: 'gate', kind: 'gate', name: 'GATE', cost: 6, tier: 3, w: 2, h: 1, rotates: true,
    desc: 'OPENS FOR YOU AND A DRIVEN FLOCK.',
    icon: icon('gate', ['.........', 'p.......p', 'pwwwwwwwp', 'p.w.w.w.p', 'pwwwwwwwp', 'p.......p']),
  },
  {
    id: 'windmill', kind: 'windmill', name: 'MILL', cost: 180, tier: 5, w: 3, h: 3, rotates: false, max: 1,
    desc: 'THE VALLEY PROSPERS: +20% GOODS.',
    icon: icon('windmill', ['p.....p', '.p...p.', '..pwp..', '...w...', '..pwp..', '.p.w.p.', 'p.www.p']),
  },
];

export const defOf = (id: ItemId) => CATALOG.find((d) => d.id === id)!;
export const defOfKind = (k: BuildingKind) => CATALOG.find((d) => d.kind === k);

export function footprint(def: BuildDef, rot: Rot): { w: number; h: number } {
  if (!def.rotates || rot % 2 === 0) return { w: def.w, h: def.h };
  return { w: def.h, h: def.w };
}
