import { C } from '../palette';
import { ellipse, rect } from '../gfx/draw';
import { drawSpr } from '../gfx/sprite';
import { animalSprites, type Coat } from '../art/animals';
import { BLOCK_ANIMAL, BLOCK_CLIMBER, CS, GATE, ROCK, SHALLOW, TS, Ter, type SpeciesId, type WorldMap } from '../world/map';
import { collideCircle, wallRepulse } from '../world/collide';
import { SPECIES, type Species } from './species';
import { angleDiff, clamp } from '../util';
import type { Facing } from './dog';
import type { Weather } from '../systems/weather';

export interface PressureSource {
  x: number;
  y: number;
  vx: number;
  vy: number;
  strength: number;
  range: number; // multiplier on the animal's flight zone
  kind: 'dog' | 'helper' | 'predator';
  lying: boolean;
}

// Anything an animal can be penned in. Implemented by ranch pens.
export interface Enclosure {
  id: number;
  contains(x: number, y: number): boolean;
  // Gate held open to let the stock out: penned animals may leave.
  letOut?: boolean;
  gatePoint?(out: number): { x: number; y: number };
}

let nextId = 1;

export class Animal {
  id = nextId++;
  sp: Species;
  coat: Coat;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hx: number;
  hy: number;
  speed = 0;
  stress = 0;
  face: Facing = 'r';
  phase = Math.random() * 4;
  grazeT = Math.random() * 3;
  grazeMode: 'eat' | 'amble' = 'eat';
  gdx = 0;
  gdy = 0;
  panicT = 0;
  panicCd = 0;
  pdx = 0;
  pdy = 0;
  scatterT = 0;
  fleeT = 0;
  commitT = 0;
  pressure = 0;
  wanderer: boolean;
  stray = false;
  group = -1;
  nbrCount = 0;
  hop = 0;
  pen: Enclosure | null = null;
  penT = 0; // time since penned
  produceT = 0;
  inWater = false;
  gone = false; // taken by a predator / sold
  carried = false; // being dragged off
  trial = false; // the Show Ground's own flock, only for a trial run
  home = false; // has been penned before: bringing it back pays nothing
  // Goats: nearest rock to scramble up, and how long they have sat on one.
  rockX = 0;
  rockY = 0;
  rockSeek = 0;
  hasRock = false;
  // In rain: the nearest tree cover to shelter by.
  coverX = 0;
  coverY = 0;
  coverSeek = 0;
  hasCover = false;
  onRock = false;
  rockT = 0;
  // For the "stress at delivery" calm bonus.
  peakStress = 0;
  deliveryValue = 0;

  constructor(id: SpeciesId, x: number, y: number, coat: Coat = 0) {
    this.sp = SPECIES[id];
    this.coat = coat;
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    this.hx = Math.cos(a);
    this.hy = Math.sin(a);
    this.wanderer = Math.random() < this.sp.wander;
    this.produceT = Math.random() * this.sp.goodEvery;
  }

  get calm() {
    return this.stress < 0.35;
  }
}

export interface HerdCtx {
  map: WorldMap;
  sources: PressureSource[];
  dogX: number;
  dogY: number;
  dogR: number;
  dogLying: boolean;
  // Open gates pull pressured animals towards the opening.
  gates: { x: number; y: number; open: boolean; accepts(a: Animal): boolean }[];
  weather?: Weather;
}

const tmp = { x: 0, y: 0 };
const CELL = 32;

class Grid {
  cells = new Map<number, Animal[]>();
  build(list: Animal[]) {
    this.cells.clear();
    for (const a of list) {
      const k = ((a.x / CELL) | 0) * 4096 + ((a.y / CELL) | 0);
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push(a);
    }
  }
  near(x: number, y: number, r: number, out: Animal[]) {
    out.length = 0;
    const x0 = ((x - r) / CELL) | 0, x1 = ((x + r) / CELL) | 0;
    const y0 = ((y - r) / CELL) | 0, y1 = ((y + r) / CELL) | 0;
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const c = this.cells.get(cx * 4096 + cy);
        if (c) for (const a of c) out.push(a);
      }
    return out;
  }
}

const grid = new Grid();
const nbrs: Animal[] = [];

const smooth01 = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

export function updateHerd(list: Animal[], ctx: HerdCtx, dt: number) {
  grid.build(list);
  for (const a of list) if (!a.gone && !a.carried) stepAnimal(a, ctx, dt);
}

