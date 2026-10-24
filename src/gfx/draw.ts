import { C } from '../palette';

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(g: CanvasRenderingContext2D, x: number, y: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

// Bresenham line.
export function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  g.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Midpoint circle outline, optionally drawing only every `dash`-th step.
export function ring(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, dash = 0) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  if (r <= 0) return;
  g.fillStyle = color;
  let x = r, y = 0, err = 1 - r, i = 0;
  while (x >= y) {
    if (!dash || (i++ % dash) < dash / 2) {
      g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx + y, cy + x, 1, 1);
      g.fillRect(cx - y, cy + x, 1, 1); g.fillRect(cx - x, cy + y, 1, 1);
      g.fillRect(cx - x, cy - y, 1, 1); g.fillRect(cx - y, cy - x, 1, 1);
      g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx + x, cy - y, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

// Filled axis-aligned ellipse built from horizontal spans (crisp edges).
export function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  g.fillStyle = color;
  cx = Math.round(cx); cy = Math.round(cy);
  const iry = Math.max(0, Math.round(ry));
  for (let dy = -iry; dy <= iry; dy++) {
    const t = iry === 0 ? 0 : dy / (ry + 0.5);
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ellipse(g, cx, cy, r, r, color);
}

// UI panel: plum fill, sage rim, cut corners.
export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string = C.plum, rim: string = C.sage) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.fillStyle = rim;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = fill;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
}

// 4x4 Bayer matrix, thresholds 0..15.
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Ordered-dither fill of a rect: level 0 = nothing, 16 = solid.
export function ditherRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, level: number, color: string) {
  g.fillStyle = color;
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i, py = y + j;
      if (BAYER4[(py & 3) * 4 + (px & 3)] < level) g.fillRect(px, py, 1, 1);
    }
  }
}
