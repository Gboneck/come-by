import { C } from '../palette';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { rimLight } from './animals';
import { DEFAULT_DOG, dressFine, dressRows, type DogFacing, type DogLook } from './dogstyle';
import { spr2, up2 } from './hd';

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

const at = (l: Layer, dx: number, dy: number): Layer => [l[0], l[1] + dx, l[2] + dy];

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

// ===================================================================
// Two quick idles still drawn at world scale (13 x 9, anchor (6, 8)) and
// brought up to fine pixels by Scale2x: sitting for a scratch, and the
// shake-off after a swim or a shower, ears and tail flung out.
// ===================================================================
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
// Double density: the side view drawn in fine pixels (two per world
// pixel). 27 x 19, three spare rows on top for raised heads and tall ears;
// parts are in body rows 0..15 (ears 0-1, head 2-9, torso 4-11, legs
// 12-15) and drop three rows into the frame. Anchor at the feet (12, 18).
// Letters as in dressFine (dogstyle.ts).
// ===================================================================
const FW = 27, FH = 19, FTOP = 3;
const fside = (...layers: Layer[]) => compose(FW, FH, layers.map((l) => at(l, 0, FTOP)));

// The torso: a deep chest, the back level, a tuck at the loin; flecks in
// little clusters, the saddle over the shoulders, shade under the belly.
const F_TORSO: Layer = [[
  '....tttdddddttt.....',
  '..ttttvvtddtttttt...',
  '.tttttvttttttvtttt..',
  'ttttxxtttttvttvvtttt',
  'tttvttttxttttttxtttt',
  'tttvvtttttttttttttt.',
  '.ttttttttttxtttttt..',
  '..ppttttttttttttp...',
], 3, 4];
// Gallop: stretched long and low, then gathered with the back arched.
const F_TORSO_LONG: Layer = [[
  '.....tttdddddtt.......',
  '.tttttvvtddtttttttt...',
  'ttttttvttttttvtttttt..',
  'tttxxtttttvttvvttttt..',
  '.ttvtttxttttttxtttt...',
  '..ttttttttttttttttp...',
  '....ppttttttttttp.....',
], 2, 5];
const F_TORSO_ARCH: Layer = [[
  '.......ttdddtt......',
  '....ttttdddtttt.....',
  '..tttttvvttttttttt..',
  '.tttttvtttttvttttt..',
  'tttxxttttttvtvvtttt.',
  'tttvttttxttttttxttt.',
  '.ttvvttttttttttttt..',
  '...pttttttttttttp...',
], 3, 3];

// Heads (12 wide, at column 15): ears up, the mask round the eye with its
// glint, the pale muzzle and the nose. Variants for the gait and moods.
const fh = (ears: string[], face: string[]): Grid => [...ears, ...face];
const F_EARS = {
  up: ['...p..p.....', '..ptpptp....'],
  back: ['..p..p......', '.ptpptp.....'], // flopping back on the passing frames
  tall: ['...p..p.....', '..pt.pt.....', '..ptpptp....'], // pricked: one row taller
  pinned: ['............', '.pppp.......'], // flat back at a gallop
};
const F_FACE = {
  n: ['..pttttp....', '.tttttttt...', 'tttthhtttt..', 'tttjihtwww..', 'ttthhitwwwpp', '.ttttwwwwwpp', '..tttwwppp..', '...tttt.....'],
  bark: ['..pttttp....', '.tttttttt...', 'tttthhtttt..', 'tttjihtwwwpp', 'ttthhitwwwpp', '.ttttwww....', '..tttwwwww..', '...tttwwww..'],
  pant: ['..pttttp....', '.tttttttt...', 'tttthhtttt..', 'tttjihtwww..', 'ttthhitwwwpp', '.ttttwwwwwpp', '..tttwpppp..', '...ttttwwp..'],
  pantShut: ['..pttttp....', '.tttttttt...', 'tttthhtttt..', 'tttjihtwww..', 'ttthhitwwwpp', '.ttttwwwwwpp', '..tttwwppp..', '...tttww....'],
};
const F_HEAD = {
  n: fh(F_EARS.up, F_FACE.n),
  flop: fh(F_EARS.back, F_FACE.n),
  bark: fh(F_EARS.up, F_FACE.bark),
  pant: fh(F_EARS.up, F_FACE.pant),
  pantShut: fh(F_EARS.up, F_FACE.pantShut),
  prick: fh(F_EARS.tall, F_FACE.n), // place one row up
  pinned: fh(F_EARS.pinned, F_FACE.n),
};
const fHead = (rows: Grid, dy = 0): Layer => [rows, 15, dy];
// The bandana: a band round the neck and its point hanging at the chest
// with a fold down it; the loose ends lift off the nape at speed.
const F_BAND: Layer = [['.rr.', 'rrrr', 'krrr', 'kKkr', '.kKk', '..kk', '...k'], 13, 4];
const F_BAND_RAISED: Layer = [['.rr.', 'rrrr', 'krrr', 'kKkr', '.kKk', '..kk', '...k'], 13, 3];
const F_TAIL = {
  up: [['a..', 'tt.', '.tt', '..t'], 1, 2] as Layer,
  back: [['att..', '.ttt.', '...tt'], 0, 4] as Layer,
  low: [['...t', '..tt', '.tt.', '.t..', 'a...'], 0, 5] as Layer,
  wagA: [['a...', 'tt..', '.tt.', '..tt'], 0, 1] as Layer,
  wagB: [['..a.', '..t.', '..tt', '...t'], 0, 1] as Layer,
  stream: [['att...', '..tttt'], 0, 5] as Layer,
};

