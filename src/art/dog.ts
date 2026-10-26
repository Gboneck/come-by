import { C } from '../palette';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { rimLight } from './animals';
import { DEFAULT_DOG, dressRows, type DogFacing, type DogLook } from './dogstyle';

// Blue heeler: teal coat flecked with wool, plum mask and ear tips, and the
// red bandana that marks the player. `y` (buttercup) swaps in for helpers.
//
// Five facings, the left ones mirrored: side on, towards and away from the
// viewer, and the two three-quarter views between (`dr` heading down-right,
// face turned to us; `ur` heading up-right, back to us). Every frame is put
// together from parts (torso, head, tail, legs, the bandana's loose ends),
// so ears flop and pin back with the gait, the tail swings, streams or wags
// on its own beat, and the bandana flutters at speed.
//
// Template letters, resolved per look in dressRows (dogstyle.ts):
//   t coat  w flecks and muzzle  p plum (ear tips, nose, eyes, feet)
//   r neck band  k bandana bulk (a collar shows coat)  f the loose ends
//   n a neckerchief's point  e E the mask round each eye  a the tail tip

type Grid = string[];
type Layer = readonly [rows: Grid, dx: number, dy: number];

// Lay parts over each other on a w x h grid ('.' shows what is below).
function compose(w: number, h: number, layers: Layer[]): Grid {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [rows, dx, dy] of layers)
    rows.forEach((row, j) => {
      const y = j + dy;
      if (y < 0 || y >= h) return;
      for (let i = 0; i < row.length; i++) {
        const x = i + dx;
        if (row[i] !== '.' && row[i] !== ' ' && x >= 0 && x < w) g[y][x] = row[i];
      }
    });
  return g.map((r) => r.join(''));
}

const px = (pts: [number, number][], ch = 't'): Layer => {
  const h = Math.max(...pts.map((p) => p[1])) + 1, w = Math.max(...pts.map((p) => p[0])) + 1;
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [x, y] of pts) g[y][x] = ch;
  return [g.map((r) => r.join('')), 0, 0];
};
const at = (l: Layer, dx: number, dy: number): Layer => [l[0], l[1] + dx, l[2] + dy];

// Legs drawn from a stride offset per leg: o > 0 reaches forward, o < 0
// back; a lifted leg (swinging forward) shows only its tucked paw.
interface Leg { hip: number; o: number; up?: boolean }
function legRows(w: number, legs: Leg[], top = 0): Layer {
  const a = Array<string>(w).fill('.'), b = Array<string>(w).fill('.');
  const put = (row: string[], x: number, c: string) => { if (x >= 0 && x < w) row[x] = c; };
  for (const l of legs) {
    if (l.up) {
      put(a, l.hip + Math.sign(l.o), 'p');
      continue;
    }
    put(a, l.hip + (l.o >= 2 ? 1 : l.o <= -2 ? -1 : 0), 't');
    put(b, l.hip + l.o, 'p');
  }
  return [[a.join(''), b.join('')], 0, top];
}

// A trot, six frames: diagonal pairs (near hind + far fore, far hind +
// near fore) swing together. Offsets per frame and which frames the pair
// is in the air.
const TROT_O = [2, 1, -1, -2, -1, 1];
const TROT_UP_A = [false, false, false, false, true, true];
const TROT_UP_B = [false, true, true, false, false, false];
// Body bob per trot frame (up while a pair swings through) and per gallop
// frame (up in both suspensions).
export const RUN_BOB = [0, -1, 0, 0, -1, 0];
export const SPRINT_BOB = [-1, 0, 0, -1, 0, 0];

function trotLegs(f: number, hips: [number, number, number, number], w: number, top: number): Layer {
  const o = TROT_O[f];
  const [farHind, nearHind, farFore, nearFore] = hips;
  return legRows(w, [
    { hip: farHind, o: -o, up: TROT_UP_B[f] },
    { hip: farFore, o, up: TROT_UP_A[f] },
    { hip: nearHind, o, up: TROT_UP_A[f] },
    { hip: nearFore, o: -o, up: TROT_UP_B[f] },
  ], top);
}

