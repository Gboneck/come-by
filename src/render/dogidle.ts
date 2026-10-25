import type { Sprite } from '../gfx/sprite';
import type { DogSprites } from '../art/dog';
import type { Dog } from '../entities/dog';

// The dog's idles, for the eye only: left standing a while it puts its nose
// down to sniff or sits for a scratch; out of the ford (or after a while in
// the rain) it shakes itself off in a spray. Any move ends them at once.

interface Idle {
  last: number;
  still: number;
  next: number;
  act: 'sniff' | 'scratch' | 'shake' | null;
  actT: number;
  wet: boolean;
  rainT: number;
}
const states = new WeakMap<Dog, Idle>();

const DUR = { sniff: 1.8, scratch: 1.5, shake: 0.7 };

export function idlePose(dog: Dog, skin: DogSprites, t: number, raining: boolean, spray: (x: number, y: number) => void): { s: Sprite; flip: boolean; dx: number } | null {
  let st = states.get(dog);
  if (!st) states.set(dog, (st = { last: t, still: 0, next: 5 + Math.random() * 4, act: null, actT: 0, wet: false, rainT: 0 }));
  const dt = Math.max(0, Math.min(0.2, t - st.last));
  st.last = t;
  if (dog.inWater) {
    st.wet = true;
    st.act = null;
    st.still = 0;
    return null;
  }
  if (dog.lying || dog.barkAnim > 0 || dog.speed > 4) {
    st.still = 0;
    st.act = null;
    return null;
  }
  st.still += dt;
  if (raining && (st.rainT += dt) > 12) {
    st.rainT = 0;
    st.wet = true;
  }
  const side = dog.face === 'l' || dog.face === 'r';
  if (!st.act) {
    if (st.wet && st.still > 0.2) {
      st.act = 'shake';
      st.actT = 0;
      st.wet = false;
    } else if (st.still > st.next && side) {
      st.act = Math.random() < 0.55 ? 'sniff' : 'scratch';
      st.actT = 0;
      st.next = st.still + 5 + Math.random() * 6;
    }
  }
  if (!st.act) return null;
  st.actT += dt;
  if (st.actT >= DUR[st.act]) {
    st.act = null;
    return null;
  }
  const P = skin.poses;
  const flip = dog.face === 'l';
  const T = st.actT;
  if (st.act === 'shake') {
    spray(dog.x, dog.y - 3);
    const f = Math.floor(T / 0.07) % 2;
    if (side && P.side.shake) return { s: P.side.shake[f], flip, dx: 0 };
    return { s: dog.face === 'd' ? P.down.stand : P.up.stand, flip: false, dx: f ? 1 : -1 };
  }
  if (!side) {
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