// Legs in fine pixels: three rows of leg two pixels wide and a paw; o is
// how far the paw reaches forward (+) or back (-), a lifted leg folds its
// paw up off the ground. Far legs are drawn first, a shade darker.
interface FLeg { hip: number; o: number; up?: boolean; far?: boolean }
function fineLegs(w: number, legs: FLeg[], top = 12): Layer {
  const g = Array.from({ length: 4 }, () => Array<string>(w).fill('.'));
  const put = (x: number, y: number, c: string) => { if (x >= 0 && x < w && y >= 0 && y < 4) g[y][x] = c; };
  for (const l of [...legs].sort((a, b) => Number(!!b.far) - Number(!!a.far))) {
    const c = l.far ? 'q' : 't';
    if (l.up) {
      // Folded: the leg reaches, the paw tucked a row up.
      for (let j = 0; j < 2; j++) { const x = l.hip + Math.round((l.o * (j + 1)) / 3); put(x, j, c); put(x + 1, j, c); }
      const px0 = l.hip + l.o;
      put(px0, 2, 'p'); put(px0 + 1, 2, 'p');
      continue;
    }
    for (let j = 0; j < 3; j++) { const x = l.hip + Math.round((l.o * (j + 1)) / 4); put(x, j, c); put(x + 1, j, c); }
    const px0 = l.hip + l.o;
    put(px0, 3, 'p'); put(px0 + 1, 3, 'p'); put(px0 + 2, 3, 'p');
  }
  return [g.map((r) => r.join('')), 0, top];
}
// Hips: far hind, near hind, far fore, near fore.
const F_HIPS = [4, 6, 15, 17];
function fTrotLegs(f: number): Layer {
  const o = TROT_O[f] * 2;
  const [fh0, nh, ff, nf] = F_HIPS;
  return fineLegs(FW, [
    { hip: fh0, o: -o, up: TROT_UP_B[f], far: true },
    { hip: ff, o, up: TROT_UP_A[f], far: true },
    { hip: nh, o, up: TROT_UP_A[f] },
    { hip: nf, o: -o, up: TROT_UP_B[f] },
  ]);
}
const F_STAND_LEGS = fineLegs(FW, [{ hip: 4, o: 0, far: true }, { hip: 15, o: 0, far: true }, { hip: 6, o: 0 }, { hip: 17, o: 0 }]);
const F_BRACE_LEGS = fineLegs(FW, [{ hip: 4, o: 0, far: true }, { hip: 15, o: -1, far: true }, { hip: 6, o: 0 }, { hip: 18, o: 2 }]);
const F_SKID_LEGS = fineLegs(FW, [{ hip: 5, o: -2, far: true }, { hip: 16, o: 3, far: true }, { hip: 7, o: -1 }, { hip: 18, o: 5 }]);
const F_TROT_TAIL = [F_TAIL.up, F_TAIL.back, F_TAIL.low, F_TAIL.low, F_TAIL.back, F_TAIL.up];
const F_TROT_EARS = [F_HEAD.n, F_HEAD.flop, F_HEAD.n, F_HEAD.n, F_HEAD.flop, F_HEAD.n];
const F_FLAP: Layer = [['f.', '.f'], 12, 3];
const fStand = (head: Grid = F_HEAD.n, tail: Layer = F_TAIL.up, dy = 0) => fside(F_TORSO, tail, fHead(head, dy), F_BAND, F_STAND_LEGS);
function fTrot(f: number, face?: Grid) {
  const flap = f === 1 || f === 4 ? [F_FLAP] : [];
  return fside(F_TORSO, F_TROT_TAIL[f], fHead(face ?? F_TROT_EARS[f]), F_BAND, fTrotLegs(f), ...flap);
}
// The gallop, six frames: stretched in the air, the lead forefoot lands,
// the forefeet push off as the hinds swing through, gathered in the air
// with the back arched, the hind feet land, and push.
const F_GALLOP_LEGS: FLeg[][] = [
  [{ hip: 3, o: -6, far: true }, { hip: 18, o: 6, far: true }, { hip: 5, o: -5, up: true }, { hip: 20, o: 5, up: true }],
  [{ hip: 3, o: -5, up: true, far: true }, { hip: 18, o: 3, far: true }, { hip: 5, o: -4, up: true }, { hip: 20, o: 1 }],
  [{ hip: 4, o: -2, up: true, far: true }, { hip: 17, o: -2, far: true }, { hip: 6, o: 0, up: true }, { hip: 18, o: -3 }],
  [{ hip: 7, o: 3, up: true, far: true }, { hip: 14, o: -3, up: true, far: true }, { hip: 9, o: 3, up: true }, { hip: 15, o: -3, up: true }],
  [{ hip: 6, o: 3, far: true }, { hip: 16, o: 2, up: true, far: true }, { hip: 8, o: 2 }, { hip: 18, o: 3, up: true }],
  [{ hip: 4, o: -2, far: true }, { hip: 18, o: 4, up: true, far: true }, { hip: 6, o: -4 }, { hip: 20, o: 5, up: true }],
];
function fGallop(f: number) {
  const torso = f === 3 ? F_TORSO_ARCH : F_TORSO_LONG;
  const tail = f === 3 ? F_TAIL.back : F_TAIL.stream;
  const flap: Layer = f % 2 ? [['ff.', '..f'], 11, 4] : [['f..', '.ff'], 11, 4];
  return fside(torso, tail, fHead(F_HEAD.pinned, 1), [F_BAND[0], 13, 5], fineLegs(FW, F_GALLOP_LEGS[f]), flap);
}

