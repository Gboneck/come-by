import { C } from '../palette';
import { makeCanvas } from '../gfx/screen';
import { spr, type Sprite } from '../gfx/sprite';
import { hash2 } from '../rng';
import { rimLight } from './animals';
import type { Season } from '../systems/season';

// The title screen's illustration: along the bottom, a grassy knoll with
// the heeler sitting up on it looking out over the valley, far hills with a
// little flock and a farmhouse, a tree by the knoll, all following the
// season. The still part is painted once per size and season into a canvas;
// only the small moving things (the tail, petals and leaves, snowflakes,
// butterflies, the dog's breath) are drawn each frame.

// The heeler sitting up, facing us: ears up, plum mask, wool blaze and
// muzzle, mottled teal coat, the red bandana, tail curled round.
const HEELER = [
  '......p.....p..........',
  '.....ptp...ptp.........',
  '.....pttp.pttp.........',
  '.....ptttttttp.........',
  '....tttttwtttt.........',
  '....tppttwttppt........',
  '....tpwtwwwtwpt........',
  '.....ttwwwwwtt.........',
  '......twwpwwt..........',
  '......rrwwwrr..........',
  '.....rrrrrrrrr.........',
  '.....trrrrrrrt.........',
  '....ttttrrrtttt........',
  '....twttttttwttt.......',
  '....ttwtttttttttt......',
  '....tt.ttttttwtttt.....',
  '....tt.tt.ttttttttt....',
  '....tt.tt..tttwttttt...',
  '....tt.tt..ttttttttt...',
  '....ww.ww..tttttttttt..',
  '...ppp.ppp.pppppppppp..',
];
const TAIL = [
  ['.....................tt', '....................tt.'],
  ['......................t', '.....................tt'],
];

let heeler: Sprite[] | null = null;
function heelerSprites(): Sprite[] {
  if (heeler) return heeler;
  heeler = TAIL.map((tail) => {
    const rows = HEELER.map((r, y) => {
      const t = y === 18 ? tail[0] : y === 19 ? tail[1] : '';
      return [...r.padEnd(23, '.')].map((ch, x) => (ch === '.' && t[x] && t[x] !== '.' ? t[x] : ch)).join('');
    });
    return spr(outline(rimLight(rows, 't', 's', false)), 0, 0);
  });
  return heeler;
}

// A plum outline round the whole figure, so it reads on any ground.
function outline(rows: string[]): string[] {
  const H = rows.length + 2, W = Math.max(...rows.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => (y >= 1 && y <= rows.length ? rows[y - 1][x - 1] ?? '.' : '.') !== '.';
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      if (at(x, y)) return rows[y - 1][x - 1];
      return at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'p' : '.';
    }).join(''),
  );
}

interface Painted {
  key: string;
  c: HTMLCanvasElement;
  dogX: number;
  dogY: number;
  treeX: number;
  treeY: number;
}
let painted: Painted | null = null;

// The look of each season: ground, grass, the tree's crown.
const LOOK: Record<Season, { ground: string; grass: string; far: string; crown: string; fleck: string; snow: boolean }> = {
  spring: { ground: C.meadow, grass: C.sage, far: C.moss, crown: C.teal, fleck: C.wool, snow: false },
  summer: { ground: C.meadow, grass: C.sage, far: C.moss, crown: C.teal, fleck: C.sage, snow: false },
  autumn: { ground: C.meadow, grass: C.butter, far: C.moss, crown: C.butter, fleck: C.plum, snow: false },
  winter: { ground: C.wool, grass: C.sage, far: C.wool, crown: C.teal, fleck: C.wool, snow: true },
};

