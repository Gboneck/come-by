import { C } from '../palette';
import { ellipse, px, rect } from '../gfx/draw';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import { text } from '../gfx/font';
import { hash2 } from '../rng';
import { gust } from '../render/wind';
import type { Game } from '../game';
import type { Drawable } from './buildings';
import type { Piece } from '../ui/decorbuild';
import { HOARD_AT, lootById, type Rarity } from '../systems/loot';

// Digging, drawn in code: scent wisps drifting from a buried find to the
// dog's nose, the earth flying while it digs, the hole it leaves until the
// next morning, the find hopping out with a sparkle, a small "E: DIG" over a
// dog standing on a scent, the X where the old map's hoard lies, a buried
// bone's mound. Item icons for the Ledger's FINDS page and the decor pieces
// seeds and the fossil become. Everything here keys off the clock and
// hash2, never Math.random: seeded runs must match.

const ground = (draw: () => void, k = 0): Drawable => ({ y: -1e8 + k, draw });

// ---- Item icons (one char per pixel; see CHAR in palette.ts) ----

const ICONS: Record<string, string[]> = {
  coin: ['..ppp..', '.pyyyp.', 'pywyyyp', 'pyyyyyp', 'pyyyyop', '.pyyop.', '..ppp..'],
  oldcoin: ['..ppp..', '.pwwsp.', 'pwssssp', 'pssyssp', 'psssssp', '.pssop.', '..ppp..'],
  purse: ['..p.p..', '...p...', '.ppppp.', 'psssssp', 'psywysp', 'psssssp', '.ppppp.'],
  hoard: ['.ppppppp.', 'pyyyyyyyp', 'ppppppppp', 'pwywyywyp', 'psssssssp', 'psssysssp', 'ppppppppp'],
  bone: ['.pp...pp.', 'pwwpppwwp', '.pwwwwwp.', 'pwwpppwwp', '.pp...pp.'],
  agedbone: ['.pp...pp.', 'pwspppswp', '.pwswwsp.', 'pswpppwsp', '.pp...pp.'],
  button: ['.ppp.', 'pyyyp', 'pypyp', 'pyyyp', '.ppp.'],
  horseshoe: ['pp...pp', 'ps...sp', 'ps...sp', 'psp.psp', '.pssss.', '..ppp..'],
  marble: ['.ppp.', 'ptwtp', 'pttwp', 'pwttp', '.ppp.'],
  pipe: ['.ppp....', 'pwwwp...', 'pwwwpppp', '.pwwwwwp', '..ppppp.'],
  thimble: ['..ppp..', '.pwwwp.', '.pwswp.', 'pwswswp', 'pwwwwwp', '.ppppp.'],
  arrowhead: ['...p...', '..psp..', '..pwsp.', '.pswsp.', '.psssp.', 'pspsp.p', '.p.p...'],
  'seed-sunflower': ['.ppppp.', 'pwwwwwp', 'pwyyywp', 'pwypywp', 'pwyyywp', 'pwwowwp', '.ppppp.'],
  'seed-herbs': ['.ppppp.', 'pwwwwwp', 'pwowowp', 'pwooowp', 'pwwowwp', 'pwwowwp', '.ppppp.'],
  'seed-roses': ['...p.p.', '..pop..', '.pwop..', 'pwywp..', '.pwpo..', '...op..', '...p...'],
  'seed-apple': ['...p...', '..pop..', '.ptttp.', 'pttwttp', 'ptttttp', '.ptttp.', '..ppp..'],
  fossil: ['.ppppp.', 'pwwsswp', 'pwppwsp', 'psp.psp', 'pswwp.p', '.pssssp', '..pppp.'],
  'tag-brass': ['..p..', '.p.p.', '.ppp.', 'pyyyp', 'pywyp', 'pyyyp', '.ppp.'],
  'tag-bone': ['..p....', '.p.p...', '..p....', 'p.p.p..', 'pwwwp..', 'p.p.p..'],
  'tag-gold': ['..p..', '.p.p.', '.ppp.', 'pywyp', 'pyyyp', 'pyywp', '.ppp.'],
  kerchief: ['ppppppp', 'pwpppwp', '.ppwpp.', '..ppp..', '...p...'],
  'photo-socks': ['ppppppp', 'pwwwwwp', 'pwtttwp', 'pwppowp', 'pwwpwwp', 'pwwwwwp', 'ppppppp'],
  'photo-blaze': ['ppppppp', 'pwwwwwp', 'pwtptwp', 'pwpwpwp', 'pwtptwp', 'pwwwwwp', 'ppppppp'],
  whistle: ['.......', 'pppppp.', 'pwpwwwp', 'pwwwwwp', 'pppppp.'],
  bell: ['...p...', '..ppp..', '.pyyyp.', '.pywyp.', 'pyyyyyp', 'ppppppp', '...p...'],
  page1: ['pppppp.', 'pwwwwpp', 'pwppwwp', 'pwwwwwp', 'pwpwwpp', 'pwwwwwp', 'ppppppp'],
};
for (const k of ['page2', 'page3', 'page4']) ICONS[k] = ICONS.page1;
const iconCache = new Map<string, Sprite>();

