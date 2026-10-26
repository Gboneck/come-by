import { C } from '../palette';
import { ellipse, line, px, rect } from '../gfx/draw';
import { drawSpr } from '../gfx/sprite';
import { PX, fine } from '../gfx/screen';
import { crown } from './fine';
import { cached } from '../gfx/picture';
import { hash2 } from '../rng';
import { gust } from '../render/wind';
import { peopleSprites, type Look } from './people';
import { fallenStone, hWall, pebble, stones } from './landmarks';
import type { Game } from '../game';
import type { Animal } from '../entities/animal';
import type { Drawable } from './buildings';
import { WORKS, placeById, propShown, type Prop } from '../world/places';
import { LOAD_OF, blessed, loaded, projectById, type ProjectId } from '../systems/projects';

// The valley projects drawn in code, before and after: reeds choking Willow
// Pool and its hayrick once cleared; brambles in the Old Orchard and the
// wildflowers that follow; scrub over the Hidden Valley; the Shepherd's Hut
// mended with a slate roof and a gate on its fold, and the slate quarry's
// pile; the mill pool's mud and broken wheel pit, then a turning waterwheel;
// the stone circle's fallen stones out in the hills. Signboards with
// progress, loads on animals, a little celebration the day a project is
// done, and the midsummer gathering at the raised circle.

const ground = (draw: () => void, k = 0): Drawable => ({ y: -1e8 + k, draw });

// Everything here is drawn on the fine grid (two fine pixels to a world
// pixel); positions come in world pixels.
const F = PX;

// ---- Overgrowth ----

function reedClump(g: CanvasRenderingContext2D, x: number, y: number, v: number, t: number) {
  const k = gust(x, y, t) > 0.7 ? 1 : 0;
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    rect(fg, X - 6, B, 14, 1, C.sage);
    const n = 7 + (v % 3);
    for (let i = 0; i < n; i++) {
      const bx = X - 6 + ((i * 5 + v * 2) % 13);
      const h = 12 + ((i * 7 + v * 3) % 9);
      const col = i % 3 === 0 ? C.moss : i % 3 === 1 ? C.teal : C.sage;
      rect(fg, bx, B - h * 0.6, 1, h * 0.6, col);
      rect(fg, bx + k, B - h, 1, h * 0.4, col);
      px(fg, bx, B, C.plum);
    }
    if (v % 2 === 0) {
      rect(fg, X + 2 + k, B - 26, 2, 6, C.plum); // a bulrush head
      px(fg, X + 2 + k, B - 27, C.sage);
      rect(fg, X + 3, B - 20, 1, 20, C.sage);
    }
  });
}

function bramble(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    ellipse(fg, X - 2, B + 2, 12, 3, C.sage);
    crown(fg, X, B - 6, [[-5, 1, 5], [5, 0, 5], [0, -2, 6]]);
    // Arching canes with thorns.
    for (let i = -11; i <= 11; i++) {
      const hy = B - 8 - Math.round(Math.sqrt(Math.max(0, 121 - i * i)) * 0.5);
      if ((i + v) % 3 !== 0) px(fg, X + i, hy, C.plum);
      if ((i + v) % 5 === 0) px(fg, X + i, hy - 1, C.plum);
    }
    // Blossom, or berries, by the variant.
    for (const [dx, dy] of [[-2 + (v % 3) * 2, -8], [5 - (v % 2) * 2, -4], [-6, -3]]) {
      if (v % 2) { rect(fg, X + dx - 1, B + dy, 3, 1, C.wool); rect(fg, X + dx, B + dy - 1, 1, 3, C.wool); px(fg, X + dx, B + dy, C.butter); }
      else { rect(fg, X + dx, B + dy, 2, 2, C.plum); px(fg, X + dx, B + dy, C.wool); }
    }
  });
}

