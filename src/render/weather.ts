import { C, U32 } from '../palette';
import { BAYER4, line } from '../gfx/draw';
import { makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';
import { WORLD_W } from '../world/map';
import { windStrength } from './wind';
import { lightLook, seasonLook } from '../art/seasonlook';
import type { Game } from '../game';
import { NS, tileNoise, type SkyOpts } from './night';
import { quality } from '../gfx/quality';

// The weather, drawn. Reads `game.weather` (sky, rain, fog, wind) and keeps
// only what drawing needs: how wet the ground is, the drift of clouds and
// fog, and the lightning. Rain falls in streaks and splashes, puddles grow
// on the paths while it rains and dry out after, storms flash.

export class WeatherFx {
  wet = 0; // 0..1, how wet the ground is
  cloudX = 0;
  cloudY = 0;
  fogX = 0;
  t = 0; // weather clock (runs fast while resting)
  private flash = 0; // seconds of flash left
  private flashNear = 1;
  private flashT = 6;
  private seenAt = 0; // the last strike the audio announced
  private sinceAudio = 99;
  private bolt: number[][] | null = null;
  private wc: HTMLCanvasElement | null = null;
  private wg: CanvasRenderingContext2D | null = null;
  private wimg: ImageData | null = null;
  private cloudTex = tileNoise(32, 901);

  update(game: Game, dt: number, lapse: number) {
    const w = game.weather;
    const dl = dt * lapse;
    this.t += dl;
    this.wet = Math.max(0, Math.min(1, this.wet + (w.rain > 0.05 ? (w.rain * dl) / 30 : -dl / 80)));
    this.cloudX += dl * (6 + w.wind * 34);
    this.cloudY += dl * (2 + w.wind * 10);
    this.fogX += dl * (3 + w.wind * 16);
    // Lightning follows the audio's strikes (its thunder comes after), or
    // our own timer when there is no sound running.
    const L = game.audio?.lightning;
    this.sinceAudio += dt;
    if (L && L.at !== this.seenAt) {
      this.seenAt = L.at;
      this.sinceAudio = 0;
      this.strike(L.near);
    } else if (w.sky === 'storm' && w.rain > 0.6 && this.sinceAudio > 25 && (this.flashT -= dt) <= 0) {
      this.flashT = 5 + Math.random() * 9;
      this.strike(Math.random());
    }
    if (this.flash > 0) this.flash -= dt;
  }

  // A strike: near ones flash bright with a bolt, far ones a dim flicker.
  private strike(near: number) {
    this.flashNear = near;
    this.flash = near > 0.45 ? 0.18 : 0.1;
    this.bolt = null;
  }

  // What the weather adds to the dither overlay.
  sky(game: Game, dark: number): Partial<SkyOpts> {
    const w = game.weather;
    return {
      // Only a storm darkens the whole sky; rain shows as a wet ground.
      overcast: w.sky === 'storm' ? Math.min(1, w.rain * 1.2) : 0,
      // A haze below a quarter is not drawn: rain and storms carry a little.
      fog: Math.max(0, (w.fog - 0.25) / 0.75),
      fogNight: dark > 0.25,
      fogX: this.fogX,
      flash: this.flashNear > 0.45 ? (this.flash > 0.11 ? 10 : this.flash > 0.04 ? 4 : this.flash > 0 ? 1 : 0) : this.flash > 0.05 ? 3 : this.flash > 0 ? 1 : 0,
    };
  }

  // Shade on the ground (screen coords, straight after the baked ground):
  // grass and paths darken by a dither of the next darker colour, under the
  // shadows of passing clouds on a fair day and all over when it is wet. The
  // animals are not dimmed, so the flock still reads.
  drawGroundShade(g: CanvasRenderingContext2D, game: Game, ox: number, oy: number, W: number, H: number, dark: number) {
    const w = game.weather;
    if (seasonLook.snow > 0.3) return; // the snow layer has its own look
    const wetL = this.wet * 5;
    const clouds = 9 * Math.max(0, 1 - w.rain * 2.5) * Math.max(0, 1 - w.fog * 2) * Math.max(0, 1 - dark * 3);
    // The golden hour warms the sunlit grass: a dither of buttercup on the
    // meadow, the moss lightened (the shadows, drawn after, stay cool).
    const gold = lightLook.golden * 0.07 * Math.max(0, 1 - w.rain * 3) * Math.max(0, 1 - w.fog * 2);
    if ((wetL < 0.5 && clouds < 0.5 && gold < 0.01) || !quality.shade) return;
    if (!this.wc || this.wc.width !== W || this.wc.height !== H) {
      [this.wc, this.wg] = makeCanvas(W, H);
      this.wimg = this.wg.createImageData(W, H);
    }
    const buf = new Uint32Array(this.wimg!.data.buffer);
    const src = game.baked.groundPx, meadow = U32.meadow, moss = U32.moss, sage = U32.sage, butter = U32.butter;
    const CT = this.cloudTex, cx = Math.floor(this.cloudX), cy = Math.floor(this.cloudY);
    for (let y = 0; y < H; y++) {
      const wy = y + oy;
      const row = wy * WORLD_W + ox, by = (wy & 3) * 4;
      const ny = ((wy - cy) >> 2 & (NS - 1)) * NS;
      for (let x = 0; x < W; x++) {
        let level = wetL;
        if (clouds > 0) {
          // Sampled at a quarter resolution, so the clouds are big and soft.
          const n = CT[((x + ox - cx) >> 2 & (NS - 1)) + ny];
          if (n > 160) level += clouds * Math.min(1, (n - 160) / 30);
        }
        let d = 0;
        const thr = BAYER4[by + ((x + ox) & 3)];
        if (thr < level) {
          const c = src[row + x];
          d = c === meadow ? moss : c === moss ? sage : 0;
        } else if (gold > 0 && hash2(x + ox, wy, 77) < gold) {
          const c = src[row + x];
          d = c === meadow ? butter : c === moss ? meadow : 0;
        }
        buf[y * W + x] = d;
      }
    }
    this.wg!.putImageData(this.wimg!, 0, 0);
    g.drawImage(this.wc, 0, 0);
  }

  // On the ground (world coords): puddles on the paths, and the splash of
  // drops landing.
  drawGround(g: CanvasRenderingContext2D, game: Game) {
    const { ox, oy, W, H } = game.view();
    const w = game.weather;
    if (seasonLook.snow > 0.4) return; // frozen: no puddles, drops fall as snow
    if (this.wet > 0.12) {
      const k = Math.min(1, (this.wet - 0.12) / 0.6);
      for (const p of game.baked.puddles) {
        if (p.x < ox - 8 || p.x > ox + W + 8 || p.y < oy - 4 || p.y > oy + H + 4) continue;
        const rx = Math.round(p.r * k);
        if (rx < 1) continue;
        const ry = Math.max(1, Math.round(rx * 0.45));
        for (let dy = -ry; dy <= ry; dy++) {
          const hw = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
          g.fillStyle = dy === -ry ? C.sage : C.teal;
          g.fillRect(p.x - hw, p.y + dy, hw * 2 + 1, 1);
        }
        g.fillStyle = C.wool;
        if (rx > 2) g.fillRect(p.x + rx - 2, p.y - ry + 1, 1, 1);
        // Rings where drops land in it.
        if (w.rain > 0.1) {
          const ph = (this.t * 2.5 + hash2(p.x, p.y, 3) * 4) % 1;
          if (hash2(p.x, Math.floor(this.t * 2.5 + hash2(p.x, p.y, 3) * 4), 4) < w.rain && rx > 1) {
            const r = Math.min(rx - 1, Math.round(ph * rx));
            g.fillRect(p.x - r, p.y, 1, 1);
            g.fillRect(p.x + r, p.y, 1, 1);
          }
        }
      }
    }
    if (w.rain < 0.05) return;
    // Splashes: each slot shows a drop landing somewhere new every moment.
    const n = Math.round(((w.rain * W * H) / 1400) * quality.fx);
    g.fillStyle = C.wool;
    for (let j = 0; j < n; j++) {
      const s = this.t * 9 + hash2(j, 0, 5) * 9;
      const slot = Math.floor(s), f = s - slot;
      const x = ox + Math.floor(hash2(j, slot, 6) * W), y = oy + Math.floor(hash2(j, slot, 7) * H);
      if (f < 0.4) g.fillRect(x, y, 1, 1);
      else if (f < 0.75) {
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1);
      }
    }
  }

  // In the air, over everything (screen coords): streaks of rain slanting
  // with the wind, and the lightning bolt itself.
  drawAir(g: CanvasRenderingContext2D, game: Game, W: number, H: number, night: boolean) {
    const w = game.weather;
    if (w.rain > 0.03 && seasonLook.snow > 0.4) {
      // Snowfall: flakes drifting down slowly, swaying, blown on the wind.
      const n = Math.round(((w.rain * W * H) / 220) * quality.fx);
      const drift = 6 + windStrength() * 30;
      g.fillStyle = night ? C.sage : C.wool;
      for (let i = 0; i < n; i++) {
        const v = 14 + hash2(i, 1, 19) * 16;
        const fall = this.t * v;
        const y = Math.floor((((hash2(i, 2, 19) * (H + 10) + fall) % (H + 10)) + H + 10) % (H + 10)) - 5;
        const x = Math.floor((((hash2(i, 3, 19) * (W + 20) + this.t * drift + Math.sin(this.t * 1.7 + i) * 3) % (W + 20)) + W + 20) % (W + 20)) - 10;
        g.fillRect(x, y, 1, 1);
        if (hash2(i, 4, 19) < 0.15) { g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); }
      }
    } else if (w.rain > 0.03) {
      const n = Math.round(((w.rain * W * H) / 260) * quality.fx);
      const slant = 0.2 + windStrength() * 0.55;
      const len = 3 + Math.round(w.rain * 2);
      g.fillStyle = night ? C.sage : C.wool;
      for (let i = 0; i < n; i++) {
        const v = 230 + hash2(i, 1, 9) * 90;
        const fall = this.t * v;
        const y = Math.floor((((hash2(i, 2, 9) * (H + 30) + fall) % (H + 30)) + H + 30) % (H + 30)) - 15;
        const x = Math.floor((((hash2(i, 3, 9) * (W + 40) + fall * slant) % (W + 40)) + W + 40) % (W + 40)) - 20;
        // One rect per straight run of the streak (same pixels, fewer calls).
        for (let k = 0; k < len; ) {
          const dx = Math.round(k * slant);
          let e = k + 1;
          while (e < len && Math.round(e * slant) === dx) e++;
          g.fillRect(x + dx, y + k, 1, e - k);
          k = e;
        }
      }
    }
    if (this.flash > 0.08 && this.flashNear > 0.45) {
      if (!this.bolt) {
        // A jagged bolt from the top of the screen, with one fork.
        const pts: number[][] = [];
        let x = W * (0.2 + Math.random() * 0.6), y = -2;
        const end = H * (0.3 + Math.random() * 0.25);
        while (y < end) {
          pts.push([x, y]);
          x += (Math.random() - 0.5) * 12;
          y += 5 + Math.random() * 7;
        }
        pts.push([x, y]);
        this.bolt = pts;
      }
      const b = this.bolt;
      for (let i = 0; i < b.length - 1; i++) {
        line(g, b[i][0], b[i][1], b[i + 1][0], b[i + 1][1], C.wool);
        line(g, b[i][0] + 1, b[i][1], b[i + 1][0] + 1, b[i + 1][1], C.butter);
      }
      const m = b[Math.floor(b.length / 2)];
      line(g, m[0], m[1], m[0] + 10, m[1] + 12, C.wool);
    }
  }
}
