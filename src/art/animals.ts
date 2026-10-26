import type { Sprite } from '../gfx/sprite';
import type { SpeciesId } from '../world/map';
import { spr2 } from './hd';
import { rareCoat } from './young';

// Every species has whole-frame poses (like the dog), facing right and
// flipped for left, plus walk frames towards and away from the viewer.
// They are drawn at double density: two fine pixels to a world pixel, so
// an animal covers the same ground with four times the pixels. Anchors sit
// at the feet (the bottom row), in fine pixels.
//
// Each frame is put together from parts (body, a head per pose, legs per
// frame, a tail), so the poses stay consistent. White coats carry a sage
// underside so the body has some roundness; stress shows on the sprite
// itself: heads come up, ears prick, tails lift, a fright makes it jump,
// and a frightened animal runs instead of walking, eyes wide (its
// `scared` twin).
//
// Each kind moves its own way (render/animals.ts adds the bounce): a
// sheep's bouncy trot, a goat's stiff-legged pronk, a duck's waddle and
// flapping run (and swimming), cattle nodding along and landing heavy,
// ponies' manes and tails streaming at a gallop and lifting in a gust.
//
// Template letters: palette letters as they are for the first coat, a few
// capitals a coat recolours (see COATS), and the eye:
//   e the pupil (always dark)   g its glint (wool)
//   E the white of the eye: the face colour when calm; scared, wool on a
//     dark face (the white showing round the pupil), dark on a pale one
//     (the eye opening wide).
export interface AnimalSprites {
  side: Sprite[]; // walk cycle
  run: Sprite[]; // flat-out cycle
  grazing: Sprite[]; // head down, a nibble, a chew, a step on
  graze: Sprite; // the first of them (older callers)
  stand: Sprite[]; // idle: standing, a look round, the kind's habit
  chew: Sprite[]; // head up, chewing (or a duck preening)
  alert: Sprite; // head up, ears pricked: wary
  startle: Sprite; // the jump at a fright
  lie: Sprite; // lying down, at rest
  down: Sprite[];
  downAlert: Sprite;
  downStartle: Sprite;
  up: Sprite[];
  swim?: { side: Sprite[]; down: Sprite; up: Sprite }; // ducks afloat
  flow?: Sprite[]; // ponies standing in a gust: mane and tail lifted
}

interface Grids {
  side: string[][];
  run: string[][];
  graze: string[][];
  stand: string[][];
  chew: string[][];
  alert: string[];
  startle: string[];
  lie: string[];
  down: string[][];
  downAlert: string[];
  downStartle: string[];
  up: string[][];
  swim?: { side: string[][]; down: string[]; up: string[] };
  flow?: string[][];
}

// ---- Parts ----

type Grid = string[];
type Layer = readonly [rows: Grid, dx: number, dy: number];

// Lay parts over each other on a w x h grid ('.' shows what is below).
function compose(w: number, h: number, layers: (Layer | null | false)[]): Grid {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const l of layers) {
    if (!l) continue;
    const [rows, dx, dy] = l;
    rows.forEach((row, j) => {
      const y = j + dy;
      if (y < 0 || y >= h) return;
      for (let i = 0; i < row.length; i++) {
        const x = i + dx;
        if (row[i] !== '.' && x >= 0 && x < w) g[y][x] = row[i];
      }
    });
  }
  return g.map((r) => r.join(''));
}

// Mirror a part left to right (a head turned the other way, a far limb).
const mirror = (rows: Grid): Grid => {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r.padEnd(w, '.')].reverse().join(''));
};

// Tip a frame up at the front (a rear, a buck): each column right of
// `pivot` rises by k px per px. The result is taller by the rise, the feet
// left of the pivot staying on the bottom row.
function skew(rows: Grid, k: number, pivot: number): Grid {
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const rise = (x: number) => Math.max(0, Math.round((x - pivot) * k));
  const top = rise(W - 1);
  const g = Array.from({ length: H + top }, () => Array<string>(W).fill('.'));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x] ?? '.';
      if (ch !== '.') g[y + top - rise(x)][x] = ch;
    }
  return g.map((r) => r.join(''));
}

// Extra empty rows under a frame: the anchor is the last row, so a frame
// carrying them is drawn that much higher (a bounce, a jump).
const air = (rows: Grid, n: number): Grid => [...rows, ...Array<string>(n).fill('')];

// One leg seen from the side: `shape` runs hip to foot ('L' takes the
// leg's colour, the last row is the foot). The foot reaches `o` px forward
// (back when negative) while the hip stays put; a lifted leg is `up` rows
// shorter with its foot folded back under it.
interface Leg {
  x: number; // hip column
  o?: number;
  up?: number;
  c?: string;
  fold?: number;
  y?: number; // raised (negative) or lowered
}
// A frame's four legs: far hind, far fore, near hind, near fore (drawn in
// that order, near over far), each a stride offset or a full Leg.
type LegKey = 'fh' | 'ff' | 'nh' | 'nf';
type Stride = Partial<Record<LegKey, number | Omit<Leg, 'x'>>>;
// Far legs stand a row higher (further up the ground, seen from above).
function stride(hips: Record<LegKey, number>, f: Stride, far?: string, near?: string): Leg[] {
  return (['fh', 'ff', 'nh', 'nf'] as const).map((k) => {
    const v = f[k] ?? 0;
    const isFar = k[0] === 'f', c = isFar ? far : near;
    return { x: hips[k], y: isFar ? -1 : 0, ...(c ? { c } : {}), ...(typeof v === 'number' ? { o: v } : v) };
  });
}
function legs(shape: Grid, set: Leg[], top: number): Layer {
  const h = shape.length;
  const w = Math.max(...set.map((l) => l.x)) + 8;
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const l of set) {
    const o = l.o ?? 0, up = l.up ?? 0, n = h - up;
    for (let r = 0; r < n; r++) {
      const src = shape[r === n - 1 ? h - 1 : r];
      const dx = Math.round(o * (n > 1 ? r / (n - 1) : 0)) - (up && r === n - 1 ? l.fold ?? 1 : 0);
      for (let i = 0; i < src.length; i++) {
        let ch = src[i];
        if (ch === '.') continue;
        if (ch === 'L') ch = l.c ?? 'p';
        const x = l.x + i + dx, y = r + (l.y ?? 0);
        if (x >= 0 && x < w && y >= 0) g[y][x] = ch;
      }
    }
  }
  return [g.map((r) => r.join('')), 0, top];
}

