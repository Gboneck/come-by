import { C } from '../palette';
import { ROOFS, TRIMS, farmLook } from './ranchstyle';
import { line, rect, px } from '../gfx/draw';
import { hash2 } from '../rng';
import { lightLook, seasonLook, snowCap } from './seasonlook';
import { PX, fine, makeCanvas } from '../gfx/screen';
import type { Building, RegionGate } from '../ranch/buildings';
import type { FieldGate, Fence, Barn, Kennel, Market, Windmill } from '../ranch/structures';
import { CS } from '../world/map';

export interface Drawable {
  y: number;
  draw: () => void;
}

// Buildings stand up a little (3/4 view) and are lit from the upper right:
// shadows fall down-left on the ground, left-hand faces are shaded. Each
// building's ground shadow is its own drawable sorted first, so it never
// lands on anything standing in front of it.
const shadowFirst = (b: Building, draw: () => void): Drawable => ({ y: -1e8 + b.id, draw });

// A standing thing's shadow on the ground: its silhouette (x0..x1 across,
// top..y1 tall) shifted the way the sun throws it (long and to the west at
// sunrise, east in the golden hour), and a soft dithered contact shadow
// hugging its foot.
export function groundShadow(g: CanvasRenderingContext2D, x0: number, top: number, x1: number, y1: number) {
  const sx = Math.round(lightLook.dx * 0.8), sy = Math.round(lightLook.dy * 0.5);
  rect(g, x0 + sx, top + sy, x1 - x0, y1 - top, C.sage);
  for (let x = x0 - 1; x <= x1; x++) {
    px(g, x, y1, C.sage);
    if ((x & 1) === 0) px(g, x, y1 + 1, C.sage);
  }
}

// ---- Fences ----
// Plum posts every 8px, wool rails, a sage line of shadow on the ground.
// They are not new: posts differ a little in height, some caps have greyed,
// a rail has the odd knot. An upgraded (sturdy) fence has thick capped posts
// on stone footings and a third rail.

// Rails are pale wood; in snow they show dark and wet against the white.
export const railCol = (): string => (seasonLook.snow > 0.4 ? C.sage : C.wool);

export const postH = (x: number, y: number) => (hash2(x, y, 401) < 0.22 ? 5 : 6);
export const postCap = (x: number, y: number) => (seasonLook.snow > 0.4 ? C.wool : hash2(x, y, 402) < 0.3 ? C.sage : C.moss);

// Fences are drawn on the fine grid (world coordinates in, fine pixels
// out): slim posts lit on their right side under a weathered cap, round
// rails with a pale top and a shadowed underside, a thin shadow on the
// ground. A sturdy (upgraded) fence has thicker capped posts on stone
// footings and a third rail.
export function postF(fg: CanvasRenderingContext2D, X: number, B: number, h: number, cap: string, sturdy: boolean, heavy = false) {
  const w = sturdy || heavy ? 4 : 3;
  const H = h * PX + (sturdy ? 2 : heavy ? 1 : 0);
  rect(fg, X, B - H + 1, w, H, C.plum);
  rect(fg, X + w - 1, B - H + 2, 1, H - 2, C.sage);
  rect(fg, X, B - H + 1, w, sturdy ? 2 : 1, cap);
  if (sturdy || heavy) {
    // A stone at its foot.
    rect(fg, X - 1, B, w + 2, 1, C.sage);
    px(fg, X - 1, B - 1, C.wool);
  }
  px(fg, X + w, B, C.sage);
}

export function post(g: CanvasRenderingContext2D, x: number, base: number, sturdy: boolean) {
  const cap = sturdy || seasonLook.snow > 0.4 ? C.wool : postCap(x, base);
  fine(g, (fg) => postF(fg, x * PX, base * PX + 1, sturdy ? 6 : postH(x, base), cap, sturdy));
}

// A rail along x from X0 to X1 (fine) with its top at row Y: pale on top,
// shadowed underneath, a knot or a grey streak here and there.
export function railF(fg: CanvasRenderingContext2D, X0: number, X1: number, Y: number, seed: number) {
  if (X1 <= X0) return;
  const top = seasonLook.snow > 0.4 ? C.wool : C.wool;
  rect(fg, X0, Y, X1 - X0, 1, top);
  rect(fg, X0, Y + 1, X1 - X0, 1, C.sage);
  for (let x = X0 + 2; x < X1 - 1; x += 5) {
    const h = hash2(x >> 2, seed, 404);
    if (h < 0.1) px(fg, x, Y, C.plum); // a knot
    else if (h < 0.18) rect(fg, x, Y, 3, 1, C.sage); // weathered grey
  }
}

export function hFence(g: CanvasRenderingContext2D, xa: number, xb: number, base: number, gap?: [number, number], sturdy = false) {
  fine(g, (fg) => {
    const B = base * PX + 1;
    const X0 = xa * PX, X1 = (xb + 1) * PX;
    const G0 = gap ? (gap[0] + 1) * PX : 0, G1 = gap ? gap[1] * PX : 0;
    const span = (fn: (a: number, b: number) => void) => {
      if (!gap) fn(X0, X1);
      else { fn(X0, Math.min(X1, G0)); fn(Math.max(X0, G1), X1); }
    };
    span((a, b) => rect(fg, a, B + 1, b - a, 1, C.sage));
    span((a, b) => { railF(fg, a, b, B - 5, base); railF(fg, a, b, B - 9, base + 1); if (sturdy) railF(fg, a, b, B - 13, base + 2); });
    for (let x = xa; x <= xb; x += 8) {
      if (gap && x > gap[0] && x < gap[1]) continue;
      const cap = sturdy || seasonLook.snow > 0.4 ? C.wool : postCap(x, base);
      postF(fg, x * PX, B, sturdy ? 6 : postH(x, base), cap, sturdy);
    }
    if (gap) {
      postF(fg, gap[0] * PX, B, 6, C.wool, sturdy, true);
      postF(fg, (gap[1] - 1) * PX, B, 6, C.wool, sturdy, true);
    }
  });
}

