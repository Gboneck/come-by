import { spr, type Sprite } from '../gfx/sprite';

// Coyotes: lean and low, sage coat outlined in plum so the shape reads, long
// snout, bushy tail carried low. Wolves: bigger, wool-grey with a plum
// saddle. Eyes ('y') glow above the night dither.

export interface PredatorSprites {
  side: Sprite[];
  down: Sprite[];
  up: Sprite[];
  eyeSide: [number, number]; // eye position relative to the anchor (facing right)
}

const COYOTE_TOP = [
  '...........p.p.',
  '..........pssp.',
  'pp.......psyssw',
  '.ppppppppsssww.',
  '..pssssssssp...',
  '..psssssssw....',
];
const COYOTE_LEGS = [
  ['...p.p...p.p...', '..p...p.p...p..'],
  ['....pp....pp...', '....pp....pp...'],
  ['...p..p.p..p...', '...p..p..p..p..'],
];
const COYOTE_DOWN = ['p...p', 'ps.sp', '.sss.', 'yspsy', '.sws.', '.sss.', 'ppspp', '.s.s.', 'p...p'];
const COYOTE_DOWN2 = ['p...p', 'ps.sp', '.sss.', 'yspsy', '.sws.', '.sss.', 'ppspp', '.s.s.', '.p.p.'];
const COYOTE_UP = ['p...p', 'ps.sp', '.sss.', '.sss.', 'ppspp', '.sss.', '.sss.', '..p..', 'p.p.p'];
const COYOTE_UP2 = ['p...p', 'ps.sp', '.sss.', '.sss.', 'ppspp', '.sss.', '.sss.', '..p..', '.ppp.'];

const WOLF_TOP = [
  '.............p.p.',
  '............pwwp.',
  'pp.........pwywww',
  'pwpppppppppwwwww.',
  '.pwwpppppwwwwp...',
  '..pwwwwwwwwwwp...',
  '..pwwwwwwwwww....',
];
const WOLF_LEGS = [
  ['...p.p....p.p...', '..p...p..p...p..', '..p...p..p...p..'],
  ['....pp.....pp...', '....pp.....pp...', '....pp.....pp...'],
  ['...p..p...p..p..', '...p..p...p..p..', '..p....p.p....p.'],
];
const WOLF_DOWN = ['p.....p', 'pw...wp', '.wwwww.', '.ywpwy.', '.wwwww.', '..wpw..', '.ppppp.', '.wwwww.', '.w...w.', '.p...p.'];
const WOLF_DOWN2 = ['p.....p', 'pw...wp', '.wwwww.', '.ywpwy.', '.wwwww.', '..wpw..', '.ppppp.', '.wwwww.', '.w...w.', '..p.p..'];
const WOLF_UP = ['p.....p', 'pw...wp', '.wwwww.', '.wwwww.', '.ppppp.', '.wpppw.', '.wwwww.', '.wwwww.', '...p...', '.p.p.p.'];
const WOLF_UP2 = ['p.....p', 'pw...wp', '.wwwww.', '.wwwww.', '.ppppp.', '.wpppw.', '.wwwww.', '.wwwww.', '...p...', '..ppp..'];

let cache: Record<string, PredatorSprites> = {};

export function predatorSprites(kind: 'coyote' | 'wolf'): PredatorSprites {
  if (cache[kind]) return cache[kind];
  const s: PredatorSprites =
    kind === 'coyote'
      ? {
          side: COYOTE_LEGS.map((l) => spr([...COYOTE_TOP, ...l], 7, 7)),
          down: [spr(COYOTE_DOWN, 2, 8), spr(COYOTE_DOWN2, 2, 8)],
          up: [spr(COYOTE_UP, 2, 8), spr(COYOTE_UP2, 2, 8)],
          eyeSide: [4, -5],
        }
      : {
          side: WOLF_LEGS.map((l) => spr([...WOLF_TOP, ...l], 8, 9)),
          down: [spr(WOLF_DOWN, 3, 9), spr(WOLF_DOWN2, 3, 9)],
          up: [spr(WOLF_UP, 3, 9), spr(WOLF_UP2, 3, 9)],
          eyeSide: [5, -7],
        };
  cache = { ...cache, [kind]: s };
  return s;
}