// ---- Sheep: a round fleece of curly locks, a dark face and ears poking
// out of it, thin dark legs. ----
const SH_BODY = [
  '...ww...www.....',
  '.wwwwww.wwwwww..',
  'wwwwwwwwwwwwwwww',
  'wwswwwwwswwwwwww',
  '.wwsswwwwsswwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwswwwwwswwww',
  '.swwwwsswwwwssw.',
  '..sssssssssss...',
];
// Heads, facing right, laid over the front of the fleece.
const SH_HEAD = ['..ww....', 'pppppp..', '..pEEpp.', '..pegppp', '...ppppp', '....ppp.'];
const SH_CHEWH = ['..ww....', 'pppppp..', '..pEEpp.', '..pegppp', '...pppp.', '....p.pp'];
const SH_LOOKH = ['...ww...', '.pppppp.', 'ppEEpEEp', '.pegpge.', '..pppp..', '..pppp..', '...pp...'];
const SH_ALERTH = ['..ww....', 'pppppp..', '..pEEpp.', '..pegppp', '...ppppp', '..wppp..', '.www....', 'www.....'];
const SH_GRAZEH = ['pp......', '.ppp....', '..pEEp..', '..pegp..', '...pppp.', '...pppp.', '....pp..'];
const SH_LEG = ['LL', 'LL', 'LL'];
const SH_HIPS = { fh: 2, nh: 5, ff: 10, nf: 13 };

function sheepGrids(): Grids {
  const W = 21;
  const L = (f: Stride, top: number) => legs(SH_LEG, stride(SH_HIPS, f), top);
  // A side frame: legs, fleece, the head at (hx, hy); `extraTop` rows above
  // for a head held high.
  const side = (head: Grid, hx: number, hy: number, lg: Stride, extraTop = 0) => {
    const h = 12 + extraTop;
    return compose(W, h, [L(lg, 9 + extraTop), [SH_BODY, 0, extraTop], [head, hx, hy + extraTop]]);
  };
  const std = (lg: Stride = {}) => side(SH_HEAD, 13, 0, lg);
  const nod = (lg: Stride) => side(SH_HEAD, 13, 2, lg);
  const walk = [
    std({ nf: 1, ff: -1, nh: -1, fh: 1 }),
    nod({ nf: { up: 1 }, fh: { up: 1 } }),
    std({ nf: -1, ff: 1, nh: 1, fh: -1 }),
    nod({ ff: { up: 1 }, nh: { up: 1 } }),
  ];
  const stretch = (a: number) => side(SH_HEAD, 14, 1, { nf: 2 * a, ff: 2, nh: -2 * a, fh: -2 });
  const tuck = () => air(compose(W, 11, [L({ nf: { up: 1, o: -1 }, ff: { up: 1 }, nh: { up: 1, o: 1 }, fh: { up: 1 } }, 9), [SH_BODY, 0, 0], [SH_HEAD, 14, 1]]), 2);
  const run = [stretch(1), tuck(), stretch(-1), tuck()];
  const graze = [
    side(SH_GRAZEH, 14, 5, {}),
    side(SH_GRAZEH, 14, 6, {}),
    side(SH_GRAZEH, 15, 5, { nf: 1, ff: { up: 1 } }),
  ];
  const alert = side(SH_ALERTH, 13, -3, {}, 3);
  const startle = air(side(SH_ALERTH, 13, -3, { nf: 2, ff: 1, nh: -2, fh: -1 }, 3), 2);
  const lie = compose(W, 10, [[['..pp..pp'], 12, 9], [SH_BODY, 0, 1], [SH_HEAD, 13, 2]]);
  // Towards the viewer: the face in front of the fleece, ears out; away:
  // the back of the head, the rump and its tail.
  const fleece = ['....wwwwww....', '..wwwwwwwwww..', '.wwwwwwwwwwww.', 'wwswwwwwwwswww', 'wwwsswwwwwwssw', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'swwwwwwwwwwwws', '.ssssssssssss.'];
  const faceD = ['ppp........ppp', '.ppwwppppwwpp.', '...wpEppEpw...', '...wpgppgpw...', '..ss.pppp.ss..'];
  const faceA = ['.pp........pp.', '..ppwppppwpp..', '...wpEppEpw...', '...wpgppgpw...', '..ss.pppp.ss..', '.....pppp.....'];
  const legsD = (l: boolean, r: boolean) => ['..pp......pp..', `..${l ? '..' : 'pp'}......${r ? '..' : 'pp'}..`];
  const down = (lg: Grid, face = faceD) => compose(14, 14, [[lg, 0, 12], [fleece, 0, 0], [face, 0, 7]]);
  const backU = ['.....pppp.....', '.pp.pppppp.pp.', '..pppwwwwppp..'];
  const rump = ['.wwwwwwwwwwww.', 'wwwwwwwwwwwwww', 'wwswwwwwwwswww', 'wwwsswwwwwwssw', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'swwwwwwwwwwwws', '.sssswwwwssss.', '......ss......'];
  const up = (lg: Grid) => compose(14, 14, [[lg, 0, 12], [rump, 0, 3], [backU, 0, 0]]);
  return {
    side: walk,
    run,
    graze,
    stand: [std(), side(SH_LOOKH, 13, 0, {}), side(SH_ALERTH, 13, -3, { nf: { up: 1 } }, 3)],
    chew: [std(), side(SH_CHEWH, 13, 0, {})],
    alert,
    startle,
    lie,
    down: [down(legsD(false, false)), down(legsD(true, false))],
    downAlert: down(legsD(false, false), faceA),
    downStartle: air(down(['.pp........pp.', 'pp..........pp'], faceA), 2),
    up: [up(legsD(false, false)), up(legsD(false, true))],
  };
}

