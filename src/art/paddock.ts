import { C, U32 } from '../palette';
import { px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';
import { ROOFS, farmLook } from './ranchstyle';
import { seasonLook, snowCap } from './seasonlook';
import { drawGood, gateLeaf, groundShadow, postCap, postF, postH, railF, vRailsF, type Drawable } from './buildings';
import { PX, fine } from '../gfx/screen';
import type { Pen } from '../ranch/buildings';
import { CS, TS } from '../world/map';

// Pens and paddocks of any size: a rectangle of fence with the gate anywhere
// along any side, fixtures inside (a trough, a field shelter, a hay rack) and
// perhaps an inner hurdle with its own gate.
//
// The fence: posts at a steady rhythm, spaced evenly along each side so a
// heavier corner post always stands at each corner and the gate hangs
// between two more; the rails are worn (a knot, a weathered streak, the odd
// sag). The floor is one cached picture: a small pen is trodden and strewn
// with straw; a big paddock reads as a field, grass inside with trodden
// lanes along the fence where the stock walk it, a worn track from the gate
// and bare rings round the trough and rack.

export type FixtureKind = 'trough' | 'shelter' | 'rack';
// Top-left tile (world tiles) of a fixture inside the paddock. Footprints in
// tiles: trough 2x1, shelter 3x2 (open to the south), rack 2x1.
export interface Fixture { kind: FixtureKind; tx: number; ty: number }
// An inner hurdle on a tile line: `at` is a column (vertical) or row, and
// `gate` a span of tiles along it, both counted from the paddock's tx/ty.
export interface Hurdle { vertical: boolean; at: number; gate: [number, number]; open?: boolean; swing: number }
// What Gameplay's paddock adds to a Pen (valley-r4), optional here so the art
// also draws an older Pen: fixtures, goods by kind, the kinds sharing it.
type Paddock = Pen & { fixtures?: Fixture[]; hurdle?: Hurdle; goodsList?: () => string[]; kinds?: string[] };

export const FIXTURE_SIZE: Record<FixtureKind, [number, number]> = { trough: [2, 1], shelter: [3, 2], rack: [2, 1] };

// The fixtures to draw: the paddock's own, or a trough by the back fence for
// a pen with `hasTrough` and no list.
function fixturesOf(p: Paddock): Fixture[] {
  if (p.fixtures) return p.fixtures;
  if (!p.hasTrough) return [];
  return [{ kind: 'trough', tx: Math.round(p.cx / TS) - 1, ty: p.ty + (p.rot === 2 ? p.h - 2 : 1) }];
}

// Posts along a fence line from corner a to corner b, about `step` apart and
// evenly spaced, the gate's two posts at its ends when there is one.
function postsAlong(a: number, b: number, step: number, gap?: [number, number]): number[] {
  const n = Math.max(1, Math.round((b - a) / step));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const q = a + Math.round(((b - a) * i) / n);
    if (gap && q > gap[0] - 5 && q < gap[1] + 4) continue;
    out.push(q);
  }
  if (gap) out.push(gap[0], gap[1] - 1);
  return out.sort((x, y) => x - y);
}

// A north or south side of fence: rails post to post on the fine grid,
// worn here and there (a knot, a grey streak, a rail sagging in the middle).
function hSide(g: CanvasRenderingContext2D, xs: number[], base: number, gap: [number, number] | undefined, sturdy: boolean, a: number, b: number) {
  const gate = (q: number) => !!gap && (q === gap[0] || q === gap[1] - 1);
  fine(g, (fg) => {
    const B = base * PX + 1;
    for (let i = 0; i + 1 < xs.length; i++) {
      const xa = xs[i], xb = xs[i + 1];
      if (gap && xa === gap[0]) continue;
      const X0 = xa * PX + 3, X1 = xb * PX;
      if (X1 <= X0) continue;
      rect(fg, X0, B + 1, X1 - X0 + 1, 1, C.sage);
      const wear = hash2(xa, base, 409);
      railF(fg, X0, X1, B - 5, xa);
      if (wear > 0.84 && X1 - X0 >= 10) {
        // The top rail sags a pixel in the middle of its span.
        railF(fg, X0, X0 + 3, B - 9, xa + 1);
        railF(fg, X0 + 3, X1 - 3, B - 8, xa + 1);
        railF(fg, X1 - 3, X1, B - 9, xa + 1);
      } else railF(fg, X0, X1, B - 9, xa + 1);
      if (sturdy) railF(fg, X0, X1, B - 13, xa + 2);
      if (wear < 0.14) for (let x = X0 + 1; x < X1 - 1; x += 2) px(fg, x, B - 5, C.sage);
    }
    for (const x of xs) {
      const heavy = x === a || x === b || gate(x);
      const cap = sturdy || heavy || seasonLook.snow > 0.4 ? C.wool : postCap(x, base);
      postF(fg, x * PX, B, sturdy ? (heavy ? 7 : 6) : heavy ? 6 : postH(x, base), cap, sturdy, heavy);
    }
  });
}

