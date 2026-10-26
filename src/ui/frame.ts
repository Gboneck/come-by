import { C } from '../palette';
import { BAYER4 } from '../gfx/draw';
import { heading, headingWidth } from '../gfx/font';

// The UI's frames, drawn a pixel row at a time like everything else.
//
// panel(): the everyday frame, same call as the old one in gfx/draw.ts. A
// plum outline with cut corners, a bevel inside it (light along the top and
// left, shade along the bottom and right), then the fill. A butter `rim`
// makes it a gilt frame for what wants attention; big panels get rivets.
//
// paper(): a sheet of wool paper with a plum edge, a sage shadow and ruled
// lines: the journal (end of day) and the Ledger's pages.

const SHADE: Record<string, [string, string]> = {
  [C.sage]: [C.sage, C.teal],
  [C.butter]: [C.butter, C.moss],
  [C.plum]: [C.plum, C.plum],
  [C.teal]: [C.sage, C.teal],
  [C.wool]: [C.wool, C.sage],
};

export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string = C.plum, rim: string = C.sage) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 4 || h < 4) {
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
    return;
  }
  // A wool card with a plum rim (speech bubbles) is paper: a single plum
  // edge with a sage shade inside the bottom and right.
  const [hi, lo] = fill === C.wool && rim === C.plum ? [C.wool, C.sage] : SHADE[rim] ?? [rim, rim];
  // Outline, corners cut.
  g.fillStyle = C.plum;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  // Bevel: light top and left, shade bottom and right.
  g.fillStyle = lo;
  g.fillRect(x + 2, y + h - 2, w - 3, 1);
  g.fillRect(x + w - 2, y + 2, 1, h - 3);
  g.fillStyle = hi;
  g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillRect(x + 1, y + 2, 1, h - 4);
  // Fill.
  g.fillStyle = fill;
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Rivets on the big frames.
  if (w >= 60 && h >= 34) {
    g.fillStyle = rim === C.butter ? C.wool : C.butter;
    for (const [px, py] of [[x + 3, y + 3], [x + w - 4, y + 3], [x + 3, y + h - 4], [x + w - 4, y + h - 4]]) g.fillRect(px, py, 1, 1);
  }
}

// A sheet of paper. `lines` rules it every that many pixels from `top`.
export function paper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { lines?: number; top?: number; margin?: boolean } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // Shadow cast down and right.
  g.fillStyle = C.sage;
  g.fillRect(x + 2, y + h, w - 1, 1);
  g.fillRect(x + w, y + 2, 1, h - 1);
  // Edge and sheet.
  g.fillStyle = C.plum;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = C.wool;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Ruled lines, and a margin rule down the left.
  if (opts.lines) {
    g.fillStyle = C.sage;
    for (let ly = y + (opts.top ?? 14); ly < y + h - 3; ly += opts.lines)
      for (let lx = x + 3; lx < x + w - 3; lx += 3) g.fillRect(lx, ly, 1, 1);
  }
  if (opts.margin) {
    g.fillStyle = C.teal;
    g.fillRect(x + 9, y + 2, 1, h - 4);
  }
  // The paper's grain: a few sage flecks, the same every frame.
  g.fillStyle = C.sage;
  for (let i = 0; i < (w * h) / 900; i++) {
    const fx = x + 2 + ((i * 37 + w * 7) % (w - 4)), fy = y + 2 + ((i * 53 + h * 3) % (h - 4));
    g.fillRect(fx, fy, 1, 1);
  }
}

// A heading on a ribbon of its own, with notched tails: the title of a big
// frame, sitting across its top edge.
export function titleRibbon(g: CanvasRenderingContext2D, label: string, cx: number, y: number, fill: string = C.teal, ink: string = C.butter) {
  const w = headingWidth(label) + 12;
  const x = Math.round(cx - w / 2);
  g.fillStyle = C.plum;
  g.fillRect(x - 1, y - 1, w + 2, 11);
  // Tails, folded behind.
  for (const tx of [x - 6, x + w + 1]) {
    g.fillStyle = C.plum;
    g.fillRect(tx, y + 1, 5, 9);
    g.fillStyle = C.teal;
    g.fillRect(tx + 1, y + 2, 3, 7);
    g.fillStyle = C.plum;
    g.fillRect(tx === x - 6 ? tx + 1 : tx + 3, y + 5, 1, 1);
  }
  g.fillStyle = fill;
  g.fillRect(x, y, w, 9);
  g.fillStyle = C.sage;
  g.fillRect(x, y, w, 1);
  heading(g, label, cx, y + 1, ink, { align: 'center', shade: ink === C.butter ? C.moss : undefined });
}

// A dotted divider.
export function rule(g: CanvasRenderingContext2D, x: number, y: number, w: number, color: string = C.sage) {
  g.fillStyle = color;
  for (let i = 0; i < w; i += 2) g.fillRect(Math.round(x + i), Math.round(y), 1, 1);
}

// A rubber stamp: a double-ruled box round a heading, inked unevenly (a
// fixed scatter of the frame's pixels left out), as if pressed by hand.
export function stamp(g: CanvasRenderingContext2D, label: string, cx: number, cy: number, ink: string, scale = 1, backed = false) {
  const w = headingWidth(label, scale) + 12, h = 7 * scale + 10;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  const dot = (px: number, py: number) => { if (BAYER4[((py & 3) << 2) | (px & 3)] < 13) g.fillRect(px, py, 1, 1); };
  // A plum wash behind it, dithered, so it reads on grass or snow.
  if (backed) {
    g.fillStyle = C.plum;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (BAYER4[(((y + j) & 3) << 2) | ((x + i) & 3)] < 9) g.fillRect(x + i, y + j, 1, 1);
  }
  g.fillStyle = ink;
  for (let i = 0; i < w; i++) { dot(x + i, y); dot(x + i, y + h - 1); }
  for (let j = 0; j < h; j++) { dot(x, y + j); dot(x + w - 1, y + j); }
  for (let i = 2; i < w - 2; i++) { dot(x + i, y + 2); dot(x + i, y + h - 3); }
  for (let j = 2; j < h - 2; j++) { dot(x + 2, y + j); dot(x + w - 3, y + j); }
  heading(g, label, cx, y + 5, ink, backed ? { align: 'center', scale, outline: C.plum, shade: C.moss } : { align: 'center', scale });
}