// One post and the rails down to the next post of a north-south fence: the
// rails seen from above as two pale lines (the upper one set higher), their
// shade beside them, a shadow on the ground.
export function vRailsF(fg: CanvasRenderingContext2D, X: number, Ya: number, Yb: number, sturdy: boolean, seed: number) {
  const n = Yb - Ya;
  if (n <= 0) return;
  rect(fg, X + 4, Ya - 2, 1, n, C.sage);
  rect(fg, X + 1, Ya - 9, 1, n, C.wool);
  rect(fg, X + 2, Ya - 8, 1, n, C.sage);
  rect(fg, X + 2, Ya - 5, 1, n, C.wool);
  rect(fg, X + 3, Ya - 4, 1, n, C.sage);
  if (sturdy) rect(fg, X, Ya - 13, 1, n, C.wool);
  const k = Ya + Math.floor(hash2(X, seed, 405) * (n - 2));
  if (hash2(X, seed, 406) < 0.4) px(fg, X + 2, k - 5, C.plum);
}

export function vFenceSeg(g: CanvasRenderingContext2D, x: number, ya: number, yb: number, rail = true, sturdy = false) {
  fine(g, (fg) => {
    const X = x * PX, Ya = ya * PX + 1, Yb = yb * PX + 1;
    if (rail) vRailsF(fg, X, Ya, Yb, sturdy, ya);
    const cap = sturdy || seasonLook.snow > 0.4 ? C.wool : postCap(x, ya);
    postF(fg, X, Ya, sturdy ? 6 : postH(x, ya), cap, sturdy);
  });
}

// A gate leaf swinging outward about its hinge. `along` is the unit vector
// along the fence from the hinge, `outward` points out of the pen. On the
// fine grid: two rails and a brace, a stile at the free end with a latch.
export function gateLeaf(g: CanvasRenderingContext2D, hx: number, hy: number, along: [number, number], outward: [number, number], len: number, swing: number, flash: number) {
  const a = swing * Math.PI * 0.5;
  const ex = hx + len * (along[0] * Math.cos(a) + outward[0] * Math.sin(a));
  const ey = hy + len * (along[1] * Math.cos(a) + outward[1] * Math.sin(a));
  fine(g, (fg) => {
    const HX = Math.round(hx * PX) + 1, HY = Math.round(hy * PX) + 1;
    const EX = Math.round(ex * PX) + 1, EY = Math.round(ey * PX) + 1;
    line(fg, HX, HY + 1, EX, EY + 1, C.sage);
    for (const off of [5, 9]) {
      line(fg, HX, HY - off, EX, EY - off, C.wool);
      line(fg, HX, HY - off + 1, EX, EY - off + 1, C.sage);
    }
    // The brace, from the foot at the hinge to the top rail at the latch.
    line(fg, HX, HY - 5, EX, EY - 9, C.wool);
    rect(fg, EX - 1, EY - 11, 2, 12, C.plum);
    px(fg, EX, EY - 10, C.sage);
    const ux = (EX - HX) / Math.max(1, len * PX), uy = (EY - HY) / Math.max(1, len * PX);
    for (const off of [5, 9]) {
      px(fg, HX + ux * 2, HY - off + uy * 2, C.plum);
      px(fg, HX + ux * 3, HY - off + uy * 3, C.plum);
    }
    px(fg, EX - ux * 3, EY - 7 - uy, C.butter);
    if (flash > 0 && Math.floor(flash * 12) % 2 === 0) {
      px(fg, EX + 2, EY - 13, C.butter);
      px(fg, EX - 3, EY - 15, C.butter);
      px(fg, EX + 4, EY - 9, C.butter);
    }
  });
}

// Pens and paddocks: drawn in paddock.ts (re-exported here for older imports).
export { penDrawables } from './paddock';

// Tiny goods: egg, wool tuft, cheese wedge, milk can.
export function drawGood(g: CanvasRenderingContext2D, sp: string, x: number, y: number) {
  switch (sp) {
    case 'duck':
      rect(g, x, y, 2, 2, C.wool);
      px(g, x, y + 2, C.sage);
      break;
    case 'sheep':
      rect(g, x, y + 1, 3, 2, C.wool);
      px(g, x + 1, y, C.wool);
      break;
    case 'goat':
      rect(g, x, y + 1, 3, 2, C.butter);
      px(g, x, y, C.butter);
      px(g, x + 1, y + 2, C.plum);
      break;
    case 'cow':
      rect(g, x, y, 2, 3, C.wool);
      rect(g, x, y, 2, 1, C.plum);
      break;
  }
}

// ---- Shared pieces ----

// A hipped roof seen from the front: plum, staggered teal shingle courses,
// a sage ridge, the right hip catching the light and the left in shade.
export function hipRoof(g: CanvasRenderingContext2D, xa: number, xb: number, top: number, eave: number, hip: number, base: string = C.plum, course: string = C.teal) {
  // Drawn on the fine grid: shingle courses every four fine rows, their
  // joints staggered, the left edge in shade and the right hip catching the
  // light, cushions of moss on the shady lower courses, snow in winter.
  fine(g, (fg) => {
    const A = xa * PX, B = xb * PX, T = top * PX, E = eave * PX, HP = hip * PX;
    const rh = E - T;
    const insetAt = (k: number) => Math.round(HP * (1 - k / Math.max(1, rh - 1)));
    for (let y = T; y < E; y++) {
      const k = y - T;
      const a = A + insetAt(k), b = B - insetAt(k);
      rect(fg, a, y, b - a, 1, base);
      const c = E - 1 - y;
      const band = Math.floor(c / 4);
      if (k > 1 && c > 0) {
        if (c % 4 === 0) rect(fg, a + 1, y, b - a - 2, 1, course);
        else if (c % 4 === 2) for (let x = a + 3; x < b - 3; x++) if ((x + band * 7 + Math.floor(hash2(band, x >> 4, 426) * 5)) % 14 === 0) px(fg, x, y, course);
      }
      px(fg, a, y, C.plum);
      if (k > 0) px(fg, b - 1, y, C.sage);
    }
    rect(fg, A + HP, T, B - A - HP * 2, 1, C.sage);
    rect(fg, A + HP, T + 1, B - A - HP * 2, 1, base);
    rect(fg, A, E - 1, B - A, 1, C.plum);
    // Moss: soft cushions on the shady lower courses, not specks.
    for (let band = 0; band < 2; band++) {
      const y = E - 3 - band * 4;
      for (let x = A + 2; x < B - 6; x += 7) {
        const shade = 1 - (x - A) / (B - A);
        if (hash2(x, band, 420) > 0.75 * shade - band * 0.2) continue;
        const w = 3 + Math.floor(hash2(x, band, 421) * 3);
        rect(fg, x, y, w, 1, C.moss);
        rect(fg, x + 1, y - 1, Math.max(1, w - 2), 1, C.moss);
      }
    }
    // Winter: snow on the upper roof, the courses showing through as sage,
    // its lower edge in soft lumps; icicles along the eaves.
    const sn = seasonLook.snow;
    if (sn > 0.2) {
      const depth = Math.round(rh * (0.2 + sn * 0.6));
      for (let y = T; y < Math.min(E - 2, T + depth + 2); y++) {
        const k = y - T;
        const a = A + insetAt(k), b = B - insetAt(k);
        const c = E - 1 - y;
        // In runs, not pixel by pixel (this is recorded every frame).
        const line = k > 2 && c % 4 === 0;
        let run = -1;
        for (let x = a; x <= b; x++) {
          const on = x < b && (k < depth || Math.sin(x * 0.45) + Math.sin(x * 0.17 + 1) >= (k - depth) * 1.2 - 0.4);
          if (on && run < 0) run = x;
          else if (!on && run >= 0) {
            rect(fg, run, y, x - run, 1, line ? C.sage : C.wool);
            if (line) { px(fg, run, y, C.wool); px(fg, x - 1, y, C.wool); }
            run = -1;
          }
        }
      }
    }
  });
  if (seasonLook.snow > 0.2) snowCap(g, xa, eave - 1, xb - xa, eave);
}

