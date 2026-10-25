import { C } from '../palette';
import { line, rect, px, ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { hash2 } from '../rng';
import { penDrawables, type Drawable } from './buildings';
import { gust } from '../render/wind';
import { skyDarkness } from '../render/sky';
import type { Game } from '../game';
import type { CourseGate, Yard } from '../ranch/fixtures';
import { PARTS } from '../systems/trials';
import { SHOW_ENTRY, type YardSite } from '../world/map';

// Show Ground course furniture and the buyers' yards, drawn in code. The
// Show Ground has its own look: mown stripes and a trodden patch at the
// handler's post (baked in world/terrain.ts), a judge's tent, benches of
// onlookers who cheer a good gate, flags on poles snapping in the wind.

// ---- Show Ground layout (pixels; decorative, nothing here collides) ----
export const SHOW = {
  tent: { x: 1004, y: 1266 },
  benches: [{ x0: 748, x1: 784, y: 1282 }, { x0: 790, x1: 818, y: 1286 }],
  rope: { x0: 742, x1: 824, y: 1272 },
  flags: [{ x: 676, y: 1182 }, { x: 772, y: 1084 }, { x: 1010, y: 1104 }, { x: 1070, y: 1214 }, { x: 900, y: 1290 }],
  standing: [{ x: 742, y: 1290, c: C.sage }, { x: 826, y: 1290, c: C.teal }, { x: 1022, y: 1272, c: C.plum }],
};

// Little people: a hat, a wool face, a coat; `wave` raises an arm.
function person(g: CanvasRenderingContext2D, x: number, y: number, coat: string, hat: string, wave: boolean, seated = false) {
  if (!seated) {
    px(g, x - 1, y, C.plum);
    px(g, x + 1, y, C.plum);
  }
  const top = seated ? y - 5 : y - 6;
  rect(g, x - 1, top + 2, 3, seated ? 3 : 4, coat);
  px(g, x, top + 1, C.wool);
  rect(g, x - 1, top, 3, 1, hat);
  px(g, x, top - 1, hat);
  if (wave) {
    px(g, x + 2, top + 1, coat);
    px(g, x + 2, top, C.wool);
  } else px(g, x + (seated ? 0 : 2), top + 3, seated ? coat : C.wool);
}

const HATS = [C.plum, C.butter, C.teal, C.wool, C.plum];
const COATS = [C.teal, C.plum, C.sage, C.butter, C.wool];

// A post with a pennant. `state`: 0 waiting, 1 the next target (big
// buttercup flags snapping in the wind), 2 judged (flag lowered, sage).
function coursePost(g: CanvasRenderingContext2D, x: number, y: number, state: number, side: number, t: number) {
  const s = side > 0 ? 1 : -1;
  rect(g, x - 2, y + 1, 5, 1, C.sage);
  rect(g, x - 1, y - 11, 2, 12, C.wool);
  rect(g, x - 1, y - 11, 1, 12, C.plum);
  px(g, x, y - 12, C.plum);
  for (let k = y - 8; k <= y; k += 3) px(g, x, k, C.plum);
  if (state === 2) {
    // Lowered and furled.
    rect(g, x + (s > 0 ? 1 : -2), y - 5, 2, 3, C.sage);
    return;
  }
  const big = state === 1;
  const w = big ? 6 : 4, h = big ? 4 : 3;
  const fy = y - 11;
  const snap = gust(x, y, t) > 0.4 || (big && Math.floor(t * 5 + x) % 2 === 0);
  const col = big ? C.butter : C.wool;
  for (let i = 0; i < w; i++) {
    const dx = s > 0 ? x + 1 + i : x - 2 - i;
    // A pennant tapers; snapping in a gust it ripples by a pixel.
    const hh = Math.max(1, h - Math.floor((i * h) / (w + 1)));
    const dy = snap && i % 3 === 1 ? 1 : 0;
    rect(g, dx, fy + dy, 1, hh, col);
    if (big) px(g, dx, fy + dy + hh, C.plum);
  }
}

// Dotted line on the ground between a gate's posts; chevrons point the way
// through the next gate.
function gateLine(g: CanvasRenderingContext2D, gt: CourseGate, hot: boolean, t: number) {
  const [a, b] = gt.posts;
  const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3);
  const shift = hot ? Math.floor(t * 4) % 2 : 0;
  for (let i = 1; i < n; i++) {
    if (hot && (i + shift) % 2) continue;
    px(g, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, hot ? C.butter : C.moss);
  }
  if (!hot) return;
  // Two chevrons on the ground, walking through in the direction of travel.
  const k = (t * 6) % 6;
  for (const d of [-4 + k, 2 + k]) {
    const cx = Math.round(gt.x + gt.dx * d), cy = Math.round(gt.y + gt.dy * d);
    const nx = -gt.dy, ny = gt.dx;
    for (let j = -2; j <= 2; j++) {
      const back = Math.abs(j);
      px(g, Math.round(cx + nx * j - gt.dx * back), Math.round(cy + ny * j - gt.dy * back), C.wool);
    }
  }
}

