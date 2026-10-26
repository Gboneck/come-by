import { C } from '../palette';
import { ellipse, line, px, rect } from '../gfx/draw';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
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

// ---- Stones ----

// A rounded stone: plum rim, wool face, sage on the shaded (left, lower) side.
export function pebble(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, moss = false) {
  ellipse(g, x, y, rx + 1, ry + 1, C.plum);
  ellipse(g, x, y, rx, ry, C.wool);
  px(g, x - rx, y, C.sage);
  if (ry >= 1) rect(g, x - rx + 1, y + ry, Math.max(1, rx), 1, C.sage);
  if (moss) px(g, x + 1, y - ry + 1, C.moss);
}

// Standing stones: rough, tapering, a little askew; never two alike.
// Lit from the upper right, lichen (moss) on the shaded side.
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
  stoneSprites ??= STONES.map((r) => spr(r));
  drawSpr(g, stoneSprites[v % STONES.length], x, y, v % 3 === 2);
}

export function fallenStone(g: CanvasRenderingContext2D, x: number, y: number) {
  fallenSprite ??= spr(FALLEN);
  drawSpr(g, fallenSprite, x, y);
}

// Cairns: v 0 a waymarker, 1 the lookout's, 2 the old cairn on the heights.
const CAIRNS: [number, number, number, number][][] = [
  [[0, 0, 2, 1], [0, -3, 2, 1], [0, -5, 1, 1]],
  [[-4, 0, 3, 2], [3, 0, 3, 2], [-1, -3, 3, 2], [2, -6, 2, 1], [-2, -6, 2, 1], [0, -9, 2, 1], [0, -11, 1, 1]],
  [[-5, 0, 3, 2], [1, 0, 3, 2], [5, -1, 2, 1], [-2, -4, 3, 2], [3, -4, 2, 2], [0, -8, 3, 2], [-1, -11, 2, 1], [1, -14, 2, 1], [0, -16, 1, 1]],
];
function cairn(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  CAIRNS[v].forEach(([dx, dy, rx, ry], i) => pebble(g, x + dx, y + dy, rx, ry, i % 3 === 1));
}

// A waymarker cairn by a hidden way. Once its place is found, a buttercup
// flower sits on top: that way has been walked.
function waymarker(g: CanvasRenderingContext2D, x: number, y: number, found: boolean) {
  px(g, x - 3, y, C.moss);
  px(g, x + 3, y - 1, C.moss);
  cairn(g, x, y, 0);
  if (found) {
    px(g, x, y - 8, C.butter);
    px(g, x - 1, y - 7, C.butter);
    px(g, x + 1, y - 7, C.butter);
    px(g, x, y - 7, C.wool);
  }
}

// ---- Trees ----

function fruitTree(g: CanvasRenderingContext2D, x: number, y: number, v: number, t: number) {
  const lean = v % 3 === 0 ? 1 : 0;
  rect(g, x - 1, y - 6, 2, 7, C.plum);
  px(g, x - 2, y, C.plum);
  px(g, x + 1 + lean, y - 7, C.plum);
  const cx = x + lean, cy = y - 11;
  const sway = gust(x, y, t) > 0.8 ? 1 : 0;
  ellipse(g, cx + sway, cy, 7, 5, C.plum);
  ellipse(g, cx + sway, cy - 1, 6, 4, C.teal);
  // Leaf clumps: lower arcs in plum, a moss top on the sunny side.
  for (let i = 0; i < 5; i++) {
    const ax = cx + sway - 4 + ((i * 7 + v * 3) % 9), ay = cy - 1 + ((i * 5 + v) % 4);
    px(g, ax, ay, C.plum);
    px(g, ax + 1, ay + 1, C.plum);
  }
  rect(g, cx + sway + 1, cy - 4, 3, 1, C.moss);
  px(g, cx + sway + 4, cy - 3, C.moss);
  // Fruit, and windfalls in the grass.
  for (let i = 0; i < 4; i++) px(g, cx + sway - 4 + Math.floor(hash2(v, i, 71) * 9), cy - 2 + Math.floor(hash2(v, i, 72) * 5), C.butter);
  px(g, x + 3, y + 1, C.butter);
  if (v % 2) px(g, x - 4, y + 2, C.butter);
}