// ---- Ducks: small and white, a buttercup bill (with its nostril) and
// webbed feet, a folded wing drawn in a line, a tuft of a tail. ----
const DK_HEAD = ['.www...', 'wwwww..', 'wEwwyy.', 'wewwyoy', '.www...'];
const DK_BODY = ['w.....ww...', 'wwwwwwwwww.', 'wwwssssswww', '.wwwwwwsww.', '..sssssss..'];
// The waddle: tail swung down, weight over the other foot.
const DK_SWAY = ['......ww...', 'wwwwwwwwww.', 'wwwssssswww', 'wwwwwwwsww.', '.wsssssss..'];
const DK_FEET = [
  ['....y..y....', '...yy.yy....'],
  ['....y..y....', '...yy..yy...'],
  ['.....y.y....', '....yy.yy...'],
  ['....y...y...', '...yy...yy..'],
];
function duckGrids(): Grids {
  const W = 12;
  const side = (body: Grid, head: Grid, hx: number, hy: number, feet: Grid | null, extra: Layer[] = [], top = 0, h = 12) =>
    compose(W, h + top, [feet && [feet, 0, 10 + top], [body, 0, 5 + top], [head, hx, hy + top], ...extra.map(([g, x, y]) => [g, x, y + top] as const)]);
  const std = (f: Grid, body = DK_BODY) => side(body, DK_HEAD, 5, 0, f);
  // Wings: raised over the back, out level, beating down.
  const wingUp = ['..ww', '.www', 'www.', 'ww..'];
  const wingOut = ['wwwww.', '.wssww'];
  const wingDown = ['wwwwww', '.wwws.', '..ww..'];
  const run = [
    side(DK_BODY, DK_HEAD, 6, 1, ['...y...y....', '..yy...yy...'], [[wingUp, 1, 2]]),
    side(DK_BODY, DK_HEAD, 6, 1, ['.....yy.....', '....yy......'], [[wingOut, 0, 5]]),
    side(DK_SWAY, DK_HEAD, 6, 1, ['....y.y.....', '...yy.yy....'], [[wingDown, 1, 7]]),
    side(DK_BODY, DK_HEAD, 6, 1, ['.....yy.....', '....yy......'], [[wingOut, 0, 5]]),
  ];
  // Dabbling: the head down at the grass, the tail up.
  const dab = ['w.........', 'wwwwwwwww.', 'wwwssssswww', '.wwwwwwswww', '..sssssss.w'];
  const headDown = ['ww...', 'www..', 'wwww.', '.wEww', '.weww', '..yoy', '..yy.'];
  const headDown2 = ['ww...', 'www..', 'wwww.', '.wEww', '.weww', '..yoy', '...yy'];
  const dabble = (head: Grid, f: Grid) => compose(13, 12, [[f, 0, 10], [dab, 0, 5], [head, 8, 5]]);
  const graze = [dabble(headDown, DK_FEET[0]), dabble(headDown2, DK_FEET[0]), dabble(headDown, DK_FEET[2])];
  // Looking back over its shoulder; preening into the wing.
  const look = mirror(DK_HEAD);
  const preen = ['..www.', '.wwwww', 'yyewww', '.yyww.'];
  const preen2 = ['..www.', '.wwwww', '.yewww', 'yy.ww.'];
  const alertHead = [...DK_HEAD, '.ww....', '.ww....'];
  return {
    side: [std(DK_FEET[0]), std(DK_FEET[1], DK_SWAY), std(DK_FEET[2]), std(DK_FEET[3], DK_SWAY)],
    run,
    graze,
    stand: [std(DK_FEET[0]), side(DK_BODY, look, 3, 0, DK_FEET[0]), side(DK_BODY, DK_HEAD, 5, 0, DK_FEET[0], [[wingUp, 1, 1]])],
    chew: [side(DK_BODY, preen, 3, 2, DK_FEET[0]), side(DK_BODY, preen2, 3, 2, DK_FEET[0])],
    alert: side(DK_BODY, alertHead, 5, -2, DK_FEET[0], [], 2),
    startle: air(side(DK_BODY, alertHead, 5, -2, ['...y....y...', '..yy....yy..'], [[['w..', 'ww.', 'ww.'], 0, 1], [['..w.', '.ww.', 'www.', 'wsw.', 'wssw'], 1, 0]], 2), 2),
    lie: compose(W, 9, [[DK_BODY.map((r, i) => (i === 4 ? '.ssssssss..' : r)), 0, 4], [['.www...', 'wwwww..', 'wpwwyy.', '.wwwyoy'], 5, 1]]),
    down: [duckDown(['..y..y..', '.yy..yy.']), duckDown(['..y..y..', '.yy.....'])],
    downAlert: duckDown(['..y..y..', '.yy..yy.'], 2),
    downStartle: air(duckDown(['.y....y.', 'yy....yy'], 2, true), 2),
    up: [duckUp(['..y..y..', '.yy..yy.']), duckUp(['..y..y..', '.....yy.'])],
    // Afloat: no feet, the underside under the water.
    swim: {
      side: [side(DK_BODY, DK_HEAD, 5, 0, null, [], 0, 10), side(DK_SWAY, DK_HEAD, 5, 0, null, [], 0, 10)],
      down: duckDown(null),
      up: duckUp(null),
    },
  };
}
// Towards the viewer: the bill in front, an eye each side; away: the
// back of the head, the folded wings meeting at the tail.
function duckDown(feet: Grid | null, neck = 0, wings = false): Grid {
  const head = ['..wwww..', '.wwwwww.', '.wEwwEw.', '.wewwew.', '..yyyy..', '..yoyy..'];
  const body = [wings ? 'ww....ww' : 'w......w', 'wwwwwwww', 'wwwwwwww', '.wssssw.', '..ssss..'];
  const wing: Layer | null = wings ? [['w......w', 'w......w', 'ww....ww'], 0, 0] : null;
  return compose(8, (feet ? 12 : 10) + neck, [feet && [feet, 0, 10 + neck], [body, 0, 5 + neck], wing, [head, 0, 0], neck ? [['..wwww..', '..wwww..'], 0, 6] : null]);
}
function duckUp(feet: Grid | null): Grid {
  const head = ['..wwww..', '.wwwwww.', '.wwwwww.', '..wwww..', '..wwww..'];
  const body = ['w.wwww.w', 'wwwwwwww', 'wswwwwsw', '.wswwsw.', '..swws..', '...ww...'];
  return compose(8, feet ? 12 : 10, [feet && [feet, 0, 10], [body, 0, 4], [head, 0, 0]]);
}