// ===================================================================
// Side view, facing right. 13 x 9 (a spare row on top for a raised
// head), anchor at the feet (6, 8). Parts are in body rows 0..7 and drop
// one row into the frame.
// ===================================================================
const SW = 13, SH = 9;
const S_TORSO: Layer = [['..ttttwt', '..twttwt', '..ttwttttt', '...tttttt'], 0, 2];
const S_HEAD = {
  n: ['.p.p.', '.tht.', 'rhpt.', 'kttwp', 'n.w..'],
  flop: ['p.p..', '.tht.', 'rhpt.', 'kttwp', 'n.w..'],
  bark: ['.p.p.', '.tht.', 'rhpt.', 'kttpp', 'n.www'],
  pant: ['.p.p.', '.tht.', 'rhpt.', 'kttwp', 'n.ppw'],
  pantShut: ['.p.p.', '.tht.', 'rhpt.', 'kttwp', 'n.wp.'],
};
const S_HEAD_PRICK = ['.p.p.', '.t.t.', '.tht.', 'rhpt.', 'kttwp', 'n.w..']; // ears up tall: one row up
const S_HEAD_RAISED = ['.p.p.', '.tht.', 'thpt.', 'rttwp', 'k.w..', 'n....']; // proud: one row up
const S_HEAD_DIP = ['.p.p.', '.tht.', 'rhpt.', 'kttwp', 'n.w..']; // braced: one row down
const S_TAIL = {
  up: px([[1, 1]], 'a'),
  back: px([[1, 2]], 'a'),
  low: px([[1, 3]], 'a'),
  wagA: at(px([[0, 0]], 'a'), 0, 0),
  wagB: at(px([[1, 0]], 'a'), 0, 0),
};
const S_TAIL_ROOT: Layer = px([[1, 1]]);
const S_HIPS: [number, number, number, number] = [3, 4, 8, 9];
const side = (...layers: Layer[]) => compose(SW, SH, layers.map((l) => at(l, 0, 1)));
const sHead = (rows: Grid, dy = 0): Layer => [rows, 8, dy];
const S_STAND_LEGS: Layer = [['...tt...tt...', '...pp...pp...'], 0, 6];

function sideStand(head: Grid = S_HEAD.n, tail: Layer = S_TAIL.up) {
  return side(S_TORSO, tail, sHead(head), S_STAND_LEGS);
}
// The trot: ears flop on the passing frames, the tail swings up, back,
// down, back; the bandana's ends lift off the nape.
const S_TROT_TAIL = [S_TAIL.up, S_TAIL.back, S_TAIL.low, S_TAIL.low, S_TAIL.back, S_TAIL.up];
const S_TROT_EARS = [S_HEAD.n, S_HEAD.flop, S_HEAD.n, S_HEAD.n, S_HEAD.flop, S_HEAD.n];
const S_TROT_FLAP: (Layer | null)[] = [null, px([[7, 1]], 'f'), null, null, px([[7, 1]], 'f'), null];
function sideTrot(f: number, mouth?: Grid) {
  const flap = S_TROT_FLAP[f];
  return side(S_TORSO, S_TROT_TAIL[f], sHead(mouth ?? S_TROT_EARS[f]), trotLegs(f, S_HIPS, SW, 6), ...(flap ? [flap] : []));
}

// Double-suspension gallop, six frames: stretched out in the air, the
// leading forefoot lands, the forefeet push off as the hind legs swing
// through, gathered in the air with the back arched, the hind feet land,
// and push. Ears pinned, tail streaming, body a row lower and longer, the
// bandana's ends streaming back.
const SIDE_GALLOP = [
  ['.............', '.............', '.........pp..', 'at....ff.ttt.', '.tttttwtrhpt.', '..twttwtkttwp', '..ttwttttnw..', '.tt.......tt.', 'p..........pp'],
  ['.............', '.............', '.........pp..', '.a.....f.ttt.', '.ttttwwtrhpt.', '..twttwtkttwp', '..ttwttttnw..', '.t.......tt..', 'p........p...'],
  ['.............', '.............', '......f..pp..', '.......f..ttt', '.atttwttrhpt.', '..twttwtkttwp', '..ttwtttnttw.', '...tt..tt....', '...p..pp.....'],
  ['.............', '.............', '.........pp..', '....tttf.ttt.', '..atttwtrhpt.', '.ttwttwtkttwp', '..ttwttttnw..', '....tt.tt....', '....pppp.....'],
  ['.............', '.............', '.........pp..', 'a.....ff..ttt', '.ttttwtwrhpt.', '..twttwtkttwp', '..ttwttttnw..', '...tt.....tt.', '...pp......pp'],
  ['.............', '.............', '......f..pp..', 'at.....f..ttt', '.tttttwtrhpt.', '..twttwtkttwp', '..ttwttttnw..', '..t.t.....t.t', '.p...p.....p.'],
];

// Bark: brace (head dips, forefeet planted wide), then the open-mouthed bark.
const S_BRACE_LEGS: Layer = [['...tt...t.t..', '...pp...p..p.'], 0, 6];
// Skid: hind legs tucked under, forefeet thrown out in front, head up.
const S_SKID_LEGS: Layer = [['...tt....tt..', '..pp......pp.'], 0, 6];