function willow(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  rect(g, x - 1, y - 8, 3, 9, C.plum);
  px(g, x - 2, y, C.plum);
  px(g, x + 2, y, C.plum);
  ellipse(g, x, y - 13, 9, 5, C.plum);
  ellipse(g, x, y - 14, 8, 4, C.teal);
  rect(g, x + 1, y - 18, 5, 1, C.moss);
  // Hanging fronds, combed by the wind.
  for (let i = -9; i <= 9; i++) {
    const top = y - 13 + Math.round(Math.sqrt(Math.max(0, 1 - (i / 10) ** 2)) * 3);
    const len = 8 + Math.floor(hash2(i, 3, 81) * 5) - (Math.abs(i) < 3 ? 4 : 0);
    const k = gust(x + i * 2, y, t) > 0.6 ? 1 : 0;
    const col = (i + 20) % 3 === 0 ? C.moss : C.teal;
    for (let j = 0; j < len; j++) px(g, x + i + (j > len / 2 ? k : 0), top + j, j === len - 1 ? C.plum : col);
  }
}

// ---- The Shepherd's Hut and its fold: drystone walls ----

// Drystone: rows of rough stones with plum joints, each lit along its top,
// some in shade (sage), the odd one green with moss.
export function stones(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, shade: number) {
  rect(g, x, y, w, h, C.plum);
  for (let r = 0; r < h; r += 3) {
    let i = -Math.floor(hash2(seed, r, 31) * 3);
    while (i < w) {
      const sw = 2 + Math.floor(hash2(x + i, y + r, seed) * 3);
      const a = Math.max(0, i), b = Math.min(w, i + sw - 1);
      if (b > a) {
        const k = hash2(x + i, y + r, seed + 7);
        rect(g, x + a, y + r, b - a, 1, k < shade * 0.5 ? C.sage : C.wool);
        if (r + 1 < h) rect(g, x + a, y + r + 1, b - a, 1, k < shade ? C.sage : C.wool);
        if (k > 0.93) px(g, x + a, y + r + 1, C.moss);
      }
      i += sw;
    }
  }
}

// A wall running east-west seen from the front: a lit top and a shaded
// face. Ruins have a ragged top where stones have fallen off.
export function hWall(g: CanvasRenderingContext2D, x: number, base: number, w: number, face: number, seed: number, ruined: boolean) {
  const top = base - face - 2;
  const drop = (i: number) => (ruined ? Math.floor(hash2(Math.floor((x + i) / 3), base, seed) * 2.4) : 0);
  g.save();
  g.beginPath();
  for (let i = 0; i < w; i++) g.rect(x + i, top - 1 + drop(i), 1, base - top + 1 - drop(i));
  g.clip();
  rect(g, x, top - 1, w, base - top + 1, C.plum);
  stones(g, x, top, w, 3, seed + 3, 0.15);
  stones(g, x, base - face + 1, w, face - 1, seed, 0.55);
  g.restore();
  for (let i = 0; i < w; i++) px(g, x + i, top - 1 + drop(i), C.plum);
  rect(g, x, base, w, 1, C.sage);
}

// A wall running north-south, seen from above: its cobbled top, and the
// face of its south end.
export function vWall(g: CanvasRenderingContext2D, x: number, base: number, len: number, face: number, seed: number) {
  rect(g, x - 1, base - len - 1, 6, len + 1, C.plum);
  stones(g, x, base - len, 4, len - face, seed, 0.2);
  rect(g, x, base - len, 1, len - face, C.sage); // the shaded west lip
  stones(g, x, base - face + 1, 4, face - 1, seed + 5, 0.6);
  rect(g, x - 1, base, 6, 1, C.sage);
}