// A bobbing marker over the next gate, outlined so it reads on a phone.
function gateMarker(g: CanvasRenderingContext2D, gt: CourseGate, t: number) {
  const x = Math.round(gt.x), y = Math.round(gt.y - 20 + Math.round(Math.sin(t * 4) * 1.5));
  const rows = ['ppppppp', 'pyyyyyp', '.pyyyp.', '..pyp..', '...p...'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && px(g, x - 3 + i, y + j, ch === 'p' ? C.plum : C.butter)));
}

// The handler's post: a shepherd's crook planted in the ground.
function crook(g: CanvasRenderingContext2D, x: number, y: number) {
  rect(g, x - 1, y + 1, 5, 1, C.sage);
  rect(g, x, y - 12, 1, 13, C.plum);
  rect(g, x + 1, y - 14, 2, 1, C.plum);
  px(g, x + 3, y - 13, C.plum);
  px(g, x + 3, y - 12, C.plum);
  px(g, x + 2, y - 11, C.plum);
  px(g, x, y - 13, C.plum);
  px(g, x + 1, y - 14, C.butter);
}

// Bunting strung between two poles; the pennants lift in a gust.
function bunting(g: CanvasRenderingContext2D, xa: number, xb: number, y: number, t: number) {
  rect(g, xa, y - 14, 1, 15, C.plum);
  rect(g, xb, y - 14, 1, 15, C.plum);
  px(g, xa, y - 15, C.butter);
  px(g, xb, y - 15, C.butter);
  rect(g, xa - 1, y + 1, 3, 1, C.sage);
  rect(g, xb - 1, y + 1, 3, 1, C.sage);
  const cols = [C.butter, C.wool, C.teal];
  const w = xb - xa;
  for (let x = xa + 1; x < xb; x++) {
    const u = (x - xa) / w;
    const sag = Math.round(4 * 4 * u * (1 - u));
    px(g, x, y - 13 + sag, C.plum);
    const k = x - xa - 2;
    if (k >= 0 && k % 6 < 3) {
      const col = cols[Math.floor(k / 6) % 3];
      const lift = gust(x, y, t) > 0.5 && k % 6 === 2 ? -1 : 0;
      const h = k % 6 === 1 ? 3 : 2;
      rect(g, x + (lift ? 1 : 0), y - 12 + sag, 1, h + lift, col);
    }
  }
}

// A tall flag on a pole, streaming downwind; stronger gusts stretch it out.
function flagPole(g: CanvasRenderingContext2D, x: number, y: number, col: string, t: number) {
  rect(g, x - 1, y + 1, 3, 1, C.sage);
  rect(g, x, y - 18, 1, 19, C.plum);
  px(g, x, y - 19, C.butter);
  const gs = gust(x, y, t);
  const len = gs > 0.6 ? 7 : gs > 0.25 ? 6 : 5;
  const droop = gs > 0.25 ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const wave = Math.round(Math.sin(t * 7 + i * 0.9 + x) * (gs > 0.25 ? 0.6 : 0.3));
    rect(g, x + 1 + i, y - 18 + wave + (i > len - 3 ? droop : 0), 1, 3 - (i === len - 1 ? 1 : 0), col);
  }
}

