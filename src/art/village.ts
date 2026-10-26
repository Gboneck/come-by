import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { chimney, hipRoof, shadowRect, windowAt, type Drawable } from './buildings';
import { PX, fine } from '../gfx/screen';
import { snowCap } from './seasonlook';
import type { Game } from '../game';
import type { Light } from '../render/night';
import { ARCH, PLOTS, SPOTS, type Plot } from '../ranch/village';
import { isFestival, isMarketDay } from '../systems/valley';
import { TS } from '../world/map';

// The village at the crossroads, drawn as far as it is built: cottages, the
// well, market stalls, the smithy, the hall, and the season's decorations
// once there is a hall to hold festivals. (Gameplay drew this; Graphics may
// restyle it.)

const ROOF = [C.teal, C.plum, C.sage];

// The pieces are drawn on the fine grid (two fine pixels to a world pixel).

// A cottage: limewashed walls on a stone footing, a plank door under a
// little hood, two shuttered windows with flower boxes, a chimney.
function cottage(g: CanvasRenderingContext2D, p: Plot, night: boolean, k: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  const eave = y1 - 11, top = p.ty * TS - 7;
  const wall = k % 2 ? C.wool : C.moss;
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX + 1, E = eave * PX;
    rect(fg, X0 + 2, E, X1 - X0 - 4, Y1 - E, wall);
    rect(fg, X0 + 2, E, 2, Y1 - E, C.sage);
    rect(fg, X0 + 2, E, X1 - X0 - 4, 2, C.sage);
    // A few cracks in the limewash, and the footing's stones.
    for (const [cx, cy] of [[X0 + 7, E + 6], [X1 - 9, E + 10]]) { px(fg, cx, cy, C.sage); px(fg, cx + 1, cy + 1, C.sage); px(fg, cx + 1, cy + 2, C.sage); }
    rect(fg, X0 + 2, Y1 - 3, X1 - X0 - 4, 3, C.sage);
    for (let x = X0 + 4; x < X1 - 3; x += 5) { px(fg, x, Y1 - 3, C.plum); px(fg, x + 1, Y1 - 2, C.wool); }
    // The door, under a hood.
    const CX = (x0 + Math.round(w / 2)) * PX;
    rect(fg, CX - 5, Y1 - 15, 10, 15, C.plum);
    rect(fg, CX - 4, Y1 - 14, 8, 14, C.plum);
    for (let x = CX - 3; x < CX + 4; x += 2) rect(fg, x, Y1 - 13, 1, 12, C.teal);
    px(fg, CX + 2, Y1 - 7, C.butter);
    rect(fg, CX - 7, Y1 - 18, 14, 2, ROOF[k % ROOF.length]);
    rect(fg, CX - 7, Y1 - 16, 14, 1, C.plum);
    // Flower boxes under the windows.
    for (const wx of [x0 + 4, x1 - 9]) {
      const WX = wx * PX;
      rect(fg, WX - 1, E + 17, 12, 3, C.plum);
      for (let i = 0; i < 5; i++) {
        px(fg, WX + i * 2 + 1, E + 16, C.moss);
        px(fg, WX + i * 2, E + 15, i % 2 ? C.butter : C.wool);
      }
    }
  });
  for (const wx of [x0 + 4, x1 - 9]) windowAt(g, wx, eave + 3, night, 5, 3, true, ROOF[k % ROOF.length]);
  hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 6, ROOF[k % ROOF.length], C.plum);
  chimney(g, x1 - 10, top - 3, 6);
}