function rubble(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  for (let i = 0; i < (w * h) / 10; i++) {
    const rx = x + Math.floor(hash2(i, seed, 91) * w), ry = y + Math.floor(hash2(i, seed, 92) * h);
    pebble(g, rx, ry, 1 + (i % 2), 1);
  }
}

// The hut's floor: trodden earth, a cold hearth, a fallen roof beam.
function hutFloor(g: CanvasRenderingContext2D) {
  for (let y = 636; y < 662; y++)
    for (let x = 252; x < 292; x++) if (hash2(x, y, 95) < 0.18) px(g, x, y, (x + y) % 3 ? C.moss : C.sage);
  pebble(g, 282, 641, 2, 1);
  pebble(g, 287, 643, 2, 1);
  pebble(g, 284, 646, 2, 1);
  rect(g, 283, 642, 3, 2, C.plum); // ash
  line(g, 256, 646, 276, 658, C.plum);
  line(g, 257, 645, 277, 657, C.sage);
}

// ---- The Showman's Wagon ----

function wagon(g: CanvasRenderingContext2D, x: number, y: number) {
  const l = x - 13, r = x + 13;
  // Wheels behind the body.
  const wheel = (cx: number, cy: number) => {
    ellipse(g, cx, cy, 4, 4, C.plum);
    ellipse(g, cx, cy, 3, 3, C.sage);
    line(g, cx - 3, cy, cx + 3, cy, C.plum);
    line(g, cx, cy - 3, cx, cy + 3, C.plum);
    px(g, cx - 2, cy - 2, C.plum);
    px(g, cx + 2, cy + 2, C.plum);
    px(g, cx, cy, C.wool);
  };
  // Body.
  rect(g, l - 1, y - 21, 28, 16, C.plum);
  rect(g, l, y - 20, 26, 14, C.wool);
  rect(g, l, y - 20, 2, 14, C.sage);
  for (let i = 3; i < 26; i += 4) rect(g, l + i, y - 19, 1, 12, C.sage); // boards
  rect(g, l, y - 8, 26, 1, C.sage);
  // Windows and the door (right), with faded buttercup trim.
  rect(g, l + 4, y - 17, 6, 5, C.plum);
  rect(g, l + 5, y - 16, 4, 3, C.teal);
  px(g, l + 7, y - 16, C.plum);
  rect(g, l + 5, y - 14, 4, 1, C.plum);
  rect(g, r - 7, y - 18, 5, 11, C.plum);
  rect(g, r - 6, y - 17, 3, 9, C.sage);
  px(g, r - 4, y - 12, C.butter);
  // Barrel roof, teal under a plum rim, a moss sheen on the sunny side.
  ellipse(g, x, y - 21, 15, 5, C.plum);
  rect(g, l - 2, y - 21, 30, 1, C.plum);
  ellipse(g, x, y - 22, 14, 4, C.teal);
  rect(g, x + 2, y - 25, 9, 1, C.moss);
  rect(g, l, y - 21, 26, 1, C.butter);
  for (let i = 1; i < 26; i += 3) px(g, l + i, y - 20, C.butter);
  // A chimney pipe, bent.
  rect(g, l + 6, y - 30, 2, 5, C.plum);
  px(g, l + 5, y - 30, C.plum);
  // Undercarriage and wheels; the front one has sunk and lost spokes.
  rect(g, l + 1, y - 6, 24, 2, C.plum);
  wheel(l + 5, y - 3);
  wheel(r - 6, y - 2);
  px(g, r - 7, y - 3, C.sage);
  // Steps up to the door.
  rect(g, r, y - 6, 4, 1, C.plum);
  rect(g, r + 1, y - 3, 4, 1, C.plum);
  rect(g, r, y - 5, 4, 1, C.wool);
  rect(g, r + 1, y - 2, 4, 1, C.wool);
  // Grass grown up round the wheels.
  for (let i = 0; i < 6; i++) px(g, l + 2 + i * 5, y - (i % 2), C.moss);
}