// One stretch of an east or west side, post `ya` to post `yb`: the rails as
// two lines seen from above, and the post at the top unless it is a corner.
function vStretch(g: CanvasRenderingContext2D, x: number, ya: number, yb: number, rail: boolean, top: 'none' | 'post' | 'heavy', sturdy: boolean) {
  fine(g, (fg) => {
    const X = x * PX, Ya = ya * PX + 1, Yb = yb * PX + 1;
    if (rail && yb > ya) vRailsF(fg, X, Ya, Yb, sturdy, ya);
    if (top === 'none') return;
    const heavy = top === 'heavy';
    const cap = sturdy || heavy || seasonLook.snow > 0.4 ? C.wool : postCap(x, ya);
    postF(fg, X, Ya, sturdy ? (heavy ? 7 : 6) : heavy ? 6 : postH(x, ya), cap, sturdy, heavy);
  });
}

function vSide(out: Drawable[], g: CanvasRenderingContext2D, x: number, ys: number[], gap: [number, number] | undefined, sturdy: boolean, a: number, b: number) {
  for (let i = 0; i + 1 < ys.length; i++) {
    const ya = ys[i], yb = ys[i + 1];
    const rail = !(gap && ya === gap[0]);
    const top = ya === a ? 'none' : gap && (ya === gap[0] || ya === gap[1] - 1) ? 'heavy' : 'post';
    out.push({ y: ya, draw: () => vStretch(g, x, ya, yb, rail, top, sturdy) });
  }
}

// The gate: one leaf, or two meeting in the middle when it is wide.
function gateLeaves(g: CanvasRenderingContext2D, hx: number, hy: number, along: [number, number], outward: [number, number], len: number, swing: number, flash: number) {
  if (len < 22) {
    gateLeaf(g, hx, hy, along, outward, len, swing, flash);
    return;
  }
  const half = Math.floor(len / 2);
  gateLeaf(g, hx, hy, along, outward, half - 1, swing, flash);
  gateLeaf(g, hx + along[0] * len, hy + along[1] * len, [-along[0], -along[1]], outward, len - half - 1, swing, flash);
}