function scrubBush(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  const w = 5 + (v % 3), h = 3 + (v % 2);
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    ellipse(fg, X - 4, B + 2, (w + 1) * F, 3, C.sage);
    crown(fg, X, B - h * F, [[-w, 1, w + 1], [w, 1, w + 1], [0, -2, w + 2]]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + v;
      const ex = X + Math.round(Math.cos(a) * (w + 2) * F * 0.9), ey = B - h * F + Math.round(Math.sin(a) * (h + 2) * F * 0.7);
      line(fg, X + Math.round(Math.cos(a) * w * F * 0.7), B - h * F + Math.round(Math.sin(a) * h), ex, ey, C.plum); // twigs
    }
  });
}

// ---- Willow Pool: the hay meadow ----

function hayrick(g: CanvasRenderingContext2D, x: number, y: number, snow: boolean) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    ellipse(fg, X - 6, B + 2, 18, 4, C.sage);
    // Straight sides, a rounded top, bound with twine; thatched against rain.
    rect(fg, X - 14, B - 16, 30, 17, C.plum);
    ellipse(fg, X, B - 18, 14, 8, C.plum);
    rect(fg, X - 12, B - 16, 26, 16, C.butter);
    ellipse(fg, X, B - 18, 12, 6, C.butter);
    rect(fg, X - 12, B - 16, 4, 16, C.moss); // the shaded west side
    for (let r = B - 14; r < B; r += 3) for (let i = X - 10 + ((r >> 1) % 2) * 2; i < X + 13; i += 5) px(fg, i, r, C.wool);
    for (let i = X - 11; i <= X + 13; i += 2) px(fg, i, B - 8, C.plum); // twine
    rect(fg, X - 8, B - 27, 18, 4, snow ? C.wool : C.sage);
    for (let i = X - 7; i < X + 10; i += 3) px(fg, i, B - 24, snow ? C.sage : C.moss);
    rect(fg, X - 4, B - 29, 10, 2, snow ? C.wool : C.sage);
    rect(fg, X, B - 31, 2, 2, C.plum);
  });
}

function lilies(g: CanvasRenderingContext2D) {
  fine(g, (fg) => {
    for (let i = 0; i < 7; i++) {
      const X = (1476 + Math.round(hash2(i, 1, 61) * 18)) * F, Y = (830 + Math.round(hash2(i, 2, 61) * 10)) * F;
      ellipse(fg, X, Y, 4, 2, C.sage);
      ellipse(fg, X, Y, 3, 1, C.moss);
      rect(fg, X + 1, Y - 1, 3, 1, C.teal); // the notch
      if (i % 3 === 0) { const c = i % 2 ? C.butter : C.wool; rect(fg, X - 1, Y - 2, 3, 1, c); px(fg, X, Y - 3, c); }
    }
  });
}

// Wildflowers scattered over a place once it is grazed clear: little
// five-pixel flowers.
function flowers(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, n: number, seed: number) {
  const cols = [C.butter, C.wool, C.butter, C.teal];
  fine(g, (fg) => {
    for (let i = 0; i < n; i++) {
      const a = hash2(i, seed, 71) * Math.PI * 2, r = Math.sqrt(hash2(i, seed, 72));
      const X = Math.round((cx + Math.cos(a) * rx * r) * F), Y = Math.round((cy + Math.sin(a) * ry * r) * F);
      const c = cols[i % cols.length];
      rect(fg, X - 1, Y, 3, 1, c);
      rect(fg, X, Y - 1, 1, 3, c);
      px(fg, X, Y, c === C.wool ? C.butter : C.moss);
      px(fg, X, Y + 2, C.moss);
    }
  });
}

// ---- The Shepherd's Hut, mended ----