// ---- Water off the rocks into the pool ----

function falls(g: CanvasRenderingContext2D, x: number, y: number, h: number, t: number) {
  const top = y - h;
  rect(g, x - 4, top, 9, h, C.teal);
  rect(g, x - 5, top + 1, 1, h - 1, C.sage);
  rect(g, x + 5, top + 1, 1, h - 1, C.plum);
  // Streaks of white water of different lengths, each column at its own pace.
  for (let i = -4; i <= 4; i++) {
    const v = 24 + hash2(i, 1, 98) * 14, len = 3 + Math.floor(hash2(i, 2, 98) * 3);
    for (let j = 0; j < h; j++) {
      const seg = Math.floor((j - t * v) / len);
      if (hash2(i, seg, 99) < (Math.abs(i) < 3 ? 0.55 : 0.35)) px(g, x + i, top + j, C.wool);
    }
  }
  rect(g, x - 4, top, 9, 1, C.wool); // the lip
  px(g, x - 5, top, C.sage);
  px(g, x + 5, top, C.sage);
  // Foam and spray where it lands.
  for (let i = -7; i <= 7; i++) {
    if (hash2(i, Math.floor(t * 9), 97) < 0.6) px(g, x + i, y + (Math.abs(i) > 4 ? 1 : 0), C.wool);
    if (Math.abs(i) < 6 && hash2(i, Math.floor(t * 7), 96) < 0.18) px(g, x + i, y - 2 - Math.floor(hash2(i, Math.floor(t * 7), 95) * 3), C.wool);
  }
}

// ---- Keepsakes where they lie ----

function glint(g: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number) {
  const ph = (t * 0.7 + seed * 0.37) % 1;
  if (ph > 0.14) return;
  const big = ph > 0.04 && ph < 0.1;
  px(g, x, y, C.wool);
  px(g, x - 1, y, C.butter);
  px(g, x + 1, y, C.butter);
  px(g, x, y - 1, C.butter);
  px(g, x, y + 1, C.butter);
  if (big) {
    px(g, x - 2, y, C.butter);
    px(g, x + 2, y, C.butter);
    px(g, x, y - 2, C.butter);
    px(g, x, y + 2, C.butter);
  }
}

export function keepsakeIcon(g: CanvasRenderingContext2D, id: KeepsakeId, x: number, y: number) {
  switch (id) {
    case 'bell':
      rect(g, x - 1, y - 3, 3, 1, C.butter);
      rect(g, x - 2, y - 2, 5, 2, C.butter);
      rect(g, x - 2, y, 5, 1, C.plum);
      px(g, x, y + 1, C.plum);
      px(g, x + 1, y - 2, C.wool);
      break;
    case 'crook':
      rect(g, x, y - 11, 1, 12, C.plum);
      rect(g, x + 1, y - 13, 2, 1, C.plum);
      px(g, x + 3, y - 12, C.plum);
      px(g, x + 3, y - 11, C.plum);
      px(g, x + 2, y - 10, C.plum);
      px(g, x, y - 12, C.plum);
      break;
    case 'horn':
      line(g, x - 3, y - 2, x + 1, y, C.wool);
      line(g, x - 3, y - 3, x + 1, y - 1, C.wool);
      px(g, x + 2, y - 1, C.wool);
      px(g, x + 2, y - 2, C.wool);
      px(g, x - 4, y - 3, C.plum);
      break;
    case 'whistle':
      rect(g, x - 2, y, 5, 1, C.wool);
      px(g, x - 1, y, C.plum);
      px(g, x + 1, y, C.plum);
      px(g, x + 3, y, C.sage);
      break;
    case 'rosette':
      ellipse(g, x, y - 2, 2, 2, C.teal);
      px(g, x, y - 2, C.butter);
      px(g, x - 1, y + 1, C.teal);
      px(g, x + 1, y + 1, C.teal);
      px(g, x - 1, y + 2, C.teal);
      px(g, x + 1, y + 2, C.teal);
      break;
  }
}

