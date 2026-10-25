import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import type { Drawable } from './buildings';
import { STACK_BALES, type Haystack } from '../ranch/structures';

// A haystack: a domed stack of bales that sinks as the winter eats it.
// (Gameplay drew this; Graphics may polish it.)
export function haystackDrawable(g: CanvasRenderingContext2D, h: Haystack): Drawable {
  return {
    y: h.y1 - 1,
    draw: () => {
      const x0 = h.x0 + 1, w = h.x1 - h.x0 - 2, base = h.y1 - 2;
      const full = Math.max(0, Math.min(1, h.bales / STACK_BALES));
      const tall = Math.max(2, Math.round(3 + full * 9));
      rect(g, x0 - 1, base + 1, w + 2, 1, C.sage);
      for (let i = 0; i < tall; i++) {
        // Rounded top: rows near the top are narrower.
        const k = tall - i;
        const inset = k <= 2 ? 3 - k + 1 : 0;
        const y = base - i;
        rect(g, x0 + inset, y, w - inset * 2, 1, i % 3 === 0 ? C.moss : C.butter);
        if (i % 3 === 1) for (let x = x0 + inset + 1; x < x0 + w - inset - 1; x += 3) px(g, x, y, C.wool);
      }
      // Binding twine across the stack.
      if (tall > 5) rect(g, x0 + 1, base - Math.floor(tall / 2), w - 2, 1, C.plum);
      if (h.bales <= 0) {
        // Just the frame left.
        rect(g, x0, base - 2, 1, 3, C.plum);
        rect(g, x0 + w - 1, base - 2, 1, 3, C.plum);
      }
    },
  };
}
