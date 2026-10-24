import { C } from '../palette';
import { disc, ring, rect } from '../gfx/draw';
import { text } from '../gfx/font';

export type PKind = 'dust' | 'ring' | 'float' | 'spark' | 'splash' | 'heart' | 'feather';

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
}

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & { kind: PKind; x: number; y: number }) {
    const max = p.max ?? p.life ?? 0.5;
    this.list.push({ vx: 0, vy: 0, size: 1, color: C.wool, life: max, max, ...p });
  }

  dust(x: number, y: number, vx = 0, vy = 0) {
    this.add({ kind: 'dust', x, y, vx, vy, max: 0.35 + Math.random() * 0.2, size: 1.5 + Math.random(), color: C.wool });
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
      if (p.kind === 'dust') { p.vx *= 0.9; p.vy = p.vy * 0.9 - 4 * dt; }
      if (p.kind === 'float') p.vy *= 0.94;
      if (p.kind === 'splash') p.vy += 90 * dt;
      if (p.kind === 'heart') p.vy = -10;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  // Ground-level effects (under entities).
  drawLow(g: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = 1 - p.life / p.max;
      if (p.kind === 'ring') {
        ring(g, p.x, p.y, p.size * (0.25 + 0.75 * Math.sqrt(t)), p.color, p.dash);
      }
    }
  }

  drawHigh(g: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'dust': {
          const r = Math.round(p.size * k);
          if (r <= 0) rect(g, p.x, p.y, 1, 1, p.color);
          else disc(g, p.x, p.y, r, p.color);
          break;
        }
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
