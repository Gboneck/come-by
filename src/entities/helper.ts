import { C } from '../palette';
import { ellipse } from '../gfx/draw';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { makeDogSprites, type DogSprites } from '../art/dog';
import { BLOCK_DOG } from '../world/map';
import { collideCircle, wallRepulse } from '../world/collide';
import { PathFollower } from '../world/path';
import type { Game } from '../game';
import type { Pen } from '../ranch/buildings';
import type { Facing } from './dog';
import type { PressureSource } from './animal';

// Helper dogs wear a buttercup bandana so the player's red one stays unique.
export type HelperMode = 'flank' | 'stay' | 'home';
export const HELPER_NAMES = ['PIP', 'SKIP'];
export const HELPER_COSTS = [70, 130];

let SPR: DogSprites | null = null;
const tmp = { x: 0, y: 0 };

export class Helper {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  face: Facing = 'd';
  phase = 0;
  lying = false;
  barkAnim = 0;
  barkCd = 0;
  side: 1 | -1;
  guardPen: Pen | null = null;
  private path = new PathFollower();
  r = 3;

  constructor(public name: string, x: number, y: number, public mode: HelperMode = 'flank', index = 0) {
    this.x = x;
    this.y = y;
    this.side = index % 2 === 0 ? 1 : -1;
    SPR ??= makeDogSprites('y');
  }

