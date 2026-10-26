import { C } from '../palette';
import { ellipse, line, px, rect } from '../gfx/draw';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { PX, fine } from '../gfx/screen';
import { crown, grid, scale2x } from './fine';
import { hash2 } from '../rng';
import { gust } from '../render/wind';
import type { Game } from '../game';
import type { Drawable } from './buildings';
import { PLACES, PROPS, propShown, type KeepsakeId, type Prop } from '../world/places';

// The hidden places' furniture, drawn in code: standing stones, cairns, old
// fruit trees, a willow, the ruined hut and its fold, the showman's wagon,
// the falls, the Drove Trail's hurdle, waymarker cairns, and the keepsakes
// lying where they were left (with a glint, so they can be spotted).
// Lit from the upper right like the buildings: left faces shaded, shadows
// down-left on the ground.

const ground = (draw: () => void, k = 0): Drawable => ({ y: -1e8 + k, draw });

// Everything here is drawn on the fine grid (two fine pixels to a world
// pixel); positions and sizes come in world pixels as before.
const F = PX;

// ---- Stones ----

// A rounded stone: plum rim, wool face, sage on the shaded (left, lower)
// side, a lit edge, moss on its top now and then.
function pebbleF(fg: CanvasRenderingContext2D, X: number, Y: number, rx: number, ry: number, moss = false) {
  ellipse(fg, X, Y, rx + 1, ry + 1, C.plum);
  ellipse(fg, X, Y, rx, ry, C.wool);
  ellipse(fg, X - Math.round(rx * 0.35), Y + Math.round(ry * 0.35), Math.max(1, Math.round(rx * 0.6)), Math.max(1, Math.round(ry * 0.55)), C.sage);
  ellipse(fg, X + Math.round(rx * 0.15), Y - Math.round(ry * 0.25), Math.max(1, Math.round(rx * 0.55)), Math.max(0, Math.round(ry * 0.45)), C.wool);
  if (rx >= 3) px(fg, X + Math.round(rx * 0.5), Y - Math.round(ry * 0.6), C.wool);
  if (moss) { rect(fg, X, Y - ry, 3, 1, C.moss); px(fg, X + 1, Y - ry - 1, C.moss); }
}
export function pebble(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, moss = false) {
  fine(g, (fg) => pebbleF(fg, x * F, y * F, rx * F, ry * F, moss));
}

// Standing stones: rough, tapering, a little askew; never two alike.
// Lit from the upper right, lichen (moss) on the shaded side. The old grids
// put on the fine grid with Scale2x, so their outlines round off.
const STONES: string[][] = [
  ['...pp..', '..pwwp.', '..pwwwp', '.pswwwp', '.pswwop', '.psswwp', '.psswwp', 'pssowwp', 'psswwwp', 'pssswwp', 'psssswp', '.ppppp.'],
  ['....pp.', '..ppwwp', '.pswwwp', 'pssowwp', 'psswwwp', 'psswwwp', 'pssswwp', 'pssswop', '.ppppp.'],
  ['..pp..', '.pwwp.', '.pswwp', '.pswwp', 'psswwp', 'psowwp', 'psswwp', 'psswwp', 'pssowp', 'psssswp', '.ppppp'],
  ['.pp....', 'pwwpp..', 'pswwwp.', 'psswwwp', 'pssowwp', 'psswwwp', 'pssswwp', 'pssswwp', 'psssswp', '.ppppp.'],
];
const FALLEN = ['..ppppppppp..', '.pwwwwwwwwwwp', 'pswwwowwwwwwp', 'psswwwwwwowwp', 'psssssssssssp', '.ppppppppppp.'];
let stoneSprites: Sprite[] | null = null;
let fallenSprite: Sprite | null = null;

function standingStone(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  stoneSprites ??= STONES.map((r) => { const d = scale2x(r); return spr(d, Math.floor(d[0].length / 2), d.length - 1, { density: PX }); });
  drawSpr(g, stoneSprites[v % STONES.length], x, y, v % 3 === 2);
}

export function fallenStone(g: CanvasRenderingContext2D, x: number, y: number) {
  if (!fallenSprite) { const d = scale2x(FALLEN); fallenSprite = spr(d, Math.floor(d[0].length / 2), d.length - 1, { density: PX }); }
  drawSpr(g, fallenSprite, x, y);
}