// The judge's tent: a peaked, striped marquee open at the front, a table
// with a cloth and the judge behind it, a pennant on the king pole.
function judgeTent(g: CanvasRenderingContext2D, x: number, y: number, t: number, nod: boolean) {
  rect(g, x - 15, y + 1, 27, 2, C.sage);
  // Dark inside, back wall.
  rect(g, x - 11, y - 11, 22, 11, C.plum);
  // Table with a cloth, a bell and the score book; the judge behind it.
  person(g, x - 1, y - 5, C.teal, C.plum, nod, true);
  rect(g, x - 8, y - 5, 16, 3, C.wool);
  rect(g, x - 8, y - 2, 16, 1, C.sage);
  rect(g, x - 7, y - 1, 1, 2, C.wool);
  rect(g, x + 6, y - 1, 1, 2, C.wool);
  px(g, x + 4, y - 6, C.butter);
  rect(g, x - 6, y - 6, 3, 1, C.teal);
  // Peaked roof in stripes, shaded on its left slope, with a valance.
  for (let r = 0; r < 9; r++) {
    const hw = 2 + Math.round((r * 11) / 8);
    for (let dx = -hw; dx <= hw; dx++) {
      const stripe = Math.floor((dx + 30) / 3) % 2 === 0;
      let col: string = stripe ? C.wool : C.teal;
      if (dx < -hw * 0.4 && stripe && (dx + r) % 2 === 0) col = C.sage;
      px(g, x + dx, y - 20 + r, col);
    }
    px(g, x - hw - 1, y - 20 + r, C.plum);
    px(g, x + hw + 1, y - 20 + r, C.plum);
  }
  for (let dx = -13; dx <= 13; dx++) if ((dx + 13) % 3 !== 2) px(g, x + dx, y - 11, Math.floor((dx + 30) / 3) % 2 === 0 ? C.wool : C.teal);
  // Corner poles and guy ropes.
  for (const sx of [-12, 12]) {
    rect(g, x + sx, y - 11, 1, 12, C.plum);
    line(g, x + sx, y - 10, x + sx * 1.35, y, C.wool);
  }
  // Pennant on the king pole.
  rect(g, x, y - 26, 1, 6, C.plum);
  const f = gust(x, y, t) > 0.4 ? 1 : 0;
  rect(g, x + 1, y - 26, 4 + f, 1, C.butter);
  rect(g, x + 1, y - 25, 3, 1, C.butter);
}

function bench(g: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  rect(g, x0 - 1, y + 1, x1 - x0 + 2, 1, C.sage);
  rect(g, x0, y - 3, x1 - x0, 2, C.plum);
  rect(g, x0, y - 3, x1 - x0, 1, C.moss);
  for (const lx of [x0 + 1, x1 - 2]) rect(g, lx, y - 1, 1, 2, C.plum);
}

// A rope on low stakes keeping the onlookers off the course.
function rope(g: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x += 10) {
    rect(g, x, y - 4, 1, 5, C.plum);
    px(g, x, y - 5, C.wool);
  }
  for (let x = x0; x < x1; x++) {
    const u = ((x - x0) % 10) / 10;
    px(g, x, y - 4 + Math.round(2 * 4 * u * (1 - u) * 0.5), C.wool);
  }
}

// ---- Buyers' yards ----

// A buyer's covered cart, shafts to the left. `x, y` is its 2x2 tile corner
// (it stands within the cells its yard marks solid).
function cart(g: CanvasRenderingContext2D, x: number, y: number, flag: boolean, t: number) {
  const b = y + 14;
  rect(g, x - 3, b + 1, 18, 1, C.sage);
  line(g, x + 2, b - 6, x - 4, b - 2, C.plum);
  line(g, x + 2, b - 5, x - 4, b - 1, C.plum);
  rect(g, x - 5, b - 1, 2, 2, C.plum);
  // Canvas cover on hoops, shaded on its left, a dark opening at the back.
  rect(g, x + 4, b - 16, 8, 1, C.wool);
  rect(g, x + 3, b - 15, 10, 1, C.wool);
  rect(g, x + 2, b - 14, 12, 6, C.wool);
  rect(g, x + 2, b - 14, 1, 6, C.sage);
  for (const hx of [x + 5, x + 8, x + 11]) rect(g, hx, b - 14, 1, 6, C.sage);
  rect(g, x + 12, b - 13, 2, 4, C.plum);
  px(g, x + 12, b - 10, C.butter);
  px(g, x + 13, b - 10, C.wool);
  // Bed and wheels.
  rect(g, x + 1, b - 8, 14, 4, C.plum);
  rect(g, x + 1, b - 8, 14, 1, C.moss);
  for (let i = x + 3; i < x + 15; i += 4) px(g, i, b - 6, C.teal);
  for (const wx of [x + 4, x + 12]) {
    ring(g, wx, b - 2, 2, C.plum);
    px(g, wx, b - 2, C.wool);
    px(g, wx - 1, b - 3, C.sage);
    px(g, wx + 1, b - 1, C.sage);
  }
  if (flag) {
    // A pennant on the cart: this buyer is waiting for stock.
    rect(g, x + 14, b - 23, 1, 9, C.plum);
    const f = gust(x, y, t) > 0.4 || Math.floor(t * 4) % 2 === 0;
    rect(g, x + 15, b - 23, 5, 1, C.butter);
    rect(g, x + 15, b - 22, f ? 5 : 4, 1, C.butter);
    rect(g, x + 15, b - 21, 3, 1, C.butter);
    px(g, x + 15, b - 20, C.plum);
  }
}

