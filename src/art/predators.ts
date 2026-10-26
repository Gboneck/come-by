import { spr, type Sprite } from '../gfx/sprite';

// Coyotes: lean, sage, outlined in plum so the shape reads, big ears, a long
// snout and a bushy tail with a dark tip. Wolves: bigger and heavier,
// wool-grey with a plum saddle, a blocky muzzle and a ruff.
//
// Side grids face right (drawn mirrored for left), down grids face the
// camera, up grids face away. Each pose is put together once from parts
// (body, head, legs) and cached. 'e' marks an eye: buttercup by day, and
// where a glint goes above the night dither (in a side view the far eye
// glints two pixels behind the near one). The red bandana colour is never
// used here: it belongs to the player.

export interface PFrame {
  s: Sprite;
  eyes: number[]; // glints as dx, dy pairs from the anchor, facing right
}

export interface FacingSet {
  stand: PFrame;
  creep: PFrame[]; // stalking, low
  run: PFrame[]; // the rush
  flee: PFrame[];
  carry: PFrame[];
}

export interface PredatorSprites {
  stand: PFrame;
  creep: PFrame[];
  rush: PFrame[];
  flee: PFrame[];
  carry: PFrame[];
  dig: PFrame[];
  howl: PFrame[]; // sitting, head level; head thrown back; mouth open
  down: FacingSet;
  up: FacingSet;
}

type Grid = string[];
type Stroke = [number, number, string?];

function put(m: string[], x: number, y: number, c: string) {
  if (y < 0 || y >= m.length || x < 0) return;
  const r = m[y].padEnd(x + 1, '.');
  m[y] = r.slice(0, x) + c + r.slice(x + 1);
}

// Lay parts over each other ('.' is clear), then single pixels on top.
function frame(h: number, parts: [Grid, number, number][], strokes: Stroke[] = []): Grid {
  const m: string[] = Array.from({ length: h }, () => '');
  for (const [rows, ox, oy] of parts)
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(m, x + ox, y + oy, r[x]);
    });
  for (const [x, y, c] of strokes) put(m, x, y, c ?? 'p');
  return m;
}

const at = (dx: number, dy: number, pts: [number, number][]): Stroke[] => pts.map(([x, y]) => [x + dx, y + dy, 'p']);

// A stalking leg in three rows (thigh, shin, paw), six phases: planted
// forward, under, back, lifting, carried, reaching. Paw null = lifted.
const CREEP_STEP: [number, number, number | null][] = [[0, 1, 1], [0, 0, 0], [0, -1, -1], [-1, -1, null], [0, 0, null], [1, 1, null]];
function creepLeg(L: Stroke[], bx: number, y0: number, k: number, near: boolean) {
  const [a, b, c] = CREEP_STEP[((k % 6) + 6) % 6];
  L.push([bx + a, y0, near ? 's' : 'p'], [bx + b, y0 + 1, 'p']);
  if (c !== null) L.push([bx + c, y0 + 2, 'p']);
}

// A short dragging step in two rows, four phases.
const DRAG_STEP: [number, number, boolean][] = [[0, 1, false], [0, 0, false], [0, -1, false], [0, 0, true]];
function dragLeg(L: Stroke[], bx: number, y0: number, k: number, near: boolean) {
  const [kd, fd, up] = DRAG_STEP[((k % 4) + 4) % 4];
  L.push([bx + kd, y0, near ? 's' : 'p'], [bx + fd, up ? y0 : y0 + 1, 'p']);
}

// The gallop, four frames of leg strokes from the hip / the shoulder:
// stretched out, fore strike, gathered under, hind push.
const GALLOP_HIND: [number, number][][] = [
  [[0, 0], [-1, 1], [-2, 2], [1, 0], [0, 1]],
  [[1, 0], [2, 1], [0, 0], [1, 1]],
  [[1, 0], [2, 1], [3, 2], [0, 0], [1, 1]],
  [[0, 0], [0, 1], [-1, 2], [1, 0], [1, 1], [1, 2]],
];
const GALLOP_FORE: [number, number][][] = [
  [[0, 0], [1, 1], [2, 2], [-1, 0], [0, 1]],
  [[0, 0], [0, 1], [0, 2], [-1, 0], [-1, 1], [-2, 2]],
  [[-1, 0], [-2, 1], [-3, 2], [0, 0], [-1, 1]],
  [[0, 0], [1, 1], [-1, 0], [0, 1]],
];

