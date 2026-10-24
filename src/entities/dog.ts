import { C } from '../palette';
import { ellipse } from '../gfx/draw';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { makeDogSprites, type DogSprites } from '../art/dog';
import type { Input } from '../input';
import { BLOCK_DOG, SHALLOW, type WorldMap } from '../world/map';
import { collideCircle } from '../world/collide';
import type { Particles } from '../systems/particles';
import { damp } from '../util';

export interface DogStats {
  walk: number;
  sprint: number;
  stamina: number;
  barkRange: number;
  nipPower: number;
}

export const BASE_STATS: DogStats = { walk: 46, sprint: 80, stamina: 100, barkRange: 54, nipPower: 1 };

export type Facing = 'r' | 'l' | 'u' | 'd';
export type DogEvent = 'bark' | 'nip';

let SPRITES: DogSprites | null = null;

export class Dog {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hx = 0; // heading unit vector
  hy = 1;
  face: Facing = 'd';
  r = 3;
  stamina = 100;
  exhausted = false;
  private regenDelay = 0;
  sprinting = false;
  lying = false;
  private getUp = 0;
  barkAnim = 0;
  barkCd = 0;
  nipCd = 0;
  nipT = 0;
  private phase = 0;
  private dustT = 0;
  inWater = false;
  events: DogEvent[] = [];
  stats: DogStats = { ...BASE_STATS };

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    SPRITES ??= makeDogSprites('r');
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  update(dt: number, input: Input, map: WorldMap, fx: Particles, controllable = true) {
    this.barkCd -= dt;
    this.nipCd -= dt;
    this.barkAnim -= dt;
    this.nipT -= dt;
    this.getUp -= dt;

    const wantLie = controllable && input.lie;
    if (wantLie && !this.lying) {
      this.lying = true;
      fx.dust(this.x - 3, this.y + 2, -6, 0);
      fx.dust(this.x + 3, this.y + 2, 6, 0);
    } else if (!wantLie && this.lying) {
      this.lying = false;
      this.getUp = 0.12;
    }

    let mx = 0, my = 0;
    if (controllable && !this.lying && this.getUp <= 0) {
      const m = input.move;
      mx = m.x;
      my = m.y;
    }
    const mag = Math.hypot(mx, my);

    // Sprint and stamina.
    const wantSprint = controllable && input.sprint && mag > 0.3 && !this.lying;
    this.sprinting = wantSprint && !this.exhausted && this.stamina > 0;
    if (this.sprinting) {
      this.stamina -= 28 * dt;
      this.regenDelay = 0.7;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
      }
    } else {
      this.regenDelay -= dt;
      if (this.regenDelay <= 0) this.stamina = Math.min(this.stats.stamina, this.stamina + (this.lying ? 40 : 22) * dt);
    }
    if (this.exhausted && this.stamina > this.stats.stamina * 0.35) this.exhausted = false;

    this.inWater = (map.flagsAtPx(this.x, this.y) & SHALLOW) !== 0;
    let spd = this.sprinting ? this.stats.sprint : this.stats.walk;
    if (this.exhausted) spd *= 0.8;
    if (this.inWater) spd *= 0.55;
    let tx = mx * spd, ty = my * spd;
    if (this.nipT > 0) {
      tx = this.hx * 115;
      ty = this.hy * 115;
    }
    const k = damp(mag > 0 || this.nipT > 0 ? 13 : 16, dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    collideCircle(map, this, this.r, BLOCK_DOG);

    // Facing follows input direction, with a little hysteresis between axes.
    const sx = mag > 0.1 ? mx : this.vx, sy = mag > 0.1 ? my : this.vy;
    if (Math.hypot(sx, sy) > 0.05 && this.nipT <= 0) {
      const l = Math.hypot(sx, sy);
      this.hx = sx / l;
      this.hy = sy / l;
      const horiz = this.face === 'l' || this.face === 'r';
      const bias = horiz ? 0.75 : 1.33;
      if (Math.abs(sx) > Math.abs(sy) * bias) this.face = sx > 0 ? 'r' : 'l';
      else if (Math.abs(sy) > 0.01) this.face = sy > 0 ? 'd' : 'u';
    }

    const v = this.speed;
    this.phase += (v * dt) / (this.sprinting ? 7 : 4.5);

    // Dust behind a running dog, splashes in the ford.
    this.dustT -= dt;
    if (v > 20 && this.dustT <= 0) {
      if (this.inWater) {
        fx.splash(this.x, this.y + 2);
        this.dustT = 0.18;
      } else if (this.sprinting || v > this.stats.walk * 1.2) {
        fx.dust(this.x - this.hx * 4, this.y + 2 - this.hy * 2, -this.vx * 0.15, -this.vy * 0.15);
        this.dustT = 0.07;
      }
    }

    if (!controllable) return;
    if (input.pressed('bark') && this.barkCd <= 0) {
      if (this.lying) { this.lying = false; this.getUp = 0.1; }
      this.barkCd = 0.75;
      this.barkAnim = 0.28;
      this.events.push('bark');
      fx.ring(this.x, this.y - 2, this.stats.barkRange, C.wool, 0.32, 6);
      fx.ring(this.x, this.y - 2, this.stats.barkRange * 0.55, C.wool, 0.22);
    }
    if (input.pressed('nip') && this.nipCd <= 0 && !this.lying) {
      this.nipCd = 0.45;
      this.nipT = 0.11;
      this.events.push('nip');
    }
  }

  frameSprite(): { s: Sprite; flip: boolean; bob: number } {
    const S = SPRITES!;
    const moving = this.speed > 6;
    const f = ((Math.floor(this.phase) % 4) + 4) % 4;
    const flip = this.face === 'l';
    const bob = moving && (f === 1 || f === 3) ? -1 : 0;
    if (this.face === 'l' || this.face === 'r') {
      if (this.lying) return { s: S.sideLie, flip, bob: 0 };
      if (this.barkAnim > 0) return { s: S.sideBark, flip, bob: 0 };
      if (!moving) return { s: S.sideStand, flip, bob: 0 };
      return { s: this.sprinting ? S.gallop[f] : S.side[f], flip, bob };
    }
    if (this.face === 'd') {
      if (this.lying) return { s: S.downLie, flip: false, bob: 0 };
      if (this.barkAnim > 0) return { s: S.downBark, flip: false, bob: 0 };
      return { s: moving ? S.down[f] : S.downStand, flip: false, bob };
    }
    if (this.lying) return { s: S.upLie, flip: false, bob: 0 };
    return { s: moving ? S.up[f] : S.upStand, flip: false, bob };
  }

  drawShadow(g: CanvasRenderingContext2D) {
    const side = this.face === 'l' || this.face === 'r';
    ellipse(g, this.x - 1, this.y + 2, side ? 5 : 3, 1, C.sage);
  }

  draw(g: CanvasRenderingContext2D) {
    const { s, flip, bob } = this.frameSprite();
    drawSpr(g, s, this.x, this.y + 2 + bob, flip);
  }
}
