import type { Sprite } from '../gfx/sprite';
import { spr2 } from './hd';

// Coyotes and wolves at double density: every grid here is in fine pixels
// (two per world pixel), built through spr2.
//
// Coyote: lean and leggy, sage with a plum outline, tall ears with a wool
// inner ear, a long narrow muzzle, a wool bib and belly, a brush tail with
// a dark tip. Wolf: bigger and heavier, wool-grey with a plum saddle whose
// edge breaks into tufts, a ruff at the throat, a blocky muzzle, sage
// inner ears and underside.
//
// Side views face right (drawn mirrored for left); bodies and heads are
// hand-drawn per pose, legs are drawn per frame along hip-joint-paw lines
// from small gait tables, so every gait keeps its joints. 'e' marks an eye:
// buttercup by day and where a night glint goes. The bandana red is never
// used here: it belongs to the player.

export interface PFrame {
  s: Sprite;
  // Night eye glints, in FINE pixels from the anchor (facing right): the
  // top-left of each 2x2 glint, as dx, dy pairs. Facing left, a glint's
  // left edge is at -(dx + 1).
  eyes: number[];
}

export interface FacingSet {
  stand: PFrame;
  creep: PFrame[];
  run: PFrame[];
  flee: PFrame[];
  carry: PFrame[];
}

export interface PredatorSprites {
  stand: PFrame;
  creep: PFrame[]; // stalking, six frames
  rush: PFrame[]; // flat gallop, four frames
  flee: PFrame[];
  carry: PFrame[];
  dig: PFrame[];
  howl: PFrame[]; // sitting with the head level; thrown back; mouth open
  down: FacingSet;
  up: FacingSet;
}

type Grid = string[];
type M = string[][];
type Pt = [number, number];

const blank = (w: number, h: number): M => Array.from({ length: h }, () => Array<string>(w).fill('.'));
function set(m: M, x: number, y: number, c: string) {
  if (y >= 0 && y < m.length && x >= 0 && x < m[0].length) m[y][x] = c;
}
function lay(m: M, rows: Grid, ox: number, oy: number) {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] !== '.') set(m, x + ox, y + oy, r[x]);
  });
}
// Symmetric rows from their left halves (front and back views).
const mir = (halves: Grid): Grid => halves.map((h) => h + [...h].reverse().join(''));