function mendedHut(g: CanvasRenderingContext2D, x: number, base: number, w: number, night: boolean) {
  fine(g, (fg) => ellipse(fg, (x + w / 2 - 6) * F, base * F + 2, (w / 2 + 4) * F, 6, C.sage));
  // Drystone front, whole again, with a door and a window.
  hWall(g, x, base, w, 8, x + base, false);
  fine(g, (fg) => {
    const X = x * F, B = base * F + 1, Wd = w * F;
    rect(fg, X + 40, B - 18, 16, 18, C.plum);
    rect(fg, X + 42, B - 16, 12, 16, C.sage);
    for (let i = X + 44; i < X + 54; i += 3) rect(fg, i, B - 15, 1, 14, C.moss);
    px(fg, X + 52, B - 8, C.wool);
    rect(fg, X + 68, B - 14, 12, 8, C.plum);
    rect(fg, X + 70, B - 12, 8, 4, night ? C.butter : C.teal);
    rect(fg, X + 73, B - 12, 1, 4, C.plum);
    // Slate roof: courses with staggered joints, the gable end shaded,
    // light along the ridge.
    const T = (base - 30) * F, E = (base - 9) * F;
    rect(fg, X - 4, T, Wd + 8, E - T + 2, C.plum);
    for (let yy = T + 2; yy < E; yy++) {
      const row = yy - T;
      rect(fg, X - 2, yy, Wd + 4, 1, row % 4 === 0 ? C.plum : C.teal);
      if (row % 4 === 2) for (let xx = X + ((row >> 2) % 2) * 5; xx < X + Wd; xx += 10) px(fg, xx, yy, C.plum);
      if (row % 4 === 1) for (let xx = X + 3 + ((row >> 2) % 2) * 5; xx < X + Wd; xx += 10) px(fg, xx, yy, C.sage);
    }
    rect(fg, X - 2, T + 2, 6, E - T - 2, C.plum);
    rect(fg, X + Wd / 2, T + 2, Wd / 2, 1, C.sage);
    rect(fg, X - 4, E, Wd + 8, 2, C.plum);
  });
  // Chimney.
  stones(g, x + 36, base - 36, 5, 8, 7, 0.4);
  fine(g, (fg) => rect(fg, (x + 35) * F, (base - 37) * F, 14, 2, C.plum));
}

function chimneySmoke(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.6 + i * 0.25) % 1;
      if (ph >= 0.85) continue;
      const X = Math.round((x + ph * 6 + Math.sin((t + i) * 2) * 1.5) * F), Y = Math.round((y - ph * 14) * F);
      const r = 1 + Math.round(ph * 3);
      ellipse(fg, X, Y, r, Math.max(1, r - 1), ph < 0.4 ? C.wool : C.sage);
    }
  });
}

function foldGate(g: CanvasRenderingContext2D, x: number, base: number, w: number, shut: boolean) {
  fine(g, (fg) => {
    const X = x * F, B = base * F + 1, Wd = w * F;
    for (const px0 of [X - 2, X + Wd - 2]) { rect(fg, px0, B - 15, 4, 16, C.plum); px(fg, px0 + 3, B - 13, C.sage); }
    if (shut) {
      for (const ry of [B - 12, B - 8, B - 4]) { rect(fg, X + 2, ry, Wd - 4, 1, C.wool); rect(fg, X + 2, ry + 1, Wd - 4, 1, C.sage); }
      line(fg, X + 2, B - 4, X + Wd - 4, B - 12, C.wool); // the brace
    } else {
      rect(fg, X + 2, B - 28, 4, 18, C.plum); // swung back into the fold
      for (let j = 0; j < 16; j += 4) rect(fg, X + 3, B - 26 + j, 2, 1, C.wool);
    }
  });
}

// ---- The slate quarry's pile ----

function slatePile(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    ellipse(fg, X - 4, B + 2, 20, 4, C.sage);
    for (let i = 0; i < n; i++) {
      const sx = X - 12 + (i % 2) * 14, sy = B - 2 - Math.floor(i / 2) * 6;
      rect(fg, sx - 2, sy - 4, 16, 7, C.plum);
      rect(fg, sx, sy - 3, 12, 2, C.teal);
      rect(fg, sx, sy - 1, 12, 1, C.sage);
      rect(fg, sx, sy + 1, 12, 1, C.teal);
      px(fg, sx + 9, sy - 3, C.wool);
    }
  });
  pebble(g, x - 9, y, 1, 1);
  pebble(g, x + 8, y - 1, 1, 1);
}

