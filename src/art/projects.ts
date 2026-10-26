import { C } from '../palette';
import { ellipse, line, px, rect } from '../gfx/draw';
import { drawSpr } from '../gfx/sprite';
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

// ---- Overgrowth ----

function reedClump(g: CanvasRenderingContext2D, x: number, y: number, v: number, t: number) {
  const k = gust(x, y, t) > 0.7 ? 1 : 0;
  rect(g, x - 3, y, 7, 1, C.sage);
  const n = 4 + (v % 3);
  for (let i = 0; i < n; i++) {
    const bx = x - 3 + ((i * 3 + v) % 7);
    const h = 6 + ((i * 7 + v * 3) % 5);
    const col = i % 3 === 0 ? C.moss : C.teal;
    for (let j = 0; j < h; j++) px(g, bx + (j > h - 3 ? k : 0), y - j, j === 0 ? C.plum : col);
  }
  if (v % 2 === 0) {
    rect(g, x + 1 + k, y - 12, 1, 3, C.plum); // a bulrush head
    px(g, x + 1 + k, y - 13, C.sage);
  }
}

function bramble(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  ellipse(g, x - 1, y + 1, 6, 1.5, C.sage);
  ellipse(g, x, y - 2, 5, 3, C.plum);
  ellipse(g, x, y - 3, 4, 2, C.teal);
  // Arching canes with thorns.
  for (let i = -5; i <= 5; i++) {
    const hy = y - 4 - Math.round(Math.sqrt(Math.max(0, 25 - i * i)) * 0.5);
    if ((i + v) % 3 !== 0) px(g, x + i, hy, C.plum);
  }
  px(g, x + 2, y - 5, C.moss);
  px(g, x - 3, y - 4, C.moss);
  // Blossom (or berries, by the variant).
  px(g, x - 1 + (v % 3), y - 4, v % 2 ? C.wool : C.plum);
  px(g, x + 3 - (v % 2), y - 2, C.wool);
}

function scrubBush(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  const w = 5 + (v % 3), h = 3 + (v % 2);
  ellipse(g, x - 2, y + 1, w + 1, 1.5, C.sage);
  ellipse(g, x, y - h, w, h, C.plum);
  ellipse(g, x, y - h - 1, w - 1, h - 1, C.teal);
  rect(g, x + 1, y - h * 2, w - 2, 1, C.moss);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + v;
    px(g, x + Math.round(Math.cos(a) * (w + 1)), y - h + Math.round(Math.sin(a) * (h + 1)), C.plum); // twigs
  }
}

// ---- Willow Pool: the hay meadow ----

function hayrick(g: CanvasRenderingContext2D, x: number, y: number, snow: boolean) {
  ellipse(g, x - 3, y + 1, 9, 2, C.sage);
  // Straight sides, a rounded top, bound with twine; thatched against rain.
  rect(g, x - 7, y - 8, 15, 9, C.plum);
  ellipse(g, x, y - 9, 7, 4, C.plum);
  rect(g, x - 6, y - 8, 13, 8, C.butter);
  ellipse(g, x, y - 9, 6, 3, C.butter);
  rect(g, x - 6, y - 8, 2, 8, C.moss); // the shaded west side
  for (let i = -5; i <= 6; i += 2) px(g, x + i, y - 4, C.plum); // twine
  for (let i = -4; i <= 5; i += 3) px(g, x + i, y - 7, C.moss);
  rect(g, x - 4, y - 13, 9, 2, snow ? C.wool : C.sage);
  rect(g, x - 2, y - 14, 5, 1, snow ? C.wool : C.sage);
  px(g, x, y - 15, C.plum);
}

function lilies(g: CanvasRenderingContext2D) {
  for (let i = 0; i < 7; i++) {
    const x = 1476 + Math.round(hash2(i, 1, 61) * 18), y = 830 + Math.round(hash2(i, 2, 61) * 10);
    ellipse(g, x, y, 2, 1, C.moss);
    px(g, x + 1, y, C.teal);
    if (i % 3 === 0) px(g, x, y - 1, i % 2 ? C.butter : C.wool);
  }
}