// Lying down: crouch, sink with the forefeet sliding out, then flat.
const SIDE_SETTLE = [
  ['.............', '.............', '.........p.p.', '.........tht.', '..ttttwtrhpt.', '.atwttwtkttwp', '..ttwtttntw..', '..ttttttt....', '..ppp...pp...'],
  ['.............', '.............', '.............', '.........p.p.', '.........tht.', '..ttttwtrhpt.', '.atwttwtkttwp', '..ttwttttntw.', '..ppp.....pp.'],
];
const lieRows = (back: string, tail: string) => ['.............', '.............', '.............', '.........p.p.', '.........tht.', back, tail, '..ttttttktwpp', '.............'];
const SIDE_LIE = lieRows('...tttwtrhpt.', '.atwttwtkttwp');
const SIDE_LIE_BREATH = lieRows('...tttwtrhpt.', '.atwttwtkttwp').map((r, i) => (i === 4 ? '....tttt.tht.' : r));
const SIDE_LIE_WAG = lieRows('.a.tttwtrhpt.', '..twttwtkttwp');

// Idles: nose to the ground; sitting for a scratch; the shake-off after a
// swim or a shower, ears and tail flung out.
const SNIFF = [
  ['.............', '.............', '.a...........', '..ttttwtr.p.p', '..twttwtkrtht', '..ttwttttttpt', '...tttttt.tww', '...tt...tt..p', '...pp...pp...'],
  ['.............', '.............', '..a..........', '..ttttwtr.p.p', '..twttwtkrtht', '..ttwttttttpt', '...tttttt.twp', '...tt...tt...', '...pp...pp...'],
];
const SCRATCH = [
  ['.............', '........p.p..', '........tht..', '.......rhpt.', '......tkkttwp', '..a..ttttw...', '.ttttttt.....', '.ptttttt.....', '..pp..pp.....'],
  ['.............', '........p.p..', '........tht..', '.....p.rhpt.', '....p.tkkttwp', '..aa.ttttw...', '.ttttttt.....', '.tttttttt....', '..pp..pp.....'],
  ['.............', '........p.p..', '........tht..', '.......rhpt.', '....pptkkttwp', '..aa.ttttw...', '.ttttttt.....', '.tttttttt....', '..pp..pp.....'],
];
const SHAKE = [
  ['.............', '........p...p', '.a.......tht.', '.tttttwtrhpt.', '..twttwtkttwp', '..ttwttttnw..', '..ttttttt....', '...tt...tt...', '...pp...pp...'],
  ['.............', '..........pp.', '.........tht.', '..tttttwrhpt.', '.ttwttwtkttwp', 'a.ttwttttnw..', '...tttttt....', '...tt...tt...', '...pp...pp...'],
];

// ===================================================================
// Three-quarter, heading down-right: the face turned to us (eyes, blaze,
// nose), the body a little shorter, the hind feet a row higher (further
// away). 12 x 10, anchor (6, 9).
// ===================================================================
const DW = 13, DH = 10;
const D_TORSO: Layer = [['...ttttt', '...twtwt', '...ttwtt', '....ttttt'], 0, 2];
const D_HEAD = {
  n: ['.p.p.', '.tht.', 'rpwph', 'ktwwp', 'kntw.'],
  flop: ['p.p..', '.tht.', 'rpwph', 'ktwwp', 'kntw.'],
  bark: ['.p.p.', '.tht.', 'rpwph', 'ktwpp', 'kntww'],
  pant: ['.p.p.', '.tht.', 'rpwph', 'ktwwp', 'kntpw'],
  pantShut: ['.p.p.', '.tht.', 'rpwph', 'ktwwp', 'kntp.'],
  pinned: ['.....', '.pp..', 'rpwph', 'ktwwp', 'kntw.'],
};
const D_HEAD_PRICK = ['.p.p.', '.t.t.', '.tht.', 'rpwph', 'ktwwp', 'kntw.'];
const D_HEAD_RAISED = ['.p.p.', '.tht.', 'tpwph', 'rtwwp', 'kntw.', 'k....'];
const D_TAIL = { up: px([[1, 1]], 'a'), back: px([[2, 1]], 'a'), low: px([[2, 2]], 'a'), wagA: px([[0, 0]], 'a'), wagB: px([[2, 0]], 'a') };
const dr = (...layers: Layer[]) => compose(DW, DH, layers.map((l) => at(l, 0, 1)));
const dHead = (rows: Grid, dy = 0): Layer => [rows, 8, dy];
// Hind legs end a row above the forelegs.
const D_STAND_LEGS: Layer = [['....tt..tt..', '....pp..tt..', '........pp..'], 0, 6];
function dLegs(f: number): Layer[] {
  const o = TROT_O[f];
  const hind = legRows(DW, [
    { hip: 4, o: -o, up: TROT_UP_B[f] },
    { hip: 5, o, up: TROT_UP_A[f] },
  ], 6);
  const fore = legRows(DW, [
    { hip: 8, o, up: TROT_UP_A[f] },
    { hip: 9, o: -o, up: TROT_UP_B[f] },
  ], 7);
  // The forelegs are a pixel longer (nearer): a coat row above their paws.
  return [hind, [['........tt..'], 0, 6], fore];
}
const D_TROT_TAIL = [D_TAIL.up, D_TAIL.back, D_TAIL.low, D_TAIL.low, D_TAIL.back, D_TAIL.up];
const D_TROT_EARS = [D_HEAD.n, D_HEAD.flop, D_HEAD.n, D_HEAD.n, D_HEAD.flop, D_HEAD.n];
const dStand = (head: Grid = D_HEAD.n, tail: Layer = D_TAIL.up) => dr(D_TORSO, tail, dHead(head), D_STAND_LEGS);
function dTrot(f: number, mouth?: Grid) {
  return dr(D_TORSO, D_TROT_TAIL[f], dHead(mouth ?? D_TROT_EARS[f]), ...dLegs(f), ...(S_TROT_FLAP[f] ? [px([[7, 1]], 'f')] : []));
}
// Gallop: lower and stretched, ears pinned, tail streaming.
const D_GALLOP_LEGS: Grid[] = [
  ['.tt......tt.', 'p..........p'],
  ['..t......t..', '.p.......p..'],
  ['...t....t...', '...p...p....'],
  ['....tttt....', '....pppp....'],
  ['...tt....tt.', '...pp.....pp'],
  ['..t.t....t.t', '.p...p...p..'],
];
function dGallop(f: number) {
  const hump: Layer[] = f === 3 ? [[['....ttt'], 0, 2]] : [];
  const tail = f === 3 ? px([[2, 3]], 'a') : px([[0, 3], [1, 3]], 'a');
  const flap = f % 2 === 0 ? [px([[7, 2]], 'f')] : [];
  return dr(at(D_TORSO, 0, 1), ...hump, tail, dHead(D_HEAD.pinned, 1), [D_GALLOP_LEGS[f], 0, 7], ...flap);
}
const D_SKID = () => dr(D_TORSO, D_TAIL.back, dHead(D_HEAD_PRICK, -1), [['....tt...t.t', '...pp....t.t', '.........p.p'], 0, 6]);
const D_BRACE = () => dr(D_TORSO, D_TAIL.up, dHead(D_HEAD.n, 1), [['....tt..t.t.', '....pp..t.t.', '........p.p.'], 0, 6]);