// ---- The mill at the falls ----

function mud(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  fine(g, (fg) => {
    const X = x * F, Y = y * F;
    ellipse(fg, X, Y, (5 + (v % 3)) * F, 4, C.sage);
    ellipse(fg, X + 1, Y + 1, (3 + (v % 3)) * F, 2, C.plum);
    rect(fg, X + 3, Y - 1, 3, 1, C.teal);
    px(fg, X - 4, Y - 2, C.wool);
  });
}

function wheelPit(g: CanvasRenderingContext2D, x: number, y: number) {
  stones(g, x - 7, y - 4, 14, 4, 13, 0.5);
  fine(g, (fg) => {
    const X = x * F, Y = y * F;
    // What is left of the old wheel, lying askew in its pit.
    for (const [a, b, c, d] of [[-12, -8, -2, -24], [-2, -24, 10, -18], [-6, -16, 4, -12], [-9, -12, 6, -21]]) {
      line(fg, X + a, Y + b, X + c, Y + d, C.plum);
      line(fg, X + a + 1, Y + b, X + c + 1, Y + d, C.sage);
    }
    rect(fg, X + 11, Y - 15, 2, 3, C.plum);
  });
}

function waterwheel(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  stones(g, x - 9, y - 3, 4, 3, 13, 0.5);
  stones(g, x + 6, y - 3, 4, 3, 14, 0.5);
  fine(g, (fg) => {
    const CX = x * F, CY = (y - 10) * F, R = 8 * F;
    // A plank flume from the pool down to the top of the wheel.
    rect(fg, CX - 4, CY - R - 18, 10, 18, C.plum);
    rect(fg, CX - 2, CY - R - 18, 6, 18, C.teal);
    for (let j = 0; j < 18; j++) if ((j + Math.floor(t * 24)) % 5 === 0) rect(fg, CX, CY - R - 18 + j, 2, 1, C.wool);
    // The rim, turning spokes and paddles.
    for (let a = 0; a < 112; a++) {
      const ang = (a / 112) * Math.PI * 2;
      px(fg, CX + Math.round(Math.cos(ang) * R), CY + Math.round(Math.sin(ang) * R), C.plum);
      px(fg, CX + Math.round(Math.cos(ang) * (R - 1)), CY + Math.round(Math.sin(ang) * (R - 1)), C.sage);
    }
    const turn = t * 1.4;
    for (let k = 0; k < 8; k++) {
      const ang = turn + (k * Math.PI) / 4;
      const ex = CX + Math.round(Math.cos(ang) * (R - 2)), ey = CY + Math.round(Math.sin(ang) * (R - 2));
      line(fg, CX, CY, ex, ey, k % 2 ? C.sage : C.plum);
      const bx = CX + Math.round(Math.cos(ang) * R), by = CY + Math.round(Math.sin(ang) * R);
      rect(fg, bx - 2, by - 2, 4, 4, C.moss);
      px(fg, bx - 2, by - 2, C.plum);
    }
    rect(fg, CX - 2, CY - 2, 5, 5, C.plum);
    px(fg, CX, CY, C.wool);
    // Water spilling off the downstream side, foam below.
    for (let i = 0; i < 10; i++) {
      const ph = (t * 3 + i / 10) % 1;
      px(fg, CX + R + 2 - (i % 3), CY - 6 + Math.round(ph * 24), C.wool);
    }
    for (let i = -8; i <= 8; i += 2) if (hash2(i, Math.floor(t * 8), 93) < 0.6) rect(fg, CX + i, y * F + 2, 2, 1, C.wool);
  });
}

// ---- Signboards: how far along, at each site ----