// Cairns: v 0 a waymarker, 1 the lookout's, 2 the old cairn on the heights.
const CAIRNS: [number, number, number, number][][] = [
  [[0, 0, 2, 1], [0, -3, 2, 1], [0, -5, 1, 1]],
  [[-4, 0, 3, 2], [3, 0, 3, 2], [-1, -3, 3, 2], [2, -6, 2, 1], [-2, -6, 2, 1], [0, -9, 2, 1], [0, -11, 1, 1]],
  [[-5, 0, 3, 2], [1, 0, 3, 2], [5, -1, 2, 1], [-2, -4, 3, 2], [3, -4, 2, 2], [0, -8, 3, 2], [-1, -11, 2, 1], [1, -14, 2, 1], [0, -16, 1, 1]],
];
function cairn(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  fine(g, (fg) => CAIRNS[v].forEach(([dx, dy, rx, ry], i) => pebbleF(fg, (x + dx) * F, (y + dy) * F, rx * F, ry * F, i % 3 === 1)));
}

// A waymarker cairn by a hidden way. Once its place is found, a buttercup
// flower sits on top: that way has been walked.
function waymarker(g: CanvasRenderingContext2D, x: number, y: number, found: boolean) {
  fine(g, (fg) => {
    const X = x * F, Y = y * F;
    rect(fg, X - 7, Y, 2, 1, C.moss); px(fg, X - 6, Y - 1, C.moss);
    rect(fg, X + 6, Y - 2, 2, 1, C.moss); px(fg, X + 6, Y - 3, C.moss);
  });
  cairn(g, x, y, 0);
  if (found)
    fine(g, (fg) => {
      const X = x * F, Y = (y - 7) * F;
      rect(fg, X - 2, Y, 5, 1, C.butter);
      rect(fg, X, Y - 2, 1, 5, C.butter);
      rect(fg, X - 1, Y - 1, 3, 3, C.butter);
      px(fg, X, Y, C.wool);
    });
}

// ---- Trees ----

// An old fruit tree: a gnarled trunk, a crown of clumps, fruit in it and
// windfalls in the grass.
function fruitTree(g: CanvasRenderingContext2D, x: number, y: number, v: number, t: number) {
  const lean = v % 3 === 0 ? 1 : 0;
  const sway = gust(x, y, t) > 0.8 ? 1 : 0;
  fine(g, (fg) => {
    const X = x * F, Y = y * F + 1;
    rect(fg, X - 2, Y - 13, 4, 14, C.plum);
    rect(fg, X + 1, Y - 12, 1, 11, C.sage);
    rect(fg, X - 4, Y, 3, 1, C.plum);
    rect(fg, X + 2, Y - 15, 2 + lean * 2, 3, C.plum);
    const CX = (x + lean + sway) * F, CY = (y - 11) * F;
    crown(fg, CX, CY, [[-6, 2, 7], [6, 1, 7], [-3, -4, 7], [5, -5, 6], [0, 2, 8]]);
    // Fruit, and windfalls in the grass.
    for (let i = 0; i < 6; i++) {
      const fx = CX - 9 + Math.floor(hash2(v, i, 71) * 18), fy = CY - 4 + Math.floor(hash2(v, i, 72) * 10);
      rect(fg, fx, fy, 2, 2, C.butter);
      px(fg, fx + 1, fy, C.wool);
    }
    rect(fg, X + 6, Y + 1, 2, 2, C.butter);
    if (v % 2) rect(fg, X - 8, Y + 3, 2, 2, C.butter);
  });
}

