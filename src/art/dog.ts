import { spr, type Sprite } from '../gfx/sprite';

// Blue heeler: teal coat flecked with wool, plum mask and ear tips, and the
// red bandana that marks the player. `y` (buttercup) swaps in for helpers.

// ---- Side view, facing right. 13 x 8, anchor at the feet. ----
const SIDE_TOP = [
  '.........p.p.',
  '.t.......ttt.',
  '..ttttwtrtpt.',
  '..twttwtrttwp',
  '..ttwtttttw..',
  '...tttttt....',
];
const SIDE_LEGS: string[][] = [
  ['..t..t.t..t..', '.p....p.p...p'], // stride
  ['...tt...tt...', '...pp...pp...'], // pass
  ['...t.t...t.t.', '..p...p...p.p'], // stride (other pair)
  ['...tt...tt...', '...pp...pp...'], // pass
];
const SIDE_STAND = ['...tt...tt...', '...pp...pp...'];

const GALLOP_TOP = [
  '.............',
  '.........p.p.',
  't........ttt.',
  '.tttttwtrtpt.',
  '..twttwtrttwp',
  '..ttwtttttw..',
];
const GALLOP_LEGS: string[][] = [
  ['.tt......tt..', 'p.........pp.'], // stretched
  ['...tt..tt....', '....pppp.....'], // gathered
  ['..t......t...', '.p.......p...'],
  ['...tt..tt....', '....pppp.....'],
];

const LIE = [
  '.............',
  '.............',
  '.........p.p.',
  '.........ttt.',
  '...tttwtrtpt.',
  '.ttwttwtrttwp',
  '..ttttttttwpp',
  '.............',
];

const BARK_TOP = [
  '.........p.p.',
  '.t.......ttt.',
  '..ttttwtrtpt.',
  '..twttwtrttpp',
  '..ttwtttttwww',
  '...tttttt....',
];

// ---- Facing down (towards camera). 7 x 9. ----
const DOWN_TOP = [
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '.ppwpp.',
  '.twwwt.',
  '..wpw..',
  '.rrrrr.',
  '.twttt.',
];
const DOWN_LEGS = ['.p...p.', '.p..p..', '.p...p.', '..p..p.'];
const DOWN_LIE = [
  '.......',
  '.......',
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '.ppwpp.',
  'ttwwwtt',
  'trwpwrt',
  'pprrrpp',
];
const DOWN_BARK = [
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '.ppwpp.',
  '.twwwt.',
  '.twpwt.',
  '.rpppr.',
  '.twwwt.',
  '.p...p.',
];

// ---- Facing up (away). 7 x 11. ----
const UP_TOP = [
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '..ttt..',
  '.rrrrr.',
  '.twtwt.',
  '.ttwtt.',
  '.twttt.',
  '..ttt..',
  '...t...',
];
const UP_LEGS = ['.p...p.', '.p..p..', '.p...p.', '..p..p.'];
const UP_LIE = [
  '.......',
  '.......',
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '.trrrt.',
  'ptwtwtp',
  '.ttwtt.',
  '.twttt.',
  '..ttt..',
  '...tt..',
];

export interface DogSprites {
  side: Sprite[];
  gallop: Sprite[];
  sideStand: Sprite;
  sideLie: Sprite;
  sideBark: Sprite;
  down: Sprite[];
  downStand: Sprite;
  downLie: Sprite;
  downBark: Sprite;
  up: Sprite[];
  upStand: Sprite;
  upLie: Sprite;
}

function recolor(rows: string[], bandana: string): string[] {
  return bandana === 'r' ? rows : rows.map((r) => r.replace(/r/g, bandana));
}

export function makeDogSprites(bandana: 'r' | 'y' = 'r'): DogSprites {
  const S = (rows: string[], ax: number, ay: number) => spr(recolor(rows, bandana), ax, ay);
  return {
    side: SIDE_LEGS.map((l) => S([...SIDE_TOP, ...l], 6, 7)),
    gallop: GALLOP_LEGS.map((l) => S([...GALLOP_TOP, ...l], 6, 7)),
    sideStand: S([...SIDE_TOP, ...SIDE_STAND], 6, 7),
    sideLie: S(LIE, 6, 7),
    sideBark: S([...BARK_TOP, ...SIDE_STAND], 6, 7),
    down: DOWN_LEGS.map((l) => S([...DOWN_TOP, l], 3, 8)),
    downStand: S([...DOWN_TOP, '.p...p.'], 3, 8),
    downLie: S(DOWN_LIE, 3, 8),
    downBark: S(DOWN_BARK, 3, 8),
    up: UP_LEGS.map((l) => S([...UP_TOP, l], 3, 9)),
    upStand: S([...UP_TOP, '.p...p.'], 3, 9),
    upLie: S(UP_LIE, 3, 9),
  };
}
