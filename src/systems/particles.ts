import { C } from '../palette';
import { BAYER4, rect } from '../gfx/draw';
import { quality } from '../gfx/quality';
import { text } from '../gfx/font';
import { drawSpr, tint, type Sprite } from '../gfx/sprite';

const shadows = new Map<Sprite, Sprite>();
const shadowOf = (s: Sprite) => {
  let t = shadows.get(s);
  if (!t) shadows.set(s, (t = tint(s, C.plum)));
  return t;
};
import { fxSprites } from '../art/fx';

// 'anim' plays a sprite strip once over its life (puffs, the bark burst).
export type PKind = 'anim' | 'ring' | 'float' | 'spark' | 'splash' | 'heart' | 'feather' | 'ripple' | 'clod';

// What the ground is like underfoot: what a footfall throws up.
export type Ground = 'dry' | 'wet' | 'snow';

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
  rise?: number; // anims that float steadily upwards (emotes), px/s
}

export class Particles {
  list: Particle[] = [];
  tap: ((p: Particle) => void) | null = null; // co-op host: pass effects to the guests
  ground: Ground = 'dry'; // set each frame from the weather and the season

  add(p: Partial<Particle> & { kind: PKind; x: number; y: number }) {
    const max = p.max ?? p.life ?? 0.5;
    const q: Particle = { vx: 0, vy: 0, size: 1, color: C.wool, life: max, max, ...p };
    this.list.push(q);
    this.tap?.(q);
  }

  // Small footfall puff that drifts and rises: dust on dry ground, a splat
  // of mud and a clod or two when it is wet, a spray of snow in winter.
  dust(x: number, y: number, vx = 0, vy = 0) {
    const F = fxSprites();
    const frames = this.ground === 'wet' ? F.mud : this.ground === 'snow' ? F.snow : F.puff;
    this.add({ kind: 'anim', x, y, vx, vy, max: 0.32 + Math.random() * 0.12, frames, low: true, flip: Math.random() < 0.5 });
    if (this.ground !== 'dry' && Math.random() < quality.fx * 0.7) {
      const col = this.ground === 'wet' ? (Math.random() < 0.5 ? C.plum : C.sage) : C.wool;
      this.add({ kind: 'clod', x, y: y - 1, vx: vx * 0.6 + (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 14, max: 0.4, color: col });
    }
  }

  // The flash where a nip lands, with sparks flying off it.
  impact(x: number, y: number, hit: boolean) {
    this.add({ kind: 'anim', x, y, max: 0.16, frames: fxSprites().impact });
    const n = Math.max(2, Math.round(5 * quality.fx));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 40;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, max: 0.16 + Math.random() * 0.1, color: hit ? C.butter : C.wool });
    }
  }

  // A note, heart or stress lines rising over an animal (local: not sent to
  // friends, whose game makes its own).
  emote(x: number, y: number, kind: 'note' | 'heart' | 'stress') {
    const F = fxSprites();
    this.list.push({ kind: 'anim', x, y, vx: (Math.random() - 0.5) * 4, vy: 0, life: 1.1, max: 1.1, size: 1, color: C.wool, frames: F[kind], rise: kind === 'stress' ? 4 : 9 });
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
    // A ripple spreading on the water round it.
    if (Math.random() < quality.fx) this.add({ kind: 'ripple', x, y: y + 1, size: 5, max: 0.45, color: C.wool });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'anim' && p.rise) {
        p.vy = -p.rise;
        p.vx *= 0.96;
      } else if (p.kind === 'anim') {
        if (p.follow) {
          p.x = p.follow.x + (p.ox ?? 0);
          p.y = p.follow.y + (p.oy ?? 0);
        } else {
          p.vx *= 0.9;
          p.vy = p.vy * 0.9 - 4 * dt;
        }
      }
      if (p.kind === 'float') p.vy *= 0.94;
      if (p.kind === 'splash' || p.kind === 'clod') p.vy += 90 * dt;
      if (p.kind === 'heart') p.vy = -10;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  private drawAnim(g: CanvasRenderingContext2D, p: Particle) {
    const fr = p.frames!;
    const i = Math.min(fr.length - 1, Math.floor((1 - p.life / p.max) * fr.length));
    // Emotes get a plum shadow so they read over wool, snow or sky.
    if (p.rise) drawSpr(g, shadowOf(fr[i]), p.x + 1, p.y + 1, p.flip);
    drawSpr(g, fr[i], p.x, p.y, p.flip);
  }

  // Ground-level effects (under entities).
  drawLow(g: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = 1 - p.life / p.max;
      if (p.kind === 'ring') {
        shockwave(g, p.x, p.y, p.size * (0.25 + 0.75 * Math.sqrt(t)), t, p.color, p.dash);
      } else if (p.kind === 'ripple') {
        // An ellipse widening on the water, thinning as it goes.
        const r = p.size * (0.4 + t);
        ellipseRing(g, p.x, p.y, r, r * 0.45, t < 0.5 ? p.color : C.sage, t);
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
        case 'feather':
        case 'clod':
          rect(g, p.x, p.y, 1, 1, p.color);
          break;
        case 'spark': {
          // A streak back along its path, the tail cooling to moss.
          rect(g, p.x, p.y, 1, 1, p.color);
          const tx = Math.round(p.x - p.vx * 0.025), ty = Math.round(p.y - p.vy * 0.025);
          if (tx !== Math.round(p.x) || ty !== Math.round(p.y)) rect(g, tx, ty, 1, 1, k > 0.5 ? p.color : C.moss);
          break;
        }
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

// The bark's ring as a shockwave: a band two pixels deep whose pixels thin
// out by an ordered dither as it spreads, solid at first, gone at the end.
// `dash` keeps the old dashed look (gates, finds) on top of the thinning.
function shockwave(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, color: string, dash = 0) {
  cx = Math.round(cx); cy = Math.round(cy);
  const level = 16 * Math.pow(1 - t, 0.8);
  const bands = quality.fx >= 0.6 ? 2 : 1;
  for (let b = 0; b < bands; b++) {
    const rr = Math.round(r) - b;
    if (rr <= 0) continue;
    const lv = b ? level * 0.45 : level;
    g.fillStyle = b ? C.sage : color;
    let x = rr, y = 0, err = 1 - rr, i = 0;
    while (x >= y) {
      const on = !dash || i++ % dash < dash / 2;
      if (on)
        for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
          const sx = cx + px, sy = cy + py;
          if (BAYER4[((sy & 3) << 2) | (sx & 3)] < lv) g.fillRect(sx, sy, 1, 1);
        }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }
}

// An ellipse outline, thinned by `t` the same way.
function ellipseRing(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, t: number) {
  cx = Math.round(cx); cy = Math.round(cy);
  const n = Math.max(8, Math.round(rx * 5));
  const level = 16 * (1 - t);
  g.fillStyle = color;
  let last = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    const k = `${x},${y}`;
    if (k === last) continue;
    last = k;
    if (BAYER4[((y & 3) << 2) | (x & 3)] < level) g.fillRect(x, y, 1, 1);
  }
}
