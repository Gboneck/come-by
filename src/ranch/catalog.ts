import { spr, type Sprite } from '../gfx/sprite';
import type { BuildingKind, Rot } from './buildings';

export type ItemId = 'pen' | 'fence' | 'trough' | 'shelter' | 'rack' | 'kennel' | 'gate' | 'market' | 'barn' | 'windmill' | 'hay' | 'shed' | 'dairy' | 'agility';

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
    id: 'pen', kind: 'pen', name: 'PADDOCK', cost: 25, tier: 1, w: 8, h: 7, rotates: true,
    desc: 'SIZE IT AS YOU LIKE, EXTEND IT LATER. DUCKS GO WITH ANYONE, SHEEP WITH GOATS, CATTLE WITH PONIES.',
    icon: icon('pen', ['p.p.p.p.p', 'wwwwwwwww', 'p.......p', 'w.......w', 'p.......p', 'wwww..www', 'p.p...p.p']),
  },
  {
    id: 'fence', kind: 'fence', name: 'FENCE', cost: 2, tier: 1, w: 1, h: 1, rotates: true,
    desc: 'BUILD WINGS THAT FUNNEL A FLOCK TO A GATE.',
    icon: icon('fence', ['.........', 'p...p...p', 'wwwwwwwww', 'p...p...p', 'wwwwwwwww', 'p...p...p']),
  },
  {
    id: 'trough', kind: 'trough', name: 'TROUGH', cost: 12, tier: 1, w: 2, h: 1, rotates: false,
    desc: 'PUT IN A PADDOCK: MORE GOODS, CALMER ANIMALS.',
    icon: icon('trough', ['.........', '.........', 'ptttttttp', 'pwtwtwtwp', '.ppppppp.', '.p.....p.']),
  },
  {
    id: 'shelter', kind: 'shelter', name: 'FIELD SHELTER', cost: 45, tier: 2, w: 3, h: 2, rotates: false,
    desc: 'PUT IN A PADDOCK: ITS STOCK IS SAFE AT NIGHT, AS IN A BARN\'S RING.',
    icon: icon('shelter', ['....p....', '..ppppp..', '.ppppppp.', 'ppppppppp', '.w.....w.', '.w.yyy.w.', '.wyyyyyw.']),
  },
  {
    id: 'rack', kind: 'rack', name: 'HAY RACK', cost: 20, tier: 2, w: 2, h: 1, rotates: false,
    desc: 'PUT IN A PADDOCK: ITS STOCK EATS A THIRD LESS HAY IN WINTER.',
    icon: icon('rack', ['.........', 'p.p.p.p.p', 'pyyyyyyyp', 'pyyyyyyyp', 'ppppppppp', '.p.....p.']),
  },
  {
    id: 'kennel', kind: 'kennel', name: 'KENNEL', cost: 15, tier: 1, w: 3, h: 3, rotates: false, max: 1,
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
    upgrade: { cost: 70, tier: 3, desc: 'SHELTERS A WIDER RING' },
    desc: 'PENS INSIDE ITS RING ARE SAFE AT NIGHT.',
    icon: icon('barn', ['....p....', '..ppppp..', '.ppppppp.', 'ppppppppp', '.wwwwwww.', '.wpwwwpw.', '.wwpwpww.']),
  },
  {
    id: 'hay', kind: 'haystack', name: 'HAY', cost: 40, tier: 2, w: 2, h: 2, rotates: false,
    desc: 'WINTER FEED: 20 BALES. IN A BARN\'S RING THE SNOW CANNOT SPOIL IT.',
    icon: icon('hay', ['.........', '...yyy...', '..yyyyy..', '.yyoyyoy.', '.yoyyyoy.', 'yyyyyyyyy', 'sssssssss']),
  },
  {
    id: 'shed', kind: 'shed', name: 'SHEARING SHED', cost: 60, tier: 2, w: 8, h: 6, rotates: false, max: 1,
    desc: 'IN SUMMER, WALK SHEEP THROUGH ITS CHUTE: EACH IS SHORN FOR A WOOL BONUS.',
    icon: icon('shed', ['.........', '..ppppp..', '.ppppppp.', 'ppppppppp', 'wwpwwwpww', '.........', 'w.w.w.w.w']),
  },
  {
    id: 'agility', kind: 'agility', name: 'AGILITY YARD', cost: 45, tier: 2, w: 12, h: 8, rotates: false, max: 1,
    desc: 'RUN THE COURSE CLEAN AND QUICK: FREE SPEED AND STAMINA TRAINING.',
    icon: icon('agility', ['p.......p', 'p.y...y.p', 'pwyw.wywp', 'p.y...y.p', 'p...t...p', 'p..ttt..p', 'ppp...ppp']),
  },
  {
    id: 'dairy', kind: 'dairy', name: 'DAIRY', cost: 180, tier: 4, w: 7, h: 7, rotates: false, max: 1,
    desc: 'MORNINGS, WALK COWS INTO ITS YARD TO BE MILKED. CALM COWS GIVE MORE.',
    icon: icon('dairy', ['..ppppp..', '.ppppppp.', '.wwwwwww.', '.wwpwpww.', 'p.......p', 'p.......p', 'ppp...ppp']),
  },
  {
    id: 'gate', kind: 'gate', name: 'GATE', cost: 6, tier: 3, w: 2, h: 1, rotates: true,
    desc: 'OPENS FOR YOU AND A DRIVEN FLOCK.',
    icon: icon('gate', ['.........', 'p.......p', 'pwwwwwwwp', 'p.w.w.w.p', 'pwwwwwwwp', 'p.......p']),
  },
  {
    id: 'windmill', kind: 'windmill', name: 'MILL', cost: 500, tier: 5, w: 3, h: 3, rotates: false, max: 1,
    desc: 'THE VALLEY PROSPERS: +20% GOODS.',
    icon: icon('windmill', ['p.....p', '.p...p.', '..pwp..', '...w...', '..pwp..', '.p.w.p.', 'p.www.p']),
  },
];

export const defOf = (id: ItemId) => CATALOG.find((d) => d.id === id)!;

// The default paddock (8x7) costs its fence; bigger ones are priced as they
// are dragged out (src/ranch/paddock.ts). Kept for old callers.
export function setPenPrice(_pens: number) {
  defOf('pen').cost = 25;
}
export const defOfKind = (k: BuildingKind) => CATALOG.find((d) => d.kind === k);

export function footprint(def: BuildDef, rot: Rot): { w: number; h: number } {
  if (!def.rotates || rot % 2 === 0) return { w: def.w, h: def.h };
  return { w: def.h, h: def.w };
}
