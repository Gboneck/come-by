import { PX } from './screen';

// A world-sized picture in fine pixels, painted in square chunks around the
// camera as they come into view and dropped when far behind. A whole world
// in fine pixels would be tens of megabytes (too much for a phone); the
// chunks a screen needs are a few.
//
//   const ground = new FineLayer(WORLD_W, WORLD_H, (g, x0, y0, w, h) => {
//     // world pixels, translated so (x0, y0) is the chunk's corner;
//     // fine() works inside for fine-pixel detail
//   });
//   ground.draw(g, ox, oy, W, H); // in the frame, like drawImage of a layer
//
// A chunk is painted the first time it is drawn. With a `fallback` (the same
// picture in world pixels) at most `budget` new chunks are painted a frame
// and the rest show the fallback till their turn; without one, every chunk
// in view is painted at once. When a frame paints none, one chunk of the
// ring around the view is painted ahead of time. invalidate() repaints a
// rect (a building put up, the season turning).

interface Chunk { c: HTMLCanvasElement; cx: number; cy: number; used: number }

export interface FineLayerOpts {
  chunk?: number; // world pixels a side (default 128: 256 fine pixels)
  keep?: number; // chunks kept painted (default 48, about 12MB)
  budget?: number; // new chunks painted a frame (default 3, with a fallback)
  fallback?: CanvasImageSource; // the layer in world pixels, while chunks paint
}

export class FineLayer {
  private chunks = new Map<number, Chunk>();
  private frame = 0;
  readonly size: number;
  private keep: number;
  private budget: number;
  private fallback: CanvasImageSource | null;
  private cols: number;
  private rows: number;

  constructor(
    readonly width: number,
    readonly height: number,
    private paint: (g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) => void,
    o: FineLayerOpts = {},
  ) {
    this.size = o.chunk ?? 128;
    this.keep = o.keep ?? 48;
    this.budget = o.budget ?? 3;
    this.fallback = o.fallback ?? null;
    this.cols = Math.ceil(width / this.size);
    this.rows = Math.ceil(height / this.size);
  }

  private make(cx: number, cy: number): Chunk {
    const S = this.size;
    const x0 = cx * S, y0 = cy * S;
    const w = Math.min(S, this.width - x0), h = Math.min(S, this.height - y0);
    const c = document.createElement('canvas');
    c.width = w * PX;
    c.height = h * PX;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.setTransform(PX, 0, 0, PX, -x0 * PX, -y0 * PX);
    this.paint(g, x0, y0, w, h);
    return { c, cx, cy, used: this.frame };
  }

  // Draw the part (ox, oy, W, H) of the layer at the screen's top-left, in
  // world pixels (as drawImage(layer, ox, oy, W, H, 0, 0, W, H) would).
  draw(g: CanvasRenderingContext2D, ox: number, oy: number, W: number, H: number) {
    this.frame++;
    const S = this.size;
    const c0 = Math.max(0, Math.floor(ox / S)), c1 = Math.min(this.cols - 1, Math.floor((ox + W - 1) / S));
    const r0 = Math.max(0, Math.floor(oy / S)), r1 = Math.min(this.rows - 1, Math.floor((oy + H - 1) / S));
    let made = 0;
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const k = cy * this.cols + cx;
        let ch = this.chunks.get(k);
        if (!ch) {
          if (this.fallback && made >= this.budget) {
            const x0 = cx * S, y0 = cy * S, w = Math.min(S, this.width - x0), h = Math.min(S, this.height - y0);
            g.drawImage(this.fallback, x0, y0, w, h, x0 - ox, y0 - oy, w, h);
            continue;
          }
          this.chunks.set(k, (ch = this.make(cx, cy)));
          made++;
        }
        ch.used = this.frame;
        g.drawImage(ch.c, cx * S - ox, cy * S - oy, ch.c.width / PX, ch.c.height / PX);
      }
    // Spare: paint one chunk of the ring around the view ahead of time.
    if (!made) {
      outer: for (let cy = r0 - 1; cy <= r1 + 1; cy++)
        for (let cx = c0 - 1; cx <= c1 + 1; cx++) {
          if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
          const k = cy * this.cols + cx;
          if (this.chunks.has(k)) continue;
          this.chunks.set(k, this.make(cx, cy));
          break outer;
        }
    }
    if (this.chunks.size > this.keep) this.trim();
  }

  // Forget the least recently drawn chunks beyond `keep`.
  private trim() {
    const all = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k] of all.slice(0, this.chunks.size - this.keep)) this.chunks.delete(k);
  }

  // Repaint everything in this world rect (all of it with no arguments).
  invalidate(x = 0, y = 0, w = this.width, h = this.height) {
    const S = this.size;
    for (const [k, ch] of this.chunks) {
      const x0 = ch.cx * S, y0 = ch.cy * S;
      if (x0 < x + w && x0 + S > x && y0 < y + h && y0 + S > y) this.chunks.delete(k);
    }
  }
}
