// Cached pictures of procedural art.
//
// The ranch's buildings, fences and props are drawn a pixel at a time (px,
// rect, line): thousands of fillRect calls a frame, and on a phone each one
// costs. They rarely change from one frame to the next, so their art draws
// into a Recorder instead of the screen. If a drawable asked for exactly the
// same pixels as last time, one drawImage of the bitmap made then stands in
// for all of it; if anything differs (a gate swinging, a lit window), the
// bitmap is redrawn from the new calls. The full call list is compared, so
// what reaches the screen is always what the art asked for.
//
// Art that uses something the recorder does not know (paths, clipping,
// alpha) is drawn directly from then on, and art that changes every frame
// (sails turning) is played straight to the screen for a while before a
// picture of it is tried again.

const FILL = 0;
const IMG = 1;

const colors: string[] = [];
const colorIds = new Map<string, number>();
const colorId = (c: string) => {
  let id = colorIds.get(c);
  if (id === undefined) {
    id = colors.length;
    colors.push(c);
    colorIds.set(c, id);
  }
  return id;
};
const imgIds = new WeakMap<object, number>();
let nextImg = 1;

interface Entry {
  ops: number[];
  imgs: CanvasImageSource[];
  canvas: HTMLCanvasElement | null;
  x: number;
  y: number;
  used: number; // frame last drawn
  misses: number; // changed this many frames running
  replayUntil: number; // changing every frame: draw the calls, keep no bitmap
}

class Recorder {
  ops: number[] = [];
  imgs: CanvasImageSource[] = [];
  bad = false;
  imageSmoothingEnabled = false;
  private fill = 0;
  private tx = 0;
  private ty = 0;
  private stack: number[] = [];

  // Arrays handed to a picture are replaced (drawCached); the rest reused.
  reset() {
    this.ops.length = 0;
    this.imgs.length = 0;
    this.bad = false;
    this.tx = this.ty = 0;
    this.stack.length = 0;
  }

  set fillStyle(c: string) {
    if (typeof c === 'string') this.fill = colorId(c);
    else this.bad = true; // gradients, patterns
  }
  get fillStyle(): string {
    return colors[this.fill];
  }

  fillRect(x: number, y: number, w: number, h: number) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (!w || !h) return;
    this.ops.push(FILL, this.fill, x + this.tx, y + this.ty, w, h);
  }

  drawImage(img: CanvasImageSource, ...a: number[]) {
    if (a.length !== 2 && a.length !== 4) {
      this.bad = true;
      return;
    }
    let id = imgIds.get(img);
    if (id === undefined) imgIds.set(img, (id = nextImg++));
    const sw = (img as HTMLCanvasElement).width, sh = (img as HTMLCanvasElement).height;
    this.ops.push(IMG, id, a[0] + this.tx, a[1] + this.ty, a.length === 4 ? a[2] : sw, a.length === 4 ? a[3] : sh);
    this.imgs.push(img);
  }

  save() {
    this.stack.push(this.tx, this.ty, this.fill);
  }
  restore() {
    if (this.stack.length < 3) return;
    this.fill = this.stack.pop()!;
    this.ty = this.stack.pop()!;
    this.tx = this.stack.pop()!;
  }
  translate(x: number, y: number) {
    this.tx += x;
    this.ty += y;
  }
}

// Everything else a 2D context can do marks the drawing as one to do directly.
if (typeof CanvasRenderingContext2D !== 'undefined') {
  const proto = Recorder.prototype as unknown as Record<string, unknown>;
  for (const name of Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype)) {
    if (name in proto || name === 'constructor') continue;
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, name)!;
    if (typeof d.value === 'function')
      proto[name] = function (this: Recorder) {
        this.bad = true;
      };
    else
      Object.defineProperty(Recorder.prototype, name, {
        get() { return undefined; },
        set(this: Recorder) { this.bad = true; },
      });
  }
}

const entries = new Map<string, Entry>();
const direct = new Map<string, number>(); // key -> drawn directly until this frame
const rec = new Recorder();
let frame = 0;
// Counts since the last read, for scripts/perftest.mjs.
export const pictureStats = { hit: 0, miss: 0, direct: 0 };
let enabled = true;

