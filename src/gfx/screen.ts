// The screen: a small canvas of fine pixels, scaled to the window by a
// whole number.
//
// Two grids. World pixels are what the game is built in: the sim, the map
// (TS = 8), every speed and nearly all the art. Fine pixels are PX to a
// world pixel each way. The frame is drawn under a scale(PX) transform, so
// every draw call in world pixels lands as crisp PX x PX blocks, and art that
// wants the finer grid draws in fine pixels (fine(), dense sprites, the font).
//
// The canvas is FW x FH fine pixels (about TARGET_FINE on the short side);
// W x H is the same screen in world pixels. Where the browser can scale a
// canvas with nearest-neighbour filtering (CSS image-rendering: pixelated)
// the compositor does the whole-number upscale on the GPU; otherwise the
// canvas is copied up by drawImage each frame.
export const PX = 2;

// Fine pixels on the short side to aim for, rounding to a whole number of
// device pixels each. About 216 world pixels: on a phone held upright a fine
// pixel is then about one CSS pixel, so text drawn in fine pixels reads at a
// comfortable size.
export const TARGET_FINE = 432;
export const TARGET_SHORT = TARGET_FINE / PX;

const CSS_SCALE = typeof CSS !== 'undefined' && !!CSS.supports?.('image-rendering', 'pixelated');

export class Screen {
  view: HTMLCanvasElement;
  vctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement;
  g: CanvasRenderingContext2D; // world pixels: scale(PX) is always set
  W = TARGET_SHORT; // world pixels
  H = TARGET_SHORT;
  FW = TARGET_FINE; // fine pixels (W * PX)
  FH = TARGET_FINE;
  scale = 1; // device pixels per world pixel
  fine = 1; // device pixels per fine pixel
  dpr = 1;
  readonly cssScale = CSS_SCALE;
  onResize: (() => void) | null = null;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.vctx = view.getContext('2d', { alpha: false })!;
    if (CSS_SCALE) {
      view.style.imageRendering = 'pixelated';
      this.buf = view;
      this.g = this.vctx;
    } else {
      this.buf = document.createElement('canvas');
      this.g = this.buf.getContext('2d')!;
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const vv = window.visualViewport;
    const cssW = vv ? vv.width : window.innerWidth;
    const cssH = vv ? vv.height : window.innerHeight;
    const dw = Math.round(cssW * dpr);
    const dh = Math.round(cssH * dpr);
    const fine = Math.max(1, Math.round(Math.min(dw, dh) / TARGET_FINE));
    const scale = fine * PX;
    // Never zero: a page opened in a hidden tab has no size yet.
    const W = Math.max(1, Math.ceil(dw / scale));
    const H = Math.max(1, Math.ceil(dh / scale));
    if (W === this.W && H === this.H && scale === this.scale && dpr === this.dpr && this.buf.width === W * PX) return;
    this.dpr = dpr;
    this.fine = fine;
    this.scale = scale;
    this.W = W;
    this.H = H;
    this.FW = W * PX;
    this.FH = H * PX;
    this.view.width = CSS_SCALE ? this.FW : W * scale;
    this.view.height = CSS_SCALE ? this.FH : H * scale;
    this.view.style.width = `${(W * scale) / dpr}px`;
    this.view.style.height = `${(H * scale) / dpr}px`;
    this.buf.width = this.FW;
    this.buf.height = this.FH;
    // Resizing resets the context; everything draws in world pixels.
    this.g.setTransform(PX, 0, 0, PX, 0, 0);
    this.g.imageSmoothingEnabled = false;
    this.onResize?.();
  }

  present() {
    if (CSS_SCALE) return; // already on screen
    this.vctx.imageSmoothingEnabled = false;
    this.vctx.drawImage(this.buf, 0, 0, this.W * this.scale, this.H * this.scale);
  }

  // Client (CSS) coordinates -> world pixels on the screen.
  toInternal(cx: number, cy: number): [number, number] {
    return [(cx * this.dpr) / this.scale, (cy * this.dpr) / this.scale];
  }
}

// Draw in fine pixels, 1:1, from inside a world-pixel frame: `fn` gets the
// same context with the scale taken off but the translation kept, so the
// world point (x, y) is at fine (x * PX, y * PX). Round with toFine.
export function fine(g: CanvasRenderingContext2D, fn: (fg: CanvasRenderingContext2D) => void) {
  const m = g.getTransform();
  g.save();
  g.setTransform(1, 0, 0, 1, m.e, m.f);
  try {
    fn(g);
  } finally {
    g.restore();
  }
}

// A world coordinate on the fine grid: in fine pixels, and back in world
// pixels (for drawing a fine thing at a world position with drawImage).
export const toFine = (v: number) => Math.round(v * PX);
export const snapFine = (v: number) => Math.round(v * PX) / PX;

// An offscreen canvas. `density` PX makes it fine: w x h world pixels as
// w*PX x h*PX canvas pixels, drawn in world pixels (scale(PX) set); draw it
// back with drawImage(c, x, y, w, h).
export function makeCanvas(w: number, h: number, density = 1): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * density));
  c.height = Math.max(1, Math.ceil(h * density));
  const g = c.getContext('2d')!;
  if (density !== 1) g.setTransform(density, 0, 0, density, 0, 0);
  g.imageSmoothingEnabled = false;
  return [c, g];
}
