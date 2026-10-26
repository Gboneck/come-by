import { makeDogSprites, type DogSprites } from './dog';

// The player's heeler, dressed to taste: coat markings and what it wears at
// the neck. Every option is a small rewrite of the pose grids in dog.ts, so
// all frames (trot, gallop, bark, lying down) pick it up. Whatever the neck
// piece, it is always Bandana red: the player's one accent.
//
// Grid chars: t teal coat, w wool flecks and muzzle, p plum mask, ears and
// feet, r the red neck piece.

export type Speckle = 'light' | 'classic' | 'heavy';
export type Mask = 'both' | 'one' | 'none';
export type Neck = 'bandana' | 'neckerchief' | 'collar';
export type DogFacing = 'side' | 'dr' | 'ur' | 'down' | 'up';

export interface DogLook {
  speckle: Speckle;
  mask: Mask; // the dark patches round the eyes
  saddle: boolean; // a dark patch over the back
  tailTip: boolean; // a white tip to the tail
  neck: Neck;
}

export const DEFAULT_DOG: DogLook = { speckle: 'classic', mask: 'both', saddle: false, tailTip: false, neck: 'bandana' };

const lookKey = (l: DogLook) => `${l.speckle}-${l.mask}-${+l.saddle}-${+l.tailTip}-${l.neck}`;

// Coat pixels that take flecks: a fixed scatter, so frames stay steady.
const fleck = (x: number, y: number) => (x * 3 + y * 5) % 7 === 0;

// The pose grids in dog.ts mark what a look changes with template letters
// (k bandana bulk, f its loose ends, n a neckerchief's point, e E the mask
// round each eye, h the face beside the eye side on, a the tail tip); flecks and the saddle go by where the
// body is: behind the neck band side on, below it from the front or back.
// `wet`: soaked, the flecks on the body go dark.
export function dressRows(rows: string[], facing: DogFacing, look: DogLook, wet = false): string[] {
  const g = rows.map((r) => r.split(''));
  const H = g.length;
  const at = (x: number, y: number) => (y >= 0 && y < H ? g[y][x] ?? '.' : '.');
  const set = (x: number, y: number, c: string) => { if (y >= 0 && y < H && x >= 0 && x < g[y].length) g[y][x] = c; };
  const coat = (c: string) => c === 't' || c === 'w';
  // The neck band: its top row and (side on) its column.
  let r0 = -1, rc = -1;
  for (let y = 0; y < H && r0 < 0; y++) {
    const i = g[y].findIndex((c) => c === 'r' || c === 'k');
    if (i >= 0) { r0 = y; rc = i; }
  }
  const body = (x: number, y: number) => (facing === 'down' || facing === 'up' ? r0 >= 0 && y > r0 : x < (rc >= 0 ? rc : 9));
  const legs = H - (facing === 'dr' ? 3 : 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < g[y].length; x++) {
      const c = at(x, y);
      if (!body(x, y)) continue;
      if (c === 'w' && (look.speckle === 'light' && (facing !== 'down' || y === r0 + 1))) set(x, y, 't');
      else if (c === 't' && look.speckle === 'heavy' && y < legs && (facing === 'down' || facing === 'up' ? (x + y) % 3 === 0 : x >= 2 && fleck(x, y))) set(x, y, 'w');
      if (wet && at(x, y) === 'w') set(x, y, 's');
    }
  if (look.saddle && rc >= 0) {
    if (facing === 'up') {
      for (let y = r0 + 1; y <= r0 + 2; y++) for (let x = 2; x <= 4; x++) if (at(x, y) === 't') set(x, y, 'p');
    } else if (facing !== 'down') {
      // The top of the back, just behind the shoulders.
      for (let x = rc - 5; x <= rc - 3; x++)
        for (let y = 0; y < H; y++) if (coat(at(x, y))) { set(x, y, 'p'); break; } else if (at(x, y) !== '.') break;
    }
  }
  const T: Record<string, string> = {
    k: look.neck === 'collar' ? 't' : 'r',
    f: look.neck === 'collar' ? '.' : 'r',
    n: look.neck === 'neckerchief' ? 'r' : 't',
    e: look.mask === 'none' ? 'w' : 'p',
    E: look.mask === 'both' ? 'p' : 'w',
    h: look.mask === 'none' ? 'w' : 't', // side on, a pale face round the eye
    a: look.tailTip ? 'w' : 't',
  };
  return g.map((r) => r.map((c) => T[c] ?? c).join(''));
}

// The player's sprites for a look, built once per look.
const cache = new Map<string, DogSprites>();
let current: DogLook = { ...DEFAULT_DOG };

export function setPlayerLook(look: DogLook) {
  current = { ...look };
}

export function playerDogSprites(look: DogLook = current): DogSprites {
  const k = lookKey(look);
  let s = cache.get(k);
  if (!s) {
    s = makeDogSprites('r', look);
    cache.set(k, s);
  }
  return s;
}

// A friend's dog in co-op: their markings, but a buttercup neck piece, so
// red is only ever you on your own screen.
export function friendDogSprites(look: DogLook): DogSprites {
  const k = `y-${lookKey(look)}`;
  let s = cache.get(k);
  if (!s) {
    s = makeDogSprites('y', look);
    cache.set(k, s);
  }
  return s;
}

// The soaked twin of a set of sprites, built the first time it gets wet.
const wets = new WeakMap<DogSprites, DogSprites>();
export function soaked(s: DogSprites): DogSprites {
  if (s.wet) return s;
  let w = wets.get(s);
  if (!w) wets.set(s, (w = makeDogSprites(s.bandana, s.look, true)));
  return w;
}