// A post with something hung on it (the orchard bell, the drover's horn).
function hungPost(g: CanvasRenderingContext2D, x: number, y: number, v: number, item: KeepsakeId | null) {
  const h = v ? 9 : 11;
  rect(g, x - 1, y - h, 2, h + 1, C.plum);
  px(g, x - 1, y - h, C.sage);
  if (!v) {
    rect(g, x - 1, y - h, 6, 1, C.plum); // arm
    if (item) keepsakeIcon(g, item, x + 4, y - h + 4);
  } else {
    px(g, x - 2, y - 4, C.plum); // a notch for the old drove-road sign
    rect(g, x - 3, y - 7, 2, 1, C.sage);
    if (item) keepsakeIcon(g, item, x + 2, y - 4);
  }
}

// ---- The Drove Trail's hurdle ----

function hurdle(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, swing: number) {
  // Hinged on the east post; it folds back (north) along the trail as it
  // opens, so an open hurdle stands edge-on beside the way through.
  const w = Math.round((x1 - x0 - 2) * (1 - swing));
  const rise = Math.round(swing * 14);
  const hx = x1 - 2; // hinge post
  rect(g, x0, y + 1, x1 - x0, 1, C.sage);
  rect(g, x0, y - 9, 2, 10, C.plum); // the latch post
  rect(g, hx, y - 9, 2, 10, C.plum);
  px(g, x0, y - 9, C.sage);
  px(g, hx + 1, y - 9, C.sage);
  if (rise > 0) {
    rect(g, hx - 3, y - 7 - rise, 3, rise + 2, C.plum);
    for (let j = 0; j < rise; j += 2) {
      px(g, hx - 2, y - 6 - j, (j >> 1) & 1 ? C.moss : C.sage);
      px(g, hx - 3 + ((j >> 1) & 1) * 2, y - 7 - j, C.moss);
    }
  }
  if (w > 3) {
    const l = hx - w;
    for (const ry of [y - 2, y - 4, y - 6]) {
      for (let x = l; x < hx; x++) {
        const k = (x + ry) % 4;
        px(g, x, ry, k === 0 ? C.plum : k === 1 ? C.sage : C.moss);
        px(g, x, ry + 1, k === 2 ? C.plum : C.sage);
      }
    }
    for (let x = hx - 8; x > l + 1; x -= 8) rect(g, x, y - 7, 1, 8, C.plum);
    rect(g, l, y - 8, 2, 9, C.plum);
  }
  if (swing === 0) px(g, x0 + 2, y - 5, C.wool); // the latch, on the trail side
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
          if (k === 'rosette') rect(g, ix, iy - 4, 1, 5, C.plum);
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
  const shadow = (rx: number, dx = -3) => ellipse(g, x + dx, y + 1, rx, 1.5, C.sage);
  switch (pr.kind) {
    case 'stone':
      return { y, draw: () => { shadow(4, -3); standingStone(g, x, y, v); } };
    case 'fallen':
      return { y, draw: () => fallenStone(g, x, y) };
    case 'cairn':
      return { y, draw: () => { shadow(v === 2 ? 9 : 7, -3); cairn(g, x, y, v); } };
    case 'fruit':
      return { y, draw: () => { ellipse(g, x - 3, y + 1, 7, 2, C.sage); fruitTree(g, x, y, v, t); } };
    case 'willow':
      return { y, draw: () => { ellipse(g, x - 3, y + 1, 10, 2, C.sage); willow(g, x, y, t); } };
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
      return { y, draw: () => { ellipse(g, x - 4, y + 1, 15, 2, C.sage); wagon(g, x, y); } };
    case 'falls':
      return { y, draw: () => falls(g, x, y, pr.h!, t) };
  }
  return null;
}