// What each buyer keeps by the cart: the miller's flour sacks, the drover's
// camp fire and bedroll, the sale yard's auction stand and bell.
export function yardFire(site: YardSite): { x: number; y: number } {
  return { x: site.cart.tx * 8 + 7, y: (site.cart.ty + 2) * 8 + 4 };
}

function yardProps(g: CanvasRenderingContext2D, site: YardSite, t: number, night: boolean) {
  const x = site.cart.tx * 8, y = (site.cart.ty + 2) * 8 + 5;
  switch (site.id) {
    case 'mill':
      rect(g, x - 1, y + 1, 14, 1, C.sage);
      for (const [sx, sy] of [[0, 0], [4, 0], [8, 0], [2, -3], [6, -3]] as const) {
        rect(g, x + sx, y + sy - 3, 4, 4, C.wool);
        px(g, x + sx, y + sy, C.sage);
        px(g, x + sx + 1, y + sy - 3, C.sage);
        px(g, x + sx + 2, y + sy - 4, C.wool);
      }
      break;
    case 'drover': {
      // Camp fire: stones, crossed sticks, a flicker of buttercup.
      const f = yardFire(site);
      for (const [dx, dy] of [[-3, 0], [3, 0], [-2, 1], [2, 1], [0, 2]] as const) px(g, f.x + dx, f.y + dy, C.wool);
      line(g, f.x - 2, f.y + 1, f.x + 2, f.y - 1, C.plum);
      line(g, f.x - 2, f.y - 1, f.x + 2, f.y + 1, C.plum);
      const k = Math.floor(t * 8);
      px(g, f.x + (k % 3) - 1, f.y - 1, C.butter);
      px(g, f.x, f.y - 2 - (k % 2), C.butter);
      if (night || k % 4 === 0) px(g, f.x + 1, f.y - 2, C.butter);
      // Bedroll.
      rect(g, x + 10, y - 2, 6, 3, C.teal);
      rect(g, x + 10, y - 2, 2, 3, C.wool);
      px(g, x + 15, y - 2, C.plum);
      break;
    }
    case 'sale': {
      // Auction stand: a box to stand on, a rail, the bell on a post.
      rect(g, x - 1, y + 1, 12, 1, C.sage);
      rect(g, x, y - 4, 8, 5, C.plum);
      rect(g, x, y - 4, 8, 1, C.moss);
      rect(g, x + 2, y - 2, 4, 1, C.teal);
      rect(g, x + 10, y - 9, 1, 10, C.plum);
      rect(g, x + 9, y - 9, 3, 1, C.plum);
      rect(g, x + 9, y - 8, 3, 2, C.butter);
      px(g, x + 10, y - 6, C.plum);
      break;
    }
  }
}

// Name board under a little roof, on two posts.
function board(g: CanvasRenderingContext2D, x: number, y: number, label: string, hot: boolean) {
  const w = textWidth(label) + 4;
  const l = x - Math.floor(w / 2) - 1;
  rect(g, l + 1, y - 4, 1, 5, C.plum);
  rect(g, l + w, y - 4, 1, 5, C.plum);
  rect(g, l - 1, y - 14, w + 4, 2, C.teal);
  rect(g, l - 1, y - 14, w + 4, 1, C.sage);
  rect(g, l, y - 12, w + 2, 9, C.plum);
  rect(g, l + 1, y - 11, w, 7, hot ? C.butter : C.wool);
  rect(g, l + 1, y - 5, w, 1, hot ? C.moss : C.sage);
  text(g, label, x, y - 10, C.plum, { align: 'center' });
}

const YARD_LABEL = { mill: 'MILL', drover: 'DROVER', sale: 'SALE YARD' } as const;

