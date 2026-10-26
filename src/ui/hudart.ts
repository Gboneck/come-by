import { C } from '../palette';
import { drawSpr, spr, type Sprite } from '../gfx/sprite';

// Little drawings for the HUD: the sun-and-moon dial, the purse's coin, the
// stamina bone, and icons for the buttons. All small, all whole pixels.

const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
};

// The day as a dial: the sun climbs an arc from the left horizon at dawn
// to the right one at nightfall; by night the moon crosses it among stars.
// (cx, cy) is the middle of the horizon; r the arc's radius.
export function dial(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, duskAt: number, night: boolean, nightFrac: number, t: number) {
  cx = Math.round(cx); cy = Math.round(cy);
  // The arc, dotted: day sky in sage, the dusk end in teal; plum at night.
  const steps = Math.round(r * 4);
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * (1 - i / steps);
    if (i % 2) continue;
    const col = night ? C.teal : i / steps >= duskAt ? C.teal : C.sage;
    px(g, cx + Math.cos(a) * r, cy - Math.sin(a) * r, col);
  }
  // Horizon, with a tuft of grass each end.
  g.fillStyle = C.moss;
  g.fillRect(cx - r - 1, cy + 1, r * 2 + 3, 1);
  px(g, cx - r - 1, cy, C.moss);
  px(g, cx + r + 1, cy, C.moss);
  const f = night ? nightFrac : frac;
  const a = Math.PI * (1 - f);
  const sx = Math.round(cx + Math.cos(a) * (r - 1)), sy = Math.round(cy - Math.sin(a) * (r - 1));
  if (night) {
    // Two stars that twinkle, and a crescent moon.
    if (Math.floor(t * 1.3) % 3) px(g, cx - 2, cy - r + 2, C.wool);
    if (Math.floor(t * 1.7 + 1) % 3) px(g, cx + 3, cy - 2, C.wool);
    g.fillStyle = C.wool;
    g.fillRect(sx - 1, sy - 1, 2, 3);
    px(g, sx + 1, sy - 1, C.wool);
    px(g, sx + 1, sy + 1, C.wool);
    px(g, sx, sy, C.plum);
  } else {
    // The sun, low and buttercup, its rays turning slowly.
    g.fillStyle = C.butter;
    g.fillRect(sx - 1, sy - 1, 3, 3);
    const k = Math.floor(t * 2) % 2;
    for (const [dx, dy] of k ? [[0, -2], [0, 2], [-2, 0], [2, 0]] : [[-2, -2], [2, -2], [-2, 2], [2, 2]]) if (sy + dy <= cy) px(g, sx + dx, sy + dy, C.butter);
    if (frac >= duskAt) px(g, sx, sy, C.moss); // the low sun reddens... in buttercup and moss
  }
}

// The purse's coin, 7x7 centred on (cx, cy). Every few seconds a glint
// runs across it.
export function coin(g: CanvasRenderingContext2D, cx: number, cy: number, t: number, bright = false) {
  cx = Math.round(cx); cy = Math.round(cy);
  const rows = ['..ppp..', '.pyyyp.', 'pywyyop', 'pyyyyop', 'pyyyoop', '.poooo.', '..ppp..'];
  const cols: Record<string, string> = { p: C.plum, y: C.butter, w: C.wool, o: C.moss };
  rows.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      px(g, cx - 3 + x, cy - 3 + y, cols[ch]);
    }
  });
  // The glint: a wool diagonal sweeping across the face.
  const cyc = (t % 4) / 0.35;
  if (cyc < 1 || bright) {
    const d = bright ? 3 : Math.floor(cyc * 10) - 2;
    for (let x = 1; x < 6; x++) {
      const y = d - x + 3;
      if (y >= 1 && y <= 5 && rows[y][x] !== 'p') px(g, cx - 3 + x, cy - 3 + y, C.wool);
    }
  }
}

// The stamina gauge: a bone, filling from the left. 11x5, top-left (x, y).
const BONE = ['.pp.....pp.', 'p..ppppp..p', 'p.........p', 'p..ppppp..p', '.pp.....pp.'];
export function bone(g: CanvasRenderingContext2D, x: number, y: number, frac: number, tired: boolean, t: number) {
  x = Math.round(x); y = Math.round(y);
  const fillTo = 1 + frac * 9; // interior columns 1..9
  const flash = tired && Math.floor(t * 6) % 2 === 0;
  BONE.forEach((row, ry) => {
    for (let rx = 0; rx < 11; rx++) {
      const ch = row[rx];
      if (ch === 'p') px(g, x + rx, y + ry, C.plum);
      else if (rx > 0 && rx < 10 && !(ry !== 2 && rx > 2 && rx < 8)) {
        // Inside the bone (the knobs and the shaft).
        const full = rx <= fillTo;
        px(g, x + rx, y + ry, full ? (flash ? C.moss : C.butter) : C.sage);
      }
    }
  });
  // A highlight along the top of what is full.
  if (!flash && frac > 0.15) px(g, x + 1, y + 1, C.wool);
}

// Button icons (5x5 or so), drawn by their top-left corner.
const ICON_ROWS: Record<string, string[]> = {
  // A mallet.
  build: ['.ppp.', 'pwwwp', 'pwwwp', '.pyp.', '..y..', '..y..'],
  // The Ledger: a book with a plum spine and two lines of writing.
  ledger: ['pyyyy', 'pywwy', 'pyyyy', 'pywwy', 'pyyyy'],
  // A helper's head, buttercup at the neck.
  helper: ['p...p', 'tt.tt', 'ttttt', '.twt.', '.yyy.'],
  // A camera, for the photo mode.
  camera: ['.pp...', 'pppppp', 'pwptwp', 'ppttpp', 'pppppp'],
};
const iconCache = new Map<string, Sprite>();
export function icon(g: CanvasRenderingContext2D, id: keyof typeof ICON_ROWS, x: number, y: number) {
  let s = iconCache.get(id);
  if (!s) {
    s = spr(ICON_ROWS[id], 0, 0);
    iconCache.set(id, s);
  }
  drawSpr(g, s, Math.round(x), Math.round(y));
}