// A window with a plum frame, mullions, slatted shutters, a sill and a glint
// on the glass by day; lit buttercup at night. Drawn on the fine grid.
export function windowAt(g: CanvasRenderingContext2D, wx: number, wy: number, night: boolean, w = 5, h = 3, shutters = true, trim: string = C.sage) {
  fine(g, (fg) => {
    const X = wx * PX, Y = wy * PX, Wd = w * PX, Hd = h * PX;
    rect(fg, X - 2, Y - 2, Wd + 4, 1, trim);
    rect(fg, X - 1, Y - 1, Wd + 2, Hd + 2, C.plum);
    rect(fg, X, Y, Wd, Hd, night ? C.butter : C.teal);
    const mx = X + (Wd >> 1);
    rect(fg, mx, Y, 1, Hd, C.plum);
    if (Hd >= 6) rect(fg, X, Y + (Hd >> 1), Wd, 1, C.plum);
    if (!night) {
      // A glint in the upper right pane, and the sky's pale reflection.
      px(fg, X + Wd - 2, Y + 1, C.wool);
      px(fg, X + Wd - 3, Y + 2, C.wool);
      rect(fg, X + 1, Y + Hd - 1, (Wd >> 1) - 2, 1, C.sage);
    } else {
      px(fg, X + 1, Y + 1, C.wool);
      px(fg, mx + 1, Y + 1, C.wool);
    }
    rect(fg, X - 2, Y + Hd + 1, Wd + 4, 1, C.wool);
    rect(fg, X - 1, Y + Hd + 2, Wd + 2, 1, C.sage);
    if (shutters) {
      for (const sx of [X - 5, X + Wd + 2]) {
        rect(fg, sx, Y - 1, 3, Hd + 2, trim);
        for (let y = Y; y < Y + Hd; y += 2) px(fg, sx + 1, y, C.plum);
      }
    }
  });
}

// Brick chimney with a sage cap: courses of brick on the fine grid.
export function chimney(g: CanvasRenderingContext2D, x: number, top: number, h: number) {
  fine(g, (fg) => {
    const X = x * PX, T = top * PX, Hh = h * PX;
    rect(fg, X, T, 8, Hh, C.plum);
    for (let y = T + 3; y < T + Hh - 1; y++) {
      const r = (y - T) % 3;
      if (r === 2) rect(fg, X + 1, y, 6, 1, C.sage);
      else if (r === 0) px(fg, X + (Math.floor((y - T) / 3) & 1 ? 2 : 5), y, C.sage);
    }
    rect(fg, X + 7, T + 2, 1, Hh - 2, C.teal);
    rect(fg, X - 2, T, 12, 2, C.sage);
    rect(fg, X - 2, T + 2, 12, 1, C.plum);
  });
  snowCap(g, x - 1, top - 1, 6);
}

// ---- Farmhouse: a whitewashed cabin that grows with the ranch. ----
// Tier 1: a cabin. 2: flower boxes, a door hood, a stone path. 3: a second
// storey with dormers. 4: a porch and the flag. 5: a second chimney, a
// weathervane and lamps by the door.

const FH_TOP = (b: Building) => b.y0 - (b.level >= 3 ? 12 : 7);

// The farmhouse's lit windows at night, as rects (x, y, w, h), for the glow
// drawn round them above the dark (render/world.ts). Matches drawFarmhouse.
export function farmhouseWindows(b: Building): [number, number, number, number][] {
  const x0 = b.x0, x1 = b.x1, y1 = b.y1, two = b.level >= 3;
  const eave = y1 - (two ? 18 : 11), wy = y1 - 8;
  const out: [number, number, number, number][] = [];
  for (const wx of two ? [x0 + 5, x0 + 17, x1 - 22, x1 - 10] : [x0 + 5, x1 - 10]) out.push([wx, wy, 5, 3]);
  if (two) for (const wx of [x0 + 6, x0 + 18, x1 - 21, x1 - 9]) out.push([wx, eave + 3, 4, 3]);
  return out;
}

// A soft glow round a lit window, drawn above the night: a dithered ring of
// buttercup that fades out from the frame.
const glows = new Map<string, HTMLCanvasElement>();
export function windowGlow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  const fl = Math.sin(t * 5 + x) > 0.85 ? 1 : 0;
  // A dithered halo, close round the frame and thinning out: drawn once per
  // size into a little picture.
  const key = `${w},${h},${fl}`;
  let c = glows.get(key);
  if (!c) {
    const Wd = w * PX, Hd = h * PX;
    const cw = Wd + 12, ch = Hd + 12;
    const [cc, cg] = makeCanvas(cw, ch);
    cg.fillStyle = C.butter;
    for (let yy = 0; yy < ch; yy++)
      for (let xx = 0; xx < cw; xx++) {
        const X = xx - 6, Y = yy - 6;
        const d = Math.max(-1 - X, X - Wd, -1 - Y, Y - Hd);
        if (d < 1) continue;
        const ax = xx, ay = yy;
        const on = d <= 2 ? ((ax + ay) & 1) === 0 : d <= 4 + fl ? (ax & 1) === 0 && (ay & 1) === 0 && ((ax + ay) & 3) === 0 : false;
        if (on) cg.fillRect(xx, yy, 1, 1);
      }
    glows.set(key, (c = cc));
  }
  fine(g, (fg) => fg.drawImage(c!, x * PX - 6, y * PX - 6));
}