// Wildflowers scattered over a place once it is grazed clear.
function flowers(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, n: number, seed: number) {
  const cols = [C.butter, C.wool, C.butter, C.teal];
  for (let i = 0; i < n; i++) {
    const a = hash2(i, seed, 71) * Math.PI * 2, r = Math.sqrt(hash2(i, seed, 72));
    const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + Math.sin(a) * ry * r);
    px(g, x, y, cols[i % cols.length]);
    if (i % 4 === 0) px(g, x, y + 1, C.moss);
  }
}

// ---- The Shepherd's Hut, mended ----

function mendedHut(g: CanvasRenderingContext2D, x: number, base: number, w: number, night: boolean) {
  ellipse(g, x + w / 2 - 6, base + 1, w / 2 + 4, 3, C.sage);
  // Drystone front, whole again, with a door and a window.
  hWall(g, x, base, w, 8, x + base, false);
  rect(g, x + 20, base - 9, 8, 9, C.plum);
  rect(g, x + 21, base - 8, 6, 8, C.sage);
  rect(g, x + 21, base - 8, 1, 8, C.plum);
  px(g, x + 26, base - 4, C.wool);
  rect(g, x + 34, base - 7, 6, 4, C.plum);
  rect(g, x + 35, base - 6, 4, 2, night ? C.butter : C.teal);
  // Slate roof, courses lit from the upper right.
  const top = base - 30, eave = base - 9;
  rect(g, x - 2, top, w + 4, eave - top + 1, C.plum);
  for (let yy = top + 1; yy < eave; yy++) {
    const row = yy - top;
    rect(g, x - 1, yy, w + 2, 1, row % 3 === 0 ? C.plum : C.teal);
    if (row % 3 !== 0) for (let xx = x + ((row >> 1) % 2) * 2; xx < x + w; xx += 5) px(g, xx, yy, row % 3 === 1 ? C.sage : C.plum);
  }
  rect(g, x - 1, top + 1, 3, eave - top - 1, C.plum); // the shaded gable end
  rect(g, x + w / 2, top + 1, w / 2, 1, C.sage); // light along the ridge
  rect(g, x - 2, eave, w + 4, 1, C.plum);
  // Chimney.
  stones(g, x + 36, top - 6, 5, 8, 7, 0.4);
  rect(g, x + 35, top - 7, 7, 1, C.plum);
}

function chimneySmoke(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.6 + i * 0.25) % 1;
    const sx = Math.round(x + ph * 6 + Math.sin((t + i) * 2) * 1.5), sy = Math.round(y - ph * 14);
    if (ph < 0.85) px(g, sx, sy, ph < 0.4 ? C.wool : C.sage);
    if (ph < 0.5) px(g, sx + 1, sy, C.sage);
  }
}

function foldGate(g: CanvasRenderingContext2D, x: number, base: number, w: number, shut: boolean) {
  rect(g, x - 1, base - 7, 2, 8, C.plum);
  rect(g, x + w - 1, base - 7, 2, 8, C.plum);
  if (shut) {
    for (const ry of [base - 6, base - 4, base - 2]) rect(g, x + 1, ry, w - 2, 1, ry === base - 4 ? C.moss : C.wool);
    line(g, x + 1, base - 2, x + w - 2, base - 6, C.wool); // the brace
  } else {
    rect(g, x + 1, base - 14, 2, 9, C.plum); // swung back into the fold
    for (let j = 0; j < 8; j += 2) px(g, x + 2, base - 13 + j, C.wool);
  }
}

// ---- The slate quarry's pile ----

