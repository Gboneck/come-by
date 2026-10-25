import { C } from '../palette';
import { makeDogSprites } from '../art/dog';
import { animalSprites } from '../art/animals';
import type { Sprite } from '../gfx/sprite';

// The app icon: the heeler on a round patch of meadow with a sheep behind
// her, drawn from the game's own sprites on the plum of the UI. A 32x32
// scene, scaled up by a whole number to each icon size (scripts/pwa.mjs
// renders the PNGs at build time).

export const ICON_GRID = 32;

// Draw the scene at `k` pixels per grid pixel, centred in a `size` square.
// `inset` shrinks it further (maskable icons keep a safe margin).
export function drawIcon(g: CanvasRenderingContext2D, size: number, inset = 0) {
  g.imageSmoothingEnabled = false;
  g.fillStyle = C.plum;
  g.fillRect(0, 0, size, size);
  const k = Math.max(1, Math.floor((size - inset * 2) / ICON_GRID));
  const o = Math.floor((size - ICON_GRID * k) / 2);
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(o + x * k, o + y * k, w * k, h * k);
  };
  const spr = (s: Sprite, x: number, y: number, m = 1) => g.drawImage(s.img, o + x * k, o + y * k, s.w * k * m, s.h * k * m);

  // The meadow: a disc of whole-pixel spans, a moss rim at the bottom.
  const cx = 15.5, cy = 15.5, r = 14;
  for (let y = 0; y < ICON_GRID; y++) {
    const dy = y + 0.5 - cy;
    if (Math.abs(dy) >= r) continue;
    const hw = Math.round(Math.sqrt(r * r - dy * dy));
    px(Math.round(cx - hw), y, hw * 2, 1, dy > r - 3 ? C.moss : C.meadow);
  }
  for (const [x, y] of [[20, 5], [23, 9], [26, 15], [5, 19], [14, 3]]) {
    px(x, y, 1, 2, C.moss);
    px(x + 2, y + 1, 1, 1, C.moss);
  }
  for (const [x, y] of [[18, 9], [25, 9], [24, 26], [6, 23]]) px(x, y, 1, 1, C.butter);

  // A sheep grazing behind, then the dog in front, each on its shadow.
  const sheep = animalSprites('sheep', 0).stand[0];
  const sx = 6, sy = 11 - sheep.h;
  px(sx + 1, sy + sheep.h, sheep.w - 1, 1, C.sage);
  spr(sheep, sx, sy);
  const dog = makeDogSprites('r').sideStand;
  const dx = 16 - dog.w, dy = 27 - dog.h * 2;
  px(dx + 3, dy + dog.h * 2, dog.w * 2 - 5, 1, C.sage);
  spr(dog, dx, dy, 2);
}
