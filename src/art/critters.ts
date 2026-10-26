import { spr, type Sprite } from '../gfx/sprite';

// Little lives that make the valley feel inhabited: butterflies and birds by
// day. Anchors sit at the body.

// Butterfly: wings up, open, down. Buttercup or wool wings, plum body.
const FLY = [
  ['y.y', '.p.'],
  ['ypy', '...'],
  ['.p.', 'y.y'],
];

// A small pale bird (it has to read over the plum-marked canopy too):
// wings up, level, down.
const BIRD = [
  ['p...p', '.p.p.', '..p..'],
  ['.....', 'pp.pp', '..p..'],
  ['.....', '..p..', 'pp.pp'],
];

// Rabbit (sage-brown, white scut, plum ear tips): sitting, nibbling, a hop.
const RABBIT = [
  ['..p.', '..sp', '.ss.', 'wsss'],
  ['....', '..p.', '.ssp', 'wsss'],
  ['....', '...sp', 'wssss', 's...s'],
];
// Deer: sage coat, wool rump and belly, plum legs; standing, head down to
// graze, bounding away.
const DEER = [
  ['........pp', '........ss', '........sp', '.......ss.', 'w.sssssss.', 'wssssssss.', '.wwwwwww..', '.p.p..p.p.', '.p.p..p.p.', '.p.p..p.p.'],
  ['..........', '..........', '..........', '..........', 'w.sssssss.', 'wsssssssss', '.wwwwwwwsp', '.p.p..p.p.', '.p.p..p.p.', '.p.p..p.p.'],
  ['........pp', '........ss', 'w.......sp', 'wssssssss.', '.sssssssss', '..wwwwwww.', 'p.p.....pp', 'p.......p.', '..........', '..........'],
];
// Crow: perched, and two wingbeats in flight.
const CROW = [
  ['..pp', '.ppp', 'pp..', '.p..'],
  ['p...p', '.ppp.', '..p..'],
  ['.....', 'ppppp', '..p..'],
];
// Frog on the bank: sitting, mid-leap.
const FROG = [
  ['t.t', 'ttt'],
  ['.t.', 'ttt', 't.t'],
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

export function critterSprites(): CritterSprites {
  if (S) return S;
  S = {
    flyY: FLY.map((r) => spr(r, 1, 1)),
    flyW: FLY.map((r) => spr(r.map((row) => row.replace(/y/g, 'w')), 1, 1)),
    bird: BIRD.map((r) => spr(r.map((row) => row.replace(/p/g, 'w')), 2, 1)),
    rabbit: RABBIT.map((r) => spr(r)),
    deer: DEER.map((r) => spr(r)),
    crow: CROW.map((r, i) => spr(r, i === 0 ? 2 : 2, r.length - 1)),
    frog: FROG.map((r) => spr(r)),
  };
  return S;
}