function slatePile(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  ellipse(g, x - 2, y + 1, 10, 2, C.sage);
  pebble(g, x - 9, y, 1, 1);
  pebble(g, x + 8, y - 1, 1, 1);
  for (let i = 0; i < n; i++) {
    const sx = x - 6 + (i % 2) * 7, sy = y - 1 - Math.floor(i / 2) * 3 - (i === 4 ? 0 : 0);
    rect(g, sx - 1, sy - 2, 8, 4, C.plum);
    rect(g, sx, sy - 1, 6, 2, C.teal);
    rect(g, sx, sy, 6, 1, C.sage);
    px(g, sx + 4, sy - 1, C.wool);
  }
}

// ---- The mill at the falls ----

function mud(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  ellipse(g, x, y, 5 + (v % 3), 2, C.sage);
  for (let i = 0; i < 5; i++) px(g, x - 4 + ((i * 3 + v) % 9), y - 1 + (i % 3), C.plum);
  px(g, x + 2, y, C.teal);
}

function wheelPit(g: CanvasRenderingContext2D, x: number, y: number) {
  stones(g, x - 7, y - 4, 14, 4, 13, 0.5);
  // What is left of the old wheel, lying askew in its pit.
  line(g, x - 6, y - 4, x - 1, y - 12, C.plum);
  line(g, x - 1, y - 12, x + 5, y - 9, C.plum);
  line(g, x - 3, y - 8, x + 2, y - 6, C.plum);
  px(g, x + 6, y - 7, C.plum);
  px(g, x - 1, y - 7, C.sage);
}

function waterwheel(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const cx = x, cy = y - 10, r = 8;
  // A plank flume from the pool down to the top of the wheel.
  rect(g, cx - 2, cy - r - 9, 5, 9, C.plum);
  rect(g, cx - 1, cy - r - 9, 3, 9, C.teal);
  for (let j = 0; j < 9; j++) if ((j + Math.floor(t * 12)) % 3 === 0) px(g, cx, cy - r - 9 + j, C.wool);
  // Stone footings either side, the rim, turning spokes and paddles.
  stones(g, cx - 9, y - 3, 4, 3, 13, 0.5);
  stones(g, cx + 6, y - 3, 4, 3, 14, 0.5);
  for (let a = 0; a < 56; a++) {
    const ang = (a / 56) * Math.PI * 2;
    px(g, cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r), C.plum);
  }
  const turn = t * 1.4;
  for (let k = 0; k < 8; k++) {
    const ang = turn + (k * Math.PI) / 4;
    const ex = cx + Math.round(Math.cos(ang) * (r - 1)), ey = cy + Math.round(Math.sin(ang) * (r - 1));
    line(g, cx, cy, ex, ey, k % 2 ? C.sage : C.plum);
    rect(g, cx + Math.round(Math.cos(ang) * r) - 1, cy + Math.round(Math.sin(ang) * r) - 1, 2, 2, C.moss);
  }
  rect(g, cx - 1, cy - 1, 3, 3, C.plum);
  px(g, cx, cy, C.wool);
  // Water spilling off the downstream side, foam below.
  for (let i = 0; i < 6; i++) {
    const ph = (t * 3 + i / 6) % 1;
    px(g, cx + r + 1 - (i % 2), cy - 3 + Math.round(ph * 12), C.wool);
  }
  for (let i = -4; i <= 4; i += 2) if (hash2(i, Math.floor(t * 8), 93) < 0.6) px(g, cx + i, y + 1, C.wool);
}

// ---- Signboards: how far along, at each site ----

function signboard(g: CanvasRenderingContext2D, x: number, y: number, frac: number, done: boolean) {
  rect(g, x, y - 9, 1, 10, C.plum);
  rect(g, x - 6, y - 15, 13, 7, C.plum);
  rect(g, x - 5, y - 14, 11, 5, C.moss);
  if (done) {
    px(g, x, y - 13, C.butter);
    rect(g, x - 1, y - 12, 3, 1, C.butter);
    px(g, x, y - 11, C.butter);
    px(g, x, y - 12, C.wool);
    return;
  }
  for (let i = 0; i < 5; i++) rect(g, x - 4 + i * 2, y - 13, 1, 3, frac >= (i + 1) / 5 ? C.butter : C.sage);
}

