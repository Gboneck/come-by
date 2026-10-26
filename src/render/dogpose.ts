import { C } from '../palette';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { PX } from '../gfx/screen';
import { drawSprTop, finePixels, fineShadow, toFinePx } from '../art/hd';
import { pickDogFrame, viewOf, type DogSprites, type DogState } from '../art/dog';
import { playerDogSprites, soaked } from '../art/dogstyle';
import { Dog } from '../entities/dog';
import type { Helper } from '../entities/helper';
import { SHALLOW } from '../world/map';
import type { Game } from '../game';
import { idlePose, isWet } from './dogidle';

// How the dogs look, read from their public state (and the dog's own
// timers): nothing here feeds back into the sim. The same for your dog,
// helpers and co-op friends' dogs (whose state comes from snapshots).
//
// - Eight ways round, turning through the in-betweens rather than snapping
//   (a reversal at speed swings through the three-quarter views, with a
//   skid as it digs in).
// - Standing, it watches the stock: it turns its head (up to 90 degrees)
//   towards the nearest animal it could be working, ears pricked; trotting
//   round them it turns a three-quarter view their way.
// - Pants when its wind is gone, stands proud at "THAT'LL DO", comes out
//   of the ford (or a long shower) soaked and dripping until it shakes off.

interface Pose {
  view: number;
  base: number; // the eighth its heading points to (with hysteresis)
  turnT: number;
  hx: number;
  hy: number;
  last: number;
  at: number; // the game time it was last brought up to
  prevV: number;
  skidT: number;
  heat: number; // galloping lately (friends' and helpers' panting)
  lieT: number; // helpers keep no lying timers of their own
  wasLying: boolean;
  riseT: number;
  look: boolean; // standing, head turned to the stock
  fresh: boolean;
}
const poses = new WeakMap<object, Pose>();

const TAU = Math.PI * 2;
const dir8 = (x: number, y: number) => ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
// Steps from a to b round the eight, -3..4.
function turnBy(a: number, b: number) {
  const d = (((b - a) % 8) + 8) % 8;
  return d > 4 ? d - 8 : d;
}
// Stay with the current eighth until the heading is well past its edge.
function aim(x: number, y: number, keep: number) {
  let d = Math.abs(Math.atan2(y, x) - (keep * Math.PI) / 4) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d < Math.PI / 8 + 0.18 ? keep : dir8(x, y);
}

const FACE_VEC = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] } as const;

// The nearest animal a dog standing here might be watching.
const seen = { x: 0, y: 0, d: 0 };
function watching(game: Game, x: number, y: number): typeof seen | null {
  seen.d = 110;
  let found = false;
  for (const a of game.animals) {
    if (a.gone || a.pen || a.carried) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < seen.d) {
      seen.x = a.x;
      seen.y = a.y;
      seen.d = d;
      found = true;
    }
  }
  return found ? seen : null;
}

// Scratch for the idles, so a frame allocates nothing.
const idleIn = { inWater: false, busy: false, side: false, flip: false, stand: null as unknown as Sprite };
const standIn: DogState = { view: 0, speed: 0, sprint: false, phase: 0, lying: false, lieT: 0, rise: 0, bark: 0, t: 0 };

const THATLL_DO = "THAT'LL DO";

