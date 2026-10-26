import { C } from '../palette';
import { PX, fine, makeCanvas } from '../gfx/screen';
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

// The still picture, painted on the fine grid (PX canvas pixels to a world
// pixel): far hills fading back with a farmhouse and a grazing flock on
// them, the knoll in front edged with grass and flowers, a tree beside it.
// Shapes, with dithering only where a slope shades or the hills fade back.
function paint(W: number, H: number, top: number, bottom: number, season: Season): Painted {
  const FW = W * PX, FH = H * PX, T = top * PX, Bt = bottom * PX;
  const [c, g] = makeCanvas(FW, FH);
  const L = LOOK[season];
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x: number, y: number) => BAY[(y & 3) * 4 + (x & 3)] / 16;
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const h = Bt - T;
  // Far hills: a soft line, lit along its top, fading darker towards their
  // foot through a short dithered band.
  const farY = (x: number) => Math.round(T + h * 0.42 + Math.sin(x / 74) * 6 + Math.sin(x / 26 + 1) * 3);
  for (let x = 0; x < FW; x++) {
    const y0 = farY(x);
    rect(x, y0, 1, Bt - y0, L.far);
    px(x, y0, C.sage);
    for (let y = y0 + 6; y < y0 + 14; y++) if (bay(x, y) < (y - y0 - 6) / 10) px(x, y, L.snow ? C.wool : C.sage);
    rect(x, y0 + 14, 1, Math.max(0, Bt - y0 - 14), L.snow ? C.wool : C.sage);
  }
  // A few far trees along the hills.
  for (let i = 0; i < 6; i++) {
    const tx = Math.round(FW * (0.06 + i * 0.16) + hash2(i, 4, 3) * 20), ty = farY(tx);
    rect(tx - 4, ty - 6, 9, 5, season === 'autumn' && i % 2 ? C.butter : C.teal);
    rect(tx - 3, ty - 8, 7, 2, season === 'autumn' && i % 2 ? C.butter : C.teal);
    rect(tx - 4, ty - 2, 9, 1, C.plum);
    if (L.snow) rect(tx - 3, ty - 8, 7, 1, C.wool);
  }
  // The farmhouse on the hill: whitewashed, a dark roof, a lit door.
  const hx = Math.round(FW * 0.72), hy = farY(hx);
  rect(hx - 8, hy - 8, 16, 8, C.wool);
  rect(hx - 8, hy - 8, 2, 8, C.sage);
  for (let r = 0; r < 6; r++) rect(hx - 10 + r, hy - 14 + r, 20 - r * 2 + (5 - r) * 0, 1, L.snow && r < 3 ? C.wool : C.plum);
  rect(hx - 10, hy - 9, 20, 1, C.plum);
  rect(hx - 1, hy - 5, 3, 5, C.plum);
  rect(hx + 4, hy - 6, 2, 2, C.teal);
  rect(hx + 5, hy - 18, 2, 5, C.plum);
  // The flock grazing below it.
  for (let i = 0; i < 7; i++) {
    const sx = Math.round(FW * 0.48 + i * 8 + hash2(i, 1, 3) * 6), sy = farY(sx) + 4 + Math.round(hash2(i, 2, 3) * 6);
    rect(sx, sy, 4, 2, C.wool);
    px(sx + 1, sy - 1, C.wool);
    px(sx + (i & 1 ? -1 : 4), sy, C.plum);
  }
  // The knoll the dog sits on, from the left, and a swell to the right.
  const knollX = Math.round(Math.min(FW * 0.24, 120));
  const nearY = (x: number) => {
    const k = Math.exp(-(((x - knollX) / (FW * 0.22)) ** 2));
    return Math.round(Bt - h * 0.3 - k * h * 0.32 + Math.sin(x / 46) * 4);
  };
  for (let x = 0; x < FW; x++) {
    const y0 = nearY(x);
    rect(x, y0, 1, Bt - y0, L.ground);
    px(x, y0, C.plum);
    px(x, y0 + 1, L.snow ? C.wool : C.moss);
    // The slope shades towards its foot on the left.
    const slope = nearY(x + 1) - y0;
    if (slope > 0) for (let y = y0 + 2; y < y0 + 8; y++) if (bay(x, y) < 0.5 - (y - y0) * 0.06) px(x, y, L.snow ? C.sage : C.moss);
  }
  // Grass along the brow in tufts, flowers in spring and summer, dry heads in
  // autumn; down the slope, drawn tufts.
  for (let x = 0; x < FW; x += 3) {
    const y0 = nearY(x);
    if (hash2(x, 0, 8) > 0.55) continue;
    if (L.snow) { if (hash2(x, 1, 8) < 0.3) { px(x, y0 - 1, C.sage); px(x, y0 - 2, C.sage); } continue; }
    const gh = 2 + Math.floor(hash2(x, 1, 8) * 5);
    rect(x, y0 - gh, 1, gh, L.grass);
    rect(x + 1, y0 - gh + 2, 1, gh - 2, L.grass === C.sage ? C.moss : L.grass);
    if (season !== 'autumn' && hash2(x, 2, 8) < (season === 'spring' ? 0.4 : 0.15)) {
      const col = hash2(x, 3, 8) < 0.5 ? C.butter : C.wool;
      rect(x - 1, y0 - gh - 1, 3, 1, col);
      rect(x, y0 - gh - 2, 1, 3, col);
    } else if (season === 'autumn' && hash2(x, 2, 8) < 0.3) px(x, y0 - gh - 1, C.plum);
  }
  for (let y = 0; y < Bt; y += 9)
    for (let x = (y * 7) % 13; x < FW; x += 13) {
      if (y < nearY(x) + 8 || y > Bt - 3 || hash2(x, y, 9) > 0.4) continue;
      if (L.snow) { px(x, y, C.sage); px(x + 2, y - 1, C.sage); continue; }
      px(x, y, L.grass); px(x, y - 1, L.grass); px(x + 2, y, L.grass); px(x + 2, y - 2, L.grass); px(x + 1, y, L.grass);
      if (season === 'spring' && hash2(x, y, 10) < 0.4) { rect(x + 4, y - 2, 3, 1, C.wool); rect(x + 5, y - 3, 1, 3, C.wool); px(x + 5, y - 2, C.butter); }
    }
  // The tree by the knoll: a trunk lit on its right, a crown of clumps.
  const treeX = Math.min(FW - 36, Math.round(knollX + FW * 0.34)), treeY = nearY(treeX);
  rect(treeX - 2, treeY - 24, 5, 24, C.plum);
  rect(treeX + 2, treeY - 22, 1, 20, C.sage);
  rect(treeX - 6, treeY, 13, 1, C.plum);
  rect(treeX - 5, treeY - 2, 3, 2, C.plum);
  rect(treeX + 3, treeY - 2, 3, 2, C.plum);
  const clumps: [number, number, number][] = [[-12, -6, 9], [10, -8, 9], [-2, -16, 10], [-14, -20, 8], [12, -22, 8], [0, -28, 9], [0, -8, 10]];
  for (const [dx, dy, r] of clumps) {
    const cx = treeX + dx, cy = treeY - 32 + dy + 20;
    for (let yy = -r; yy <= r; yy++)
      for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx, yy * 1.1);
        if (d > r) continue;
        const shade = (-xx * 0.6 + yy * 0.8) / (d || 1);
        let col = L.crown;
        if (d > r - 1.5 && shade > -0.1) col = C.plum;
        else if (d > r - 3.5 && shade < -0.5) col = season === 'autumn' ? C.wool : season === 'winter' ? C.wool : C.sage;
        if (season === 'winter' && yy < -r * 0.4 && shade < 0.4) col = C.wool;
        px(cx + xx, cy + yy, col);
      }
    if (season === 'spring')
      for (let k = 0; k < 3; k++) {
        const bx = cx - 3 + Math.round(hash2(dx, k, 12) * 6), by = cy - 3 + Math.round(hash2(dy, k, 13) * 4);
        rect(bx - 1, by, 3, 1, C.wool); rect(bx, by - 1, 1, 3, C.wool); px(bx, by, C.butter);
      }
  }
  return { key: '', c, dogX: knollX / PX - 25, dogY: nearY(knollX) / PX - 42, treeX: treeX / PX, treeY: (treeY - 32) / PX };
}

// `top`/`bottom`: the band of screen the illustration may fill.
export function drawTitleArt(g: CanvasRenderingContext2D, W: number, H: number, top: number, bottom: number, season: Season, t: number) {
  if (bottom - top < 34) return;
  top = Math.max(top, bottom - 96);
  const key = `${W}x${H}:${top}:${bottom}:${season}`;
  if (!painted || painted.key !== key) painted = { ...paint(W, H, top, bottom, season), key };
  const P = painted;
  fine(g, (fg) => fg.drawImage(P.c, 0, 0));
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