// Where the chimney smoke leaves the farmhouse (see render/life.ts).
export function chimneyTop(b: Building): { x: number; y: number } {
  return { x: b.x1 - 10, y: FH_TOP(b) - 6 };
}

export function farmhouseDrawable(g: CanvasRenderingContext2D, b: Building, night: boolean, t = 0): Drawable[] {
  return [
    shadowFirst(b, () => groundShadow(g, b.x0, FH_TOP(b) + 3, b.x1, b.y1)),
    { y: b.y1, draw: () => drawFarmhouse(g, b, night, t) },
  ];
}

function drawFarmhouse(g: CanvasRenderingContext2D, b: Building, night: boolean, t: number) {
  const lvl = b.level;
  const x0 = b.x0, x1 = b.x1, y1 = b.y1;
  const w = x1 - x0;
  const two = lvl >= 3;
  const wallH = two ? 18 : 11;
  const roofTop = FH_TOP(b);
  const eave = y1 - wallH;
  const roof = ROOFS[farmLook.roof], trim = TRIMS[farmLook.trim].color;
  const doorX = x0 + Math.floor(w / 2) - 3;
  const lower = two ? [x0 + 5, x0 + 17, x1 - 22, x1 - 10] : [x0 + 5, x1 - 10];

  // Walls, on the fine grid: whitewashed clapboard, the left corner board
  // and the band under the eave in shade, a footing of laid stones, damp and
  // moss at the shady corner, a drainpipe down the right.
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX, E = eave * PX, WH = wallH * PX;
    rect(fg, X0 + 2, E, X1 - X0 - 4, WH, C.wool);
    for (let y = E + 5; y < Y1 - 5; y += 4) {
      rect(fg, X0 + 4, y, X1 - X0 - 8, 1, C.sage);
      // The boards' butt joints, staggered.
      for (let x = X0 + 10 + ((y >> 2) % 3) * 9; x < X1 - 8; x += 27) px(fg, x, y - 1, C.sage);
    }
    rect(fg, X0 + 2, E, 2, WH, C.sage);
    rect(fg, X1 - 4, E, 1, WH, C.sage);
    rect(fg, X0 + 2, E, X1 - X0 - 4, 2, C.sage);
    if (two) rect(fg, X0 + 2, E + 18, X1 - X0 - 4, 2, C.sage); // floor line
    // Footing: laid stones, sage with a pale top edge and plum joints.
    const F0 = Y1 - 5;
    rect(fg, X0 + 2, F0, X1 - X0 - 4, 5, C.sage);
    for (let row = 0; row < 2; row++) {
      const y = F0 + row * 3;
      rect(fg, X0 + 2, y, X1 - X0 - 4, 1, C.plum);
      for (let x = X0 + 2 + (row ? 3 : 0); x < X1 - 3; x += 6 + (hash2(x, row, 432) < 0.5 ? 1 : 0)) {
        px(fg, x, y + 1, C.plum);
        px(fg, x, y + 2, C.plum);
        px(fg, x + 1, y + 1, C.wool);
      }
    }
    // Damp and moss gathered at the shady left corner of the footing.
    for (let x = X0 + 3; x < X0 + (X1 - X0) * 0.45; x += 5) {
      if (hash2(x, y1, 430) > 0.7 - (x - X0) / (X1 - X0)) continue;
      rect(fg, x, F0 - 1, 3, 1, C.moss);
      px(fg, x + 1, F0 - 2, C.moss);
    }
    // Drainpipe with its shoe.
    rect(fg, X1 - 7, E + 2, 2, Y1 - E - 6, C.sage);
    rect(fg, X1 - 7, E + 2, 1, Y1 - E - 6, C.plum);
    rect(fg, X1 - 8, Y1 - 4, 4, 2, C.plum);

    // The door: a panelled plum door in its frame, a brass knob, a step.
    const DX = doorX * PX;
    rect(fg, DX - 2, Y1 - 20, 16, 20, trim);
    rect(fg, DX, Y1 - 18, 12, 18, C.plum);
    for (const [px0, py0] of [[DX + 2, Y1 - 16], [DX + 7, Y1 - 16], [DX + 2, Y1 - 8], [DX + 7, Y1 - 8]]) {
      rect(fg, px0, py0, 3, 6, C.teal);
      rect(fg, px0, py0, 3, 1, C.sage);
    }
    px(fg, DX + 9, Y1 - 10, C.butter);
    px(fg, DX + 10, Y1 - 10, C.wool);
    rect(fg, DX - 3, Y1, 18, 1, C.wool);
    rect(fg, DX - 2, Y1 + 1, 16, 1, C.sage);
    if (lvl >= 2 && lvl < 4) {
      // Door hood on brackets.
      rect(fg, DX - 6, Y1 - 25, 24, 4, C.teal);
      rect(fg, DX - 6, Y1 - 25, 24, 1, C.sage);
      for (let x = DX - 5; x < DX + 17; x += 3) px(fg, x, Y1 - 23, C.sage);
      rect(fg, DX - 6, Y1 - 21, 24, 1, C.plum);
      for (const bx of [DX - 4, DX + 15]) {
        px(fg, bx, Y1 - 20, C.plum);
        px(fg, bx + (bx < DX ? 1 : -1), Y1 - 19, C.plum);
      }
    }
  });

  // Roof and chimneys (the roof and trim are the player's choice).
  hipRoof(g, x0 - 2, x1 + 2, roofTop, eave, two ? 7 : 5, roof.base, roof.course);
  chimney(g, x1 - 12, roofTop - 5, 8);
  if (lvl >= 5) chimney(g, x0 + 7, roofTop - 4, 7);
  // Dormers on the bigger house: a little gable with a window.
  if (two) {
    fine(g, (fg) => {
      const dy = (roofTop + 9) * PX;
      for (const dxw of [x0 + 13, x1 - 22]) {
        const DXd = dxw * PX;
        for (let r = 0; r < 6; r++) {
          const half = 3 + r * 1.5;
          rect(fg, Math.round(DXd + 9 - half), dy - 6 + r, Math.round(half * 2), 1, r === 0 ? C.sage : roof.base);
          px(fg, Math.round(DXd + 9 + half) - 1, dy - 6 + r, C.sage);
        }
        rect(fg, DXd + 2, dy, 14, 10, C.wool);
        rect(fg, DXd + 2, dy, 2, 10, C.sage);
        rect(fg, DXd + 5, dy + 2, 7, 7, C.plum);
        rect(fg, DXd + 6, dy + 3, 5, 5, night ? C.butter : C.teal);
        rect(fg, DXd + 8, dy + 3, 1, 5, C.plum);
        if (!night) px(fg, DXd + 10, dy + 3, C.wool);
        rect(fg, DXd, dy + 10, 18, 2, C.plum);
      }
    });
  }

  // Windows, and flower boxes under the lower ones.
  const wy = y1 - 8;
  for (const wx of lower) windowAt(g, wx, wy, night, 5, 3, true, trim);
  if (two) for (const wx of [x0 + 6, x0 + 18, x1 - 21, x1 - 9]) windowAt(g, wx, eave + 3, night, 4, 3, true, trim);
  fine(g, (fg) => {
    const Y1 = y1 * PX;
    if (lvl >= 2) {
      for (const wx of lower) {
        const X = wx * PX;
        rect(fg, X - 2, Y1 - 6, 14, 3, C.plum);
        rect(fg, X - 2, Y1 - 6, 14, 1, trim);
        for (let k = 0; k < 4; k++) {
          const fx = X - 1 + k * 3 + (k > 1 ? 1 : 0);
          px(fg, fx, Y1 - 7, C.moss);
          px(fg, fx + 1, Y1 - 7, C.moss);
          px(fg, fx, Y1 - 8, k % 2 ? C.wool : C.butter);
          if (k % 2 === 0) px(fg, fx + 1, Y1 - 9, C.butter);
        }
      }
    }
    // Porch: a teal roof on posts along the front, a boarded floor.
    if (lvl >= 4) {
      const PA = (doorX - 7) * PX, PB = (doorX + 14) * PX;
      rect(fg, PA, Y1 - 27, PB - PA, 5, C.teal);
      rect(fg, PA, Y1 - 27, PB - PA, 1, C.sage);
      for (let x = PA + 2; x < PB - 2; x += 4) rect(fg, x, Y1 - 26, 1, 3, C.sage);
      rect(fg, PA, Y1 - 22, PB - PA, 1, C.plum);
      for (const x of [PA + 2, PB - 4]) {
        rect(fg, x, Y1 - 21, 2, 21, C.plum);
        rect(fg, x + 1, Y1 - 21, 1, 21, C.sage);
      }
      rect(fg, PA, Y1, PB - PA, 2, C.wool);
      for (let x = PA + 5; x < PB; x += 6) px(fg, x, Y1, C.sage);
      rect(fg, PA, Y1 + 2, PB - PA, 1, C.sage);
    }
    // Lamps either side of the door.
    if (lvl >= 5) {
      for (const lx of [doorX - 3, doorX + 8]) {
        const X = lx * PX;
        rect(fg, X, Y1 - 17, 1, 2, C.plum);
        rect(fg, X - 1, Y1 - 15, 3, 4, C.plum);
        rect(fg, X, Y1 - 14, 1, 2, night || Math.floor(t * 2) % 7 === 0 ? C.butter : C.wool);
      }
    }
    // The flag on the ridge.
    if (lvl >= 4) {
      const FX = (x0 + 26) * PX, FT = (roofTop - 10) * PX;
      rect(fg, FX, FT, 1, 20, C.plum);
      px(fg, FX, FT - 1, C.butter);
      const wave = Math.floor(t * 3) % 2;
      for (let r = 0; r < 6; r++) {
        const len = 10 - (r > 3 ? (r - 3) * 2 : 0);
        const off = (r + wave) % 3 === 0 ? 1 : 0;
        rect(fg, FX + 1, FT + r + off, len, 1, C.butter);
      }
      rect(fg, FX + 1, FT + 5, 9, 1, C.moss);
    }
  });
  if (lvl >= 5) weathervane(g, Math.round(b.cx), roofTop, t);
}