function stepAnimal(a: Animal, ctx: HerdCtx, dt: number) {
  const sp = a.sp;
  a.panicT -= dt;
  a.panicCd -= dt;
  a.scatterT -= dt;
  a.fleeT -= dt;
  a.commitT -= dt;
  a.hop = Math.max(0, a.hop - dt * 6);
  if (a.pen) a.penT += dt;

  // ---- Weather (stock out in it; pens are home) ----
  const W = ctx.weather;
  const out = !a.pen && W;
  const wx = out ? W.pushX : 0, wy = out ? W.pushY : 0;
  const rain = out ? W.rain : 0, fog = out ? W.fog : 0;

  // ---- Flocking ----
  const stressBunch = (sp.splitter
    ? Math.max(0.1, 1 - 1.4 * smooth01((a.stress - 0.15) / 0.45))
    : 1 + 1.4 * smooth01((a.stress - 0.15) / 0.45) * (a.stress < 0.8 ? 1 : 0.3)) * (1 + 0.7 * rain); // rain huddles them
  const sepR = sp.sep * (1 - 0.25 * smooth01((a.stress - 0.2) / 0.5));
  let cx = 0, cy = 0, avx = 0, avy = 0, n = 0, sx = 0, sy = 0;
  grid.near(a.x, a.y, Math.max(sp.nbr, 16), nbrs);
  for (const b of nbrs) {
    if (b === a || b.gone || b.carried) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    // Bodies never overlap, whatever the species.
    const minD = sp.r + b.sp.r;
    if (d2 < minD * minD && d2 > 1e-4) {
      const d = Math.sqrt(d2);
      const push = (minD - d) * 0.5;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
    }
    if (b.sp !== sp || b.pen !== a.pen || b.trial !== a.trial || d2 > sp.nbr * sp.nbr) continue;
    const d = Math.sqrt(d2);
    cx += b.x; cy += b.y; avx += b.vx; avy += b.vy; n++;
    if (d < sepR && d > 1e-3) {
      const w = 1 - d / sepR;
      sx -= (dx / d) * w;
      sy -= (dy / d) * w;
    }
  }
  a.nbrCount = n;
  let cohX = 0, cohY = 0, aliX = 0, aliY = 0, follow = 0;
  if (n > 0) {
    cohX = (cx / n - a.x) / sp.nbr;
    cohY = (cy / n - a.y) / sp.nbr;
    aliX = avx / n / sp.run;
    aliY = avy / n / sp.run;
    follow = Math.hypot(avx / n, avy / n);
  }

  // Goats keep track of the nearest rock, and feel safe on one.
  if (sp.climbs && !a.pen) {
    a.onRock = (ctx.map.flagsAtPx(a.x, a.y) & ROCK) !== 0;
    a.rockT = a.onRock ? a.rockT + dt : 0;
    if ((a.rockSeek -= dt) <= 0) {
      a.rockSeek = 0.6 + Math.random() * 0.3;
      findRock(ctx.map, a);
    }
  }
  const safety = a.onRock ? 0.55 : 1;

  // ---- Pressure from dogs and predators ----
  let fx = 0, fy = 0, P = 0, threat = 0, approachMax = 0, startle = 0;
  let mainX = 0, mainY = 0, mainI = 0;
  for (const s of ctx.sources) {
    if (s.lying) continue;
    // Fog: they let you closer before they move, then start more easily.
    const R = sp.flight * s.range * (1 + 0.6 * a.stress) * (a.pen && !a.pen.letOut ? 0.5 : 1) * safety * (1 - 0.12 * fog);
    const dx = a.x - s.x, dy = a.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d >= R || d < 1e-3) continue;
    const p = 1 - d / R;
    const stub = a.commitT > 0 || s.kind === 'predator' ? 0 : sp.stubborn;
    if (p <= stub) continue;
    const pe = (p - stub) / (1 - stub);
    const ax = dx / d, ay = dy / d;
    const approach = clamp((s.vx * ax + s.vy * ay) / 40, -0.6, 1.6);
    const amp = s.kind === 'predator' ? 1.3 : 0.72 + 0.48 * approach;
    const I = Math.pow(pe, 1.2) * s.strength * Math.max(0.25, amp);
    // Point of balance: behind the shoulder drives the animal forward along
    // its heading, in front of it turns the animal away.
    const c = -(a.hx * ax + a.hy * ay);
    let dirx = ax, diry = ay;
    if (c < 0) {
      dirx += a.hx * -c * 1.1;
      diry += a.hy * -c * 1.1;
      const l = Math.hypot(dirx, diry);
      dirx /= l;
      diry /= l;
    }
    fx += dirx * I;
    fy += diry * I;
    P += I;
    approachMax = Math.max(approachMax, approach);
    // Something rushing at you is alarming; a dog matching your pace is not.
    const rel = (s.vx - a.vx) * ax + (s.vy - a.vy) * ay;
    if (s.kind !== 'predator') startle = Math.max(startle, pe * Math.max(0, rel - 25 * (1 - 0.3 * fog)) / 40);
    if (s.kind === 'predator') threat = Math.max(threat, pe);
    if (I > mainI) { mainI = I; mainX = ax; mainY = ay; }
  }
  a.pressure = P;
  if (P > 0.9 && sp.balksWater) a.commitT = Math.max(a.commitT, 0.6);
  // Heavy animals, once pushed, keep plodding on for a while.
  if (sp.momentum && P > 0.25 && !a.pen) a.fleeT = Math.max(a.fleeT, sp.momentum * Math.min(1, P));

  // Lying dog nearby: settle.
  const dDog = Math.hypot(a.x - ctx.dogX, a.y - ctx.dogY);
  const settling = ctx.dogLying && dDog < sp.flight * 1.8;

  // ---- Obstacles ----
  let mask = sp.climbs ? BLOCK_CLIMBER : BLOCK_ANIMAL;
  if (a.pen && !a.pen.letOut) mask |= GATE;
  const here = ctx.map.flagsAtPx(a.x, a.y);
  a.inWater = (here & SHALLOW) !== 0;
  if (sp.balksWater && a.commitT <= 0 && !a.inWater) mask |= SHALLOW;
  wallRepulse(ctx.map, a.x, a.y, sp.r + 7, mask, tmp);
  const wallX = tmp.x, wallY = tmp.y;

  // ---- Desired motion ----
  let dirX = 0, dirY = 0, spd = 0;
  const cohW = sp.wCoh * stressBunch * (a.scatterT > 0 ? 0.2 : 1) * (a.wanderer && P < 0.05 ? 0.4 : 1);
  const sepW = sp.wSep * (a.scatterT > 0 ? 1.8 : 1);
  const driven = P > 0.03 || a.fleeT > 0;

  if (a.panicT > 0) {
    dirX = a.pdx + sx * sepW + wallX * 3;
    dirY = a.pdy + sy * sepW + wallY * 3;
    spd = sp.run * 1.05;
  } else if (driven) {
    // Wind leans on a lightly driven flock; a firm, steady push beats it.
    const lean = 0.35 * Math.max(0, 1 - P / 0.5);
    dirX = fx * 2.6 + cohX * cohW * 0.7 + aliX * sp.wAli * 1.4 + sx * sepW + wallX * 3 + wx * lean;
    dirY = fy * 2.6 + cohY * cohW * 0.7 + aliY * sp.wAli * 1.4 + sy * sepW + wallY * 3 + wy * lean;
    const drive = Math.min(P, 1.4);
    spd = drive < 0.45 ? sp.walk * (0.35 + 0.65 * smooth01(drive / 0.45)) : sp.walk + (sp.run - sp.walk) * smooth01((drive - 0.45) / 0.8);
    spd = Math.max(spd, follow * 0.9);
    if (a.fleeT > 0) {
      spd = Math.max(spd, sp.run * Math.min(1, a.fleeT * 1.3));
      if (P < 0.03) { dirX += a.hx * 1.5; dirY += a.hy * 1.5; }
    }
    // Goats scramble for the rocks when pushed.
    if (sp.climbs && a.hasRock && !a.onRock && !a.pen) {
      const rx = a.rockX - a.x, ry = a.rockY - a.y, rd = Math.hypot(rx, ry);
      if (rd > 1) {
        const w = 1.5 * Math.min(1, P + 0.2);
        dirX += (rx / rd) * w;
        dirY += (ry / rd) * w;
      }
    }
    // Penned stock with the gate held open file out when pushed: to the
    // gateway first, then on out through it.
    const pen = a.pen;
    if (pen?.letOut && pen.gatePoint) {
      const inner = pen.gatePoint(-7);
      const atGate = Math.hypot(inner.x - a.x, inner.y - a.y) < 9;
      const to = atGate ? pen.gatePoint(16) : inner;
      const gx = to.x - a.x, gy = to.y - a.y, gd = Math.hypot(gx, gy);
      if (gd > 1) {
        const w = 1.6 * Math.min(1, P + 0.3);
        dirX += (gx / gd) * w;
        dirY += (gy / gd) * w;
      }
    }
    // Pressured animals near an open pen gate drift through it.
    for (const gt of ctx.gates) {
      if (!gt.open || !gt.accepts(a)) continue;
      const gx = gt.x - a.x, gy = gt.y - a.y;
      const gd = Math.hypot(gx, gy);
      if (gd < 46 && gd > 1) {
        const w = (1 - gd / 46) * 1.6 * Math.min(1, P + 0.3);
        dirX += (gx / gd) * w;
        dirY += (gy / gd) * w;
      }
    }
  } else if (follow > sp.graze * 2.2 && n > 0) {
    // The flock is moving: go with it.
    dirX = aliX * 2 + cohX * cohW + sx * sepW + wallX * 3 + wx * 0.2;
    dirY = aliY * 2 + cohY * cohW + sy * sepW + wallY * 3 + wy * 0.2;
    spd = follow * 0.92;
  } else {
    // Calm: graze, amble, keep loosely together.
    a.grazeT -= dt * (settling ? 0.5 : 1);
    if (a.grazeT <= 0) {
      pickGraze(a, cohX, cohY, n);
      if (a.onRock) {
        // Safe up here. After a while the grass below wins.
        if (a.rockT < 7) { a.grazeMode = 'eat'; a.grazeT = 1.5 + Math.random() * 2; }
        else if (a.hasRock) {
          const ang = Math.atan2(a.y - a.rockY, a.x - a.rockX) + (Math.random() - 0.5);
          a.grazeMode = 'amble';
          a.grazeT = 2.5;
          a.gdx = Math.cos(ang);
          a.gdy = Math.sin(ang);
        }
      }
    }
    // Rain: drift over to the nearest trees and wait it out there.
    if (rain > 0.2) {
      if ((a.coverSeek -= dt) <= 0) {
        a.coverSeek = 2.5 + Math.random();
        findCover(ctx.map, a);
      }
      if (a.hasCover && a.grazeMode === 'amble') {
        const cx2 = a.coverX - a.x, cy2 = a.coverY - a.y, cd = Math.hypot(cx2, cy2);
        if (cd > 14) { a.gdx = cx2 / cd; a.gdy = cy2 / cd; }
        else a.grazeMode = 'eat';
      }
    }
    const far = Math.hypot(cohX, cohY) > 0.45 ? 1 : 0.25;
    if (n === 0 && !a.wanderer && !a.pen) {
      // Alone: look for the others a little further off.
      grid.near(a.x, a.y, sp.nbr * 3, nbrs);
      let bx = 0, by = 0, bn = 0;
      for (const b of nbrs) if (b !== a && b.sp === sp && !b.pen && !b.gone) { bx += b.x; by += b.y; bn++; }
      if (bn) { cohX = (bx / bn - a.x) / sp.nbr; cohY = (by / bn - a.y) / sp.nbr; }
    }
    if (a.grazeMode === 'amble') {
      // Wind: a grazing flock wanders downwind.
      dirX = a.gdx + cohX * cohW * far + sx * sepW + wallX * 3 + wx * 0.45;
      dirY = a.gdy + cohY * cohW * far + sy * sepW + wallY * 3 + wy * 0.45;
      spd = sp.graze * (settling ? 0.5 : 1);
    } else {
      dirX = cohX * cohW * far * 0.6 + sx * sepW + wallX * 3;
      dirY = cohY * cohW * far * 0.6 + sy * sepW + wallY * 3;
      spd = Math.hypot(dirX, dirY) > 0.35 ? sp.graze * 0.7 : 0;
    }
  }

  // Jitter when frightened.
  if (a.stress > 0.6 && a.panicT <= 0) {
    const j = (a.stress - 0.6) * 1.2;
    dirX += (Math.random() - 0.5) * j;
    dirY += (Math.random() - 0.5) * j;
  }

  // ---- Steering: turn heading at a limited rate, ease speed ----
  const dl = Math.hypot(dirX, dirY);
  let align = 1;
  if (dl > 0.04) {
    const want = Math.atan2(dirY, dirX);
    const cur = Math.atan2(a.hy, a.hx);
    const diff = angleDiff(cur, want);
    const rate = sp.turn * (a.panicT > 0 ? 1.4 : 1) * (1.7 - 0.7 * Math.min(1, a.speed / sp.run));
    const step = clamp(diff, -rate * dt, rate * dt);
    const na = cur + step;
    a.hx = Math.cos(na);
    a.hy = Math.sin(na);
    align = Math.cos(diff - step);
  } else spd = 0;
  if (a.panicT <= 0) spd *= 0.3 + 0.7 * Math.max(0, align);
  spd *= 1 + 0.2 * a.stress;
  if (a.inWater) spd *= 0.6;
  if (settling && !driven) spd *= 0.4;
  const acc = spd > a.speed ? sp.accel : sp.accel * (settling ? 3.5 : 2);
  a.speed += clamp(spd - a.speed, -acc * dt, acc * dt);

  a.vx = a.hx * a.speed + sx * 10 * sepW;
  a.vy = a.hy * a.speed + sy * 10 * sepW;
  a.x += a.vx * dt;
  a.y += a.vy * dt;

  // Keep out of the dog's body.
  const ddx = a.x - ctx.dogX, ddy = a.y - ctx.dogY;
  const dd = Math.hypot(ddx, ddy), minDog = sp.r + ctx.dogR;
  if (dd < minDog && dd > 1e-3) {
    a.x += (ddx / dd) * (minDog - dd);
    a.y += (ddy / dd) * (minDog - dd);
  }
  collideCircle(ctx.map, a, sp.r, mask);

  // ---- Stress ----
  const crowd = Math.max(0, P - 0.4);
  let gain = crowd * crowd * 2.2 * sp.stressGain * (0.7 + 0.5 * Math.max(0, approachMax));
  if (threat > 0) gain += threat * sp.stressGain * 2.5;
  gain += startle * sp.stressGain * 1.1 * (1 + 0.6 * fog);
  // Left out in the rain they slowly fret.
  gain += rain * 0.035 * sp.stressGain;
  // Being chased flat out is upsetting in itself; a steady walk is not.
  const exert = Math.max(0, (a.speed - sp.walk * 1.15) / (sp.run - sp.walk * 1.15));
  if (!a.pen) gain += Math.pow(exert, 1.5) * 0.6 * sp.stressGain;
  const iso = n === 0 && !a.pen ? sp.social : 0;
  const decay = sp.stressDecay * (P < 0.05 ? 1 : 0.2) * (settling ? 2 : 1) * (a.pen ? 2.2 : 1) * (n > 2 ? 1.2 : 1) * (1 - 0.4 * rain);
  const was = a.stress;
  a.stress = clamp(a.stress + (gain + iso - decay) * dt, 0, 1);
  // Out in the rain, even a quiet flock slowly frets a little.
  if (rain > 0.2 && a.stress < 0.12 * rain) a.stress = Math.min(0.12 * rain, Math.max(a.stress, was + 0.006 * dt));
  if (!a.pen) a.peakStress = Math.max(a.peakStress * (1 - 0.02 * dt), a.stress);
  if (a.stress > 0.86 && a.panicT <= 0 && a.panicCd <= 0 && (P > 0.2 || threat > 0) && !a.pen) {
    // Bolt: away from the worst of it, off at an angle, ignoring the flock.
    const ang = Math.atan2(mainY, mainX) + (Math.random() - 0.5) * 2.2;
    a.pdx = Math.cos(ang);
    a.pdy = Math.sin(ang);
    a.panicT = 1.2 + Math.random() * 1.3;
    a.panicCd = a.panicT + 2.5;
    a.scatterT = a.panicT + 1;
  }

  // ---- Animation facing ----
  const mv = Math.hypot(a.vx, a.vy);
  a.phase += (mv * dt) / (sp.r * 1.3 + 1.5);
  if (mv > 2) {
    const horiz = a.face === 'l' || a.face === 'r';
    const bias = horiz ? 0.7 : 1.4;
    if (Math.abs(a.vx) > Math.abs(a.vy) * bias) a.face = a.vx > 0 ? 'r' : 'l';
    else a.face = a.vy > 0 ? 'd' : 'u';
  }
}

