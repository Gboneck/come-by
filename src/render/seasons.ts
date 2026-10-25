import { U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { makeCanvas } from '../gfx/screen';
import { hash2, vnoise } from '../rng';
import { WORLD_H, WORLD_W } from '../world/map';
import type { Baked } from '../world/terrain';

// The seasons on the baked world. The ground and the canopy are recoloured
// from their baked pixels, all inside the palette:
// - spring: blossom on the broadleaf trees, fresh flowers in the grass;
// - autumn: the broadleaf crowns turn buttercup, plum and sage (the pines
//   stay green), leaves litter the ground under them, the grass dries;
// - winter: snow on the ground (the shade under trees stays sage, so the
//   snow has shadows), trodden paths through it, snow on the treetops and
//   the pine tiers, ice along the banks.
// The levels are stepped in quarters and a layer is rebuilt only when a step
// changes (a few times as a season turns), so drawing it costs nothing
// more than the baked layer did.

const q = (v: number) => Math.round(v * 4) / 4;

export class SeasonLayers {
  private key = '0,0,0';
  ground: HTMLCanvasElement | null = null;
  canopy: HTMLCanvasElement | null = null;
  private gc: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
  private cc: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

  sync(baked: Baked, season: { snow: number; leaves: number; bloom: number }) {
    const s = q(season.snow), l = q(season.leaves), b = q(season.bloom);
    const key = `${s},${l},${b}`;
    if (key === this.key) return;
    this.key = key;
    if (s === 0 && l === 0 && b === 0) {
      this.ground = this.canopy = null;
      return;
    }
    this.gc ??= makeCanvas(WORLD_W, WORLD_H);
    this.cc ??= makeCanvas(WORLD_W, WORLD_H);
    this.ground = buildGround(baked, this.gc, s, l, b);
    this.canopy = buildCanopy(baked, this.cc, s, l, b);
  }
}

function buildGround(bk: Baked, [c, g]: [HTMLCanvasElement, CanvasRenderingContext2D], s: number, l: number, b: number): HTMLCanvasElement {
  const W = WORLD_W, H = WORLD_H;
  const img = g.createImageData(W, H);
  const out = new Uint32Array(img.data.buffer);
  const src = bk.groundPx, soil = bk.soil, wd = bk.waterDist;
  const { meadow, moss, sage, wool, butter, teal, plum } = U32;
  const ice = s >= 0.5 ? 1 + Math.round(s * 2) : 0;
  for (let y = 0; y < H; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let px = src[i];
      const so = soil[i];
      const h = hash2(x, y, 601);
      if (b > 0 && px === meadow && h < b * 0.012) px = hash2(x, y, 602) < 0.5 ? butter : wool;
      if (l > 0) {
        if (px === meadow && h < l * 0.07) px = moss;
        else if (px === sage && so === 0 && h < l * 0.1) px = hash2(x, y, 603) < 0.6 ? butter : plum;
        else if (px === meadow && h > 1 - l * 0.003) px = hash2(x, y, 604) < 0.85 ? butter : plum;
      }
      if (s > 0) {
        const t = BAYER4[by + (x & 3)];
        if (so === 3) {
          // Ice creeping out from the banks.
          if (ice && wd[i] <= ice) px = wd[i] === ice ? sage : hash2(x >> 1, y, 605) < 0.06 ? teal : ((x + y) & 1) === 0 ? wool : sage;
        } else if (so === 1) {
          // Paths trodden through: only a thin dusting stays.
          if ((px === meadow || px === moss) && h < s * 0.3) px = wool;
        } else if (px === meadow || px === butter) {
          // Old grass pokes through here and there in small tufts, so the
          // snow has texture and pale things standing on it still read.
          const tuft = hash2(x >> 1, y >> 1, 606);
          if (tuft < s * 0.93 || h < s * 0.6 || (px === butter && s > 0.5)) px = wool;
        } else if (px === moss) {
          if (hash2(x >> 1, y >> 1, 607) < s * 0.85 || h < s * 0.5) px = wool;
        } else if (px === sage) {
          if (t < s * 3) px = wool;
        } else if (px === teal && s > 0.7 && so !== 3) px = wool;
      }
      out[i] = px;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function buildCanopy(bk: Baked, [c, g]: [HTMLCanvasElement, CanvasRenderingContext2D], s: number, l: number, b: number): HTMLCanvasElement {
  const W = WORLD_W, H = WORLD_H;
  const img = g.createImageData(W, H);
  const out = new Uint32Array(img.data.buffer);
  const src = bk.canopyPx, kind = bk.canopyKind;
  const { sage, wool, butter, teal, plum } = U32;
  for (let y = 0; y < H; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let px = src[i];
      if (!px) continue;
      const k = kind[i];
      const broad = k === 1 || k === 2;
      const h = hash2(x, y, 611);
      if (broad && b > 0 && (px === teal || px === sage)) {
        // Blossom: little clusters of wool petals, a buttercup heart.
        // Some trees are in full flower, most only touched with it.
        const cl = hash2(x >> 1, y >> 1, 612);
        // (The deep woods only flower in patches; the trees at their edges
        // and in the groves carry the most.)
        const full = vnoise(x / 12, y / 12, 614) > 0.55;
        if (cl < b * (full ? (k === 2 ? 0.32 : 0.14) : k === 2 ? 0.04 : 0)) px = h < 0.25 ? butter : wool;
      }
      if (broad && l > 0 && (px === teal || px === sage)) {
        // Each crown turns its own way: buttercup, plum-brown, or late green.
        const n = vnoise(x / 13, y / 13, 613);
        const a = k === 2 ? l : l * 0.6; // the deep woods turn more quietly
        if (n < 0.4) px = h < a * 0.6 ? butter : h < a * 0.7 ? plum : px;
        else if (n < 0.65) px = h < a * 0.35 ? plum : h < a * 0.6 ? sage : px;
        else px = h < a * 0.15 ? sage : h < a * 0.2 ? butter : px;
      }
      if (s > 0 && px !== plum) {
        // Snow on top of every clump and tier, a dusting through the rest.
        const above = y > 0 ? src[i - W] : 0;
        const top = !above || above === plum;
        const t = BAYER4[by + (x & 3)];
        if ((top && t < s * 16) || h < s * (k === 3 ? 0.18 : 0.12)) px = wool;
      }
      out[i] = px;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