// A gilded cockerel on a pole, turning now and then with the wind. (x, y)
// is the foot of the pole. Drawn on the fine grid.
const COCKEREL = ['..yy....', '.yyyy...', 'yyyyyyy.', '.yyyyyyy', '..yyyyy.', '...p.p..'];
function weathervane(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX;
    rect(fg, X, Y - 10, 1, 10, C.plum);
    rect(fg, X - 3, Y - 7, 7, 1, C.plum);
    px(fg, X - 4, Y - 7, C.butter);
    px(fg, X + 4, Y - 7, C.butter);
    const flip = Math.floor(t * 0.2) % 2 === 1;
    COCKEREL.forEach((r, ry) => [...r].forEach((ch, rx) => {
      if (ch === '.') return;
      px(fg, X - 4 + (flip ? 7 - rx : rx), Y - 16 + ry, ch === 'p' ? C.plum : C.butter);
    }));
  });
}

// ---- Region gates: a heavy locked gate across the corridor. ----
export function regionGateDrawables(g: CanvasRenderingContext2D, rg: RegionGate, t: number): Drawable[] {
  const out: Drawable[] = [];
  if (rg.vertical) {
    const x = Math.round(rg.cx) - 1;
    const ya = rg.y0, yb = rg.y1;
    const mid = Math.round((ya + yb) / 2 / 2) * 2;
    if (rg.swing < 1) {
      // Two leaves meeting in the middle, swinging back as it opens.
      if (rg.swing <= 0.02) {
        for (let y = ya; y < yb; y += 8) {
          const y2 = Math.min(yb, y + 8);
          out.push({ y, draw: () => vFenceSeg(g, x, y, y2, true, true) });
        }
      } else {
        out.push({ y: ya, draw: () => gateLeaf(g, x, ya + 4, [0, 1], [1, 0], mid - ya - 4, rg.swing, 0) });
        out.push({ y: yb, draw: () => gateLeaf(g, x, yb - 4, [0, -1], [1, 0], yb - mid - 4, rg.swing, 0) });
      }
    } else {
      out.push({ y: ya, draw: () => vFenceSeg(g, x, ya + 4, ya + 4, false, true) });
      out.push({ y: yb, draw: () => vFenceSeg(g, x, yb - 4, yb - 4, false, true) });
    }
    if (!rg.unlocked) out.push({ y: mid + 1, draw: () => lockSign(g, x + 1, mid - 6, t) });
  } else {
    const y = Math.round(rg.cy) + 2;
    const xa = rg.x0, xb = rg.x1;
    const mid = Math.round((xa + xb) / 2);
    if (rg.swing <= 0.02) out.push({ y, draw: () => hFence(g, xa, xb, y, undefined, true) });
    else {
      out.push({ y, draw: () => gateLeaf(g, xa + 2, y, [1, 0], [0, -1], mid - xa - 2, rg.swing, 0) });
      out.push({ y, draw: () => gateLeaf(g, xb - 2, y, [-1, 0], [0, -1], xb - mid - 2, rg.swing, 0) });
    }
    if (!rg.unlocked) out.push({ y: y + 1, draw: () => lockSign(g, mid, y - 10, t) });
  }
  return out;
}

