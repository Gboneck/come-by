import { CHAR } from '../palette';
import { makeCanvas } from './screen';

export interface Sprite {
  w: number;
  h: number;
  ax: number; // anchor (feet) inside the sprite
  ay: number;
  img: HTMLCanvasElement;
  flipImg: HTMLCanvasElement | null;
}

// One char per pixel; '.' or ' ' is transparent. See CHAR in palette.ts.
export function spr(rows: string[], ax?: number, ay?: number): Sprite {
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
  return { w, h, ax: ax ?? Math.floor(w / 2), ay: ay ?? h - 1, img, flipImg: null };
}

export function fromCanvas(img: HTMLCanvasElement, ax: number, ay: number): Sprite {
  return { w: img.width, h: img.height, ax, ay, img, flipImg: null };
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

// Draw with the anchor at (x, y). Flipping mirrors around the anchor column.
export function drawSpr(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, flip = false) {
  if (flip) {
    g.drawImage(flipped(s), Math.round(x) - (s.w - 1 - s.ax), Math.round(y) - s.ay);
  } else {
    g.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
  }
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
