import { CHAR } from '../palette';
import { spr, type Sprite } from '../gfx/sprite';

// The townsfolk: small 3/4 people with a plum outline. Each pose is a grid
// of template letters, recoloured per person and outlined in code, so every
// frame of every person is consistent:
//   H hat   F face and hands   E eyes   R hair (back of the head)
//   C coat  L legs   B boots   T tool handle   P tool head (plum)
// Bandana red never appears: it belongs to the player's dog.

export interface Look {
  H: string; // palette chars (see CHAR in palette.ts)
  C: string;
  L: string;
  R?: string;
}

export interface PeopleSprites {
  stand: Record<'d' | 'u' | 'r', Sprite>;
  walk: Record<'d' | 'u' | 'r', Sprite[]>;
  carry: Record<'d' | 'u' | 'r', Sprite[]>;
  work: Sprite[]; // side view, hammer or hoe: raised, struck
  crouch: Sprite[]; // front, reaching down: eggs, weeds
  sit: Sprite;
  wave: Sprite[];
}

const LEGS_STAND = ['.LLL.', '.L.L.', '.B.B.'];
const LEGS_UP_R = ['.LLL.', '.L.B.', '.B...'];
const LEGS_UP_L = ['.LLL.', '.B.L.', '...B.'];

const HEAD_D = ['.HHH.', 'HHHHH', '.FFF.', '.EFE.'];
const HEAD_U = ['.HHH.', 'HHHHH', '.RRR.', '.RRR.'];
const HEAD_R = ['.HHH..', 'HHHHHH', '.RFF..', '.RFE..'];

const front = (hands: string, legs: string[]) => [...HEAD_D, 'CCCCC', 'CCCCC', hands, ...legs];
const back = (hands: string, legs: string[]) => [...HEAD_U, 'CCCCC', 'CCCCC', hands, ...legs];
const side = (hands: string, legs: string[]) => [...HEAD_R, '.CCC..', '.CCC..', hands, ...legs];

const SIDE_STAND = ['.LL...', '.LL...', '.BBB..'];
const SIDE_STRIDE = ['.LLL..', 'L..L..', 'B..BB.'];

const GRIDS = {
  stand: { d: front('FCCCF', LEGS_STAND), u: back('FCCCF', LEGS_STAND), r: side('.CFC..', SIDE_STAND) },
  walk: {
    d: [front('FCCCF', LEGS_STAND), front('FCCCF', LEGS_UP_R), front('FCCCF', LEGS_STAND), front('FCCCF', LEGS_UP_L)],
    u: [back('FCCCF', LEGS_STAND), back('FCCCF', LEGS_UP_R), back('FCCCF', LEGS_STAND), back('FCCCF', LEGS_UP_L)],
    r: [side('FCCC..', SIDE_STRIDE), side('.CFC..', SIDE_STAND), side('.CCCF.', SIDE_STRIDE), side('.CFC..', SIDE_STAND)],
  },
  // Arms forward round a load (the load itself is drawn on top).
  carry: {
    d: [front('.CCC.', LEGS_STAND), front('.CCC.', LEGS_UP_R), front('.CCC.', LEGS_STAND), front('.CCC.', LEGS_UP_L)],
    u: [back('.CCC.', LEGS_STAND), back('.CCC.', LEGS_UP_R), back('.CCC.', LEGS_STAND), back('.CCC.', LEGS_UP_L)],
    r: [side('.CCC..', SIDE_STRIDE), side('.CCC..', SIDE_STAND), side('.CCC..', SIDE_STRIDE), side('.CCC..', SIDE_STAND)],
  },
  // Hammering (side on): tool raised over the shoulder, then struck down
  // with a lean into it.
  work: [
    ['.HHH..PP', 'HHHHHHT.', '.RFE.F..', '.RFFC...', '.CCC....', '.CCC....', '.CCC....', '.LL.....', '.LL.....', '.BBB....'],
    ['........', '..HHH...', '.HHHHHH.', '..RFE...', '..RFF...', '.CCCCF..', '.CCC.T..', '.CCC.TPP', '.LL.....', '.BBB....'],
  ],
  crouch: [
    ['.....', '.HHH.', 'HHHHH', '.FFF.', '.EFE.', 'CCCCC', 'CCCCC', 'LFCFL', 'L...L', 'B...B'],
    ['.....', '.....', '.HHH.', 'HHHHH', '.FFF.', '.EFE.', 'CCCCC', 'LCCCL', 'LF.FL', 'B...B'],
  ],
  sit: ['.HHH.', 'HHHHH', '.FFF.', '.EFE.', 'CCCCC', 'FCCCF', 'LLLLL', 'L...L', 'B...B'],
  wave: [
    ['.HHH..', 'HHHHH.', '.FFF.F', '.EFE.C', 'CCCCC.', 'CCCCC.', 'FCCC..', ...LEGS_STAND.map((r) => r + '.')],
    ['.HHH.F', 'HHHHHC', '.FFF.C', '.EFE.C', 'CCCCC.', 'CCCCC.', 'FCCC..', ...LEGS_STAND.map((r) => r + '.')],
  ],
};