// The village well: a stone ring with water in it, a roofed winch.
function well(g: CanvasRenderingContext2D, p: Plot) {
  const x0 = p.tx * TS, y1 = (p.ty + p.h) * TS - 2, w = p.w * TS;
  fine(g, (fg) => {
    const X0 = x0 * PX, Y1 = y1 * PX + 1, Wd = w * PX;
    rect(fg, X0 + 2, Y1 + 1, Wd - 4, 1, C.sage);
    rect(fg, X0 + 4, Y1 - 10, Wd - 8, 11, C.wool);
    for (let r = 0; r < 3; r++) for (let x = X0 + 5 + (r & 1) * 3; x < X0 + Wd - 5; x += 6) { px(fg, x, Y1 - 8 + r * 3, C.sage); rect(fg, x - 2, Y1 - 6 + r * 3, 5, 1, C.sage); }
    rect(fg, X0 + 4, Y1 - 10, 2, 11, C.sage);
    rect(fg, X0 + 7, Y1 - 9, Wd - 14, 3, C.teal);
    px(fg, X0 + Wd - 10, Y1 - 9, C.wool);
    for (const px0 of [X0 + 4, X0 + Wd - 6]) { rect(fg, px0, Y1 - 28, 2, 18, C.plum); px(fg, px0 + 1, Y1 - 26, C.sage); }
    for (let i = 0; i < 6; i++) rect(fg, X0 + i, Y1 - 30 - i, Wd - i * 2, 1, i % 2 ? C.teal : C.plum);
    rect(fg, X0 + 6, Y1 - 24, Wd - 12, 2, C.plum);
    rect(fg, X0 + Wd / 2, Y1 - 22, 1, 7, C.wool);
    rect(fg, X0 + Wd / 2 - 2, Y1 - 16, 5, 4, C.teal);
    rect(fg, X0 + Wd / 2 - 2, Y1 - 16, 5, 1, C.plum);
  });
  snowCap(g, x0 + 3, y1 - 19, w - 6);
}

// As the ranch's bench, long enough for two: a seat on legs with a back
// rail; the sitters' ground points are (x - 3, y) and (x + 3, y).
function bench(g: CanvasRenderingContext2D, x: number, y: number) {
  fine(g, (fg) => {
    const X = x * PX, B = y * PX + 1;
    rect(fg, X - 16, B + 1, 32, 1, C.sage);
    rect(fg, X - 14, B - 6, 30, 3, C.plum);
    rect(fg, X - 14, B - 6, 30, 1, C.moss);
    rect(fg, X - 14, B - 4, 30, 1, C.sage);
    for (const lx of [X - 14, X, X + 14]) rect(fg, lx, B - 3, 2, 4, C.plum);
    rect(fg, X - 14, B - 12, 30, 2, C.plum);
    rect(fg, X - 14, B - 12, 30, 1, C.moss);
    for (const lx of [X - 14, X + 14]) rect(fg, lx, B - 10, 2, 4, C.plum);
  });
  snowCap(g, x - 7, y - 4, 15);
}

// A market stall: posts, a counter of goods, a striped awning with a
// scalloped edge.
function stall(g: CanvasRenderingContext2D, p: Plot, busy: boolean, k: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX + 1, Wd = w * PX;
    for (const px0 of [X0 + 2, X1 - 4]) { rect(fg, px0, Y1 - 24, 2, 24, C.plum); px(fg, px0 + 1, Y1 - 22, C.sage); }
    rect(fg, X0, Y1 - 10, Wd, 10, C.plum);
    rect(fg, X0, Y1 - 10, Wd, 2, C.moss);
    for (let x = X0 + 4; x < X1 - 2; x += 6) rect(fg, x, Y1 - 8, 1, 7, C.teal);
    // Goods: eggs, cheeses, wool.
    for (let x = X0 + 3; x < X1 - 4; x += 6) {
      const kind = ((x >> 1) + k) % 3;
      if (kind === 0) { rect(fg, x, Y1 - 13, 3, 3, C.wool); px(fg, x + 2, Y1 - 13, C.sage); }
      else if (kind === 1) { rect(fg, x, Y1 - 12, 4, 2, C.butter); px(fg, x, Y1 - 13, C.butter); }
      else { rect(fg, x + 1, Y1 - 13, 2, 3, C.wool); rect(fg, x, Y1 - 12, 4, 1, C.wool); }
    }
    if (busy) for (let x = X0 + 6; x < X1 - 6; x += 8) rect(fg, x, Y1 - 15, 2, 2, C.butter);
    // Striped awning.
    const stripe = k % 2 ? C.teal : C.butter;
    for (let x = X0 - 2; x < X1 + 2; x++) {
      const col = Math.floor((x - X0 + 2) / 4) % 2 === 0 ? C.wool : stripe;
      rect(fg, x, Y1 - 34, 1, 10, col);
      const sc = (x - X0 + 2) % 4;
      if (sc === 1 || sc === 2) px(fg, x, Y1 - 24, col);
    }
    rect(fg, X0 - 2, Y1 - 36, Wd + 4, 2, C.plum);
    rect(fg, X0 - 2, Y1 - 33, Wd + 4, 1, C.sage);
  });
  snowCap(g, x0 - 1, y1 - 19, w + 2);
}

