import { spr, type Sprite } from '../gfx/sprite';
import { PX } from '../gfx/screen';

// Little lives that make the valley feel inhabited, drawn on the fine grid
// (dense sprites: two grid pixels to a world pixel). Anchors sit at the body
// or the feet, in grid pixels.

// Butterfly: wings up, open, down. Buttercup or wool wings with a spot,
// plum body.
const FLY = [
  ['yy...yy', 'yyp.pyy', '.y.p.y.', '...p...'],
  ['.......', 'yyypyyy', 'ypypypy', '...p...'],
  ['...p...', '...p...', '.yypyy.', 'yy.p.yy'],
];

// A small pale bird (it has to read over the canopy too): wings up, level,
// down.
const BIRD = [
  ['p.......p', '.pp...pp.', '...pwp...', '....p....'],
  ['.........', 'ppp.w.ppp', '...ppp...', '....p....'],
  ['.........', '....w....', '...ppp...', 'ppp...ppp'],
];

// Rabbit (sage, moss-lit back, white scut, plum ear tips and eye): sitting,
// nibbling, a hop.
const RABBIT = [
  ['.....pp..', '.....sp..', '.....ss..', '....ssss.', '....sssps', '...ossss.', '.ossssss.', 'wsssssss.', 'wsssssss.', '.ss..sss.'],
  ['.........', '.........', '.....pp..', '.....ssp.', '....sssss', '...osssps', '.ossssss.', 'wssssssss', 'wsssssss.', '.ss..sss.'],
  ['..........', '......pp..', '......sp..', '.....ssss.', 'w.osssssps', 'wsssssssss', '.ssssssss.', 's........s', '..........', '..........'],
];
// Deer: sage coat lit along the back, wool rump and belly, plum legs and
// muzzle; standing head up, grazing, bounding away.
const DEER = [
  ['................pp..', '...............psp..', '................sss.', '................sssp', '...............ss...', '..............ss....', '.w..ooooooooosss....', 'ww.ssssssssssss.....', 'wwsssssssssssss.....', '.wsssssssssssss.....', '..wwwwwwwwwwww......', '..sp.sp....sp.sp....', '..sp.sp....sp.sp....', '..p..p.....p..p.....', '..p..p.....p..p.....', '..p..p.....p..p.....', '..p..p.....p..p.....', '.pp.pp....pp.pp.....'],
  ['....................', '....................', '....................', '....................', '....................', '....................', '.w..ooooooooooo.....', 'ww.ssssssssssssss...', 'wwsssssssssssssssss.', '.wsssssssssssssss.sp', '..wwwwwwwwwwww...psp', '..sp.sp....sp.sp....', '..sp.sp....sp.sp....', '..p..p.....p..p.....', '..p..p.....p..p.....', '..p..p.....p..p.....', '..p..p.....p..p.....', '.pp.pp....pp.pp.....'],
  ['................pp..', '...............psp..', 'ww..............sss.', 'www.............sssp', '.wsoooooooooooosss..', '..sssssssssssssss...', '..ssssssssssssssss..', '...wwwwwwwwwwwww....', '..ps.............sp.', '.ps...............sp', 'pp.................p', '....................', '....................', '....................', '....................', '....................', '....................', '....................'],
];
// Crow: perched, and two wingbeats in flight; a teal glint on its back.
const CROW = [
  ['....pp..', '...pppp.', '..pptpp.', '.ppppp..', 'ppppp...', '.p.p....', '.p.p....'],
  ['p.......p', 'pp.....pp', '.ppptppp.', '...ppp...', '....p....'],
  ['.........', 'ppptpppp.', '..ppppppp', '....pp...', '....p....'],
];
// Frog on the bank: sitting, mid-leap.
const FROG = [
  ['.t..t.', 'tttttt', 'tsssst', 't.tt.t'],
  ['..tt..', '.tttt.', 'tsssst', 't....t', 't....t'],
];

export interface CritterSprites {
  rabbit: Sprite[];
  deer: Sprite[];
  crow: Sprite[];
  frog: Sprite[];
  flyY: Sprite[];
  flyW: Sprite[];
  bird: Sprite[];
}

let S: CritterSprites | null = null;

const dense = { density: PX };
export function critterSprites(): CritterSprites {
  if (S) return S;
  S = {
    flyY: FLY.map((r) => spr(r, 3, 2, dense)),
    flyW: FLY.map((r) => spr(r.map((row) => row.replace(/y/g, 'w')), 3, 2, dense)),
    bird: BIRD.map((r) => spr(r.map((row) => row.replace(/p/g, 'w')), 4, 2, dense)),
    rabbit: RABBIT.map((r) => spr(r, 4, r.length - 1, dense)),
    deer: DEER.map((r) => spr(r, 9, r.length - 1, dense)),
    crow: CROW.map((r) => spr(r, 4, r.length - 1, dense)),
    frog: FROG.map((r) => spr(r, 3, r.length - 1, dense)),
  };
  return S;
}