// ===================================================================
// Double density, facing down (towards the viewer): 14 x 22, two spare
// rows on top, anchor at the feet (7, 21). Built from mirrored halves
// (the right half is the left one flipped, h and H swapped), then the
// glints set top right of each eye. Body rows: ears 0-3, face 4-13, the
// bandana and chest 14-17, legs 17-19.
// ===================================================================
const mirrorHalf = (half: Grid): Grid => half.map((r) => r + [...r].reverse().join('').replace(/[hH]/g, (c) => (c === 'h' ? 'H' : 'h')));
// Both eyes: pupils i, glints j at their top right.
const eyes = (rows: Grid, y: number): Grid => rows.map((r, j) => (j === y ? r.slice(0, 3) + 'ij' + r.slice(5, 9) + 'ij' + r.slice(11) : j === y + 1 ? r.slice(0, 3) + 'ii' + r.slice(5, 9) + 'ii' + r.slice(11) : r));
const FD_EARS = {
  up: mirrorHalf(['..p....', '.ptp...', '.pttp..', '.ptttpt']),
  out: mirrorHalf(['p......', 'ptp....', '.pttp..', '..pttpt']),
  pinned: mirrorHalf(['.......', '.......', 'ppp....', '.pttppt']),
  tall: mirrorHalf(['..p....', '.ptp...', '.ptp...', '.pttp..', '.ptttpt']),
};
const FD_FACE = {
  n: eyes(mirrorHalf(['..ttttt', '.ttttwt', '.tthhtw', '.thtttw', '.thtttw', '.ttttww', '.ttwwww', '..twwpp', '..ttwwp', '...ttww']), 3),
  bark: eyes(mirrorHalf(['..ttttt', '.ttttwt', '.tthhtw', '.thtttw', '.thtttw', '.ttttww', '.ttwwpp', '..twwwp', '..twppp', '...twpp']), 3),
  pant: eyes(mirrorHalf(['..ttttt', '.ttttwt', '.tthhtw', '.thtttw', '.thtttw', '.ttttww', '.ttwwww', '..twwpp', '..twwpw', '...twpp']), 3),
};
const FD_BAND = mirrorHalf(['.trrrrr', '.twwkkk', '.ttwwkk', '..tt..k']).map((r, j) => (j === 1 ? r.slice(0, 8) + 'K' + r.slice(9) : r));
const FD_LEGS = {
  stand: mirrorHalf(['..tt...', '..tt...', '.ppp...']),
  liftL: ['..tt....tt....', '..pp....tt....', '.......ppp....'],
  liftR: ['....tt..tt....', '....tt..pp....', '...ppp........'].map((r) => [...r].reverse().join('')),
  wide: mirrorHalf(['.tt....', 'tt.....', 'pp.....']),
  tuck: mirrorHalf(['...tt..', '...pp..', '.......']),
};
const fdown = (ears: Grid, face: Grid, legs: Grid, extra: Layer[] = [], dy = 0) =>
  compose(14, 22, [[[...ears, ...face], 0, 2 + dy - (ears.length - 4)], [FD_BAND, 0, 16 + dy], [legs, 0, 19], ...extra]);
const FD_TROT_LEGS = [FD_LEGS.stand, FD_LEGS.liftL, FD_LEGS.liftL, FD_LEGS.stand, FD_LEGS.liftR, FD_LEGS.liftR];
const FD_TROT_EARS = [FD_EARS.up, FD_EARS.out, FD_EARS.up, FD_EARS.up, FD_EARS.out, FD_EARS.up];
const FD_GALLOP_LEGS = [FD_LEGS.wide, FD_LEGS.stand, FD_LEGS.tuck, FD_LEGS.tuck, FD_LEGS.stand, FD_LEGS.wide];
// The tail shows over the back when it wags.
const FD_WAG: Layer[] = [[['.a', 'tt'], 12, 11], [['a.', 'tt'], 0, 11]];

// ===================================================================
// Double density, facing up (away): 14 x 23, anchor at the feet (7, 22).
// The ears from behind, the bandana's knot at the nape, the back seen from
// above with its saddle and flecks, the rump, the tail and the hind legs.
// The outline is mirrored; the coat over it is not, so it never makes a
// face out of the flecks.
// ===================================================================
const mirrorPlain = (half: Grid): Grid => half.map((r) => r + [...r].reverse().join(''));
const FU_HEAD = {
  up: mirrorPlain(['..p....', '.ptp...', '.pttp..', '.ptttpt', '..ttttt', '..ttttt', '...tttt']),
  out: mirrorPlain(['p......', 'ptp....', '.pttp..', '..pttpt', '..ttttt', '..ttttt', '...tttt']),
  pinned: mirrorPlain(['.......', '.......', 'ppp....', '.pttppt', '..ttttt', '..ttttt', '...tttt']),
  tall: mirrorPlain(['..p....', '.ptp...', '.ptp...', '.pttp..', '.ptttpt', '..ttttt', '...tttt']),
};
// The back seen from above: shoulders, a waist, the thighs and rump.
const FU_BACK = mirrorPlain(['...rrrr', '...tttt', '..ttttt', '..ttttt', '..ttttt', '...tttt', '...tttt', '..ttttt', '..ttttt', '..ttttt', '...tttt']);
const FU_COAT = ['......kk......', '.....dkfd.....', '....dvdddv....', '....vv.dd.....', '.........vv...', '....x.........', '.....v...x....', '.........vx...'];
const FU_LEGS = {
  stand: mirrorPlain(['...tt..', '...tt..', '...tt..', '..ppp..']),
  liftL: ['...tt....tt...', '...pp....tt...', '.........tt...', '........ppp...'],
  liftR: ['...tt....tt...', '...tt....pp...', '...tt.........', '..ppp.........'],
  wide: mirrorPlain(['..tt...', '..tt...', '.tt....', '.pp....']),
  tuck: mirrorPlain(['....tt.', '....tt.', '....pp.', '.......']),
};
const FU_TAIL = {
  down: [['tp', 'tp', 'tp', 'a.'], 6, 17] as Layer,
  left: [['.tp', 'tp.', 'a..'], 4, 17] as Layer,
  right: [['tp.', '.tp', '..a'], 7, 17] as Layer,
  up: [['a.', 'tp', 'tp'], 6, 12] as Layer,
  stream: [['tp', 'tp', 'tp', 'tp', 'a.'], 6, 17] as Layer,
};
const fup = (head: Grid, legs: Grid, tail: Layer, dy = 0) =>
  compose(14, 23, [[head, 0, 1 + dy - (head.length - 7)], [FU_BACK, 0, 8], [FU_COAT, 0, 8], [legs, 0, 19], at(tail, 0, 0)]);
const FU_TROT_LEGS = [FU_LEGS.stand, FU_LEGS.liftL, FU_LEGS.liftL, FU_LEGS.stand, FU_LEGS.liftR, FU_LEGS.liftR];
const FU_TROT_HEAD = [FU_HEAD.up, FU_HEAD.out, FU_HEAD.up, FU_HEAD.up, FU_HEAD.out, FU_HEAD.up];
const FU_TROT_TAIL = [FU_TAIL.left, FU_TAIL.down, FU_TAIL.right, FU_TAIL.right, FU_TAIL.down, FU_TAIL.left];
const FU_GALLOP_LEGS = [FU_LEGS.wide, FU_LEGS.stand, FU_LEGS.tuck, FU_LEGS.tuck, FU_LEGS.stand, FU_LEGS.wide];

