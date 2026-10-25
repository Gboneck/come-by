import { C } from '../palette';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { rimLight } from './animals';
import { dressRows, type DogFacing, type DogLook } from './dogstyle';

// Blue heeler: teal coat flecked with wool, plum mask and ear tips, and the
// red bandana that marks the player. `y` (buttercup) swaps in for helpers.
//
// Every frame is a whole grid, so the tail, ears and spine move with the legs:
// the trot wags the tail and flops the ears, the gallop pins the ears and
// arches the back, lying down sinks through in-between poses.

// ---- Side view, facing right. 13 x 8, anchor at the feet (6, 7). ----
const SIDE_STAND = [
  '.........p.p.',
  '.t.......ttt.',
  '..ttttwtrtpt.',
  '..twttwtrttwp',
  '..ttwtttttw..',
  '...tttttt....',
  '...tt...tt...',
  '...pp...pp...',
];

// Trot: stride, pass, other stride, pass. Tail swings up, back, down, back;
// the ears flop back on the passing frames (which also bob up a pixel).
const SIDE_PASS = [
  '........p.p..',
  '.........ttt.',
  '.tttttwtrtpt.',
  '..twttwtrttwp',
  '..ttwtttttw..',
  '...tttttt....',
  '...tt...tt...',
  '...pp...pp...',
];
const SIDE_RUN = [
  [
    '.........p.p.',
    '.t.......ttt.',
    '..ttttwtrtpt.',
    '..twttwtrttwp',
    '..ttwtttttw..',
    '...tttttt....',
    '..t..t.t..t..',
    '.p....p.p...p',
  ],
  SIDE_PASS,
  [
    '.........p.p.',
    '.........ttt.',
    '..ttttwtrtpt.',
    '.ttwttwtrttwp',
    '..ttwtttttw..',
    '...tttttt....',
    '...t.t...t.t.',
    '..p...p...p.p',
  ],
  SIDE_PASS,
];

// Double-suspension gallop: stretched out in the air, front feet land,
// gathered in the air with the back arched, hind feet land and push.
// Ears pinned back, tail streaming, body a row lower and longer.
const SIDE_SPRINT = [
  [
    '.............',
    '........pp...',
    'tt.......ttt.',
    '.tttttwtrtpt.',
    '..twttwtrttwp',
    '..ttwtttttw..',
    '.tt.......tt.',
    'p..........pp',
  ],
  [
    '.............',
    '........pp...',
    't........ttt.',
    '.tttttwtrtpt.',
    '..twttwtrttwp',
    '..ttwtttttw..',
    '.t......tt...',
    'p.......pp...',
  ],
  [
    '.............',
    '........pp...',
    '....ttt..ttt.',
    '..ttttwtrtpt.',
    '.ttwttwtrttwp',
    '..ttwtttttw..',
    '....tt.tt....',
    '....pppp.....',
  ],
  [
    '.............',
    '........pp...',
    't........ttt.',
    '.tttttwtrtpt.',
    '..twttwtrttwp',
    '..ttwtttttw..',
    '...tt.....tt.',
    '...pp......pp',
  ],
];

// Bark: brace (head dips, forefeet planted wide), then the open-mouthed bark.
const SIDE_BRACE = [
  '.............',
  '.t.......p.p.',
  '..ttttwtrttt.',
  '..twttwtrtpt.',
  '..ttwtttttwwp',
  '...tttttt....',
  '...tt...t.t..',
  '...pp...p..p.',
];
const SIDE_BARK = [
  '.........p.p.',
  '.t.......ttt.',
  '..ttttwtrtpt.',
  '..twttwtrttpp',
  '..ttwtttttwww',
  '...tttttt....',
  '...tt...t.t..',
  '...pp...p..p.',
];

// Lying down: crouch, sink with the forefeet sliding out, then flat.
const SIDE_SETTLE = [
  [
    '.............',
    '.........p.p.',
    '.........ttt.',
    '..ttttwtrtpt.',
    '.ttwttwtrttwp',
    '..ttwtttttw..',
    '..ttttttt....',
    '..ppp...pp...',
  ],
  [
    '.............',
    '.............',
    '.........p.p.',
    '.........ttt.',
    '..ttttwtrtpt.',
    '.ttwttwtrttwp',
    '..ttwttttttw.',
    '..ppp.....pp.',
  ],
];
const SIDE_LIE = [
  '.............',
  '.............',
  '.........p.p.',
  '.........ttt.',
  '...tttwtrtpt.',
  '.ttwttwtrttwp',
  '..ttttttttwpp',
  '.............',
];
const SIDE_LIE_BREATH = [
  '.............',
  '.............',
  '.........p.p.',
  '....tttt.ttt.',
  '...tttwtrtpt.',
  '.ttwttwtrttwp',
  '..ttttttttwpp',
  '.............',
];
const SIDE_LIE_WAG = [
  '.............',
  '.............',
  '.........p.p.',
  '.........ttt.',
  '.t.tttwtrtpt.',
  '..twttwtrttwp',
  '..ttttttttwpp',
  '.............',
];

