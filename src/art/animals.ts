import { spr, type Sprite } from '../gfx/sprite';
import type { SpeciesId } from '../world/map';

// Every species has: side walk frames (facing right; flipped for left), a
// side graze frame, and down/up walk frames. Anchors sit at the feet.
export interface AnimalSprites {
  side: Sprite[];
  graze: Sprite;
  down: Sprite[];
  up: Sprite[];
}

function set(side: string[][], graze: string[], down: string[][], up: string[][], ax: number, ay: number, axv: number, ayv: number): AnimalSprites {
  return {
    side: side.map((r) => spr(r, ax, ay)),
    graze: spr(graze, ax, ay),
    down: down.map((r) => spr(r, axv, ayv)),
    up: up.map((r) => spr(r, axv, ayv)),
  };
}

// ---- Sheep: soft wool blob, plum face and legs (after the reference). ----
const SHEEP_BODY = [
  '.wwwww...',
  'wwwwwwwpp',
  'wwwwwwwpp',
  'wwwwwwww.',
  '.wwwwww..',
];
const SHEEP_LEGS = ['.p.p..p.p.', '..p.p..p..', '.p..p.p...'];
const SHEEP_GRAZE = [
  '.wwwww...',
  'wwwwwww..',
  'wwwwwwww.',
  'wwwwwwwpp',
  '.wwwwwwpp',
  '.p..p..p.',
];
const SHEEP_DOWN = ['.wwwww.', 'wwwwwww', 'wwwwwww', 'wwpppww', '.wpppw.', '..ppp..'];
const SHEEP_DOWN_LEGS = ['.p...p.', '..p.p..'];
const SHEEP_UP = ['..ppp..', '.wwpww.', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.wwwww.'];
const SHEEP_UP_LEGS = ['.p...p.', '..p.p..'];

// ---- Ducks: tiny, white, buttercup bill and feet. ----
const DUCK_SIDE = [
  ['...ww.', '...wpy', 'w..ww.', 'wwwww.', '.www..', '..y...'],
  ['...ww.', '...wpy', 'w..ww.', 'wwwww.', '.www..', '.y.y..'],
];
const DUCK_GRAZE = ['......', '......', 'w.....', 'wwwww.', '.wwwwy', '..y...'];
const DUCK_DOWN = [
  ['.ww.', 'pwwp', '.yy.', 'wwww', '.ww.', '.yy.'],
  ['.ww.', 'pwwp', '.yy.', 'wwww', '.ww.', 'y..y'],
];
const DUCK_UP = [
  ['.ww.', '.ww.', 'wwww', 'wwww', '.ww.', '.yy.'],
  ['.ww.', '.ww.', 'wwww', 'wwww', '.ww.', 'y..y'],
];

// ---- Goats: lean, horned, bearded; upright tail, longer legs. ----
const GOAT_TOP = [
  '......p...',
  '.....pp...',
  'w....pwww.',
  'w....wwpwp',
  'wwwwwwww..',
  'wppwwwwwp.',
  'wwwwwww...',
];
const GOAT_LEGS = [
  ['.p.p..p.p.', '.p.p..p.p.'],
  ['.p.p..p.p.', 'p...p.p..p'],
  ['..pp...pp.', '..pp...pp.'],
];
const GOAT_GRAZE = [
  '..........',
  '..........',
  'w.........',
  'w.........',
  'wwwwwww...',
  'wppwwwwwpp',
  'wwwwwwwwww',
  '.p.p..p.pp',
  '.p.p..p.p.',
];
const GOAT_DOWN_TOP = ['.www.', 'wpwww', 'wwwpw', 'p.w.p', '.pwp.', '.www.', '.pwp.', '..w..', '..p..'];
const GOAT_UP_TOP = ['p...p', '.pwp.', '.www.', 'wwwww', 'wpwww', 'wwwpw', '.www.', '..w..'];
const V_LEGS = ['p...p', '.p.p.'];

// ---- Cattle: big, boxy, dark; wool horns and blaze. ----
const COW_TOP = [
  '...........w.w.',
  '...........ppp.',
  'p..........pwpp',
  '.ppppppppppppwp',
  '.ppppspppppppp.',
  '.pppppppsppppp.',
  '.ppspppppppppp.',
  '..ppppppppppp..',
];
const COW_LEGS = [
  ['..pp.pp..pp.pp.', '..s..s....s.s..'],
  ['...pp.....pp...', '...ss.....ss...'],
  ['..pp.pp..pp.pp.', '...s..s..s..s..'],
];
const COW_GRAZE = [
  '...............',
  '...............',
  'p..............',
  '.pppppppppppp..',
  '.ppppspppppppw.',
  '.pppppppspppppw',
  '.ppspppppppppwp',
  '..pppppppppppps',
  '..pp.pp..pp.pp.',
  '..s..s...s..s..',
];
const COW_DOWN_TOP = ['w.....w', '.ppppp.', 'ppwppp.', '.pwpwp.', '.ppppp.', 'ppppppp', 'ppspppp', 'ppppspp', '.ppppp.'];
const COW_UP_TOP = ['w.....w', '.ppppp.', '.ppppp.', 'ppppppp', 'ppspppp', 'ppppspp', 'ppppppp', '.ppppp.', '...p...'];
const COW_V_LEGS = ['.pp.pp.', '.s...s.'];

// ---- Wild ponies: long legs, arched neck, flowing plum mane and tail. ----
const PONY_TOP = [
  '..........pp..',
  '.........pwwp.',
  '........ppwwwp',
  'pp......pww..w',
  'pwwwwwwwpw....',
  'pwwwwwwwww....',
  '.wwwwwwwwww...',
  '..wwwwwwww....',
];
const PONY_LEGS = [
  ['..w.w...w.w...', '.w...w.w...w..', '.p...p.p...p..'],
  ['...ww....ww...', '...ww....ww...', '...pp....pp...'],
  ['..w..w..w..w..', '..w..w...ww...', '..p..p...pp...'],
];
const PONY_GRAZE = [
  '..............',
  '..............',
  '..............',
  'pp............',
  'pwwwwwwwpp....',
  'pwwwwwwwwwp...',
  '.wwwwwwwwwwpw.',
  '..wwwwwwww.www',
  '..w.w...w.w...',
  '..w.w...w.w...',
  '..p.p...p.p...',
];
const PONY_DOWN_TOP = ['.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ww.'];
const PONY_UP_TOP = ['.pp.', '.pw.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', 'wwww', '.pp.'];
const PONY_V_LEGS = [
  ['w..w', 'w..w', 'p..p'],
  ['w..w', '.w.w', '.p.p'],
];

function recolor(rows: string[], from: string, to: string) {
  return rows.map((r) => r.split(from).join(to));
}

export type Coat = 0 | 1 | 2;

const cache = new Map<string, AnimalSprites>();

// `coat` gives herds some variety: ponies come in wool, dun (sage) and bay
// (plum with a wool mane); cattle in plum or wool-and-plum.
export function animalSprites(id: SpeciesId, coat: Coat = 0): AnimalSprites {
  const key = `${id}${coat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let s: AnimalSprites;
  switch (id) {
    case 'sheep':
      s = set(
        SHEEP_LEGS.map((l) => [...SHEEP_BODY, l]),
        SHEEP_GRAZE,
        SHEEP_DOWN_LEGS.map((l) => [...SHEEP_DOWN, l]),
        SHEEP_UP_LEGS.map((l) => [...SHEEP_UP, l]),
        4, 5, 3, 6,
      );
      break;
    case 'duck':
      s = set(DUCK_SIDE, DUCK_GRAZE, DUCK_DOWN, DUCK_UP, 3, 5, 2, 5);
      break;
    case 'goat': {
      const c = (rows: string[]) => (coat === 1 ? recolor(rows, 'w', 's') : rows);
      s = set(
        GOAT_LEGS.map((l) => c([...GOAT_TOP, ...l])),
        c(GOAT_GRAZE),
        V_LEGS.map((l) => c([...GOAT_DOWN_TOP, l])),
        V_LEGS.map((l) => c([...GOAT_UP_TOP, l])),
        5, 8, 2, 8,
      );
      break;
    }
    case 'cow': {
      const c = (rows: string[]) => (coat === 1 ? recolor(recolor(rows, 's', 'w'), 'p', 'p') : rows);
      s = set(
        COW_LEGS.map((l) => c([...COW_TOP, ...l])),
        c(COW_GRAZE),
        [c([...COW_DOWN_TOP, ...COW_V_LEGS]), c([...COW_DOWN_TOP, '.pp.pp.', '..s.s..'])],
        [c([...COW_UP_TOP, ...COW_V_LEGS]), c([...COW_UP_TOP, '.pp.pp.', '..s.s..'])],
        7, 9, 3, 10,
      );
      break;
    }
    case 'pony': {
      // 0 = grey (wool), 1 = dun (sage body), 2 = bay (plum body, wool mane).
      const c = (rows: string[]) => {
        if (coat === 1) return recolor(rows, 'w', 's');
        if (coat === 2) return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
        return rows;
      };
      s = set(
        PONY_LEGS.map((l) => c([...PONY_TOP, ...l])),
        c(PONY_GRAZE),
        PONY_V_LEGS.map((l) => c([...PONY_DOWN_TOP, ...l])),
        PONY_V_LEGS.map((l) => c([...PONY_UP_TOP, ...l])),
        6, 10, 1, 11,
      );
      break;
    }
  }
  cache.set(key, s);
  return s;
}