export function penDrawables(g: CanvasRenderingContext2D, pen: Pen, t: number, showSign: boolean): Drawable[] {
  const p = pen as Paddock;
  const out: Drawable[] = [];
  const x0 = p.x0, y0 = p.y0, x1 = p.x1, y1 = p.y1;
  const s = p.gateSpan();
  const topBase = y0 + CS - 1, botBase = y1 - 1;
  const lx = x0 + 1, rx = x1 - CS + 1;
  const LEN = s.x1 - s.x0 || s.y1 - s.y0;
  const sturdy = p.level >= 2;
  const fixtures = fixturesOf(p);
  // Big paddocks space their posts a little wider, like a field fence.
  const field = fieldness(p);
  const step = field > 0.5 ? 10 : 8;

  out.push({ y: -1e9 + p.id, draw: () => { const f = floorPicture(p, fixtures, s); g.drawImage(f.c, f.x, f.y, f.w, f.h); } });

  for (const f of fixtures) out.push(...fixtureDrawables(g, f, t));

  // Goods waiting, each drawn as its kind's (a mixed paddock shows several).
  const goods = p.goodsList ? p.goodsList().slice(0, 12) : p.species ? Array<string>(Math.min(12, p.goods)).fill(p.species) : [];
  if (goods.length) {
    out.push({
      y: p.iy1 - 2,
      draw: () => {
        goods.forEach((sp, i) => {
          const gx = p.ix0 + 3 + (i % 6) * 4, gy = p.iy1 - 4 - Math.floor(i / 6) * 4;
          drawGood(g, sp, gx, gy);
        });
      },
    });
  }

  const hGap = (r: number) => (p.rot === r ? [s.x0, s.x1] as [number, number] : undefined);
  const vGap = (r: number) => (p.rot === r ? [s.y0, s.y1] as [number, number] : undefined);
  const top = postsAlong(lx, rx, step, hGap(2)), bot = postsAlong(lx, rx, step, hGap(0));
  // The corners draw just after the side stretches that meet them.
  out.push({ y: topBase + 0.1, draw: () => hSide(g, top, topBase, hGap(2), sturdy, lx, rx) });
  out.push({ y: botBase + 0.1, draw: () => hSide(g, bot, botBase, hGap(0), sturdy, lx, rx) });
  vSide(out, g, lx, postsAlong(topBase, botBase, step, vGap(1)), vGap(1), sturdy, topBase, botBase);
  vSide(out, g, rx, postsAlong(topBase, botBase, step, vGap(3)), vGap(3), sturdy, topBase, botBase);

  // Gate leaves.
  const gy = p.rot === 0 ? botBase : p.rot === 2 ? topBase : s.y0;
  out.push({
    y: p.rot === 2 ? topBase + 0.5 : p.rot === 0 ? botBase + 0.5 : s.y1,
    draw: () => {
      if (p.rot === 0) gateLeaves(g, s.x0 + 1, gy, [1, 0], [0, 1], LEN - 2, p.swing, p.shutFlash);
      else if (p.rot === 2) gateLeaves(g, s.x0 + 1, gy, [1, 0], [0, -1], LEN - 2, p.swing, p.shutFlash);
      else if (p.rot === 1) gateLeaves(g, lx, gy, [0, 1], [-1, 0], LEN - 1, p.swing, p.shutFlash);
      else gateLeaves(g, rx, gy, [0, 1], [1, 0], LEN - 1, p.swing, p.shutFlash);
    },
  });

  if (p.hurdle) out.push(...hurdleDrawables(g, p, p.hurdle, topBase, botBase, lx, rx));

  // Sign: head count and capacity.
  if (showSign && (p.animals.length > 0 || p.full)) {
    out.push({
      y: 1e9,
      draw: () => {
        const sp = p.animals[0]?.sp;
        const cap = sp ? Math.floor(p.capacity / sp.space) : 0;
        // A mixed paddock counts room, not heads.
        const label = p.full ? 'FULL' : p.kinds && p.kinds.length > 1 ? `${p.used}/${p.capacity} ROOM` : `${p.animals.length}/${cap}`;
        const tx = Math.round(p.cx), ty = Math.round(y0 - 12);
        text(g, label, tx, ty, p.full ? C.butter : C.wool, { align: 'center', shadow: C.plum });
      },
    });
  }
  return out;
}

// ---- The inner hurdle: a lighter fence across the paddock with a gate. ----

function hurdleLine(p: Paddock, h: Hurdle, topBase: number, botBase: number, lx: number, rx: number) {
  if (h.vertical) {
    const x = p.x0 + h.at * TS - 1;
    return { x, base: 0, a: topBase, b: botBase, gap: [p.y0 + h.gate[0] * TS, p.y0 + h.gate[1] * TS] as [number, number] };
  }
  const base = p.y0 + h.at * TS + 1;
  return { x: 0, base, a: lx, b: rx, gap: [p.x0 + h.gate[0] * TS, p.x0 + h.gate[1] * TS] as [number, number] };
}

function hurdleDrawables(g: CanvasRenderingContext2D, p: Paddock, h: Hurdle, topBase: number, botBase: number, lx: number, rx: number): Drawable[] {
  const out: Drawable[] = [];
  const L = hurdleLine(p, h, topBase, botBase, lx, rx);
  const len = L.gap[1] - L.gap[0];
  if (h.vertical) {
    // Its ends stand against the perimeter, so start a stretch below the top.
    const ys = postsAlong(L.a, L.b, 8, L.gap);
    for (let i = 0; i + 1 < ys.length; i++) {
      const ya = ys[i], yb = ys[i + 1];
      const rail = ya !== L.gap[0];
      const top = ya === L.a ? 'none' : ya === L.gap[0] || ya === L.gap[1] - 1 ? 'heavy' : 'post';
      out.push({ y: ya + 0.2, draw: () => vStretch(g, L.x, ya, yb, rail, top, false) });
    }
    out.push({ y: L.gap[1], draw: () => gateLeaves(g, L.x, L.gap[0], [0, 1], [1, 0], len - 1, h.swing, 0) });
  } else {
    const xs = postsAlong(L.a, L.b, 8, L.gap).filter((x) => x !== L.a && x !== L.b);
    xs.unshift(L.a + 2);
    xs.push(L.b - 2);
    out.push({ y: L.base, draw: () => hSide(g, xs, L.base, L.gap, false, -1, -1) });
    out.push({ y: L.base + 0.5, draw: () => gateLeaves(g, L.gap[0] + 1, L.base, [1, 0], [0, -1], len - 2, h.swing, 0) });
  }
  return out;
}