function lockSign(g: CanvasRenderingContext2D, x: number, y: number, _t: number) {
  // A little padlock sign.
  rect(g, x - 4, y, 9, 8, C.plum);
  rect(g, x - 3, y + 3, 7, 4, C.butter);
  rect(g, x - 2, y - 2, 1, 3, C.plum);
  rect(g, x + 2, y - 2, 1, 3, C.plum);
  rect(g, x - 1, y - 3, 3, 1, C.plum);
  px(g, x, y + 4, C.plum);
  px(g, x, y + 5, C.plum);
}

// ---- Free-standing fence panels and field gates ----

export function fenceDrawables(g: CanvasRenderingContext2D, f: Fence): Drawable[] {
  if (f.vertical) {
    const x = f.x0 + CS + 1;
    return [
      { y: f.y0 + 4, draw: () => vFenceSeg(g, x, f.y0 + 4, f.y1 + 4, true) },
      { y: f.y1 + 4, draw: () => vFenceSeg(g, x, f.y1 + 4, f.y1 + 4, false) },
    ];
  }
  return [{ y: f.y1 - 1, draw: () => hFence(g, f.x0, f.x1, f.y1 - 1) }];
}

export function fieldGateDrawables(g: CanvasRenderingContext2D, gt: FieldGate): Drawable[] {
  if (gt.vertical) {
    const x = gt.x0 + CS + 1;
    return [
      { y: gt.y0 + 2, draw: () => vFenceSeg(g, x, gt.y0 + 2, gt.y0 + 2, false) },
      { y: gt.y0 + 3, draw: () => gateLeaf(g, x, gt.y0 + 3, [0, 1], [1, 0], 13, gt.swing, 0) },
      { y: gt.y1 + 2, draw: () => vFenceSeg(g, x, gt.y1 + 2, gt.y1 + 2, false) },
    ];
  }
  const base = gt.y1 - 1;
  return [
    {
      y: base,
      draw: () => {
        fine(g, (fg) => {
          postF(fg, gt.x0 * PX, base * PX + 1, 6, C.wool, false, true);
          postF(fg, (gt.x1 - 2) * PX, base * PX + 1, 6, C.wool, false, true);
        });
        gateLeaf(g, gt.x0 + 1, base, [1, 0], [0, 1], 13, gt.swing, 0);
      },
    },
  ];
}

export function shadowRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  groundShadow(g, x, y, x + w, y + h);
}

// Barn: plum boards, wool trim and X-braced doors, a gambrel roof (teal)
// and a cupola. Upgraded, it gains a hayloft full of hay, a lean-to and a
// weathervane, and lanterns by the doors. Walls and doors on the fine grid.
export function barnDrawable(g: CanvasRenderingContext2D, b: Barn, night: boolean, t = 0): Drawable[] {
  const x0 = b.x0, x1 = b.x1, y1 = b.y1, w = x1 - x0;
  const wallH = 15, eave = y1 - wallH, roofTop = b.y0 - 8;
  const big = b.level >= 2;
  const mid = roofTop + Math.round((eave - roofTop) * 0.45);
  return [
    shadowFirst(b, () => groundShadow(g, x0, roofTop + 1, x1 + (big ? 5 : 0), y1)),
    {
      y: b.y1,
      draw: () => {
        fine(g, (fg) => {
          const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX, E = eave * PX, WH = wallH * PX;
          // Lean-to on the right.
          if (big) {
            rect(fg, X1 - 4, Y1 - 18, 14, 18, C.plum);
            for (let x = X1; x < X1 + 10; x += 3) rect(fg, x, Y1 - 16, 1, 15, C.teal);
            rect(fg, X1 - 4, Y1 - 24, 18, 6, C.teal);
            for (let x = X1 - 3; x < X1 + 13; x += 3) rect(fg, x, Y1 - 23, 1, 4, C.sage);
            rect(fg, X1 - 4, Y1 - 24, 18, 1, C.sage);
            rect(fg, X1 - 4, Y1 - 19, 18, 1, C.plum);
          }
          // Plum boards with teal battens, a knot here and there.
          rect(fg, X0 + 2, E, X1 - X0 - 4, WH, C.plum);
          for (let x = X0 + 6; x < X1 - 4; x += 6) {
            rect(fg, x, E + 2, 1, WH - 4, C.teal);
            if (hash2(x, eave, 432) < 0.35) px(fg, x + 3, E + 6 + Math.floor(hash2(x, 0, 433) * (WH - 12)), C.sage);
          }
          // Splashed mud and moss at the boards' feet, in clean patches.
          for (let x = X0 + 3; x < X1 - 6; x += 7) {
            if (hash2(x, y1, 434) > 0.55) continue;
            rect(fg, x, Y1 - 2, 4, 2, hash2(x, y1, 435) < 0.5 ? C.moss : C.sage);
            px(fg, x + 1, Y1 - 3, C.moss);
          }
          rect(fg, X0 + 2, E, 2, WH, C.wool);
          rect(fg, X1 - 4, E, 2, WH, C.wool);
          rect(fg, X0 + 2, E, X1 - X0 - 4, 2, C.wool);
          rect(fg, X0 + 2, E + 2, X1 - X0 - 4, 1, C.sage);
          // Doors: X-braced, in a wool frame, lit at night.
          const dw = 32, DX = Math.round(b.cx * PX - dw / 2), dh = 24;
          rect(fg, DX - 2, Y1 - dh - 2, dw + 4, dh + 2, C.wool);
          rect(fg, DX, Y1 - dh, dw, dh, night ? C.butter : C.plum);
          for (const [ax0, ax1] of [[DX, DX + dw / 2 - 1], [DX + dw / 2, DX + dw - 1]]) {
            line(fg, ax0, Y1 - dh, ax1, Y1 - 1, C.wool);
            line(fg, ax1, Y1 - dh, ax0, Y1 - 1, C.wool);
            rect(fg, ax0, Y1 - dh, ax1 - ax0 + 1, 1, C.wool);
            rect(fg, ax0, Y1 - 1, ax1 - ax0 + 1, 1, C.wool);
          }
          rect(fg, DX + dw / 2 - 1, Y1 - dh, 2, dh, C.wool);
          px(fg, DX + dw / 2 - 3, Y1 - dh / 2, C.butter);
          px(fg, DX + dw / 2 + 2, Y1 - dh / 2, C.butter);
          // Hay spilling from the doorway, in wisps.
          for (let i = 0; i < 10; i++) {
            const hx = DX - 3 + ((i * 11) % 38), hy = Y1 + 1 + (i % 3);
            px(fg, hx, hy, C.butter);
            px(fg, hx + 1, hy - (i & 1), C.butter);
          }
          if (big) {
            for (const lx of [DX - 8, DX + dw + 6]) {
              rect(fg, lx, Y1 - 20, 1, 2, C.plum);
              rect(fg, lx - 1, Y1 - 18, 3, 4, C.plum);
              rect(fg, lx, Y1 - 17, 1, 2, night || Math.floor(t * 2) % 9 === 0 ? C.butter : C.wool);
            }
          }
        });
        // Gambrel roof: steeper, darker lower slope; lit upper slope.
        hipRoof(g, x0 - 2, x1 + 2, mid, eave, 0, C.plum, C.teal);
        hipRoof(g, x0, x1, roofTop, mid, 3, C.teal, C.plum);
        fine(g, (fg) => {
          rect(fg, (x0 - 2) * PX, mid * PX, (w + 4) * PX, 1, C.sage);
          // Hayloft door under the ridge, hay pushing out of it.
          if (big) {
            const HX = (Math.round(b.cx) - 4) * PX, HY = (mid - 1) * PX;
            rect(fg, HX - 2, HY - 2, 20, 14, C.wool);
            rect(fg, HX, HY, 16, 10, C.plum);
            for (let i = 0; i < 16; i++) {
              const h = 3 + Math.round(Math.sin(i * 0.9) + Math.sin(i * 2.1) * 0.5);
              rect(fg, HX + i, HY + 10 - h, 1, h, C.butter);
              if (i % 4 === 1) px(fg, HX + i, HY + 10 - h, C.wool);
            }
          }
          // Cupola: louvred, capped.
          const CX = Math.round(b.cx) * PX, RT = roofTop * PX;
          rect(fg, CX - 6, RT - 8, 13, 10, C.wool);
          rect(fg, CX - 5, RT - 6, 1, 6, C.sage);
          rect(fg, CX - 3, RT - 6, 7, 5, night ? C.butter : C.plum);
          for (let y = RT - 5; y < RT - 1; y += 2) rect(fg, CX - 3, y, 7, 1, night ? C.wool : C.sage);
          rect(fg, CX - 8, RT - 12, 17, 4, C.plum);
          rect(fg, CX - 8, RT - 12, 17, 1, C.teal);
          rect(fg, CX - 6, RT - 14, 13, 2, C.plum);
        });
        if (big) weathervane(g, Math.round(b.cx), roofTop - 7, t);
      },
    },
  ];
}

