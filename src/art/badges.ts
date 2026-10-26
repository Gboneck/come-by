import { C, CHAR } from '../palette';
import { makeCanvas } from '../gfx/screen';

// Achievement badges, 16x16: a frame for each kind of achievement (a medal
// for herding, a rosette for the trials, a shield for the ranch, an
// octagon for the valley, a wreath for the seasons, a tag for co-op) with a
// pixel icon in the middle. A locked badge is the same shape in plum and
// sage, its icon a silhouette; a secret one shows a question mark.
//
// Frames are worked out per pixel from the shape (outline, rim, face by how
// far a pixel is from the edge); icons are grids, one char per pixel:
// 'a' the icon's main colour, 'b' its accent (both set by the frame, so an
// icon reads on any face), and palette chars (p, w, y, ...) fixed.

export type BadgeGroup = 'herding' | 'trials' | 'ranch' | 'valley' | 'seasons' | 'coop';
export type BadgeState = 'got' | 'locked' | 'secret';

export const ICONS = {
  home: ['...aa...', '..aaaa..', '.aaaaaa.', 'aaaaaaaa', '.aaaaaa.', '.aabbaa.', '.aabbaa.', '.aabbaa.'],
  waves: ['........', '.aa..aa.', 'a..aa..a', '........', '.bb..bb.', 'b..bb..b', '........', '........'],
  hush: ['.aaaaaa.', 'a......a', 'a.b..b.a', 'a..bb..a', 'a..bb..a', 'a.b..b.a', '.aaaaaa.', '.a......'],
  sheep: ['........', '.a.a.a..', 'aaaaaabb', 'aaaaaabp', 'aaaaaa..', '.a..a...', '.a..a...', '........'],
  road: ['......aa', '......aa', '....bb..', '....bb..', '..aa....', '..aa....', 'bb......', 'bb......'],
  moon: ['..aaa...', '.aa.....', 'aa......', 'aa....b.', 'aa...bbb', '.aa...b.', '..aaa...', '........'],
  lantern: ['...aa...', '..a..a..', '.aaaaaa.', '.abbbba.', '.abbbba.', '.abbbba.', '.aaaaaa.', '........'],
  bolt: ['....bb..', '...bb...', '..bb....', '.bbbbbb.', '....bb..', '...bb...', '..bb....', '.b......'],
  zzz: ['aaaa....', '...a....', '..a.....', '.a......', 'aaaa.bbb', '......b.', '.....b..', '.....bbb'],
  flag: ['.a......', '.abbb...', '.abbbbb.', '.abbb...', '.a......', '.a......', '.a......', 'aaa.....'],
  star: ['...bb...', '...bb...', 'bbbbbbbb', '.bbbbbb.', '..bbbb..', '.bb..bb.', '.b....b.', '........'],
  cow: ['b......b', '.baaaab.', '.apaapa.', '.aaaaaa.', '..aaaa..', '.abbbba.', '.bpbbpb.', '..bbbb..'],
  cup: ['.bbbbbb.', 'b.bbbb.b', 'b.bbbb.b', '.bbbbbb.', '...bb...', '...bb...', '..aaaa..', '.aaaaaa.'],
  crook: ['..aaa...', '.a...a..', '.a...a..', '.....a..', '.....a..', '.....a..', '.....a..', '....bab.'],
  dog: ['a......a', 'aa....aa', 'aaaaaaaa', 'apaaaapa', 'aaaaaaaa', '.aappaa.', '..aaaa..', '.bbbbbb.'],
  paws: ['.a.a....', 'aaaaa...', '.aaa....', '........', '....b.b.', '...bbbbb', '....bbb.', '........'],
  sun: ['...b....', '.b.aa.b.', '..aaaa..', 'baaaaaab', '.aaaaaa.', '..aaaa..', '.b.aa.b.', '...b....'],
  flower: ['..a.a...', '.aaaaa..', 'aaabaaa.', '.aaaaa..', '..a.a...', '...o..o.', '..oo.oo.', '...ooo..'],
  coin: ['..bbb...', '.baaab..', 'bab.bab.', 'baabaab.', 'bab.bab.', '.baaab..', '..bbb...', '........'],
  cart: ['..bbb...', '.bbbbb..', 'aaaaaaaa', 'aaaaaaaa', '.a....a.', 'apa..apa', '.a....a.', '........'],
  heart: ['.aa..aa.', 'a..aa..a', 'a......a', 'a......a', '.a....a.', '..a..a..', '...aa...', '........'],
  sign: ['bbbbbbbb', 'baaaaaab', 'ba.aa.ab', 'baaaaaab', 'bbbbbbbb', '.b....b.', '.b....b.', '.b....b.'],
  hearts: ['.aa..aa.', 'abaaaaaa', 'aaaaaaaa', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...', '........'],
  clock: ['..aaaa..', '.a....a.', 'a...b..a', 'a...b..a', 'a...bb.a', 'a......a', '.a....a.', '..aaaa..'],
  compass: ['...a....', '...a....', '..aba...', 'aabbbaa.', '..aba...', '...a....', '...a....', '........'],
  key: ['........', '.bb.....', 'b..bbbbb', 'b..b.b.b', '.bb.....', '........', '........', '........'],
  spade: ['.....aa.', '....aaa.', '.....a..', '....a...', '.bbba...', 'bbbb....', 'bbb.....', 'bb......'],
  cottages: ['..a.....', '.aaa..b.', 'aaaaabbb', '.apa.bpb', '.aaa.bbb', '........', '........', '........'],
  snow: ['...a....', '.a.a.a..', '..aaa...', 'aaabaaa.', '..aaa...', '.a.a.a..', '...a....', '........'],
  lamb: ['p......p', '.paaaap.', '.aaaaaa.', '.apaapa.', '.aaaaaa.', '..aaaa..', '...pp...', '........'],
  rosette: ['.a.a.a..', 'aaaaaaa.', '.abbba..', 'aabbbaa.', '.abbba..', 'aaaaaaa.', '.a.a.a..', '........'],
  blacksheep: ['......b.', '..ppp.bb', '.ppppp..', 'pppppppw', 'ppppppww', '.ppppp..', '.w..w...', '.w..w...'],
  leaf: ['.....aaa', '...aaaaa', '..aaaaba', '.aaaabaa', '.aaabaaa', '.aabaaa.', '.baaaa..', 'b.......'],
  gate: ['a......a', 'aaaaaaaa', 'a.b..b.a', 'aaaaaaaa', 'a..bb..a', 'aaaaaaaa', 'a......a', '........'],
  door: ['.aaaaaa.', '.abbbba.', '.ab..ba.', '.ab..ba.', '.ab.aba.', '.ab..ba.', '.abbbba.', 'aaaaaaaa'],
  dogs: ['........', 'a..ab..b', 'aaaabbbb', 'apapbpbp', 'aaaabbbb', '.pp..pp.', '........', '........'],
  stamp: ['a.a.a.a.', 'aaaaaaaa', '.abbbba.', 'aabbbbaa', '.abbbba.', 'aaaaaaaa', 'a.a.a.a.', '........'],
  secret: ['..aaaa..', '.aa..aa.', '.....aa.', '....aa..', '...aa...', '...aa...', '........', '...aa...'],
} as const;

export type IconId = Exclude<keyof typeof ICONS, 'secret'>;

// The frame's colours: outline, rim, face; then the icon's main and accent.
const LOOK: Record<BadgeGroup, { rim: string; face: string; a: string; b: string }> = {
  herding: { rim: C.wool, face: C.teal, a: C.wool, b: C.butter },
  trials: { rim: C.butter, face: C.teal, a: C.wool, b: C.butter },
  ranch: { rim: C.butter, face: C.plum, a: C.wool, b: C.butter },
  valley: { rim: C.wool, face: C.moss, a: C.plum, b: C.butter },
  seasons: { rim: C.moss, face: C.meadow, a: C.plum, b: C.wool },
  coop: { rim: C.butter, face: C.sage, a: C.wool, b: C.butter },
};
export const groupRim = (gr: BadgeGroup) => LOOK[gr].rim;

const S = 16, MID = 7.5;

// Is (x, y) inside this group's frame? (pixel centres)
function inside(gr: BadgeGroup, x: number, y: number): boolean {
  const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy);
  switch (gr) {
    case 'herding':
    case 'seasons':
      return d < 7.9;
    case 'trials':
      return d < 7.05 + 0.85 * Math.cos(8 * Math.atan2(dy, dx));
    case 'ranch': {
      const half = y <= 8 ? 7 : 7 - (y - 8) * 1.05;
      return y >= 1 && Math.abs(x - MID) <= half;
    }
    case 'valley':
      return Math.abs(dx) + Math.abs(dy) <= 10.6;
    case 'coop': {
      const ax = Math.max(0, Math.abs(dx) - 4.5), ay = Math.max(0, Math.abs(dy) - 4.5);
      return Math.hypot(ax, ay) < 3.3;
    }
  }
}

