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

export interface CritterSprites {
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
  };
  return S;
}