// Kennel: a little A-frame doghouse with a bowl, a bone and a name board.
// On the fine grid.
export function kennelDrawable(g: CanvasRenderingContext2D, k: Kennel): Drawable[] {
  const cx = Math.round(k.cx), y1 = k.y1 - 2;
  return [
    shadowFirst(k, () => shadowRect(g, cx - 9, y1 - 14, 18, 14)),
    {
      y: k.y1,
      draw: () => {
        fine(g, (fg) => {
          const CX = cx * PX, Y1 = y1 * PX;
          // Board walls, the left side in shade.
          rect(fg, CX - 16, Y1 - 20, 32, 20, C.wool);
          for (let y = Y1 - 17; y < Y1 - 1; y += 4) rect(fg, CX - 15, y, 30, 1, C.sage);
          rect(fg, CX - 16, Y1 - 20, 2, 20, C.sage);
          rect(fg, CX - 16, Y1 - 2, 32, 2, C.sage);
          // A-frame roof: shingle courses, a lit right edge.
          for (let i = 0; i < 18; i++) {
            const hw = 20 - i;
            rect(fg, CX - hw, Y1 - 20 - i, hw * 2 + 1, 1, i % 4 === 3 ? C.teal : C.plum);
            px(fg, CX + hw, Y1 - 20 - i, C.sage);
          }
          rect(fg, CX - 20, Y1 - 20, 41, 1, C.plum);
          if (seasonLook.snow > 0.25) for (let i = 6; i < 18; i++) rect(fg, CX - 20 + i, Y1 - 20 - i, 41 - i * 2, 1, C.wool);
          // An arched door, and a name board.
          rect(fg, CX - 6, Y1 - 14, 12, 14, C.plum);
          rect(fg, CX - 4, Y1 - 16, 8, 2, C.plum);
          rect(fg, CX - 5, Y1 - 15, 10, 1, C.plum);
          rect(fg, CX - 5, Y1 - 27, 11, 5, C.plum);
          rect(fg, CX - 4, Y1 - 26, 9, 3, C.butter);
          rect(fg, CX - 2, Y1 - 25, 5, 1, C.plum);
          // A bowl, and a bone.
          rect(fg, CX + 20, Y1 - 4, 10, 4, C.teal);
          rect(fg, CX + 21, Y1 - 4, 8, 1, C.sage);
          rect(fg, CX + 22, Y1 - 6, 6, 2, C.plum);
          px(fg, CX + 23, Y1 - 6, C.wool);
          rect(fg, CX - 27, Y1 - 2, 7, 2, C.wool);
          rect(fg, CX - 28, Y1 - 3, 2, 2, C.wool);
          rect(fg, CX - 21, Y1 - 3, 2, 2, C.wool);
          rect(fg, CX - 28, Y1, 9, 1, C.sage);
        });
        snowCap(g, cx - 10, y1 - 10, 21, y1 - 9);
      },
    },
  ];
}

