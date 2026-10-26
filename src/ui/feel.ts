import { C } from '../palette';
import { BAYER4, ditherPattern } from '../gfx/draw';
import { text } from '../gfx/font';
import { PX, fine } from '../gfx/screen';
import { settings } from './settings';
import { quality } from '../gfx/quality';

// Game feel that lives outside the simulation: camera kicks and shake (in
// whole pixels), hit-pause, the coin counter that ticks up as coins fly in,
// tier-up confetti and the dithered plum fade between screens.

interface FlyCoin { x0: number; y0: number; t: number; max: number; value: number; arc: number }
interface Bit { x: number; y: number; vx: number; vy: number; c: string; ph: number }
interface Rocket { x: number; y: number; vy: number; fuse: number; wait: number; c: string }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; max: number; c: string; g: number; big?: number }

export interface TierCard { n: number; name: string; blurb: string; brings: string[]; t: number; max: number }

type Fade = { phase: 'out' | 'in'; act: (() => void) | null; outRate: number; inRate: number };

// Plum dither over the whole screen: 0 = clear, 16 = solid, its dots fine
// pixels. Pass the view offset to anchor it to the world like the night's
// dither, so a dimmed night stays at the night's own level instead of
// filling in solid.
export function drawCover(g: CanvasRenderingContext2D, W: number, H: number, level: number, ox = 0, oy = 0) {
  const l = Math.max(0, Math.min(16, Math.round(level)));
  if (l <= 0) return;
  if (l >= 16) {
    g.fillStyle = C.plum;
    g.fillRect(0, 0, W, H);
    return;
  }
  const p = ditherPattern(l, C.plum);
  if (!p) return;
  const sx = (Math.round(ox) * PX) & 3, sy = (Math.round(oy) * PX) & 3;
  fine(g, (fg) => {
    fg.translate(-sx, -sy);
    fg.fillStyle = p;
    fg.fillRect(0, 0, W * PX + sx, H * PX + sy);
  });
}

// The iris: the screen closes to a circle on (cx, cy) as `level` goes from
// 0 to 16, with a dithered rim a few pixels deep; outside it, solid plum.
export function drawIris(g: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number, level: number) {
  cx = Math.round(cx); cy = Math.round(cy);
  const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 8;
  const r = far * (1 - level / 16);
  const rim = 6;
  g.fillStyle = C.plum;
  for (let y = 0; y < H; y++) {
    const dy = y - cy;
    const outer = r + rim;
    if (Math.abs(dy) >= outer) {
      g.fillRect(0, y, W, 1);
      continue;
    }
    const a = Math.sqrt(Math.max(0, r * r - dy * dy));
    const b = Math.sqrt(outer * outer - dy * dy);
    // Solid beyond the rim on both sides.
    const l = Math.max(0, Math.floor(cx - b)), rr = Math.min(W, Math.ceil(cx + b));
    if (l > 0) g.fillRect(0, y, l, 1);
    if (rr < W) g.fillRect(rr, y, W - rr, 1);
    // The rim: dithered, denser towards the outside.
    for (const [x0, x1] of [[Math.max(0, Math.floor(cx - b)), Math.min(W, Math.ceil(cx - a))], [Math.max(0, Math.floor(cx + a)), Math.min(W, Math.ceil(cx + b))]]) {
      for (let x = x0; x < x1; x++) {
        const d = Math.hypot(x - cx, dy) - r;
        if (d <= 0) continue;
        if (BAYER4[((y & 3) << 2) | (x & 3)] < (d / rim) * 16) g.fillRect(x, y, 1, 1);
      }
    }
  }
}

// The dim behind a menu or card.
export function dimView(g: CanvasRenderingContext2D, view: { ox: number; oy: number; W: number; H: number }, level = 8) {
  drawCover(g, view.W, view.H, level, view.ox, view.oy);
}

export class Feel {
  private kx = 0;
  private ky = 0;
  private kt = 0;
  private kmax = 1;
  private shakeT = 0;
  private shakeAmp = 0;
  private sx = 0;
  private sy = 0;
  private shakeTick = 0;
  hitstop = 0;
  // A big moment is playing (the gate shutting); the tier-up waits for it.
  moment = 0;

  // Coin counter: what the HUD shows, and coins still flying to the purse.
  shown = -1;
  pending = 0;
  bump = 0;
  purse = { x: 0, y: 0 };
  private flying: FlyCoin[] = [];

  private bits: Bit[] = [];
  private rockets: Rocket[] = [];
  private sparks: Spark[] = [];
  tierCard: TierCard | null = null;
  // Where a screen change closes its iris (screen pixels), asked each frame
  // so it can follow the dog to its new spot as the next scene opens.
  iris: (() => { x: number; y: number }) | null = null;

  // Starts covered, so every new game (and the title) dissolves in.
  cover = 16;
  private fade: Fade | null = { phase: 'in', act: null, outRate: 0, inRate: 16 / 0.5 };

  // ---- Camera ----

