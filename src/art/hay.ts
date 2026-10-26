import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
import type { Drawable } from './buildings';
import { STACK_BALES, type Haystack } from '../ranch/structures';

// A haystack: a domed stack of bales that sinks as the winter eats it. On
// the fine grid: rows of bales, their twine, the stack's rounded shoulders,
// loose straw at its foot. (Gameplay drew it first; Graphics redrew it.)
export function haystackDrawable(g: CanvasRenderingContext2D, h: Haystack): Drawable {
  return {
    y: h.y1 - 1,
    draw: () => {
      fine(g, (fg) => {
        const X0 = (h.x0 + 1) * PX, Wd = (h.x1 - h.x0 - 2) * PX, B = (h.y1 - 2) * PX + 1;
        const full = Math.max(0, Math.min(1, h.bales / STACK_BALES));
        const tall = Math.max(4, Math.round((3 + full * 9) * PX));
        rect(fg, X0 - 2, B + 1, Wd + 4, 1, C.sage);
        for (let i = 0; i < tall; i++) {
          // Rounded top: rows near the top are narrower.
          const k = tall - i;
          const inset = k <= 5 ? Math.round((6 - k) * 1.2) : 0;
          const y = B - i;
          const row = Math.floor(i / 6);
          rect(fg, X0 + inset, y, Wd - inset * 2, 1, i % 6 === 0 ? C.moss : C.butter);
          if (i % 6 === 3) for (let x = X0 + inset + 2 + (row & 1) * 3; x < X0 + Wd - inset - 2; x += 6) px(fg, x, y, C.wool);
          // The bales' ends, staggered.
          if (i % 6 !== 0) for (let x = X0 + inset + 8 + (row & 1) * 6; x < X0 + Wd - inset - 2; x += 12) px(fg, x, y, C.moss);
          px(fg, X0 + inset, y, C.moss);
        }
        // Binding twine across the stack.
        if (tall > 10) rect(fg, X0 + 2, B - Math.floor(tall / 2), Wd - 4, 1, C.plum);
        for (const [wx, wy] of [[-3, 0], [Wd + 1, -1], [4, 2], [Wd - 6, 2]]) { px(fg, X0 + wx, B + wy, C.butter); px(fg, X0 + wx + 1, B + wy - 1, C.butter); }
        if (h.bales <= 0) {
          // Just the frame left.
          rect(fg, X0, B - 5, 2, 6, C.plum);
          rect(fg, X0 + Wd - 2, B - 5, 2, 6, C.plum);
        }
      });
    },
  };
}
