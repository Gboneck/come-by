import { makeDogSprites, type DogSprites } from './dog';

// The player's heeler, dressed to taste: coat markings and what it wears at
// the neck. The pose grids in dog.ts mark everything a look changes with
// template letters (see dressFine), so every frame of every view picks it
// up. Whatever the neck piece, it is always Bandana red: the player's one
// accent.

export type Speckle = 'light' | 'classic' | 'heavy';
export type Mask = 'both' | 'one' | 'none';
export type Neck = 'bandana' | 'neckerchief' | 'collar';
export type Tag = 'none' | 'brass' | 'bone' | 'gold';

export interface DogLook {
  speckle: Speckle;
  mask: Mask; // the dark patches round the eyes
  saddle: boolean; // a dark patch over the back
  tailTip: boolean; // a white tip to the tail
  neck: Neck;
  // Dug up on the treasure hunt (systems/loot.ts), so missing from older
  // looks.
  tag?: Tag; // a tag on a collar
  socks?: boolean; // white lower legs
  blaze?: boolean; // a white blaze up the face
}

export const DEFAULT_DOG: DogLook = { speckle: 'classic', mask: 'both', saddle: false, tailTip: false, neck: 'bandana' };

const lookKey = (l: DogLook) => `${l.speckle}-${l.mask}-${+l.saddle}-${+l.tailTip}-${l.neck}-${l.tag ?? 'none'}-${+!!l.socks}-${+!!l.blaze}`;

// The player's sprites for a look, built once per look.
const cache = new Map<string, DogSprites>();
let current: DogLook = { ...DEFAULT_DOG };

export function setPlayerLook(look: DogLook) {
  current = { ...look };
}

export const playerLook = (): DogLook => current;

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

// Fine-pixel grids (double density) carry every look in their letters, so
// there is no geometry to guess: k bandana bulk, K a fold in it, f its loose
// ends, n a neckerchief's longer point, u where a collar's tag hangs, i the
// eye, j its glint, h the mask round the near eye, H round the far one, b a
// blaze, a the tail tip, v a fleck, x a fleck only a heavily flecked coat
// has, d the saddle, c a sock. A spotted kerchief is the bandana with wool
// spots in a regular pattern.
export function dressFine(rows: string[], look: DogLook, wet = false): string[] {
  const collar = look.neck === 'collar';
  const tag = look.tag && look.tag !== 'none' ? (look.tag === 'bone' ? 'w' : 'y') : 't';
  const T: Record<string, string> = {
    k: collar ? 't' : 'r',
    K: collar ? 't' : 'p',
    f: collar ? '.' : 'r',
    n: look.neck === 'neckerchief' ? 'r' : 't',
    u: collar ? tag : 'r',
    i: 'p',
    j: 'w',
    h: look.mask === 'none' ? 'w' : 'p',
    H: look.mask === 'both' ? 'p' : 'w',
    b: look.blaze ? 'w' : 't',
    a: look.tailTip ? 'w' : 't',
    v: look.speckle === 'light' ? 't' : wet ? 's' : 'w',
    x: look.speckle === 'heavy' ? (wet ? 's' : 'w') : 't',
    d: look.saddle ? 'p' : 't',
    c: look.socks ? 'w' : 't',
  };
  const out = rows.map((r) => r.replace(/[kKfnuijhHbavxdc]/g, (ch) => T[ch]));
  if ((look.neck as string) !== 'spotted') return out; // (the treasure hunt adds 'spotted' to Neck)
  return out.map((r, y) => r.replace(/r/g, (ch, x: number) => ((x * 2 + y) % 4 === 0 ? 'w' : ch)));
}