// The willow at the pool: a crown and hanging fronds combed by the wind.
function willow(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    const X = x * F, Y = y * F + 1;
    rect(fg, X - 2, Y - 17, 5, 18, C.plum);
    rect(fg, X + 2, Y - 15, 1, 14, C.sage);
    rect(fg, X - 5, Y, 3, 1, C.plum);
    rect(fg, X + 3, Y, 3, 1, C.plum);
    crown(fg, X, Y - 28, [[-10, 2, 8], [10, 2, 8], [-4, -3, 9], [6, -4, 8], [0, 3, 9]]);
    for (let i = -18; i <= 18; i++) {
      const top = Y - 26 + Math.round(Math.sqrt(Math.max(0, 1 - (i / 20) ** 2)) * 6);
      const len = 16 + Math.floor(hash2(i, 3, 81) * 10) - (Math.abs(i) < 6 ? 8 : 0);
      const k = gust(x + i, y, t) > 0.6 ? 1 : 0;
      if (i % 2 === 0) continue;
      const col = (i + 40) % 3 === 0 ? C.moss : (i > 0 ? C.sage : C.teal);
      for (let j = 0; j < len; j++) px(fg, X + i + (j > len / 2 ? k : 0), top + j, j === len - 1 ? C.plum : col);
    }
  });
}

// ---- The Shepherd's Hut and its fold: drystone walls ----

// Drystone on the fine grid: courses of rough stones with plum joints, each
// lit along its top, some in shade (sage), the odd one green with moss. In
// world pixels x, y, w, h like before.
function stonesF(fg: CanvasRenderingContext2D, X: number, Y: number, Wd: number, Hd: number, seed: number, shade: number, topAt?: (fx: number) => number) {
  // `topAt` gives a ragged top (a ruin): nothing is drawn above it.
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    if (!topAt) return rect(fg, x, y, w, h, c);
    for (let gx = x; gx < x + w; ) {
      const ge = Math.min(x + w, (Math.floor(gx / 6) + 1) * 6);
      const t = Math.max(y, topAt(gx));
      if (t < y + h) rect(fg, gx, t, ge - gx, y + h - t, c);
      gx = ge;
    }
  };
  box(X, Y, Wd, Hd, C.plum);
  for (let r = 0; r < Hd; r += 6) {
    let i = -Math.floor(hash2(seed, r, 31) * 6);
    while (i < Wd) {
      const sw = 5 + Math.floor(hash2(X + i, Y + r, seed) * 6);
      const a = Math.max(0, i), b = Math.min(Wd, i + sw - 1);
      if (b > a) {
        const k = hash2(X + i, Y + r, seed + 7);
        const face = k < shade ? C.sage : C.wool;
        const h = Math.min(5, Hd - r);
        box(X + a, Y + r, b - a, h, face);
        box(X + a, Y + r, b - a, 1, k < shade * 0.5 ? C.sage : C.wool);
        if (h > 2) box(X + a, Y + r + h - 1, b - a, 1, k < shade ? C.plum : C.sage);
        if (k > 0.93) box(X + a, Y + r, Math.min(3, b - a), 1, C.moss);
      }
      i += sw;
    }
  }
}
export function stones(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, shade: number) {
  fine(g, (fg) => stonesF(fg, x * F, y * F, w * F, h * F, seed, shade));
}

// A wall running east-west seen from the front: a lit top and a shaded
// face. Ruins have a ragged top where stones have fallen off.
export function hWall(g: CanvasRenderingContext2D, x: number, base: number, w: number, face: number, seed: number, ruined: boolean) {
  const top = base - face - 2;
  const drop = (i: number) => (ruined ? Math.floor(hash2(Math.floor((x + i) / 3), base, seed) * 2.4) : 0);
  fine(g, (fg) => {
    const X = x * F, B = base * F + 1, T = top * F;
    const topAt = (fx: number) => T - 2 + drop(Math.floor((fx - X) / F)) * F;
    stonesF(fg, X, T - 2, w * F, 8, seed + 3, 0.15, topAt);
    stonesF(fg, X, (base - face + 1) * F, w * F, (face - 1) * F, seed, 0.55, topAt);
    rect(fg, X, B, w * F, 1, C.sage);
    // A dark lip along the (broken) top.
    for (let i = 0; i < w; i += 3) rect(fg, X + i * F, topAt(X + i * F), Math.min(3, w - i) * F, 1, C.plum);
  });
}