// Nearest rock cell centre within ~48px (goats only).
function findRock(map: WorldMap, a: Animal) {
  const R = 12;
  const cx0 = Math.floor(a.x / CS), cy0 = Math.floor(a.y / CS);
  let best = 1e9;
  a.hasRock = false;
  for (let dy = -R; dy <= R; dy += 1)
    for (let dx = -R; dx <= R; dx += 1) {
      const d2 = dx * dx + dy * dy;
      if (d2 >= best || d2 > R * R) continue;
      if ((map.cell(cx0 + dx, cy0 + dy) & ROCK) === 0) continue;
      best = d2;
      a.rockX = (cx0 + dx) * CS + CS / 2;
      a.rockY = (cy0 + dy) * CS + CS / 2;
      a.hasRock = true;
    }
}

// Nearest tree cover within ~12 tiles: a point just outside the trees.
function findCover(map: WorldMap, a: Animal) {
  const R = 12;
  const tx0 = Math.floor(a.x / TS), ty0 = Math.floor(a.y / TS);
  let best = 1e9;
  a.hasCover = false;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 >= best || d2 > R * R) continue;
      if (map.t(tx0 + dx, ty0 + dy) !== Ter.Forest) continue;
      best = d2;
      const fx = (tx0 + dx) * TS + TS / 2, fy = (ty0 + dy) * TS + TS / 2;
      const l = Math.hypot(a.x - fx, a.y - fy) || 1;
      a.coverX = fx + ((a.x - fx) / l) * 10;
      a.coverY = fy + ((a.y - fy) / l) * 10;
      a.hasCover = true;
    }
}

