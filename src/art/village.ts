import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { hipRoof, shadowRect, type Drawable } from './buildings';
import { snowCap } from './seasonlook';
import type { Game } from '../game';
import type { Light } from '../render/night';
import { ARCH, PLOTS, type Plot } from '../ranch/village';
import { isFestival, isMarketDay } from '../systems/valley';
import { TS } from '../world/map';

// The village at the crossroads, drawn as far as it is built: cottages, the
// well, market stalls, the smithy, the hall, and the season's decorations
// once there is a hall to hold festivals. (Gameplay drew this; Graphics may
// restyle it.)

const ROOF = [C.teal, C.plum, C.sage];

function cottage(g: CanvasRenderingContext2D, p: Plot, night: boolean, k: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  const eave = y1 - 11, top = p.ty * TS - 7;
  rect(g, x0 + 1, eave, w - 2, 11, k % 2 ? C.wool : C.moss);
  rect(g, x0 + 1, eave, 1, 11, C.sage);
  rect(g, x0 + 1, y1 - 1, w - 2, 1, C.sage);
  // Door and two windows, lit at night.
  const cx = x0 + Math.round(w / 2);
  rect(g, cx - 2, y1 - 7, 4, 7, C.plum);
  px(g, cx + 1, y1 - 4, C.butter);
  for (const wx of [x0 + 4, x1 - 9]) {
    rect(g, wx, eave + 3, 5, 4, C.plum);
    rect(g, wx + 1, eave + 4, 3, 2, night ? C.butter : C.teal);
    // A window box of flowers.
    for (let i = 0; i < 5; i++) px(g, wx + i, eave + 8, i % 2 ? C.butter : C.wool);
    rect(g, wx, eave + 9, 5, 1, C.plum);
  }
  hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 6, ROOF[k % ROOF.length], C.plum);
  snowCap(g, x0 + 4, top, w - 8, eave + 1);
  // Chimney.
  rect(g, x1 - 9, top - 3, 3, 6, C.plum);
  rect(g, x1 - 10, top - 4, 5, 1, C.sage);
}

function well(g: CanvasRenderingContext2D, p: Plot) {
  const x0 = p.tx * TS, y1 = (p.ty + p.h) * TS - 2, w = p.w * TS;
  rect(g, x0 + 2, y1 - 5, w - 4, 5, C.wool);
  for (let x = x0 + 3; x < x0 + w - 3; x += 3) px(g, x, y1 - 3, C.sage);
  rect(g, x0 + 2, y1 - 5, w - 4, 1, C.sage);
  rect(g, x0 + 4, y1 - 4, w - 8, 2, C.teal);
  // Posts, a little roof and the bucket.
  rect(g, x0 + 2, y1 - 14, 1, 9, C.plum);
  rect(g, x0 + w - 3, y1 - 14, 1, 9, C.plum);
  for (let i = 0; i < 4; i++) rect(g, x0 + i, y1 - 15 - i, w - i * 2, 1, i % 2 ? C.teal : C.plum);
  snowCap(g, x0 + 3, y1 - 19, w - 6);
  rect(g, x0 + 3, y1 - 12, w - 6, 1, C.plum);
  line(g, x0 + w / 2, y1 - 11, x0 + w / 2, y1 - 8, C.plum);
  rect(g, x0 + w / 2 - 1, y1 - 8, 3, 2, C.wool);
}

function stall(g: CanvasRenderingContext2D, p: Plot, busy: boolean, k: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  rect(g, x0 + 1, y1 - 12, 1, 12, C.plum);
  rect(g, x1 - 2, y1 - 12, 1, 12, C.plum);
  rect(g, x0, y1 - 5, w, 5, C.plum);
  rect(g, x0, y1 - 5, w, 1, C.moss);
  // Goods on the counter: eggs, cheeses, wool.
  for (let x = x0 + 2; x < x1 - 2; x += 3) px(g, x, y1 - 6, [C.wool, C.butter, C.wool][(x + k) % 3]);
  if (busy) for (let x = x0 + 3; x < x1 - 3; x += 4) px(g, x, y1 - 7, C.butter);
  // Striped awning.
  const stripe = k % 2 ? C.teal : C.butter;
  for (let x = x0 - 1; x < x1 + 1; x++) {
    const col = Math.floor((x - x0 + 1) / 2) % 2 === 0 ? C.wool : stripe;
    rect(g, x, y1 - 17, 1, 5, col);
    if ((x - x0) % 2 === 0) px(g, x, y1 - 12, col);
  }
  rect(g, x0 - 1, y1 - 18, w + 2, 1, C.plum);
  snowCap(g, x0 - 1, y1 - 19, w + 2);
}

function smithy(g: CanvasRenderingContext2D, p: Plot, night: boolean, t: number) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  const eave = y1 - 11, top = p.ty * TS - 5;
  // Stone walls, an open front with the forge glowing inside.
  rect(g, x0 + 1, eave, w - 2, 11, C.sage);
  for (let y = eave + 1; y < y1; y += 3) for (let x = x0 + 2 + ((y >> 1) % 2) * 2; x < x1 - 2; x += 5) rect(g, x, y, 3, 1, C.wool);
  const fx = x0 + 5, glow = night || Math.floor(t * 5) % 3 !== 0;
  rect(g, fx, y1 - 8, 12, 8, C.plum);
  rect(g, fx + 3, y1 - 4, 6, 3, glow ? C.butter : C.wool);
  px(g, fx + 5, y1 - 5, C.butter);
  hipRoof(g, x0 - 1, x1 + 1, top, eave + 1, 3, C.plum, C.teal);
  snowCap(g, x0 + 2, top, w - 4, eave + 1);
  // Chimney with a spark or two, the anvil outside.
  rect(g, x0 + 7, top - 6, 4, 8, C.sage);
  rect(g, x0 + 6, top - 7, 6, 1, C.plum);
  if (Math.floor(t * 4) % 4 === 0) px(g, x0 + 8 + (Math.floor(t * 7) % 2), top - 9, C.butter);
  const ax = x1 - 9;
  rect(g, ax, y1 + 2, 6, 2, C.plum);
  rect(g, ax + 2, y1 + 4, 2, 2, C.plum);
  rect(g, ax - 1, y1 + 1, 2, 1, C.plum);
  px(g, ax + 1, y1 + 2, C.wool);
  // A horseshoe over the door.
  px(g, x1 - 6, eave + 2, C.wool);
  px(g, x1 - 4, eave + 2, C.wool);
  px(g, x1 - 6, eave + 3, C.wool);
  px(g, x1 - 4, eave + 3, C.wool);
  px(g, x1 - 5, eave + 4, C.wool);
}