// ===================================================================
// Double density, three-quarter heading down-right: the face turned to
// us (both eyes, the blaze, the nose), the body a little shorter, the
// hind feet two rows higher than the fore (further away). 27 x 20, anchor
// (12, 19). Body rows as the side view; the forelegs reach to row 16.
// ===================================================================
const FD3_TORSO: Layer = [['....ttdddddtt...', '..ttttvvtddttttt', '.tttttvttttttvtt', 'ttttxxtttttvtttt', 'tttvttttxtttttt.', 'tttvvttttttttt..', '.ttttttttttxtt..', '..pptttttttttp..'], 4, 4];
const FD3_TORSO_LONG: Layer = [['.....ttdddddt.....', '.ttttttvvtddtttt..', 'tttttttvttttttvtt.', '.tttxxtttttvtttt..', '..tvttttxttttttp..', '...ppttttttttp....'], 3, 5];
const FD3_EARS = {
  up: ['..p....p...', '.ptp..ptp..', '.ptttttttp.'],
  back: ['.p....p....', 'ptp..ptp...', '.ptttttttp.'],
  tall: ['..p....p...', '.ptp..ptp..', '.ptp..ptp..', '.ptttttttp.'],
  pinned: ['...........', 'ppp..ppp...', '.ptttttttp.'],
};
const FD3_FACE = {
  n: ['.ttttttttt.', 'tthhtwthhtt', 'thijtwtijtt', 'thiitwwiitt', '.tttwwwwwtt', '..ttwwpppt.', '...twwwpp..', '....ttw....'],
  bark: ['.ttttttttt.', 'tthhtwthhtt', 'thijtwtijtt', 'thiitwwiitt', '.tttwwwpppt', '..ttwwwwpt.', '...twpppp..', '....twww...'],
  pant: ['.ttttttttt.', 'tthhtwthhtt', 'thijtwtijtt', 'thiitwwiitt', '.tttwwwwwtt', '..ttwwpppt.', '...twppww..', '....tpww...'],
};
const FD3_HEAD = {
  n: [...FD3_EARS.up, ...FD3_FACE.n],
  flop: [...FD3_EARS.back, ...FD3_FACE.n],
  bark: [...FD3_EARS.up, ...FD3_FACE.bark],
  pant: [...FD3_EARS.up, ...FD3_FACE.pant],
  pantShut: [...FD3_EARS.up, ...FD3_FACE.n],
  prick: [...FD3_EARS.tall, ...FD3_FACE.n],
  pinned: [...FD3_EARS.pinned, ...FD3_FACE.n],
};
const fd3Head = (rows: Grid, dy = 0): Layer => [rows, 15, dy - (rows.length - 11)];
const FD3_BAND: Layer = [['.rr.', 'rrrr', 'krrr', 'kKkr', '.kkk', '..kk'], 14, 4];
const FD3_HIPS = [5, 7, 15, 17];
const fd3Legs = (hind: FLeg[], fore: FLeg[]): Layer[] => [
  fineLegs(FW, hind, 12),
  // The forelegs are nearer: a row of leg above them reaches the chest.
  fineLegs(FW, fore.map((l) => ({ ...l })), 13),
  [[[...Array(FW)].map((_, x) => (fore.some((l) => x === l.hip || x === l.hip + 1) ? (fore.find((l) => x === l.hip || x === l.hip + 1)!.far ? 'q' : 't') : '.')).join('')], 0, 12],
];
const fd3 = (...layers: Layer[]) => compose(FW, 20, layers.map((l) => at(l, 0, FTOP)));
function fd3TrotLegs(f: number): Layer[] {
  const o = TROT_O[f] * 2;
  const [fh0, nh, ff, nf] = FD3_HIPS;
  return fd3Legs(
    [{ hip: fh0, o: -o, up: TROT_UP_B[f], far: true }, { hip: nh, o, up: TROT_UP_A[f] }],
    [{ hip: ff, o, up: TROT_UP_A[f], far: true }, { hip: nf, o: -o, up: TROT_UP_B[f] }],
  );
}
const FD3_STAND_LEGS = fd3Legs([{ hip: 5, o: 0, far: true }, { hip: 7, o: 0 }], [{ hip: 15, o: 0, far: true }, { hip: 18, o: 0 }]);
const FD3_BRACE_LEGS = fd3Legs([{ hip: 5, o: 0, far: true }, { hip: 7, o: 0 }], [{ hip: 15, o: -1, far: true }, { hip: 19, o: 2 }]);
const FD3_SKID_LEGS = fd3Legs([{ hip: 6, o: -2, far: true }, { hip: 8, o: -1 }], [{ hip: 16, o: 3, far: true }, { hip: 19, o: 4 }]);
const FD3_TROT_HEAD = [FD3_HEAD.n, FD3_HEAD.flop, FD3_HEAD.n, FD3_HEAD.n, FD3_HEAD.flop, FD3_HEAD.n];
const fd3Stand = (head: Grid = FD3_HEAD.n, tail: Layer = F_TAIL.up, dy = 0) => fd3(FD3_TORSO, at(tail, 1, 0), fd3Head(head, dy), FD3_BAND, ...FD3_STAND_LEGS);
function fd3Trot(f: number, face?: Grid) {
  const flap = f === 1 || f === 4 ? [at(F_FLAP, 1, 0)] : [];
  return fd3(FD3_TORSO, at(F_TROT_TAIL[f], 1, 0), fd3Head(face ?? FD3_TROT_HEAD[f]), FD3_BAND, ...fd3TrotLegs(f), ...flap);
}
const FD3_GALLOP: [FLeg[], FLeg[]][] = [
  [[{ hip: 4, o: -6, far: true }, { hip: 6, o: -5, up: true }], [{ hip: 17, o: 5, far: true }, { hip: 19, o: 5, up: true }]],
  [[{ hip: 4, o: -5, up: true, far: true }, { hip: 6, o: -4, up: true }], [{ hip: 17, o: 3, far: true }, { hip: 19, o: 1 }]],
  [[{ hip: 5, o: -2, up: true, far: true }, { hip: 7, o: 0, up: true }], [{ hip: 16, o: -2, far: true }, { hip: 18, o: -3 }]],
  [[{ hip: 8, o: 3, up: true, far: true }, { hip: 10, o: 3, up: true }], [{ hip: 14, o: -3, up: true, far: true }, { hip: 16, o: -3, up: true }]],
  [[{ hip: 7, o: 3, far: true }, { hip: 9, o: 2 }], [{ hip: 16, o: 2, up: true, far: true }, { hip: 18, o: 3, up: true }]],
  [[{ hip: 5, o: -2, far: true }, { hip: 7, o: -4 }], [{ hip: 17, o: 4, up: true, far: true }, { hip: 19, o: 5, up: true }]],
];
function fd3Gallop(f: number) {
  const tail = f === 3 ? F_TAIL.back : F_TAIL.stream;
  const flap: Layer = f % 2 ? [['ff.', '..f'], 12, 4] : [['f..', '.ff'], 12, 4];
  return fd3(f === 3 ? FD3_TORSO : FD3_TORSO_LONG, tail, fd3Head(FD3_HEAD.pinned, 1), [FD3_BAND[0], 14, 5], ...fd3Legs(...FD3_GALLOP[f]), flap);
}

