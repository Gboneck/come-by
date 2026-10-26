import { C } from '../palette';
import { drawSpr, tint, type Sprite } from '../gfx/sprite';
import { PX, fine } from '../gfx/screen';
import { fxSprites } from '../art/fx';
import { critterSprites } from '../art/critters';
import { chimneyTop } from '../art/buildings';
import { yardFire } from '../art/course';
import { hash2, mulberry32 } from '../rng';
import { drift, stepWind } from './wind';
import { WeatherFx } from './weather';
import { FineWorld } from './light';
import { Wildlife } from './wildlife';
import { skyDarkness } from './sky';
import { SHALLOW, TS, Ter, WORLD_H, WORLD_W, type SpeciesId } from '../world/map';
import { seasonLook } from '../art/seasonlook';
import type { Game } from '../game';
import { quality } from '../gfx/quality';

// A living valley, purely for the eye: butterflies and birds (with their
// shadows) by day, fireflies at night, chimney smoke, and the traces animals
// leave: footprints in soft ground, ripples and splashes in the ford, dust
// that suits each species. Nothing here touches the simulation.

interface Fly { x: number; y: number; z: number; a: number; t: number; white: boolean; flee: number }
interface Bird { x: number; y: number; vx: number; vy: number; ph: number }
interface Glow { x: number; y: number; vx: number; vy: number; ph: number; rate: number }
interface Print { x: number; y: number; shape: number[][]; col: string; life: number; max: number }
type FxKind = 'anim' | 'ring' | 'drop' | 'smoke' | 'feather' | 'pebble' | 'leaf' | 'breath' | 'fish';
interface Bit {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  life: number;
  max: number;
  frames?: Sprite[];
  flip?: boolean;
  size: number;
  col: string;
}
interface Track { x: number; y: number; d: number; side: number; dustT: number; ringT: number; breathT: number }

interface Walker { x: number; y: number; vx: number; vy: number; face?: string }

// Footprint shapes (pixel offsets from the foot) and stride per walker.
const PRINT: Record<SpeciesId | 'dog', { shape: number[][]; stride: number; spread: number }> = {
  duck: { shape: [[0, 0], [-1, 1], [1, 1]], stride: 3, spread: 1 },
  sheep: { shape: [[0, 0], [1, 0]], stride: 5, spread: 1 },
  goat: { shape: [[0, 0], [1, 0]], stride: 5, spread: 1 },
  cow: { shape: [[0, 0], [1, 0], [0, 1], [1, 1]], stride: 7, spread: 2 },
  pony: { shape: [[-1, 0], [1, 0], [0, -1]], stride: 7, spread: 2 },
  dog: { shape: [[0, 0], [-1, -1], [1, -1]], stride: 5, spread: 1 },
};

const MAX_PRINTS = 360;

export class Life {
  private flies: Fly[] = [];
  private birds: Bird[] = [];
  private birdT = 12;
  private glows: Glow[] = [];
  private prints: Print[] = [];
  private bits: Bit[] = [];
  private smokeT = 0;
  private fishT = 4;
  private rnd = mulberry32(9133); // its own stream: the herd's stays untouched
  private track = new WeakMap<object, Track>();
  private t = 0;
  wx = new WeatherFx();
  lit = new FineWorld();
  wild = new Wildlife();
  vt = 0; // the valley's own clock: runs up to x12 while the dog rests