  kick(dx: number, dy: number, dur = 0.1) {
    this.kx = dx;
    this.ky = dy;
    this.kt = this.kmax = dur;
  }

  shake(amp: number, dur: number) {
    this.shakeAmp = Math.max(this.shakeAmp * (this.shakeT > 0 ? 1 : 0), amp);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  // Whole-pixel camera offset for this frame.
  offset(): { x: number; y: number } {
    if (!settings.shake) return { x: 0, y: 0 };
    const f = this.kt > 0 ? this.kt / this.kmax : 0;
    return { x: Math.round(this.kx * f) + this.sx, y: Math.round(this.ky * f) + this.sy };
  }

  // ---- Coins ----

  // A coin flies from a screen point to the purse; the counter waits for it.
  flyCoins(sx: number, sy: number, value: number, pieces = 1, delay = 0) {
    const n = Math.max(1, Math.min(pieces, value, 6));
    let left = value;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(value / n);
      left -= v;
      this.pending += v;
      this.flying.push({ x0: sx + (Math.random() - 0.5) * 6, y0: sy, t: -delay - i * 0.07, max: 0.55 + Math.random() * 0.1, value: v, arc: 14 + Math.random() * 10 });
    }
  }

  snapCoins() {
    this.shown = -1;
    this.pending = 0;
    this.flying.length = 0;
  }

  coinsShown(real: number): number {
    if (this.shown < 0) this.shown = real - this.pending;
    return Math.round(this.shown);
  }

  // ---- Celebrations ----

  // A tier-up: fireworks over the valley, and paper scraps on the breeze.
  confetti(W: number, n = 40, H = 240) {
    const cols = [C.butter, C.wool, C.butter, C.teal, C.moss];
    const k = Math.max(0.35, quality.fx);
    for (let i = 0; i < Math.round(n * k); i++)
      this.bits.push({ x: Math.random() * W, y: -Math.random() * 60 - 2, vx: (Math.random() - 0.5) * 20, vy: 22 + Math.random() * 30, c: cols[i % cols.length], ph: Math.random() * 6 });
    this.fireworks(W, H, Math.max(2, Math.round(6 * k)));
  }