interface Rig {
  stand: Grid;
  creepTop: Grid;
  creepH: number;
  creepLegs: [number, number, number, number, number]; // far hind, far fore, near hind, near fore x; leg top y
  carryTop: Grid;
  carryH: number;
  carryLegs: [number, number, number, number, number];
  runBody: Grid;
  archBody: Grid;
  fleeBody: Grid;
  pinHead: Grid;
  run: { h: number; head: number; hind: number; fore: number; belly: number }; // head x, legs x, rows to the legs
  flee: { h: number; head: number; hind: number; fore: number; foreY: number; hindY: number };
  digBody: Grid;
  digPaws: [number, number][][];
  howl: Grid[];
  anchor: { stand: number; creep: number; run: number; flee: number; carry: number; dig: number; howl: number; front: number };
  down: { stand: Grid; creep: Grid[]; run: Grid[]; flee: Grid[] };
  up: { stand: Grid; creep: Grid[]; run: Grid[]; flee: Grid[] };
}

// ---- Coyote ----

const COYOTE: Rig = {
  stand: [
    '..........p.p....',
    '.........pspsp...',
    '.........pssesp..',
    '........psssssswp',
    '..pppppppswwwppp.',
    '.pssssssssswp....',
    'psspsswwsssp.....',
    'pss.sp..ps.p.....',
    'psp.s.p.p..p.....',
    '.p..p.p.p..p.....',
  ],
  creepTop: [
    '............p.p..',
    '.......pp..pspsp.',
    '..pppppsspppssesp',
    'ppsssssssssssssswp',
    'psppsswwsswwppppp',
    'ps',
    '.p',
  ],
  creepH: 8,
  creepLegs: [5, 10, 3, 9, 5],
  carryTop: [
    '...........p.p..',
    '..........pspsp.',
    '..........pssesp',
    '.........psssssswp',
    '.........pswwppp.',
    '......ppppsswp...',
    '..ppppssssssp....',
    '.psssswwwsssp....',
    'ps.p',
    'p..',
  ],
  carryH: 10,
  carryLegs: [5, 10, 4, 9, 8],
  runBody: [
    '...pppppppppp',
    'pssssssssssss',
    '.ppsswwwwssss',
  ],
  archBody: [
    '.....ppp.....',
    '...ppsssppppp',
    'pssssssssssss',
    '.ppsswwwwssss',
  ],
  fleeBody: [
    '.......pppppp',
    '....pppssssss',
    '..ppsssssssss',
    '..psssswwwsss',
    '...ps........',
    '...pp........',
  ],
  pinHead: [
    '.ppp....',
    'psssep..',
    'ssssswwp',
    'pwwpppp.',
  ],
  run: { h: 8, head: 12, hind: 4, fore: 11, belly: 3 },
  flee: { h: 8, head: 12, hind: 4, fore: 11, foreY: 4, hindY: 5 },
  digBody: [
    'pp.................',
    'pssp...............',
    '.pssppp............',
    '..psssspppp........',
    '..pssssssssp.......',
    '..pssswwssssp.p.p..',
    '..ps.p..psssppspsp.',
    '..ps.p..pssssssesp.',
    '..ps.p..pspsssssswp',
    '..p..p..p.p.pwwppp.',
    '..p..p..p..........',
  ],
  digPaws: [
    [[11, 10], [12, 10], [13, 10]],
    [[10, 10]],
    [[9, 10], [10, 10]],
  ],
  howl: [
    [
      '.........p.p..',
      '........pspsp.',
      '........pssesp',
      '.......psssssswp',
      '.......pswwppp.',
      '.......psswp...',
      '......pssswp...',
      '....ppssssp....',
      '..ppsssssp.....',
      '.pssssspsp.p...',
      'pppppppsp.pp...',
    ],
    [
      '..........p..',
      '.........psp.',
      '.........pswp',
      '........psswp',
      '.......pseswp',
      '......ppsswp.',
      '.......psswp.',
      '......psssswp',
      '....ppsssssp.',
      '..ppsssssp.p.',
      '.pssssspsp.p.',
      'pppppppsp.pp.',
    ],
    [
      '.........pp..',
      '........ps.p.',
      '........psp.p',
      '........pswwp',
      '.......pseswp',
      '......ppsswp.',
      '.......psswp.',
      '......psssswp',
      '....ppsssssp.',
      '..ppsssssp.p.',
      '.pssssspsp.p.',
      'pppppppsp.pp.',
    ],
  ],
  anchor: { stand: 7, creep: 7, run: 8, flee: 8, carry: 7, dig: 8, howl: 7, front: 3 },
  down: {
    stand: [
      '.p...p.',
      'psp.psp',
      'psspssp',
      'psssssp',
      'sessses',
      'pswwwsp',
      '.pwpwp.',
      '.pswsp.',
      'psswssp',
      '.p.s.p.',
      '.p...p.',
    ],
    creep: [
      [
        '..ppp..',
        'p.psp.p',
        'ps.s.sp',
        'psssssp',
        'sessses',
        'pswwwsp',
        'ppwpwpp',
        'ps...sp',
        'p.....p',
      ],
      [
        '..ppp..',
        'p.psp.p',
        'ps.s.sp',
        'psssssp',
        'sessses',
        'pswwwsp',
        'ppwpwpp',
        'ps...pp',
        'p......',
      ],
      [
        '..ppp..',
        'p.psp.p',
        'ps.s.sp',
        'psssssp',
        'sessses',
        'pswwwsp',
        'ppwpwpp',
        'ps...sp',
        'p.....p',
      ],
      [
        '..ppp..',
        'p.psp.p',
        'ps.s.sp',
        'psssssp',
        'sessses',
        'pswwwsp',
        'ppwpwpp',
        'pp...sp',
        '......p',
      ],
    ],
    run: [
      [
        '.......',
        'pp...pp',
        '.psssp.',
        'psssssp',
        'sessses',
        'pswwwsp',
        '.pwpwp.',
        '.pswsp.',
        'ps.s.p.',
        'p......',
      ],
      [
        '.......',
        'pp...pp',
        '.psssp.',
        'psssssp',
        'sessses',
        'pswwwsp',
        '.pwpwp.',
        '.pswsp.',
        '.p.s.sp',
        '......p',
      ],
    ],
    flee: [
      [
        '.......',
        '.ppppp.',
        'psssssp',
        'sessses',
        'pswwwsp',
        '.pwpwp.',
        '.pswsp.',
        'ps.s.p.',
        'p......',
      ],
      [
        '.......',
        '.ppppp.',
        'psssssp',
        'sessses',
        'pswwwsp',
        '.pwpwp.',
        '.pswsp.',
        '.p.s.sp',
        '......p',
      ],
    ],
  },
  up: {
    stand: [
      '.p...p.',
      'psp.psp',
      'psspssp',
      'psssssp',
      '.psssp.',
      'psssssp',
      'psspssp',
      'ps.s.sp',
      '.p.s.p.',
      '.p.p.p.',
      '...p...',
    ],
    creep: [
      [
        '.p...p.',
        'psp.psp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'ps.s.sp',
        'p.psp.p',
        'p..p..p',
      ],
      [
        '.p...p.',
        'psp.psp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'ps.s.pp',
        'p.psp..',
        'p..p...',
      ],
      [
        '.p...p.',
        'psp.psp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'ps.s.sp',
        'p.psp.p',
        'p..p..p',
      ],
      [
        '.p...p.',
        'psp.psp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'pp.s.sp',
        '..psp.p',
        '...p..p',
      ],
    ],
    run: [
      [
        'pp...pp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'ps.s.sp',
        'p.psp.p',
        'p..s...',
        '...p...',
      ],
      [
        'pp...pp',
        '.psssp.',
        'psssssp',
        'psspssp',
        'psssssp',
        'ps.s.sp',
        'p.psp.p',
        '...s..p',
        '...p...',
      ],
    ],
    flee: [
      [
        'pp...pp',
        '.psssp.',
        'psssssp',
        'psspssp',
        '.psssp.',
        'ps...sp',
        'p.....p',
      ],
      [
        'pp...pp',
        '.psssp.',
        'psssssp',
        'psspssp',
        '.psssp.',
        'ps...pp',
        'p......',
      ],
    ],
  },
};