// Anchored at its bottom middle; `k` draws it a whole number of times larger.
export function lootIcon(g: CanvasRenderingContext2D, id: string, x: number, y: number, k = 1) {
  const rows = ICONS[id] ?? ICONS.coin;
  let s = iconCache.get(id);
  if (!s) iconCache.set(id, (s = spr(rows, Math.floor(rows[0].length / 2), rows.length - 1)));
  if (k === 1) drawSpr(g, s, x, y);
  else g.drawImage(s.img, Math.round(x) - s.ax * k, Math.round(y) - s.ay * k, s.w * k, s.h * k);
}

// The frame colour a rarity is drawn in (ink on the Ledger's paper).
export const RARITY_INK: Record<Rarity, string> = { common: C.sage, uncommon: C.moss, rare: C.teal, legendary: C.butter };

// ---- In the world ----

function hole(g: CanvasRenderingContext2D, x: number, y: number, snow: boolean) {
  ellipse(g, x, y, 4, 2, C.plum);
  rect(g, x - 3, y - 2, 6, 1, C.sage);
  px(g, x + 4, y - 1, C.sage);
  px(g, x - 4, y - 1, C.sage);
  // The heap of earth thrown out beside it.
  const heap = snow ? C.wool : C.sage;
  ellipse(g, x + 7, y + 1, 3, 1.5, heap);
  rect(g, x + 6, y - 1, 3, 1, heap);
  px(g, x + 6, y, C.plum);
  px(g, x + 8, y + 1, C.plum);
  px(g, x + 9, y, C.plum);
  px(g, x + 7, y - 1, snow ? C.sage : C.moss);
  px(g, x - 6, y + 1, C.plum);
  px(g, x - 5, y + 2, C.sage);
}