function pickGraze(a: Animal, cohX: number, cohY: number, n: number) {
  const r = Math.random();
  if (r < 0.55) {
    a.grazeMode = 'eat';
    a.grazeT = 2 + Math.random() * 4;
  } else {
    a.grazeMode = 'amble';
    a.grazeT = 1 + Math.random() * 2.5;
    let ang = Math.random() * Math.PI * 2;
    if (a.wanderer && n > 0 && Math.random() < 0.7) {
      // Wanderers drift away from the flock: these become strays.
      ang = Math.atan2(-cohY, -cohX) + (Math.random() - 0.5) * 1.2;
    } else if (Math.hypot(cohX, cohY) > 0.4) {
      ang = Math.atan2(cohY, cohX) + (Math.random() - 0.5) * 1.5;
    }
    a.gdx = Math.cos(ang);
    a.gdy = Math.sin(ang);
  }
}

// ---- Dog actions ----

export function barkAt(list: Animal[], x: number, y: number, range: number, weather?: Weather): number {
  let hit = 0;
  for (const a of list) {
    if (a.gone || a.carried) continue;
    const dx = a.x - x, dy = a.y - y;
    const d = Math.hypot(dx, dy);
    // Wind carries a bark further downwind.
    const R = weather ? weather.reach(range, dx, dy) : range;
    if (d > R || d < 1e-3) continue;
    const t = 1 - d / R;
    const sp = a.sp;
    const ax = dx / d, ay = dy / d;
    const k = a.pen ? 0.3 : 1;
    // Snap the heading most of the way to "away", then shove.
    a.hx = a.hx * 0.3 + ax * 0.7;
    a.hy = a.hy * 0.3 + ay * 0.7;
    const l = Math.hypot(a.hx, a.hy) || 1;
    a.hx /= l;
    a.hy /= l;
    a.speed = Math.max(a.speed, sp.run * (0.5 + 0.5 * t) * sp.barkMul * k);
    a.fleeT = Math.max(a.fleeT, (0.5 + 0.9 * t) * sp.barkMul * k);
    a.scatterT = Math.max(a.scatterT, (0.8 + 1.2 * t) * k);
    a.stress = clamp(a.stress + (0.12 + 0.22 * t) * sp.barkStress * k, 0, 1);
    a.hop = 1;
    if (sp.balksWater) a.commitT = Math.max(a.commitT, 1.2 * t);
    hit++;
  }
  return hit;
}