// A wall running north-south, seen from above: its cobbled top, and the
// face of its south end.
export function vWall(g: CanvasRenderingContext2D, x: number, base: number, len: number, face: number, seed: number) {
  fine(g, (fg) => {
    const X = x * F, B = base * F + 1;
    rect(fg, X - 2, B - (len + 1) * F, 12, (len + 1) * F, C.plum);
    stonesF(fg, X, B - len * F, 8, (len - face) * F, seed, 0.2);
    rect(fg, X, B - len * F, 2, (len - face) * F, C.sage); // the shaded west lip
    stonesF(fg, X, B - (face - 1) * F, 8, (face - 1) * F, seed + 5, 0.6);
    rect(fg, X - 2, B, 12, 1, C.sage);
  });
}

function rubble(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  fine(g, (fg) => {
    for (let i = 0; i < (w * h) / 10; i++) {
      const rx = x + Math.floor(hash2(i, seed, 91) * w), ry = y + Math.floor(hash2(i, seed, 92) * h);
      pebbleF(fg, rx * F, ry * F, (1 + (i % 2)) * F, F, i % 4 === 1);
    }
  });
}

// The hut's floor: trodden earth worn clean, a cold hearth of stones with
// its ash, a fallen roof beam.
function hutFloor(g: CanvasRenderingContext2D) {
  fine(g, (fg) => {
    const X0 = 252 * F, Y0 = 636 * F, X1 = 292 * F, Y1 = 662 * F;
    for (let y = Y0; y < Y1; y++) {
      const e = Math.min(y - Y0, Y1 - 1 - y);
      for (let x = X0; x < X1; x++) {
        const ee = Math.min(e, x - X0, X1 - 1 - x);
        if (ee > 3 || ((x + y) & 1) === 0 && ee > 1) px(fg, x, y, ee > 6 ? C.moss : C.sage);
      }
    }
    for (const [hx, hy] of [[282, 641], [287, 643], [284, 646], [280, 644]]) pebbleF(fg, hx * F, hy * F, 4, 2);
    rect(fg, 283 * F, 642 * F, 6, 4, C.plum);
    px(fg, 284 * F, 643 * F, C.sage);
    line(fg, 256 * F, 646 * F, 276 * F, 658 * F, C.plum);
    line(fg, 256 * F, 645 * F, 276 * F, 657 * F, C.plum);
    line(fg, 257 * F, 644 * F, 277 * F, 656 * F, C.sage);
  });
}

// ---- The Showman's Wagon ----

function wagon(g: CanvasRenderingContext2D, x: number, y: number) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1, L = (x - 13) * F, R = (x + 13) * F;
    const wheel = (cx: number, cy: number, broken: boolean) => {
      ellipse(fg, cx, cy, 8, 8, C.plum);
      ellipse(fg, cx, cy, 6, 6, C.sage);
      ellipse(fg, cx, cy, 5, 5, C.plum);
      for (let k = 0; k < 8; k++) {
        if (broken && (k === 2 || k === 5)) continue;
        const a = (k / 8) * Math.PI * 2;
        line(fg, cx, cy, cx + Math.round(Math.cos(a) * 5), cy + Math.round(Math.sin(a) * 5), C.sage);
      }
      rect(fg, cx - 1, cy - 1, 3, 3, C.wool);
    };
    // Body: boards, faded paint, windows with shutters, the door.
    rect(fg, L - 2, B - 42, 56, 32, C.plum);
    rect(fg, L, B - 40, 52, 28, C.wool);
    rect(fg, L, B - 40, 4, 28, C.sage);
    for (let i = 6; i < 52; i += 6) rect(fg, L + i, B - 38, 1, 24, C.sage);
    rect(fg, L, B - 16, 52, 2, C.sage);
    rect(fg, L + 8, B - 34, 12, 10, C.plum);
    rect(fg, L + 10, B - 32, 8, 6, C.teal);
    rect(fg, L + 13, B - 32, 1, 6, C.plum);
    rect(fg, L + 10, B - 29, 8, 1, C.plum);
    px(fg, L + 16, B - 32, C.wool);
    rect(fg, L + 6, B - 34, 2, 10, C.butter);
    rect(fg, L + 20, B - 34, 2, 10, C.butter);
    rect(fg, R - 14, B - 36, 10, 22, C.plum);
    rect(fg, R - 12, B - 34, 6, 18, C.sage);
    rect(fg, R - 12, B - 26, 6, 1, C.plum);
    px(fg, R - 8, B - 24, C.butter);
    // Barrel roof, teal under a plum rim, a moss sheen on the sunny side,
    // a buttercup scallop along its edge.
    ellipse(fg, X, B - 42, 30, 10, C.plum);
    rect(fg, L - 4, B - 42, 60, 2, C.plum);
    ellipse(fg, X, B - 44, 28, 8, C.teal);
    for (let r = 0; r < 6; r += 2) rect(fg, X - 22 + r * 2, B - 48 - r, 44 - r * 4, 1, C.sage);
    rect(fg, X + 4, B - 50, 18, 2, C.moss);
    rect(fg, L, B - 42, 52, 1, C.butter);
    for (let i = 2; i < 52; i += 6) { rect(fg, L + i, B - 41, 3, 1, C.butter); px(fg, L + i + 1, B - 40, C.butter); }
    // A chimney pipe, bent.
    rect(fg, L + 12, B - 60, 3, 10, C.plum);
    rect(fg, L + 9, B - 60, 3, 2, C.plum);
    // Undercarriage and wheels; the front one has sunk and lost spokes.
    rect(fg, L + 2, B - 12, 48, 4, C.plum);
    wheel(L + 10, B - 6, false);
    wheel(R - 12, B - 4, true);
    // Steps up to the door.
    for (const [sx, sy] of [[R, B - 12], [R + 2, B - 6]]) { rect(fg, sx, sy, 8, 2, C.plum); rect(fg, sx, sy, 8, 1, C.wool); }
    // Grass grown up round the wheels.
    for (let i = 0; i < 10; i++) { const gx = L + 4 + i * 5; rect(fg, gx, B - 3 + (i % 2), 1, 3, C.moss); px(fg, gx + 1, B - 2 + (i % 2), C.sage); }
  });
}