// ===================================================================
// Double density, three-quarter heading up-right: the back of the head
// and the knot at the nape, the back from above, rump and tail towards
// us; the forefeet higher (further away). 23 x 22, anchor (10, 21).
// ===================================================================
const UW2 = 23;
const FU3_TORSO: Layer = [['..........tttt..', '.......tttttttt.', '....ttttvdddttt.', '..tttttvvdddtt..', '.tttxtttttttt...', 'ttttvtttxttt....', 'tttttttttt......', '.tttttt.........'], 2, 7];
const FU3_HEAD = {
  up: ['.p...p..', 'ptp.ptp.', 'pttptttp', '.ttttttt', '.ttttttt', '..ttttt.', '...ttt..'],
  out: ['p.....p.', 'ptp.ptp.', '.ttptttp', '.ttttttt', '.ttttttt', '..ttttt.', '...ttt..'],
  tall: ['.p...p..', 'ptp.ptp.', 'ptp.ptp.', 'pttptttp', '.ttttttt', '.ttttttt', '..ttttt.', '...ttt..'],
  pinned: ['........', '........', 'ppp.ppp.', '.ttttttt', '.ttttttt', '..ttttt.', '...ttt..'],
};
const fu3Head = (rows: Grid, dy = 0): Layer => [rows, 14, 1 + dy - (rows.length - 7)];
const FU3_BAND: Layer = [['..rr', '.rrk', 'rkk.', 'kf..'], 13, 6];
const FU3_TAIL = {
  down: [['.t', 'tt', 't.', 'a.'], 0, 12] as Layer,
  back: [['.tt', 'tt.', 'a..'], 0, 12] as Layer,
  low: [['.t', '.t', 't.', 'a.'], 0, 13] as Layer,
  up: [['a.', 'tt', '.t'], 0, 9] as Layer,
  wag: [['.a', '.t', 'tt'], 0, 9] as Layer,
  stream: [['.tt', 'tt.', 't..', 'a..'], 0, 12] as Layer,
};
// Hind legs nearer (lower), forelegs further off under the chest.
const fu3Legs = (hind: FLeg[], fore: FLeg[]): Layer[] => [fineLegs(UW2, fore, 14), fineLegs(UW2, hind, 15)];
function fu3TrotLegs(f: number): Layer[] {
  const o = TROT_O[f] * 2;
  return fu3Legs(
    [{ hip: 2, o: -o, up: TROT_UP_B[f], far: true }, { hip: 5, o, up: TROT_UP_A[f] }],
    [{ hip: 12, o, up: TROT_UP_A[f], far: true }, { hip: 15, o: -o, up: TROT_UP_B[f] }],
  );
}
const FU3_STAND_LEGS = fu3Legs([{ hip: 2, o: 0, far: true }, { hip: 5, o: 0 }], [{ hip: 12, o: 0, far: true }, { hip: 15, o: 0 }]);
const FU3_WIDE_LEGS = fu3Legs([{ hip: 2, o: -1, far: true }, { hip: 5, o: 0 }], [{ hip: 12, o: 0, far: true }, { hip: 16, o: 1 }]);
const FU3_SKID_LEGS = fu3Legs([{ hip: 3, o: -2, far: true }, { hip: 6, o: -1 }], [{ hip: 13, o: 3, far: true }, { hip: 16, o: 3 }]);
const FU3_TROT_HEAD = [FU3_HEAD.up, FU3_HEAD.out, FU3_HEAD.up, FU3_HEAD.up, FU3_HEAD.out, FU3_HEAD.up];
const FU3_TROT_TAIL = [FU3_TAIL.down, FU3_TAIL.back, FU3_TAIL.low, FU3_TAIL.low, FU3_TAIL.back, FU3_TAIL.down];
const fu3 = (...layers: Layer[]) => compose(UW2, 22, layers.map((l) => at(l, 0, 2))); // two spare rows on top
const fu3Stand = (head: Grid = FU3_HEAD.up, tail: Layer = FU3_TAIL.down, dy = 0) => fu3(FU3_TORSO, tail, fu3Head(head, dy), FU3_BAND, ...FU3_STAND_LEGS);
function fu3Trot(f: number) {
  const flap = f === 1 || f === 4 ? [[['f.', '.f'], 11, 6] as Layer] : [];
  return fu3(FU3_TORSO, FU3_TROT_TAIL[f], fu3Head(FU3_TROT_HEAD[f]), FU3_BAND, ...fu3TrotLegs(f), ...flap);
}
const FU3_GALLOP: [FLeg[], FLeg[]][] = [
  [[{ hip: 1, o: -4, far: true }, { hip: 3, o: -4, up: true }], [{ hip: 13, o: 4, far: true }, { hip: 16, o: 4, up: true }]],
  [[{ hip: 1, o: -3, up: true, far: true }, { hip: 3, o: -3, up: true }], [{ hip: 13, o: 2, far: true }, { hip: 16, o: 1 }]],
  [[{ hip: 2, o: -1, up: true, far: true }, { hip: 5, o: 0, up: true }], [{ hip: 12, o: -2, far: true }, { hip: 14, o: -2 }]],
  [[{ hip: 5, o: 2, up: true, far: true }, { hip: 7, o: 2, up: true }], [{ hip: 10, o: -2, up: true, far: true }, { hip: 12, o: -2, up: true }]],
  [[{ hip: 4, o: 2, far: true }, { hip: 6, o: 1 }], [{ hip: 12, o: 1, up: true, far: true }, { hip: 15, o: 2, up: true }]],
  [[{ hip: 2, o: -2, far: true }, { hip: 4, o: -3 }], [{ hip: 13, o: 3, up: true, far: true }, { hip: 16, o: 4, up: true }]],
];
function fu3Gallop(f: number) {
  const flap: Layer = f % 2 ? [['ff', '.f'], 10, 6] : [['f.', 'ff'], 10, 6];
  return fu3(FU3_TORSO, FU3_TAIL.stream, fu3Head(FU3_HEAD.pinned, 1), FU3_BAND, ...fu3Legs(...FU3_GALLOP[f]), flap);
}

