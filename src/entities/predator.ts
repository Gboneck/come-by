import { C } from '../palette';
import { ellipse, px } from '../gfx/draw';
import { drawSpr } from '../gfx/sprite';
import { predatorSprites } from '../art/predators';
import { BLOCK_ANIMAL, CS, SOLID, type WorldMap } from '../world/map';
import { collideCircle, wallRepulse } from '../world/collide';
import { PathFollower } from '../world/path';
import type { Animal } from './animal';
import type { Pen } from '../ranch/buildings';
import type { Facing } from './dog';
import type { Particles } from '../systems/particles';

export type PredKind = 'coyote' | 'wolf';
type PState = 'wait' | 'hunt' | 'dig' | 'carry' | 'flee' | 'gone';

export interface PredCtx {
  map: WorldMap;
  dogX: number;
  dogY: number;
  dogLying: boolean;
  animals: Animal[];
  pens: Pen[];
  sheltered: (p: Pen) => boolean;
  fx: Particles;
  claimed: Map<object, Predator>; // targets taken by a predator
  onLoss: (a: Animal, p: Predator) => void;
  onGrab: (a: Animal, p: Predator) => void;
}

const tmp = { x: 0, y: 0 };

export class Predator {
  x = -1000;
  y = -1000;
  vx = 0;
  vy = 0;
  face: Facing = 'l';
  phase = 0;
  state: PState = 'wait';
  target: Animal | null = null;
  pen: Pen | null = null;
  carry: Animal | null = null;
  digT = 0;
  fear = 0;
  returns: number;
  exitX = 0;
  exitY = 0;
  private retargetT = 0;
  private path = new PathFollower();
  yelp = 0;
  bold = 1; // a storm makes them braver: harder to scare, quicker to dig

  constructor(public kind: PredKind, public waitT: number) {
    this.returns = kind === 'wolf' ? 1 : 0;
  }

  get r() { return this.kind === 'wolf' ? 4.5 : 3.5; }
  get huntSpeed() { return this.kind === 'wolf' ? 40 : 34; }
  get runSpeed() { return this.kind === 'wolf' ? 72 : 66; }
  get pounceSpeed() { return this.kind === 'wolf' ? 86 : 80; }
  get carrySpeed() { return this.kind === 'wolf' ? 32 : 27; }
  get digTime() { return this.kind === 'wolf' ? 6 : 8; }
  get active() { return this.state !== 'wait' && this.state !== 'gone'; }

  scare(amount: number) {
    if (!this.active || this.state === 'flee') return;
    this.fear += amount / this.bold;
    this.yelp = 0.4;
  }

  private chooseTarget(ctx: PredCtx) {
    this.target = null;
    this.pen = null;
    let best = 1e9;
    for (const a of ctx.animals) {
      if (a.pen || a.gone || a.carried) continue;
      const ca = ctx.claimed.get(a);
      if (ca && ca !== this) continue;
      const d = Math.hypot(a.x - this.x, a.y - this.y) * (a.stray ? 0.5 : 1);
      if (d < best) { best = d; this.target = a; this.pen = null; }
    }
    for (const p of ctx.pens) {
      const cp = ctx.claimed.get(p);
      if (!p.animals.length || ctx.sheltered(p) || (cp && cp !== this)) continue;
      const d = Math.hypot(p.cx - this.x, p.cy - this.y) * 0.8;
      if (d < best) { best = d; this.pen = p; this.target = null; }
    }
  }

  // Enter from the forest edge somewhere near the chosen target.
  private enter(ctx: PredCtx) {
    // Head for something at random, preferring whatever the dog is not near.
    const all: { x: number; y: number }[] = [];
    for (const a of ctx.animals) if (!a.pen && !a.gone && !a.carried) all.push(a);
    for (const p of ctx.pens) if (p.animals.length && !ctx.sheltered(p)) all.push({ x: p.cx, y: p.cy });
    if (!all.length) { this.state = 'gone'; return; }
    const pick = all[Math.floor(Math.random() * all.length)];
    this.x = pick.x;
    this.y = pick.y;
    this.chooseTarget(ctx);
    const tx = this.pen ? this.pen.cx : this.target?.x ?? pick.x;
    const ty = this.pen ? this.pen.cy : this.target?.y ?? pick.y;
    // Find a walkable spot by the trees, away from the dog.
    let found = false;
    for (let i = 0; i < 80 && !found; i++) {
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 70;
      const x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r;
      if (ctx.map.blockedPx(x, y, BLOCK_ANIMAL)) continue;
      if (Math.hypot(x - ctx.dogX, y - ctx.dogY) < 110) continue;
      // Near a tree line.
      let edge = false;
      for (let k = 0; k < 8 && !edge; k++) {
        const ex = x + Math.cos((k * Math.PI) / 4) * 14, ey = y + Math.sin((k * Math.PI) / 4) * 14;
        if (ctx.map.flagsAtPx(ex, ey) & SOLID) edge = true;
      }
      if (!edge && i < 60) continue;
      this.x = x;
      this.y = y;
      found = true;
    }
    if (!found) { this.state = 'gone'; return; }
    this.exitX = this.x;
    this.exitY = this.y;
    this.state = 'hunt';
  }