// The smithy: walls of laid stone, an open front with the forge glowing
// inside, a chimney with sparks, the anvil outside, a horseshoe over the
// door.
function smithy(g: CanvasRenderingContext2D, p: Plot, night: boolean, t: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1;
  const eave = y1 - 11, top = p.ty * TS - 5;
  const glow = night || Math.floor(t * 5) % 3 !== 0;
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX + 1, E = eave * PX;
    rect(fg, X0 + 2, E, X1 - X0 - 4, Y1 - E, C.sage);
    for (let y = E + 2, r = 0; y < Y1 - 1; y += 4, r++)
      for (let x = X0 + 3 + (r & 1) * 4; x < X1 - 4; x += 8) {
        rect(fg, x, y, 6, 3, C.wool);
        rect(fg, x, y + 2, 6, 1, C.sage);
        px(fg, x + 5, y, C.sage);
      }
    const FX = (x0 + 5) * PX;
    rect(fg, FX, Y1 - 16, 24, 16, C.plum);
    rect(fg, FX + 6, Y1 - 8, 12, 6, glow ? C.butter : C.wool);
    rect(fg, FX + 8, Y1 - 10, 8, 2, glow ? C.butter : C.sage);
    px(fg, FX + 11, Y1 - 12, C.butter);
    rect(fg, FX + 4, Y1 - 3, 16, 3, C.sage);
    // A horseshoe over the door.
    const HX = (x1 - 6) * PX, HY = (eave + 2) * PX;
    for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [4, 1], [4, 0]]) px(fg, HX + dx, HY + dy, C.wool);
    // The anvil outside.
    const AX = (x1 - 9) * PX, AY = (y1 + 2) * PX;
    rect(fg, AX, AY, 12, 3, C.plum);
    rect(fg, AX, AY, 12, 1, C.wool);
    rect(fg, AX - 3, AY + 1, 3, 1, C.plum);
    rect(fg, AX + 4, AY + 3, 4, 4, C.plum);
    rect(fg, AX + 2, AY + 7, 8, 1, C.sage);
  });
  hipRoof(g, x0 - 1, x1 + 1, top, eave + 1, 3, C.plum, C.teal);
  fine(g, (fg) => {
    const CX = (x0 + 7) * PX, T = (top - 6) * PX;
    rect(fg, CX, T, 8, 16, C.sage);
    for (let y = T + 3; y < T + 15; y += 3) rect(fg, CX, y, 8, 1, C.wool);
    rect(fg, CX - 2, T - 2, 12, 2, C.plum);
    if (Math.floor(t * 4) % 4 === 0) { px(fg, CX + 3 + (Math.floor(t * 7) % 3), T - 5, C.butter); px(fg, CX + 5, T - 8, C.butter); }
  });
}