// ---- Goats: lean and long-legged, horns curving back, a beard, ears
// out sideways, the short tail carried upright, hooves. ----
const GT_HEAD = ['..ppp....', '.p..pp...', '....pp...', 'ssswwww..', '..wwEwww.', '..wwegwwp', '..wwwwwww', '...wwppw.', '..www.pp.', '.......p.'];
const GT_CHEWH = ['..ppp....', '.p..pp...', '....pp...', 'ssswwww..', '..wwEwww.', '..wwegwwp', '..wwwwww.', '...wwpwww', '..www.pp.', '......p..'];
const GT_LOOKH = ['pp....pp.', '.pp..pp..', '..p..p...', 'sswwwwss.', '.EwwwwE..', '.ewwwwe..', '..wwww...', '..wwww...', '..wppw...', '...pp....'];
const GT_BODY = ['wwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwww', '.wsssssssssssssss'];
const GT_TAIL = ['ww', 'ww', '.w', '.w'];
const GT_LEG = ['LL', 'LL', 'LL', 'pp'];
const GT_HIPS = { fh: 2, nh: 5, ff: 13, nf: 16 };
function goatGrids(): Grids {
  const W = 21;
  const L = (f: Stride, top: number) => legs(GT_LEG, stride(GT_HIPS, f, 's', 'w'), top);
  const side = (head: Grid, hx: number, hy: number, f: Stride, top = 0, tail: Grid = GT_TAIL) =>
    compose(W, 18 + top, [L(f, 14 + top), [GT_BODY, 0, 9 + top], [tail, 0, 5 + top], [head, hx, hy + top]]);
  const std = (f: Stride = {}) => side(GT_HEAD, 12, 0, f);
  const nod = (f: Stride) => side(GT_HEAD, 12, 2, f);
  // Head down at the grass, horns laid back along the neck.
  const grazeH = ['ww.......', '.www.....', '..wwww...', '.pp.www..', 'p..pwwEw.', '....wwegw', '....wwwww', '.....wwpw', '......pp.'];
  const grazeH2 = ['ww.......', '.www.....', '..wwww...', '.pp.www..', 'p..pwwEw.', '....wwegw', '....wwwww', '.....wwp.', '......ppw'];
  // Lowered to butt: horns forward at the height of the back.
  const buttH = ['.......', '..wwpp.', '.wwwwpp', 'wwwEw.p', 'wwwegw.', '.wwwwww', '..wwpww', '....pp.'];
  // A run: stretched, gathered, then a stiff-legged pronk high in the
  // air, and down.
  const run = [
    side(GT_HEAD, 12, 1, { nf: 3, ff: 2, nh: -3, fh: -2 }),
    air(side(GT_HEAD, 12, 1, { nf: -1, ff: { up: 1 }, nh: 1, fh: { up: 1 } }), 2),
    air(side(GT_HEAD, 12, 0, {}), 4),
    side(GT_HEAD, 12, 1, { nf: 2, ff: 1, nh: -1, fh: -2 }),
  ];
  const alertH = ['..ppp....', '.p..pp...', 'ss..pp...', '.sswwww..', '..wwEwww.', '..wwegwwp', '..wwwwwww', '...wwppw.', '...ww.pp.', '...ww..p.', '..www....'];
  return {
    side: [
      std({ nf: 1, ff: -1, nh: -1, fh: 1 }),
      nod({ nf: { up: 1 }, fh: { up: 1 } }),
      std({ nf: -1, ff: 1, nh: 1, fh: -1 }),
      nod({ ff: { up: 1 }, nh: { up: 1 } }),
    ],
    run,
    graze: [side(grazeH, 13, 9, {}), side(grazeH2, 13, 9, {}), side(grazeH, 13, 9, { nf: 1, ff: { up: 1 } })],
    stand: [std(), side(GT_LOOKH, 13, 0, {}), side(buttH, 14, 6, { nf: 2, ff: 1, nh: -1, fh: -1 })],
    chew: [std(), side(GT_CHEWH, 12, 0, {})],
    alert: side(alertH, 12, -2, {}, 3),
    startle: air(side(alertH, 12, -2, { nf: 1, ff: -1, nh: -1, fh: 1 }, 3), 2),
    lie: compose(W, 15, [[['..pppp......pppp'], 1, 14], [GT_BODY, 0, 9], [GT_TAIL, 0, 5], [GT_HEAD, 12, 0]]),
    down: [goatDown(['..ww..ww..', '..ww..ww..', '..pp..ww..', '......pp..']), goatDown(['..ww..ww..', '..ww..ww..', '..ww..pp..', '..pp......'])],
    downAlert: goatDown(['..ww..ww..', '..ww..ww..', '..ww..ww..', '..pp..pp..'], 1),
    downStartle: air(goatDown(['.ww....ww.', '.ww....ww.', 'ww......ww', 'pp......pp'], 1), 2),
    up: [goatUp(['.ww....ww.', '.ww....ww.', '.pp....ww.', '.......pp.']), goatUp(['.ww....ww.', '.ww....ww.', '.ww....pp.', '.pp.......'])],
  };
}
// Towards the viewer: horns, ears out, the beard over the chest; away: the
// horns from behind, the tail up over the rump.
function goatDown(lg: Grid, lift = 0): Grid {
  const face = ['pp....pp..', '.pp..pp...', '..p..p....', 'sswwwwss..', '.EwwwwE...', '.ewwwwe...', '..wwww....', '..wwww....', '..wppw....', '...pp.....'];
  const body = ['.wwwwwwww.', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.wsswwssw.'];
  return compose(10, 20, [[lg, 0, 16], [body, 0, 10], [face, 1, 1 - lift], [['...pp.....'], 1, 10 - lift]]);
}
function goatUp(lg: Grid): Grid {
  const head = ['pp....pp..', '.pp..pp...', '..pppp....', 'sswwwwss..', '..wwww....', '..wwww....'];
  const body = ['.wwwwwwww.', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.wwwwwwww.', '.ss.ww.ss.'];
  return compose(10, 20, [[lg, 0, 16], [body, 0, 8], [head, 1, 2], [['ww', 'ww'], 4, 8]]);
}

// ---- Cattle: big, boxy and dark, a teal sheen along the back, wool horns
// and a white blaze, a pale muzzle, a tufted tail, hooves. P marks the
// patches a piebald shows. ----
const CW_HEAD = ['..w....w..', '..ww..ww..', '.pppppppp.', 'pppEpwpEpp', '...gpwpg..', '...ppwpp..', '...ppwpp..', '...ssss...', '...spsps..', '....sss...'];
const CW_CHEWH = ['..w....w..', '..ww..ww..', '.pppppppp.', 'pppEpwpEpp', '...gpwpg..', '...ppwpp..', '...ppwpp..', '....ssss..', '....spsps.', '.....sss..'];
const CW_BODY = [
  '..ttttttttttttttttttttt.',
  '.tttppppppppppptttttttt.',
  'pppPPpppppppppppppPPPppp',
  'ppPPPPpppPPPpppppPPPPppp',
  'ppPPPppppPPPPPpppPPPpppp',
  'pppPppppPPPPPPPppppppppp',
  'pppppppppPPPPPpppppppppp',
  'pppppppppppPppppppppppp.',
  '.ppppppppppppppppppppp..',
  '..pppppppppppppppppppp..',
];
const CW_TAIL = ['pp', 'p.', 'p.', 'p.', 'p.', 'p.', 'pp', 'pp'];
// The tail swinging as it walks (the tuft up), flicked at a fly.
const CW_SWING = ['pp', 'p.', 'p.', 'p.', 'p.', 'pp', 'pp'];
const CW_FLICK = ['.p', 'p.', 'p.'];
const CW_LEG = ['LLL', 'LLL', 'LL.', 'LL.', 'ss.'];
const CW_HIPS = { fh: 4, nh: 7, ff: 18, nf: 21 };
function cowGrids(): Grids {
  const W = 30;
  const L = (f: Stride, top: number) => legs(CW_LEG, stride(CW_HIPS, f), top);
  const side = (head: Grid, hx: number, hy: number, f: Stride, top = 0, tail: Layer = [CW_TAIL, 0, 5]) =>
    compose(W, 19 + top, [L(f, 14 + top), [CW_BODY, 2, 4 + top], [tail[0], tail[1], tail[2] + top], [head, hx, hy + top]]);
  const std = (f: Stride = {}) => side(CW_HEAD, 19, 0, f);
  // Walking on, the head nods low and the tail swings.
  const nod = (f: Stride) => side(CW_HEAD, 20, 2, f, 0, [CW_SWING, 0, 5]);
  const grazeH = ['..w....w..', '..ww..ww..', '.pppppppp.', 'pppEpwpEpp', '...gpwpg..', '...ppwpp..', '...ssss...', '...spsps..'];
  const grazeH2 = ['..w....w..', '..ww..ww..', '.pppppppp.', 'pppEpwpEpp', '...gpwpg..', '...ppwpp..', '....ssss..', '....spsps.'];
  const alertH = ['..w....w..', '..ww..ww..', 'pp.pppp.pp', '.ppEpwpEp.', '...gpwpg..', '...ppwpp..', '...ppwpp..', '...ssss...', '...spsps..', '....sss...', '....pp....', '...ppp....'];
  // A heavy, lumbering gallop: it lands hard (render/animals.ts sinks it).
  const run = [
    side(CW_HEAD, 20, 2, { nf: 3, ff: 2, nh: -3, fh: -2 }, 0, [CW_FLICK, 0, 3]),
    air(side(CW_HEAD, 20, 1, { nf: -1, ff: { up: 1 }, nh: 2, fh: { up: 1 } }, 0, [CW_FLICK, 0, 3]), 2),
    side(CW_HEAD, 20, 2, { nf: 2, ff: 3, nh: -2, fh: -3 }, 0, [CW_FLICK, 0, 3]),
    air(side(CW_HEAD, 20, 1, { ff: -1, nf: { up: 1 }, fh: 2, nh: { up: 1 } }, 0, [CW_FLICK, 0, 3]), 2),
  ];
  return {
    side: [
      std({ nf: 1, ff: -1, nh: -1, fh: 1 }),
      nod({ nf: { up: 1 }, fh: { up: 1 } }),
      std({ nf: -1, ff: 1, nh: 1, fh: -1 }),
      nod({ ff: { up: 1 }, nh: { up: 1 } }),
    ],
    run,
    graze: [side(grazeH, 20, 11, {}), side(grazeH2, 20, 11, {}), side(grazeH, 21, 11, { nf: 1, ff: { up: 1 } })],
    stand: [std(), side(mirror(CW_HEAD), 18, 0, {}), side(CW_HEAD, 19, 0, {}, 0, [CW_FLICK, 0, 3])],
    chew: [std(), side(CW_CHEWH, 19, 0, {})],
    alert: side(alertH, 19, -2, {}, 2),
    // A buck: hind legs kicked out, tail up.
    startle: air(side(alertH, 19, -2, { nh: { o: -4, up: 2 }, fh: { o: -3, up: 2 }, nf: 1 }, 2, [CW_FLICK, 0, 3]), 2),
    lie: compose(W, 15, [[['.pppp...........ppppp'], 3, 14], [CW_BODY, 2, 4], [['pp', 'p.', 'p.', 'p.', 'p.', 'pppp'], 0, 5], [CW_HEAD, 19, 1]]),
    down: [cowDown(['.ppp....ppp.', '.ppp....ppp.', '.pp......pp.', '.ss......pp.', '.........ss.']), cowDown(['.ppp....ppp.', '.ppp....ppp.', '.pp......pp.', '.pp......ss.', '.ss.........'])],
    downAlert: cowDown(['.ppp....ppp.', '.ppp....ppp.', '.pp......pp.', '.pp......pp.', '.ss......ss.'], 1),
    downStartle: air(cowDown(['ppp......ppp', 'pp........pp', 'pp........pp', 'pp........pp', 'ss........ss'], 1), 2),
    up: [cowUp(['.ppp....ppp.', '.ppp....ppp.', '.pp......pp.', '.ss......pp.', '.........ss.']), cowUp(['.ppp....ppp.', '.ppp....ppp.', '.pp......pp.', '.pp......ss.', '.ss.........'])],
  };
}
// Towards the viewer: horns, ears out, the blaze and muzzle over a broad
// chest; away: the back and its sheen, the rump, the tail hanging.
function cowDown(lg: Grid, lift = 0): Grid {
  const chest = ['.tttttttttttt.', 'pttppppppppttp', 'ppppppppppppPp', 'pppppppppPPPPp', 'pppppppppPPPpp', 'pppppppppppppp', '.pppppppppppp.', '..pppppppppp..'];
  return compose(14, 22, [[lg, 1, 17], [chest, 0, 9], [CW_HEAD, 2, -lift]]);
}
function cowUp(lg: Grid): Grid {
  const head = ['.w........w.', '.ww......ww.', '..wpppppw...', 'pppppppppppp', '...pppppp...'].map((r) => r.padEnd(12, '.'));
  const back = ['..tttttttt..', '.tttttttttt.', 'tttttttttttt', 'ptttppppttpp', 'pppPPPpppppp', 'ppPPPPpppppp', 'pppPPppppppp', 'pppppppppppp', 'pppppppppppp', 'pppppppppppp', '.ppppppppppp', '..pppppppp..'];
  return compose(14, 22, [[lg, 1, 17], [back, 1, 5], [head, 1, 0], [['pp', 'pp', 'pp', 'pp', 'pp', 'ss', 'ss'], 6, 9]]);
}

// ---- Wild ponies: long legs with hooves and a hock, an arched neck, a
// mane in strands with a forelock, a long flowing tail. ----
const PN_FRONT = [
  '.........p.p...',
  '.........ppp...',
  '.......ppppw...',
  '......ppwpwww..',
  '.....ppwwwEwww.',
  '....ppwwwwegwww',
  '...ppwwwww.wwww',
  '..pp.wwww...wws',
  '.pp.pwww.....ws',
  'pp.pwww........',
];
const PN_CHEWF = PN_FRONT.map((r, i) => (i === 7 ? '..pp.wwww...ww.' : i === 8 ? '.pp.pwww.....wws' : r));
// The mane lifted off the neck in a gust (or streaming at a gallop).
const PN_FLOWF = [
  '.........p.p...',
  '.........ppp...',
  '.....pp.ppppw..',
  '...pp..ppwwww..',
  '.pp...ppwwEwww.',
  'p...ppwwwwegwww',
  '..pp.wwwww.wwww',
  'pp..wwwww...wws',
  '...wwwww.....ws',
  '..wwwww........',
];
const PN_BODY = ['.wwwwwwwwwwwwww', 'wwwwwwwwwwwwwww', 'wwwwwwwwwwwwwww', 'wwwwwwwwwwwwwww', 'wwwwwwwwwwwwwww', 'swwwwwwwwwwwwws', '.ssssssssssssss'];
const PN_TAIL = ['..ppp.', '.ppppp', 'ppp.p.', 'pp.p..', 'pp.p..', 'p..p..', 'p..p..', 'p.p...', '..p...', '..p...'];
const PN_STREAM = ['......', '.ppppp', 'pppppp', 'pp.pp.', 'p..p..', '...p..', '......'];
const PN_FORE = ['LL', 'LL', 'LL', 'LL', 'LL', 'pp'];
const PN_HIND = ['LL.', 'LL.', 'LL.', '.LL', '.LL', '.pp'];
function ponyGrids(): Grids {
  const W = 28;
  const L = (f: Stride, top: number) => {
    const [fh, ff, nh, nf] = stride({ fh: 6, ff: 17, nh: 9, nf: 20 }, f, 's', 'w');
    return [legs(PN_HIND, [fh, nh], top), legs(PN_FORE, [ff, nf], top)] as const;
  };
  const side = (front: Grid, fx: number, fy: number, f: Stride, tail: Layer = [PN_TAIL, 0, 9], top = 0, extra: Layer[] = []) => {
    const [hl, fl] = L(f, 16 + top);
    return compose(W, 22 + top, [hl, fl, [tail[0], tail[1], tail[2] + top], [PN_BODY, 5, 10 + top], [front, fx, fy + top], ...extra.map(([g, x, y]) => [g, x, y + top] as const)]);
  };
  const std = (f: Stride = {}) => side(PN_FRONT, 13, 0, f);
  const nod = (f: Stride) => side(PN_FRONT, 13, 1, f);
  // Head down at the grass.
  const grazeF = ['pp.pwww......', '.pp.wwwww....', '..pp.wwwww...', '....pwwwwww..', '......wwwwwp.', '.......wwwwpp', '.......wwEwpp', '.......wegwpp', '.......wwww..', '........ws...', '........ss...'];
  const grazeF2 = grazeF.map((r, i) => (i === 9 ? '........ww...' : i === 10 ? '.......ss....' : r));
  const alertF = ['..........pp...', '.........ppp...', '........ppppw..', '.......ppwpwww.', '......ppwwwEwww', '.....ppwwwwegww', '....ppwwwww.www', '...pp.wwww...ws', '..pp.pwww......', '.pp.pwww.......', 'pp.pwww........', '..pwww.........'];
  // Turned to look at us: the forelock, both ears, the face end on.
  const lookF = ['..........p..p', '..........pppp', '.........ppwpp', '........pEwwEp', '.......ppewwep', '......pp.wwww.', '.....pp..wwww.', '....pp..pwssw.', '...pp.pwww.ss.', '..pp.pwww.....'];
  const gallop = (a: number) => side(PN_FLOWF, 14, 2, a > 0 ? { nf: 4, ff: 3, nh: -3, fh: -4 } : { nf: -2, ff: { up: 2 }, nh: 3, fh: { up: 2, o: 1 } }, [PN_STREAM, 0, 9]);
  // Rearing: the forehand thrown up off the ground, the hind legs planted.
  const rear = () => {
    const [hl] = L({ nh: -1, fh: -2 }, 19);
    const upper = skew(compose(W, 19, [[PN_TAIL, 0, 11], [PN_BODY, 5, 12], [alertF, 13, 0]]), 0.3, 9);
    const tucked = legs(['LL', 'LL', '.L', '.p'], [{ x: 19, c: 's' }, { x: 22, c: 'w' }], 0);
    const h = upper.length + 3;
    return compose(W, h, [[hl[0], 0, h - 6], [upper, 0, 0], [tucked[0], 0, h - 12]]);
  };
  return {
    side: [std({ nf: 2, ff: -1, nh: -2, fh: 1 }), nod({ nf: { up: 2 }, fh: { up: 1 } }), std({ nf: -1, ff: 2, nh: 1, fh: -2 }), nod({ ff: { up: 2 }, nh: { up: 1 } })],
    run: [gallop(1), gallop(-1), side(PN_FLOWF, 14, 2, { nf: 2, ff: 4, nh: -4, fh: -3 }, [PN_STREAM, 0, 9]), air(gallop(-1), 2)],
    graze: [side(grazeF, 15, 9, {}), side(grazeF2, 15, 9, {}), side(grazeF, 15, 9, { nf: 1, ff: { up: 1 } })],
    stand: [std(), side(lookF, 13, 0, {}), side(PN_FRONT, 13, 0, { nf: { up: 3, fold: 1 } })],
    chew: [std(), side(PN_CHEWF, 13, 0, {})],
    alert: side(alertF, 13, -2, {}, [PN_TAIL, 0, 9], 2),
    startle: rear(),
    lie: compose(W, 16, [[['..pppp.......pppppp'], 4, 15], [PN_TAIL.slice(0, 7), 0, 9], [PN_BODY, 5, 9], [PN_FRONT, 13, 0]]),
    down: [ponyDown(['.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..ww.', '.pp..ww.', '.....pp.']), ponyDown(['.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..pp.', '.pp.....'])],
    downAlert: ponyDown(['.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..ww.', '.pp..pp.'], 1),
    downStartle: air(ponyDown(['ww....ww', 'ww....ww', '.w....w.', '.p....p.', '........', '........'], 1), 2),
    up: [ponyUp(['.ww..ww.', '.ww..ww.', '..ww.ww.', '..ww.ww.', '..pp.ww.', '.....pp.']), ponyUp(['.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..ww.', '.ww..pp.', '.pp.....'])],
    flow: [std(), side(PN_FLOWF, 13, 0, {}, [PN_STREAM, 0, 9])],
  };
}
// Towards the viewer: ears and forelock, the long face, the mane each side
// of the neck, a narrow chest; away: the mane down the neck, the rump and
// the tail hanging between the hind legs.
function ponyDown(lg: Grid, lift = 0): Grid {
  const head = ['.p....p.', '.pp..pp.', '..pppp..', '..pwwp..', '.EwwwwE.', '.ewwwwe.', '..wwww..', '..wwww..', '..wwww..', '..ssss..', '..swws..'];
  const chest = ['.pwwwwp.', 'ppwwwwpp', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', '.wwwwww.', '..ssss..'];
  return compose(8, 24, [[lg, 0, 18], [chest, 0, 10], [head, 0, -lift]]);
}
function ponyUp(lg: Grid): Grid {
  const head = ['.p....p.', '.pp..pp.', '..pppp..', '..pppp..', '..pppp..', '...pp...', '...pp...'];
  const back = ['.wwppww.', 'wwwppwww', 'wwwppwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', '.wwwwww.', '..wwww..'];
  return compose(8, 24, [[lg, 0, 18], [back, 0, 7], [head, 0, 0], [['pp', 'pp', 'pp', 'pp', '.p', 'p.', 'p.'], 3, 14]]);
}

// Every kind's grids, put together once on first use.
let grids: Record<SpeciesId, Grids> | null = null;
const GRIDS = () => (grids ??= { sheep: sheepGrids(), duck: duckGrids(), goat: goatGrids(), cow: cowGrids(), pony: ponyGrids() });
// Anchor columns in fine pixels (the 1x anchors doubled): side poses, then
// the views towards / away from the viewer.
const AX: Record<SpeciesId, [number, number]> = { duck: [6, 4], sheep: [8, 6], goat: [10, 4], cow: [14, 6], pony: [12, 2] };

export type Coat = 0 | 1 | 2;

// The face colour per coat (where the eyes sit): a dark face shows a wide
// eye as wool round the pupil, a pale one as the eye opening wide.
const FACE: Record<SpeciesId, string[]> = { sheep: ['p', 'w'], duck: ['w', 'y'], goat: ['w', 's', 'p'], cow: ['p', 'p', 'y'], pony: ['w', 's', 'p'] };

export function resolveEyes(rows: string[], face: string, scared: boolean): string[] {
  const dark = face === 'p';
  const out = rows.map((r) =>
    r.replace(/[eEg]/g, (m) => {
      if (m === 'e') return 'p';
      if (m === 'g') return 'w';
      return scared ? (dark ? 'w' : 'p') : face;
    }),
  );
  if (!scared || dark) return out;
  // A pale face's wide eye opens over the glint too: a dark 2x2 with the
  // glint in its corner.
  rows.forEach((r, y) => {
    for (let x = r.indexOf('g'); x >= 0 && y > 0; x = r.indexOf('g', x + 1))
      if (out[y - 1][x] === face) out[y - 1] = out[y - 1].slice(0, x) + 'p' + out[y - 1].slice(x + 1);
  });
  return out;
}

// `coat` gives herds some variety: ponies come in wool, dun (sage) and bay
// (plum with a wool mane); goats in wool or sage; cattle in solid plum or
// plum and wool (piebald).
const BASE: Partial<Record<SpeciesId, Record<string, string>>> = { cow: { P: 'p' } };
function recoat(id: SpeciesId, coat: Coat, rows: string[]): string[] {
  if (coat === 0) return mapRows(rows, BASE[id]);
  const rare = rareCoat(id, coat, rows); // the fair's rare breeds (art/young.ts)
  if (rare) return rare;
  switch (id) {
    case 'sheep': // the black sheep (found, never spawned): dark fleece, pale face and socks
      return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
    case 'goat':
      return rows.map((r) => r.replace(/w/g, 's'));
    case 'cow': // piebald: the patches show white
      return mapRows(rows, { P: 'w' });
    case 'pony':
      if (coat === 1) return rows.map((r) => r.replace(/w/g, 's'));
      return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
  }
  return rows;
}

// Swap letters by a table (letters not in it stay as they are).
export function mapRows(rows: string[], map?: Record<string, string>): string[] {
  if (!map) return rows;
  return rows.map((r) => r.replace(/./g, (m) => map[m] ?? m));
}

// Sunlight from the upper right: the coat's top edge catches a rim of light
// on the sunny side (buttercup on white coats, a teal sheen on plum, moss
// on sage; the undersides are already in shade). `sparse` lights every
// other pixel; `minRun` lights only level stretches at least that long,
// so a back or a rump catches it and a sloping face or neck does not.
export function rimLight(rows: string[], body: string, rim: string, sparse: boolean, minRun = 1): string[] {
  const W = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => [...r.padEnd(W, '.')]);
  const lit = (x: number, y: number) =>
    g[y][x] === body && x >= W * 0.35 && y <= rows.length * 0.62 && (y === 0 || g[y - 1][x] === '.');
  return g.map((row, y) => {
    const out = [...row];
    for (let x = 0; x < W; ) {
      if (!lit(x, y)) {
        x++;
        continue;
      }
      let e = x;
      while (e < W && lit(e, y)) e++;
      if (e - x >= minRun) for (let i = x; i < e; i++) if (!sparse || (i + y) % 2 === 0) out[i] = rim;
      x = e;
    }
    return out.join('');
  });
}

const RIM: Partial<Record<SpeciesId, Record<number, [string, string, boolean, number]>>> = {
  sheep: { 0: ['w', 'y', false, 2] },
  goat: { 0: ['w', 'y', false, 3], 1: ['s', 'o', false, 3] },
  pony: { 0: ['w', 'y', false, 3], 1: ['s', 'o', false, 3], 2: ['p', 't', false, 3] },
};

// Build a set from fine-pixel grids: `look` turns template rows into
// palette rows; anchors are in fine pixels too.
export function buildSprites(G: Grids, look: (rows: string[]) => string[], ax: number, axv: number): AnimalSprites {
  const make = spr2;
  const side = (rows: string[]) => {
    const r = look(rows);
    return make(r, ax, r.length - 1);
  };
  const vert = (rows: string[]) => {
    const r = look(rows);
    return make(r, axv, r.length - 1);
  };
  const grazing = G.graze.map(side);
  return {
    side: G.side.map(side),
    run: G.run.map(side),
    grazing,
    graze: grazing[0],
    stand: G.stand.map(side),
    chew: G.chew.map(side),
    alert: side(G.alert),
    startle: side(G.startle),
    lie: side(G.lie),
    down: G.down.map(vert),
    downAlert: vert(G.downAlert),
    downStartle: vert(G.downStartle),
    up: G.up.map(vert),
    swim: G.swim && { side: G.swim.side.map(side), down: vert(G.swim.down), up: vert(G.swim.up) },
    flow: G.flow?.map(side),
  };
}
export type { Grids as AnimalGrids, Grid, Leg, Stride };
export { air, compose, legs, mirror, skew, stride };

// Template rows to palette rows for a species' coat and mood (the young
// share it: they take their mother's coat).
export function coatLook(id: SpeciesId, coat: number, scared: boolean): (rows: string[]) => string[] {
  const c = (coat === 1 || coat === 2 ? coat : 0) as Coat;
  const rim = RIM[id]?.[c];
  const face = FACE[id][c] ?? FACE[id][0];
  return (rows: string[]) => {
    const r = resolveEyes(recoat(id, c, rows), face, scared);
    return rim ? rimLight(r, ...rim) : r;
  };
}

function build(id: SpeciesId, coat: Coat, scared: boolean): AnimalSprites {
  const [ax, axv] = AX[id];
  return buildSprites(GRIDS()[id], coatLook(id, coat, scared), ax, axv);
}

const cache = new Map<string, AnimalSprites>();

// `scared`: the same animal wide-eyed (stressed hard, or running for it).
export function animalSprites(id: SpeciesId, coat: Coat = 0, scared = false): AnimalSprites {
  const key = `${id}${coat}${scared ? 's' : ''}`;
  let s = cache.get(key);
  if (!s) cache.set(key, (s = build(id, coat, scared)));
  return s;
}
