import { C } from '../palette';
import { ellipse, rect } from '../gfx/draw';
import { drawSpr, tint, type Sprite } from '../gfx/sprite';
import { seasonLook } from '../art/seasonlook';
import { animalSprites } from '../art/animals';
import { lambSprites } from '../art/young';
import { hash2 } from '../rng';
import type { Animal } from '../entities/animal';
import type { SpeciesId } from '../world/map';

// How animals look, read from the simulation's public state. Nothing here
// feeds back into herding: a "lying down" animal is only a pose.

interface Pose {
  rest: number; // seconds at rest, calm and unpressed
  lieAfter: number;
  last: number;
}
const poses = new WeakMap<Animal, Pose>();

function poseOf(a: Animal, t: number, night: boolean): { lying: boolean } {
  let p = poses.get(a);
  if (!p) {
    p = { rest: 0, lieAfter: 0, last: t };
    poses.set(a, p);
  }
  const dt = Math.max(0, Math.min(0.2, t - p.last));
  p.last = t;
  const still = Math.hypot(a.vx, a.vy) < 2;
  const calm = a.stress < 0.2 && a.pressure < 0.02 && a.panicT <= 0 && !a.inWater && !a.carried;
  if (still && calm) p.rest += dt;
  else p.rest = 0;
  if (p.rest === 0) p.lieAfter = a.pen ? (night ? 1.5 : 8) + hash2(a.id, 1, 3) * 10 : 14 + hash2(a.id, 2, 3) * 22;
  return { lying: p.rest > p.lieAfter };
}

const SHADOW: Record<SpeciesId, [number, number]> = {
  duck: [3, 1],
  sheep: [5, 2],
  goat: [5, 2],
  cow: [8, 2],
  pony: [7, 2],
};

export function drawAnimalShadow(g: CanvasRenderingContext2D, a: Animal, sun = 0) {
  if (a.inWater) return;
  const [rx, ry] = a.young ? [3, 1] : SHADOW[a.sp.id];
  const side = a.face === 'l' || a.face === 'r';
  const lying = (poses.get(a)?.rest ?? 0) > (poses.get(a)?.lieAfter ?? 1e9);
  ellipse(g, a.x - 1 + sun, a.y + 1, side || lying ? rx + (lying ? 1 : 0) : Math.max(2, rx - 2), ry, C.sage);
}

const OUT = [[-1, 0], [1, 0], [0, -1]];
const outlines = new Map<Sprite, Sprite>();
function outline(s: Sprite): Sprite {
  let o = outlines.get(s);
  if (!o) outlines.set(s, (o = tint(s, C.sage)));
  return o;
}

const cyc = (arr: Sprite[], f: number) => arr[((Math.floor(f) % arr.length) + arr.length) % arr.length];

export function drawAnimal(g: CanvasRenderingContext2D, a: Animal, t: number, night = false) {
  const S = a.young ? lambSprites(a.coat) : animalSprites(a.sp.id, a.coat);
  const speed = Math.hypot(a.vx, a.vy);
  const moving = speed > 2;
  const running = moving && (speed > a.sp.walk * 1.3 || a.panicT > 0);
  // Wary: head up, ears pricked. It shows before the "!" does.
  const wary = a.stress > 0.4 || a.pressure > 0.2 || a.panicT > 0;
  const { lying } = poseOf(a, t, night);
  const hop = a.hop > 0 ? -Math.round(Math.sin(a.hop * Math.PI) * 2) : 0;
  // A goat up on an outcrop stands on its top, above the rock's face.
  const x = a.x, y = a.y + 1 + hop - (a.onRock ? 2 : 0);
  const side = a.face === 'l' || a.face === 'r';
  const seed = a.id * 0.37;
  let s: Sprite;
  let flip = a.face === 'l';
  if (lying && !moving) {
    s = S.lie;
    if (!side) flip = hash2(a.id, 0, 5) < 0.5;
  } else if (side) {
    if (moving) s = running ? cyc(S.run, a.phase) : cyc(S.side, a.phase);
    else if (wary) s = S.alert;
    else if (a.grazeMode === 'eat' && a.pressure < 0.03 && a.panicT <= 0) s = S.grazing[hash2(a.id, Math.floor(t * 1.4 + seed), 7) < 0.6 ? 0 : 1];
    else {
      // Idle: mostly standing, now and then a look round, and each kind's
      // habit: a tail flick (often, for cattle), a wing stretch, a goat
      // lowering its horns at a neighbour, a pony stamping.
      const slot = Math.floor(t / (a.sp.id === 'cow' ? 1.3 : 2.2) + seed);
      const k = hash2(a.id, slot, 9);
      const habit = a.sp.id === 'cow' ? k < 0.35 && (t / 1.3 + seed) % 1 < 0.35 : k > 0.82;
      s = S.stand[habit && S.stand[2] ? 2 : k < 0.3 ? 1 : 0];
    }
  } else {
    const arr = a.face === 'd' ? S.down : S.up;
    if (moving) s = cyc(arr, a.phase);
    else s = wary && a.face === 'd' ? S.downAlert : arr[0];
  }

  if (!a.inWater) {
    // On snow a pale coat would vanish: a sage outline keeps the shape.
    if (seasonLook.snow > 0.45) {
      const o = outline(s);
      for (const [dx, dy] of OUT) drawSpr(g, o, x + dx, y + dy, flip);
    }
    drawSpr(g, s, x, y, flip);
    return;
  }
  // Wading (or a duck swimming): the legs go under, a waterline laps round.
  const sink = a.sp.id === 'duck' ? 1 : 2;
  const left = Math.round(x) - (flip ? s.w - 1 - s.ax : s.ax);
  const top = Math.round(y) - s.ay;
  g.save();
  g.beginPath();
  g.rect(left, top, s.w, s.h - sink);
  g.clip();
  drawSpr(g, s, x, y, flip);
  g.restore();
  const wl = top + s.h - sink;
  const k = Math.floor(t * 4 + a.id);
  g.fillStyle = C.wool;
  for (let i = -1; i <= s.w; i++) if ((i + k) % 3 !== 0) g.fillRect(left + i, wl, 1, 1);
}

// Worry marks: "!" when stressed, blinking when panicking. Drawn above the
// night so a frightened flock reads in the dark.
export function drawAnimalMarks(g: CanvasRenderingContext2D, a: Animal, t: number) {
  if (a.gone) return;
  if (a.stress > 0.55 && (!a.pen || a.stress > 0.75)) {
    const blink = a.panicT > 0 ? Math.floor(t * 10) % 2 === 0 : true;
    if (blink) {
      const top = Math.round(a.y - (a.sp.r * 2 + 6));
      const col = a.stress > 0.8 ? C.butter : C.wool;
      rect(g, a.x, top, 1, 3, col);
      rect(g, a.x, top + 4, 1, 1, col);
    }
  }
}