function paint(W: number, H: number, top: number, bottom: number, season: Season): Painted {
  const [c, g] = makeCanvas(W, H);
  const L = LOOK[season];
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const h = bottom - top;
  // Far hills: a long low line, with a farmhouse and a dotted flock on it.
  const farY = (x: number) => Math.round(top + h * 0.42 + Math.sin(x / 37) * 3 + Math.sin(x / 13 + 1) * 1.5);
  for (let x = 0; x < W; x++) {
    const y0 = farY(x);
    for (let y = y0; y < bottom; y++) px(x, y, y === y0 ? C.sage : L.snow ? (((x + y) & 1) === 0 ? C.wool : C.sage) : ((x + y) & 3) === 0 ? C.sage : L.far);
  }
  const hx = Math.round(W * 0.72), hy = farY(hx);
  g.fillStyle = C.wool;
  g.fillRect(hx - 4, hy - 4, 8, 4);
  g.fillStyle = C.plum;
  g.fillRect(hx - 5, hy - 7, 10, 3);
  g.fillRect(hx - 1, hy - 3, 2, 3);
  for (let i = 0; i < 7; i++) {
    const sx = Math.round(W * 0.48 + i * 4 + hash2(i, 1, 3) * 3), sy = farY(sx) + 2 + Math.round(hash2(i, 2, 3) * 3);
    px(sx, sy, C.wool);
    px(sx + 1, sy, C.wool);
    px(sx + 2, sy, C.plum);
  }
  // The knoll the dog sits on, from the left, and a swell to the right.
  const knollX = Math.round(Math.min(W * 0.24, 60));
  const nearY = (x: number) => {
    const k = Math.exp(-(((x - knollX) / (W * 0.22)) ** 2));
    return Math.round(bottom - h * 0.3 - k * h * 0.32 + Math.sin(x / 23) * 2);
  };
  for (let x = 0; x < W; x++) {
    const y0 = nearY(x);
    for (let y = y0; y < bottom; y++) {
      let col = L.ground;
      if (y === y0) col = C.plum;
      else if (y === y0 + 1) col = L.snow ? C.wool : C.moss;
      else if (L.snow && hash2(x, y, 7) < 0.12) col = C.sage;
      else if (!L.snow && hash2(x, y, 7) < 0.08) col = C.moss;
      px(x, y, col);
    }
    // Grass along the brow, flowers in spring and summer, dry stalks in autumn.
    if (!L.snow && hash2(x, 0, 8) < 0.35) {
      const gh = 1 + Math.floor(hash2(x, 1, 8) * 3);
      for (let k = 1; k <= gh; k++) px(x, y0 - k, L.grass);
      if (season !== 'autumn' && hash2(x, 2, 8) < (season === 'spring' ? 0.35 : 0.12)) px(x, y0 - gh - 1, hash2(x, 3, 8) < 0.5 ? C.butter : C.wool);
    } else if (L.snow && hash2(x, 0, 8) < 0.15) px(x, y0 - 1, C.wool);
    // A few tufts and flowers down the slope.
    for (let y = y0 + 4; y < bottom - 1; y += 5) {
      if (hash2(x, y, 9) > 0.06) continue;
      if (L.snow) px(x, y, C.sage);
      else {
        px(x, y, L.grass);
        px(x, y - 1, L.grass);
        if (season === 'spring' && hash2(x, y, 10) < 0.5) px(x + 1, y - 1, C.wool);
      }
    }
  }
  // The tree by the knoll.
  const treeX = Math.min(W - 18, Math.round(knollX + W * 0.34)), treeY = nearY(treeX);
  g.fillStyle = C.plum;
  g.fillRect(treeX - 1, treeY - 12, 3, 12);
  g.fillRect(treeX - 3, treeY, 7, 1);
  const cr = 9;
  for (let dy = -cr; dy <= cr; dy++)
    for (let dx = -cr - 2; dx <= cr + 2; dx++) {
      const d = Math.hypot(dx / 1.2, dy) + (hash2(dx, dy, 11) - 0.5) * 1.6;
      if (d > cr) continue;
      const shade = (-dx * 0.6 + dy * 0.8) / (d || 1);
      let col = L.crown;
      if (d > cr - 1.4 && shade > 0.1) col = C.plum;
      else if (season === 'autumn' && hash2(dx, dy, 12) < 0.3) col = C.plum;
      else if (season === 'winter' && (dy < -cr * 0.2 || hash2(dx, dy, 12) < 0.25) && shade < 0.3) col = C.wool;
      else if (season === 'spring' && hash2(dx >> 1, dy >> 1, 12) < 0.35) col = hash2(dx, dy, 13) < 0.2 ? C.butter : C.wool;
      else if (season === 'summer' && shade < -0.5 && hash2(dx, dy, 12) < 0.4) col = C.sage;
      px(treeX + dx, treeY - 16 + dy, col);
    }
  return { key: '', c, dogX: knollX - 25, dogY: nearY(knollX) - 42, treeX, treeY: treeY - 16 };
}