// Steps from the outside edge: 1 = the outline, 2 = the rim, 3+ the face.
function depthMap(gr: BadgeGroup): Uint8Array {
  const d = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) d[y * S + x] = inside(gr, x, y) ? 99 : 0;
  for (let k = 1; k <= 3; k++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        if (d[i] !== 99) continue;
        const out = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= S || yy >= S || d[yy * S + xx] < k;
        if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1)) d[i] = k;
      }
  return d;
}

const depths = new Map<BadgeGroup, Uint8Array>();
const made = new Map<string, HTMLCanvasElement>();

// A badge as a 16x16 canvas (made once, kept).
export function badgeCanvas(gr: BadgeGroup, icon: IconId, state: BadgeState): HTMLCanvasElement {
  const key = `${gr}/${icon}/${state}`;
  let c = made.get(key);
  if (c) return c;
  const [cv, g] = makeCanvas(S, S);
  c = cv;
  let dm = depths.get(gr);
  if (!dm) depths.set(gr, (dm = depthMap(gr)));
  const L = LOOK[gr];
  const got = state === 'got';
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = dm[y * S + x];
      if (!k) continue;
      let col: string = k === 1 ? C.plum : k === 2 || (k === 3 && gr === 'herding') ? (got ? L.rim : C.sage) : got ? L.face : C.plum;
      // The rosette's inner ring, the wreath's berries, a herding medal's
      // milled edge.
      const dd = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (gr === 'trials' && k >= 2 && dd >= 4.6 && dd < 5.5) col = C.plum;
      else if (gr === 'trials' && k >= 2 && dd >= 5.5 && got) col = L.rim;
      if (gr === 'seasons' && k === 2 && got && (x * 3 + y * 5) % 7 === 0) col = C.butter;
      if (gr === 'herding' && k === 2 && got && (x + y) % 2 === 0) col = C.butter;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  // A shine at the top left of a won badge's face.
  if (got) {
    g.fillStyle = C.wool;
    const sx = gr === 'ranch' ? 3 : 4, sy = gr === 'ranch' ? 3 : 4;
    g.fillRect(sx, sy, 1, 1);
  }
  const rows = ICONS[state === 'secret' ? 'secret' : icon] as readonly string[];
  const ih = rows.length, iw = Math.max(...rows.map((r) => r.length));
  // Trim blank right columns and bottom rows so every icon sits centred.
  let w = 0, h = 0;
  rows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; xx++)
      if (r[xx] !== '.') {
        w = Math.max(w, xx + 1);
        h = Math.max(h, yy + 1);
      }
  });
  w = Math.min(w || iw, iw);
  h = Math.min(h || ih, ih);
  const ox = Math.round(8 - w / 2), oy = Math.round(8 - h / 2) + (gr === 'ranch' ? -1 : 0);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const ch = rows[yy][xx];
      if (!ch || ch === '.') continue;
      let col = ch === 'a' ? L.a : ch === 'b' ? L.b : CHAR[ch];
      if (!col) continue;
      if (!got) col = C.sage;
      g.fillStyle = col;
      g.fillRect(ox + xx, oy + yy, 1, 1);
    }
  made.set(key, c);
  return c;
}

// Draw a badge with its top left at (x, y), `scale` times (whole numbers).
// `glint` (0..1, or negative for none) sweeps a wool shine across it.
export function drawBadge(g: CanvasRenderingContext2D, gr: BadgeGroup, icon: IconId, state: BadgeState, x: number, y: number, scale = 1, glint = -1) {
  const c = badgeCanvas(gr, icon, state);
  const k = Math.max(1, Math.round(scale));
  g.drawImage(c, Math.round(x), Math.round(y), S * k, S * k);
  if (glint < 0 || glint > 1 || state !== 'got') return;
  // A diagonal shine crossing the face, a pixel wide, clipped to the frame.
  const dm = depths.get(gr)!;
  const d = Math.round(glint * 34) - 6;
  g.fillStyle = C.wool;
  for (let yy = 0; yy < S; yy++) {
    const xx = d - yy;
    if (xx < 0 || xx >= S) continue;
    if (dm[yy * S + xx] >= 2) g.fillRect(Math.round(x) + xx * k, Math.round(y) + yy * k, k, k);
  }
}

export const BADGE = S;