// The hall: timber framing on limewash, double doors, tall windows, a bell
// cote whose bell swings on festival days.
function hall(g: CanvasRenderingContext2D, p: Plot, night: boolean, t: number, festival: boolean) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  const eave = y1 - 15, top = p.ty * TS - 9;
  const cx = x0 + Math.round(w / 2);
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y1 = y1 * PX + 1, E = eave * PX, CX = cx * PX;
    rect(fg, X0 + 2, E, X1 - X0 - 4, Y1 - E, C.wool);
    // Timber framing: posts, a rail, braces.
    for (let x = X0 + 2; x < X1 - 2; x += 16) {
      rect(fg, x, E, 2, Y1 - E, C.plum);
      if (x + 16 < X1 - 2) { line(fg, x + 2, E + 14, x + 8, E + 2, C.plum); line(fg, x + 14, E + 14, x + 8, E + 2, C.plum); }
    }
    rect(fg, X1 - 4, E, 2, Y1 - E, C.plum);
    rect(fg, X0 + 2, E + 14, X1 - X0 - 4, 2, C.plum);
    rect(fg, X0 + 2, E, X1 - X0 - 4, 2, C.plum);
    rect(fg, X0 + 2, Y1 - 2, X1 - X0 - 4, 2, C.sage);
    // Double doors.
    rect(fg, CX - 10, Y1 - 22, 20, 22, C.plum);
    rect(fg, CX - 8, Y1 - 20, 16, 20, festival ? C.butter : C.plum);
    rect(fg, CX - 1, Y1 - 20, 2, 20, C.wool);
    for (const dx of [-6, 3]) { rect(fg, CX + dx, Y1 - 17, 3, 6, C.teal); rect(fg, CX + dx, Y1 - 9, 3, 6, C.teal); }
    // Tall windows.
    for (const wx of [x0 + 5, x1 - 10]) {
      const WX = wx * PX;
      rect(fg, WX, E + 4, 10, 18, C.plum);
      rect(fg, WX + 2, E + 6, 6, 14, night || festival ? C.butter : C.teal);
      rect(fg, WX + 2, E + 12, 6, 1, C.plum);
      rect(fg, WX + 4, E + 6, 1, 14, C.plum);
      if (!night && !festival) px(fg, WX + 6, E + 7, C.wool);
      rect(fg, WX - 1, E + 22, 12, 1, C.wool);
    }
  });
  hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 8, C.teal, C.plum);
  fine(g, (fg) => {
    // The bell cote.
    const CX = cx * PX, T = top * PX;
    rect(fg, CX - 6, T - 18, 13, 18, C.wool);
    rect(fg, CX - 6, T - 18, 2, 18, C.sage);
    rect(fg, CX - 8, T - 22, 17, 4, C.plum);
    rect(fg, CX - 8, T - 22, 17, 1, C.teal);
    rect(fg, CX - 4, T - 15, 9, 10, C.plum);
    const swing = festival ? Math.round(Math.sin(t * 6) * 2) : 0;
    rect(fg, CX - 2 + swing, T - 13, 5, 5, C.butter);
    rect(fg, CX - 3 + swing, T - 9, 7, 1, C.butter);
    px(fg, CX + swing, T - 7, C.butter);
    px(fg, CX + 1 + swing, T - 12, C.wool);
  });
}

// A string of pennants or lanterns from a to b, sagging; fine.
function bunting(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cols: string[], lanterns: boolean, lit: boolean) {
  fine(g, (fg) => {
    const AX = ax * PX, AY = ay * PX, BX = bx * PX, BY = by * PX;
    const n = Math.max(2, Math.round(Math.hypot(BX - AX, BY - AY)));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = Math.round(AX + (BX - AX) * u), y = Math.round(AY + (BY - AY) * u + 8 * 4 * u * (1 - u));
      px(fg, x, y, C.plum);
      if (i % 8 !== 4) continue;
      const col = cols[Math.floor(i / 8) % cols.length];
      if (lanterns) {
        rect(fg, x - 2, y + 1, 5, 5, C.plum);
        rect(fg, x - 1, y + 2, 3, 3, lit ? C.butter : col);
        px(fg, x, y + 6, C.plum);
      } else {
        rect(fg, x - 2, y + 1, 5, 1, col);
        rect(fg, x - 1, y + 2, 3, 1, col);
        rect(fg, x, y + 3, 1, 2, col);
      }
    }
  });
}