  update(game: Game, dt: number) {
    // Resting is a time-lapse: wind, clouds, smoke and water all run fast.
    const lapse = Math.max(1, game.rest);
    stepWind(dt * lapse, game.weather.wind);
    this.wx.update(game, dt, lapse);
    this.vt += dt * lapse;
    const dtl = dt * lapse;
    this.t += dtl;
    const v = game.view();
    const dark = skyDarkness(game.day);
    const night = game.day.phase === 'night';
    // Rain and fog keep the butterflies and birds in; a storm, everything.
    const w = game.weather;
    const fair = Math.max(0, 1 - w.rain * 3) * Math.max(0, 1 - w.fog * 1.5);
    const quick = dt * Math.min(lapse, 3);
    this.updateFlies(game, quick, v, fair > 0.5 ? dark : 1, night);
    this.updateBirds(quick, v, fair > 0.3 ? dark : 1);
    this.updateGlows(game, dt, v, w.rain > 0.5 ? 0 : dark, night && w.rain < 0.5);
    // Now and then a fish jumps in deep water: an arc, a splash, rings.
    if ((this.fishT -= dt) <= 0 && game.season.snow < 0.5) {
      this.fishT = 4 + this.rnd() * 7;
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(v.ox + this.rnd() * v.W), y = Math.floor(v.oy + this.rnd() * v.H);
        const i = y * WORLD_W + x;
        if (game.baked.soil[i] !== 3 || game.baked.waterDist[i] < 4) continue;
        this.add({ kind: 'fish', x, y, vx: (this.rnd() < 0.5 ? -1 : 1) * 10, z: 0, vz: 34, max: 0.55 });
        break;
      }
    }
    this.wild.update(game, dt, v, game.day.frac, night || dark > 0.35 || w.rain > 0.6, (x, y) => this.add({ kind: 'ring', x, y, max: 0.8, size: 4 }));

    // Chimney smoke, drifting downwind.
    const f = game.ranch.farmhouse;
    if (f && (this.smokeT -= dtl) <= 0) {
      this.smokeT = 0.28 + Math.random() * 0.12;
      const c = chimneyTop(f);
      if (this.near(v, c.x, c.y, 80)) this.add({ kind: 'smoke', x: c.x + (Math.random() - 0.5), y: c.y, vy: -9 - Math.random() * 2, max: 2.2 + Math.random() * 0.6 });
      // The drover's camp fire smokes too, thinner.
      const dv = game.ranch.yards.find((y) => y.site.id === 'drover');
      if (dv && Math.random() < 0.6) {
        const f = yardFire(dv.site);
        if (this.near(v, f.x, f.y, 60)) this.add({ kind: 'smoke', x: f.x, y: f.y - 3, vy: -7, max: 1.6 + Math.random() * 0.5 });
      }
    }

    // Traces of everything that walks.
    for (const a of game.animals) {
      if (a.gone || a.carried || a.pen) continue;
      if (!this.near(v, a.x, a.y, 30)) continue;
      this.walk(game, a, a.sp.id, dt, a.sp.run, a.inWater, a.onRock);
    }
    // Falling leaves in autumn, blossom petals in spring, from the trees in
    // view, blown on the wind.
    const se = game.season;
    const fall = se.leaves * 7 + se.bloom * 2.5;
    if (fall > 0.2 && Math.random() < fall * dt) {
      const x = v.ox + Math.random() * v.W, y = v.oy + Math.random() * v.H;
      const k = game.baked.canopyKind[Math.floor(y) * WORLD_W + Math.floor(x)];
      if (k === 1 || k === 2) {
        const autumn = Math.random() * (se.leaves + se.bloom) < se.leaves;
        const col = autumn ? (Math.random() < 0.6 ? C.butter : Math.random() < 0.6 ? C.plum : C.sage) : Math.random() < 0.8 ? C.wool : C.butter;
        this.add({ kind: 'leaf', x, y: y + 8, z: 8 + Math.random() * 6, vz: -6 - Math.random() * 4, max: 6 + Math.random() * 3, col });
      }
    }
    for (const a of game.animals) if (a.pen && !a.gone && Math.hypot(a.vx, a.vy) > a.sp.run * 0.6 && this.near(v, a.x, a.y, 20)) this.walk(game, a, a.sp.id, dt, a.sp.run, false, false);
    const d = game.dog;
    if (!d.lying) this.walk(game, d, 'dog', dt, d.stats.sprint, false, false);
    for (const h of game.helpers) if (this.near(v, h.x, h.y, 30)) this.walk(game, h, 'dog', dt, 80, false, false);