// ---- Wolf ----

const WOLF: Rig = {
  stand: [
    '...........p..p....',
    '..........pwppwp...',
    '..........pwwwwwep.',
    '.........pwwwwwwwwwp',
    '...ppppppppwwwwwssp.',
    '..ppppppppwwwwpppp..',
    '.pwwwwwwwwwwwwp.....',
    'pwwpwssssssswp......',
    'pww.wp...pw.p.......',
    'psp.w.p..p..p.......',
    '.p..p.p..p..p.......',
  ],
  creepTop: [
    '.............p..p..',
    '........ppp.pwppwp.',
    '..ppppppwwwppwwwwwep',
    '.ppppppppwwwwwwwwwwwp',
    'ppwwwwwwwwwwwwwwwssp',
    'pwpwwsssssswwwpppp..',
    'pw',
    '.p',
  ],
  creepH: 9,
  creepLegs: [6, 12, 4, 11, 6],
  carryTop: [
    '............p..p..',
    '...........pwppwp.',
    '...........pwwwwep',
    '..........pwwwwwwwwp',
    '......ppppwwwwsspp.',
    '...pppppppwwwpppp..',
    '.ppwwwwwwwwwwp.....',
    'pwpwwssssswwp......',
    'pw.p',
    'p',
  ],
  carryH: 10,
  carryLegs: [6, 11, 5, 10, 8],
  runBody: [
    '...ppppppppppp',
    'ppppppppppppww',
    'pwwwwwwwwwwwww',
    '.pppwsssssswww',
  ],
  archBody: [
    '.....ppp......',
    '...ppppppppppp',
    'ppppppppppppww',
    'pwwwwwwwwwwwww',
    '.pppwsssssswww',
  ],
  fleeBody: [
    '........ppppppp',
    '.....pppppppppw',
    '...ppppppwwwwww',
    '..pwwwwwwwwwwww',
    '..pwwwssssswwww',
    '...pw..........',
    '...pp..........',
  ],
  pinHead: [
    '.pppp....',
    'pwwwwep..',
    'wwwwwwwwp',
    'pwwwpppp.',
  ],
  run: { h: 9, head: 13, hind: 4, fore: 12, belly: 4 },
  flee: { h: 9, head: 13, hind: 4, fore: 12, foreY: 5, hindY: 6 },
  digBody: [
    'pp.....................',
    'pwwp...................',
    '.pwwpppp...............',
    '..pwppppppp............',
    '..pwwwwppppppp.........',
    '..pwwwwwwwwwwwp.p..p...',
    '..pwwssssswwwwppwppwp..',
    '..pw.p...pwwwwwwwwwwep.',
    '..pw.p...pwpwwwwwwwwwwp',
    '..p..p...p.p.pwwwsssp..',
    '..p..p...p....pppppp...',
    '..p..p...p.............',
  ],
  digPaws: [
    [[12, 11], [13, 11], [14, 11]],
    [[11, 11]],
    [[10, 11], [11, 11]],
  ],
  howl: [
    [
      '..........p..p...',
      '.........pwppwp..',
      '.........pwwwwep.',
      '........pwwwwwwwwp',
      '........pwwwsssp..',
      '........pwwwppp...',
      '.......ppwwwp.....',
      '......pppwwwsp....',
      '....ppppwwwwsp....',
      '..pppwwwwwwwp.....',
      '.pwwwwwwwpwp.p....',
      'pppppppppwp.pp....',
    ],
    [
      '...........pp..',
      '..........pwwp.',
      '..........pwwsp',
      '.........pwwwsp',
      '........pwewwsp',
      '.......ppwwwsp.',
      '........pwwwsp.',
      '.......ppwwwwsp',
      '......pppwwwwsp',
      '....ppppwwwwwp.',
      '..pppwwwwwwwp..',
      '.pwwwwwwwpwp.p.',
      'pppppppppwp.pp.',
    ],
    [
      '..........pp...',
      '..........pw.p.',
      '..........pwp.p',
      '.........pwwwsp',
      '........pwewwsp',
      '.......ppwwwsp.',
      '........pwwwsp.',
      '.......ppwwwwsp',
      '......pppwwwwsp',
      '....ppppwwwwwp.',
      '..pppwwwwwwwp..',
      '.pwwwwwwwpwp.p.',
      'pppppppppwp.pp.',
    ],
  ],
  anchor: { stand: 8, creep: 8, run: 9, flee: 9, carry: 8, dig: 9, howl: 8, front: 4 },
  down: {
    stand: [
      '.p.....p.',
      'pwp...pwp',
      'pwwpppwwp',
      'pwwwwwwwp',
      'pwewwwewp',
      '.pwwwwwp.',
      '..wwpww..',
      '..pwwwp..',
      '.pppwppp.',
      'pwwwwwwwp',
      'pws.w.swp',
      '.p.....p.',
      '.p.....p.',
    ],
    creep: [
      [
        '...ppp...',
        '.p.pwp.p.',
        'pwppwppwp',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        'ppwwpwwpp',
        'pw.....wp',
        'p.......p',
      ],
      [
        '...ppp...',
        '.p.pwp.p.',
        'pwppwppwp',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        'ppwwpwwpp',
        'pw.....pp',
        'p........',
      ],
      [
        '...ppp...',
        '.p.pwp.p.',
        'pwppwppwp',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        'ppwwpwwpp',
        'pw.....wp',
        'p.......p',
      ],
      [
        '...ppp...',
        '.p.pwp.p.',
        'pwppwppwp',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        'ppwwpwwpp',
        'pp.....wp',
        '........p',
      ],
    ],
    run: [
      [
        '.........',
        'pp.....pp',
        '.pwwwwwp.',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        '..wwpww..',
        '..pwwwp..',
        '.pppwppp.',
        'pws.w.wp.',
        'p......p.',
        'p........',
      ],
      [
        '.........',
        'pp.....pp',
        '.pwwwwwp.',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        '..wwpww..',
        '..pwwwp..',
        '.pppwppp.',
        '.pw.w.swp',
        '.p......p',
        '........p',
      ],
    ],
    flee: [
      [
        '.........',
        '.ppppppp.',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        '..wwpww..',
        '..pwwwp..',
        '.pppwppp.',
        'pws.w.wp.',
        'p......p.',
        'p........',
      ],
      [
        '.........',
        '.ppppppp.',
        'pwwwwwwwp',
        'pwewwwewp',
        '.pwwwwwp.',
        '..wwpww..',
        '..pwwwp..',
        '.pppwppp.',
        '.pw.w.swp',
        '.p......p',
        '........p',
      ],
    ],
  },
  up: {
    stand: [
      '.p.....p.',
      'pwp...pwp',
      'pwwpppwwp',
      'pwwwwwwwp',
      '.pwwwwwp.',
      'ppppppppp',
      'pwpppppwp',
      'pwwwpwwwp',
      'pww.w.wwp',
      '.p..w..p.',
      '.p..w..p.',
      '....p....',
    ],
    creep: [
      [
        '.p.....p.',
        'pwp...pwp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'pww.w.wwp',
        'p..pwp..p',
        'p...p...p',
      ],
      [
        '.p.....p.',
        'pwp...pwp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'pww.w.wpp',
        'p..pwp...',
        'p...p....',
      ],
      [
        '.p.....p.',
        'pwp...pwp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'pww.w.wwp',
        'p..pwp..p',
        'p...p...p',
      ],
      [
        '.p.....p.',
        'pwp...pwp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'ppw.w.wwp',
        '...pwp..p',
        '....p...p',
      ],
    ],
    run: [
      [
        'pp.....pp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'pww.w.wwp',
        'p..pwp..p',
        'p...w....',
        '....w....',
        '....p....',
      ],
      [
        'pp.....pp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        'pww.w.wwp',
        'p..pwp..p',
        '....w...p',
        '....w....',
        '....p....',
      ],
    ],
    flee: [
      [
        'pp.....pp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        '.pwwwwwp.',
        'pw.....wp',
        'p.......p',
      ],
      [
        'pp.....pp',
        '.pwwwwwp.',
        'ppppppppp',
        'pwpppppwp',
        'pwwwpwwwp',
        '.pwwwwwp.',
        'pw.....pp',
        'p........',
      ],
    ],
  },
};