// ---- Facing down (towards camera). 7 x 9, anchor (3, 8). ----
const DOWN_HEAD = ['.p...p.', '.tt.tt.', '.ttttt.', '.ppwpp.', '.twwwt.', '..wpw..', '.rrrrr.', '.twttt.'];
const DOWN_FLOP = ['p.....p', ...DOWN_HEAD.slice(1)]; // ears swing out on the passing frames
const DOWN_PINNED = ['.......', '.pt.tp.', ...DOWN_HEAD.slice(2)]; // ears flat back
const DOWN_STAND = [...DOWN_HEAD, '.p...p.'];
const DOWN_RUN = [
  [...DOWN_HEAD, '.p...p.'],
  [...DOWN_FLOP, '.p..p..'],
  [...DOWN_HEAD, '.p...p.'],
  [...DOWN_FLOP, '..p..p.'],
];
const DOWN_SPRINT = [
  [...DOWN_PINNED, 'p.....p'],
  [...DOWN_PINNED, '.p...p.'],
  [...DOWN_PINNED, '..ppp..'],
  [...DOWN_PINNED, '.p...p.'],
];
const DOWN_BRACE = [...DOWN_PINNED, 'p.....p'];
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
const DOWN_SETTLE = [
  ['.......', '.p...p.', '.tt.tt.', '.ttttt.', '.ppwpp.', '.twwwt.', '..wpw..', '.rrrrr.', 'tp...pt'],
];
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
const DOWN_LIE_BREATH = [
  '.......',
  '.......',
  '.p...p.',
  '.tt.tt.',
  'ttttttt',
  '.ppwpp.',
  'ttwwwtt',
  'trwpwrt',
  'pprrrpp',
];
const DOWN_LIE_WAG = [
  '.......',
  '.......',
  '.p...p.',
  '.tt.tt.',
  '.ttttt.',
  '.ppwppt',
  'ttwwwtt',
  'trwpwrt',
  'pprrrpp',
];