// ---- Fixtures ----

function fixtureDrawables(g: CanvasRenderingContext2D, f: Fixture, t: number): Drawable[] {
  const x = f.tx * TS, y = f.ty * TS;
  switch (f.kind) {
    case 'trough':
      return [{ y: y + 6, draw: () => trough(g, x + 1, y + 2, t) }];
    case 'rack':
      return [{ y: y + 7, draw: () => hayRack(g, x + 1, y + 7) }];
    case 'shelter':
      // The back row is solid and the stock stands under the roof in front,
      // so the dark inside sorts behind them and the posts and roof before.
      return [
        { y: -1e8 + x * 0.001 + y, draw: () => groundShadow(g, x, y - 6, x + 24, y + 15) },
        { y: y + 7, draw: () => shelterInside(g, x, y + 15) },
        { y: y + 15, draw: () => shelterFrame(g, x, y + 15) },
      ];
  }
}

// A plum water trough on stubby legs, a glint moving on the water. On the
// fine grid: a rim catching the light, planks, the water inside.
function trough(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX;
    rect(fg, X - 1, Y + 10, 28, 1, C.sage);
    rect(fg, X, Y, 28, 8, C.plum);
    rect(fg, X, Y, 28, 1, C.moss);
    rect(fg, X + 2, Y + 2, 24, 2, seasonLook.snow > 0.7 ? C.wool : C.teal);
    rect(fg, X + 2, Y + 4, 24, 1, C.plum);
    rect(fg, X + 1, Y + 6, 26, 1, C.sage); // the plank seam
    px(fg, X + 8 + ((Math.floor(t * 2) % 5) * 3), Y + 2, C.wool);
    px(fg, X + 9 + ((Math.floor(t * 2) % 5) * 3), Y + 2, C.wool);
    rect(fg, X + 2, Y + 8, 2, 2, C.plum);
    rect(fg, X + 24, Y + 8, 2, 2, C.plum);
  });
}

// A hay rack: a slatted V on four legs, hay heaped above it and pulled out
// through the slats, wisps fallen below. (x, base) is its left foot; fine.
const RACK = [
  '....y..yy.y..y.y......',
  '..yyy.yyyyyyyyyyy.y...',
  '.yyyyyyywyyyyyyyyyyy..',
  'yyyywyyyyyyyyyywyyyyy.',
  'pppppppppppppppppppppp',
  'pyypyypyypyypyypyypyyp',
  '.pyypyypyypyypyypyypp.',
  '..pyypyypyypyypyyppp..',
  '...pyypyypyypyyp.p....',
  '....pppppppppppppp....',
  '....pp..........pp....',
  '....pp..........pp....',
  '....pp..........pp....',
];
const RC: Record<string, string> = { p: C.plum, y: C.butter, w: C.wool };

function hayRack(g: CanvasRenderingContext2D, x: number, base: number) {
  fine(g, (fg) => {
    const X = x * PX - 4, B = base * PX + 1;
    rect(fg, X + 3, B + 1, 18, 1, C.sage);
    for (const [wx, wy] of [[2, 0], [5, -1], [17, 0], [20, -1]]) px(fg, X + wx, B + wy, C.butter);
    const top = B - RACK.length + 1;
    for (let r = 0; r < RACK.length; r++)
      for (let c = 0; c < RACK[r].length; c++) {
        const ch = RACK[r][c];
        if (ch !== '.') px(fg, X + c, top + r, RC[ch]);
      }
  });
  if (seasonLook.snow > 0.4) snowCap(g, x - 1, base - 6, 11);
}