// ---- Loads, on the animals carrying them ----

function drawLoad(g: CanvasRenderingContext2D, a: Animal) {
  const load = LOAD_OF[a.sp.id];
  const x = Math.round(a.x), y = Math.round(a.y);
  if (load === 'slate') {
    // Panniers of slate either side of a goat's back.
    if (a.face === 'l' || a.face === 'r') {
      rect(g, x - 2, y - 6, 4, 4, C.plum);
      rect(g, x - 1, y - 5, 2, 2, C.teal);
    } else {
      rect(g, x - 5, y - 6, 3, 4, C.plum);
      rect(g, x + 2, y - 6, 3, 4, C.plum);
      px(g, x - 4, y - 5, C.teal);
      px(g, x + 3, y - 5, C.teal);
    }
    return;
  }
  // A stone on a travois behind a pony.
  const f = a.face;
  const [dx, dy] = f === 'r' ? [-1, 0] : f === 'l' ? [1, 0] : f === 'd' ? [0, -1] : [0, 1];
  const rx = x + dx * 4, ry = y + dy * 4 - (dy ? 0 : 3);
  const sx = x + dx * 14, sy = y + dy * 12 - (dy ? 2 : 0);
  line(g, rx - (dy ? 2 : 0), ry, sx - (dy ? 2 : 0), sy + (dy ? 0 : 1), C.plum);
  line(g, rx + (dy ? 2 : 0), ry + (dy ? 0 : 1), sx + (dy ? 2 : 0), sy + 2, C.plum);
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
  const w = xb - xa;
  for (let x = xa; x <= xb; x++) {
    const u = (x - xa) / w;
    const sag = Math.round(3 * 4 * u * (1 - u));
    px(g, x, y + sag, C.plum);
    if ((x - xa) % 4 === 1 && x < xb - 1) {
      const c = cols[Math.floor((x - xa) / 4) % 3];
      rect(g, x, y + sag + 1, 3, 1, c);
      px(g, x + 1, y + sag + 2, c);
    }
  }
}

function folkAt(g: CanvasRenderingContext2D, i: number, x: number, y: number, t: number) {
  const s = peopleSprites(FOLK[i % FOLK.length]);
  const wave = Math.floor(t * 3 + i) % 4 === 0;
  drawSpr(g, wave ? s.wave[Math.floor(t * 6) % s.wave.length] : s.stand.d, x, y);
}

function bonfire(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ellipse(g, x - 1, y + 1, 6, 2, C.sage);
  line(g, x - 5, y, x + 4, y - 3, C.plum);
  line(g, x - 4, y - 3, x + 5, y, C.plum);
  for (let i = 0; i < 14; i++) {
    const h = hash2(i, Math.floor(t * 10), 81);
    const fx = x - 3 + (i % 7), fy = y - 3 - Math.floor(h * (7 - Math.abs(3 - (i % 7))));
    px(g, fx, fy, h > 0.6 ? C.wool : C.butter);
  }
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.8 + i / 3) % 1;
    if (ph < 0.7) px(g, x - 1 + Math.round(Math.sin((t + i) * 3) * 2), y - 10 - Math.round(ph * 14), C.butter);
  }
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
    if (blessed.has(a) && !a.pen && Math.floor(t * 4 + a.id) % 3 === 0) out.push({ y: 1e8, draw: () => px(g, a.x, a.y - a.sp.r * 2 - 5, C.butter) });
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
        ground(() => ellipse(cg, x - 2, y + 1, 8, 2, C.sage), 1),
        { y, draw: () => { fallenStone(cg, x, y); px(cg, x - 5, y, C.moss); px(cg, x + 4, y + 1, C.moss); } },
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