// ===================================================================
// Three-quarter, heading up-right: the back of the head and the nape knot,
// the back seen from above, rump and tail towards us; the forefeet a row
// higher (further away). 11 x 9, anchor (5, 8).
// ===================================================================
const UW = 11, UH = 9;
const U_TORSO: Layer = [['...tttwkt', '..ttwttwtt', '.tttwttttt'], 0, 3];
const U_HEAD = {
  n: ['.p.p', '.ttt', 'rttt'],
  flop: ['p..p', '.ttt', 'rttt'],
  prick: ['.p.p', '.ttt', 'rttt'],
  pinned: ['....', 'pp.p', 'rttt'],
};
const U_HEAD_RAISED = ['.p.p', '.ttt', 'tttt', 'r...'];
const U_TAIL = { up: px([[0, 4]], 'a'), back: px([[0, 5]], 'a'), low: px([[0, 6]], 'a'), wagA: px([[0, 3]], 'a'), wagB: px([[1, 2]], 'a') };
const ur = (...layers: Layer[]) => compose(UW, UH, layers.map((l) => at(l, 0, 1)));
const uHead = (rows: Grid, dy = 0): Layer => [rows, 7, dy];
const U_STAND_LEGS: Layer = [['...tt...pp.', '...pp......'], 0, 6];
function uLegs(f: number): Layer[] {
  const o = TROT_O[f];
  const hind = legRows(UW, [
    { hip: 3, o: -o, up: TROT_UP_B[f] },
    { hip: 4, o, up: TROT_UP_A[f] },
  ], 6);
  // Forefeet peek out under the chest, a row higher.
  const fore = o > 0 ? '........p.p' : o < 0 ? '.......p.p.' : '........pp.';
  return [hind, [[fore], 0, 6]];
}
const U_TROT_TAIL = [U_TAIL.up, U_TAIL.back, U_TAIL.low, U_TAIL.low, U_TAIL.back, U_TAIL.up];
const U_TROT_EARS = [U_HEAD.n, U_HEAD.flop, U_HEAD.n, U_HEAD.n, U_HEAD.flop, U_HEAD.n];
const uStand = (head: Grid = U_HEAD.n, tail: Layer = U_TAIL.up) => ur(U_TORSO, tail, uHead(head), U_STAND_LEGS);
const uTrot = (f: number) => ur(U_TORSO, U_TROT_TAIL[f], uHead(U_TROT_EARS[f]), ...uLegs(f), ...(S_TROT_FLAP[f] ? [px([[6, 2]], 'f')] : []));
const U_GALLOP_LEGS = [
  ['.tt......p.', 'p..........'],
  ['..t.....p..', '.p.........'],
  ['...t...p...', '...p.......'],
  ['....tt.pp..', '....pp.....'],
  ['...tt....pp', '...pp......'],
  ['..t.t...p.p', '.p...p.....'],
];
function uGallop(f: number) {
  const tail = f === 3 ? px([[1, 4]], 'a') : px([[0, 5], [0, 6]], 'a');
  const flap = f % 2 === 0 ? [px([[6, 2]], 'f')] : [];
  return ur(U_TORSO, tail, uHead(U_HEAD.pinned), [U_GALLOP_LEGS[f], 0, 6], ...flap);
}
const U_SKID = () => ur(U_TORSO, U_TAIL.back, uHead(U_HEAD.prick), [['...tt...p.p', '...pp......'], 0, 6]);
const U_BRACE = () => ur(U_TORSO, U_TAIL.up, uHead(U_HEAD.n, 1), [['...tt..p.p.', '...pp......'], 0, 6]);