    for (const b of this.bits) {
      const bdt = b.kind === 'smoke' ? dtl : dt;
      b.life -= bdt;
      b.x += b.vx * bdt;
      b.y += b.vy * bdt;
      b.z += b.vz * bdt;
      switch (b.kind) {
        case 'anim': b.vx *= 0.9; b.vy *= 0.9; break;
        case 'smoke': b.vx = drift(b.x, b.y, this.t) * 0.45 * (1 - b.life / b.max) * 2; b.vy *= 0.99; break;
        case 'drop': case 'pebble':
          b.vz -= 160 * dt;
          if (b.z < 0) { b.z = 0; b.vz = b.kind === 'pebble' ? -b.vz * 0.3 : 0; if (b.kind === 'drop') b.life = 0; }
          break;
        case 'feather': b.vz = -5; b.vx = Math.sin(b.life * 6) * 10 + drift(b.x, b.y, this.t) * 0.5; if (b.z <= 0) b.vz = 0; break;
        case 'leaf':
          if (b.z > 0) b.vx = Math.sin(b.life * 3 + b.x) * 6 + drift(b.x, b.y, this.t) * 0.9;
          else { b.z = 0; b.vz = 0; b.vx = 0; }
          break;
        case 'breath': b.vx *= 0.96; break;
        case 'fish':
          b.vz -= 120 * dt;
          if (b.z < 0) {
            b.life = 0;
            this.add({ kind: 'ring', x: b.x, y: b.y, max: 0.9, size: 5 });
            for (let i = 0; i < 3; i++) this.add({ kind: 'drop', x: b.x, y: b.y, vx: (this.rnd() - 0.5) * 30, vy: 0, z: 1, vz: 20 + this.rnd() * 15, max: 1 });
          }
          break;
      }
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    for (const p of this.prints) p.life -= dt;
    if (this.prints.length && this.prints[0].life <= 0) this.prints = this.prints.filter((p) => p.life > 0);
  }

  private near(v: { ox: number; oy: number; W: number; H: number }, x: number, y: number, m: number) {
    return x > v.ox - m && x < v.ox + v.W + m && y > v.oy - m && y < v.oy + v.H + m;
  }

  // Droplets flung from a dog shaking itself off.
  spray(x: number, y: number) {
    if (Math.random() < 0.5) return;
    const a = Math.random() * Math.PI * 2;
    this.add({ kind: 'drop', x: x + Math.cos(a) * 3, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 8, z: 4, vz: 20 + Math.random() * 25, max: 1 });
  }

  private add(p: Partial<Bit> & { kind: FxKind; x: number; y: number }) {
    const max = p.max ?? 0.5;
    this.bits.push({ vx: 0, vy: 0, z: 0, vz: 0, size: 1, col: C.wool, life: max, max, ...p });
  }