// ---- Facing up (away). 7 x 11, anchor (3, 9). ----
const upBody = (ears: string, tail: string) => [ears, '.tt.tt.', '.ttttt.', '..ttt..', '.rrrrr.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', tail];
const UP_STAND = [...upBody('.p...p.', '...t...'), '.p...p.'];
const UP_RUN = [
  [...upBody('.p...p.', '..t....'), '.p...p.'],
  [...upBody('p.....p', '...t...'), '.p..p..'],
  [...upBody('.p...p.', '....t..'), '.p...p.'],
  [...upBody('p.....p', '...t...'), '..p..p.'],
];
const UP_PINNED = ['.......', '.pt.tp.', '.ttttt.', '..ttt..', '.rrrrr.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '...t...'];
const UP_SPRINT = [
  [...UP_PINNED, 'p.....p'],
  [...UP_PINNED, '.p...p.'],
  [...UP_PINNED, '..p.p..'],
  [...UP_PINNED, '.p...p.'],
];
const UP_BRACE = ['.......', '.p...p.', '.tt.tt.', '.ttttt.', '.rrrrr.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '...t...', '.p...p.'];
// Head thrown up: one row taller, anchor one row lower.
const UP_BARK = ['p.....p', '.tt.tt.', '.ttttt.', '..ttt..', '..ttt..', '.rrrrr.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '...t...', '.p...p.'];
const UP_SETTLE = [
  ['.......', '.p...p.', '.tt.tt.', '.ttttt.', '..ttt..', '.rrrrr.', 'ptwtwtp', '.ttwtt.', '.twttt.', '..ttt..', '...t...'],
];
const upLie = (ribs: string, tail: string) => ['.......', '.......', '.p...p.', '.tt.tt.', '.ttttt.', '.trrrt.', 'ptwtwtp', ribs, '.twttt.', '..ttt..', tail];
const UP_LIE = upLie('.ttwtt.', '...tt..');
const UP_LIE_BREATH = upLie('tttwttt', '...tt..');
const UP_LIE_WAG = upLie('.ttwtt.', '..tt...');

// One facing's full set of poses.
export interface DogPoses {
  stand: Sprite;
  run: Sprite[];
  sprint: Sprite[];
  brace: Sprite;
  bark: Sprite;
  settle: Sprite[]; // standing -> lying, in order
  lie: Sprite;
  lieBreath: Sprite;
  lieWag: Sprite;
}

export interface DogSprites {
  poses: { side: DogPoses; down: DogPoses; up: DogPoses };
  // Flat names, used by the ?sprites sheet.
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

// Bob (pixels) per frame of the run and sprint cycles: up on the passing
// frames of the trot, up during both suspensions of the gallop.
export const RUN_BOB = [0, -1, 0, -1];
export const SPRINT_BOB = [-1, 0, -1, 0];

function recolor(rows: string[], bandana: string): string[] {
  return bandana === 'r' ? rows : rows.map((r) => r.replace(/r/g, bandana));
}

// `look` dresses the player's dog (markings, neck piece; see dogstyle.ts).
export function makeDogSprites(bandana: 'r' | 'y' = 'r', look?: DogLook): DogSprites {
  let facing: DogFacing = 'side';
  // Dressed first, then the sun catches the top of the coat on the far
  // side: a sage rim.
  const S = (rows: string[], ax: number, ay: number) => spr(rimLight(recolor(look ? dressRows(rows, facing, look) : rows, bandana), 't', 's', false), ax, ay);
  const side: DogPoses = {
    stand: S(SIDE_STAND, 6, 7),
    run: SIDE_RUN.map((f) => S(f, 6, 7)),
    sprint: SIDE_SPRINT.map((f) => S(f, 6, 7)),
    brace: S(SIDE_BRACE, 6, 7),
    bark: S(SIDE_BARK, 6, 7),
    settle: SIDE_SETTLE.map((f) => S(f, 6, 7)),
    lie: S(SIDE_LIE, 6, 7),
    lieBreath: S(SIDE_LIE_BREATH, 6, 7),
    lieWag: S(SIDE_LIE_WAG, 6, 7),
  };
  facing = 'down';
  const down: DogPoses = {
    stand: S(DOWN_STAND, 3, 8),
    run: DOWN_RUN.map((f) => S(f, 3, 8)),
    sprint: DOWN_SPRINT.map((f) => S(f, 3, 8)),
    brace: S(DOWN_BRACE, 3, 8),
    bark: S(DOWN_BARK, 3, 8),
    settle: DOWN_SETTLE.map((f) => S(f, 3, 8)),
    lie: S(DOWN_LIE, 3, 8),
    lieBreath: S(DOWN_LIE_BREATH, 3, 8),
    lieWag: S(DOWN_LIE_WAG, 3, 8),
  };
  facing = 'up';
  const up: DogPoses = {
    stand: S(UP_STAND, 3, 9),
    run: UP_RUN.map((f) => S(f, 3, 9)),
    sprint: UP_SPRINT.map((f) => S(f, 3, 9)),
    brace: S(UP_BRACE, 3, 9),
    bark: S(UP_BARK, 3, 10),
    settle: UP_SETTLE.map((f) => S(f, 3, 9)),
    lie: S(UP_LIE, 3, 9),
    lieBreath: S(UP_LIE_BREATH, 3, 9),
    lieWag: S(UP_LIE_WAG, 3, 9),
  };
  return {
    poses: { side, down, up },
    side: side.run,
    gallop: side.sprint,
    sideStand: side.stand,
    sideLie: side.lie,
    sideBark: side.bark,
    down: down.run,
    downStand: down.stand,
    downLie: down.lie,
    downBark: down.bark,
    up: up.run,
    upStand: up.stand,
    upLie: up.lie,
  };
}

// ---- Asleep: curled nose to tail while the day runs on (resting). ----
// Facing right, 13 x 8, anchor at the feet (6, 7) like the other poses.
const curlRows = (back: string) => [
  '.............',
  '.............',
  '........p.p..',
  back,
  '..ttwtttttpt.',
  '.tttttttrttww',
  '.ttwtttttttp.',
  '..ttttttwww..',
];
const CURL = curlRows('...tttt.ttt..');
const CURL_BREATH = curlRows('..ttttt.ttt..');

let curl: Sprite[] | null = null;

export function drawSleepingDog(g: CanvasRenderingContext2D, x: number, y: number, flip: boolean, t: number) {
  curl ??= [spr(rimLight(CURL, 't', 's', false), 6, 7), spr(rimLight(CURL_BREATH, 't', 's', false), 6, 7)];
  drawSpr(g, curl[t % 2.4 > 1.6 ? 1 : 0], x, y + 2, flip);
}

// Little z's drifting up from the sleeping dog, growing as they rise.
const ZS = [['####', '..#.', '.#..', '####'], ['####', '..#.', '.#..', '####'], ['#####', '...#.', '..#..', '.#...', '#####']];
export function drawSnores(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.fillStyle = C.wool;
  for (let k = 0; k < 2; k++) {
    const u = (t * 0.5 + k / 2) % 1;
    const z = ZS[Math.min(2, Math.floor(u * 3))];
    if (u > 0.85 && Math.floor(t * 10) % 2) continue;
    const zx = Math.round(x + 4 + u * 8 + Math.sin((t + k) * 2) * 1.5), zy = Math.round(y - 8 - u * 14);
    z.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && g.fillRect(zx + i, zy + j, 1, 1)));
  }
}