function hall(g: CanvasRenderingContext2D, p: Plot, night: boolean, t: number, festival: boolean) {
  const x0 = p.tx * TS, x1 = (p.tx + p.w) * TS, y1 = (p.ty + p.h) * TS - 1, w = x1 - x0;
  const eave = y1 - 15, top = p.ty * TS - 9;
  rect(g, x0 + 1, eave, w - 2, 15, C.wool);
  // Timber framing.
  for (let x = x0 + 1; x < x1 - 1; x += 8) rect(g, x, eave, 1, 15, C.plum);
  rect(g, x0 + 1, eave + 7, w - 2, 1, C.plum);
  rect(g, x0 + 1, y1 - 1, w - 2, 1, C.sage);
  // Double doors, tall windows.
  const cx = x0 + Math.round(w / 2);
  rect(g, cx - 4, y1 - 10, 8, 10, festival ? C.butter : C.plum);
  rect(g, cx, y1 - 10, 1, 10, C.wool);
  rect(g, cx - 5, y1 - 11, 10, 1, C.plum);
  for (const wx of [x0 + 5, x1 - 10]) {
    rect(g, wx, eave + 2, 5, 9, C.plum);
    rect(g, wx + 1, eave + 3, 3, 7, night || festival ? C.butter : C.teal);
    rect(g, wx + 1, eave + 6, 3, 1, C.plum);
  }
  hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 8, C.teal, C.plum);
  snowCap(g, x0 + 4, top, w - 8, eave + 1);
  // The bell cote, the bell swinging on festival days.
  rect(g, cx - 3, top - 9, 7, 9, C.wool);
  rect(g, cx - 4, top - 11, 9, 2, C.plum);
  rect(g, cx - 2, top - 7, 5, 5, C.plum);
  const swing = festival ? Math.round(Math.sin(t * 6)) : 0;
  rect(g, cx - 1 + swing, top - 6, 3, 3, C.butter);
  px(g, cx + swing, top - 3, C.butter);
}

// A string of pennants or lanterns from a to b, sagging.
function bunting(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cols: string[], lanterns: boolean, lit: boolean) {
  const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay)));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = Math.round(ax + (bx - ax) * u), y = Math.round(ay + (by - ay) * u + 4 * 4 * u * (1 - u));
    px(g, x, y, C.plum);
    if (i % 4 !== 2) continue;
    const col = cols[Math.floor(i / 4) % cols.length];
    if (lanterns) {
      rect(g, x - 1, y + 1, 3, 3, lit ? C.butter : col);
      px(g, x, y + 4, C.plum);
    } else {
      rect(g, x - 1, y + 1, 3, 1, col);
      px(g, x, y + 2, col);
    }
  }
}

// The festival arch on the green: two posts and the season's garland.
function arch(g: CanvasRenderingContext2D, season: string, festival: boolean, t: number) {
  const x = ARCH.x, y0 = ARCH.y0, y1 = ARCH.y1;
  for (const y of [y0 + 3, y1 - 1]) {
    rect(g, x, y - 14, 2, 14, C.plum);
    px(g, x, y - 15, C.butter);
  }
  const cols = season === 'spring' ? [C.wool, C.butter] : season === 'summer' ? [C.butter, C.teal] : season === 'autumn' ? [C.butter, C.plum] : [C.teal, C.wool];
  for (let y = y0 + 3; y <= y1 - 1; y++) {
    const u = (y - y0 - 3) / (y1 - y0 - 4);
    const yy = y - 14 - Math.round(3 * Math.sin(u * Math.PI));
    px(g, x, yy, C.teal);
    px(g, x + 1, yy, (y >> 1) % 2 ? cols[0] : cols[1]);
    if (festival && (y + Math.floor(t * 3)) % 5 === 0) px(g, x - 1, yy + 1, cols[0]);
  }
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
  // The green's signpost by the road.
  out.push({
    y: 83 * TS,
    draw: () => {
      // On the road's east verge, the board pointing west to the green.
      const x = 100 * TS, y = 83 * TS;
      rect(g, x, y - 12, 1, 12, C.plum);
      const label = vil.built.size ? 'CROSSROADS VILLAGE' : 'CROSSROADS';
      const w = textWidth(label) + 4;
      rect(g, x - 2, y - 19, w, 8, C.plum);
      rect(g, x - 1, y - 18, w - 2, 6, C.wool);
      px(g, x - 3, y - 15, C.plum);
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
          for (let i = 0; i < 4; i++) {
            const x = 83 * TS + 2 + i * 3 + (i > 1 ? 34 : 0), y = 78 * TS + 1;
            if (s === 'autumn') { rect(g, x, y - 2, 3, 2, C.butter); px(g, x + 1, y - 3, C.teal); }
            else { rect(g, x, y - 3, 2, 3, C.teal); px(g, x, y - 4, C.wool); }
          }
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
