import { spr, type Sprite } from '../gfx/sprite';

// Effect animations. Each plays its frames once, front to back, over the
// particle's life. Fading is done by thinning pixels out, never by alpha.

// Small puff kicked up by a footfall. Anchor bottom centre.
const PUFF = [
  ['.w.', 'www'],
  ['.ww..', 'wwwww', '.www.'],
  ['..ww.', '.wwww', 'www.w', '.w.w.'],
  ['.w.w.', 'w.w.w', '.w...'],
  ['..w..', 'w...w'],
];

// Big puff: flopping down, skidding to a stop. Anchor bottom centre.
const BIG_PUFF = [
  ['.www.', 'wwwww', '.www.'],
  ['..ww...', '.wwwww.', 'wwwwwww', '.wwwww.'],
  ['..ww.....', '.wwww.ww.', 'wwwwwwwww', 'wwwwwwww.', '.ww.www..'],
  ['..w......', '.ww.w..w.', 'w.ww.w.ww', '.w..ww.w.', '..w...w..'],
  ['...w.....', '.......w.', 'w...w....', '......w..', '.w.......'],
];

// Bark: three sound lines thrown out of the mouth, facing right. The mouth is
// the anchor at (0, 4). The first frame flashes buttercup.
const BARK = [
  [
    '.........',
    '.........',
    '..y......',
    '.........',
    '.yy......',
    '.........',
    '..y......',
    '.........',
    '.........',
  ],
  [
    '.........',
    '....w....',
    '...w.....',
    '.........',
    '..www....',
    '.........',
    '...w.....',
    '....w....',
    '.........',
  ],
  [
    '......w..',
    '.....w...',
    '.........',
    '.........',
    '....www..',
    '.........',
    '.........',
    '.....w...',
    '......w..',
  ],
  [
    '.......w.',
    '.........',
    '.........',
    '.........',
    '......w.w',
    '.........',
    '.........',
    '.........',
    '.......w.',
  ],
];

function pad(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}

// Quarter turns of a grid: exact on pixels, so no resampling ever happens.
function rotCW(rows: string[]): string[] {
  const g = pad(rows), h = g.length, w = g[0].length;
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => g[h - 1 - x][y]).join(''));
}
function rotCCW(rows: string[]): string[] {
  const g = pad(rows), w = g[0].length;
  return Array.from({ length: w }, (_, y) => g.map((r) => r[w - 1 - y]).join(''));
}

export interface FxSprites {
  puff: Sprite[];
  bigPuff: Sprite[];
  barkSide: Sprite[]; // facing right; draw flipped for left
  barkDown: Sprite[];
  barkUp: Sprite[];
}

let FX: FxSprites | null = null;

export function fxSprites(): FxSprites {
  if (FX) return FX;
  const bottom = (rows: string[]) => spr(rows, Math.floor(rows[0].length / 2), rows.length - 1);
  // The mouth anchor (0, 4) of the 9 x 9 bark grid after each quarter turn.
  FX = {
    puff: PUFF.map(bottom),
    bigPuff: BIG_PUFF.map(bottom),
    barkSide: BARK.map((f) => spr(f, 0, 4)),
    barkDown: BARK.map((f) => spr(rotCW(f), 4, 0)),
    barkUp: BARK.map((f) => spr(rotCCW(f), 4, 8)),
  };
  return FX;
}