// ===================================================================
// Double density, lying down and the nose-down poses, side on.
// ===================================================================
// Lying: the sphinx, head up, forepaws out in front, the hind leg tucked.
const FL_TORSO: Layer = [['.....ttdddddtt......', '..tttttvvtddtttttt..', '.ttttttvttttttvtttt.', 'tttttxxtttttvttvvttt', 'ttttvttttxttttttxttt', 'ttttttttttttttttttt.', '.pppppppppppppppppp.'], 2, 7];
const FL_TORSO_BREATH: Layer = [['....tttdddddttt.....', '.ttttttvvtddttttttt.', '.ttttttvttttttvtttt.', 'tttttxxtttttvttvvttt', 'ttttvttttxttttttxttt', 'ttttttttttttttttttt.', '.pppppppppppppppppp.'], 2, 6];
const FL_HIND: Layer = [['..ttttt.', '.tttttt.', 'ttttttt.', 'ppppppp.'], 2, 10];
const FL_PAWS: Layer = [['tttttttt..', 'pppppppp..'], 16, 13];
const FL_TAIL = { rest: [['att.', '.ttt'], 0, 12] as Layer, up: [['a...', '.t..', '.ttt'], 0, 11] as Layer };
const FL_BAND: Layer = [['.rr.', 'rrrr', 'krrr', 'kKkr', '.kkk'], 13, 6];
const fLie = (torso: Layer, tail: Layer) => fside(tail, torso, FL_HIND, fHead(F_HEAD.n, 2), FL_BAND, FL_PAWS);
// Settling: a crouch, then sinking with the forefeet sliding out.
const F_SETTLE = [
  fside(F_TAIL.back, at(F_TORSO, 0, 1), fHead(F_HEAD.n, 1), at(F_BAND, 0, 1), fineLegs(FW, [{ hip: 4, o: 1, up: true, far: true }, { hip: 15, o: 0, far: true }, { hip: 6, o: 1, up: true }, { hip: 17, o: 1 }], 13)),
  fside(FL_TAIL.rest, at(F_TORSO, 0, 2), FL_HIND, fHead(F_HEAD.n, 2), at(F_BAND, 0, 2), [['..tt.....', '.tttttt..', 'pppppppp.'], 15, 13]),
];
// Nose to the ground: the head dipped, muzzle down, tail up and busy.
const F_SNIFF_HEAD = ['.p..p.....', 'ptpptp....', 'pttttp....', 'tttttttt..', 'tttthhtt..', 'ttttjiht..', '.ttthhitw.', '..tttttww.', '...tttwww.', '....ttwwpp', '.....ttwpp'];
const F_SNIFF_HEAD2 = ['.p..p.....', 'ptpptp....', 'pttttp....', 'tttttttt..', 'tttthhtt..', 'ttttjiht..', '.ttthhitw.', '..tttttww.', '...tttwww.', '....ttwww.', '.....ttwpp'];
const fSniff = (head: Grid, tail: Layer, legs: Layer) => fside(tail, F_TORSO, [head, 16, 3], [['.rr', 'rrr', 'krr', 'kKk'], 14, 4], legs);
const F_SNIFF_LEGS = fineLegs(FW, [{ hip: 4, o: 0, far: true }, { hip: 16, o: -1, far: true }, { hip: 6, o: 0 }, { hip: 18, o: 0 }]);
// Digging: rump up, the forelegs scraping in turn, a look into the hole.
const F_DIG_TORSO: Layer = [['tttdd...............', 'tttvddtt............', 'ttttvvttttt.........', 'tttxtttttvtttt......', '.ttttttxtttttttt....', '..tttvttttttttttt...', '....ttttttttttttttt.', '......pptttttttttp..'], 3, 1];
const F_DIG_HEAD = ['..p..p....', '.ptpptp...', '.pttttp...', '.tttttttt.', 'tttthhttt.', 'ttttjihtw.', '.tttthhww.', '..ttttwwww', '...tttwwpp'];
const F_DIG_HEAD_LOOK = ['..p..p....', '.ptpptp...', '.pttttp...', '.tttttttt.', 'tttthhttt.', 'ttttjihtt.', '.tttthhtw.', '..tttttww.', '...tttwww.', '....ttwpp.'];
const F_DIG_PAWS = [['..tt.', '.tt..', 'tt...', 'pp...'], ['..tt..', '..ttt.', '...ttp', '....pp'], ['..tt..', '..tt..', '..ttpp', '......']];
const fDig = (f: number) =>
  fside([['.a', 'tt', 't.'], 2 + (f % 2), -2], F_DIG_TORSO, [f === 3 ? F_DIG_HEAD_LOOK : F_DIG_HEAD, 16, 6], [['rr.', 'rrr', 'krr'], 15, 6],
    [['tt.....', 'tt.....', 'tt.....', 'tt.....', 'tt.....', 'ttt....', 'ppp....'], 4, 8], [['tt', 'tt', 'tt', 'tt', 'ppp'], 7, 10], [F_DIG_PAWS[f % 3], 16, 11]);