// ---- Water off the rocks into the pool ----

function falls(g: CanvasRenderingContext2D, x: number, y: number, h: number, t: number) {
  fine(g, (fg) => {
    const X = x * F, Y = y * F, Hh = h * F, T = Y - Hh;
    rect(fg, X - 8, T, 18, Hh, C.teal);
    rect(fg, X - 10, T + 2, 2, Hh - 2, C.sage);
    rect(fg, X + 10, T + 2, 2, Hh - 2, C.plum);
    // Streaks of white water, each column at its own pace.
    for (let i = -8; i <= 9; i++) {
      const v = (24 + hash2(i, 1, 98) * 14) * F, len = (3 + Math.floor(hash2(i, 2, 98) * 3)) * F;
      for (let j = 0; j < Hh; j++) {
        const seg = Math.floor((j - t * v) / len);
        if (hash2(i, seg, 99) < (Math.abs(i) < 5 ? 0.5 : 0.3)) px(fg, X + i, T + j, C.wool);
      }
    }
    rect(fg, X - 8, T, 18, 2, C.wool); // the lip
    // Foam and spray where it lands.
    for (let i = -14; i <= 14; i++) {
      if (hash2(i, Math.floor(t * 9), 97) < 0.6) px(fg, X + i, Y + (Math.abs(i) > 8 ? 2 : 0) + (i & 1), C.wool);
      if (Math.abs(i) < 12 && hash2(i, Math.floor(t * 7), 96) < 0.15) px(fg, X + i, Y - 4 - Math.floor(hash2(i, Math.floor(t * 7), 95) * 6), C.wool);
    }
  });
}

// ---- Keepsakes where they lie ----

function glint(g: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number) {
  const ph = (t * 0.7 + seed * 0.37) % 1;
  if (ph > 0.14) return;
  const big = ph > 0.04 && ph < 0.1;
  fine(g, (fg) => {
    const X = x * F, Y = y * F;
    const n = big ? 5 : 3;
    rect(fg, X - n, Y, n * 2 + 1, 1, C.butter);
    rect(fg, X, Y - n, 1, n * 2 + 1, C.butter);
    rect(fg, X - 1, Y - 1, 3, 3, C.wool);
    if (big) for (const [dx, dy] of [[-2, -2], [2, 2], [2, -2], [-2, 2]]) px(fg, X + dx, Y + dy, C.butter);
  });
}

