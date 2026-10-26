import { spr, type Sprite } from '../gfx/sprite';

// Effect animations. Each plays its frames once, front to back, over the
// particle's life. Fading is done by thinning pixels out, never by alpha.

// Small puff kicked up by a footfall, two-tone: wool catching the light on
// top, moss dust underneath. Anchor bottom centre.
const PUFF = [
  ['.w.', 'woo'],
  ['.ww..', 'wwwoo', '.ooo.'],
  ['..ww.', '.wwwo', 'wwo.o', '.o.o.'],
  ['.w.w.', 'w.o.o', '.o...'],
  ['..w..', 'o...o'],
];

// Mud thrown up off wet ground: darker and lower, sage and plum clods.
const MUD = [
  ['.s.', 'sps'],
  ['.ss..', 'spsss', '.pp..'],
  ['..s..', '.s.ps', 's.p.s', '.p...'],
  ['.s...', 'p...s'],
];

// Snow kicked up: bright wool with sage shade, scattering wide.
const SNOW = [
  ['.w.', 'www'],
  ['.ww..', 'wwwww', '.wsw.'],
  ['w.ww.', '.wwww', 'w.w.w', '.s.s.'],
  ['w..w.', '..w.w', 'w....'],
  ['.....w', 'w.....'],
];

// The flash of a nip landing: a star that bursts and breaks up.
const IMPACT = [
  ['..y..', '.yyy.', 'yywyy', '.yyy.', '..y..'],
  ['y...y', '.y.y.', '..w..', '.y.y.', 'y...y'],
  ['w...w', '.....', '.....', '.....', 'w...w'],
];

// Emotes over the flock: a note when they are content, a heart when they
// are home, stress lines when they are nervous. They rise as they fade.
const NOTE = [
  ['..ww', '..w.', '..w.', 'ww..', 'ww..'],
  ['..ww', '..w.', '..w.', 'ww..', 'ww..'],
  ['..ww', '..w.', '..w.', 'ww..', 'ww..'],
  ['...w', '..w.', '....', 'w...', '.w..'],
];
const HEART = [
  ['.y.y.', 'yyyyy', 'yyyyy', '.yyy.', '..y..'],
  ['.y.y.', 'ywyyy', 'yyyyy', '.yyy.', '..y..'],
  ['.y.y.', 'yyyyy', 'yyyyy', '.yyy.', '..y..'],
  ['.y...', 'y...y', '..y..', '.y...', '..y..'],
];
const STRESS = [
  ['w.w.w', '.w.w.'],
  ['.w.w.', 'w.w.w'],
  ['w.w.w', '.w.w.'],
  ['.w...', '...w.'],
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
  mud: Sprite[];
  snow: Sprite[];
  impact: Sprite[];
  note: Sprite[];
  heart: Sprite[];
  stress: Sprite[];
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
    mud: MUD.map(bottom),
    snow: SNOW.map(bottom),
    impact: IMPACT.map((f) => spr(f, 2, 2)),
    note: NOTE.map(bottom),
    heart: HEART.map(bottom),
    stress: STRESS.map(bottom),
    bigPuff: BIG_PUFF.map(bottom),
    barkSide: BARK.map((f) => spr(f, 0, 4)),
    barkDown: BARK.map((f) => spr(rotCW(f), 4, 0)),
    barkUp: BARK.map((f) => spr(rotCCW(f), 4, 8)),
  };
  return FX;
}