  private steer(ctx: PredCtx, tx: number, ty: number, speed: number, dt: number, avoidDog: boolean) {
    const d = Math.hypot(tx - this.x, ty - this.y);
    const wp = this.path.next(ctx.map, this.x, this.y, tx, ty, BLOCK_ANIMAL, dt);
    let dx = wp.x - this.x, dy = wp.y - this.y;
    const l0 = Math.hypot(dx, dy) || 1;
    dx /= l0;
    dy /= l0;
    // Sneak round the dog rather than through it.
    const ddx = this.x - ctx.dogX, ddy = this.y - ctx.dogY, dd = Math.hypot(ddx, ddy);
    if (avoidDog && dd < 46 && !ctx.dogLying) {
      const w = (1 - dd / 46) * 2;
      dx += (ddx / dd) * w;
      dy += (ddy / dd) * w;
    }
    wallRepulse(ctx.map, this.x, this.y, this.r + 5, BLOCK_ANIMAL, tmp);
    dx += tmp.x * 1.5;
    dy += tmp.y * 1.5;
    const l = Math.hypot(dx, dy) || 1;
    const k = 1 - Math.exp(-10 * dt);
    this.vx += ((dx / l) * speed - this.vx) * k;
    this.vy += ((dy / l) * speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    collideCircle(ctx.map, this, this.r, BLOCK_ANIMAL);
    return d;
  }

  private flee() {
    this.state = 'flee';
  }

  dropCarry(): Animal | null {
    const a = this.carry;
    if (!a) return null;
    a.carried = false;
    a.stress = 0.95;
    a.fleeT = 1;
    this.carry = null;
    return a;
  }

  update(dt: number, ctx: PredCtx) {
    this.yelp = Math.max(0, this.yelp - dt);
    if (this.state === 'gone') return;
    if (this.state === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) this.enter(ctx);
      return;
    }
    // The dog close by is frightening; a lying dog much less so.
    const dDog = Math.hypot(this.x - ctx.dogX, this.y - ctx.dogY);
    if (dDog < 34 && this.state !== 'flee') this.fear += (dt * (ctx.dogLying ? 0.3 : 1) * (this.kind === 'wolf' ? 0.7 : 1.4) * (1.3 - dDog / 34)) / this.bold;
    this.fear = Math.max(0, this.fear - dt * 0.1);
    if (this.fear >= 1 && this.state !== 'flee') {
      if (this.carry) this.dropCarry();
      this.flee();
    }

    switch (this.state) {
      case 'hunt': {
        const lostTarget = (this.target && (this.target.pen || this.target.gone || this.target.carried)) || (this.pen && (!this.pen.animals.length || ctx.sheltered(this.pen)));
        // Commit to a quarry; only look again if it got away or now and then.
        if (lostTarget || (this.retargetT -= dt) <= 0 || (!this.target && !this.pen)) {
          this.retargetT = 6;
          this.chooseTarget(ctx);
          if (!this.target && !this.pen) { this.flee(); break; }
        }
        if (this.target) {
          const a = this.target;
          // Sneak in, then rush the last stretch.
          const close = Math.hypot(a.x - this.x, a.y - this.y) < 50;
          const d = this.steer(ctx, a.x, a.y, close ? this.pounceSpeed : this.huntSpeed, dt, !close);
          if (d < this.r + a.sp.r + 2) {
            a.carried = true;
            this.carry = a;
            this.state = 'carry';
            ctx.onGrab(a, this);
          }
        } else if (this.pen) {
          const p = this.pen;
          // Dig in at the fence side nearest to us, just outside it.
          const cx = Math.max(p.x0 - 5, Math.min(p.x1 + 5, this.x));
          const cy = Math.max(p.y0 - 5, Math.min(p.y1 + 5, this.y));
          let gx = cx, gy = cy;
          if (this.x > p.x0 && this.x < p.x1 && this.y > p.y0 && this.y < p.y1) { gx = p.x0 - 5; gy = p.cy; }
          const d = this.steer(ctx, gx, gy, this.huntSpeed, dt, true);
          if (d < 5) { this.state = 'dig'; this.digT = 0; }
        }
        break;
      }
      case 'dig': {
        const p = this.pen;
        this.vx *= 0.8;
        this.vy *= 0.8;
        if (!p || !p.animals.length || ctx.sheltered(p)) { this.state = 'hunt'; this.retargetT = 0; break; }
        this.digT += dt;
        this.face = p.cx > this.x ? 'r' : 'l';
        if (Math.random() < dt * 8) ctx.fx.add({ kind: 'spark', x: this.x + (this.face === 'r' ? 4 : -4), y: this.y + 1, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, max: 0.35, color: C.moss });
        const need = (this.digTime * (p.level >= 2 ? 2 : 1)) / this.bold;
        if (this.digT >= need) {
          const a = p.animals[Math.floor(Math.random() * p.animals.length)];
          p.animals = p.animals.filter((x) => x !== a);
          a.pen = null;
          a.home = true; // taken from your pen: your loss
          a.carried = true;
          a.x = this.x;
          a.y = this.y;
          this.carry = a;
          this.state = 'carry';
          ctx.onGrab(a, this);
        }
        break;
      }
      case 'carry': {
        const d = this.steer(ctx, this.exitX, this.exitY, this.carrySpeed, dt, true);
        if (this.carry) {
          const hx = this.face === 'l' ? -1 : this.face === 'r' ? 1 : 0;
          this.carry.x = this.x + hx * 6;
          this.carry.y = this.y + 1;
          this.carry.vx = this.vx;
          this.carry.vy = this.vy;
        }
        if (d < 6) {
          if (this.carry) {
            this.carry.gone = true;
            this.carry.carried = false;
            ctx.onLoss(this.carry, this);
            this.carry = null;
          }
          this.state = 'gone';
        }
        break;
      }
      case 'flee': {
        const d = this.steer(ctx, this.exitX, this.exitY, this.runSpeed, dt, false);
        if (d < 8) {
          if (this.returns > 0) {
            this.returns--;
            this.state = 'wait';
            this.waitT = 10 + Math.random() * 6;
            this.fear = 0;
          } else this.state = 'gone';
        }
        break;
      }
    }
    const v = Math.hypot(this.vx, this.vy);
    this.phase += (v * dt) / 5;
    if (v > 3) {
      if (Math.abs(this.vx) > Math.abs(this.vy) * 0.8) this.face = this.vx > 0 ? 'r' : 'l';
      else this.face = this.vy > 0 ? 'd' : 'u';
    }
    void CS;
  }