// ===================================================================
// Facing down (towards the viewer). 7 x 10, anchor (3, 9).
// ===================================================================
const DOWN_HEAD = ['.p...p.', '.tt.tt.', '.ttttt.', '.epwpE.', '.twwwt.', '..wpw..', '.krrrk.', '.twntt.'];
const DOWN_FLOP = ['p.....p', ...DOWN_HEAD.slice(1)];
const DOWN_PINNED = ['.......', '.pt.tp.', ...DOWN_HEAD.slice(2)];
const DOWN_PRICK = ['..p.p..', '.tt.tt.', ...DOWN_HEAD.slice(2)];
const DOWN_PANT = [...DOWN_HEAD.slice(0, 5), '..wpw..', '.krprk.', '.twntt.'];
const DOWN_PANT2 = [...DOWN_HEAD.slice(0, 5), '.twpwt.', '.krprk.', '.twntt.'];
const DOWN_BARK = [...DOWN_HEAD.slice(0, 5), '.twpwt.', '.kpppk.', '.twwwt.'];
const down = (head: Grid, feet: string, extra: Layer[] = []) => compose(7, 10, [[[...head, feet], 0, 1], ...extra]);
const DOWN_TROT_FEET = ['.p...p.', '.p..p..', '.p..p..', '.p...p.', '..p..p.', '..p..p.'];
const DOWN_TROT_HEAD = [DOWN_HEAD, DOWN_FLOP, DOWN_HEAD, DOWN_HEAD, DOWN_FLOP, DOWN_HEAD];
const DOWN_GALLOP_FEET = ['p.....p', '.p...p.', '..p.p..', '..ppp..', '.p...p.', 'p.....p'];
// The tail shows over the back when it wags.
const DOWN_WAG = [px([[6, 3]], 'a'), px([[0, 3]], 'a')];