  source(): PressureSource {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, strength: 0.6, range: 1, kind: 'helper', lying: this.lying };
  }

  private moveTo(game: Game, tx: number, ty: number, dt: number, run: boolean) {
    const d = Math.hypot(tx - this.x, ty - this.y);
    let spd = run || d > 60 ? 74 : 44;
    if (d < 10) spd *= d / 10;
    let dx = 0, dy = 0;
    if (d > 1.5) {
      const wp = this.path.next(game.map, this.x, this.y, tx, ty, BLOCK_DOG, dt);
      dx = wp.x - this.x;
      dy = wp.y - this.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      wallRepulse(game.map, this.x, this.y, this.r + 4, BLOCK_DOG, tmp);
      dx += tmp.x;
      dy += tmp.y;
      const l2 = Math.hypot(dx, dy) || 1;
      dx = (dx / l2) * spd;
      dy = (dy / l2) * spd;
    }
    const k = 1 - Math.exp(-10 * dt);
    this.vx += (dx - this.vx) * k;
    this.vy += (dy - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    collideCircle(game.map, this, this.r, BLOCK_DOG);
  }

  update(game: Game, dt: number, index: number) {
    this.barkCd -= dt;
    this.barkAnim -= dt;
    const dog = game.dog;
    let tx = this.x, ty = this.y, run = false, lie = false;

    if (game.day.phase === 'night') {
      // Guard a pen; chase off anything that comes near it.
      const pen = this.guardPen;
      const home = pen ? pen.gatePoint(10) : game.doorPoint();
      let threat = null as null | (typeof game.predators)[number];
      let best = 1e9;
      for (const p of game.predators) {
        if (!p.active || p.state === 'flee') continue;
        const d = Math.min(Math.hypot(p.x - home.x, p.y - home.y), Math.hypot(p.x - this.x, p.y - this.y));
        if (d < 100 && d < best) { best = d; threat = p; }
      }
      if (threat) {
        tx = threat.x;
        ty = threat.y;
        run = true;
        if (Math.hypot(threat.x - this.x, threat.y - this.y) < 42 && this.barkCd <= 0) {
          threat.scare(threat.kind === 'wolf' ? 0.5 : 0.9);
          this.bark(game);
        }
      } else {
        tx = home.x;
        ty = home.y;
        lie = Math.hypot(tx - this.x, ty - this.y) < 4;
      }
    } else if (game.trials.run) {
      // A trial is one dog's work: wait by the handler's post.
      const p = game.ranch.course.post;
      tx = p.x + (index ? 14 : -14);
      ty = p.y + 12;
      if (Math.hypot(tx - this.x, ty - this.y) > 30) {
        this.x = tx;
        this.y = ty;
      }
      lie = Math.hypot(tx - this.x, ty - this.y) < 4;
    } else if (this.mode === 'stay') {
      lie = true;
    } else if (this.mode === 'home') {
      const p = game.doorPoint();
      tx = p.x + (index ? 14 : -14);
      ty = p.y + 6;
      lie = Math.hypot(tx - this.x, ty - this.y) < 4;
    } else {
      // Hold the far flank of the flock the handler is working.
      const gr = game.nearestGroup(170);
      if (dog.lying && gr) {
        lie = true;
      } else if (gr) {
        let rad = 0;
        for (const a of gr.members) rad = Math.max(rad, Math.hypot(a.x - gr.x, a.y - gr.y));
        const sp = gr.members[0].sp;
        let dx = gr.x - dog.x, dy = gr.y - dog.y;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const reach = rad + sp.flight * 1.0;
        // Which flank: keep ours unless the other is much nearer. Sit a
        // little behind the shoulder so the push helps the drive.
        const back = rad * 0.5 + sp.flight * 0.2;
        const sideOf = (s: number) => ({ x: gr.x - dy * s * reach - dx * back, y: gr.y + dx * s * reach - dy * back });
        const mine = sideOf(this.side), other = sideOf(-this.side);
        if (Math.hypot(other.x - this.x, other.y - this.y) < Math.hypot(mine.x - this.x, mine.y - this.y) * 0.45) this.side = this.side === 1 ? -1 : 1;
        const pt = sideOf(this.side);
        tx = pt.x;
        ty = pt.y;
        // Go round the flock, never through it.
        const rx = this.x - gr.x, ry = this.y - gr.y, rl = Math.hypot(rx, ry) || 1;
        if (rl < reach * 0.8) {
          tx = gr.x + (rx / rl) * reach;
          ty = gr.y + (ry / rl) * reach;
        }
        run = Math.hypot(tx - this.x, ty - this.y) > 40;
      } else {
        // Nothing to work: trot at heel.
        const bx = dog.x - dog.hx * 14 + (index ? 8 : -8) * dog.hy;
        const by = dog.y - dog.hy * 14 - (index ? 8 : -8) * dog.hx;
        if (Math.hypot(bx - this.x, by - this.y) > 10) { tx = bx; ty = by; }
      }
    }

    this.lying = lie;
    if (lie) {
      this.vx *= 0.8;
      this.vy *= 0.8;
    } else this.moveTo(game, tx, ty, dt, run);

    const v = Math.hypot(this.vx, this.vy);
    this.phase += (v * dt) / (v > 50 ? 7 : 4.5);
    if (v > 4) {
      if (Math.abs(this.vx) > Math.abs(this.vy) * 0.9) this.face = this.vx > 0 ? 'r' : 'l';
      else this.face = this.vy > 0 ? 'd' : 'u';
    }
  }

  bark(game: Game) {
    this.barkCd = 1.1;
    this.barkAnim = 0.25;
    game.fx.ring(this.x, this.y - 2, 40, C.butter, 0.28, 6);
    game.audio?.play('bark', { x: this.x, y: this.y, vol: 0.6 });
  }

  drawShadow(g: CanvasRenderingContext2D) {
    ellipse(g, this.x - 1, this.y + 2, this.face === 'l' || this.face === 'r' ? 5 : 3, 1, C.sage);
  }

  draw(g: CanvasRenderingContext2D) {
    const S = SPR!;
    const moving = Math.hypot(this.vx, this.vy) > 6;
    const f = ((Math.floor(this.phase) % 4) + 4) % 4;
    const fast = Math.hypot(this.vx, this.vy) > 50;
    let s: Sprite;
    let flip = false;
    if (this.face === 'l' || this.face === 'r') {
      flip = this.face === 'l';
      s = this.lying ? S.sideLie : this.barkAnim > 0 ? S.sideBark : !moving ? S.sideStand : fast ? S.gallop[f % S.gallop.length] : S.side[f % S.side.length];
    } else if (this.face === 'd') {
      s = this.lying ? S.downLie : this.barkAnim > 0 ? S.downBark : moving ? S.down[f % S.down.length] : S.downStand;
    } else {
      s = this.lying ? S.upLie : moving ? S.up[f % S.up.length] : S.upStand;
    }
    drawSpr(g, s, this.x, this.y + 2 + (moving && f % 2 ? -1 : 0), flip);
  }
}
