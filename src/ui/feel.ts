import { C } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { text } from '../gfx/font';
import { makeCanvas } from '../gfx/screen';
import { settings } from './settings';

// Game feel that lives outside the simulation: camera kicks and shake (in
// whole pixels), hit-pause, the coin counter that ticks up as coins fly in,
// tier-up confetti and the dithered plum fade between screens.

interface FlyCoin { x0: number; y0: number; t: number; max: number; value: number; arc: number }
interface Bit { x: number; y: number; vx: number; vy: number; c: string; ph: number }

export interface TierCard { n: number; name: string; blurb: string; brings: string[]; t: number; max: number }

type Fade = { phase: 'out' | 'in'; act: (() => void) | null; outRate: number; inRate: number };

// One 4x4 tile per dither level, used as a fill pattern (fast full-screen).
const patterns: (CanvasPattern | null)[] = [];
function coverPattern(g: CanvasRenderingContext2D, level: number): CanvasPattern | null {
  if (patterns[level] === undefined) {
    const [c, pg] = makeCanvas(4, 4);
    pg.fillStyle = C.plum;
    for (let i = 0; i < 16; i++) if (BAYER4[i] < level) pg.fillRect(i % 4, Math.floor(i / 4), 1, 1);
    patterns[level] = g.createPattern(c, 'repeat');
  }
  return patterns[level];
}

// Plum dither over the whole screen: 0 = clear, 16 = solid. Pass the view
// offset to anchor it to the world like the night's dither, so a dimmed
// night stays at the night's own level instead of filling in solid.
export function drawCover(g: CanvasRenderingContext2D, W: number, H: number, level: number, ox = 0, oy = 0) {
  const l = Math.max(0, Math.min(16, Math.round(level)));
  if (l <= 0) return;
  if (l >= 16) {
    g.fillStyle = C.plum;
    g.fillRect(0, 0, W, H);
    return;
  }
  const p = coverPattern(g, l);
  if (!p) return;
  const sx = ox & 3, sy = oy & 3;
  g.save();
  g.translate(-sx, -sy);
  g.fillStyle = p;
  g.fillRect(0, 0, W + sx, H + sy);
  g.restore();
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
  tierCard: TierCard | null = null;

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

  confetti(W: number, n = 70) {
    const cols = [C.butter, C.wool, C.butter, C.teal, C.moss];
    for (let i = 0; i < n; i++)
      this.bits.push({ x: Math.random() * W, y: -Math.random() * 60 - 2, vx: (Math.random() - 0.5) * 20, vy: 22 + Math.random() * 30, c: cols[i % cols.length], ph: Math.random() * 6 });
  }

  // ---- Transitions ----

  get fading() {
    return this.fade !== null && this.fade.phase === 'out';
  }

  // Cover the screen, run `act` (switch screens), then uncover.
  fadeTo(act: () => void, outDur = 0.22, inDur = 0.32) {
    if (this.fade?.phase === 'out') return false;
    this.fade = { phase: 'out', act, outRate: 16 / outDur, inRate: 16 / inDur };
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

  // Screen-space effects above the UI (confetti, coins in flight).
  drawTop(g: CanvasRenderingContext2D) {
    for (const b of this.bits) {
      g.fillStyle = b.c;
      // Flutter: the scrap is edge-on (1px) half the time.
      g.fillRect(Math.round(b.x), Math.round(b.y), Math.cos(b.ph) > 0 ? 2 : 1, 1);
    }
    for (const c of this.flying) {
      if (c.t < 0) continue;
      const k = c.t / c.max;
      const e = k * k * (3 - 2 * k);
      const x = c.x0 + (this.purse.x - c.x0) * e;
      const y = c.y0 + (this.purse.y - c.y0) * e - Math.sin(k * Math.PI) * c.arc;
      text(g, '$', x, y - 2, C.butter, { align: 'center', shadow: C.plum });
    }
  }

  drawCover(g: CanvasRenderingContext2D, W: number, H: number) {
    drawCover(g, W, H, this.cover);
  }
}