// Scent: curls of it lifting off a buried find and drifting to the dog's
// nose, faint (sage) on the move, bright (wool) when the dog stands to sniff.
function wisps(g: CanvasRenderingContext2D, dx: number, dy: number, sx: number, sy: number, k: number, sniff: number, t: number, seed: number) {
  const n = 3 + Math.round(k * 4 + sniff * 4);
  const len = Math.hypot(sx - dx, sy - dy) || 1;
  const nx = -(sy - dy) / len, ny = (sx - dx) / len;
  const bright = sniff > 0.6;
  for (let j = 0; j < n; j++) {
    const u = (t * 0.5 + j / n + hash2(seed, j, 3) * 0.2) % 1; // 0 at the find, 1 at the nose
    if (u > 0.9) continue;
    const wob = Math.sin(t * 2.4 + j * 1.9 + seed) * (2 + 3 * (1 - u));
    const x = Math.round(sx + (dx - sx) * u + nx * wob), y = Math.round(sy + (dy - sy) * u + ny * wob - 3 - (1 - u) * 3);
    const head = bright && u < 0.75 ? C.wool : C.sage;
    // A little curl: a head and a tail that flicks up, smaller near the nose.
    const flip = (j & 1) * 2 - 1;
    px(g, x, y, head);
    px(g, x + flip, y - 1, head);
    if (u < 0.6) px(g, x + flip * 2, y - 1, C.sage);
    if (u < 0.35) px(g, x + flip * 3, y, C.sage);
  }
  // Rising off the spot itself.
  for (let j = 0; j < 2 + Math.round(sniff * 2); j++) {
    const ph = (t * 0.7 + j * 0.37 + hash2(seed, j, 5)) % 1;
    const x = Math.round(sx + Math.sin((t + j) * 3) * 2), y = Math.round(sy - 2 - ph * 9);
    px(g, x, y, ph < 0.5 && bright ? C.wool : C.sage);
    if (ph < 0.6) px(g, x + 1, y - 1, C.sage);
  }
}

// Where it is buried, once the dog is nearly on it: turned earth, a glint.
function tuft(g: CanvasRenderingContext2D, x: number, y: number, close: boolean, t: number) {
  px(g, x - 2, y, C.moss);
  px(g, x + 1, y + 1, C.plum);
  px(g, x + 2, y - 1, C.moss);
  px(g, x - 1, y + 1, C.sage);
  if (close && Math.floor(t * 4) % 3 === 0) {
    px(g, x, y - 3, C.butter);
    px(g, x - 1, y - 3, C.wool);
    px(g, x + 1, y - 3, C.wool);
    px(g, x, y - 4, C.wool);
    px(g, x, y - 2, C.wool);
  }
}

// Earth flying out behind a digging dog.
function earth(g: CanvasRenderingContext2D, x: number, y: number, face: string, t: number, snow: boolean) {
  const back = face === 'r' ? -1 : face === 'l' ? 1 : 0;
  for (let j = 0; j < 9; j++) {
    const ph = (t * 3.2 + j / 9) % 1;
    const spread = (hash2(j, Math.floor(t * 3.2 + j / 9), 7) - 0.5) * 6;
    const ex = Math.round(x + back * (4 + ph * 10) + (back ? 0 : spread));
    const ey = Math.round(y - 2 - Math.sin(ph * Math.PI) * 7 + (back ? spread * 0.3 : ph * 6));
    const col = j % 3 === 0 ? (snow ? C.wool : C.sage) : C.plum;
    px(g, ex, ey, col);
    if (j % 4 === 0) px(g, ex + 1, ey, col); // a clod
  }
}

// The find, hopping out of the hole, then hanging a moment with a sparkle.
function pop(g: CanvasRenderingContext2D, id: string, x: number, y: number, t: number) {
  const item = lootById(id);
  const h = t < 0.5 ? Math.sin((t / 0.5) * Math.PI * 0.5) * 16 : 16 + Math.sin((t - 0.5) * 5) * 1.5;
  const iy = Math.round(y - 4 - h);
  if (t > 0.95 && Math.floor(t * 20) % 2) return; // blinking away
  lootIcon(g, id, x, iy);
  const r = 7 + Math.floor(t * 6) % 3;
  const col = item?.rarity === 'legendary' || item?.rarity === 'rare' ? C.butter : C.wool;
  for (let k = 0; k < 4; k++) {
    const a = t * 3 + (k * Math.PI) / 2;
    px(g, Math.round(x + Math.cos(a) * r), Math.round(iy - 3 + Math.sin(a) * r * 0.8), col);
  }
  if (t < 0.25) for (let k = 0; k < 6; k++) px(g, Math.round(x + Math.cos(k) * t * 40), Math.round(y - 2 - Math.abs(Math.sin(k)) * t * 30), C.wool);
}

