import { C } from '../palette';
import { drawSpr } from '../gfx/sprite';
import { critterSprites } from '../art/critters';
import { quality } from '../gfx/quality';
import { CS, TS, Ter, WORLD_W } from '../world/map';
import type { Game } from '../game';

// The valley's wild things, for the eye only: rabbits nibbling at the
// forest's edge morning and evening, deer stepping out at dawn, crows on the
// fences, frogs on the banks. All of them keep away from the dog: rabbits
// bolt in hops, deer bound for the trees, crows lift off, frogs leap into
// the water. None of them touches the herd or the sim.

type Kind = 'rabbit' | 'deer' | 'crow' | 'frog';
interface Wild {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  t: number;
  flee: number; // seconds since it took fright (0 = calm)
  flip: boolean;
  gone: boolean;
}

interface View { ox: number; oy: number; W: number; H: number }

export class Wildlife {
  private list: Wild[] = [];
  private spawnT = 0;

  update(game: Game, dt: number, v: View, frac: number, night: boolean, rings: (x: number, y: number) => void) {
    const dogs = [game.dog, ...game.helpers, ...game.coop];
    const near = (w: Wild, r: number) => dogs.some((d) => Math.hypot(d.x - w.x, d.y - w.y) < r);
    for (const w of this.list) {
      w.t += dt;
      switch (w.kind) {
        case 'rabbit':
          if (!w.flee && near(w, 38)) {
            w.flee = 0.01;
            const d = this.nearest(dogs, w);
            const a = Math.atan2(w.y - d.y, w.x - d.x);
            w.vx = Math.cos(a) * 52;
            w.vy = Math.sin(a) * 36;
            w.flip = w.vx < 0;
          }
          if (w.flee) {
            w.flee += dt;
            // Bounding hops: off the ground half the time.
            const ph = (w.flee * 5) % 1;
            w.z = Math.sin(ph * Math.PI) * 3;
            w.x += w.vx * dt;
            w.y += w.vy * dt;
            if (this.underTrees(game, w) || w.flee > 3) w.gone = true;
          } else if (w.t > 2 && Math.random() < dt * 0.25) {
            // An idle hop or two.
            w.flip = Math.random() < 0.5;
            w.x += w.flip ? -3 : 3;
          }
          break;
        case 'deer':
          if (!w.flee && near(w, 72)) {
            w.flee = 0.01;
            const d = this.nearest(dogs, w);
            const a = Math.atan2(w.y - d.y, w.x - d.x);
            w.vx = Math.cos(a) * 70;
            w.vy = Math.sin(a) * 44;
            w.flip = w.vx < 0;
          }
          if (w.flee) {
            w.flee += dt;
            w.z = Math.abs(Math.sin(w.flee * 7)) * 3;
            w.x += w.vx * dt;
            w.y += w.vy * dt;
            if ((w.flee > 0.6 && this.underTrees(game, w)) || w.flee > 4) w.gone = true;
          }
          break;
        case 'crow':
          if (!w.flee && near(w, 30)) {
            w.flee = 0.01;
            w.vx = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 15);
            w.vy = -22;
            w.flip = w.vx < 0;
          }
          if (w.flee) {
            w.flee += dt;
            w.x += w.vx * dt;
            w.y += w.vy * dt;
            w.z += 14 * dt;
            if (w.flee > 5) w.gone = true;
          }
          break;
        case 'frog':
          if (!w.flee && near(w, 26)) {
            w.flee = 0.01;
            const d = this.nearest(dogs, w);
            w.vx = Math.sign(w.x - d.x || 1) * 18;
            w.flip = w.vx < 0;
          }
          if (w.flee) {
            w.flee += dt;
            w.x += w.vx * dt;
            w.z = Math.sin(Math.min(1, w.flee / 0.45) * Math.PI) * 5;
            if (w.flee > 0.45) {
              rings(w.x, w.y);
              w.gone = true;
            }
          }
          break;
      }
      if (w.x < v.ox - 60 || w.x > v.ox + v.W + 60 || w.y < v.oy - 60 || w.y > v.oy + v.H + 60) w.gone = true;
    }
    this.list = this.list.filter((w) => !w.gone);
    if ((this.spawnT -= dt) > 0 || night) return;
    this.spawnT = 0.4;
    // Who is about at this hour.
    const edge = frac < 0.3 || (frac > 0.6 && frac < 0.85);
    const want: Record<Kind, number> = {
      rabbit: Math.round((edge ? 3 : 1) * quality.fx),
      deer: frac < 0.2 || (frac > 0.72 && frac < 0.85) ? Math.round(3 * quality.fx) : 0,
      crow: Math.round(3 * quality.fx),
      frog: Math.round(2 * quality.fx),
    };
    const count = (k: Kind) => this.list.filter((w) => w.kind === k).length;
    for (const k of ['rabbit', 'deer', 'crow', 'frog'] as Kind[]) {
      if (count(k) >= want[k]) continue;
      const spot = k === 'crow' ? this.perch(game, v) : this.spotFor(game, v, k);
      if (!spot) continue;
      if (dogs.some((d) => Math.hypot(d.x - spot.x, d.y - spot.y) < (k === 'deer' ? 110 : 60))) continue;
      const n = k === 'deer' ? 1 + Math.floor(Math.random() * 3) : 1;
      for (let i = 0; i < n; i++)
        this.list.push({ kind: k, x: spot.x + i * 9 * (Math.random() < 0.5 ? -1 : 1), y: spot.y + (Math.random() - 0.5) * 6, vx: 0, vy: 0, z: 0, t: Math.random() * 3, flee: 0, flip: Math.random() < 0.5, gone: false });
    }
  }

  private nearest(dogs: { x: number; y: number }[], w: Wild) {
    let best = dogs[0], bd = 1e9;
    for (const d of dogs) {
      const dd = Math.hypot(d.x - w.x, d.y - w.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  private underTrees(game: Game, w: Wild) {
    const i = Math.floor(w.y) * WORLD_W + Math.floor(w.x);
    return game.baked.canopyKind[i] > 0;
  }

  // Open grass in view near the trees (rabbits, deer) or on a bank (frogs).
  private spotFor(game: Game, v: View, k: Kind): { x: number; y: number } | null {
    for (let tries = 0; tries < 8; tries++) {
      const x = Math.floor(v.ox + 8 + Math.random() * (v.W - 16)), y = Math.floor(v.oy + 8 + Math.random() * (v.H - 16));
      if (game.map.t(Math.floor(x / TS), Math.floor(y / TS)) !== Ter.Grass) continue;
      const i = y * WORLD_W + x;
      const soil = game.baked.soil[i];
      if (game.baked.canopyKind[i]) continue;
      if (k === 'frog') {
        if (soil === 2 || (soil !== 3 && (game.baked.soil[i + 2] === 3 || game.baked.soil[i - 2] === 3 || game.baked.soil[i + 2 * WORLD_W] === 3))) return { x, y };
        continue;
      }
      if (soil !== 0) continue;
      const reach = k === 'deer' ? 22 : 14;
      for (const [dx, dy] of [[reach, 0], [-reach, 0], [0, -reach], [0, reach]])
        if (game.baked.canopyKind[(y + dy) * WORLD_W + x + dx]) return { x, y };
    }
    return null;
  }

  // A spot on a fence rail in view for a crow.
  private perch(game: Game, v: View): { x: number; y: number } | null {
    const fences = game.ranch.buildings.filter((b) => (b.kind === 'pen' || b.kind === 'fence') && b.x1 > v.ox && b.x0 < v.ox + v.W && b.y1 > v.oy && b.y0 < v.oy + v.H);
    if (!fences.length || Math.random() < 0.6) return null;
    const b = fences[Math.floor(Math.random() * fences.length)];
    const x = Math.round(b.x0 + 3 + Math.random() * (b.x1 - b.x0 - 6));
    const y = b.kind === 'pen' ? b.y0 + CS - 1 - 4 : b.y1 - 1 - 4;
    return { x, y };
  }

  // On the ground, under the herd: rabbits, deer, frogs and their shadows.
  drawGround(g: CanvasRenderingContext2D, t: number) {
    const S = critterSprites();
    for (const w of this.list) {
      if (w.kind === 'crow') continue;
      g.fillStyle = C.sage;
      const sw = w.kind === 'deer' ? 7 : w.kind === 'rabbit' ? 4 : 3;
      g.fillRect(Math.round(w.x - sw / 2), Math.round(w.y + 1), sw, 1);
      let s;
      if (w.kind === 'rabbit') s = S.rabbit[w.flee ? 2 : Math.floor(t * 2 + w.x) % 5 === 0 ? 1 : 0];
      else if (w.kind === 'deer') s = S.deer[w.flee ? 2 : Math.floor(t / 2 + w.x * 0.1) % 3 === 0 ? 0 : 1];
      else s = S.frog[w.flee ? 1 : 0];
      drawSpr(g, s, w.x, w.y - w.z, w.flip);
    }
  }

  // Crows sit on the fence rails, so they draw over them.
  drawAir(g: CanvasRenderingContext2D, t: number) {
    const S = critterSprites();
    for (const w of this.list) {
      if (w.kind !== 'crow') continue;
      const s = w.flee ? S.crow[1 + (Math.floor(t * 9) % 2)] : S.crow[0];
      drawSpr(g, s, w.x, w.y - w.z, w.flip);
      if (w.flee) {
        g.fillStyle = C.sage;
        g.fillRect(Math.round(w.x - w.z * 0.5), Math.round(w.y + 4 + w.z * 0.3), 2, 1);
      }
    }
  }
}