// Lying down facing us: head on the forepaws, the haunches either side.
const fdLie = (breath: boolean, wag: boolean) => compose(14, 22, [
  [mirrorHalf(['.......', '.......', '.......', '..p....', '.ptp...', '.pttp..', '.ptttpt']), 0, 0],
  [eyes(mirrorHalf(['..ttttt', '.ttttwt', '.tthhtw', '.thtttw', '.thtttw', '.ttttww', '.ttwwww', '..twwpp', '..ttwwp']), 3), 0, 7],
  [mirrorHalf([breath ? 'tttttwr' : '.ttttwr', 'tttttww', 'tttttww', 'ttt.ttt', '.ppp.pp']), 0, 15],
  ...(wag ? [[['a', 't'], 13, 15] as Layer] : []),
]);
// Lying down facing away: the back rounded, the tail laid round the side.
const fuLie = (breath: boolean, wag: boolean) => compose(14, 23, [
  [FU_HEAD.up, 0, 6],
  [mirrorPlain(['...rrrr', '..ttttt', breath ? 'tttttt' + 't' : '.tttttt', '.tttttt', '.tttttt', '..ttttt', '..ppppp']), 0, 13],
  [FU_COAT.slice(0, 5), 0, 13],
  [wag ? ['tta', 'tt.'] : ['.ta', 'tt.'], 11, 18],
]);

// One facing's full set of poses.
export interface DogPoses {
  // Side view only: idles and the shake-off.
  sniff?: Sprite[]; // standing, nose to the ground (two frames)
  sniffWalk?: Sprite[]; // trotting with the nose down (six frames)
  dig?: Sprite[]; // scraping (three frames) and a look into the hole
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
  // Poses still drawn at world scale come up through Scale2x; the rest
  // are drawn in fine pixels.
  const S = (rows: string[], ax: number, ay: number) => {
    const r = dressRows(rows, facing, look, wet);
    return spr2(rimLight(up2(recolor(r, bandana)), 't', 's', false), ax * 2, ay * 2 + 1);
  };
  const F = (rows: string[], ax: number, ay: number) => {
    const r = dressFine(rows, look, wet).map((x) => x.replace(/q/g, 't'));
    return spr2(rimLight(recolor(r, bandana), 't', 's', false), ax, ay);
  };
  const six = [0, 1, 2, 3, 4, 5];