// `top`/`bottom`: the band of screen the illustration may fill.
export function drawTitleArt(g: CanvasRenderingContext2D, W: number, H: number, top: number, bottom: number, season: Season, t: number) {
  if (bottom - top < 34) return;
  top = Math.max(top, bottom - 96);
  const key = `${W}x${H}:${top}:${bottom}:${season}`;
  if (!painted || painted.key !== key) painted = { ...paint(W, H, top, bottom, season), key };
  const P = painted;
  g.drawImage(P.c, 0, 0);
  // The heeler, tail sweeping now and then.
  const H2 = heelerSprites();
  const wag = Math.floor(t * 5) % 6 < 2 ? 1 : 0;
  const s = H2[wag];
  g.drawImage(s.img, P.dogX, P.dogY, s.w * 2, s.h * 2);
  // A blink.
  if (t % 4.2 < 0.15) {
    g.fillStyle = C.plum;
    g.fillRect(P.dogX + 14, P.dogY + 14, 2, 2);
    g.fillRect(P.dogX + 26, P.dogY + 14, 2, 2);
  }
  // What the season adds in the air.
  for (let i = 0; i < 14; i++) {
    const u = (t * (season === 'winter' ? 0.12 : 0.09) + hash2(i, 0, 21)) % 1;
    const x0 = season === 'winter' ? hash2(i, 1, 21) * W : P.treeX - 10 + hash2(i, 1, 21) * 20;
    const x = Math.round(x0 + u * (season === 'winter' ? 10 : 40) + Math.sin(t * 2 + i) * 3);
    const y = Math.round((season === 'winter' ? top - 10 : P.treeY) + u * (bottom - top + 10));
    if (y > bottom) continue;
    if (season === 'winter') g.fillStyle = C.wool;
    else if (season === 'autumn') g.fillStyle = i % 3 ? C.butter : C.plum;
    else if (season === 'spring') g.fillStyle = i % 4 ? C.wool : C.butter;
    else continue;
    g.fillRect(x, y, Math.floor(t * 6 + i) % 2 ? 2 : 1, 1);
  }
  if (season === 'summer') {
    // Two butterflies over the knoll.
    for (let k = 0; k < 2; k++) {
      const bx = Math.round(P.dogX + 40 + Math.sin(t * 0.7 + k * 3) * 26), by = Math.round(P.dogY + 10 + Math.sin(t * 1.3 + k) * 6);
      const open = Math.floor(t * 9 + k) % 2;
      g.fillStyle = k ? C.wool : C.butter;
      g.fillRect(bx - 1, by - open, 1, 1);
      g.fillRect(bx + 1, by - open, 1, 1);
      g.fillStyle = C.plum;
      g.fillRect(bx, by, 1, 1);
    }
  }
  if (season === 'winter' && t % 2.6 < 0.9) {
    // The dog's breath on the cold air.
    const u = (t % 2.6) / 0.9;
    g.fillStyle = C.wool;
    const bx = P.dogX + 20 + Math.round(u * 6), by = P.dogY + 18 - Math.round(u * 4);
    for (let k = 0; k < 4; k++) if (hash2(k, Math.floor(u * 4), 31) < 1 - u * 0.6) g.fillRect(bx + (k & 1) * 2 - 1, by + (k >> 1) - 1, 1, 1);
  }
}