  drawShadow(g: CanvasRenderingContext2D) {
    if (!this.active) return;
    ellipse(g, this.x - 1, this.y + 1, this.kind === 'wolf' ? 7 : 6, 1, C.sage);
  }

  draw(g: CanvasRenderingContext2D) {
    if (!this.active) return;
    const S = predatorSprites(this.kind);
    const moving = Math.hypot(this.vx, this.vy) > 3;
    const digging = this.state === 'dig';
    const f = Math.floor(this.phase);
    const y = this.y + 1 + (digging && Math.floor(this.digT * 8) % 2 === 0 ? 1 : 0);
    if (this.face === 'l' || this.face === 'r') {
      const fr = moving ? S.side[((f % S.side.length) + S.side.length) % S.side.length] : S.side[1];
      drawSpr(g, fr, this.x, y, this.face === 'l');
    } else {
      const arr = this.face === 'd' ? S.down : S.up;
      drawSpr(g, arr[moving ? ((f % 2) + 2) % 2 : 0], this.x, y);
    }
  }

  // Eyes shine above the dark.
  drawEyes(g: CanvasRenderingContext2D, t: number) {
    if (!this.active || this.face === 'u') return;
    if (Math.floor(t * 1.7 + this.exitX) % 9 === 0) return; // blink
    const S = predatorSprites(this.kind);
    const [ex, ey] = S.eyeSide;
    if (this.face === 'r') { px(g, this.x + ex, this.y + 1 + ey, C.butter); px(g, this.x + ex - 2, this.y + 1 + ey, C.butter); }
    else if (this.face === 'l') { px(g, this.x - ex, this.y + 1 + ey, C.butter); px(g, this.x - ex + 2, this.y + 1 + ey, C.butter); }
    else {
      const w = this.kind === 'wolf' ? 2 : 2;
      px(g, this.x - w, this.y + 1 - (this.kind === 'wolf' ? 6 : 5), C.butter);
      px(g, this.x + w, this.y + 1 - (this.kind === 'wolf' ? 6 : 5), C.butter);
    }
  }
}
