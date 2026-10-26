import type { Sprite } from '../gfx/sprite';
import type { DogSprites } from '../art/dog';
import { hash2 } from '../rng';

// The dogs' idles, for the eye only: left standing a while a dog puts its
// nose down to sniff or sits for a scratch; out of the ford (or after a
// while in the rain) it is soaked, and shakes itself off in a spray the
// moment it stands still. Any move ends them at once.

interface Idle {
  last: number;
  still: number;
  next: number;
  act: 'sniff' | 'scratch' | 'shake' | null;
  actT: number;
  wet: boolean;
  rainT: number;
  dryT: number;
  n: number; // which dog, and how many idles so far: the choices are
  k: number; // hashed from these, never Math.random (seeded runs stay exact)
}
let made = 0;
const states = new WeakMap<object, Idle>();

const DUR = { sniff: 1.8, scratch: 1.5, shake: 0.7 };

export interface IdleDog {
  inWater: boolean;
  busy: boolean; // moving, lying, barking, showing off
  side: boolean; // side on (the idles are drawn side on)
  flip: boolean;
  stand: Sprite; // its standing pose as it faces now (for the shake)
}

// Soaked (and not yet shaken dry).
export const isWet = (key: object) => states.get(key)?.wet ?? false;

export function idlePose(key: object, dog: IdleDog, skin: DogSprites, t: number, raining: boolean, spray: () => void): { s: Sprite; flip: boolean; dx: number } | null {
  let st = states.get(key);
  if (!st) states.set(key, (st = { last: t, still: 0, next: 5 + hash2(++made, 1, 17) * 4, act: null, actT: 0, wet: false, rainT: 0, dryT: 0, n: made, k: 0 }));
  const dt = Math.max(0, Math.min(0.2, t - st.last));
  st.last = t;
  if (dog.inWater) {
    st.wet = true;
    st.dryT = 0;
    st.act = null;
    st.still = 0;
    return null;
  }
  if (raining && (st.rainT += dt) > 12) {
    st.rainT = 0;
    st.wet = true;
    st.dryT = 0;
  }
  // Kept on the move it dries off by itself, slowly.
  if (st.wet && !raining && (st.dryT += dt) > 40) st.wet = false;
  if (dog.busy) {
    st.still = 0;
    st.act = null;
    return null;
  }
  st.still += dt;
  if (!st.act) {
    if (st.wet && st.still > 0.2) {
      st.act = 'shake';
      st.actT = 0;
      st.wet = false;
    } else if (st.still > st.next && dog.side) {
      st.act = hash2(st.n, ++st.k, 18) < 0.55 ? 'sniff' : 'scratch';
      st.actT = 0;
      st.next = st.still + 5 + hash2(st.n, st.k, 19) * 6;
    }
  }
  if (!st.act) return null;
  st.actT += dt;
  if (st.actT >= DUR[st.act]) {
    st.act = null;
    return null;
  }
  const P = skin.poses;
  const flip = dog.flip;
  const T = st.actT;
  if (st.act === 'shake') {
    spray();
    const f = Math.floor(T / 0.07) % 2;
    if (dog.side && P.side.shake) return { s: P.side.shake[f], flip, dx: 0 };
    return { s: dog.stand, flip, dx: f ? 1 : -1 };
  }
  if (!dog.side) {
    st.act = null;
    return null;
  }
  if (st.act === 'sniff' && P.side.sniff) return { s: P.side.sniff[Math.floor(T * 4) % 2], flip, dx: 0 };
  if (st.act === 'scratch' && P.side.scratch) {
    const sc = P.side.scratch;
    const s = T < 0.25 || T > DUR.scratch - 0.2 ? sc[0] : sc[1 + (Math.floor(T / 0.07) % 2)];
    return { s, flip, dx: 0 };
  }
  return null;
}
