import { C } from '../palette';
import { ring, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { fxSprites } from '../art/fx';

// 'anim' plays a sprite strip once over its life (puffs, the bark burst).
export type PKind = 'anim' | 'ring' | 'float' | 'spark' | 'splash' | 'heart' | 'feather';

export interface Particle {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
  dash?: number;
  frames?: Sprite[];
  flip?: boolean;
  low?: boolean; // draw on the ground, under entities
  follow?: { x: number; y: number }; // stay pinned to this, at the spawn offset
  ox?: number;
  oy?: number;
}

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & { kind: PKind; x: number; y: number }) {
    const max = p.max ?? p.life ?? 0.5;
    this.list.push({ vx: 0, vy: 0, size: 1, color: C.wool, life: max, max, ...p });
  }

  // Small footfall puff that drifts and rises.
  dust(x: number, y: number, vx = 0, vy = 0) {
    this.add({ kind: 'anim', x, y, vx, vy, max: 0.32 + Math.random() * 0.12, frames: fxSprites().puff, low: true, flip: Math.random() < 0.5 });
  }

  // Big puff for flopping down or skidding to a stop.
  puff(x: number, y: number, vx = 0, vy = 0) {
    this.add({ kind: 'anim', x, y, vx, vy, max: 0.42, frames: fxSprites().bigPuff, low: true, flip: Math.random() < 0.5 });
  }

  // A sprite strip pinned to a moving thing (e.g. the bark burst at the mouth).
  attached(follow: { x: number; y: number }, ox: number, oy: number, frames: Sprite[], max: number, flip = false) {
    this.add({ kind: 'anim', x: follow.x + ox, y: follow.y + oy, follow, ox, oy, frames, max, flip });
  }

  ring(x: number, y: number, radius: number, color: string = C.wool, max = 0.35, dash = 0) {
    this.add({ kind: 'ring', x, y, size: radius, max, color, dash });
  }

  float(x: number, y: number, s: string, color: string = C.butter, max = 1.4) {
    this.add({ kind: 'float', x, y, vy: -14, text: s, color, max });
  }

  splash(x: number, y: number) {
    for (let i = 0; i < 3; i++)
      this.add({ kind: 'splash', x: x + (Math.random() - 0.5) * 4, y, vx: (Math.random() - 0.5) * 20, vy: -18 - Math.random() * 10, max: 0.3, color: C.wool });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'anim') {
        if (p.follow) {
          p.x = p.follow.x + (p.ox ?? 0);
          p.y = p.follow.y + (p.oy ?? 0);
        } else {
          p.vx *= 0.9;
          p.vy = p.vy * 0.9 - 4 * dt;
        }
      }
      if (p.kind === 'float') p.vy *= 0.94;
      if (p.kind === 'splash') p.vy += 90 * dt;
      if (p.kind === 'heart') p.vy = -10;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  private drawAnim(g: CanvasRenderingContext2D, p: Particle) {
    const fr = p.frames!;
    const i = Math.min(fr.length - 1, Math.floor((1 - p.life / p.max) * fr.length));
    drawSpr(g, fr[i], p.x, p.y, p.flip);
  }

  // Ground-level effects (under entities).
  drawLow(g: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = 1 - p.life / p.max;
      if (p.kind === 'ring') {
        ring(g, p.x, p.y, p.size * (0.25 + 0.75 * Math.sqrt(t)), p.color, p.dash);
      } else if (p.kind === 'anim' && p.low) {
        this.drawAnim(g, p);
      }
    }
  }

  drawHigh(g: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'anim':
          if (!p.low) this.drawAnim(g, p);
          break;
        case 'splash':
        case 'spark':
        case 'feather':
          rect(g, p.x, p.y, 1, 1, p.color);
          break;
        case 'float':
          if (k > 0.15 || Math.floor(p.life * 20) % 2 === 0)
            text(g, p.text ?? '', p.x, p.y, p.color, { align: 'center', shadow: C.plum });
          break;
        case 'heart':
          text(g, '@', p.x, p.y, p.color, { align: 'center' });
          break;
      }
    }
  }
}
