import { C } from '../palette';
import { ellipse } from '../gfx/draw';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { RUN_BOB, SPRINT_BOB, type DogPoses, type DogSprites } from '../art/dog';
import { playerDogSprites } from '../art/dogstyle';
import { fxSprites } from '../art/fx';
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


const SETTLE_STEP = 0.07; // seconds per in-between pose when lying down
const GET_UP = 0.12;
const BARK_TIME = 0.28; // mouth open, then the head dips as it follows through

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
  private lieT = 0;
  private flopped = false;
  private phase = 0;
  private lastStep = 0;
  private dustT = 0;
  private skidded = false;
  inWater = false;
  drag = 0; // 0..1 off the dog's pace (snow)
  events: DogEvent[] = [];
  stats: DogStats = { ...BASE_STATS };
  skin: DogSprites | null = null; // a co-op friend's dog; null = the player's own look
  tag = ''; // a co-op friend's name, shown over their dog

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
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
      this.lieT = 0;
      this.flopped = false;
    } else if (!wantLie && this.lying) {
      this.lying = false;
      this.getUp = GET_UP;
    }
    if (this.lying) {
      this.lieT += dt;
      // A little dust each side as the body meets the ground.
      if (!this.flopped && this.lieT >= this.poses().settle.length * SETTLE_STEP) {
        this.flopped = true;
        if (!this.inWater) {
          fx.dust(this.x - 4, this.y + 2, -10, 0);
          fx.dust(this.x + 4, this.y + 2, 10, 0);
        }
      }
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
    let spd = (this.sprinting ? this.stats.sprint : this.stats.walk) * (1 - this.drag);
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
    const prevFace = this.face;
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
    const step = Math.floor(this.phase);

    // Splashes in the ford. On dry ground the gallop kicks a puff from the
    // hind feet on each landing (odd frames), and a nip lunge trails dust.
    this.dustT -= dt;
    if (this.inWater) {
      if (v > 20 && this.dustT <= 0) {
        fx.splash(this.x, this.y + 2);
        this.dustT = 0.18;
      }
    } else if (this.sprinting) {
      if (step !== this.lastStep && (step & 1) === 1 && v > 20)
        fx.dust(this.x - this.hx * 5, this.y + 2 - this.hy * 2, -this.vx * 0.2, -this.vy * 0.2);
    } else if (v > this.stats.walk * 1.2 && this.dustT <= 0) {
      fx.dust(this.x - this.hx * 4, this.y + 2 - this.hy * 2, -this.vx * 0.15, -this.vy * 0.15);
      this.dustT = 0.07;
    }
    this.lastStep = step;

    // Skids: a big puff when letting go at a gallop, or turning tail at speed.
    if (!this.inWater) {
      const fast = v > this.stats.walk * 1.25;
      const reversed = (prevFace === 'l' && this.face === 'r') || (prevFace === 'r' && this.face === 'l');
      if (mag < 0.1 && this.nipT <= 0) {
        if (fast && !this.skidded) fx.puff(this.x + this.hx * 2, this.y + 2, this.vx * 0.3, this.vy * 0.3);
        this.skidded = true;
      } else {
        this.skidded = false;
        if (reversed && v > 30) fx.puff(this.x, this.y + 2, this.vx * 0.3, 0);
      }
    }

    if (!controllable) return;
    if (input.pressed('bark') && this.barkCd <= 0) {
      if (this.lying) { this.lying = false; this.getUp = 0.1; }
      this.barkCd = 0.75;
      this.barkAnim = BARK_TIME;
      this.events.push('bark');
      fx.ring(this.x, this.y - 2, this.stats.barkRange, C.wool, 0.32, 6);
      fx.ring(this.x, this.y - 2, this.stats.barkRange * 0.55, C.wool, 0.22);
      this.barkLines(fx);
    }
    if (input.pressed('nip') && this.nipCd <= 0 && !this.lying) {
      this.nipCd = 0.45;
      this.nipT = 0.11;
      this.events.push('nip');
    }
  }

  // Sound lines thrown from the mouth, riding along with the dog.
  barkLines(fx: Particles) {
    const B = fxSprites();
    if (this.face === 'r') fx.attached(this, 7, -2, B.barkSide, 0.24);
    else if (this.face === 'l') fx.attached(this, -7, -2, B.barkSide, 0.24, true);
    else if (this.face === 'd') fx.attached(this, 0, 3, B.barkDown, 0.24);
    else fx.attached(this, 0, -9, B.barkUp, 0.24);
  }

  // Co-op: a dog run by someone else's browser. Take its state as sent and
  // keep the poses (settling, getting up, the trot) going here.
  puppet(dt: number, s: { x: number; y: number; vx: number; vy: number; face: Facing; lying: boolean; sprint: boolean }, map: WorldMap, fx: Particles) {
    this.barkAnim -= dt;
    this.nipT -= dt;
    this.getUp -= dt;
    if (s.lying && !this.lying) {
      this.lying = true;
      this.lieT = 0;
      this.flopped = false;
    } else if (!s.lying && this.lying) {
      this.lying = false;
      this.getUp = GET_UP;
    }
    if (this.lying) {
      this.lieT += dt;
      if (!this.flopped && this.lieT >= this.poses().settle.length * SETTLE_STEP) this.flopped = true;
    }
    this.x = s.x;
    this.y = s.y;
    this.vx = s.vx;
    this.vy = s.vy;
    this.face = s.face;
    this.sprinting = s.sprint;
    const v = this.speed;
    if (v > 1) {
      this.hx = this.vx / v;
      this.hy = this.vy / v;
    }
    this.inWater = (map.flagsAtPx(this.x, this.y) & SHALLOW) !== 0;
    this.phase += (v * dt) / (this.sprinting ? 7 : 4.5);
    const step = Math.floor(this.phase);
    this.dustT -= dt;
    if (this.inWater) {
      if (v > 20 && this.dustT <= 0) {
        fx.splash(this.x, this.y + 2);
        this.dustT = 0.18;
      }
    } else if (this.sprinting) {
      if (step !== this.lastStep && (step & 1) === 1 && v > 20) fx.dust(this.x - this.hx * 5, this.y + 2 - this.hy * 2, -this.vx * 0.2, -this.vy * 0.2);
    } else if (v > this.stats.walk * 1.2 && this.dustT <= 0) {
      fx.dust(this.x - this.hx * 4, this.y + 2 - this.hy * 2, -this.vx * 0.15, -this.vy * 0.15);
      this.dustT = 0.07;
    }
    this.lastStep = step;
  }

  // A friend's bark, seen here: mouth open and the lines from it.
  puppetBark(fx: Particles) {
    this.barkAnim = BARK_TIME;
    this.barkLines(fx);
  }

  private poses(): DogPoses {
    const P = (this.skin ?? playerDogSprites()).poses; // dressed in the player's look
    return this.face === 'd' ? P.down : this.face === 'u' ? P.up : P.side;
  }

  frameSprite(): { s: Sprite; flip: boolean; bob: number } {
    const P = this.poses();
    const flip = this.face === 'l';
    const pose = (s: Sprite, bob = 0) => ({ s, flip, bob });
    if (this.lying) {
      // Sink through the settle poses, then breathe; now and then the tail
      // thumps the ground a few times.
      const i = Math.floor(this.lieT / SETTLE_STEP);
      if (i < P.settle.length) return pose(P.settle[i]);
      const t = this.lieT - P.settle.length * SETTLE_STEP;
      const thump = t > 1.5 ? (t - 1.5) % 3.2 : 1;
      if (thump < 0.48 && Math.floor(thump / 0.08) % 2 === 0) return pose(P.lieWag);
      return pose(t % 1.6 > 1.1 ? P.lieBreath : P.lie);
    }
    if (this.barkAnim > 0) return pose(this.barkAnim > 0.1 ? P.bark : P.brace);
    if (this.getUp > 0) {
      // Rise back up through the settle poses.
      const i = Math.min(P.settle.length - 1, Math.floor((this.getUp / GET_UP) * P.settle.length));
      return pose(P.settle[i]);
    }
    if (this.speed <= 6) return pose(P.stand);
    const cyc = this.sprinting ? P.sprint : P.run;
    const f = Math.floor(this.phase) % cyc.length;
    return pose(cyc[f], (this.sprinting ? SPRINT_BOB : RUN_BOB)[f]);
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