// Heel nip: the animal nearest the dog's nose gets a hard shove.
export function nipFrom(list: Animal[], x: number, y: number, hx: number, hy: number, power: number): Animal | null {
  let best: Animal | null = null, bestD = 1e9;
  for (const a of list) {
    if (a.gone || a.pen || a.carried) continue;
    const dx = a.x - x, dy = a.y - y;
    const d = Math.hypot(dx, dy) - a.sp.r;
    if (d > 9) continue;
    const dot = (dx * hx + dy * hy) / (Math.hypot(dx, dy) || 1);
    if (dot < 0.2) continue;
    if (d < bestD) { bestD = d; best = a; }
  }
  if (!best) return null;
  const a = best, sp = a.sp;
  const dx = a.x - x, dy = a.y - y;
  const l = Math.hypot(dx, dy) || 1;
  // Shove along the dog's line, blended with the animal's own heading so a
  // heel nip from behind sends it forward.
  let nx = (dx / l) * 0.6 + hx * 0.4, ny = (dy / l) * 0.6 + hy * 0.4;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  a.hx = nx;
  a.hy = ny;
  a.speed = Math.max(a.speed, sp.walk * 1.4 * sp.nipMul * power);
  a.fleeT = Math.max(a.fleeT, 0.9 * sp.nipMul * power);
  a.commitT = Math.max(a.commitT, 3 * power);
  a.stress = clamp(a.stress + sp.nipStress, 0, 1);
  a.hop = 1;
  return a;
}