  // ---- side ----
  const s = (rows: string[]) => S(rows, 6, 8);
  const f2 = (rows: string[]) => F(rows, 12, 18);
  const sSettle = F_SETTLE.map(f2);
  const sLie = f2(fLie(FL_TORSO, FL_TAIL.rest)), sLieBreath = f2(fLie(FL_TORSO_BREATH, FL_TAIL.rest)), sLieWag = f2(fLie(FL_TORSO, FL_TAIL.up));
  const sideP: DogPoses = {
    stand: f2(fStand()),
    run: six.map((f) => f2(fTrot(f))),
    runPant: six.map((f) => f2(fTrot(f, f % 3 === 1 ? F_HEAD.pantShut : F_HEAD.pant))),
    sprint: six.map((f) => f2(fGallop(f))),
    brace: f2(fside(F_TORSO, F_TAIL.up, fHead(F_HEAD.n, 1), [F_BAND[0], 13, 5], F_BRACE_LEGS)),
    bark: f2(fside(F_TORSO, F_TAIL.up, fHead(F_HEAD.bark), F_BAND, F_BRACE_LEGS)),
    skid: f2(fside(F_TORSO, F_TAIL.back, fHead(F_HEAD.prick, -1), F_BAND, F_SKID_LEGS)),
    pant: [f2(fStand(F_HEAD.pant, F_TAIL.back)), f2(fStand(F_HEAD.pantShut, F_TAIL.back, 0))],
    proud: [f2(fside(F_TORSO, F_TAIL.wagA, fHead(F_HEAD.n, -2), F_BAND_RAISED, F_STAND_LEGS)), f2(fside(F_TORSO, F_TAIL.wagB, fHead(F_HEAD.n, -2), F_BAND_RAISED, F_STAND_LEGS))],
    look: f2(fStand(F_HEAD.prick, F_TAIL.up, -1)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
    sniff: [f2(fSniff(F_SNIFF_HEAD, F_TAIL.wagA, F_SNIFF_LEGS)), f2(fSniff(F_SNIFF_HEAD2, F_TAIL.wagB, F_SNIFF_LEGS))],
    sniffWalk: six.map((f) => f2(fSniff(f % 2 ? F_SNIFF_HEAD2 : F_SNIFF_HEAD, f % 3 ? F_TAIL.wagA : F_TAIL.wagB, fTrotLegs(f)))),
    dig: [0, 1, 2, 3].map((f) => f2(fDig(f))),
    scratch: SCRATCH.map(s),
    shake: SHAKE.map(s),
  };

  // ---- three-quarter views (lying down uses the side view's poses) ----
  facing = 'dr';
  const d3 = (rows: string[]) => F(rows, 12, 19);
  const drP: DogPoses = {
    stand: d3(fd3Stand()),
    run: six.map((f) => d3(fd3Trot(f))),
    runPant: six.map((f) => d3(fd3Trot(f, f % 3 === 1 ? FD3_HEAD.pantShut : FD3_HEAD.pant))),
    sprint: six.map((f) => d3(fd3Gallop(f))),
    brace: d3(fd3(FD3_TORSO, at(F_TAIL.up, 1, 0), fd3Head(FD3_HEAD.n, 1), [FD3_BAND[0], 14, 5], ...FD3_BRACE_LEGS)),
    bark: d3(fd3(FD3_TORSO, at(F_TAIL.up, 1, 0), fd3Head(FD3_HEAD.bark), FD3_BAND, ...FD3_BRACE_LEGS)),
    skid: d3(fd3(FD3_TORSO, at(F_TAIL.back, 1, 0), fd3Head(FD3_HEAD.prick, -1), FD3_BAND, ...FD3_SKID_LEGS)),
    pant: [d3(fd3Stand(FD3_HEAD.pant, F_TAIL.back)), d3(fd3Stand(FD3_HEAD.pantShut, F_TAIL.back))],
    proud: [d3(fd3(FD3_TORSO, F_TAIL.wagA, fd3Head(FD3_HEAD.n, -2), at(FD3_BAND, 0, -1), ...FD3_STAND_LEGS)), d3(fd3(FD3_TORSO, F_TAIL.wagB, fd3Head(FD3_HEAD.n, -2), at(FD3_BAND, 0, -1), ...FD3_STAND_LEGS))],
    look: d3(fd3Stand(FD3_HEAD.prick, F_TAIL.up, -1)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
  };
  facing = 'ur';
  const u3 = (rows: string[]) => F(rows, 10, 21);
  const urP: DogPoses = {
    stand: u3(fu3Stand()),
    run: six.map((f) => u3(fu3Trot(f))),
    runPant: six.map((f) => u3(fu3Trot(f))),
    sprint: six.map((f) => u3(fu3Gallop(f))),
    brace: u3(fu3(FU3_TORSO, FU3_TAIL.down, fu3Head(FU3_HEAD.up, 1), FU3_BAND, ...FU3_WIDE_LEGS)),
    bark: u3(fu3(FU3_TORSO, FU3_TAIL.down, fu3Head(FU3_HEAD.tall, -2), FU3_BAND, ...FU3_WIDE_LEGS)),
    skid: u3(fu3(FU3_TORSO, FU3_TAIL.back, fu3Head(FU3_HEAD.tall), FU3_BAND, ...FU3_SKID_LEGS)),
    pant: [u3(fu3Stand(FU3_HEAD.up, FU3_TAIL.low)), u3(fu3Stand(FU3_HEAD.up, FU3_TAIL.low, 1))],
    proud: [u3(fu3Stand(FU3_HEAD.up, FU3_TAIL.up, -2)), u3(fu3Stand(FU3_HEAD.up, FU3_TAIL.wag, -2))],
    look: u3(fu3Stand(FU3_HEAD.tall)),
    settle: sSettle,
    lie: sLie,
    lieBreath: sLieBreath,
    lieWag: sLieWag,
  };

  // ---- down ----
  facing = 'down';
  const fd = (rows: string[]) => F(rows, 7, 21);
  const downP: DogPoses = {
    stand: fd(fdown(FD_EARS.up, FD_FACE.n, FD_LEGS.stand)),
    run: six.map((f) => fd(fdown(FD_TROT_EARS[f], FD_FACE.n, FD_TROT_LEGS[f]))),
    runPant: six.map((f) => fd(fdown(FD_TROT_EARS[f], f % 3 === 1 ? FD_FACE.n : FD_FACE.pant, FD_TROT_LEGS[f]))),
    sprint: six.map((f) => fd(fdown(FD_EARS.pinned, FD_FACE.n, FD_GALLOP_LEGS[f], [], 1))),
    brace: fd(fdown(FD_EARS.pinned, FD_FACE.n, FD_LEGS.wide, [], 1)),
    bark: fd(fdown(FD_EARS.up, FD_FACE.bark, FD_LEGS.wide)),
    skid: fd(fdown(FD_EARS.tall, FD_FACE.n, FD_LEGS.wide)),
    pant: [fd(fdown(FD_EARS.up, FD_FACE.pant, FD_LEGS.stand)), fd(fdown(FD_EARS.up, FD_FACE.n, FD_LEGS.stand))],
    proud: [fd(fdown(FD_EARS.up, FD_FACE.n, FD_LEGS.stand, [FD_WAG[0]], -2)), fd(fdown(FD_EARS.up, FD_FACE.n, FD_LEGS.stand, [FD_WAG[1]], -2))],
    look: fd(fdown(FD_EARS.tall, FD_FACE.n, FD_LEGS.stand)),
    settle: [fd(fdLie(false, false))],
    lie: fd(fdLie(false, false)),
    lieBreath: fd(fdLie(true, false)),
    lieWag: fd(fdLie(false, true)),
  };

  // ---- up ----
  facing = 'up';
  const fu = (rows: string[]) => F(rows, 7, 22);
  const upP: DogPoses = {
    stand: fu(fup(FU_HEAD.up, FU_LEGS.stand, FU_TAIL.down)),
    run: six.map((f) => fu(fup(FU_TROT_HEAD[f], FU_TROT_LEGS[f], FU_TROT_TAIL[f]))),
    runPant: six.map((f) => fu(fup(FU_TROT_HEAD[f], FU_TROT_LEGS[f], FU_TROT_TAIL[f]))),
    sprint: six.map((f) => fu(fup(FU_HEAD.pinned, FU_GALLOP_LEGS[f], FU_TAIL.stream, 1))),
    brace: fu(fup(FU_HEAD.up, FU_LEGS.wide, FU_TAIL.down, 1)),
    // Head thrown up.
    bark: fu(fup(FU_HEAD.tall, FU_LEGS.wide, FU_TAIL.down, -1)),
    skid: fu(fup(FU_HEAD.tall, FU_LEGS.wide, FU_TAIL.left)),
    pant: [fu(fup(FU_HEAD.up, FU_LEGS.stand, FU_TAIL.down)), fu(fup(FU_HEAD.up, FU_LEGS.stand, FU_TAIL.down, 1))],
    proud: [fu(fup(FU_HEAD.up, FU_LEGS.stand, FU_TAIL.up, -1)), fu(fup(FU_HEAD.up, FU_LEGS.stand, at(FU_TAIL.up, 1, 0), -1))],
    look: fu(fup(FU_HEAD.tall, FU_LEGS.stand, FU_TAIL.down)),
    settle: [fu(fuLie(false, false))],
    lie: fu(fuLie(false, false)),
    lieBreath: fu(fuLie(true, false)),
    lieWag: fu(fuLie(false, true)),
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
  act?: 'sniff' | 'dig' | null; // on the scent, or digging (shown side on)
  actT?: number; // seconds into it
  t: number;
}

// Digging: scrape, scrape, a look into the hole, and again.
const DIG_SEQ = [0, 1, 0, 1, 0, 1, 2, 3, 3, 3];

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
  if (st.act) {
    // Side on, towards whichever side it faced.
    const Q = S.poses.side, left = v >= 3 && v <= 5;
    const T = st.actT ?? st.t;
    if (st.act === 'dig' && Q.dig) return { s: Q.dig[DIG_SEQ[Math.floor(T * 7) % DIG_SEQ.length]], flip: left, bob: 0 };
    if (st.act === 'sniff' && st.speed > 6 && Q.sniffWalk) return { s: Q.sniffWalk[((Math.floor(st.phase * 1.5) % 6) + 6) % 6], flip: left, bob: 0 };
    if (st.act === 'sniff' && Q.sniff) return { s: Q.sniff[Math.floor(T * 4) % 2], flip: left, bob: 0 };
  }
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