const ICONS: Record<KeepsakeId, string[]> = {
  bell: ['...yy...', '..yyyy..', '.yywyyy.', '.yywyyy.', '.yyyyyy.', 'yyyyyyyy', 'pppppppp', '...pp...'],
  crook: ['..ppp.', '.p...p', '.y...p', '.....p', '....p.', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....', '.p....'],
  horn: ['.........ww', '.......wwww', 'p....wwwws.', 'pwwwwwwws..', '.wwwwwss...'],
  whistle: ['wwwwwwwwws', 'wpwwpwwwws', '.........s'],
  rosette: ['..ttt..', '.ttttt.', 'ttpypt.', 'tttyttt', '.ttttt.', '..t.t..', '.tt.tt.', '.t...t.'],
};
const ICON_FOOT: Record<KeepsakeId, [number, number]> = { bell: [4, 7], crook: [1, 23], horn: [5, 4], whistle: [5, 1], rosette: [3, 4] };
export function keepsakeIcon(g: CanvasRenderingContext2D, id: KeepsakeId, x: number, y: number) {
  const [fx, fy] = ICON_FOOT[id];
  fine(g, (fg) => grid(fg, ICONS[id], x * F - fx, y * F + 1 - fy));
}

// A post with something hung on it (the orchard bell, the drover's horn).
function hungPost(g: CanvasRenderingContext2D, x: number, y: number, v: number, item: KeepsakeId | null) {
  const h = v ? 9 : 11;
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1, T = (y - h) * F;
    rect(fg, X - 2, T, 3, B - T + 1, C.plum);
    rect(fg, X, T + 1, 1, B - T - 1, C.sage);
    if (!v) {
      rect(fg, X - 2, T, 12, 2, C.plum); // the arm
      px(fg, X + 8, T + 2, C.plum);
    } else {
      rect(fg, X - 4, B - 8, 2, 1, C.plum); // a notch for the old drove-road sign
      rect(fg, X - 6, B - 14, 4, 2, C.sage);
    }
  });
  if (item) keepsakeIcon(g, item, v ? x + 2 : x + 4, v ? y - 4 : y - h + 4);
}

// ---- The Drove Trail's hurdle ----

function hurdle(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, swing: number) {
  // Hinged on the east post; it folds back (north) along the trail as it
  // opens, so an open hurdle stands edge-on beside the way through. Woven
  // withies between stakes, on the fine grid.
  const w = Math.round((x1 - x0 - 2) * (1 - swing));
  const rise = Math.round(swing * 14);
  const hx = x1 - 2; // hinge post
  fine(g, (fg) => {
    const B = y * F + 1;
    rect(fg, x0 * F, B + 1, (x1 - x0) * F, 1, C.sage);
    for (const px0 of [x0 * F, hx * F]) { rect(fg, px0, B - 19, 4, 20, C.plum); px(fg, px0 + 3, B - 17, C.sage); rect(fg, px0, B - 19, 4, 1, C.moss); }
    if (rise > 0) {
      rect(fg, hx * F - 6, B - 15 - rise * F, 6, rise * F + 4, C.plum);
      for (let j = 0; j < rise * F; j += 3) rect(fg, hx * F - 5, B - 13 - j, 4, 1, (j >> 1) & 1 ? C.moss : C.sage);
    }
    if (w > 3) {
      const L = (hx - w) * F, HX = hx * F;
      for (const ry of [B - 4, B - 8, B - 12, B - 16]) {
        for (let x = L; x < HX; x++) {
          const k = ((x >> 1) + (ry >> 2)) % 4;
          px(fg, x, ry, k === 0 ? C.plum : k === 1 ? C.sage : C.moss);
          px(fg, x, ry + 1, k === 2 ? C.plum : C.sage);
          if (k === 3) px(fg, x, ry - 1, C.moss);
        }
      }
      for (let x = HX - 16; x > L + 2; x -= 16) rect(fg, x, B - 15, 2, 16, C.plum);
      rect(fg, L, B - 17, 3, 18, C.plum);
    }
    if (swing === 0) rect(fg, x0 * F + 4, B - 10, 2, 2, C.wool); // the latch, on the trail side
  });
}

// ---- All of it, for the y-sorted world layer ----