// ---- Groups: connected flocks, for strays, HUD and arrows ----

export interface Group {
  id: number;
  species: SpeciesId;
  members: Animal[];
  x: number;
  y: number;
  stress: number;
}

export function findGroups(list: Animal[]): Group[] {
  const free = list.filter((a) => !a.pen && !a.gone && !a.carried);
  const parent = free.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  grid.build(free);
  const index = new Map<Animal, number>();
  free.forEach((a, i) => index.set(a, i));
  for (let i = 0; i < free.length; i++) {
    const a = free[i];
    const link = a.sp.nbr * 1.15;
    grid.near(a.x, a.y, link, nbrs);
    for (const b of nbrs) {
      if (b === a || b.sp !== a.sp) continue;
      const j = index.get(b);
      if (j === undefined) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) < link) {
        const ra = find(i), rb = find(j);
        if (ra !== rb) parent[ra] = rb;
      }
    }
  }
  const groups = new Map<number, Group>();
  free.forEach((a, i) => {
    const r = find(i);
    let gr = groups.get(r);
    if (!gr) groups.set(r, (gr = { id: r, species: a.sp.id, members: [], x: 0, y: 0, stress: 0 }));
    gr.members.push(a);
  });
  const out = [...groups.values()];
  out.forEach((gr, gi) => {
    gr.id = gi;
    for (const a of gr.members) {
      gr.x += a.x;
      gr.y += a.y;
      gr.stress += a.stress;
      a.group = gi;
      a.stray = gr.members.length === 1 && a.sp.social > 0;
    }
    gr.x /= gr.members.length;
    gr.y /= gr.members.length;
    gr.stress /= gr.members.length;
  });
  for (const a of list) if (a.pen) a.stray = false;
  return out;
}

