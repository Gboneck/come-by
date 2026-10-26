import { C, U32 } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { PX, fine, makeCanvas } from '../gfx/screen';
import { lookKey, paintCanopy, paintGround, type Look } from '../world/fineground';
import { WORLD_H, WORLD_W } from '../world/map';
import type { Baked } from '../world/terrain';

// Shafts of low sun slanting through the canopy at golden hour and in the
// early morning: narrow bands along the light's direction where the leaves
// catch it, a sparse dither of buttercup and wool over the treetops, on the
// fine grid. Only the pixels inside the bands are visited, so it costs
// little.
export function drawShafts(g: CanvasRenderingContext2D, baked: Baked, ox: number, oy: number, W: number, H: number, dx: number, dy: number, strength: number, t: number) {
  if (strength < 0.15) return;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  if (ny < 0.2) return;
  const kind = baked.canopyKind;
  const SPACE = 128, WIDE = 9;
  const shift = (t * 6) % SPACE;
  const lv = 2 + strength * 3;
  const FW = W * PX, FH = H * PX, FX0 = ox * PX, FY0 = oy * PX;
  fine(g, (fg) => {
    for (let y = 0; y < FH; y++) {
      const fy = y + FY0, wy = fy >> 1;
      if (wy < 0 || wy >= WORLD_H) continue;
      // u = x*ny - y*nx is constant along the light; bands of u are shafts.
      const uMin = -fy * nx, uMax = WORLD_W * PX * ny - fy * nx;
      for (let k = Math.floor((Math.min(uMin, uMax) - shift) / SPACE); k * SPACE + shift < Math.max(uMin, uMax); k++) {
        const u0 = k * SPACE + shift + (((k * 37) % 11) - 5) * 2;
        const xa = Math.ceil((u0 + fy * nx) / ny), xb = Math.floor((u0 + WIDE + fy * nx) / ny);
        for (let fx = Math.max(xa, FX0); fx <= Math.min(xb, FX0 + FW - 1); fx++) {
          const wx = fx >> 1;
          if (wx < 0 || wx >= WORLD_W || !kind[wy * WORLD_W + wx]) continue;
          const thr = BAYER4[(fy & 3) * 4 + (fx & 3)];
          if (thr >= lv) continue;
          fg.fillStyle = thr < 1 ? C.wool : C.butter;
          fg.fillRect(fx - FX0, y, 1, 1);
        }
      }
    }
  });
}

// The world's ground and canopy at double density, in chunks around the
// camera. Each chunk of CHUNK x CHUNK fine pixels keeps its painted ground
// and canopy (world/fineground.ts, world/finecanopy.ts) and a lit ground:
// the ground with the trees' shadows laid on it, moved with the sun (long to
// the west at sunrise, short at noon, long to the east in the golden hour).
//
// Painting is spread over frames within a budget, nearest the middle of
// the view first; until a chunk is painted the old world-pixel ground shows
// there, so nothing is ever blank. A new look (a season step, wet ground,
// the golden hour) or a sun that has moved a pixel repaints chunk by chunk.
// Chunks well out of view are dropped.
export const CHUNK = 128;
const BUDGET_MS = 3;
const MAX_CHUNKS = 160;

interface Chunk {
  cx: number;
  cy: number;
  gKey: string;
  ground: HTMLCanvasElement | null;
  cKey: string;
  canopy: HTMLCanvasElement | null;
  shadow: HTMLCanvasElement | null; // the canopy's silhouette in sage
  lKey: string;
  lit: HTMLCanvasElement | null;
  used: number;
}

export class FineWorld {
  private chunks = new Map<number, Chunk>();
  private frame = 0;
  private look: Look = { snow: 0, leaves: 0, bloom: 0, wet: 0, golden: 0 };
  private key = '';
  private canopyKey = ''; // the canopy only cares about the season
  private sunKey = '';
  private dx = 0;
  private dy = 0;
  private sun = false;
  stats = { painted: 0, ms: 0 };