// X marks the spot: stones laid in a cross where the hoard is buried.
function crossStones(g: CanvasRenderingContext2D, x: number, y: number) {
  for (const [dx, dy] of [[-4, -3], [-2, -1], [2, 1], [4, 3], [4, -3], [2, -1], [-2, 1], [-4, 3]]) {
    px(g, x + dx, y + dy, C.wool);
    px(g, x + dx, y + dy + 1, C.sage);
  }
}

function mound(g: CanvasRenderingContext2D, x: number, y: number, ready: boolean) {
  ellipse(g, x, y, 3, 1.5, C.moss);
  px(g, x - 1, y - 1, C.plum);
  px(g, x + 2, y, C.plum);
  if (ready) px(g, x + 1, y - 2, C.wool); // a knob of bone showing
}

export function lootDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const seen = (x: number, y: number, m = 30) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
  const L = game.loot;
  const d = game.dog;
  const t = game.t;
  const snow = game.season.snow > 0.5;
  const out: Drawable[] = [];
  for (const h of L.holes(game)) if (seen(h.x, h.y)) out.push(ground(() => hole(g, h.x, h.y, snow), 3));
  if (L.digging) {
    const dg = L.digging;
    out.push(ground(() => hole(g, Math.round(dg.x), Math.round(dg.y + 2), snow), 3));
    out.push({ y: d.y + 0.5, draw: () => earth(g, Math.round(d.x), Math.round(d.y), d.face, t, snow) });
  }
  for (const [k, s] of L.scent.entries()) {
    out.push({ y: 1e8 - 1, draw: () => wisps(g, Math.round(d.x), Math.round(d.y - 4), s.x, s.y, s.k, L.sniffing, t, k * 13 + (s.x | 0)) });
    const dd = Math.hypot(s.x - d.x, s.y - d.y);
    if (dd < 22) out.push(ground(() => tuft(g, s.x, s.y, dd < 8, t), 4));
  }
  for (const b of L.buried) if (seen(b.x, b.y)) out.push(ground(() => mound(g, b.x, b.y, b.day < game.day.day), 2));
  if (L.pages === 4 && !L.has('hoard') && seen(HOARD_AT[0], HOARD_AT[1])) out.push(ground(() => crossStones(g, HOARD_AT[0], HOARD_AT[1]), 2));
  for (const p of L.pops) out.push({ y: 1e8, draw: () => pop(g, p.id, Math.round(p.x), Math.round(p.y), p.t) });
  // On a scent the dog can dig: say so (on a phone the NIP button says DIG).
  if (!game.input.touchMode && game.mode === 'play' && L.canDig(game))
    out.push({ y: 1e8, draw: () => text(g, 'E: DIG', Math.round(d.x), Math.round(d.y - 22), C.wool, { align: 'center', shadow: C.plum }) });
  return out;
}

// ---- Decor pieces from seeds and the fossil (build mode's DECOR tab) ----

export type LootPieceId = 'sunflowers' | 'herbs' | 'roses' | 'sapling' | 'fossil';
const dug = (id: string) => (g: Game) => g.loot.has(id);
export const LOOT_PIECES: Piece[] = [
  { id: 'sunflowers', name: 'SUNFLOWERS', cost: 0, w: 2, h: 1, desc: 'GROWN FROM SEED YOU DUG UP.', open: dug('seed-sunflower'), lock: 'DIG UP SUNFLOWER SEEDS' },
  { id: 'herbs', name: 'HERB GARDEN', cost: 0, w: 2, h: 1, flat: true, desc: 'THYME, SAGE AND MINT, FROM DUG-UP SEED.', open: dug('seed-herbs'), lock: 'DIG UP HERB SEEDS' },
  { id: 'roses', name: 'ROSE ARCH', cost: 0, w: 2, h: 1, desc: 'FROM CUTTINGS YOU DUG UP.', open: dug('seed-roses'), lock: 'DIG UP ROSE CUTTINGS' },
  { id: 'sapling', name: 'APPLE SAPLING', cost: 0, w: 1, h: 1, desc: 'FROM A PIPPIN OUT OF THE OLD ORCHARD.', open: dug('seed-apple'), lock: 'DIG UP A PIPPIN' },
  { id: 'fossil', name: 'FOSSIL', cost: 0, w: 1, h: 1, desc: 'A SHELL TURNED TO STONE, DUG UP.', open: dug('fossil'), lock: 'DIG UP A FOSSIL' },
];
export const isLootPiece = (id: string): id is LootPieceId => LOOT_PIECES.some((p) => p.id === id);

