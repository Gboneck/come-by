import { C, U32 } from '../palette';
import { px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { makeCanvas } from '../gfx/screen';
import { hash2 } from '../rng';
import { ROOFS, farmLook } from './ranchstyle';
import { seasonLook, snowCap } from './seasonlook';
import { drawGood, gateLeaf, groundShadow, post, postCap, railCol, type Drawable } from './buildings';
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
type Paddock = Pen & { fixtures?: Fixture[]; hurdle?: Hurdle };

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

// A corner or gate post: taller and stouter than the rest, on a stone.
function heavyPost(g: CanvasRenderingContext2D, x: number, base: number, sturdy: boolean) {
  const h = sturdy ? 8 : 7;
  rect(g, x, base - h + 1, 2, h, C.plum);
  rect(g, x, base - h + 1, 2, 1, sturdy || seasonLook.snow > 0.4 ? C.wool : postCap(x, base));
  px(g, x - 1, base, C.wool);
  px(g, x + 2, base, C.sage);
  px(g, x + 2, base - 1, C.sage);
}

// A north or south side of fence: rails post to post, worn here and there.
function hSide(g: CanvasRenderingContext2D, xs: number[], base: number, gap: [number, number] | undefined, sturdy: boolean, a: number, b: number) {
  const rc = railCol();
  const gate = (q: number) => !!gap && (q === gap[0] || q === gap[1] - 1);
  for (let i = 0; i + 1 < xs.length; i++) {
    const xa = xs[i], xb = xs[i + 1];
    if (gap && xa === gap[0]) continue;
    const w = xb - xa - 2;
    if (w <= 0) continue;
    rect(g, xa + 2, base + 1, w + 2, 1, C.sage);
    const wear = hash2(xa, base, 409);
    const sag = wear > 0.84 && w >= 6;
    rect(g, xa + 2, base - 2, w, 1, rc);
    if (sag) {
      rect(g, xa + 2, base - 4, 2, 1, rc);
      rect(g, xa + 4, base - 3, w - 4, 1, rc);
      rect(g, xb - 2, base - 4, 2, 1, rc);
    } else rect(g, xa + 2, base - 4, w, 1, rc);
    if (sturdy) rect(g, xa + 2, base - 6, w, 1, rc);
    // Knots, and a weathered grey streak along the odd rail.
    for (let x = xa + 2; x < xb; x++) {
      if (hash2(x, base, 404) < 0.05) px(g, x, base - 4, C.sage);
      if (wear < 0.14 && hash2(x, base, 411) < 0.35) px(g, x, base - 2, C.sage);
    }
  }
  for (const x of xs) {
    if (x === a || x === b || gate(x)) heavyPost(g, x, base, sturdy);
    else post(g, x, base, sturdy);
  }
}

// One stretch of an east or west side, post `ya` to post `yb`: the rails as
// two lines in 3/4 view, and the post at the top unless it is a corner.
function vStretch(g: CanvasRenderingContext2D, x: number, ya: number, yb: number, rail: boolean, top: 'none' | 'post' | 'heavy', sturdy: boolean) {
  if (rail && yb > ya) {
    const rc = railCol();
    rect(g, x + 2, ya - 2, 1, yb - ya, C.sage);
    rect(g, x, ya - 4, 1, yb - ya, rc);
    rect(g, x + 1, ya - 3, 1, yb - ya, rc);
    if (sturdy) rect(g, x, ya - 6, 1, yb - ya, rc);
    const wear = hash2(x, ya, 405);
    if (wear < 0.4) px(g, x + 1, ya + Math.floor(hash2(x, ya, 406) * (yb - ya)) - 3, C.sage);
    else if (wear > 0.86) for (let y = ya; y < yb; y++) if (hash2(x, y, 412) < 0.4) px(g, x, y - 4, C.sage);
  }
  if (top === 'heavy') heavyPost(g, x, ya, sturdy);
  else if (top === 'post') post(g, x, ya, sturdy);
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

  out.push({ y: -1e9 + p.id, draw: () => { const f = floorPicture(p, fixtures, s); g.drawImage(f.c, f.x, f.y); } });

  for (const f of fixtures) out.push(...fixtureDrawables(g, f, t));

  if (p.goods > 0 && p.species) {
    const n = Math.min(12, p.goods);
    const sp = p.species;
    out.push({
      y: p.iy1 - 2,
      draw: () => {
        for (let i = 0; i < n; i++) {
          const gx = p.ix0 + 3 + (i % 6) * 4, gy = p.iy1 - 4 - Math.floor(i / 6) * 4;
          drawGood(g, sp, gx, gy);
        }
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
        const label = p.full ? 'FULL' : `${p.animals.length}/${cap}`;
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
      return [
        { y: -1e8 + x * 0.001 + y, draw: () => groundShadow(g, x, y - 6, x + 24, y + 15) },
        { y: y + 15, draw: () => shelter(g, x, y + 15) },
      ];
  }
}

// A plum water trough on stubby legs, a glint moving on the water.
function trough(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  rect(g, x - 1, y + 5, 14, 1, C.sage);
  rect(g, x, y, 14, 4, C.plum);
  rect(g, x + 1, y + 1, 12, 1, seasonLook.snow > 0.7 ? C.wool : C.teal);
  rect(g, x, y, 14, 1, C.moss);
  px(g, x + 4 + (Math.floor(t * 2) % 5), y + 1, C.wool);
  px(g, x + 1, y + 4, C.plum);
  px(g, x + 12, y + 4, C.plum);
}

// A hay rack: a slatted V on four legs, hay heaped above it and pulled out
// through the slats. (x, base) is its left foot.
const RACK = [
  '..y.yywyy.y...',
  '.yyyyyyyyyyyy.',
  'pppppppppppppp',
  'pypypypypypypy',
  '.ypypypypypyp.',
  '..pppppppppp..',
  '..p........p..',
  '..p........p..',
];
const RC: Record<string, string> = { p: C.plum, y: C.butter, w: C.wool };

function hayRack(g: CanvasRenderingContext2D, x: number, base: number) {
  rect(g, x + 2, base + 1, 11, 1, C.sage);
  const top = base - RACK.length + 1;
  for (let r = 0; r < RACK.length; r++)
    for (let c = 0; c < RACK[r].length; c++) {
      const ch = RACK[r][c];
      if (ch !== '.') px(g, x + c, top + r, RC[ch]);
    }
  if (seasonLook.snow > 0.4) snowCap(g, x + 1, top, 12);
}

// A small field shelter: an open-fronted lean-to with a single-pitch roof
// in the ranch's roofing, boarded sides, straw bedding in the dark inside.
// (x, base) is its front left foot; 24 wide.
function shelter(g: CanvasRenderingContext2D, x: number, base: number) {
  const roof = ROOFS[farmLook.roof];
  const top = base - 20;
  // Inside: dark, straw on the floor.
  rect(g, x + 2, top + 5, 20, 15, C.plum);
  for (let yy = base - 4; yy <= base; yy++)
    for (let xx = x + 3; xx < x + 21; xx++) {
      const h = hash2(xx, yy, 413);
      if (h < 0.55 - (base - yy) * 0.1) px(g, xx, yy, h < 0.1 ? C.wool : C.butter);
    }
  rect(g, x + 2, top + 5, 20, 1, C.sage);
  // Boarded sides seen edge-on, the left in shade.
  rect(g, x, top + 4, 2, 17, C.sage);
  rect(g, x + 22, top + 4, 2, 17, C.wool);
  for (let yy = top + 6; yy < base; yy += 3) {
    px(g, x, yy, C.plum);
    px(g, x + 22, yy, C.sage);
  }
  // Front posts.
  rect(g, x + 2, top + 5, 1, 16, C.plum);
  rect(g, x + 21, top + 5, 1, 16, C.plum);
  // The roof: a slope from the high back to the front eave.
  rect(g, x - 1, top, 26, 5, roof.base);
  for (let xx = x; xx < x + 25; xx += 2) px(g, xx, top + 1 + ((xx >> 1) & 1), roof.course);
  rect(g, x - 1, top, 26, 1, C.sage);
  rect(g, x - 1, top + 4, 26, 1, C.plum);
  px(g, x + 24, top + 1, C.sage);
  px(g, x + 24, top + 2, C.sage);
  snowCap(g, x - 1, top, 26, top + 5);
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

const floors = new Map<number, { key: string; c: HTMLCanvasElement; x: number; y: number }>();
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
  const c = makeCanvas(w, hh)[0];
  paintFloor(c, p, fixtures, s, x, y, snow, bloom);
  const e = { key, c, x, y };
  floors.set(p.id, e);
  return e;
}

// Distance from (x, y) to the rectangle x0..x1, y0..y1 (0 inside).
const rectDist = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

function paintFloor(c: HTMLCanvasElement, p: Paddock, fixtures: Fixture[], s: { x0: number; y0: number; x1: number; y1: number }, ox: number, oy: number, snow: number, bloom: number) {
  const W = c.width, H = c.height;
  const cg = c.getContext('2d')!;
  const img = cg.createImageData(W, H);
  const d = new Uint32Array(img.data.buffer);
  const set = (x: number, y: number, col: number) => {
    const i = (y - oy) * W + (x - ox);
    if (x >= ox && y >= oy && x < ox + W && y < oy + H) d[i] = col;
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

  for (let y = oy; y < oy + H; y++)
    for (let x = ox; x < ox + W; x++) {
      const inside = x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1;
      // Outside, only the worn apron in front of the gate.
      const dOut = Math.hypot(x - (mx + ax * 6), (y - (my + ay * 6)) * (ax ? 1 : 1.4));
      if (!inside) {
        const beyond = p.rot === 0 ? y >= p.y1 : p.rot === 2 ? y < p.y0 : p.rot === 1 ? x < p.x0 : x >= p.x1;
        if (!beyond || dOut > 8) continue;
        const k = 1 - dOut / 8;
        const hh = hash2(x, y, 414);
        if (((x + y) & 1) === 0 && hh < k * 0.9) set(x, y, U32.moss);
        else if (hh < k * 0.12) set(x, y, U32.sage);
        continue;
      }
      const hh = hash2(x, y, 410);
      // The gate apron: trodden hard, muddy in the middle.
      const dg = Math.hypot(x - inX, (y - inY) * (ax ? 1.4 : 1));
      if (dg < R) {
        const k = 1.15 - dg / R;
        if (dg < R * 0.45 && hh < 0.16) { set(x, y, U32.sage); continue; }
        if (((x + y) & 1) === 0 && hh < k) { set(x, y, U32.moss); continue; }
      }
      // Lanes along the fence (and both sides of a hurdle).
      let de = Math.min(x - ix0, ix1 - x, y - iy0, iy1 - y);
      if (hl) de = Math.min(de, hl.base ? Math.abs(y - hl.base) - 1 : Math.abs(x - hl.x - 1) - 1);
      const lane = (de < 0 ? 0 : LANE[Math.min(LANE.length - 1, Math.floor(de))]) * (0.6 + 0.4 * f);
      // The track from the gate.
      const u = Math.max(0, Math.min(1, ((x - inX) * tdx + (y - inY) * tdy) / tl2));
      const dt = Math.hypot(x - (inX + tdx * u), y - (inY + tdy * u));
      const reach = goal ? 1 : 0.55;
      const track = dt < 3.5 && u < reach ? (dt < 1.5 ? 0.85 : dt < 2.5 ? 0.55 : 0.25) * (1 - (u / reach) * (goal ? 0.25 : 0.9)) : 0;
      // Bare rings round the fixtures, straw round the rack and shelter.
      let ringK = 0, straw = 0;
      for (const q of fx) {
        const r = rectDist(x, y, q.x0, q.y0, q.x1, q.y1);
        if (r < 6) ringK = Math.max(ringK, 0.55 * (1 - r / 6));
        if (q.kind !== 'trough' && r < 9) straw = Math.max(straw, 0.16 * (1 - r / 9));
      }
      // A pen's floor is trodden all over and strewn with straw.
      const pen = 1 - f;
      const trod = Math.max(lane, track, ringK, pen * 0.1);
      straw = Math.max(straw, pen * 0.04);
      if (trod > 0.6 && hash2(x, y, 419) < (trod - 0.6) * 0.3) set(x, y, U32.sage);
      else if (hh < trod * (((x + y) & 1) === 0 ? 1 : 0.55)) set(x, y, U32.moss);
      else if (hash2(x, y, 415) < straw) set(x, y, hash2(x, y, 416) < 0.2 ? U32.wool : U32.butter);
      else if (f > 0 && de > 6 && dt > 5) {
        // A grazed field: the odd tussock, and flowers in spring and summer.
        const k = hash2(x, y, 417);
        // Longer grass in the corners the stock leave alone.
        const corner = Math.min(Math.hypot(x - ix0, y - iy0), Math.hypot(ix1 - x, y - iy0), Math.hypot(x - ix0, iy1 - y), Math.hypot(ix1 - x, iy1 - y));
        const rough = corner < 26 && dg > R * 2 ? 0.02 * (1 - corner / 26) : 0;
        if (k < (0.004 + rough) * f && !snow) {
          set(x, y, U32.sage);
          set(x, y - 1, U32.moss);
        } else if (bloom && k > 1 - 0.003 * f && !snow) set(x, y, hash2(x, y, 418) < 0.5 ? U32.butter : U32.wool);
      }
    }
  cg.clearRect(0, 0, W, H);
  cg.putImageData(img, 0, 0);
}