// A dog's pose brought up to the game's clock, once a moment: the shadow
// (drawn before the dogs) and the dog then agree, and drawing the same
// moment again (a photo, a test) draws the same dog.
function pose(game: Game, d: Dog | Helper): Pose {
  let p = poses.get(d);
  if (!p) {
    const [hx, hy] = FACE_VEC[d.face];
    poses.set(d, (p = { view: 0, base: 0, turnT: 0, hx, hy, last: game.t, at: NaN, prevV: 0, skidT: 0, heat: 0, lieT: 1, wasLying: d.lying, riseT: 0, look: false, fresh: true }));
  }
  const t = game.t;
  if (p.at === t) return p;
  p.at = t;
  const isDog = d instanceof Dog;
  const dt = Math.max(0, Math.min(0.2, t - p.last));
  p.last = t;
  const speed = Math.hypot(d.vx, d.vy);
  const moving = speed > 6;
  const sprint = isDog ? d.sprinting : speed > 50;
  if (isDog) {
    p.hx = d.hx;
    p.hy = d.hy;
  } else if (speed > 4) {
    p.hx = d.vx / speed;
    p.hy = d.vy / speed;
  }
  const inWater = isDog ? d.inWater : (game.map.flagsAtPx(d.x, d.y) & SHALLOW) !== 0;
  const lying = d.lying;
  const bark = d.barkAnim;

  // The sim's own timers (helpers keep none: count them here).
  if (!isDog) {
    if (lying && !p.wasLying) p.lieT = 0;
    if (lying) p.lieT += dt;
    if (!lying && p.wasLying) p.riseT = 0.12;
    p.riseT -= dt;
  }
  p.wasLying = lying;

  // Where it wants to face: its heading, or (standing) the stock.
  p.base = p.fresh ? dir8(p.hx, p.hy) : aim(p.hx, p.hy, p.base);
  let want = p.base;
  let look = false;
  // Trotting round them (not flat out), it keeps an eye on them too.
  const working = moving && !sprint && speed < 55;
  if ((!moving || working) && !lying && bark <= 0) {
    const w = watching(game, d.x, d.y);
    if (w && (!moving || w.d < 70)) {
      const k = turnBy(want, dir8(w.x - d.x, w.y - d.y));
      if (k !== 0 && Math.abs(k) <= 2) want = (want + Math.sign(k) + 8) % 8;
      look = !moving && w.d < 80 && Math.abs(k) <= 2;
    }
  }
  p.look = look;
  if (p.fresh || lying) p.view = want;
  else if (p.view !== want) {
    p.turnT -= dt;
    if (p.turnT <= 0) {
      const k = turnBy(p.view, want);
      // Turning tail goes round by the side that shows the face.
      const s = Math.abs(k) === 4 ? (p.view < 4 ? 1 : -1) : Math.sign(k);
      p.view = (p.view + s + 8) % 8;
      p.turnT = moving ? 0.035 : 0.06;
    }
  } else p.turnT = 0;
  p.fresh = false;

  // Digging in: a hard stop from a run, or turning tail at speed.
  if (dt > 0) {
    const decel = (p.prevV - speed) / dt;
    if (p.prevV > 50 && decel > 250 && !lying && bark <= 0 && !inWater) p.skidT = 0.16;
    if (moving && speed > 35 && Math.abs(turnBy(p.view, want)) >= 3) p.skidT = Math.max(p.skidT, 0.1);
  }
  p.skidT -= dt;
  p.prevV = speed;

  // Out of wind.
  if (sprint && speed > 40) p.heat = Math.min(6, p.heat + dt);
  else p.heat = Math.max(0, p.heat - dt * 0.35);
  return p;
}