// A small field shelter: an open-fronted lean-to with a single-pitch roof
// in the ranch's roofing, boarded sides, straw bedding in the dark inside.
// (x, base) is its front left foot; 24 wide. Fine grid.
function shelterInside(g: CanvasRenderingContext2D, x: number, base: number) {
  fine(g, (fg) => {
    const X = x * PX, B = base * PX + 1, T = B - 40;
    rect(fg, X + 4, T + 10, 40, 30, C.plum);
    // Straw bedding in the light at the front, in tufts.
    for (let yy = B - 8; yy <= B; yy++)
      for (let xx = X + 6; xx < X + 42; xx++) {
        const h = hash2(xx >> 1, yy >> 1, 413);
        if (h < 0.6 - (B - yy) * 0.07) px(fg, xx, yy, h < 0.12 ? C.wool : C.butter);
      }
    rect(fg, X + 4, T + 10, 40, 2, C.sage);
    // The back wall's boards in the dark.
    for (let xx = X + 9; xx < X + 42; xx += 6) rect(fg, xx, T + 12, 1, 18, C.sage);
  });
}

function shelterFrame(g: CanvasRenderingContext2D, x: number, base: number) {
  const roof = ROOFS[farmLook.roof];
  fine(g, (fg) => {
    const X = x * PX, B = base * PX + 1, T = B - 40;
    // Boarded sides seen edge-on, the left in shade.
    rect(fg, X, T + 8, 4, 33, C.sage);
    rect(fg, X + 44, T + 8, 4, 33, C.wool);
    for (let yy = T + 12; yy < B; yy += 5) {
      rect(fg, X, yy, 4, 1, C.plum);
      rect(fg, X + 44, yy, 4, 1, C.sage);
    }
    // Front posts, lit on the right.
    for (const px0 of [X + 4, X + 41]) {
      rect(fg, px0, T + 10, 3, 31, C.plum);
      rect(fg, px0 + 2, T + 11, 1, 29, C.sage);
    }
    // The roof: courses sloping to the front eave, a pale ridge, a dark lip.
    rect(fg, X - 2, T, 52, 10, roof.base);
    for (let r = 3; r < 9; r += 3) rect(fg, X - 1, T + r, 50, 1, roof.course);
    rect(fg, X - 2, T, 52, 1, C.sage);
    rect(fg, X - 2, T + 9, 52, 1, C.plum);
    rect(fg, X + 49, T + 1, 1, 8, C.sage);
  });
  snowCap(g, x - 1, base - 20, 26, base - 15);
}

// ---- The floor ----

// 0 for a pen, 1 for a field: how much the floor reads as grazed grass with
// lanes rather than trodden straw.
function fieldness(p: Pen) {
  const m = Math.min(p.ix1 - p.ix0, p.iy1 - p.iy0);
  return Math.max(0, Math.min(1, (m - 48) / 32));
}

// How trodden the ground is by distance from the fence: the stock walk a
// lane a couple of pixels in.
const LANE = [0.3, 0.6, 0.85, 0.7, 0.35, 0.12, 0];

const floors = new Map<number, { key: string; c: HTMLCanvasElement; x: number; y: number; w: number; h: number }>();
const APRON = 10;

function floorPicture(p: Paddock, fixtures: Fixture[], s: { x0: number; y0: number; x1: number; y1: number }) {
  const snow = seasonLook.snow > 0.4 ? 2 : seasonLook.snow > 0.15 ? 1 : 0;
  const bloom = seasonLook.bloom > 0.3 ? 1 : 0;
  const h = p.hurdle;
  const key = `${p.x0},${p.y0},${p.x1},${p.y1}|${s.x0},${s.y0},${s.x1},${s.y1}|${fixtures.map((f) => f.kind + f.tx + ',' + f.ty).join(';')}|${h ? `${h.vertical}${h.at},${h.gate}` : ''}|${snow}${bloom}`;
  const old = floors.get(p.id);
  if (old && old.key === key) return old;
  if (floors.size > 64) floors.clear();
  const x = p.x0 - APRON, y = p.y0 - APRON;
  const w = p.x1 - p.x0 + APRON * 2, hh = p.y1 - p.y0 + APRON * 2;
  // Always a new canvas: the picture cache knows an image by its object, so
  // repainting the old one would leave the cached ranch showing the old floor.
  // It is fine: PX canvas pixels to a world pixel, drawn back at world size.
  const c = makeCanvas(w * PX, hh * PX)[0];
  paintFloor(c, p, fixtures, s, x, y, snow, bloom);
  const e = { key, c, x, y, w, h: hh };
  floors.set(p.id, e);
  return e;
}

