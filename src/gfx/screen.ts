// Low-res internal buffer, scaled to the window by a whole number.
export const TARGET_SHORT = 240;

export class Screen {
  view: HTMLCanvasElement;
  vctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  W = TARGET_SHORT;
  H = TARGET_SHORT;
  scale = 1;
  dpr = 1;
  onResize: (() => void) | null = null;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.vctx = view.getContext('2d', { alpha: false })!;
    this.buf = document.createElement('canvas');
    this.g = this.buf.getContext('2d')!;
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
    const scale = Math.max(1, Math.round(Math.min(dw, dh) / TARGET_SHORT));
    // Never zero: a page opened in a hidden tab has no size yet.
    const W = Math.max(1, Math.ceil(dw / scale));
    const H = Math.max(1, Math.ceil(dh / scale));
    if (W === this.W && H === this.H && scale === this.scale && dpr === this.dpr && this.buf.width === W) return;
    this.dpr = dpr;
    this.scale = scale;
    this.W = W;
    this.H = H;
    this.view.width = W * scale;
    this.view.height = H * scale;
    this.view.style.width = `${(W * scale) / dpr}px`;
    this.view.style.height = `${(H * scale) / dpr}px`;
    this.buf.width = W;
    this.buf.height = H;
    this.g.imageSmoothingEnabled = false;
    this.onResize?.();
  }

  present() {
    this.vctx.imageSmoothingEnabled = false;
    this.vctx.drawImage(this.buf, 0, 0, this.W * this.scale, this.H * this.scale);
  }

  // Client (CSS) coordinates -> internal pixel coordinates.
  toInternal(cx: number, cy: number): [number, number] {
    return [(cx * this.dpr) / this.scale, (cy * this.dpr) / this.scale];
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