// The festival arch on the green: two posts and the season's garland.
function arch(g: CanvasRenderingContext2D, season: string, festival: boolean, t: number) {
  const x = ARCH.x, y0 = ARCH.y0, y1 = ARCH.y1;
  const cols = season === 'spring' ? [C.wool, C.butter] : season === 'summer' ? [C.butter, C.teal] : season === 'autumn' ? [C.butter, C.plum] : [C.teal, C.wool];
  fine(g, (fg) => {
    const X = x * PX;
    for (const y of [y0 + 3, y1 - 1]) {
      const Y = y * PX + 1;
      rect(fg, X, Y - 28, 3, 28, C.plum);
      px(fg, X + 2, Y - 26, C.sage);
      rect(fg, X, Y - 30, 3, 2, C.butter);
    }
    for (let Y = (y0 + 3) * PX; Y <= (y1 - 1) * PX; Y++) {
      const u = (Y - (y0 + 3) * PX) / ((y1 - y0 - 4) * PX);
      const yy = Y - 28 - Math.round(6 * Math.sin(u * Math.PI));
      rect(fg, X - 1, yy, 2, 1, C.teal);
      px(fg, X + 1, yy, (Y >> 2) % 2 ? cols[0] : cols[1]);
      if (Y % 7 === 0) px(fg, X - 2, yy - 1, C.teal);
      if (festival && (Y + Math.floor(t * 6)) % 9 === 0) px(fg, X - 2, yy + 2, cols[0]);
    }
  });
}