export function landmarkDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const seen = (x: number, y: number, m = 40) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
  const t = game.t;
  const disc = game.discovery;
  const out: Drawable[] = [];
  const kept = (id?: KeepsakeId) => !!id && disc.keepsakes.has(id);

  for (const p of PLACES) {
    const mx = p.mark[0] * 8 + 4, my = p.mark[1] * 8 + 6;
    if (seen(mx, my)) out.push({ y: my, draw: () => waymarker(g, mx, my, disc.found.has(p.id)) });
    // Keepsakes lying loose (the hung ones are drawn with their posts).
    if (p.item && p.keepsake && !kept(p.keepsake) && seen(p.item[0], p.item[1])) {
      const [ix, iy] = p.item, k = p.keepsake;
      if (k === 'crook' || k === 'whistle' || k === 'rosette')
        out.push({ y: iy, draw: () => {
          if (k === 'rosette') fine(g, (fg) => rect(fg, ix * F, (iy - 4) * F, 1, 10, C.plum));
          keepsakeIcon(g, k, ix, k === 'rosette' ? iy - 4 : iy);
        } });
      out.push({ y: 1e8, draw: () => glint(g, ix + (k === 'crook' ? 2 : 0), iy - (k === 'crook' ? 13 : k === 'rosette' ? 7 : 4), t, ix) });
    }
  }

  let floor = game.projects.isDone('hut'); // the mended hut has a floor of its own
  for (const pr of PROPS) {
    if (!seen(pr.x, pr.y, 60) || !propShown(pr, game.projects)) continue;
    const d = propDrawable(g, pr, t, game);
    if (d) out.push(d);
    if (pr.place === 'hut' && !floor) {
      floor = true;
      out.push(ground(() => hutFloor(g), 1));
    }
  }

  const map = game.map;
  if (map.hurdleCells.length) {
    const [x0, x1] = map.hurdleSpan();
    const hy = map.hurdleY;
    // Posts set in a little: the canopy hangs over the trail's edges.
    if (seen(x0, hy)) out.push({ y: hy, draw: () => hurdle(g, x0 + 3, x1 - 3, hy - 1, disc.hurdleSwing) });
  }
  return out;
}

function propDrawable(g: CanvasRenderingContext2D, pr: Prop, t: number, game: Game): Drawable | null {
  const { x, y } = pr;
  const v = pr.v ?? 0;
  const shadow = (rx: number, dx = -3) => fine(g, (fg) => ellipse(fg, (x + dx) * F, y * F + 2, rx * F, 3, C.sage));
  switch (pr.kind) {
    case 'stone':
      return { y, draw: () => { shadow(4, -3); standingStone(g, x, y, v); } };
    case 'fallen':
      return { y, draw: () => fallenStone(g, x, y) };
    case 'cairn':
      return { y, draw: () => { shadow(v === 2 ? 9 : 7, -3); cairn(g, x, y, v); } };
    case 'fruit':
      return { y, draw: () => { shadow(7); fruitTree(g, x, y, v, t); } };
    case 'willow':
      return { y, draw: () => { shadow(10); willow(g, x, y, t); } };
    case 'post': {
      const item = v === 0 ? 'bell' : 'horn';
      const has = !game.discovery.keepsakes.has(item);
      return { y, draw: () => {
        hungPost(g, x, y, v, has ? item : null);
        if (has) glint(g, x + (v ? 2 : 4), y - (v ? 6 : 9), t, x);
      } };
    }
    case 'hutwall':
      if (v === 1) return { y, draw: () => { vWall(g, x, y, pr.h!, 5, x); if (x > 280) rubble(g, x - 2, y - pr.h! - 10, 8, 8, 3); } };
      return { y, draw: () => {
        hWall(g, x, y, Math.min(pr.w!, v === 0 ? 32 : pr.w!), 6, x + y, true);
        if (v === 0) rubble(g, x + 32, y - 6, 16, 8, 4);
      } };
    case 'fold':
      if (v === 1) return { y, draw: () => vWall(g, x, y, pr.h!, 3, x + 7) };
      return { y, draw: () => hWall(g, x, y, pr.w!, 3, x + y + 5, true) };
    case 'wagon':
      return { y, draw: () => { shadow(15, -4); wagon(g, x, y); } };
    case 'falls':
      return { y, draw: () => falls(g, x, y, pr.h!, t) };
  }
  return null;
}