export function drawLootPiece(g: CanvasRenderingContext2D, id: LootPieceId, x: number, y: number, t: number) {
  switch (id) {
    case 'sunflowers': {
      rect(g, x - 7, y - 2, 15, 4, C.plum);
      rect(g, x - 6, y - 1, 13, 2, C.moss);
      for (let i = 0; i < 4; i++) {
        const fx = x - 5 + i * 4, h = 8 + ((i * 3) % 4);
        const lean = gust(fx, y, t) > 0.6 ? 1 : 0;
        rect(g, fx, y - h, 1, h, C.sage);
        px(g, fx - 1, y - h + 3, C.moss);
        ellipse(g, fx + lean, y - h - 1, 2, 2, C.butter);
        px(g, fx + lean, y - h - 1, C.plum);
      }
      break;
    }
    case 'herbs':
      rect(g, x - 7, y - 2, 15, 4, C.plum);
      rect(g, x - 6, y - 1, 13, 2, C.sage);
      for (let i = 0; i < 7; i++) {
        const fx = x - 6 + i * 2, lean = gust(fx, y, t) > 0.6 ? 1 : 0;
        px(g, fx, y - 2, i % 2 ? C.moss : C.teal);
        px(g, fx + lean, y - 3, i % 3 ? C.moss : C.wool);
      }
      break;
    case 'roses':
      // An arch of rose briars over a little path.
      for (const sx of [x - 6, x + 6]) rect(g, sx, y - 12, 1, 13, C.plum);
      for (let i = -6; i <= 6; i++) px(g, x + i, y - 12 - Math.round(Math.sqrt(36 - i * i) * 0.5), C.plum);
      for (let i = 0; i < 14; i++) {
        const a = (i / 13) * Math.PI;
        const fx = Math.round(x - Math.cos(a) * 6), fy = Math.round(y - 12 - Math.sin(a) * 3 + (i % 3) - 1);
        px(g, fx, fy, i % 4 === 0 ? C.wool : i % 4 === 2 ? C.butter : C.moss);
      }
      for (const sx of [x - 6, x + 6]) for (let j = 0; j < 4; j++) px(g, sx + (j % 2 ? 1 : -1), y - 2 - j * 3, j % 2 ? C.moss : C.teal);
      break;
    case 'sapling':
      ellipse(g, x - 2, y + 1, 5, 1.5, C.sage);
      rect(g, x, y - 7, 1, 8, C.plum);
      rect(g, x + 2, y - 9, 1, 10, C.sage); // the stake
      ellipse(g, x, y - 9, 4, 3, C.teal);
      rect(g, x + 1, y - 11, 3, 1, C.moss);
      px(g, x - 2, y - 9, C.butter);
      break;
    case 'fossil':
      rect(g, x - 5, y - 2, 11, 3, C.plum);
      rect(g, x - 4, y - 1, 9, 1, C.sage);
      ellipse(g, x, y - 6, 5, 4, C.plum);
      ellipse(g, x, y - 6, 4, 3, C.wool);
      for (let a = 0; a < 18; a++) {
        const r = 0.5 + a * 0.17, ang = a * 0.9;
        px(g, Math.round(x + Math.cos(ang) * r), Math.round(y - 6 + Math.sin(ang) * r * 0.8), C.sage);
      }
      break;
  }
}