// Distance from (x, y) to the rectangle x0..x1, y0..y1 (0 inside).
const rectDist = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const WISPS = [['yy', '.y'], ['y.', '.yy'], ['.y', 'yw'], ['yyy']];
const TUSSOCK = [['s.s', 'sos'], ['.s.', 'sos', 'oso'], ['s..s', '.ss.']];
const HOOF = ['s.s'];

// The floor on the fine grid: trodden ground as clean worn shapes with a
// short dithered edge (lanes inside the fence, the gate's apron muddy in the
// middle and printed with hooves, the track to the trough, rings round the
// fixtures), straw in wisps, and on a big field tussocks in the corners the
// stock leave alone and flowers in spring and summer.
function paintFloor(c: HTMLCanvasElement, p: Paddock, fixtures: Fixture[], s: { x0: number; y0: number; x1: number; y1: number }, ox: number, oy: number, snow: number, bloom: number) {
  const W = c.width, H = c.height;
  const cg = c.getContext('2d')!;
  const img = cg.createImageData(W, H);
  const d = new Uint32Array(img.data.buffer);
  const COLS: Record<string, number> = { y: U32.butter, w: U32.wool, s: U32.sage, o: U32.moss };
  const putF = (FX: number, FY: number, rows: string[], only?: (i: number) => boolean) => {
    for (let r = 0; r < rows.length; r++)
      for (let k = 0; k < rows[r].length; k++) {
        const ch = rows[r][k];
        if (ch === '.') continue;
        const x = FX + k, y = FY + r;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (only && !only(y * W + x)) continue;
        d[y * W + x] = COLS[ch];
      }
  };
  const f = fieldness(p);
  const ix0 = p.ix0, iy0 = p.iy0, ix1 = p.ix1 - 1, iy1 = p.iy1 - 1;
  // The gate's mouth, just inside and just outside.
  const [ax, ay] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.rot];
  const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
  const inX = mx - ax * 7, inY = my - ay * 7;
  // The worn track runs from the gate to the first trough or rack, or
  // towards the middle of a field.
  const goal = fixtures.find((q) => q.kind === 'trough') ?? fixtures.find((q) => q.kind === 'rack');
  const gx = goal ? goal.tx * TS + 8 : (p.ix0 + p.ix1) / 2, gyy = goal ? goal.ty * TS + 8 : (p.iy0 + p.iy1) / 2;
  const tdx = gx - inX, tdy = gyy - inY, tl2 = tdx * tdx + tdy * tdy || 1;
  const fx = fixtures.map((q) => {
    const [fw, fh] = FIXTURE_SIZE[q.kind];
    return { kind: q.kind, x0: q.tx * TS, y0: q.ty * TS, x1: (q.tx + fw) * TS - 1, y1: (q.ty + fh) * TS - 1 };
  });
  const hl = p.hurdle ? hurdleLine(p, p.hurdle, p.y0 + CS - 1, p.y1 - 1, p.x0 + 1, p.x1 - CS + 1) : null;
  const R = 9 + 4 * f;
  const strawAt = new Float32Array(W * H);
  const inside = new Uint8Array(W * H);

  for (let FY = 0; FY < H; FY++)
    for (let FX = 0; FX < W; FX++) {
      const x = ox + FX / PX, y = oy + FY / PX;
      const i = FY * W + FX;
      const bay = BAY[(FY & 3) * 4 + (FX & 3)] / 16;
      const isIn = x >= ix0 && x <= ix1 + 0.5 && y >= iy0 && y <= iy1 + 0.5;
      if (!isIn) {
        // Outside, only the worn apron in front of the gate.
        const beyond = p.rot === 0 ? y >= p.y1 : p.rot === 2 ? y < p.y0 : p.rot === 1 ? x < p.x0 : x >= p.x1;
        if (!beyond) continue;
        const dOut = Math.hypot(x - (mx + ax * 6), (y - (my + ay * 6)) * (ax ? 1 : 1.4));
        const k = 1 - dOut / 8;
        if (k > 0.45) d[i] = U32.moss;
        else if (k > 0.15 && bay < (k - 0.15) / 0.3) d[i] = U32.moss;
        continue;
      }
      inside[i] = 1;
      // The gate apron: trodden hard, muddy in the middle.
      const dg = Math.hypot(x - inX, (y - inY) * (ax ? 1.4 : 1));
      // Lanes along the fence (and both sides of a hurdle).
      let de = Math.min(x - ix0, ix1 - x, y - iy0, iy1 - y);
      if (hl) de = Math.min(de, hl.base ? Math.abs(y - hl.base) - 1 : Math.abs(x - hl.x - 1) - 1);
      const lane = (de < 0 ? 0 : LANE[Math.min(LANE.length - 1, Math.floor(de))]) * (0.6 + 0.4 * f);
      // The track from the gate.
      const u = Math.max(0, Math.min(1, ((x - inX) * tdx + (y - inY) * tdy) / tl2));
      const dt = Math.hypot(x - (inX + tdx * u), y - (inY + tdy * u));
      const reach = goal ? 1 : 0.55;
      const track = dt < 3.5 && u < reach ? (dt < 1.5 ? 0.85 : dt < 2.5 ? 0.6 : 0.3) * (1 - (u / reach) * (goal ? 0.25 : 0.9)) : 0;
      let ringK = 0, straw = 0;
      for (const q of fx) {
        const r = rectDist(x, y, q.x0, q.y0, q.x1, q.y1);
        if (r < 6) ringK = Math.max(ringK, 0.8 * (1 - r / 6));
        if (q.kind !== 'trough' && r < 9) straw = Math.max(straw, 0.5 * (1 - r / 9));
      }
      const apron = dg < R ? 1.15 - dg / R : 0;
      // A pen's floor is trodden all over and strewn with straw.
      const pen = 1 - f;
      const trod = Math.max(lane, track, ringK, apron, pen * 0.35);
      strawAt[i] = Math.max(straw, pen * 0.18);
      if (dg < R * 0.4) d[i] = U32.sage; // mud
      else if (trod > 0.6) d[i] = U32.moss;
      else if (trod > 0.38 && bay < (trod - 0.38) / 0.22) d[i] = U32.moss;
    }
  // Straw in wisps, hoofprints in the apron, and on a field tussocks and
  // flowers, all as little drawn things on a jittered grid.
  const cell = (cw: number, chh: number, seed: number, fn: (FX: number, FY: number, h: number, cx: number, cy: number) => void) => {
    for (let cy = 0; cy * chh < H; cy++)
      for (let cx = 0; cx * cw < W; cx++) {
        const FX = cx * cw + Math.floor(hash2(cx, cy, seed) * (cw - 1)), FY = cy * chh + Math.floor(hash2(cx, cy, seed + 1) * (chh - 1));
        if (FX >= W || FY >= H) continue;
        fn(FX, FY, hash2(cx, cy, seed + 2), cx, cy);
      }
  };
  const inPen = (i: number) => inside[i] === 1;
  cell(5, 4, 440, (FX, FY, h, cx) => {
    const i = FY * W + FX;
    if (!inside[i] || h > strawAt[i]) return;
    putF(FX, FY, WISPS[cx % WISPS.length], inPen);
  });
  cell(7, 6, 450, (FX, FY, h) => {
    const x = ox + FX / PX, y = oy + FY / PX;
    const dg = Math.hypot(x - inX, (y - inY) * (ax ? 1.4 : 1));
    if (dg > R * 0.95 || dg < R * 0.4 || h > 0.5 || snow > 1) return;
    putF(FX, FY, HOOF, inPen);
  });
  if (f > 0 && !snow) {
    cell(9, 7, 460, (FX, FY, h, cx) => {
      const i = FY * W + FX;
      if (!inside[i] || d[i]) return;
      const x = ox + FX / PX, y = oy + FY / PX;
      const corner = Math.min(Math.hypot(x - ix0, y - iy0), Math.hypot(ix1 - x, y - iy0), Math.hypot(x - ix0, iy1 - y), Math.hypot(ix1 - x, iy1 - y));
      const rough = corner < 26 ? 0.5 * (1 - corner / 26) : 0.04;
      if (h < rough * f) putF(FX, FY - 1, TUSSOCK[cx % TUSSOCK.length], (k) => inside[k] === 1 && !d[k]);
      else if (bloom && h > 1 - 0.05 * f) putF(FX, FY, cx & 1 ? ['.w.', 'wyw', '.w.'] : ['.y.', 'yoy', '.y.'], (k) => inside[k] === 1 && !d[k]);
    });
  }
  cg.clearRect(0, 0, W, H);
  cg.putImageData(img, 0, 0);
}