  // Once a frame before drawing: what the world looks like now, and paint
  // what the view needs within the budget.
  sync(baked: Baked, look: Look, dx: number, dy: number, sun: boolean, ox: number, oy: number, W: number, H: number, urgent = false) {
    this.frame++;
    this.look = look;
    this.key = lookKey(look);
    this.canopyKey = `${look.snow}${look.leaves}${look.bloom}`;
    this.dx = dx * PX;
    this.dy = dy * PX;
    this.sun = sun;
    this.sunKey = sun ? `${dx},${dy}` : 'none';
    const { c0, c1, r0, r1 } = this.range(ox, oy, W, H, 1);
    const mx = ((ox + W / 2) * PX) / CHUNK, my = ((oy + H / 2) * PX) / CHUNK;
    const todo: { c: Chunk; d: number; vis: boolean }[] = [];
    const vis = this.range(ox, oy, W, H, 0);
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const c = this.chunk(cx, cy);
        c.used = this.frame;
        const inView = cx >= vis.c0 && cx <= vis.c1 && cy >= vis.r0 && cy <= vis.r1;
        if (c.gKey !== this.key || c.cKey !== this.canopyKey || c.lKey !== this.litKey()) todo.push({ c, d: Math.hypot(cx + 0.5 - mx, cy + 0.5 - my) - (inView ? 100 : 0), vis: inView });
      }
    todo.sort((p, q) => p.d - q.d);
    const t0 = performance.now();
    for (const { c, vis: v } of todo) {
      // Painting a missing chunk in view is urgent the first time round;
      // otherwise stop when the budget is spent.
      const missing = v && !c.ground;
      if (performance.now() - t0 > BUDGET_MS && !(urgent && missing)) break;
      this.update(baked, c);
    }
    this.stats.ms = performance.now() - t0;
    // Keep the most recently seen chunks (about 40MB at most), so walking
    // back over the same ground costs nothing.
    if (this.frame % 60 === 0 && this.chunks.size > MAX_CHUNKS) {
      const old = [...this.chunks.entries()].sort((p, q) => p[1].used - q[1].used);
      for (let k = 0; k < old.length - MAX_CHUNKS; k++) this.chunks.delete(old[k][0]);
    }
  }

  private litKey() {
    return `${this.key}|${this.sunKey}`;
  }

  private range(ox: number, oy: number, W: number, H: number, ring: number) {
    const c0 = Math.max(0, Math.floor((ox * PX) / CHUNK) - ring), r0 = Math.max(0, Math.floor((oy * PX) / CHUNK) - ring);
    const c1 = Math.min(Math.ceil((WORLD_W * PX) / CHUNK) - 1, Math.floor(((ox + W) * PX) / CHUNK) + ring);
    const r1 = Math.min(Math.ceil((WORLD_H * PX) / CHUNK) - 1, Math.floor(((oy + H) * PX) / CHUNK) + ring);
    return { c0, c1, r0, r1 };
  }

  private chunk(cx: number, cy: number): Chunk {
    const k = cy * 1024 + cx;
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, (c = { cx, cy, gKey: '', ground: null, cKey: '', canopy: null, shadow: null, lKey: '', lit: null, used: this.frame }));
    return c;
  }

  // One step of work on a chunk: its ground, its canopy, or its lit ground.
  private update(baked: Baked, c: Chunk) {
    const fx = c.cx * CHUNK, fy = c.cy * CHUNK;
    if (c.gKey !== this.key) {
      c.ground = toCanvas(paintGround(baked, fx, fy, CHUNK, CHUNK, this.look), c.ground);
      c.gKey = this.key;
      this.stats.painted++;
      return;
    }
    if (c.cKey !== this.canopyKey) {
      const px = paintCanopy(baked, fx, fy, CHUNK, CHUNK, this.look);
      c.canopy = toCanvas(px, c.canopy);
      const sh = new Uint32Array(px.length);
      for (let i = 0; i < px.length; i++) if (px[i]) sh[i] = U32.sage;
      c.shadow = toCanvas(sh, c.shadow);
      c.cKey = this.canopyKey;
      // Neighbours' shadows may fall here: their lit grounds are redone.
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const n = this.chunks.get((c.cy + j) * 1024 + c.cx + i); if (n) n.lKey = ''; }
      return;
    }
    // The lit ground: the ground, then the canopy's shadow from this chunk
    // and its neighbours, shifted by the sun.
    if (!c.lit) c.lit = makeCanvas(CHUNK, CHUNK)[0];
    const lg = c.lit.getContext('2d')!;
    lg.clearRect(0, 0, CHUNK, CHUNK);
    lg.drawImage(c.ground!, 0, 0);
    if (this.sun) {
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const n = this.chunks.get((c.cy + j) * 1024 + c.cx + i);
          if (!n?.shadow) continue;
          const x = i * CHUNK + this.dx, y = j * CHUNK + this.dy;
          if (x >= CHUNK || y >= CHUNK || x + CHUNK <= 0 || y + CHUNK <= 0) continue;
          lg.drawImage(n.shadow, x, y);
        }
    }
    c.lKey = this.litKey();
  }

  // The lit ground for the view (screen in world pixels; the frame is under
  // scale(PX)); where a chunk is not painted yet, the old ground.
  drawGround(g: CanvasRenderingContext2D, baked: Baked, ox: number, oy: number, W: number, H: number) {
    const { c0, c1, r0, r1 } = this.range(ox, oy, W, H, 0);
    fine(g, (fg) => {
      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          const c = this.chunks.get(cy * 1024 + cx);
          const x = cx * CHUNK - ox * PX, y = cy * CHUNK - oy * PX;
          const img = c?.lit && c.lKey ? c.lit : c?.ground;
          if (img) fg.drawImage(img, x, y);
          else fg.drawImage(baked.ground, (cx * CHUNK) / PX, (cy * CHUNK) / PX, CHUNK / PX, CHUNK / PX, x, y, CHUNK, CHUNK);
        }
    });
  }

  drawCanopy(g: CanvasRenderingContext2D, baked: Baked, ox: number, oy: number, W: number, H: number) {
    const { c0, c1, r0, r1 } = this.range(ox, oy, W, H, 0);
    fine(g, (fg) => {
      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          const c = this.chunks.get(cy * 1024 + cx);
          const x = cx * CHUNK - ox * PX, y = cy * CHUNK - oy * PX;
          if (c?.canopy) fg.drawImage(c.canopy, x, y);
          else fg.drawImage(baked.canopy, (cx * CHUNK) / PX, (cy * CHUNK) / PX, CHUNK / PX, CHUNK / PX, x, y, CHUNK, CHUNK);
        }
    });
  }
}

function toCanvas(px: Uint32Array, reuse: HTMLCanvasElement | null): HTMLCanvasElement {
  const c = reuse ?? makeCanvas(CHUNK, CHUNK)[0];
  const g = c.getContext('2d')!;
  const img = g.createImageData(CHUNK, CHUNK);
  new Uint32Array(img.data.buffer).set(px);
  g.putImageData(img, 0, 0);
  return c;
}