// Coat pixels on the silhouette's edge become plum.
function outline(m: M): M {
  const H = m.length, W = m[0].length;
  const at = (x: number, y: number) => (y < 0 || y >= H || x < 0 || x >= W ? '.' : m[y][x]);
  return m.map((r, y) =>
    r.map((c, x) => (c === '.' || c === 'p' || c === 'e' ? c : [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.') ? 'p' : c)),
  );
}

// A leg along hip-joint-paw. Near legs are a plum|coat|plum ribbon whose
// coat runs up into the body; far legs a plum pair behind it. The paw
// points along `dir` (+1 forward).
function limb(m: M, pts: Pt[], near: boolean, dir: number, core: string) {
  const put = (x: number, y: number, c: string, over: boolean) => {
    if (y < 0 || y >= m.length || x < 0 || x >= m[0].length) return;
    if (over || m[y][x] === '.') m[y][x] = c;
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    let [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (near) {
        put(x0 - 1, y0, 'p', false);
        put(x0, y0, core, true);
        put(x0 + 1, y0, 'p', false);
      } else {
        put(x0, y0, 'p', false);
        put(x0 + 1, y0, 'p', false);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  const [X, Y] = pts[pts.length - 1];
  for (let i = -1; i <= 1; i++) put(X + i + dir, Y, 'p', true);
  put(X, Y, 'p', true);
}

// The stalking walk, six phases: paw dx, paw lift, joint dx, joint dy (from
// the hip). Hocks fold back, wrists forward.
type Step = [number, number, number, number];
const HIND_WALK: Step[] = [[2, 0, -1, 3], [0, 0, -2, 3], [-3, 0, -3, 3], [-4, 1, -3, 2], [-1, 2, -2, 2], [2, 1, 0, 3]];
const FORE_WALK: Step[] = [[2, 0, 1, 3], [0, 0, 0, 3], [-2, 0, -1, 3], [-3, 1, -1, 3], [0, 2, 1, 2], [3, 1, 2, 3]];
function walkLeg(T: Step[], [rx, ry]: Pt, gy: number, ph: number): Pt[] {
  const [pdx, lift, jx, jy] = T[((ph % 6) + 6) % 6];
  return [[rx, ry], [rx + jx, ry + jy], [rx + pdx, gy - lift]];
}

// The gallop, four frames (stretched out and airborne, fore strike,
// gathered under, hind push), each [far hind, far fore, near hind, near
// fore] as joints from the hip / shoulder.
const GALLOP: Pt[][][] = [
  [[[0, 0], [-3, 3], [-6, 4]], [[0, 0], [4, 2], [7, 3]], [[0, 0], [-3, 3], [-6, 5]], [[0, 0], [4, 3], [7, 4]]],
  [[[0, 0], [2, 3], [1, 5]], [[0, 0], [-2, 3], [-3, 5]], [[0, 0], [3, 3], [3, 4]], [[0, 0], [0, 3], [0, 6]]],
  [[[0, 0], [3, 3], [5, 6]], [[0, 0], [-3, 3], [-5, 5]], [[0, 0], [4, 4], [7, 7]], [[0, 0], [-3, 3], [-5, 5]]],
  [[[0, 0], [-2, 3], [-4, 7]], [[0, 0], [3, 2], [4, 2]], [[0, 0], [-1, 4], [-2, 7]], [[0, 0], [3, 2], [4, 3]]],
];

interface Side {
  stand: Grid;
  creep: Grid; // body and head, legs added per frame
  carry: Grid;
  run: Grid;
  gather: Grid;
  flee: Grid;
  dig: Grid;
  digPaws: Grid[];
  howlBody: Grid;
  howlHeads: Grid[];
}

interface Rig {
  side: Side;
  core: string; // near legs' coat
  creep: { w: number; h: number; hips: Pt[] }; // far hind, far fore, near hind, near fore
  carry: { w: number; h: number; hips: Pt[] };
  rush: { w: number; h: number; hips: Pt[]; legY: number }; // legY stretches the gallop
  flee: { w: number; h: number; hips: Pt[]; legY: number };
  dig: { w: number; h: number; paws: Pt };
  howl: { w: number; h: number; body: number; heads: Pt[] };
  anchor: { stand: number; creep: number; run: number; flee: number; carry: number; dig: number; howl: number; front: number };
  down: { stand: M; creep: M[]; run: M[]; flee: M[] };
  up: { stand: M; creep: M[]; run: M[]; flee: M[] };
}

// ---- Coyote ----

const COYOTE_SIDE: Side = {
  stand: [
    '......................p...p.......',
    '.....................psp.pwp......',
    '.....................psspswwp.....',
    '....................psssswwsp.....',
    '....................psssssssp.....',
    '...................pssssspesspp...',
    '...................pssssssssssspp.',
    '.................pssssssssssswwwpp',
    '......pppppppppppssssswwwppppppp..',
    '....ppsssssssssssssssswwwwwwp.....',
    '...psssssssssssssssssssswwwpp.....',
    '..psssssssssssssssssssssswwp......',
    '.pssp.pssssssssssssssssssswp......',
    'psssp.psssswwwwwwwwssssssswp......',
    'psssp.psssspppppppppppssssp.......',
    'pssp..ppsssp........psp.psp.......',
    'psp..pp.pssp........psp.psp.......',
    'ppp..pp.psp.........psp.psp.......',
    '.p...pp.psp.........psp.psp.......',
    '.....pp.psp.........pp..psp.......',
    '.....pp.pssp........pp..psp.......',
    '....ppp.pppp........ppp.pppp......',
  ],
  creep: [
    '..........................p...p.....',
    '.........................psp.pwp....',
    '............pppppp.......psspswwp...',
    '..........ppssssssp.....psssswwsp...',
    '....ppppppssssssssspp..pssssssssp...',
    '...pssssssssssssssssspppsssssspespp.',
    '..psssssssssssssssssssssssssssssssspp',
    '.pssssssssssssssssssssssssssssswwwwpp',
    '.pssssssssssssssssssssssssswwwppppp..',
    'psssssssswwwwwwwwssssswwwwwwp.......',
    'psssp.pssppppppppppppsswwwp.........',
    'pssp................................',
    'psp.................................',
    'pp..................................',
  ],
  carry: [
    '.......................p...p......',
    '......................psp.pwp.....',
    '......................psspswwp....',
    '.....................psssswwsp....',
    '.....................psssssssp....',
    '....................pssssspesspp..',
    '....................pssssssssssspp',
    '...................psssssssssswwwp',
    '...................pssssswwwppppp.',
    '..................pssssswwwwp.....',
    '.............ppppsssssswwwwp......',
    '.......pppppppssssssssswwwp.......',
    '....ppssssssssssssssssssswp.......',
    '...pssssssssssssssssssssswp.......',
    '..pssssssssswwwwwwwwsssssp........',
    '.pssp.psssppppppppppppssp.........',
    'pssp..............................',
    'psp...............................',
    'pp................................',
  ],
  run: [
    '..........................ppp........',
    '.........................pswwp.......',
    '.pppp.pppppppppppppppppppssssppp.....',
    'ppssssssssssssssssssssssssssspessppp.',
    'ppssssssssssssssssssssssssssssssssspp',
    '.pppssssssssssssssssssssssssswpwpwpp.',
    '....psssswwwwwwwssssssssswwwwppppp...',
    '.....psssspppppppsssssswwwwwp........',
    '......pssp.......psssssssp...........',
    '.......pp.........ppppppp............',
  ],
  gather: [
    '..........pppppp...........ppp.......',
    '........ppssssssppppp.....pswwp......',
    '......ppssssssssssssspppppssssppp....',
    '....ppsssssssssssssssssssssssspessppp',
    '.pppssssssssssssssssssssssssssssssssp',
    'ppssssssssssssssssssssssssssswpwpwpp.',
    'ppppsssswwwwwwwssssssssswwwwppppp....',
    '....psssspppppppsssssswwwwwp.........',
    '.....pssp.......psssssssp............',
    '......pp.........ppppppp.............',
  ],
  flee: [
    '...........................ppp......',
    '..........pppppppp........pswwp.....',
    '.......pppssssssssppppppppssssppp...',
    '....pppssssssssssssssssssssspessppp.',
    '...psssssssssssssssssssssssssssssspp',
    '..psssssssssssssssssssssssssswwwwwpp',
    '..psssssssswwwwwwwsssssssswwwppppp..',
    '..pspssspppppppppsssssswwwwwp.......',
    '...pssp.........psssssssp...........',
    '....pp...........ppppppp............',
  ],
  dig: [
    '.pp.....................................',
    'psspp...................................',
    'psssspp.................................',
    '.pssssspppppp...........................',
    '..psssssssssspppp.......................',
    '...pssssssssssssspppp...................',
    '...psssssssssssssssssppp................',
    '...pssssswwwwsssssssssssp...............',
    '...psssp.pppppwwssssssssspp.p...p.......',
    '...pssp......ppsssssssssssppsp.pwp......',
    '...psp.........psssssssssspsspswwp......',
    '...psp..........pssssssssssssswwsp......',
    '...psp..........pssssssssssssssssp......',
    '...psp..........psswwwssssssspesspp.....',
    '...psp..........pswwwwssssssssssssspp...',
    '...psp..........psp.pwwsssssssssswwwpp..',
    '...pssp.........psp..pwwwwwwwppppppp....',
    '...psp..........psp...pppppppp..........',
  ],
  digPaws: [
    [
      '..psp.',
      '..psp.',
      '.psp..',
      '.pppp.',
    ],
    [
      '..psp.',
      '..psp.',
      '..psp.',
      '..pppp',
    ],
    [
      '..psp..',
      '...psp.',
      '....psp',
      '....ppp',
    ],
  ],
  howlBody: [
    '..............psssswwp....',
    '.............psssssswwp...',
    '............pssssssswwp...',
    '..........ppsssssssswwp...',
    '........ppssssssssssswp...',
    '......ppssssssssssssswp...',
    '....ppssssssssssssssswp...',
    '...psssssssssssspssppsp...',
    '..psssssssssssssp.psp.psp.',
    '.pssssssssssssp...psp.psp.',
    'ppppppppppppppp..pppp.pppp',
  ],
  howlHeads: [
    [
      '....p...p.......',
      '...psp.pwp......',
      '...psspswwp.....',
      '..psssswwsp.....',
      '..psssssssp.....',
      '.pssssspesspp...',
      '.pssssssssssspp.',
      'psssssssssswwwpp',
      'psssswwwpppppp..',
      '.psswwwwp.......',
    ],
    [
      '...........pp...',
      '..........pssp..',
      '.........psswp..',
      '........psssswp.',
      '.......psssswwp.',
      '..pp..psspesswp.',
      '.psspppssssswwp.',
      '.psssssssssswp..',
      '..pssssssswwwp..',
      '...pssssswwwp...',
    ],
    [
      '..........pp....',
      '.........pssp...',
      '........psswp.p.',
      '.......pssswppwp',
      '.......psssspwwp',
      '..pp..psspespwp.',
      '.psspppssssswwp.',
      '.psssssssssswp..',
      '..pssssssswwwp..',
      '...pssssswwwp...',
    ],
  ],
};

// Front: the face with its ears, a hump of shoulders over a lowered head,
// the bib, then the legs.
const C_FACE = {
  alert: mir(['.pp.....', '.psp....', '.pwsp...', '.pwwsp..', '.pwwsspp', 'psssssss', 'psssssss', 'psspesss', 'psssssss', '.psswsss', '.pswwwss', '..pswwsp', '...pwwpp', '....ppww']),
  pinned: mir(['........', '........', '........', 'pp......', 'pwpp.ppp', 'psssssss', 'psssssss', 'psspesss', 'psssssss', '.psswsss', '.pswwwss', '..pswwpp', '...pwppw', '....pwpw']),
  flat: mir(['........', '........', '........', '........', '..pppppp', '.pssssss', 'psssssss', 'psspesss', 'psssssss', '.psswsss', '.pswwwss', '..pswwsp', '...pwwpp', '....ppww']),
};
const C_BIB = mir(['...pswww', '..psswww', '.psssssw', '.pspssss']);
const C_HUMP = mir(['....pppp', '..ppssss', '.pssssss', '..ssssss', '...sssss', '....ssss']);
function cFront(face: keyof typeof C_FACE, lift: [number, number], low = 0, hump = false): M {
  const m = blank(16, 23 - low);
  const y = hump ? 2 : 0;
  if (hump) lay(m, C_HUMP, 0, 0);
  lay(m, C_FACE[face], 0, y);
  lay(m, C_BIB, 0, y + 14);
  const ly = y + 18 - low;
  for (let j = 0; j < 3; j++) for (const x of [1, 2, 13, 14]) set(m, x, ly + j, 'p'); // the hind legs, behind
  for (const [x, up] of [[5, lift[0]], [10, lift[1]]] as Pt[]) {
    for (let j = 0; j < 5 - up; j++) { set(m, x - 1, ly + j, 'p'); set(m, x, ly + j, 's'); set(m, x + 1, ly + j, 'p'); }
    for (let i = -1; i <= 2; i++) set(m, x + i, ly + 4 - up, 'p');
  }
  return m;
}
// Back: head and ears, the neck, shoulders, waist, haunches; the tail over
// them and the hind legs either side.
const C_BACK = mir(['.pp.....', '.psp....', '.pssp...', '.psssppp', '.pssssss', '..psssss', '...pssss', '..psssss', '.psssssp', 'pssssssp', 'pssssssp', '.psssssp', '.psssssp', 'pssssssp', 'pswsssss', 'pswwssss', '.pswwsps']);
const C_BACK_PIN = [...mir(['........', '........', '........', 'pp......', 'pspp.ppp']), ...C_BACK.slice(5)];
const C_BACK_FLAT = [...mir(['........', '........', '........', '........', '..pppppp']), ...C_BACK.slice(5)];
const C_TAIL = {
  hang: ['.pssp.', 'pssssp', 'pssssp', 'pssssp', 'pssssp', '.pssp.', '.pppp.', '..pp..'],
  lift: ['.pppp.', 'pssssp', 'pssssp', 'pssssp', '.pppp.', '..pp..'],
  tuck: ['.pp.', 'pssp', '.pp.'],
};
function cBack(body: Grid, lift: [number, number], tail: keyof typeof C_TAIL, sway = 0, low = 0): M {
  const m = blank(16, 24 - low);
  lay(m, body, 0, 0);
  const o = outline(m);
  for (const [x, up] of [[3, lift[0]], [12, lift[1]]] as Pt[]) {
    for (let j = 0; j < 7 - low - up; j++) { set(o, x - 1, 16 + j, 'p'); set(o, x, 16 + j, 's'); set(o, x + 1, 16 + j, 'p'); }
    for (let i = -1; i <= 1; i++) set(o, x + i, 22 - low - up, 'p');
  }
  const tuck = tail === 'tuck';
  C_TAIL[tail].forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') set(o, (tuck ? 6 : 5) + i + (j > 3 ? sway : 0), (tuck ? 16 : 13) + j, r[i]);
  });
  return o;
}

const COYOTE: Rig = {
  side: COYOTE_SIDE,
  core: 's',
  creep: { w: 37, h: 17, hips: [[6, 10], [21, 10], [8, 10], [23, 10]] },
  carry: { w: 34, h: 22, hips: [[6, 15], [21, 15], [8, 15], [23, 15]] },
  rush: { w: 40, h: 17, hips: [[8, 8], [22, 9], [7, 8], [24, 9]], legY: 1 },
  flee: { w: 40, h: 17, hips: [[8, 8], [22, 9], [7, 8], [24, 9]], legY: 1 },
  dig: { w: 40, h: 22, paws: [16, 18] },
  howl: { w: 30, h: 21, body: 10, heads: [[12, 0], [10, 1], [10, 1]] },
  anchor: { stand: 15, creep: 15, run: 16, flee: 16, carry: 14, dig: 12, howl: 13, front: 8 },
  down: {
    stand: cFront('alert', [0, 0]),
    creep: [cFront('alert', [0, 0], 2, true), cFront('alert', [1, 0], 2, true), cFront('alert', [0, 0], 2, true), cFront('alert', [0, 1], 2, true)],
    run: [cFront('pinned', [1, 0]), cFront('pinned', [0, 1])],
    flee: [cFront('flat', [1, 0], 1), cFront('flat', [0, 1], 1)],
  },
  up: {
    stand: cBack(C_BACK, [0, 0], 'hang'),
    creep: [cBack(C_BACK, [1, 0], 'hang', 0, 1), cBack(C_BACK, [0, 0], 'hang', 0, 1), cBack(C_BACK, [0, 1], 'hang', 1, 1), cBack(C_BACK, [0, 0], 'hang', 1, 1)],
    run: [cBack(C_BACK_PIN, [1, 0], 'lift'), cBack(C_BACK_PIN, [0, 1], 'lift')],
    flee: [cBack(C_BACK_FLAT, [1, 0], 'tuck', 0, 1), cBack(C_BACK_FLAT, [0, 1], 'tuck', 0, 1)],
  },
};

// ---- Wolf ----

const WOLF_SIDE: Side = {
  stand: [
    '...........................p....p.......',
    '..........................psp..psp......',
    '..........................pssp.pssp.....',
    '.........................pwwsppwssp.....',
    '........................pwwwwwwwwwwp....',
    '.......................pwwwwwwwpewwppp..',
    '.......................pwwwwwwwwwwwwwwpp',
    '......................pwwwwwwwwwwwwwwwpp',
    '...........ppppppppppppwwwwwwwssssspp...',
    '.........ppppppppppppppwswpswwsppppp....',
    '........ppppppppppppppwpwpsswwp.........',
    '.......pppppppppppwpwpwwwwwwwwsp........',
    '......pppwpwpwpwpwwwwwwwwwwwwwwsp.......',
    '.....ppwwwwwwwwwwwwwwwwwwwwwwwwsp.......',
    '....pwwwwwwwwwwwwwwwwwwwwwwwwwwsp.......',
    '...pwwwwwwwssssssssssswwwwwwwwssp.......',
    '..pwwwwpwwpsppppppppppppsswwwssp........',
    '..pwwwp.pwwp............pwwp.psp........',
    '.pwwwp..pwwp............pwp..psp........',
    '.pwwsp.pwwp.............psp..psp........',
    '.pwssp.pwp..............psp..psp........',
    '.ppsp..psp..............psp..psp........',
    '..pp...pssp.............pp...pssp.......',
    '......ppppp.............ppp..ppppp......',
  ],
  creep: [
    '.............................p....p.....',
    '............................psp..psp....',
    '..............pppppp........pssp.pssp...',
    '...........pppppppppp......pwwsppwssp...',
    '......ppppppppppppppppp...pwwwwwwwwwwp..',
    '....pppppppppppppppppppp.pwwwwwwwpewwppp',
    '...ppwpppwpwwpwwpwwpwwpwppwwwwwwwwwwwwwwp',
    '..pwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwpp',
    '.pwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwsssspp.',
    '.pwwwwwwwwwwwwwwwwwwwwwwwwwswpswssppp...',
    'pwwwwwwwwsssssssssswwwwwwswssspp........',
    'pwwwp.pwwppppppppppppppwwsssp...........',
    'pwwp....................................',
    'pwsp....................................',
    'pspp....................................',
    '.pp.....................................',
  ],
  carry: [
    '........................p....p......',
    '.......................psp..psp.....',
    '.......................pssp.pssp....',
    '......................pwwsppwssp....',
    '.....................pwwwwwwwwwwp...',
    '....................pwwwwwwwpewwppp.',
    '....................pwwwwwwwwwwwwwwpp',
    '...................pwwwwwwwwwwwwwwwpp',
    '...................pwwwwwwwsssssppp..',
    '..................pwwswpswwsppppp....',
    '..............pppppwpwpwswwwp........',
    '........ppppppppppppwpwwwwwwp........',
    '.....ppppppppppppppwwwwwwwwsp........',
    '...ppppppppppwpwwpwwpwwwwwwsp........',
    '..pwpwwpwwpwwwwwwwwwwwwwwwwsp........',
    '.pwwwwwwwssssssssssswwwwwssp.........',
    '.pwwwp.pwwpppppppppppppwwsp..........',
    'pwwp................................',
    'pwsp................................',
    'pspp................................',
    '.pp.................................',
  ],
  run: [
    '..........................pppp............',
    '.........................pwssp............',
    '.pppp.pppppppppppppppppppwwwwwpppp........',
    'ppwwwwpppppppppppppppwwwwwwwwpewwwppp.....',
    'ppwwwwpwwpwwpwwpwwpwwwwwwwwwwwwwwwwwwwpp..',
    '.pppwwwwwwwwwwwwwwwwwwwwwwwwwwwwwswpwpwpp.',
    '....pwwwwwsssssssswwwwwwwwwwssssppppppp...',
    '.....pwwwwpppppppppwwwwwwssssssp..........',
    '......pwwp.........pwwwwwwwwwp............',
    '.......pp...........ppppppppp.............',
  ],
  gather: [
    '..........pppppppp..........pppp..........',
    '........pppppppppppppp.....pwssp..........',
    '......ppppppppppppppppppppppwwwwwpppp.....',
    '....pppppppppppppppppwwwwwwwwwwwwpewwppp..',
    '.ppppwwpwwpwwpwwpwwpwwwwwwwwwwwwwwwwwwwwpp',
    'ppwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwswpwpwpp..',
    'ppppwwwwwsssssssswwwwwwwwwwssssppppppp....',
    '....pwwwwpppppppppwwwwwwssssssp...........',
    '.....pwwp.........pwwwwwwwwwp.............',
    '......pp...........ppppppppp..............',
  ],
  flee: [
    '..............................pppp......',
    '...........pppppppppp........pwssp......',
    '........pppppppppppppppppppppwwwwwpppp..',
    '.....pppppppppppppppppppppwwwwwwpewwppp.',
    '....pwpwwpwwpwwpwwpwwpwwpwwwwwwwwwwwwwpp',
    '...pwwwwwwwwwwwwwwwwwwwwwwwwwwwwssssssp.',
    '...pwwwwwwwwsssssssswwwwwwwwwwsspppppp..',
    '...pwpwwwppppppppppwwwwwwssssssp........',
    '....pwwp..........pwwwwwwwwwp...........',
    '.....pp............ppppppppp............',
  ],
  dig: [
    '.pp.......................................',
    'pwwpp.....................................',
    'pwwwwpp...................................',
    '.pwwwwwppppppp............................',
    '..pwwwwpppppppppp.........................',
    '...pwwwwwwpwpwpwppppp.....................',
    '...pwwwwwwwwwwwwwwwwppp...................',
    '...pwwwwwwwwwwwwwwwwwwwpp.................',
    '...pwwwwwssssswwwwwwwwwwwp...p....p.......',
    '...pwwwp.pppppppsswwwwwwwwpppsp..psp......',
    '...pwwp.........ppwwwwwwwwwppssp.pssp.....',
    '...pwsp...........pwwwwwwwwwpwwsppwssp....',
    '...pwsp...........pwwwwwwwwwwwwwwwwwwp....',
    '...pwsp...........pwwwwwwwwwwwwwwpewwppp..',
    '...pwsp...........pwswwwwwwwwwwwwwwwwwwpp.',
    '...pwsp...........pswswwwwwwwwwwwwwwwwwwpp',
    '...psp............pswspswwwwwwwwsssssppp..',
    '...pwsp...........psp.pswwsppppppppp......',
    '...psp............psp..ppppp..............',
  ],
  digPaws: [
    [
      '..pwp.',
      '..pwp.',
      '.pwp..',
      '.pppp.',
    ],
    [
      '..pwp.',
      '..pwp.',
      '..pwp.',
      '..pppp',
    ],
    [
      '..pwp..',
      '...pwp.',
      '....pwp',
      '....ppp',
    ],
  ],
  howlBody: [
    '................pwwwwssp....',
    '...............pwwwwwwssp...',
    '..............ppwwwwwwssp...',
    '............ppppwwwwwwwsp...',
    '..........ppppppwwwwwwwsp...',
    '........ppppwpwpwwwwwwwsp...',
    '......ppwpwwwwwwwwwwwwwsp...',
    '....ppwwwwwwwwwwwwwwwwwsp...',
    '...pwwwwwwwwwwwwwwpwwppsp...',
    '..pwwwwwwwwwwwwwwp.pwp.pwp..',
    '.pwwwwwwwwwwwwwp...pwp.pwp..',
    'ppppppppppppppp...pppp.pppp.',
  ],
  howlHeads: [
    [
      '.....p....p.......',
      '....psp..psp......',
      '....pssp.pssp.....',
      '...pwwsppwssp.....',
      '..pwwwwwwwwwwp....',
      '.pwwwwwwwpewwppp..',
      '.pwwwwwwwwwwwwwwpp',
      'pwwwwwwwwwwwwwwwpp',
      'pwwwwwwwwssssspp..',
      'pwswpswwsppppp....',
      '.psppswwp.........',
    ],
    [
      '............pp....',
      '...........pwwp...',
      '..........pwwwsp..',
      '.........pwwwwsp..',
      '........pwwwwwsp..',
      '...pp..pwwwwwssp..',
      '..psspppwpewwsp...',
      '..pssswwwwwwssp...',
      '..pwwwwwwwwwsp....',
      '...pswpwwwwssp....',
      '....pspswwssp.....',
    ],
    [
      '...........pp.....',
      '..........pwwp....',
      '.........pwwwsp.p.',
      '........pwwwwsppsp',
      '........pwwwwspssp',
      '...pp..pwwwwwpssp.',
      '..psspppwpewwssp..',
      '..pssswwwwwwssp...',
      '..pwwwwwwwwwsp....',
      '...pswpwwwwssp....',
      '....pspswwssp.....',
    ],
  ],
};

// Front: a sage cap and eye mask over a wool muzzle, the ruff below.
const W_MASK = ['pwwwwssss', 'pwwwsssss', 'pwwspesss', 'pwwwsssss', 'pwpwwwssw', '.pwpwwwww', '..pwwwwww', '...pwwwwp', '....pwwwp'];
const W_FACE = {
  alert: mir(['..p......', '.psp.....', '.pssp....', '.psssp...', '.pwwssppp', ...W_MASK]),
  pinned: mir(['.........', '.........', '.........', 'pp.......', 'pwpp.pppp', ...W_MASK.slice(0, 7), '...pwwwwp', '....pwpwp']),
  flat: mir(['.........', '.........', '.........', '.........', '..ppppppp', ...W_MASK]),
};
const W_RUFF = mir(['..pwwwww', '.pwswwww', 'pwswwwww', '.pwwwwww', '.pswwwww']);
const W_HUMP = mir(['.....ppp', '...ppppp', '.ppppwpw', '..pwwwww', '...wwwww', '....wwww']);
function wFront(face: keyof typeof W_FACE, lift: [number, number], low = 0, hump = false): M {
  const m = blank(18, 25 - low);
  const y = hump ? 2 : 0;
  if (hump) lay(m, W_HUMP, 0, 0);
  lay(m, W_FACE[face], 0, y);
  lay(m, W_RUFF, 0, y + 14);
  const ly = y + 19 - low;
  for (let j = 0; j < 3; j++) for (const x of [1, 2, 15, 16]) set(m, x, ly + j, 'p');
  for (const [x, up] of [[6, lift[0]], [11, lift[1]]] as Pt[]) {
    for (let j = 0; j < 5 - up; j++) { set(m, x - 1, ly + j, 'p'); set(m, x, ly + j, 'w'); set(m, x + 1, ly + j, 'p'); }
    for (let i = -1; i <= 2; i++) set(m, x + i, ly + 4 - up, 'p');
  }
  return m;
}
// Back: the saddle runs down the spine as a band with tufted edges.
const W_BACK = mir(['..p......', '.psp.....', '.pssp....', '.psssp...', '.pwwwsppp', '.pwwwwwww', '..pwwwwww', '..pwwwwwp', '.pwwwwwpp', 'pwwwwpwpp', 'pwwwwwppp', '.pwwwpwpp', '.pwwwwppp', 'pwwwwpwpp', 'pwwwwwwpp', 'pswwwwwww', '.pswwwpww']);
const W_BACK_PIN = [...mir(['.........', '.........', '.........', 'pp.......', 'pwpp.pppp']), ...W_BACK.slice(5)];
const W_BACK_FLAT = [...mir(['.........', '.........', '.........', '.........', '..ppppppp']), ...W_BACK.slice(5)];
const W_TAIL = {
  hang: ['.pwwp.', 'pwwwwp', 'pwwwwp', 'pwwwwp', 'pwwwsp', '.pssp.', '.pppp.', '..pp..'],
  lift: ['.pppp.', 'pwwwwp', 'pwwwwp', 'pwwssp', '.pppp.', '..pp..'],
  tuck: ['.pp.', 'pwwp', '.pp.'],
};
function wBack(body: Grid, lift: [number, number], tail: keyof typeof W_TAIL, sway = 0, low = 0): M {
  const o = blank(18, 25 - low);
  lay(o, body, 0, 0);
  for (const [x, up] of [[3, lift[0]], [14, lift[1]]] as Pt[]) {
    for (let j = 0; j < 8 - low - up; j++) { set(o, x - 1, 16 + j, 'p'); set(o, x, 16 + j, 'w'); set(o, x + 1, 16 + j, 'p'); }
    for (let i = -1; i <= 1; i++) set(o, x + i, 23 - low - up, 'p');
  }
  const tuck = tail === 'tuck';
  W_TAIL[tail].forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') set(o, (tuck ? 7 : 6) + i + (j > 3 ? sway : 0), (tuck ? 17 : 14) + j, r[i]);
  });
  return o;
}

const WOLF: Rig = {
  side: WOLF_SIDE,
  core: 'w',
  creep: { w: 41, h: 19, hips: [[6, 11], [23, 11], [8, 11], [25, 11]] },
  carry: { w: 37, h: 24, hips: [[6, 16], [21, 16], [8, 16], [23, 16]] },
  rush: { w: 44, h: 18, hips: [[9, 8], [24, 9], [8, 8], [27, 9]], legY: 1.15 },
  flee: { w: 44, h: 18, hips: [[8, 8], [23, 9], [7, 8], [26, 9]], legY: 1.15 },
  dig: { w: 42, h: 23, paws: [19, 19] },
  howl: { w: 32, h: 23, body: 11, heads: [[13, 0], [11, 1], [11, 1]] },
  anchor: { stand: 17, creep: 16, run: 18, flee: 17, carry: 15, dig: 13, howl: 14, front: 9 },
  down: {
    stand: wFront('alert', [0, 0]),
    creep: [wFront('alert', [0, 0], 2, true), wFront('alert', [1, 0], 2, true), wFront('alert', [0, 0], 2, true), wFront('alert', [0, 1], 2, true)],
    run: [wFront('pinned', [1, 0]), wFront('pinned', [0, 1])],
    flee: [wFront('flat', [1, 0], 1), wFront('flat', [0, 1], 1)],
  },
  up: {
    stand: wBack(W_BACK, [0, 0], 'hang'),
    creep: [wBack(W_BACK, [1, 0], 'hang', 0, 1), wBack(W_BACK, [0, 0], 'hang', 0, 1), wBack(W_BACK, [0, 1], 'hang', 1, 1), wBack(W_BACK, [0, 0], 'hang', 1, 1)],
    run: [wBack(W_BACK_PIN, [1, 0], 'lift'), wBack(W_BACK_PIN, [0, 1], 'lift')],
    flee: [wBack(W_BACK_FLAT, [1, 0], 'tuck', 0, 1), wBack(W_BACK_FLAT, [0, 1], 'tuck', 0, 1)],
  },
};

// ---- Building ----

// A sprite and its eye glints from a finished grid (anchor at the feet).
function build(rows: M | Grid, ax: number, side: boolean): PFrame {
  const g = rows.map((r) => (typeof r === 'string' ? r : r.join('')));
  const ay = g.length - 1;
  const eyes: number[] = [];
  g.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] !== 'e') continue;
      const x0 = r[x - 1] === 'p' ? x - 1 : x; // the glint covers the eye and its dark corner
      eyes.push(x0 - ax, y - ay);
      // In profile the far eye shows four pixels behind, if that is still head.
      if (side && 'sw'.includes(r[x0 - 4] ?? '.') && 'sw'.includes(r[x0 - 3] ?? '.')) eyes.push(x0 - 4 - ax, y - ay);
    }
  });
  return { s: spr2(g.map((r) => r.replace(/e/g, 'y')), ax, ay), eyes };
}