export function villageDrawables(game: Game, g: CanvasRenderingContext2D, inView: (x0: number, y0: number, x1: number, y1: number) => boolean, night: boolean): Drawable[] {
  const out: Drawable[] = [];
  const vil = game.ranch.village;
  if (!inView(74 * TS, 68 * TS, 112 * TS, 88 * TS)) return out;
  const t = game.t;
  const market = isMarketDay(game), festival = isFestival(game);
  let ck = 0;
  for (const p of PLOTS) {
    if (p.step && !vil.has(p.step)) continue;
    const x0 = p.tx * TS, y1 = (p.ty + p.h) * TS;
    const k = ck;
    if (p.kind === 'cottage') ck++;
    if (p.kind !== 'stall' && p.kind !== 'well') out.push({ y: -1e8 + p.tx * 300 + p.ty, draw: () => shadowRect(g, x0, p.ty * TS - 4, p.w * TS, p.h * TS + 2) });
    out.push({
      y: y1 - 1,
      draw: () => {
        if (p.kind === 'cottage') cottage(g, p, night, k);
        else if (p.kind === 'well') well(g, p);
        else if (p.kind === 'stall') stall(g, p, market, p.tx);
        else if (p.kind === 'smithy') smithy(g, p, night, t);
        else hall(g, p, night, t, festival);
      },
    });
  }
  // A bench on the green once anyone lives here (villagers sit on it).
  if (vil.built.size) out.push({ y: SPOTS.bench.y - 1, draw: () => bench(g, SPOTS.bench.x, SPOTS.bench.y) });
  // The green's signpost by the road.
  out.push({
    y: 83 * TS,
    draw: () => {
      // On the road's east verge, the board pointing west to the green.
      const x = 100 * TS, y = 83 * TS;
      const label = vil.built.size ? 'CROSSROADS VILLAGE' : 'CROSSROADS';
      const w = textWidth(label) + 4;
      fine(g, (fg) => {
        const X = x * PX, Y = y * PX + 1;
        rect(fg, X, Y - 24, 2, 25, C.plum);
        rect(fg, X + 1, Y - 24, 1, 25, C.sage);
        // A board pointing west: an arrowhead end.
        rect(fg, X - 4, Y - 38, w * PX, 16, C.plum);
        rect(fg, X - 2, Y - 36, w * PX - 4, 12, C.wool);
        for (let i = 0; i < 8; i++) rect(fg, X - 5 - i, Y - 37 + i, 1, 14 - i * 2, C.plum);
        rect(fg, X - 2, Y - 25, w * PX - 4, 1, C.sage);
        rect(fg, X - 2, Y + 1, 6, 1, C.sage);
      });
      text(g, label, x - 2 + w / 2, y - 17, C.plum, { align: 'center' });
    },
  });
  // Decorations once there is a hall: the season's colours across the green.
  if (vil.has('hall')) {
    const s = game.season.season;
    const cols = s === 'spring' ? [C.wool, C.butter, C.teal] : s === 'summer' ? [C.butter, C.teal, C.wool] : s === 'autumn' ? [C.butter, C.plum, C.wool] : [C.teal, C.wool, C.butter];
    const lanterns = s === 'autumn' || s === 'winter';
    out.push({
      y: 1e8,
      draw: () => {
        bunting(g, 81 * TS, 74 * TS + 4, 83 * TS + 2, 73 * TS + 6, cols, lanterns, night || festival);
        bunting(g, 89 * TS - 2, 73 * TS + 6, 91 * TS, 73 * TS + 2, cols, lanterns, night || festival);
        if (festival) bunting(g, 82 * TS, 80 * TS + 2, 89 * TS, 80 * TS + 4, cols, lanterns, true);
      },
    });
    out.push({ y: ARCH.y1, draw: () => arch(g, s, festival, t) });
    // Autumn gourds and winter greenery at the hall door.
    if (s === 'autumn' || s === 'winter')
      out.push({
        y: 78 * TS + 2,
        draw: () => {
          fine(g, (fg) => {
            for (let i = 0; i < 4; i++) {
              const X = (83 * TS + 2 + i * 3 + (i > 1 ? 34 : 0)) * PX, Y = (78 * TS + 1) * PX + 1;
              if (s === 'autumn') {
                rect(fg, X, Y - 4, 6, 4, C.butter);
                rect(fg, X + 1, Y - 5, 4, 1, C.butter);
                rect(fg, X + 2, Y - 4, 1, 4, C.moss);
                rect(fg, X + 2, Y - 7, 2, 2, C.teal);
              } else {
                rect(fg, X + 1, Y - 7, 3, 7, C.teal);
                rect(fg, X, Y - 5, 5, 3, C.teal);
                px(fg, X + 2, Y - 8, C.wool);
                px(fg, X + 1, Y - 4, C.butter);
              }
            }
          });
        },
      });
  }
  return out;
}

// Windows and the forge, lit at night.
export function villageLights(game: Game, ox: number, oy: number): Light[] {
  const out: Light[] = [];
  for (const p of PLOTS) {
    if (p.step && !game.ranch.village.has(p.step)) continue;
    const cx = (p.tx + p.w / 2) * TS - ox, y = (p.ty + p.h) * TS - oy;
    if (p.kind === 'cottage') out.push({ x: cx, y: y - 4, r: 22 });
    else if (p.kind === 'smithy') out.push({ x: p.tx * TS + 11 - ox, y: y - 3, r: 32 });
    else if (p.kind === 'hall') out.push({ x: cx, y: y - 6, r: isFestival(game) ? 46 : 28 });
  }
  if (game.ranch.village.has('hall') && isFestival(game)) out.push({ x: ARCH.x - ox, y: (ARCH.y0 + ARCH.y1) / 2 - 8 - oy, r: 30 });
  return out;
}