  private walk(game: Game, w: Walker, id: SpeciesId | 'dog', dt: number, run: number, inWater: boolean, onRock: boolean) {
    let tr = this.track.get(w);
    if (!tr) {
      tr = { x: w.x, y: w.y, d: 0, side: 1, dustT: Math.random() * 0.3, ringT: 0, breathT: Math.random() * 2 };
      this.track.set(w, tr);
    }
    const step = Math.hypot(w.x - tr.x, w.y - tr.y);
    tr.x = w.x;
    tr.y = w.y;
    if (step > 20) return; // teleported (new day, rescue)
    const speed = Math.hypot(w.vx, w.vy);
    // Winter: breath puffs from the muzzle, quicker when hurrying.
    if (seasonLook.snow > 0.5 && w.face !== 'u' && (tr.breathT -= dt) <= 0) {
      tr.breathT = (speed > run * 0.5 ? 0.9 : 1.8) + Math.random() * 0.6;
      const big = id === 'cow' || id === 'pony' ? 1.6 : id === 'duck' ? 0.6 : 1;
      const sx = w.face === 'r' ? 1 : w.face === 'l' ? -1 : 0;
      const fx = w.x + sx * (id === 'dog' ? 6 : 5 * big), fy = w.y - (w.face === 'd' ? 2 : 5 * big);
      this.add({ kind: 'breath', x: fx, y: fy, vx: sx * 6 + drift(fx, fy, this.t) * 0.3, vy: -4, max: 0.9, size: big });
    }
    if (speed < 3) return;
    const soil = this.soilAt(game, w.x, w.y);
    const wet = inWater || soil === 3 || (game.map.flagsAtPx(w.x, w.y) & SHALLOW) !== 0;
    const running = speed > run * 0.62;
    const ux = w.vx / speed, uy = w.vy / speed;

    if (wet) {
      // Rings spreading from the legs, droplets when hurrying.
      if ((tr.ringT -= dt) <= 0) {
        tr.ringT = running ? 0.18 : 0.32;
        this.add({ kind: 'ring', x: w.x, y: w.y, max: 0.8, size: id === 'cow' || id === 'pony' ? 6 : id === 'duck' ? 3 : 4.5 });
        if (running || id === 'dog')
          for (let i = 0; i < 2; i++)
            this.add({ kind: 'drop', x: w.x + (Math.random() - 0.5) * 4, y: w.y, vx: (Math.random() - 0.5) * 24 - ux * 10, vy: (Math.random() - 0.5) * 6, vz: 30 + Math.random() * 30, max: 1 });
      }
      return;
    }

    // Footprints: always in soft ground, on grass only when running.
    tr.d += step;
    const P = PRINT[id];
    if (tr.d >= P.stride) {
      tr.d = 0;
      tr.side = -tr.side;
      const snowy = seasonLook.snow > 0.4 && soil !== 4;
      if (snowy || soil === 1 || soil === 2 || (soil === 0 && running && id !== 'duck')) {
        const px = Math.round(w.x - uy * P.spread * tr.side), py = Math.round(w.y + 1 + ux * P.spread * tr.side);
        // In snow every step leaves a print, and it lasts.
        const col = snowy ? C.sage : soil === 0 ? C.moss : soil === 1 ? C.sage : C.plum;
        const max = snowy ? 9 : soil === 0 ? 2.5 : 6;
        this.prints.push({ x: px, y: py, shape: P.shape, col, life: max, max });
        if (this.prints.length > MAX_PRINTS) this.prints.shift();
      }
    }

    // Dust that suits the animal: cattle raise clouds, ponies a puff at each
    // stride, sheep and goats a little, ducks shed a feather.
    if (!running || id === 'dog') return;
    if ((tr.dustT -= dt) > 0) return;
    const F = fxSprites();
    const bx = w.x - ux * 3, by = w.y;
    switch (id) {
      case 'cow':
        tr.dustT = 0.26;
        this.add({ kind: 'anim', x: bx, y: by, vx: -ux * 8, vy: -uy * 4, max: 0.5, frames: F.bigPuff, flip: Math.random() < 0.5 });
        break;
      case 'pony':
        tr.dustT = 0.2;
        this.add({ kind: 'anim', x: bx, y: by, vx: -ux * 10, vy: -uy * 5, max: 0.38, frames: F.puff, flip: Math.random() < 0.5 });
        break;
      case 'sheep':
      case 'goat':
        tr.dustT = 0.42;
        if (onRock) {
          this.add({ kind: 'pebble', x: w.x, y: w.y, vx: (Math.random() - 0.5) * 30, vy: 6 + Math.random() * 8, vz: 20, max: 0.8, col: Math.random() < 0.5 ? C.sage : C.plum });
        } else this.add({ kind: 'anim', x: bx, y: by, vx: -ux * 6, vy: -uy * 3, max: 0.34, frames: F.puff, flip: Math.random() < 0.5 });
        break;
      case 'duck':
        tr.dustT = 0.5;
        if (Math.random() < 0.45) this.add({ kind: 'feather', x: w.x, y: w.y, z: 5, vy: 2, max: 1.6 });
        break;
    }
  }