function makeSet(R: Rig): PredatorSprites {
  const A = R.anchor, S = R.side;
  const creep = [0, 1, 2, 3, 4, 5].map((k) => {
    const { w, h, hips } = R.creep;
    const m = blank(w, h), gy = h - 1;
    limb(m, walkLeg(HIND_WALK, hips[0], gy, k + 3), false, 1, R.core);
    limb(m, walkLeg(FORE_WALK, hips[1], gy, k + 5), false, 1, R.core);
    lay(m, S.creep, 0, 0);
    limb(m, walkLeg(HIND_WALK, hips[2], gy, k), true, 1, R.core);
    limb(m, walkLeg(FORE_WALK, hips[3], gy, k + 2), true, 1, R.core);
    return build(m, A.creep, true);
  });
  // Carrying: short dragging steps (four of the six walk phases).
  const DRAG = [0, 1, 2, 4];
  const carry = [0, 1, 2, 3].map((k) => {
    const { w, h, hips } = R.carry;
    const m = blank(w, h), gy = h - 1, ph = (o: number) => DRAG[(k + o) % 4];
    limb(m, walkLeg(HIND_WALK, hips[0], gy, ph(2)), false, 1, R.core);
    limb(m, walkLeg(FORE_WALK, hips[1], gy, ph(3)), false, 1, R.core);
    lay(m, S.carry, 0, 0);
    limb(m, walkLeg(HIND_WALK, hips[2], gy, ph(0)), true, 1, R.core);
    limb(m, walkLeg(FORE_WALK, hips[3], gy, ph(1)), true, 1, R.core);
    return build(m, A.carry, true);
  });
  // Rush and flee share the gallop; the stretched frame rides a row higher.
  const gallop = (G: Rig['rush'], top: (k: number) => Grid, ax: number) =>
    [0, 1, 2, 3].map((k) => {
      const m = blank(G.w, G.h), by = k === 0 ? 0 : 1;
      const L = GALLOP[k].map((pts, i) => pts.map(([x, y]) => [G.hips[i][0] + x, G.hips[i][1] + by + Math.round(y * G.legY)] as Pt));
      const back = k === 0 ? -1 : 1;
      limb(m, L[0], false, back, R.core);
      limb(m, L[1], false, 1, R.core);
      lay(m, top(k), 0, by);
      limb(m, L[2], true, back, R.core);
      limb(m, L[3], true, 1, R.core);
      return build(m, ax, true);
    });
  const rush = gallop(R.rush, (k) => (k === 2 ? S.gather : S.run), A.run);
  const flee = gallop(R.flee, () => S.flee, A.flee);
  const dig = S.digPaws.map((paws) => {
    const m = blank(R.dig.w, R.dig.h);
    lay(m, S.dig, 0, 0);
    lay(m, paws, R.dig.paws[0], R.dig.paws[1]);
    return build(m, A.dig, true);
  });
  const howl = S.howlHeads.map((head, k) => {
    const m = blank(R.howl.w, R.howl.h);
    lay(m, S.howlBody, 0, R.howl.body);
    lay(m, head, R.howl.heads[k][0], R.howl.heads[k][1]);
    return build(m, A.howl, true);
  });
  const facing = (F: Rig['down']): FacingSet => {
    const st = build(F.stand, A.front, false);
    const list = (ms: M[]) => ms.map((m) => build(m, A.front, false));
    return { stand: st, creep: list(F.creep), run: list(F.run), flee: list(F.flee), carry: [st] };
  };
  return { stand: build(S.stand, A.stand, true), creep, rush, flee, carry, dig, howl, down: facing(R.down), up: facing(R.up) };
}

const cache: Partial<Record<'coyote' | 'wolf', PredatorSprites>> = {};

export function predatorSprites(kind: 'coyote' | 'wolf'): PredatorSprites {
  return (cache[kind] ??= makeSet(kind === 'wolf' ? WOLF : COYOTE));
}