// Off draws everything directly (for checking the cache against the art);
// the pictures are kept for when it is back on.
export function setPictures(on: boolean) {
  enabled = on;
}

export interface Drawable {
  y: number;
  draw: () => void;
}

// Once a frame, before the world is drawn.
export function picturesFrame() {
  frame++;
  if (frame % 600 === 0) for (const [k, e] of entries) if (frame - e.used > 600) entries.delete(k);
}

// Drawables from `make`, cached under `key`. `make` is given the context to
// draw with: the recorder, or the real one for art that has to draw directly.
export function cached(g: CanvasRenderingContext2D, key: string, make: (g: CanvasRenderingContext2D) => Drawable[]): Drawable[] {
  if (!enabled) return make(g);
  if ((direct.get(key) ?? 0) > frame) {
    pictureStats.direct++;
    return make(g);
  }
  const ds = make(rec as unknown as CanvasRenderingContext2D);
  return ds.map((d, i) => ({ y: d.y, draw: () => drawCached(g, key, i, d) }));
}

function drawCached(g: CanvasRenderingContext2D, base: string, i: number, d: Drawable) {
  rec.reset();
  d.draw();
  const key = `${base}#${i}`;
  let e = entries.get(key);
  if (!e) entries.set(key, (e = { ops: [], imgs: [], canvas: null, x: 0, y: 0, used: frame, misses: 0, replayUntil: 0 }));
  e.used = frame;
  const ops = rec.ops;
  if (e.replayUntil > frame) {
    pictureStats.direct++;
    replay(g, ops, rec.imgs, 0, 0);
    return;
  }
  if (rec.bad) {
    // Something the recorder cannot keep: draw what it has this once, and
    // draw this directly from now on.
    replay(g, ops, rec.imgs, 0, 0);
    direct.set(base, Infinity);
    return;
  }
  if (same(e.ops, ops)) {
    pictureStats.hit++;
    e.misses = 0;
    if (e.canvas) g.drawImage(e.canvas, e.x, e.y);
    return;
  }
  pictureStats.miss++;
  const imgs = rec.imgs;
  rec.ops = [];
  rec.imgs = [];
  if (++e.misses > 8) {
    // Changes every frame: no point keeping a picture of it for a while.
    e.misses = 0;
    e.canvas = null;
    e.ops = [];
    e.imgs = [];
    e.replayUntil = frame + 240;
    replay(g, ops, imgs, 0, 0);
    return;
  }
  e.ops = ops;
  e.imgs = imgs;
  // Redraw the picture from the new calls.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < e.ops.length; i += 6) {
    const x = e.ops[i + 2], y = e.ops[i + 3];
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x + e.ops[i + 4] > x1) x1 = x + e.ops[i + 4];
    if (y + e.ops[i + 5] > y1) y1 = y + e.ops[i + 5];
  }
  if (x0 === Infinity) {
    e.canvas = null;
    return;
  }
  x0 = Math.floor(x0);
  y0 = Math.floor(y0);
  const w = Math.ceil(x1) - x0, h = Math.ceil(y1) - y0;
  if (!e.canvas) e.canvas = document.createElement('canvas');
  const c = e.canvas;
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const cg = c.getContext('2d')!;
  cg.clearRect(0, 0, w, h);
  cg.imageSmoothingEnabled = false;
  replay(cg, e.ops, e.imgs, x0, y0);
  e.x = x0;
  e.y = y0;
  g.drawImage(c, x0, y0);
}

function same(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function replay(g: CanvasRenderingContext2D, ops: number[], imgs: CanvasImageSource[], ox: number, oy: number) {
  let fill = -1, k = 0;
  for (let i = 0; i < ops.length; i += 6) {
    if (ops[i] === FILL) {
      if (ops[i + 1] !== fill) g.fillStyle = colors[(fill = ops[i + 1])];
      g.fillRect(ops[i + 2] - ox, ops[i + 3] - oy, ops[i + 4], ops[i + 5]);
    } else g.drawImage(imgs[k++], ops[i + 2] - ox, ops[i + 3] - oy, ops[i + 4], ops[i + 5]);
  }
}