// Recolour a template and draw a one-pixel plum outline round it. The
// anchor is at the feet under the middle of the body (inner column 2).
function build(rows: string[], look: Look): Sprite {
  const map: Record<string, string> = { H: look.H, F: 'w', E: 'p', R: look.R ?? 'p', C: look.C, L: look.L, B: 'p', T: 's', P: 'p' };
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  // Lit from the upper right like everything else: coats, legs and hat
  // brims are a shade darker down their left side, and a coat catches a
  // rim of light down its right.
  const DARK: Record<string, string> = { w: 's', y: 'o', t: 'p', s: 't', o: 's', m: 'o' };
  const LIGHT: Record<string, string> = { t: 's', p: 't', s: 'o', o: 'm', y: 'w' };
  const tpl = (x: number, y: number) => rows[y]?.[x] ?? '.';
  const cell = (x: number, y: number) => {
    const ch = tpl(x, y);
    if (ch === '.') return null;
    const c = map[ch] ?? ch;
    if (ch === 'C' || ch === 'L' || (ch === 'H' && tpl(x, y + 1) !== 'H')) {
      if (tpl(x - 1, y) !== ch && DARK[c]) return DARK[c];
      if (ch === 'C' && tpl(x + 1, y) !== ch && LIGHT[c]) return LIGHT[c];
    }
    return c;
  };
  const out: string[] = [];
  for (let y = -1; y <= h; y++) {
    let line = '';
    for (let x = -1; x <= w; x++) {
      const c = cell(x, y);
      if (c && CHAR[c]) line += c;
      else line += cell(x - 1, y) || cell(x + 1, y) || cell(x, y - 1) || cell(x, y + 1) ? 'p' : '.';
    }
    out.push(line);
  }
  return spr(out, 3, h);
}

const cache = new Map<string, PeopleSprites>();

export function peopleSprites(look: Look): PeopleSprites {
  const key = `${look.H}${look.C}${look.L}${look.R ?? ''}`;
  let s = cache.get(key);
  if (s) return s;
  const b = (r: string[]) => build(r, look);
  const facing = <T>(f: (k: 'd' | 'u' | 'r') => T) => ({ d: f('d'), u: f('u'), r: f('r') });
  s = {
    stand: facing((k) => b(GRIDS.stand[k])),
    walk: facing((k) => GRIDS.walk[k].map(b)),
    carry: facing((k) => GRIDS.carry[k].map(b)),
    work: GRIDS.work.map(b),
    crouch: GRIDS.crouch.map(b),
    sit: b(GRIDS.sit),
    wave: GRIDS.wave.map(b),
  };
  cache.set(key, s);
  return s;
}