function signboard(g: CanvasRenderingContext2D, x: number, y: number, frac: number, done: boolean) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    rect(fg, X, B - 18, 2, 19, C.plum);
    px(fg, X + 1, B - 16, C.sage);
    rect(fg, X - 12, B - 30, 26, 14, C.plum);
    rect(fg, X - 10, B - 28, 22, 10, C.moss);
    rect(fg, X - 10, B - 19, 22, 1, C.sage);
    if (done) {
      // A buttercup star.
      rect(fg, X - 3, B - 24, 7, 1, C.butter);
      rect(fg, X, B - 27, 1, 7, C.butter);
      rect(fg, X - 1, B - 25, 3, 3, C.butter);
      px(fg, X, B - 24, C.wool);
      return;
    }
    for (let i = 0; i < 5; i++) rect(fg, X - 8 + i * 4, B - 26, 2, 6, frac >= (i + 1) / 5 ? C.butter : C.sage);
  });
}

// ---- Loads, on the animals carrying them ----

function drawLoad(g: CanvasRenderingContext2D, a: Animal) {
  const load = LOAD_OF[a.sp.id];
  const x = Math.round(a.x), y = Math.round(a.y);
  if (load === 'slate') {
    // Panniers of slate either side of a goat's back.
    fine(g, (fg) => {
      const X = x * F, Y = y * F;
      const bag = (bx: number) => { rect(fg, bx, Y - 12, 6, 8, C.plum); rect(fg, bx + 1, Y - 11, 4, 2, C.teal); rect(fg, bx + 1, Y - 8, 4, 1, C.sage); };
      if (a.face === 'l' || a.face === 'r') bag(X - 3);
      else { bag(X - 10); bag(X + 4); }
    });
    return;
  }
  // A stone on a travois behind a pony.
  const f = a.face;
  const [dx, dy] = f === 'r' ? [-1, 0] : f === 'l' ? [1, 0] : f === 'd' ? [0, -1] : [0, 1];
  const rx = x + dx * 4, ry = y + dy * 4 - (dy ? 0 : 3);
  const sx = x + dx * 14, sy = y + dy * 12 - (dy ? 2 : 0);
  fine(g, (fg) => {
    line(fg, (rx - (dy ? 2 : 0)) * F, ry * F, (sx - (dy ? 2 : 0)) * F, (sy + (dy ? 0 : 1)) * F, C.plum);
    line(fg, (rx + (dy ? 2 : 0)) * F, (ry + (dy ? 0 : 1)) * F, (sx + (dy ? 2 : 0)) * F, (sy + 2) * F, C.plum);
  });
  pebble(g, sx, sy, 3, 1, true);
}

// ---- The day a project is done, and midsummer ----

const FOLK: Look[] = [
  { H: 's', C: 't', L: 'p' },
  { H: 'y', C: 'w', L: 's', R: 'p' },
  { H: 'p', C: 'o', L: 'p' },
  { H: 'w', C: 's', L: 'p', R: 'y' },
  { H: 't', C: 'y', L: 's' },
];

function bunting(g: CanvasRenderingContext2D, xa: number, xb: number, y: number) {
  const cols = [C.butter, C.wool, C.teal];
  fine(g, (fg) => {
    const XA = xa * F, XB = xb * F, Y = y * F;
    const w = XB - XA;
    for (let x = XA; x <= XB; x++) {
      const u = (x - XA) / w;
      const sag = Math.round(6 * 4 * u * (1 - u));
      px(fg, x, Y + sag, C.plum);
      if ((x - XA) % 8 === 2 && x < XB - 4) {
        const c = cols[Math.floor((x - XA) / 8) % 3];
        rect(fg, x, Y + sag + 1, 5, 1, c);
        rect(fg, x + 1, Y + sag + 2, 3, 2, c);
        px(fg, x + 2, Y + sag + 4, c);
      }
    }
  });
}

function folkAt(g: CanvasRenderingContext2D, i: number, x: number, y: number, t: number) {
  const s = peopleSprites(FOLK[i % FOLK.length]);
  const wave = Math.floor(t * 3 + i) % 4 === 0;
  drawSpr(g, wave ? s.wave.d[Math.floor(t * 6) % s.wave.d.length] : s.stand.d, x, y);
}