  // Rockets that climb from the bottom of the screen, staggered, and burst.
  fireworks(W: number, H: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const x = W * (0.15 + 0.7 * ((i * 0.61803) % 1));
      this.rockets.push({ x, y: H + 2, vy: -(H * 0.9 + Math.random() * H * 0.3), fuse: 0.55 + Math.random() * 0.35, wait: i * 0.28, c: [C.butter, C.wool, C.teal, C.moss][i % 4] });
    }
  }

  // A puff of dust either side of a stamp as it lands.
  stampDust(cx: number, cy: number, w: number, h: number) {
    const n = Math.round(14 * Math.max(0.4, quality.fx));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const y = cy + (Math.random() - 0.5) * h;
      this.sparks.push({ x: cx + (side * w) / 2, y, vx: side * (20 + Math.random() * 40), vy: (Math.random() - 0.5) * 20, t: 0, max: 0.3 + Math.random() * 0.2, c: Math.random() < 0.5 ? C.wool : C.sage, g: 0 });
    }
  }

  // ---- Transitions ----

  get fading() {
    return this.fade !== null && this.fade.phase === 'out';
  }

  // Cover the screen, run `act` (switch screens), then uncover.
  // With `at` (screen pixels), the screen closes as an iris on that point
  // and opens out from it again.
  fadeTo(act: () => void, outDur = 0.22, inDur = 0.32, at: (() => { x: number; y: number }) | null = null) {
    if (this.fade?.phase === 'out') return false;
    this.fade = { phase: 'out', act, outRate: 16 / outDur, inRate: 16 / inDur };
    this.iris = at;
    return true;
  }

  update(dt: number, real: number, H: number) {
    this.kt -= dt;
    this.moment -= dt;
    this.bump -= dt;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.shakeTick -= dt;
      if (this.shakeTick <= 0) {
        this.shakeTick = 1 / 30;
        const a = this.shakeT > 0 ? this.shakeAmp : 0;
        this.sx = Math.round((Math.random() * 2 - 1) * a);
        this.sy = Math.round((Math.random() * 2 - 1) * a);
      }
    } else this.sx = this.sy = 0;

    // Flying coins land in the purse.
    for (const c of this.flying) {
      c.t += dt;
      if (c.t >= c.max) {
        this.pending -= c.value;
        this.bump = 0.14;
      }
    }
    this.flying = this.flying.filter((c) => c.t < c.max);
    if (this.pending < 0) this.pending = 0;

    // The counter ticks towards what has landed.
    const target = real - this.pending;
    if (this.shown < 0) this.shown = target;
    if (this.shown < target) this.shown = Math.min(target, this.shown + Math.max(10, (target - this.shown) * 5) * dt);
    else if (this.shown > target) this.shown = Math.max(target, this.shown - Math.max(30, (this.shown - target) * 8) * dt);

    for (const b of this.bits) {
      b.ph += dt * 7;
      b.x += (b.vx + Math.sin(b.ph) * 14) * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter((b) => b.y < H + 2);

    // Rockets climb, slowing, then burst into a ring of falling sparks.
    for (const r of this.rockets) {
      if ((r.wait -= dt) > 0) continue;
      r.fuse -= dt;
      r.y += r.vy * dt;
      r.vy *= Math.pow(0.18, dt);
      if (r.fuse <= 0) {
        // Two rings, an outer one in the rocket's colour and a quicker
        // inner one in wool, then a flash at the heart of the burst.
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62, t: 0, max: 1 + Math.random() * 0.35, c: r.c, g: 36 });
          if (i % 2 === 0) this.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a + 0.13) * 34, vy: Math.sin(a + 0.13) * 34, t: 0, max: 0.8 + Math.random() * 0.3, c: C.wool, g: 30 });
        }
        this.sparks.push({ x: r.x, y: r.y, vx: 0, vy: 0, t: 0, max: 0.12, c: C.wool, g: 0, big: 3 });
      }
    }
    this.rockets = this.rockets.filter((r) => r.fuse > 0);
    for (const s of this.sparks) {
      s.t += dt;
      s.vx *= Math.pow(0.35, dt);
      s.vy = s.vy * Math.pow(0.35, dt) + s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.max);

    if (this.tierCard && (this.tierCard.t -= dt) <= 0) this.tierCard = null;

    const f = this.fade;
    if (f) {
      if (f.phase === 'out') {
        this.cover = Math.min(16, this.cover + f.outRate * dt);
        if (this.cover >= 16) {
          f.phase = 'in';
          const act = f.act;
          f.act = null;
          act?.();
        }
      } else {
        this.cover = Math.max(0, this.cover - f.inRate * dt);
        if (this.cover <= 0) this.fade = null;
      }
    }
  }

  // Screen-space effects above the UI (confetti, fireworks, coins in flight).
  drawTop(g: CanvasRenderingContext2D) {
    for (const b of this.bits) {
      g.fillStyle = b.c;
      // Flutter: the scrap is edge-on (1px) half the time.
      g.fillRect(Math.round(b.x), Math.round(b.y), Math.cos(b.ph) > 0 ? 2 : 1, 1);
    }
    for (const r of this.rockets) {
      if (r.wait > 0) continue;
      // The rocket and a short trail of sparks behind it.
      g.fillStyle = C.wool;
      g.fillRect(Math.round(r.x), Math.round(r.y), 1, 2);
      g.fillStyle = r.c;
      g.fillRect(Math.round(r.x), Math.round(r.y + 3 + (Math.floor(r.fuse * 30) % 2)), 1, 1);
    }
    for (const s of this.sparks) {
      const k = s.t / s.max;
      // Twinkle as they die: more and more of the frames skipped.
      if (k > 0.55 && Math.floor(s.t * 24 + s.x) % (k > 0.8 ? 3 : 2) === 0) continue;
      g.fillStyle = s.c;
      const sz = s.big ?? (k < 0.3 ? 2 : 1);
      g.fillRect(Math.round(s.x - (sz >> 1)), Math.round(s.y - (sz >> 1)), sz, sz);
      if (k < 0.45 && s.g) {
        // A short trail back towards the burst.
        g.fillStyle = k < 0.2 ? C.wool : s.c;
        g.fillRect(Math.round(s.x - s.vx * 0.04), Math.round(s.y - s.vy * 0.04), 1, 1);
        g.fillRect(Math.round(s.x - s.vx * 0.08), Math.round(s.y - s.vy * 0.08), 1, 1);
      }
    }
    for (const c of this.flying) {
      if (c.t < 0) continue;
      const pos = (k: number) => {
        const e = k * k * (3 - 2 * k);
        return [c.x0 + (this.purse.x - c.x0) * e, c.y0 + (this.purse.y - c.y0) * e - Math.sin(k * Math.PI) * c.arc] as const;
      };
      const k = c.t / c.max;
      // A trail that glints behind the coin.
      for (let i = 1; i <= 3; i++) {
        const kk = k - i * 0.05;
        if (kk <= 0) break;
        const [tx, ty] = pos(kk);
        g.fillStyle = i === 1 ? C.butter : (Math.floor(c.t * 20) + i) % 2 ? C.wool : C.moss;
        g.fillRect(Math.round(tx), Math.round(ty), 1, 1);
      }
      const [x, y] = pos(k);
      text(g, '$', x, y - 2, C.butter, { align: 'center', shadow: C.plum });
      if (Math.floor(c.t * 12) % 3 === 0) {
        g.fillStyle = C.wool;
        g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 1, 1);
      }
    }
  }

  drawCover(g: CanvasRenderingContext2D, W: number, H: number) {
    if (this.iris && this.cover > 0 && this.cover < 16) {
      const p = this.iris();
      drawIris(g, W, H, p.x, p.y, this.cover);
    }
    else drawCover(g, W, H, this.cover);
  }
}