function yardDrawables(game: Game, g: CanvasRenderingContext2D, y: Yard, t: number, night: boolean): Drawable[] {
  const ord = game.orders.forYard(y.site.id);
  const out = penDrawables(g, y.pen, t, false);
  const cx = y.site.cart.tx * 8, cy = y.site.cart.ty * 8;
  out.push({ y: cy + 14, draw: () => cart(g, cx, cy, !!ord, t) });
  out.push({ y: (y.site.cart.ty + 2) * 8 + 5, draw: () => yardProps(g, y.site, t, night) });
  const label = ord ? `${YARD_LABEL[y.site.id]} ${ord.got}/${ord.n}` : YARD_LABEL[y.site.id];
  const bx = y.pen.x0 + 6, by = y.pen.y0 + 1;
  out.push({ y: by, draw: () => board(g, bx, by, label, !!ord) });
  return out;
}

// Onlookers cheer for a moment each time the flock clears a part.
const cheer = new WeakMap<Game, { step: number; t: number }>();

export function courseDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const night = skyDarkness(game.day) > 0.3;
  const seen = (x0: number, y0: number, x1: number, y1: number) => x1 > ox - 40 && x0 < ox + W + 40 && y1 > oy - 40 && y0 < oy + H + 40;
  const t = game.t;
  const out: Drawable[] = [];
  for (const y of game.ranch.yards) {
    const p = y.pen;
    if (seen(p.x0, p.y0, (y.site.cart.tx + 3) * 8, p.y1 + 16)) out.push(...yardDrawables(game, g, y, t, night));
  }
  const c = game.ranch.course;
  // Bunting over the way in from the Home Meadow.
  const e = SHOW_ENTRY;
  if (seen(e.x0, e.y - 20, e.x1, e.y)) out.push({ y: e.y, draw: () => bunting(g, e.x0, e.x1, e.y, t) });
  if (!seen(c.gates[1].x - 60, c.release.y - 60, SHOW.tent.x + 40, SHOW.benches[0].y + 20)) return out;
  const r = game.trials.run;
  const step = r ? r.step : -1;
  let ch = cheer.get(game);
  if (!ch) cheer.set(game, (ch = { step, t: -9 }));
  if (step > ch.step && step > 0) ch.t = t;
  ch.step = step;
  const cheering = t - ch.t < 1.6;

  c.gates.forEach((gt, i) => {
    const part = PARTS.findIndex((p) => p.id === gt.id);
    // The lift heads for the fetch gate, so it is lit from the start.
    const state = !r ? 0 : step === part || (step === 0 && i === 0) ? 1 : step > part ? 2 : 0;
    out.push({ y: -1e9 + 1, draw: () => gateLine(g, gt, state === 1, t) });
    gt.posts.forEach((p, k) => out.push({ y: p.y, draw: () => coursePost(g, p.x, p.y, state, k ? 1 : -1, t + i) }));
    if (state === 1) out.push({ y: 1e9, draw: () => gateMarker(g, gt, t) });
  });
  const post = c.post;
  if (!r) out.push({ y: -1e9 + 2, draw: () => ring(g, post.x, post.y + 4, 13, C.moss, 4) });
  out.push({ y: post.y, draw: () => crook(g, post.x, post.y) });
  out.push(...penDrawables(g, c.pen, t, false));

  // The crowd, the judge and the flags.
  const T = SHOW.tent;
  out.push({ y: T.y, draw: () => judgeTent(g, T.x, T.y, t, cheering) });
  const R = SHOW.rope;
  out.push({ y: R.y, draw: () => rope(g, R.x0, R.x1, R.y) });
  SHOW.benches.forEach((b, bi) => {
    out.push({ y: b.y, draw: () => bench(g, b.x0, b.x1, b.y) });
    for (let x = b.x0 + 3, k = 0; x < b.x1 - 2; x += 6, k++) {
      if (hash2(x, b.y, 7) < 0.25) continue;
      const n = bi * 7 + k;
      const wave = cheering ? Math.floor((t - ch!.t) * 6 + n) % 2 === 0 : Math.floor(t / 3 + n * 1.7) % 11 === 0;
      out.push({ y: b.y - 0.5, draw: () => person(g, x, b.y - 2, COATS[n % 5], HATS[(n * 3) % 5], wave, true) });
    }
  });
  SHOW.standing.forEach((s, i) => {
    const wave = cheering && i !== 2;
    out.push({ y: s.y, draw: () => person(g, s.x, s.y, s.c, HATS[i + 1], wave) });
  });
  const cols = [C.butter, C.teal, C.wool, C.butter, C.teal];
  SHOW.flags.forEach((f, i) => out.push({ y: f.y, draw: () => flagPole(g, f.x, f.y, cols[i], t + i * 0.3) }));
  return out;
}