// ===================================================================
// Facing up (away). 7 x 12, anchor (3, 10).
// ===================================================================
const upBody = (ears: string, tail: string) => [ears, '.tt.tt.', '.ttttt.', '..tnt..', '.krrrk.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', tail];
const up = (rows: Grid, feet: string) => compose(7, 12, [[[...rows, feet], 0, 1]]);
const UP_TROT_TAIL = ['..a....', '...a...', '....a..', '....a..', '...a...', '..a....'];
const UP_TROT_EARS = ['.p...p.', 'p.....p', '.p...p.', '.p...p.', 'p.....p', '.p...p.'];
const UP_PINNED = ['.......', '.pt.tp.', '.ttttt.', '..tnt..', '.krrrk.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '..aa...'];
const UP_GALLOP_FEET = ['p.....p', '.p...p.', '..p.p..', '..ppp..', '.p...p.', 'p.....p'];

// One facing's full set of poses.
export interface DogPoses {
  // Side view only: idles and the shake-off.
  sniff?: Sprite[];
  scratch?: Sprite[]; // sitting, then the hind leg at the ear (two frames)
  shake?: Sprite[];
  stand: Sprite;
  run: Sprite[]; // the trot, six frames
  runPant: Sprite[]; // the same with the mouth open
  sprint: Sprite[]; // the gallop, six frames
  brace: Sprite;
  bark: Sprite;
  skid: Sprite;
  pant: Sprite[]; // standing, mouth open, flanks heaving
  proud: Sprite[]; // head up, chest out, tail wagging
  look: Sprite; // standing, ears pricked at something
  settle: Sprite[]; // standing -> lying, in order
  lie: Sprite;
  lieBreath: Sprite;
  lieWag: Sprite;
}

export type DogView = 'side' | 'dr' | 'down' | 'ur' | 'up';

export interface DogSprites {
  poses: Record<DogView, DogPoses>;
  // How it was made (for its soaked twin, see dogstyle.ts).
  bandana: 'r' | 'y';
  look: DogLook;
  wet: boolean;
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

function recolor(rows: string[], bandana: string): string[] {
  return bandana === 'r' ? rows : rows.map((r) => r.replace(/r/g, bandana));
}

// `look` dresses the player's dog (markings, neck piece; see dogstyle.ts);
// `wet` is the soaked look after the ford or a long shower.
export function makeDogSprites(bandana: 'r' | 'y' = 'r', look: DogLook = DEFAULT_DOG, wet = false): DogSprites {
  let facing: DogFacing = 'side';
  // Dressed first, then the sun catches the top of the coat on the far
  // side: a sage rim.
  const S = (rows: string[], ax: number, ay: number) => {
    const r = dressRows(rows, facing, look, wet);
    return spr(rimLight(recolor(r, bandana), 't', 's', false), ax, ay);
  };
  const six = [0, 1, 2, 3, 4, 5];

  // ---- side ----
  const s = (rows: string[]) => S(rows, 6, 8);
  const sSettle = SIDE_SETTLE.map(s);
  const sLie = s(SIDE_LIE), sLieBreath = s(SIDE_LIE_BREATH), sLieWag = s(SIDE_LIE_WAG);
  const sideP: DogPoses = {
    stand: s(sideStand()),
    run: six.map((f) => s(sideTrot(f))),
    runPant: six.map((f) => s(sideTrot(f, f % 3 === 1 ? S_HEAD.pantShut : S_HEAD.pant))),
    sprint: SIDE_GALLOP.map(s),
    brace: s(side(S_TORSO, S_TAIL.up, sHead(S_HEAD_DIP, 1), S_BRACE_LEGS)),
    bark: s(side(S_TORSO, S_TAIL.up, sHead(S_HEAD.bark), S_BRACE_LEGS)),
    skid: s(side(S_TORSO, S_TAIL.back, sHead(S_HEAD_PRICK, -1), S_SKID_LEGS)),
    pant: [s(side(S_TORSO, S_TAIL.back, sHead(S_HEAD.pant), S_STAND_LEGS)), s(side(at(S_TORSO, 0, 0), [['...tttttt'], 0, 6], S_TAIL.back, sHead(S_HEAD.pantShut), S_STAND_LEGS))],
    proud: [s(side(S_TORSO, S_TAIL_ROOT, S_TAIL.wagA, sHead(S_HEAD_RAISED, -1), S_STAND_LEGS)), s(side(S_TORSO, S_TAIL_ROOT, S_TAIL.wagB, sHead(S_HEAD_RAISED, -1), S_STAND_LEGS))],
    look: s(side(S_TORSO, S_TAIL.up, sHead(S_HEAD_PRICK, -1), S_STAND_LEGS)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
    sniff: SNIFF.map(s),
    scratch: SCRATCH.map(s),
    shake: SHAKE.map(s),
  };

  // ---- three-quarter views (lying down uses the side view's poses) ----
  facing = 'dr';
  const d = (rows: string[]) => S(rows, 6, 9);
  const drP: DogPoses = {
    stand: d(dStand()),
    run: six.map((f) => d(dTrot(f))),
    runPant: six.map((f) => d(dTrot(f, f % 3 === 1 ? D_HEAD.pantShut : D_HEAD.pant))),
    sprint: six.map((f) => d(dGallop(f))),
    brace: d(D_BRACE()),
    bark: d(dr(D_TORSO, D_TAIL.up, dHead(D_HEAD.bark), [['....tt..t.t.', '....pp..t.t.', '........p.p.'], 0, 6])),
    skid: d(D_SKID()),
    pant: [d(dStand(D_HEAD.pant, D_TAIL.back)), d(dStand(D_HEAD.pantShut, D_TAIL.back))],
    proud: [d(dr(D_TORSO, D_TAIL.up, D_TAIL.wagA, dHead(D_HEAD_RAISED, -1), D_STAND_LEGS)), d(dr(D_TORSO, D_TAIL.up, D_TAIL.wagB, dHead(D_HEAD_RAISED, -1), D_STAND_LEGS))],
    look: d(dr(D_TORSO, D_TAIL.up, dHead(D_HEAD_PRICK, -1), D_STAND_LEGS)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
  };
  facing = 'ur';
  const u3 = (rows: string[]) => S(rows, 5, 8);
  const urP: DogPoses = {
    stand: u3(uStand()),
    run: six.map((f) => u3(uTrot(f))),
    runPant: six.map((f) => u3(uTrot(f))),
    sprint: six.map((f) => u3(uGallop(f))),
    brace: u3(U_BRACE()),
    bark: u3(ur(U_TORSO, U_TAIL.up, uHead(U_HEAD_RAISED, -1), [['...tt..p.p.', '...pp......'], 0, 6])),
    skid: u3(U_SKID()),
    pant: [u3(uStand(U_HEAD.n, U_TAIL.back)), u3(ur(U_TORSO, [['..ttwttwtt'], 0, 3], U_TAIL.back, uHead(U_HEAD.n, 0), U_STAND_LEGS))],
    proud: [u3(ur(U_TORSO, U_TAIL.wagA, uHead(U_HEAD_RAISED, -1), U_STAND_LEGS)), u3(ur(U_TORSO, U_TAIL.wagB, uHead(U_HEAD_RAISED, -1), U_STAND_LEGS))],
    look: u3(uStand(U_HEAD.prick)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
  };

  // ---- down ----
  facing = 'down';
  const dn = (rows: string[]) => S(rows, 3, 9);
  const downP: DogPoses = {
    stand: dn(down(DOWN_HEAD, '.p...p.')),
    run: six.map((f) => dn(down(DOWN_TROT_HEAD[f], DOWN_TROT_FEET[f]))),
    runPant: six.map((f) => dn(down(f % 3 === 1 ? DOWN_PANT : DOWN_PANT2, DOWN_TROT_FEET[f]))),
    sprint: six.map((f) => dn(down(DOWN_PINNED, DOWN_GALLOP_FEET[f]))),
    brace: dn(down(DOWN_PINNED, 'p.....p')),
    bark: dn(down(DOWN_BARK, '.p...p.')),
    skid: dn(down(DOWN_PRICK, 'p.....p')),
    pant: [dn(down(DOWN_PANT2, '.p...p.')), dn(down(DOWN_PANT, '.p...p.'))],
    proud: [dn(down(['.p...p.', ...DOWN_HEAD.slice(0, 7), '.twwwt.'], '.p...p.', [DOWN_WAG[0]])), dn(down(['.p...p.', ...DOWN_HEAD.slice(0, 7), '.twwwt.'], '.p...p.', [DOWN_WAG[1]]))],
    look: dn(down(DOWN_PRICK, '.p...p.')),
    settle: [dn(compose(7, 10, [[['.p...p.', '.tt.tt.', '.ttttt.', '.epwpE.', '.twwwt.', '..wpw..', '.krrrk.', 'tp.n.pt'], 0, 2]]))],
    lie: dn(compose(7, 10, [[['.p...p.', '.tt.tt.', '.ttttt.', '.epwpE.', 'ttwwwtt', 'tkwpwkt', 'pprrrpp'], 0, 3]])),
    lieBreath: dn(compose(7, 10, [[['.p...p.', '.tt.tt.', 'ttttttt', '.epwpE.', 'ttwwwtt', 'tkwpwkt', 'pprrrpp'], 0, 3]])),
    lieWag: dn(compose(7, 10, [[['.p...p.', '.tt.tt.', '.ttttt.', '.epwpEa', 'ttwwwtt', 'tkwpwkt', 'pprrrpp'], 0, 3]])),
  };

  // ---- up ----
  facing = 'up';
  const u = (rows: string[]) => S(rows, 3, 10);
  const upP: DogPoses = {
    stand: u(up(upBody('.p...p.', '...a...'), '.p...p.')),
    run: six.map((f) => u(up(upBody(UP_TROT_EARS[f], UP_TROT_TAIL[f]), DOWN_TROT_FEET[f]))),
    runPant: six.map((f) => u(up(upBody(UP_TROT_EARS[f], UP_TROT_TAIL[f]), DOWN_TROT_FEET[f]))),
    sprint: six.map((f) => u(up(UP_PINNED, UP_GALLOP_FEET[f]))),
    brace: u(up(['.......', '.p...p.', '.tt.tt.', '.ttttt.', '.krrrk.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '...a...'], '.p...p.')),
    // Head thrown up.
    bark: u(compose(7, 12, [[['p.....p', '.tt.tt.', '.ttttt.', '..ttt..', '..tnt..', '.krrrk.', '.twtwt.', '.ttwtt.', '.twttt.', '..ttt..', '...a...', '.p...p.'], 0, 0]])),
    skid: u(up(upBody('..p.p..', '..a....'), 'p.....p')),
    pant: [u(up(upBody('.p...p.', '...a...'), '.p...p.')), u(up(upBody('.p...p.', '...a...').map((r, i) => (i === 6 ? 'tttwttt' : r)), '.p...p.'))],
    proud: [u(up(upBody('.p...p.', '..a....'), '.p...p.')), u(up(upBody('.p...p.', '....a..'), '.p...p.'))],
    look: u(up(upBody('..p.p..', '...a...'), '.p...p.')),
    settle: [u(compose(7, 12, [[['.p...p.', '.tt.tt.', '.ttttt.', '..tnt..', '.krrrk.', 'ptwtwtp', '.ttwtt.', '.twttt.', '..ttt..', '...a...'], 0, 2]]))],
    lie: u(compose(7, 12, [[['.p...p.', '.tt.tt.', '.ttttt.', '.tkrkt.', 'ptwtwtp', '.ttwtt.', '.twttt.', '..ttt..', '...aa..'], 0, 3]])),
    lieBreath: u(compose(7, 12, [[['.p...p.', '.tt.tt.', '.ttttt.', '.tkrkt.', 'ptwtwtp', 'tttwttt', '.twttt.', '..ttt..', '...aa..'], 0, 3]])),
    lieWag: u(compose(7, 12, [[['.p...p.', '.tt.tt.', '.ttttt.', '.tkrkt.', 'ptwtwtp', '.ttwtt.', '.twttt.', '..ttt..', '..aa...'], 0, 3]])),
  };
  // Down and up settle in two steps like the side view.
  downP.settle = [downP.settle[0], downP.settle[0]];
  upP.settle = [upP.settle[0], upP.settle[0]];

  return {
    poses: { side: sideP, dr: drP, down: downP, ur: urP, up: upP },
    bandana,
    look,
    wet,
    side: sideP.run,
    gallop: sideP.sprint,
    sideStand: sideP.stand,
    sideLie: sideP.lie,
    sideBark: sideP.bark,
    down: downP.run,
    downStand: downP.stand,
    downLie: downP.lie,
    downBark: downP.bark,
    up: upP.run,
    upStand: upP.stand,
    upLie: upP.lie,
  };
}

// ---- Choosing the frame ----

// Eight ways round, clockwise from facing right (screen y is down):
// 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up,
// 7 up-right. Left-hand views are the right-hand ones mirrored.
const VIEWS: [DogView, boolean][] = [['side', false], ['dr', false], ['down', false], ['dr', true], ['side', true], ['ur', true], ['up', false], ['ur', false]];
// Lying down and getting up happen side on, or straight towards or away.
const LIE_VIEW = [0, 0, 2, 4, 4, 4, 6, 0];

export const SETTLE_STEP = 0.07; // seconds per in-between pose when lying down

export interface DogState {
  view: number; // 0..7, see VIEWS
  speed: number;
  sprint: boolean;
  phase: number; // stride: one unit per 4.5 px at a trot, 7 px at a gallop
  lying: boolean;
  lieT: number; // seconds since it lay down
  rise: number; // getting up: 1 just started .. 0 done
  bark: number; // seconds of the bark left
  skid?: boolean;
  pant?: boolean;
  proud?: boolean;
  look?: boolean; // ears pricked at the stock it is watching
  t: number;
}

export const viewOf = (v: number): DogView => VIEWS[((v % 8) + 8) % 8][0];
export const FACE_VIEW: Record<'r' | 'd' | 'l' | 'u', number> = { r: 0, d: 2, l: 4, u: 6 };

export function pickDogFrame(S: DogSprites, st: DogState): { s: Sprite; flip: boolean; bob: number } {
  const v = ((st.view % 8) + 8) % 8;
  const [name, flip] = VIEWS[st.lying || st.rise > 0 ? LIE_VIEW[v] : v];
  const P = S.poses[name];
  const pose = (s: Sprite, bob = 0) => ({ s, flip, bob });
  if (st.lying) {
    // Sink through the settle poses, then breathe; now and then the tail
    // thumps the ground a few times.
    const i = Math.floor(st.lieT / SETTLE_STEP);
    if (i < P.settle.length) return pose(P.settle[i]);
    const t = st.lieT - P.settle.length * SETTLE_STEP;
    const thump = t > 1.5 ? (t - 1.5) % 3.2 : 1;
    if (thump < 0.48 && Math.floor(thump / 0.08) % 2 === 0) return pose(P.lieWag);
    return pose(t % 1.6 > 1.1 ? P.lieBreath : P.lie);
  }
  if (st.bark > 0) return pose(st.bark > 0.1 ? P.bark : P.brace);
  if (st.rise > 0) return pose(P.settle[Math.min(P.settle.length - 1, Math.floor(st.rise * P.settle.length))]);
  if (st.skid) return pose(P.skid);
  if (st.speed <= 6) {
    if (st.proud) return pose(P.proud[Math.floor(st.t * 6) % 2]);
    if (st.pant) return pose(P.pant[Math.floor(st.t * 7) % 2]);
    return pose(st.look ? P.look : P.stand);
  }
  const cyc = st.sprint ? P.sprint : st.pant ? P.runPant : P.run;
  const f = ((Math.floor(st.phase * 1.5) % 6) + 6) % 6;
  return pose(cyc[f], (st.sprint ? SPRINT_BOB : RUN_BOB)[f]);
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

const curls = new Map<string, Sprite[]>();

// `friend`: a co-op friend's dog, in buttercup.
export function drawSleepingDog(g: CanvasRenderingContext2D, x: number, y: number, flip: boolean, t: number, friend = false) {
  const b = friend ? 'y' : 'r';
  let curl = curls.get(b);
  if (!curl) curls.set(b, (curl = [spr(rimLight(recolor(CURL, b), 't', 's', false), 6, 7), spr(rimLight(recolor(CURL_BREATH, b), 't', 's', false), 6, 7)]));
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
