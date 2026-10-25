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
export type DogFacing = 'side' | 'down' | 'up';

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

export function dressRows(rows: string[], facing: DogFacing, look: DogLook): string[] {
  const g = rows.map((r) => r.split(''));
  const H = g.length, W = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y >= 0 && y < H ? g[y][x] ?? '.' : '.');
  const set = (x: number, y: number, c: string) => { if (y >= 0 && y < H && x >= 0 && x < g[y].length) g[y][x] = c; };
  const coat = (c: string) => c === 't' || c === 'w';
  const rRows = g.map((r, y) => (r.includes('r') ? y : -1)).filter((y) => y >= 0);
  const r0 = rRows.length ? rRows[0] : -1;

  if (facing === 'side') {
    // The neck piece's column splits body (left) from head (right).
    let rc = -1;
    if (r0 >= 0) rc = g[r0].indexOf('r');
    const bodyEnd = rc >= 0 ? rc : 9;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < bodyEnd; x++) {
        const c = at(x, y);
        if (look.speckle === 'light' && c === 'w') set(x, y, 't');
        if (look.speckle === 'heavy' && c === 't' && x >= 2 && y < H - 2 && fleck(x, y)) set(x, y, 'w');
      }
    if (look.saddle && r0 >= 0) for (let x = rc - 5; x <= rc - 3; x++) if (coat(at(x, r0))) set(x, r0, 'p');
    if (look.tailTip) {
      // The tail is the coat pixel furthest back.
      let tx = -1, ty = -1;
      for (let x = 0; x <= 2 && tx < 0; x++) for (let y = 0; y < H - 2; y++) if (at(x, y) === 't') { tx = x; ty = y; break; }
      if (tx >= 0) set(tx, ty, 'w');
    }
    if (look.mask === 'none' && r0 >= 0 && at(rc + 2, r0) === 'p') {
      // The eye (just ahead of the neck piece) in a pale face.
      if (at(rc + 1, r0) === 't') set(rc + 1, r0, 'w');
      if (at(rc + 2, r0 - 1) === 't') set(rc + 2, r0 - 1, 'w');
    }
    if (rc >= 0) neckSide(g, rc, look.neck, set, at);
  } else {
    if (facing === 'down') {
      // The face: '.ppwpp.' is both eye patches round the white blaze.
      for (let y = 0; y < (r0 >= 0 ? r0 : H); y++) {
        const s = g[y].join('').indexOf('ppwpp');
        if (s < 0) continue;
        // Without its patch an eye sits in a pale face.
        if (look.mask === 'none') { set(s, y, 'w'); set(s + 4, y, 'w'); }
        if (look.mask === 'one') set(s + 4, y, 'w');
      }
    }
    if (r0 >= 0) {
      for (let y = r0 + 1; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = at(x, y);
          if (look.speckle === 'light' && c === 'w' && facing === 'up') set(x, y, 't');
          if (look.speckle === 'light' && c === 'w' && facing === 'down' && y === r0 + 1) set(x, y, 't');
          if (look.speckle === 'heavy' && c === 't' && (x + y) % 3 === 0) set(x, y, 'w');
        }
      if (facing === 'up') {
        if (look.saddle) for (let y = r0 + 1; y <= r0 + 2; y++) for (let x = 2; x <= 4; x++) if (at(x, y) === 't') set(x, y, 'p');
        if (look.tailTip) {
          // The lowest row that is nothing but tail.
          for (let y = H - 1; y > r0; y--) {
            const row = g[y].join('');
            if (row.replace(/\./g, '') === 't') { set(row.indexOf('t'), y, 'w'); break; }
          }
        }
      }
      // Neck piece, seen from the front or behind.
      const row = g[r0].join('');
      const a = row.indexOf('rrrrr');
      if (look.neck === 'collar' && a >= 0) { set(a, r0, 't'); set(a + 4, r0, 't'); }
      if (look.neck === 'neckerchief') {
        const mid = Math.floor(W / 2);
        if (facing === 'down' && coat(at(mid, r0 + 1))) set(mid, r0 + 1, 'r'); // the point hangs at the chest
        if (facing === 'up' && coat(at(mid, r0 - 1))) set(mid, r0 - 1, 'r'); // the knot at the nape
      }
    }
  }
  return g.map((r) => r.join(''));
}

function neckSide(g: string[][], rc: number, neck: Neck, set: (x: number, y: number, c: string) => void, at: (x: number, y: number) => string) {
  const ys: number[] = [];
  for (let y = 0; y < g.length; y++) if (at(rc, y) === 'r') ys.push(y);
  if (!ys.length) return;
  if (neck === 'collar') for (const y of ys.slice(1)) set(rc, y, 't'); // one pixel band
  if (neck === 'neckerchief') {
    const y = ys[ys.length - 1] + 1;
    if (at(rc, y) === 't' || at(rc, y) === 'w') set(rc, y, 'r'); // the point under the chin
  }
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