// Market stall: striped awning with a scalloped edge, a counter of goods,
// crates and a basket, a price board. On the fine grid.
export function marketDrawable(g: CanvasRenderingContext2D, m: Market): Drawable[] {
  const x0 = m.x0 + 1, x1 = m.x1 - 1, y1 = m.y1 - 1, w = x1 - x0;
  return [
    shadowFirst(m, () => shadowRect(g, x0, y1 - 22, w, 22)),
    {
      y: m.y1,
      draw: () => {
        fine(g, (fg) => {
          const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX, Wd = w * PX;
          // Posts.
          for (const px0 of [X0 + 2, X1 - 6]) {
            rect(fg, px0, Y1 - 36, 4, 36, C.plum);
            rect(fg, px0 + 3, Y1 - 36, 1, 36, C.sage);
          }
          // Counter of boards, and the goods on it: wool, eggs, cheese.
          rect(fg, X0, Y1 - 14, Wd, 14, C.plum);
          for (let x = X0 + 5; x < X1 - 2; x += 8) rect(fg, x, Y1 - 12, 1, 11, C.teal);
          rect(fg, X0, Y1 - 14, Wd, 2, C.moss);
          for (let x = X0 + 4; x < X1 - 6; x += 8) {
            rect(fg, x, Y1 - 19, 4, 4, C.wool);
            px(fg, x + 3, Y1 - 19, C.sage);
            rect(fg, x + 5, Y1 - 17, 2, 2, C.wool);
            rect(fg, x + 5, Y1 - 18, 2, 1, C.wool);
            px(fg, x + 4, Y1 - 16, C.butter);
          }
          // Crates at the sides, a basket in front.
          for (const CX of [X0 - 10, X1 + 2]) {
            rect(fg, CX, Y1 - 10, 10, 10, C.plum);
            rect(fg, CX, Y1 - 10, 10, 1, C.wool);
            rect(fg, CX, Y1 - 6, 10, 1, C.wool);
            rect(fg, CX + 4, Y1 - 10, 1, 10, C.sage);
            for (const bx of [2, 6]) { rect(fg, CX + bx, Y1 - 12, 2, 2, C.butter); }
          }
          rect(fg, X0 + 8, Y1 - 2, 10, 4, C.butter);
          for (let x = X0 + 9; x < X0 + 18; x += 2) px(fg, x, Y1 - 1, C.moss);
          rect(fg, X0 + 8, Y1 + 2, 10, 1, C.plum);
          rect(fg, X0 + 10, Y1 - 4, 2, 2, C.wool);
          rect(fg, X0 + 14, Y1 - 4, 2, 2, C.wool);
          // Awning: wool and buttercup stripes, a scalloped edge.
          for (let x = X0 - 2; x < X1 + 2; x++) {
            const col = Math.floor((x - X0 + 2) / 6) % 2 === 0 ? C.wool : C.butter;
            rect(fg, x, Y1 - 48, 1, 14, col);
            const sc = (x - X0 + 2) % 6;
            if (sc > 0 && sc < 5) px(fg, x, Y1 - 34, col);
            if (sc > 1 && sc < 4) px(fg, x, Y1 - 33, col);
          }
          rect(fg, X0 - 2, Y1 - 48, 2, 14, C.sage);
          rect(fg, X0 - 2, Y1 - 50, Wd + 4, 2, C.plum);
          rect(fg, X0 - 2, Y1 - 47, Wd + 4, 1, C.sage);
          // Price board with a coin.
          rect(fg, X1 - 4, Y1 - 62, 14, 12, C.plum);
          rect(fg, X1 - 2, Y1 - 60, 10, 8, C.wool);
          rect(fg, X1 + 1, Y1 - 58, 4, 4, C.butter);
          px(fg, X1 + 2, Y1 - 57, C.plum);
        });
        snowCap(g, x0 - 1, y1 - 26, w + 2, y1 - 16);
      },
    },
  ];
}

// Windmill: a whitewashed tower on a stone footing, a door and a window,
// a cap, four turning sails of lattice. On the fine grid.
export function windmillDrawable(g: CanvasRenderingContext2D, wm: Windmill, t: number): Drawable[] {
  const cx = Math.round(wm.cx), y1 = wm.y1 - 1;
  return [
    shadowFirst(wm, () => shadowRect(g, cx - 6, y1 - 22, 13, 22)),
    {
      y: wm.y1,
      draw: () => {
        fine(g, (fg) => {
          const CX = cx * PX + 1, Y1 = y1 * PX + 1;
          for (let i = 0; i < 44; i++) {
            const hw = Math.round(14 - i * 0.18);
            rect(fg, CX - hw, Y1 - i, hw * 2 + 1, 1, C.wool);
            rect(fg, CX - hw, Y1 - i, 1, 1, C.plum);
            rect(fg, CX - hw + 1, Y1 - i, 3, 1, C.sage);
            rect(fg, CX + hw, Y1 - i, 1, 1, C.plum);
          }
          // A stone footing, a door and a little window.
          for (let x = CX - 14; x <= CX + 14; x += 4) { rect(fg, x, Y1 - 2, 3, 2, C.sage); px(fg, x, Y1 - 2, C.wool); }
          rect(fg, CX - 4, Y1 - 12, 9, 12, C.plum);
          rect(fg, CX - 3, Y1 - 13, 7, 1, C.plum);
          px(fg, CX + 2, Y1 - 6, C.butter);
          rect(fg, CX - 2, Y1 - 25, 5, 6, C.plum);
          rect(fg, CX - 1, Y1 - 24, 3, 4, C.teal);
          px(fg, CX + 1, Y1 - 24, C.wool);
          // The cap.
          rect(fg, CX - 11, Y1 - 52, 23, 8, C.plum);
          for (let x = CX - 10; x < CX + 11; x += 3) rect(fg, x, Y1 - 50, 1, 5, C.teal);
          rect(fg, CX - 11, Y1 - 52, 23, 1, C.sage);
          rect(fg, CX - 9, Y1 - 54, 19, 2, C.plum);
          // The sails: a stock and a lattice, turning.
          const HX = CX, HY = Y1 - 48;
          const a0 = t * 1.1;
          for (let k = 0; k < 4; k++) {
            const a = a0 + (k * Math.PI) / 2;
            const ex = HX + Math.cos(a) * 30, ey = HY + Math.sin(a) * 30;
            line(fg, HX, HY, ex, ey, C.plum);
            const ox = -Math.sin(a), oy = Math.cos(a);
            for (const off of [2, 4, 6]) line(fg, HX + Math.cos(a) * 9 + ox * off, HY + Math.sin(a) * 9 + oy * off, ex + ox * off, ey + oy * off, off === 6 ? C.sage : C.wool);
            for (let r = 12; r < 30; r += 5) line(fg, HX + Math.cos(a) * r, HY + Math.sin(a) * r, HX + Math.cos(a) * r + ox * 6, HY + Math.sin(a) * r + oy * 6, C.plum);
          }
          rect(fg, HX - 2, HY - 2, 5, 5, C.butter);
          px(fg, HX, HY, C.plum);
        });
        snowCap(g, cx - 5, y1 - 27, 11);
      },
    },
  ];
}