// ---- Drawing ----

const SHADOW: Record<SpeciesId, [number, number]> = {
  duck: [3, 1],
  sheep: [5, 2],
  goat: [5, 2],
  cow: [8, 2],
  pony: [7, 2],
};

export function drawAnimalShadow(g: CanvasRenderingContext2D, a: Animal) {
  const [rx, ry] = SHADOW[a.sp.id];
  const side = a.face === 'l' || a.face === 'r';
  ellipse(g, a.x - 1, a.y + 1, side ? rx : Math.max(2, rx - 2), ry, C.sage);
}

export function drawAnimal(g: CanvasRenderingContext2D, a: Animal, t: number) {
  const S = animalSprites(a.sp.id, a.coat);
  const moving = Math.hypot(a.vx, a.vy) > 2;
  const hop = a.hop > 0 ? -Math.round(Math.sin(a.hop * Math.PI) * 2) : 0;
  const y = a.y + 1 + hop;
  if (a.face === 'l' || a.face === 'r') {
    const flip = a.face === 'l';
    if (!moving && a.grazeMode === 'eat' && a.pressure < 0.03 && a.panicT <= 0) drawSpr(g, S.graze, a.x, y, flip);
    else {
      const f = moving ? ((Math.floor(a.phase) % S.side.length) + S.side.length) % S.side.length : 0;
      drawSpr(g, S.side[f], a.x, y, flip);
    }
  } else {
    const arr = a.face === 'd' ? S.down : S.up;
    const f = moving ? ((Math.floor(a.phase) % arr.length) + arr.length) % arr.length : 0;
    drawSpr(g, arr[f], a.x, y);
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
