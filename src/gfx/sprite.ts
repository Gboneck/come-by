import { CHAR } from '../palette';
import { makeCanvas } from './screen';

export interface Sprite {
  w: number; // grid pixels
  h: number;
  ax: number; // anchor (feet) inside the sprite, in grid pixels
  ay: number;
  img: HTMLCanvasElement;
  flipImg: HTMLCanvasElement | null;
  // Grid pixels per world pixel: 1 (the default) or PX for a sprite drawn
  // in fine pixels. A dense sprite is w/d x h/d world pixels on screen and
  // lands on the fine grid.
  d?: number;
}

export interface SprOpts {
  density?: number; // grid pixels per world pixel (PX for fine art)
}

// One char per pixel; '.' or ' ' is transparent. See CHAR in palette.ts.
export function spr(rows: string[], ax?: number, ay?: number, o: SprOpts = {}): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const [img, g] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = CHAR[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  const s: Sprite = { w, h, ax: ax ?? Math.floor(w / 2), ay: ay ?? h - 1, img, flipImg: null };
  if (o.density && o.density !== 1) s.d = o.density;
  return s;
}

export function fromCanvas(img: HTMLCanvasElement, ax: number, ay: number, density = 1): Sprite {
  const s: Sprite = { w: img.width, h: img.height, ax, ay, img, flipImg: null };
  if (density !== 1) s.d = density;
  return s;
}

function flipped(s: Sprite): HTMLCanvasElement {
  if (!s.flipImg) {
    const [c, g] = makeCanvas(s.w, s.h);
    g.translate(s.w, 0);
    g.scale(-1, 1);
    g.drawImage(s.img, 0, 0);
    s.flipImg = c;
  }
  return s.flipImg;
}

// Draw with the anchor at world (x, y). Flipping mirrors around the anchor
// column. A dense sprite's anchor goes to the nearest fine pixel.
export function drawSpr(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, flip = false) {
  const d = s.d;
  if (!d) {
    if (flip) g.drawImage(flipped(s), Math.round(x) - (s.w - 1 - s.ax), Math.round(y) - s.ay);
    else g.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
    return;
  }
  const fx = Math.round(x * d) - (flip ? s.w - 1 - s.ax : s.ax), fy = Math.round(y * d) - s.ay;
  g.drawImage(flip ? flipped(s) : s.img, fx / d, fy / d, s.w / d, s.h / d);
}

// Recolour a sprite (e.g. a silhouette for night eyes or a flash).
export function tint(s: Sprite, color: string): Sprite {
  const [c, g] = makeCanvas(s.w, s.h);
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, s.w, s.h);
  return { ...s, img: c, flipImg: null };
}

// Size on screen in world pixels (a dense sprite's grid is finer).
export const sprW = (s: Sprite) => s.w / (s.d ?? 1);
export const sprH = (s: Sprite) => s.h / (s.d ?? 1);

// Top-left at world (x, y), blown up `k` times (k whole): previews, the
// title's dog, icons. Dense sprites keep their fine detail.
export function drawSprAt(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, k = 1, flip = false) {
  g.drawImage(flip ? flipped(s) : s.img, x, y, sprW(s) * k, sprH(s) * k);
}