export function drawDog(game: Game, g: CanvasRenderingContext2D, d: Dog | Helper, own = false) {
  const isDog = d instanceof Dog;
  const p = pose(game, d);
  const t = game.t;
  const speed = Math.hypot(d.vx, d.vy);
  const sprint = isDog ? d.sprinting : speed > 50;
  const inWater = isDog ? d.inWater : (game.map.flagsAtPx(d.x, d.y) & SHALLOW) !== 0;
  const lying = d.lying;
  const bark = d.barkAnim;
  let phase: number, lieT: number, rise: number;
  if (isDog) ({ phase, lieT, rise } = d.anim());
  else {
    phase = d.phase;
    lieT = p.lieT;
    rise = p.riseT > 0 ? p.riseT / 0.12 : 0;
  }
  const look = p.look;
  let pant = !sprint && p.heat > 2.2;
  if (own && isDog) pant = !d.sprinting && (d.exhausted || d.stamina < d.stats.stamina * (game.season.season === 'summer' ? 0.8 : 0.55));
  const b = game.banner;
  const proud = !!b && b.big.startsWith(THATLL_DO) && b.max - b.t < 2.6;

  const base: DogSprites = isDog ? (d.skin ?? playerDogSprites()) : d.sprites;
  const soakedNow = inWater || isWet(d);
  const S = soakedNow ? soaked(base) : base;
  standIn.view = p.view;
  idleIn.inWater = inWater;
  idleIn.busy = lying || bark > 0 || speed > 4 || rise > 0 || proud || (isDog && (d.dig > 0 || d.sniff > 0.4));
  idleIn.side = p.view === 0 || p.view === 4;
  idleIn.flip = p.view === 4;
  idleIn.stand = pickDogFrame(S, standIn).s;
  const raining = game.weather.rain > 0.3 && game.season.snow < 0.4;
  const ip = idlePose(d, idleIn, S, t, raining, () => game.life.spray(d.x, d.y - 3));
  if (ip) {
    drawSpr(g, ip.s, d.x + ip.dx * 0.5, d.y + 2, ip.flip);
    return;
  }
  // On the scent or digging (the treasure hunt sets these on the dog): a
  // dig runs 0.9s, scraping, and ends in a quick shake.
  const sniffing = isDog && d.sniff > 0.4, digging = isDog && d.dig > 0;
  const act = lying || bark > 0 ? null : digging ? 'dig' : sniffing ? 'sniff' : null;
  const shakeOff = digging && d.dig < 0.16 && S.poses.side.shake;
  if (shakeOff) {
    drawSpr(g, S.poses.side.shake![Math.floor(t / 0.06) % 2], d.x, d.y + 2, p.view >= 3 && p.view <= 5);
    return;
  }
  const f = pickDogFrame(S, { view: p.view, speed, sprint, phase, lying, lieT, rise, bark, skid: p.skidT > 0, pant, proud, look, act, actT: digging ? 0.9 - d.dig : t, t });
  const x = d.x, y = d.y + 2 + f.bob;
  if (!inWater) {
    drawSpr(g, f.s, x, y, f.flip);
    // Dripping, until it shakes off: drops form under the belly and fall.
    if (soakedNow && !lying) {
      const pts: number[] = [];
      const side = viewOf(p.view) === 'side';
      for (let k = 0; k < 2; k++) {
        const u = (t * 1.5 + k * 0.5 + (d.x % 7) * 0.13) % 1;
        if (u > 0.6) continue;
        const dx = ((Math.floor(t * 1.5 + k * 0.5) * 7 + k * 5) % (side ? 15 : 7)) - (side ? 7 : 3);
        pts.push(toFinePx(x) + dx, toFinePx(d.y) - 2 + Math.round(u * 12));
      }
      finePixels(g, C.wool, pts);
    }
    return;
  }
  // Wading: the legs go under and the water laps round in a thin broken
  // line, a fine pixel tall.
  const s = f.s;
  const rows = s.ay + 1 - Math.ceil(6 / (PX / (s.d ?? 1))); // six fine rows under
  const at = drawSprTop(g, s, x, y, f.flip, rows);
  const wl = at.top + rows * at.k;
  const ph = Math.floor(t * 6);
  const pts: number[] = [];
  for (let i = 4; i < s.w * at.k - 4; i++) if ((i + ph) % 5 !== 0 && (i + ph) % 5 !== 2) pts.push(at.left + i, wl);
  finePixels(g, C.wool, pts);
}

// The dog's shadow, in fine pixels, swung with the sun: long side on,
// round seen from the front or back, between at the three-quarter views.
export function drawDogShadow(game: Game, g: CanvasRenderingContext2D, d: Dog | Helper, sun: number) {
  const v = pose(game, d).view;
  const rx = v % 4 === 0 ? 10 : v % 2 ? 8 : 6;
  fineShadow(g, d.x - 1 + sun, d.y + 2, rx, 2, C.sage);
}