// ---- Building ----

// Turn eye marks into glint offsets (from the anchor at the feet).
function build(rows: Grid, ax: number): PFrame {
  const ay = rows.length - 1;
  const eyes: number[] = [];
  const clean = rows.map((r, y) =>
    r.replace(/e/g, (_c, x: number) => {
      eyes.push(x - ax, y - ay);
      return 'y';
    }),
  );
  // One eye marked (a side view): the far one glints two pixels behind it,
  // if that is still on the head.
  if (eyes.length === 2) {
    const x = eyes[0] + ax, y = eyes[1] + ay;
    if ('sw'.includes(rows[y][x - 2] ?? '.')) eyes.push(eyes[0] - 2, eyes[1]);
  }
  return { s: spr(clean, ax, ay), eyes };
}

function makeSet(R: Rig): PredatorSprites {
  const A = R.anchor;
  const [ch, cf, cnh, cnf, cy] = R.creepLegs;
  const creep = [0, 1, 2, 3, 4, 5].map((k) => {
    const L: Stroke[] = [];
    creepLeg(L, ch, cy, k + 3, false);
    creepLeg(L, cf, cy, k + 5, false);
    creepLeg(L, cnh, cy, k, true);
    creepLeg(L, cnf, cy, k + 2, true);
    return build(frame(R.creepH, [[R.creepTop, 0, 0]], L), A.creep);
  });
  const [dh, df, dnh, dnf, dy] = R.carryLegs;
  const carry = [0, 1, 2, 3].map((k) => {
    const L: Stroke[] = [];
    dragLeg(L, dh, dy, k + 2, false);
    dragLeg(L, df, dy, k + 3, false);
    dragLeg(L, dnh, dy, k, true);
    dragLeg(L, dnf, dy, k + 1, true);
    return build(frame(R.carryH, [[R.carryTop, 0, 0]], L), A.carry);
  });
  const G = R.run;
  // Extended frame rides a row higher (airborne); gathered uses the arched back.
  const rush = [0, 1, 2, 3].map((k) => {
    const by = k === 0 ? 1 : 2;
    const body = k === 2 ? R.archBody : R.runBody;
    const bodyY = k === 2 ? by - 1 : by;
    const legY = by + G.belly;
    return build(
      frame(G.h, [[body, 0, bodyY], [R.pinHead, G.head, by - 1]], [...at(G.hind, legY, GALLOP_HIND[k]), ...at(G.fore, legY, GALLOP_FORE[k])]),
      A.run,
    );
  });
  // Fleeing: rump down, tail clamped under, ears flat; a low scramble on
  // bent hind legs.
  const F = R.flee;
  const flee = [0, 1, 2, 3].map((k) =>
    build(
      frame(F.h, [[R.fleeBody, 0, 1], [R.pinHead, F.head, 0]], [
        ...at(F.hind, 1 + F.hindY, GALLOP_HIND[k].filter(([, y]) => y < 2)),
        ...at(F.fore, 1 + F.foreY, GALLOP_FORE[k]),
      ]),
      A.flee,
    ),
  );
  const dig = R.digPaws.map((paws) => build(frame(R.digBody.length, [[R.digBody, 0, 0]], at(0, 0, paws)), A.dig));
  const howl = R.howl.map((g) => build(g, A.howl));
  const facing = (F0: Rig['down']): FacingSet => {
    const st = build(F0.stand, A.front);
    const list = (gs: Grid[]) => (gs.length ? gs.map((g) => build(g, A.front)) : [st]);
    return { stand: st, creep: list(F0.creep), run: list(F0.run), flee: list(F0.flee), carry: [st] };
  };
  return {
    stand: build(R.stand, A.stand),
    creep,
    rush,
    flee,
    carry,
    dig,
    howl,
    down: facing(R.down),
    up: facing(R.up),
  };
}

const cache: Partial<Record<'coyote' | 'wolf', PredatorSprites>> = {};

export function predatorSprites(kind: 'coyote' | 'wolf'): PredatorSprites {
  return (cache[kind] ??= makeSet(kind === 'wolf' ? WOLF : COYOTE));
}
