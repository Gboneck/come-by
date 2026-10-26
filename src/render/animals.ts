import { C } from '../palette';
import { ellipse, rect } from '../gfx/draw';
import { drawSpr, tint, type Sprite } from '../gfx/sprite';
import { seasonLook } from '../art/seasonlook';
import { animalSprites, type AnimalSprites } from '../art/animals';
import { lambSprites } from '../art/young';
import { hash2 } from '../rng';
import { gust } from './wind';
import type { Animal } from '../entities/animal';
import type { SpeciesId } from '../world/map';

// How animals look, read from the simulation's public state. Nothing here
// feeds back into herding: a "lying down" animal is only a pose, a startle
// only a jump on the screen.

interface Pose {
  rest: number; // seconds at rest, calm and unpressed
  lieAfter: number;
  last: number;
  stress: number; // last frame's, to catch a sudden fright
  panic: boolean;
  startle: number; // seconds left of the jump at a fright
  lying: boolean;
}
const poses = new WeakMap<Animal, Pose>();

const STARTLE = 0.34;

function poseOf(a: Animal, t: number, night: boolean): Pose {
  let p = poses.get(a);
  if (!p) {
    p = { rest: 0, lieAfter: 0, last: t, stress: a.stress, panic: a.panicT > 0, startle: 0, lying: false };
    poses.set(a, p);
  }
  const dt = Math.max(0, Math.min(0.2, t - p.last));
  p.last = t;
  const still = Math.hypot(a.vx, a.vy) < 2;
  const calm = a.stress < 0.2 && a.pressure < 0.02 && a.panicT <= 0 && !a.inWater && !a.carried;
  if (still && calm) p.rest += dt;
  else p.rest = 0;
  if (p.rest === 0) p.lieAfter = a.pen ? (night ? 1.5 : 8) + hash2(a.id, 1, 3) * 10 : 14 + hash2(a.id, 2, 3) * 22;
  // A fright: panic setting in, or stress jumping all at once (a bark).
  const panic = a.panicT > 0;
  if ((panic && !p.panic) || a.stress - p.stress > 0.16) p.startle = STARTLE;
  else p.startle = Math.max(0, p.startle - dt);
  p.panic = panic;
  p.stress = a.stress;
  p.lying = p.rest > p.lieAfter;
  return p;
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
const step4 = (f: number) => ((Math.floor(f) % 4) + 4) % 4;

// Extra rise and fall per frame of each kind's run, on top of what the
// frames carry: cattle land heavy.
const RUN_SINK: Partial<Record<SpeciesId, number[]>> = { cow: [0, 0, 1, 0] };

export function drawAnimal(g: CanvasRenderingContext2D, a: Animal, t: number, night = false) {
  const speed = Math.hypot(a.vx, a.vy);
  const moving = speed > 2;
  const running = moving && (speed > a.sp.walk * 1.3 || a.panicT > 0);
  // Wary: head up, ears pricked. It shows before the "!" does. Scared:
  // eyes wide, whatever it is doing.
  const wary = a.stress > 0.4 || a.pressure > 0.2 || a.panicT > 0;
  const scared = a.stress > 0.7 || a.panicT > 0;
  const S: AnimalSprites = a.young ? lambSprites(a.coat, scared) : animalSprites(a.sp.id, a.coat, scared);
  const p = poseOf(a, t, night);
  const id = a.sp.id;
  let hop = a.hop > 0 ? -Math.round(Math.sin(a.hop * Math.PI) * 2) : 0;
  const side = a.face === 'l' || a.face === 'r';
  const seed = a.id * 0.37;
  let s: Sprite;
  let flip = a.face === 'l';
  let dx = 0;
  const startle = p.startle > 0 && !a.carried;
  if (startle) hop = Math.min(hop, -Math.round(Math.sin((1 - p.startle / STARTLE) * Math.PI) * 2));

  if (a.inWater && S.swim) return drawSwimmer(g, a, S, t, moving);

  if (p.lying && !moving) {
    s = S.lie;
    if (!side) flip = hash2(a.id, 0, 5) < 0.5;
  } else if (side) {
    if (startle) s = S.startle;
    else if (moving) {
      if (running) {
        const f = step4(a.phase);
        s = cyc(S.run, f);
        hop += RUN_SINK[id]?.[f] ?? 0;
      } else {
        // Hauling (a.load: a sledge, panniers, a travois), it leans into it
        // head down at every step.
        s = (a as Animal & { load?: unknown }).load && !a.young ? S.side[step4(a.phase) % 2 ? 3 : 1] : cyc(S.side, a.phase);
        // A duck's waddle bobs; a lamb skips now and then.
        if (id === 'duck' && !a.young) hop -= step4(a.phase) % 2;
        if (a.young && !wary && hash2(a.id, Math.floor(t * 1.6), 4) < 0.3) {
          const u = (t * 1.6) % 1;
          if (u < 0.5) {
            s = S.run[1];
            hop -= Math.round(Math.sin(u * 2 * Math.PI) * 2);
          }
        }
      }
    } else if (wary) s = S.alert;
    else s = idle(a, S, t, seed);
    // A ewe with her lamb close turns to it and noses it now and then.
    const lamb = a.lamb;
    if (lamb && !lamb.gone && !moving && !wary && !p.lying && Math.abs(lamb.x - a.x) < 12 && Math.abs(lamb.y - a.y) < 6 && hash2(a.id, Math.floor(t / 2.5), 8) < 0.45) {
      flip = lamb.x < a.x;
      s = S.grazing[0];
    }
  } else {
    const arr = a.face === 'd' ? S.down : S.up;
    if (startle) s = a.face === 'd' ? S.downStartle : arr[0];
    else if (moving) {
      s = cyc(arr, a.phase);
      // Seen end on, a duck rolls from foot to foot.
      if (id === 'duck' && !a.young && !running) dx = [0, 1, 0, -1][step4(a.phase)];
      if (running) hop -= step4(a.phase * 2) % 2;
    } else s = wary && a.face === 'd' ? S.downAlert : arr[0];
  }

  // A goat up on an outcrop stands on its top, above the rock's face.
  const x = a.x + dx, y = a.y + 1 + hop - (a.onRock ? 2 : 0);
  if (!a.inWater) {
    // On snow a pale coat would vanish: a sage outline keeps the shape.
    if (seasonLook.snow > 0.45) {
      const o = outline(s);
      for (const [ox, oy] of OUT) drawSpr(g, o, x + ox, y + oy, flip);
    }
    drawSpr(g, s, x, y, flip);
    return;
  }
  // Wading: the legs go under, a waterline laps round.
  const sink = 2;
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

// Standing about: mostly still, now and then a look round, a spell of
// chewing, and each kind's habit: a tail flick (often, for cattle), a wing
// stretch, a goat lowering its horns at a neighbour, a pony stamping (or
// its mane and tail lifting when a gust comes through). Grazing: nibbles,
// a chew with the head down, a step on to fresh grass.
function idle(a: Animal, S: AnimalSprites, t: number, seed: number): Sprite {
  const id = a.sp.id;
  if (a.grazeMode === 'eat' && a.pressure < 0.03 && a.panicT <= 0) {
    const k = hash2(a.id, Math.floor(t * 1.4 + seed), 7);
    // Every so often it lifts its head to chew a while.
    if (hash2(a.id, Math.floor(t / 3.1 + seed), 11) < 0.22) return S.chew[Math.floor(t * 3.3 + seed) % 2];
    return S.grazing[k < 0.55 ? 0 : k < 0.85 ? 1 : 2];
  }
  if (S.flow && gust(a.x, a.y) > 0.45) return S.flow[Math.floor(t * 5 + seed) % 2];
  const slot = Math.floor(t / (id === 'cow' ? 1.3 : 2.2) + seed);
  const k = hash2(a.id, slot, 9);
  const habit = id === 'cow' ? k < 0.35 && (t / 1.3 + seed) % 1 < 0.35 : k > 0.82;
  if (!habit && k > 0.6 && k < 0.75) return S.chew[Math.floor(t * 3 + seed) % 2];
  return S.stand[habit && S.stand[2] ? 2 : k < 0.3 ? 1 : 0];
}

// A duck afloat: sitting low, bobbing on the swell, a wake spreading
// behind it when it paddles.
function drawSwimmer(g: CanvasRenderingContext2D, a: Animal, S: AnimalSprites, t: number, moving: boolean) {
  const W = S.swim!;
  const side = a.face === 'l' || a.face === 'r';
  const flip = a.face === 'l';
  const s = side ? W.side[Math.floor(t * 1.3 + a.id) % 2] : a.face === 'd' ? W.down : W.up;
  const bob = Math.sin(t * 2.4 + a.id) > 0.6 ? -1 : 0;
  const x = Math.round(a.x), y = Math.round(a.y) + 1;
  drawSpr(g, s, x, y + bob, flip);
  g.fillStyle = C.wool;
  // Water lapping at its sides, shimmering.
  const k = Math.floor(t * 3 + a.id);
  const l = x - (flip ? s.w - 1 - s.ax : s.ax);
  for (const i of [-1, 0, s.w - 1, s.w]) if ((i + k) % 3 !== 0) g.fillRect(l + i, y, 1, 1);
  if (!moving) return;
  // The wake: two lines opening out behind, flickering as it goes.
  const sp = Math.hypot(a.vx, a.vy) || 1;
  const bx = -a.vx / sp, by = -a.vy / sp;
  for (let i = 3; i < 7; i += 2) {
    if ((i + Math.floor(t * 6)) % 4 === 0) continue;
    const cx = x + bx * (i + 1), cy = y + by * (i + 1);
    const ox = -by * (i * 0.5), oy = bx * (i * 0.5);
    g.fillRect(Math.round(cx + ox), Math.round(cy + oy), 1, 1);
    g.fillRect(Math.round(cx - ox), Math.round(cy - oy), 1, 1);
  }
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