function bonfire(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  fine(g, (fg) => {
    const X = x * F, B = y * F + 1;
    ellipse(fg, X - 2, B + 2, 12, 4, C.sage);
    // Logs crossed, stones round them, flames licking up, sparks rising.
    for (const [a, b, c, d] of [[-10, 0, 8, -6], [-8, -6, 10, 0], [-6, 2, 6, -8]]) { line(fg, X + a, B + b, X + c, B + d, C.plum); line(fg, X + a, B + b - 1, X + c, B + d - 1, C.sage); }
    for (let i = 0; i < 20; i++) {
      const h = hash2(i, Math.floor(t * 10), 81);
      const col = i % 10;
      const fx = X - 7 + col + (i >= 10 ? 1 : 0), top = Math.floor(h * (16 - Math.abs(5 - col) * 2));
      rect(fg, fx, B - 6 - top, 1, top, h > 0.65 ? C.wool : C.butter);
    }
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.8 + i / 4) % 1;
      if (ph < 0.7) px(fg, X - 2 + Math.round(Math.sin((t + i) * 3) * 4), B - 20 - Math.round(ph * 28), C.butter);
    }
  });
}

const CELEBRATE: Record<ProjectId, [number, number]> = {
  reeds: [1436, 852], orchard: [1384, 1034], scrub: [128, 640], hut: [236, 690], mill: [460, 700], circle: [1436, 368],
};

// ---- All of it, for the y-sorted world layer ----

export function projectDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const seen = (x: number, y: number, m = 40) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
  const P = game.projects;
  const t = game.t;
  const out: Drawable[] = [];

  for (const pr of WORKS) {
    if (!seen(pr.x, pr.y, 50) || !propShown(pr, P)) continue;
    const d = workDrawable(game, g, pr, t);
    if (d) out.push(...d);
  }

  // Afterwards: lilies, wildflowers.
  if (P.isDone('reeds') && seen(1484, 836)) out.push(...cached(g, 'proj-lilies', (cg) => [ground(() => lilies(cg), 2)]));
  if (P.isDone('orchard') && seen(1414, 1060, 60)) out.push(...cached(g, 'proj-orchard-fl', (cg) => [ground(() => flowers(cg, 1414, 1060, 48, 36, 60, 5), 2)]));
  if (P.isDone('scrub') && seen(80, 672, 60)) out.push(...cached(g, 'proj-scrub-fl', (cg) => [ground(() => flowers(cg, 80, 672, 34, 36, 40, 9), 2)]));

  // Loads and blessings on the animals.
  for (const a of game.animals) {
    if (a.gone || !seen(a.x, a.y, 20)) continue;
    if (loaded.has(a)) {
      const behind = LOAD_OF[a.sp.id] === 'stone' && a.face !== 'u';
      out.push({ y: a.y + (behind ? -0.5 : 0.5), draw: () => drawLoad(g, a) });
    }
    if (blessed.has(a) && !a.pen && Math.floor(t * 4 + a.id) % 3 === 0) out.push({ y: 1e8, draw: () => fine(g, (fg) => { const X = Math.round(a.x * F), Y = Math.round((a.y - a.sp.r * 2 - 5) * F); rect(fg, X - 1, Y, 3, 1, C.butter); rect(fg, X, Y - 1, 1, 3, C.butter); }) });
  }

  // The day it was done: bunting and a few folk by the sign.
  for (const [id, day] of Object.entries(P.celebrated)) {
    if (day !== game.day.day || !P.isDone(id)) continue;
    const [x, y] = CELEBRATE[id as ProjectId];
    if (!seen(x, y, 60)) continue;
    out.push({ y: y - 30, draw: () => bunting(g, x - 22, x + 22, y - 22) });
    for (let i = 0; i < 3; i++) {
      const fx = x - 16 + i * 14, fy = y + 6 + (i % 2) * 4;
      out.push({ y: fy, draw: () => folkAt(g, i + (id.length % 3), fx, fy, t) });
    }
  }

  // Midsummer at the stone circle: a bonfire, bunting, the valley's folk.
  if (P.isMidsummer(game) && seen(1468, 340, 80)) {
    out.push({ y: 346, draw: () => bonfire(g, 1468, 346, t) });
    out.push({ y: 300, draw: () => bunting(g, 1442, 1494, 312) });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6, fx = Math.round(1468 + Math.cos(a) * 38), fy = Math.round(342 + Math.sin(a) * 30);
      out.push({ y: fy, draw: () => folkAt(g, i, fx, fy, t) });
    }
  }
  return out;
}