  private soilAt(game: Game, x: number, y: number): number {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= WORLD_W || iy >= WORLD_H) return 0;
    return game.baked.soil[iy * WORLD_W + ix];
  }

  private openGrass(game: Game, x: number, y: number) {
    return game.map.t(Math.floor(x / TS), Math.floor(y / TS)) === Ter.Grass && this.soilAt(game, x, y) === 0;
  }

  // Butterflies wander over open grass by day and scatter from the dog.
  private updateFlies(game: Game, dt: number, v: { ox: number; oy: number; W: number; H: number }, dark: number, night: boolean) {
    const want = night || dark > 0.15 ? 0 : Math.round(((v.W * v.H) / 16000) * quality.fx);
    if (this.flies.length < want && Math.random() < dt * 1.5) {
      // Enter from just outside the view, over grass.
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? v.ox - 6 : side === 1 ? v.ox + v.W + 6 : v.ox + Math.random() * v.W;
      const y = side === 2 ? v.oy - 6 : side === 3 ? v.oy + v.H + 6 : v.oy + Math.random() * v.H;
      if (this.openGrass(game, x, y))
        this.flies.push({ x, y, z: 5, a: Math.atan2(v.oy + v.H / 2 - y, v.ox + v.W / 2 - x), t: Math.random() * 10, white: Math.random() < 0.4, flee: 0 });
    }
    const d = game.dog;
    for (const f of this.flies) {
      f.t += dt;
      f.a += (Math.random() - 0.5) * 6 * dt + Math.sin(f.t * 1.7) * dt;
      const dd = Math.hypot(f.x - d.x, f.y - d.y);
      if (dd < 22 && f.flee <= 0) f.flee = 1.2;
      let sp = 11;
      if (f.flee > 0) {
        f.flee -= dt;
        f.a = Math.atan2(f.y - d.y, f.x - d.x);
        sp = 30;
      }
      f.x += (Math.cos(f.a) * sp + drift(f.x, f.y, this.t) * 0.4) * dt;
      f.y += Math.sin(f.a) * sp * 0.8 * dt;
      f.z = 5 + Math.sin(f.t * 2.3) * 2 + (f.flee > 0 ? 5 : 0);
    }
    // Leave when far off screen, or when the light goes.
    this.flies = this.flies.filter((f) => this.near(v, f.x, f.y, 50) && !(want === 0 && Math.random() < dt * 0.5));
  }

  // Now and then a few birds cross the sky, their shadows sliding over the
  // ground far below them.
  private updateBirds(dt: number, v: { ox: number; oy: number; W: number; H: number }, dark: number) {
    if (dark < 0.1 && (this.birdT -= dt) <= 0) {
      this.birdT = 18 + Math.random() * 25;
      const right = Math.random() < 0.5;
      const n = 3 + Math.floor(Math.random() * 3);
      const y0 = v.oy + v.H * (0.15 + Math.random() * 0.6);
      const vx = (right ? -1 : 1) * (34 + Math.random() * 10), vy = (Math.random() - 0.5) * 12;
      for (let i = 0; i < n; i++) {
        const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        this.birds.push({ x: (right ? v.ox + v.W + 30 : v.ox - 30) + Math.abs(k) * 7 * (right ? 1 : -1), y: y0 + k * 6, vx, vy, ph: Math.random() * 6 });
      }
    }
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += (b.vy + Math.sin(this.t * 1.5 + b.ph) * 3) * dt;
      b.ph += dt;
    }
    this.birds = this.birds.filter((b) => this.near(v, b.x, b.y, 80));
  }

  // Fireflies along the meadows at dusk and through the night.
  private updateGlows(game: Game, dt: number, v: { ox: number; oy: number; W: number; H: number }, dark: number, night: boolean) {
    const want = Math.round((((night ? 1 : Math.max(0, dark - 0.2) * 3) * (v.W * v.H)) / 7000) * quality.fx);
    if (this.glows.length < want && Math.random() < dt * 6) {
      const x = v.ox + Math.random() * v.W, y = v.oy + Math.random() * v.H;
      if (this.openGrass(game, x, y)) this.glows.push({ x, y, vx: 0, vy: 0, ph: Math.random() * 10, rate: 0.6 + Math.random() * 0.8 });
    }
    for (const g of this.glows) {
      g.ph += dt * g.rate;
      g.vx += (Math.random() - 0.5) * 30 * dt;
      g.vy += (Math.random() - 0.5) * 30 * dt;
      g.vx *= 0.97;
      g.vy *= 0.97;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    this.glows = this.glows.filter((g) => this.near(v, g.x, g.y, 20) && !(this.glows.length > want && Math.random() < dt * 0.3));
  }

  // ---- Drawing ----

  // On the ground, under everything that stands: prints, ripples, dust and
  // the shadows of things in the air. On the fine grid.
  drawGround(g: CanvasRenderingContext2D) {
    this.wild.drawGround(g, this.t);
    fine(g, (fg) => {
      for (const p of this.prints) {
        const k = p.life / p.max;
        if (k < 0.4 && hash2(p.x, p.y, Math.floor(p.life * 5)) > k / 0.4) continue;
        fg.fillStyle = p.col;
        for (const [dx, dy] of p.shape) fg.fillRect((p.x + dx) * PX, (p.y + dy) * PX + 1, 2, 1);
      }
      for (const b of this.bits) {
        const t = 1 - b.life / b.max;
        if (b.kind === 'ring') {
          const rx = Math.round((1 + t * b.size) * PX), ry = Math.max(1, Math.round(rx * 0.45));
          fg.fillStyle = C.wool;
          const n = rx * 4 + 4;
          for (let i = 0; i < n; i++) {
            if (t > 0.5 && (i + Math.floor(t * 10)) % 3 === 0) continue;
            if (t > 0.75 && i % 2) continue;
            const a = (i / n) * Math.PI * 2;
            fg.fillRect(Math.round(b.x * PX + Math.cos(a) * rx), Math.round(b.y * PX + Math.sin(a) * ry), 1, 1);
          }
        } else if (b.kind === 'drop' || b.kind === 'pebble' || b.kind === 'feather') {
          if (b.z > 1) { fg.fillStyle = C.sage; fg.fillRect(Math.round(b.x * PX), Math.round(b.y * PX), 2, 1); }
        } else if (b.kind === 'leaf' && b.z <= 0) {
          // A fallen leaf lies a while, then is gone.
          if (b.life < 1 && Math.floor(b.life * 8) % 2) continue;
          fg.fillStyle = b.col;
          const X = Math.round(b.x * PX), Y = Math.round(b.y * PX);
          fg.fillRect(X, Y, 2, 1);
          fg.fillRect(X + 1, Y - 1, 1, 1);
        } else if (b.kind === 'leaf') {
          fg.fillStyle = C.sage;
          fg.fillRect(Math.round((b.x - b.z * 0.4) * PX), Math.round((b.y + b.z * 0.2) * PX), 2, 1);
        }
      }
      fg.fillStyle = C.sage;
      for (const f of this.flies) {
        const sx = Math.round((f.x - f.z * 0.5) * PX), sy = Math.round((f.y + f.z * 0.4) * PX);
        fg.fillRect(sx - (Math.floor(f.t * 9) % 3 === 1 ? 2 : 0), sy, Math.floor(f.t * 9) % 3 === 1 ? 5 : 1, 1);
      }
    });
    for (const b of this.bits) {
      if (b.kind !== 'anim') continue;
      const t = 1 - b.life / b.max;
      const fr = b.frames!;
      drawSpr(g, fr[Math.min(fr.length - 1, Math.floor(t * fr.length))], b.x, b.y, b.flip);
    }
    const S = critterSprites();
    for (const b of this.birds) {
      const sx = Math.round(b.x - 14), sy = Math.round(b.y + 18);
      drawSpr(g, tintShadow(S.bird[Math.floor(b.ph * 7) % 3]), sx, sy);
    }
  }

  // Above the canopy: things in the air. On the fine grid.
  drawAir(g: CanvasRenderingContext2D) {
    this.wild.drawAir(g, this.t);
    fine(g, (fg) => {
      for (const b of this.bits) {
        const k = b.life / b.max;
        switch (b.kind) {
          case 'fish': {
            // A small fish arching out of the water, its wool belly flashing,
            // drops flying as it breaks the surface.
            const X = Math.round(b.x * PX), Y = Math.round((b.y - b.z) * PX);
            const up = b.vz > 0;
            fg.fillStyle = C.plum;
            fg.fillRect(X, Y, 4, 1);
            fg.fillRect(up ? X + 3 : X, Y - 1, 1, 1);
            fg.fillStyle = C.teal;
            fg.fillRect(X + 1, Y, 2, 1);
            fg.fillStyle = C.wool;
            fg.fillRect(X + 1, Y + 1, 2, 1);
            if (b.max - b.life < 0.12) {
              const W0 = Math.round(b.y * PX);
              fg.fillRect(X - 2, W0, 1, 1); fg.fillRect(X + 5, W0, 1, 1); fg.fillRect(X - 1, W0 - 2, 1, 1); fg.fillRect(X + 4, W0 - 2, 1, 1);
            }
            break;
          }
          case 'leaf': {
            if (b.z <= 0) break;
            // Tumbling: edge on, then flat, as it turns over.
            const X = Math.round(b.x * PX), Y = Math.round((b.y - b.z) * PX);
            fg.fillStyle = b.col;
            if (Math.floor(b.life * 7) % 2) { fg.fillRect(X, Y, 3, 1); fg.fillRect(X + 1, Y - 1, 1, 1); }
            else fg.fillRect(X, Y, 1, 2);
            break;
          }
          case 'breath': {
            // A small cloud of breath that swells and thins away.
            const t = 1 - k;
            const r = b.size * (0.4 + t * 1.6) * PX;
            const cx = Math.round(b.x * PX), cy = Math.round(b.y * PX);
            const R = Math.ceil(r);
            fg.fillStyle = C.wool;
            for (let dy = -R; dy <= R; dy++)
              for (let dx = -R; dx <= R; dx++) {
                if (dx * dx + dy * dy > r * r || hash2((cx + dx) >> 1, (cy + dy) >> 1, 11) > k * 1.2) continue;
                fg.fillRect(cx + dx, cy + dy, 1, 1);
              }
            break;
          }
          case 'smoke': {
            // A round puff that swells and thins out, edge first.
            const t = 1 - k;
            const r = (0.8 + t * 1.9) * PX;
            const cx = Math.round(b.x * PX), cy = Math.round(b.y * PX);
            const R = Math.ceil(r);
            fg.fillStyle = C.wool;
            for (let dy = -R; dy <= R; dy++) {
              const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
              if (hw <= 0) continue;
              if (k > 0.45) fg.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
              else for (let dx = -hw; dx <= hw; dx++) if (((cx + dx + cy + dy) & 1) === 0 && Math.hypot(dx, dy) < r * (0.3 + k)) fg.fillRect(cx + dx, cy + dy, 1, 1);
            }
            break;
          }
          case 'drop':
            fg.fillStyle = C.wool;
            fg.fillRect(Math.round(b.x * PX), Math.round((b.y - b.z) * PX), 1, 2);
            break;
          case 'pebble':
            fg.fillStyle = b.col;
            fg.fillRect(Math.round(b.x * PX), Math.round((b.y - b.z) * PX), 2, 2);
            break;
          case 'feather': {
            const X = Math.round(b.x * PX), Y = Math.round((b.y - b.z) * PX);
            fg.fillStyle = C.wool;
            if (Math.floor(b.life * 4) % 2) { fg.fillRect(X, Y, 3, 1); fg.fillRect(X + 1, Y - 1, 2, 1); }
            else { fg.fillRect(X, Y, 1, 3); fg.fillRect(X + 1, Y + 1, 1, 2); }
            break;
          }
        }
      }
    });
    const S = critterSprites();
    for (const f of this.flies) {
      const fr = (f.white ? S.flyW : S.flyY)[Math.floor(f.t * 9) % 3];
      drawSpr(g, fr, f.x, f.y - f.z);
    }
    for (const b of this.birds) drawSpr(g, S.bird[Math.floor(b.ph * 7) % 3], b.x, b.y);
  }

  // Above the night: fireflies pulse in the dark, a glow round the bright
  // ones. On the fine grid.
  drawGlow(g: CanvasRenderingContext2D) {
    fine(g, (fg) => {
      fg.fillStyle = C.butter;
      for (const f of this.glows) {
        const s = Math.sin(f.ph * 2.2);
        if (s < 0.35) continue;
        const X = Math.round(f.x * PX), Y = Math.round(f.y * PX);
        fg.fillRect(X, Y, 2, 2);
        if (s > 0.8) {
          fg.fillRect(X - 1, Y, 1, 2);
          fg.fillRect(X + 2, Y, 1, 2);
          fg.fillRect(X, Y - 1, 2, 1);
          fg.fillRect(X, Y + 2, 2, 1);
        }
        if (s > 0.95) { fg.fillRect(X - 3, Y, 1, 1); fg.fillRect(X + 4, Y + 1, 1, 1); fg.fillRect(X + 1, Y - 3, 1, 1); fg.fillRect(X, Y + 4, 1, 1); }
      }
    });
  }
}

const shadows = new Map<Sprite, Sprite>();
function tintShadow(s: Sprite): Sprite {
  let t = shadows.get(s);
  if (!t) shadows.set(s, (t = tint(s, C.sage)));
  return t;
}