function workDrawable(game: Game, g: CanvasRenderingContext2D, pr: Prop, t: number): Drawable[] | null {
  const P = game.projects;
  const { x, y } = pr;
  const v = pr.v ?? 0;
  const pid = pr.project as ProjectId;
  switch (pr.kind) {
    case 'reeds':
      return P.frac(pid) < (pr.stage ?? 1) ? [{ y, draw: () => reedClump(g, x, y, v, t) }] : null;
    case 'bramble':
      return P.frac(pid) < (pr.stage ?? 1) ? cached(g, `proj-br${v}`, (cg) => [{ y, draw: () => bramble(cg, x, y, v) }]) : null;
    case 'scrub':
      return P.frac(pid) < (pr.stage ?? 1) ? cached(g, `proj-sc${v}`, (cg) => [{ y, draw: () => scrubBush(cg, x, y, v) }]) : null;
    case 'hayrick': {
      const snow = game.season.snow > 0.5;
      return cached(g, 'proj-hay', (cg) => [{ y, draw: () => hayrick(cg, x, y, snow) }]);
    }
    case 'hutfixed': {
      const night = game.day.phase === 'night';
      return [...cached(g, 'proj-hut', (cg) => [{ y, draw: () => mendedHut(cg, x, y, pr.w!, night) }]), { y: y - 40, draw: () => chimneySmoke(g, x + 38, y - 38, t) }];
    }
    case 'foldgate': {
      const shut = P.foldShut;
      return cached(g, 'proj-fold', (cg) => [{ y, draw: () => foldGate(cg, x, y, pr.w!, shut) }]);
    }
    case 'slates': {
      const n = P.atPile('hut', 0);
      return cached(g, 'proj-slates', (cg) => [{ y, draw: () => slatePile(cg, x, y, n) }]);
    }
    case 'fieldstone':
      if (P.isDone('circle') || P.atPile('circle', pr.pile ?? 0) <= 0) return null;
      return cached(g, `proj-fs${v}`, (cg) => [
        ground(() => fine(cg, (fg) => ellipse(fg, (x - 2) * F, y * F + 2, 16, 4, C.sage)), 1),
        { y, draw: () => { fallenStone(cg, x, y); fine(cg, (fg) => { rect(fg, (x - 5) * F, y * F, 2, 1, C.moss); px(fg, (x - 5) * F, y * F - 1, C.moss); rect(fg, (x + 4) * F, (y + 1) * F, 2, 1, C.moss); }); } },
      ]);
    case 'mud':
      return cached(g, `proj-mud${v}`, (cg) => [ground(() => mud(cg, x, y, v), 1)]);
    case 'wheelpit':
      return cached(g, 'proj-pit', (cg) => [{ y, draw: () => wheelPit(cg, x, y) }]);
    case 'waterwheel':
      return [{ y, draw: () => waterwheel(g, x, y, t) }];
    case 'sign': {
      const frac = P.frac(pid), done = P.isDone(pid);
      return cached(g, `proj-sign-${pid}`, (cg) => [{ y, draw: () => signboard(cg, x, y, frac, done) }]);
    }
  }
  return null;
}

// Where a project's place is, for anyone placing the camera on it (tests).
export const projectSpot = (id: ProjectId) => {
  const p = projectById(id);
  return p.place ? { x: placeById(p.place).cx * 8, y: placeById(p.place).cy * 8 } : { x: p.mark[0], y: p.mark[1] };
};
