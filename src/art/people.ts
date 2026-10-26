import type { Sprite } from '../gfx/sprite';
import { spr2, up2 } from './hd';

// The townsfolk: small 3/4 people with a plum outline, lit from the upper
// right, drawn at double density (two fine pixels to a world pixel, about
// 12 x 24 fine pixels a person).
//
// Every frame is built in two passes. The pose (legs, torso, arms, load,
// tool) is painted at world scale from parts, as letters on a grid, and
// brought up to fine pixels with Scale2x (up2 in hd.ts), so strides and
// swinging arms stay smooth. Then the detail is drawn in fine pixels on
// top: the head and hat (eyes, nose, mouth, brims and bands, hair, beards),
// collars, buttons, belts, aprons with straps and ties, scarf fringes,
// boot soles, bales with twine, tools, the lantern and the crook. Last the
// cloth is shaded (a line of shade down the left, light down the right),
// recoloured per person and outlined in plum.
//
// Making a villager (for anyone adding people to the valley):
//
//   const s = villager({ hat: 'cap', hatColor: 'o', coat: 'w', legs: 't', apron: 's' });
//
//   coat      palette char of the coat and sleeves
//   legs      palette char of the trousers or skirt (boots are always plum)
//   hat       'brim' (default) | 'straw' | 'cap' | 'bowler' | 'bonnet' | 'hood' | 'none'
//   hatColor  palette char (default plum); a hood is the coat colour
//   hair      palette char (default plum): the back of the head, bare heads
//   build     'normal' (default) | 'tall' | 'short' | 'stout'
//   apron     palette char of an apron over the coat
//   beard     true (the hair colour) or a palette char
//   skirt     true: a long skirt in the legs colour
//   scarf     the autumn and winter scarf (default: one that stands out)
//   summerHat the hat worn in summer instead (the rancher's straw hat)
//   winterCoat a warmer coat for winter (over a shirt-sleeved summer look)
//
// It returns the spring set (PeopleSprites); `dressed(s, season)` gives the
// same person in summer shirt sleeves, an autumn scarf or a winter coat,
// built once on first use. drawPerson in entities/folk.ts picks the frames.
// Palette chars as in CHAR (palette.ts). Bandana red never appears: it
// belongs to the player's dog.

type Ch = string; // a palette char
export type Face3 = 'd' | 'u' | 'r';
export type Hat = 'brim' | 'straw' | 'cap' | 'bowler' | 'bonnet' | 'hood' | 'none';
export type Build = 'normal' | 'tall' | 'short' | 'stout';
export type Dress = 'spring' | 'summer' | 'autumn' | 'winter';

export interface VillagerSpec {
  coat: Ch;
  legs: Ch;
  hat?: Hat;
  hatColor?: Ch;
  hair?: Ch;
  build?: Build;
  apron?: Ch;
  beard?: boolean | Ch;
  skirt?: boolean;
  scarf?: Ch;
  summerHat?: Hat;
  winterCoat?: Ch;
}

// The old look (hat, coat, legs, hair): a brimmed hat.
export interface Look {
  H: Ch;
  C: Ch;
  L: Ch;
  R?: Ch;
}

// A frame, with where its near hand is: the top-left of the hand, in fine
// pixels from the anchor (unflipped).
export interface Pic extends Sprite {
  hx: number;
  hy: number;
}

export interface PeopleSprites {
  stand: Record<Face3, Pic>;
  blink: Pic; // front, eyes shut
  walk: Record<Face3, Pic[]>; // 8 frames: contact, down, pass, up, and the other foot
  lamp: Record<Face3, Pic[]>; // walking with a lantern held out
  lampStand: Record<Face3, Pic>;
  crook: Record<Face3, Pic[]>; // walking with a shepherd's crook
  crookStand: Record<Face3, Pic>;
  carry: Record<string, Record<Face3, Pic[]>>; // per load ('y' hay, 'w' a sack, 't' a pail of water)
  talk: Record<Face3, Pic[]>; // hand up, palm out, a point, a nod
  idle: Record<Face3, Pic>; // a rest while standing about: hands on hips, or behind the back
  hammer: Pic[]; // side on: raised, high, strike, bounce
  axe: Pic[];
  crouch: Record<Face3, Pic[]>; // reach down, pick, lift, rest
  sit: Pic[]; // idle, a foot swung, a hand up, palm out
  wave: Record<Face3, Pic[]>;
}

// ---- The grid ----

// World-scale letters (the pose):
//   H hat  K hat band  F face  E eye  R hair  W bobble (the head, redrawn fine)
//   C coat  A sleeve  Q forearm  a q far sleeve and forearm  U hand  M mitten
//   S scarf  L near leg  l far leg  B boot  _ a gap between the legs
//   X Z a load  O basket  J G chopping block
// Fine-only letters (the detail):
//   h i hat shade and light  f skin shade  m mouth  j hair light  D d beard
//   c k coat shade and light  Y a sleeve across the coat  I shirt  N n apron
//   1 button  2 belt  3 buckle  4 sole  5 boot shine  6 scarf fringe
//   T handle  P iron  V blade  x load light  # lantern frame  9 glass  0 glint
type Cell = [number, number, string];

interface Meta {
  face: Face3;
  f: Frame;
  lean: number; // shoulders and head forward (side on), world px
  hdx: number; // head offset, world px
  hdy: number;
  blink: boolean;
  belt: boolean; // standing legs: a belt at the waist
}

class Grid {
  cells = new Map<number, string>();
  over = new Set<number>(); // sleeves painted over the coat
  side = false;
  hx = 0;
  hy = 0;
  meta: Meta | null = null;
  fine: ((fg: Grid) => void)[] = [];
  private static k(x: number, y: number) {
    return (y + 128) * 256 + (x + 128);
  }
  set(x: number, y: number, c: string) {
    const k = Grid.k(x, y);
    const was = this.cells.get(k);
    if ((c === 'A' || c === 'Q') && (was === 'C' || this.over.has(k))) this.over.add(k);
    else this.over.delete(k);
    this.cells.set(k, c);
  }
  get(x: number, y: number) {
    return this.cells.get(Grid.k(x, y));
  }
  del(x: number, y: number) {
    this.cells.delete(Grid.k(x, y));
  }
  isOver(x: number, y: number) {
    return this.over.has(Grid.k(x, y));
  }
  // Only where nothing is painted yet (things behind the body).
  under(x: number, y: number, c: string) {
    if (!this.get(x, y)) this.set(x, y, c);
  }
  // Rows of letters with (x0, y0) the first one; '.' leaves a cell alone.
  stamp(rows: string[], x0: number, y0: number, map?: (c: string) => string) {
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] !== '.') this.set(x0 + i, y0 + j, map ? map(r[i]) : r[i]);
    });
  }
  // Gaps between the legs show the ground.
  holes(y0: number, y1: number) {
    for (let y = y0; y <= y1; y++) {
      let a = 99, b = -99;
      for (let x = -6; x <= 6; x++) {
        const c = this.get(x, y);
        if (c === 'L' || c === 'l' || c === 'B') {
          a = Math.min(a, x);
          b = Math.max(b, x);
        }
      }
      for (let x = a + 1; x < b; x++) if (!this.get(x, y)) this.set(x, y, '_');
    }
  }
  each(fn: (x: number, y: number, c: string) => void) {
    for (const [k, c] of this.cells) fn((k % 256) - 128, Math.floor(k / 256) - 128, c);
  }
  bounds() {
    let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
    this.each((x, y, c) => {
      if (c === '_') return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    });
    return { x0, x1, y0, y1 };
  }
}

// ---- Colour ----

const DARK: Record<string, Ch> = { w: 's', y: 'o', t: 'p', s: 't', o: 's', m: 'o' };
const LIGHT: Record<string, Ch> = { t: 's', p: 't', s: 'o', o: 'm', y: 'w' };
const dk = (c: Ch) => DARK[c] ?? c;
// A shade for cloth: never all the way to plum (that is the outline).
const soft = (c: Ch) => (DARK[c] && DARK[c] !== 'p' ? DARK[c] : null);

// ---- The body ----

interface Body {
  half: number; // torso half-width
  torsoH: number;
}

const BODIES: Record<Build, Body> = {
  normal: { half: 1, torsoH: 3 },
  tall: { half: 1, torsoH: 4 },
  short: { half: 1, torsoH: 2 },
  stout: { half: 2, torsoH: 3 },
};

interface Who {
  spec: VillagerSpec;
  hat: Hat;
  body: Body;
  mitts: boolean;
  scarf: boolean;
  longCoat: boolean;
  rolled: boolean;
  beanie: boolean;
}

// Rows for a figure with its feet at y = 0, lifted by `up` (-1 when a
// straight leg carries it through a stride) or dropped by `sink`.
interface Frame {
  hip: number; // top row of the legs
  waist: number; // bottom row of the torso
  sh: number; // shoulders
  eye: number;
  fore: number;
}

function frame(b: Body, up = 0, sink = 0): Frame {
  const hip = -2 + up + sink;
  const waist = hip - 1;
  const sh = waist - b.torsoH + 1;
  return { hip, waist, sh, eye: sh - 1, fore: sh - 2 };
}

// Hands are mittens in winter; forearms are bare with the sleeves rolled.
function dressCell(w: Who, c: string): string {
  if (c === 'U' && w.mitts) return 'M';
  if (c === 'Q' && w.rolled) return 'U';
  return c;
}

// ---- Legs ----

type FrontLegs = 'stand' | 'liftL' | 'liftR';

function legsFront(g: Grid, w: Who, f: Frame, kind: FrontLegs) {
  const half = w.body.half;
  for (let x = -half; x <= half; x++) g.set(x, f.hip, w.longCoat ? 'C' : 'L');
  if (w.spec.skirt) {
    for (let y = f.hip + 1; y < 0; y++) for (let x = -half; x <= half; x++) g.set(x, y, 'L');
    g.set(-half - 1, -1, 'L');
    g.set(half + 1, -1, 'L');
  }
  for (const s of [-1, 1]) {
    const lifted = (kind === 'liftL' && s < 0) || (kind === 'liftR' && s > 0);
    const foot = lifted ? -1 : 0;
    for (let y = f.hip + 1; y < foot; y++) g.set(s, y, 'L');
    g.set(s, foot, 'B');
  }
  g.holes(f.hip + 1, 0);
}

// Side on, facing right: a foot at heel x, lifted or not; near and far.
function legsSide(g: Grid, w: Who, f: Frame, near: [number, number], far: [number, number]) {
  const leg = (fx: number, lift: number, L: string) => {
    const foot = -lift;
    const rows = foot - f.hip;
    for (let i = 1; i < rows; i++) g.set(Math.round((fx * i) / rows), f.hip + i, L);
    g.set(fx, foot, 'B');
    if (!lift) g.set(fx + 1, foot, 'B');
  };
  leg(far[0], far[1], 'l');
  for (let x = -1; x <= 1; x++) g.set(x, f.hip, w.longCoat ? 'C' : 'L');
  if (w.spec.skirt) {
    for (let y = f.hip + 1; y < 0; y++) for (let x = -1; x <= 1; x++) g.set(x, y, 'L');
    g.set(-2, -1, 'L');
    g.set(2, -1, 'L');
  }
  leg(near[0], near[1], 'L');
  g.holes(f.hip + 1, 0);
}

// The walk side on: [near foot, far foot] as [heel x, lifted], per frame.
const SIDE_STEPS: [[number, number], [number, number]][] = [
  [[1, 0], [-2, 0]], // contact
  [[0, 0], [-1, 1]], // down, the back foot leaves the ground
  [[0, 0], [0, 1]], // passing
  [[-1, 0], [1, 1]], // up, reaching
  [[-2, 0], [1, 0]],
  [[-1, 1], [0, 0]],
  [[0, 1], [0, 0]],
  [[1, 1], [-1, 0]],
];
const SIDE_UP = [0, 0, -1, -1, 0, 0, -1, -1];
// The near arm swings against the near leg, the far arm against that.
const SIDE_SWING = [-2, -1, 0, 1, 2, 1, 0, -1];

// ---- Torso ----

function torso(g: Grid, w: Who, f: Frame, face: Face3, lean = 0) {
  const { half } = w.body;
  if (face === 'r') {
    for (let y = f.sh; y <= f.waist; y++) for (let x = -1; x <= 1; x++) g.set(x + (y === f.sh ? lean : 0), y, 'C');
    if (half > 1) for (let y = f.sh + 1; y <= f.waist; y++) g.set(2, y, 'C');
    return;
  }
  for (let y = f.sh; y <= f.waist; y++) for (let x = -half; x <= half; x++) g.set(x, y, 'C');
}

function scarf(g: Grid, w: Who, f: Frame, face: Face3, flutter: number, lean = 0) {
  if (!w.scarf) return;
  const { half } = w.body;
  if (face === 'r') {
    for (let x = -1; x <= 1; x++) g.set(x + lean, f.sh, 'S');
    // The tail streams out behind.
    g.set(-2 + lean, f.sh + flutter, 'S');
    return;
  }
  for (let x = -half; x <= half; x++) g.set(x, f.sh, 'S');
  g.set(face === 'd' ? 1 : -1, f.sh + 1, 'S');
  if (w.longCoat) g.set(face === 'd' ? 1 : -1, f.sh + 2, 'S');
}

// ---- Arms ----

// Arm shapes from the shoulder: [out (or forward, side on), down, letter].
type ArmKind =
  | 'down' | 'fwd' | 'back' | 'hip' | 'raise' | 'palm' | 'point' | 'wave1' | 'wave2' | 'lamp' | 'tuck'
  | 's-2' | 's-1' | 's0' | 's1' | 's2' | 'sLamp' | 'sRaise' | 'sPalm' | 'sPoint' | 'sWave1' | 'sWave2';

function arm(kind: ArmKind, len: number): Cell[] {
  const sleeve = (n: number): Cell[] => [[0, 0, 'A'], ...Array.from({ length: n }, (_, i): Cell => [0, i + 1, 'Q'])];
  switch (kind) {
    case 'down': return [...sleeve(len - 1), [0, len, 'U']];
    case 'fwd': return [...sleeve(len), [0, len + 1, 'U']];
    case 'back': return [...sleeve(len - 2), [0, len - 1, 'U']];
    case 'hip': return [[0, 0, 'A'], [1, 1, 'Q'], [0, len, 'U']];
    case 'raise': return [[0, 0, 'A'], [1, 0, 'Q'], [1, -1, 'U']];
    case 'palm': return [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'U']];
    case 'point': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, 0, 'U']];
    case 'wave1': return [[0, 0, 'A'], [1, -1, 'Q'], [1, -2, 'Q'], [1, -3, 'U']];
    case 'wave2': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [2, -3, 'U']];
    case 'lamp': return [[0, 0, 'A'], [1, 1, 'Q'], [1, len - 1, 'U']];
    case 'tuck': return [[0, 0, 'A'], [0, 1, 'Q'], [-1, len, 'U']];
    // Side on (forward is +x).
    case 's-2': return [[0, 0, 'A'], [-1, 1, 'Q'], [-2, len, 'U']];
    case 's-1': return [[0, 0, 'A'], [0, 1, 'Q'], [-1, len, 'U']];
    case 's0': return [[0, 0, 'A'], [0, 1, 'Q'], [0, len, 'U']];
    case 's1': return [[0, 0, 'A'], [0, 1, 'Q'], [1, len, 'U']];
    case 's2': return [[0, 0, 'A'], [1, 1, 'Q'], [2, len - 1, 'U']];
    case 'sLamp': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'U']];
    case 'sRaise': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, -1, 'U']];
    case 'sPalm': return [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'Q'], [3, 0, 'U']];
    case 'sPoint': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, 0, 'Q'], [4, 0, 'U']];
    case 'sWave1': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [2, -3, 'U']];
    case 'sWave2': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [3, -3, 'U']];
  }
}

const SIDE_ARM: Record<number, ArmKind> = { [-2]: 's-2', [-1]: 's-1', 0: 's0', 1: 's1', 2: 's2' };

// Paint cells from (x, y), mirrored by `dir`; `far` shades them and keeps
// them behind; `grip` records the hand.
function paint(g: Grid, w: Who, x: number, y: number, dir: number, cells: Cell[], far = false, grip = false) {
  for (const [dx, dy, c] of cells) {
    let ch = dressCell(w, c);
    if (far) ch = ch === 'A' ? 'a' : ch === 'Q' ? 'q' : ch;
    const px = x + dx * dir, py = y + dy;
    if (far) g.under(px, py, ch);
    else g.set(px, py, ch);
    if (grip && c === 'U') {
      g.hx = px;
      g.hy = py;
    }
  }
}

function armsFront(g: Grid, w: Who, f: Frame, left: ArmKind, right: ArmKind, face: 'd' | 'u') {
  const x = w.body.half + 1, len = w.body.torsoH - 1;
  paint(g, w, -x, f.sh, -1, arm(left, len), false, face === 'u');
  paint(g, w, x, f.sh, 1, arm(right, len), false, face === 'd');
}

// ---- The head at world scale ----

// A placeholder for the head (redrawn in fine pixels later): it keeps the
// head's place so that what is behind it stays behind it.
interface HeadOpt {
  dy?: number;
  dx?: number;
  blink?: boolean;
}

function head(g: Grid, w: Who, f: Frame, face: Face3, o: HeadOpt = {}) {
  const dy = o.dy ?? 0, dx = o.dx ?? 0;
  const fore = f.fore + dy;
  for (let y = fore - 2; y <= fore + 1; y++) for (let x = -1; x <= 1; x++) g.set(x + dx, y, 'F');
  for (let x = -2; x <= 2; x++) g.set(x + dx, fore - 1, 'H');
  if (face === 'r') g.set(2 + dx, fore + 1, 'F');
  g.meta = { ...(g.meta ?? { face, f, lean: 0, belt: true }), face, f, hdx: dx, hdy: dy, blink: !!o.blink } as Meta;
}

// ---- Whole figures ----

interface FigOpt extends HeadOpt {
  up?: number;
  sink?: number;
}

function frontFigure(w: Who, face: 'd' | 'u', legs: FrontLegs, left: ArmKind, right: ArmKind, o: FigOpt = {}): Grid {
  const g = new Grid();
  const f = frame(w.body, o.up ?? 0, o.sink ?? 0);
  g.meta = { face, f, lean: 0, hdx: 0, hdy: 0, blink: false, belt: true };
  legsFront(g, w, f, legs);
  torso(g, w, f, face);
  scarf(g, w, f, face, 0);
  if (face === 'u') {
    // From behind, a raised hand is in front of the hat.
    head(g, w, f, face, o);
    armsFront(g, w, f, left, right, face);
  } else {
    armsFront(g, w, f, left, right, face);
    head(g, w, f, face, o);
  }
  return g;
}

interface SideOpt extends HeadOpt {
  up?: number;
  flutter?: number;
  lean?: number;
}

function sideFigure(w: Who, step: number, nearArm: ArmKind | null, farArm: ArmKind | null, o: SideOpt = {}): Grid {
  const g = new Grid();
  g.side = true;
  const f = frame(w.body, o.up ?? SIDE_UP[step], 0);
  const [near, far] = SIDE_STEPS[step];
  const len = w.body.torsoH - 1;
  const lean = o.lean ?? 0;
  g.meta = { face: 'r', f, lean, hdx: lean, hdy: 0, blink: false, belt: true };
  legsSide(g, w, f, near, far);
  if (farArm) paint(g, w, 0, f.sh, 1, arm(farArm, len), true);
  torso(g, w, f, 'r', lean);
  head(g, w, f, 'r', { ...o, dx: lean });
  g.meta!.lean = lean;
  scarf(g, w, f, 'r', o.flutter ?? 0, lean);
  if (nearArm) paint(g, w, lean, f.sh, 1, arm(nearArm, len), false, true);
  return g;
}

// Standing side on: feet together.
const STAND_STEP = 2;

// ---- Fine pixels ----

// The world grid, two fine pixels to each of its own, smoothed. World cell
// (x, y) covers fine (2x .. 2x+1, 2y .. 2y+1); the feet's world row is 0,
// so the soles are on fine row 1. Sleeves across the coat become 'Y'.
function toFine(g: Grid): Grid {
  const { x0, x1, y0, y1 } = g.bounds();
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let r = '';
    for (let x = x0; x <= x1; x++) {
      const c = g.get(x, y);
      r += !c || c === '_' ? '.' : g.isOver(x, y) ? 'Y' : c;
    }
    rows.push(r);
  }
  const fg = new Grid();
  fg.side = g.side;
  up2(rows).forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') fg.cells.set((2 * y0 + j + 128) * 256 + (2 * x0 + i + 128), r[i]);
  });
  return fg;
}

const HEAD_LETTERS = new Set(['H', 'K', 'F', 'E', 'R', 'W']);
const HEAD_FINE = 'hijfmDdg';

// ---- Heads, drawn in fine pixels ----

// Rows of a head part, the first at fine column `left`. Face rows are
// r4..r7 below the hat's rows (which end at r3); r0 is the top of the world
// head's crown. Columns are fine, the figure's middle between 0 and 1.
interface Part {
  left: number;
  rows: string[];
}

const FACE: Record<Face3, { hat: Part; bare: Part; blink: string }> = {
  d: {
    // the forehead shaded under a brim, the eyes, cheeks, a mouth
    hat: { left: -4, rows: ['.RFFFFFFR.', '..FEFFEF..', '..FFfFFF..', '...FFmF...'] },
    bare: { left: -4, rows: ['.RFFFFFFR.', '..FEFFEF..', '..FFfFFF..', '...FFmF...'] },
    blink: '..FfFFfF..',
  },
  r: {
    // hair behind, an ear, the eye near the front, the nose out, a mouth
    hat: { left: -4, rows: ['..RRFFFF....', '..RFFFEF....', '..RRFFFFF...', '...RFFmF....'] },
    bare: { left: -4, rows: ['..RRFFFF....', '..RFFFEF....', '..RRFFFFF...', '...RFFmF....'] },
    blink: '..RFFFfF....',
  },
  u: {
    hat: { left: -4, rows: ['..gRRRRj..', '..gRRRRj..', '..ggRRRR..', '...gFFR...'] },
    bare: { left: -4, rows: ['..gRRRRj..', '..gRRRRj..', '..ggRRRR..', '...gFFR...'] },
    blink: '..gRRRRj..',
  },
};

// Hats: rows ending at r3 (the brim row).
const HATS: Record<Hat | 'beanie', Record<Face3, Part>> = {
  brim: {
    d: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '..KKKKKK..', 'hHHHHHHHHi'] },
    u: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '..KKKKKK..', 'hHHHHHHHHi'] },
    r: { left: -4, rows: ['...HHHi.....', '..HHHHHi....', '..KKKKKK....', '.hHHHHHHHHi.'] },
  },
  straw: {
    d: { left: -6, rows: ['.....HHHH.....', '....HHHHHi....', '....HHHHHi....', '....KKKKKK....', 'hhhhHHHHHHHHHi'] },
    u: { left: -6, rows: ['.....HHHH.....', '....HHHHHi....', '....HHHHHi....', '....KKKKKK....', 'hhhhHHHHHHHHHi'] },
    r: { left: -6, rows: ['.....HHHH.......', '....HHHHHi......', '....HHHHHi......', '....KKKKKK......', '.hhhHHHHHHHHHHi.'] },
  },
  cap: {
    d: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '.HHHHHHHi.', '..hhhhhh..'] },
    u: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '.HHHHHHHi.', '..HHHHHH..'] },
    r: { left: -4, rows: ['...HHHi.....', '..HHHHHi....', '..HHHHHHi...', '..hhhhhhhh..'] },
  },
  bowler: {
    d: { left: -4, rows: ['...HHHH...', '..HHHHHi..', '..HHHHHi..', '..HHHHHi..', '..KKKKKK..', '.hhHHHHHi.'] },
    u: { left: -4, rows: ['...HHHH...', '..HHHHHi..', '..HHHHHi..', '..HHHHHi..', '..KKKKKK..', '.hhHHHHHi.'] },
    r: { left: -4, rows: ['...HHHH.....', '..HHHHHi....', '..HHHHHi....', '..HHHHHi....', '..KKKKKK....', '.hhHHHHHi...'] },
  },
  // Bonnets and hoods frame the face (their sides come down in FRAMES).
  bonnet: {
    d: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '.HHHHHHHi.', '.HKKKKKKH.'] },
    u: { left: -4, rows: ['...HHHi...', '..HHHHHi..', '.HHHHHHHi.', '.HHHHHHHH.'] },
    r: { left: -4, rows: ['..HHHHi.....', '.HHHHHHi....', 'HHHHHHHHi...', 'HHHKKKKKK...'] },
  },
  hood: {
    d: { left: -4, rows: ['....HH....', '..HHHHHi..', '.HHHHHHHi.', '.HhhhhhhH.'] },
    u: { left: -4, rows: ['....HH....', '..HHHHHi..', '.HHHHHHHi.', '.HHHHHHHi.'] },
    r: { left: -4, rows: ['..HH........', '.HHHHHi.....', 'HHHHHHHi....', 'HHHHhhhhh...'] },
  },
  none: {
    d: { left: -4, rows: ['..........', '...RRRj...', '..RRRRRj..', '.RRRRRRRj.'] },
    u: { left: -4, rows: ['..........', '...RRRj...', '..RRRRRj..', '.RRRRRRRj.'] },
    r: { left: -4, rows: ['............', '...RRRj.....', '..RRRRRj....', '.RRRRRRRj...'] },
  },
  // A woolly hat: the bobble, the knit, a turned-up band.
  beanie: {
    d: { left: -4, rows: ['....WW....', '...HWWi...', '..HHHHHi..', '.HHHHHHHi.', '.KKKKKKKK.'] },
    u: { left: -4, rows: ['....WW....', '...HWWi...', '..HHHHHi..', '.HHHHHHHi.', '.KKKKKKKK.'] },
    r: { left: -4, rows: ['...WW.......', '..HWWHi.....', '.HHHHHHi....', '.HHHHHHHi...', '.KKKKKKK....'] },
  },
};

// The sides of a bonnet or hood round the face, ear flaps, a brim's
// underside at its edges (r4..).
const FRAMES: Partial<Record<Hat | 'beanie', Record<Face3, Part>>> = {
  brim: {
    d: { left: -4, rows: ['hh......hh'] },
    u: { left: -4, rows: ['hh......hh'] },
    r: { left: -4, rows: ['.h......hh..'] },
  },
  straw: {
    d: { left: -6, rows: ['hhh........hhh'] },
    u: { left: -6, rows: ['hhh........hhh'] },
    r: { left: -6, rows: ['.hh.........hh..'] },
  },
  bonnet: {
    d: { left: -4, rows: ['.H......H.', '.H......H.', '.h......H.', '..h....H..', '....WW....'] },
    u: { left: -4, rows: ['.HHHHHHHi.', '.HHHHHHHi.', '.hHHHHHHi.', '..hHHHHi..', '...KKKK...'] },
    r: { left: -4, rows: ['HHHH........', 'HHHH........', 'hHHH........', '.hH.........', '..WW........'] },
  },
  hood: {
    d: { left: -4, rows: ['.Hh....hH.', '.Hh....hi.', '.Hh....hi.', '.HHh..hHi.', '..HHHHHi..'] },
    u: { left: -4, rows: ['.HHHHHHHi.', '.HHHHHHHi.', '.HHHHHHHi.', '.hHHHHHHi.', '..HHHHHH..'] },
    r: { left: -4, rows: ['HHHHh.......', 'HHHHh.......', 'HHHHh.......', 'hHHHH.......', '.HHHHH......'] },
  },
  beanie: {
    d: { left: -4, rows: ['.K......K.', '.K......K.'] },
    u: { left: -4, rows: ['.K......K.', '.K......K.'] },
    r: { left: -4, rows: ['..KK........', '..KK........'] },
  },
};

// Beards from r6 down over the collar.
const BEARD: Record<Face3, Part | null> = {
  d: { left: -4, rows: ['..D....D..', '..DD..DD..', '...DDDD...', '....dd....'] },
  r: { left: -4, rows: ['...D........', '...DDD.D....', '....DDDD....', '.....dd.....'] },
  u: null,
};

const BODY_OK = new Set(['C', 'c', 'k', 'S', 'I', '1', 'N', 'n', 'L', 'Y']);

function headFine(fg: Grid, w: Who, m: Meta) {
  const ox = 2 * m.hdx, r0 = 2 * (m.f.fore + m.hdy - 2);
  // Clear the placeholder, then draw the head where nothing stands in front.
  fg.each((x, y, c) => {
    if (HEAD_LETTERS.has(c)) fg.del(x, y);
  });
  const put = (p: Part, row: number, body = false) =>
    p.rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '.') continue;
        const x = ox + p.left + i, y = r0 + row + j;
        const was = fg.get(x, y);
        if (!was || HEAD_LETTERS.has(was) || HEAD_FINE.includes(was) || (body && BODY_OK.has(was))) fg.set(x, y, c);
      }
    });
  const hat: Hat | 'beanie' = w.beanie ? 'beanie' : w.hat;
  const frames = FRAMES[hat]?.[m.face];
  const bare = hat === 'none';
  const face = FACE[m.face];
  const rows = [...(bare ? face.bare : face.hat).rows];
  if (m.blink) rows[1] = face.blink;
  put({ left: face.hat.left, rows }, 4);
  const hp = HATS[hat][m.face];
  put(hp, 4 - hp.rows.length);
  if (frames) put(frames, 4, true);
  const beard = w.spec.beard ? BEARD[m.face] : null;
  if (beard && hat !== 'hood' && hat !== 'bonnet') put(beard, 6, true);
}

// ---- Details, drawn in fine pixels ----

function detailsFine(fg: Grid, w: Who, m: Meta) {
  const { f, face } = m;
  const half = w.body.half;
  const top = 2 * f.sh, bot = 2 * f.waist + 1, hipBot = 2 * f.hip + 1;
  const on = (x: number, y: number, c: string, over = 'C') => {
    const was = fg.get(x, y);
    if (was && over.includes(was)) fg.set(x, y, c);
  };
  const apron = !!w.spec.apron;
  const belt = m.belt && !w.longCoat && !apron;
  if (face === 'd') {
    const L = -2 * half, R = 2 * half + 1;
    // The shadow under the chin and a collar either side of it (a scarf or
    // a beard may cover them).
    for (let x = -1; x <= 2; x++) on(x, top, 'c');
    on(-1, top + 1, 'k');
    on(2, top + 1, 'k');
    // Buttons down the front.
    for (let y = top + 2; y < (w.longCoat ? hipBot : bot); y += 2) on(1, y, '1');
    if (belt) {
      for (let x = L; x <= R; x++) on(x, bot, '2');
      on(0, bot, '3');
      on(1, bot, '3');
    }
    if (w.longCoat) for (let y = bot + 1; y <= hipBot; y++) on(0, y, 'c');
    if (apron) {
      // The bib and skirt of the apron, straps over the shoulders, ties
      // round the waist, a pocket.
      const a = -1 - (half - 1), b = 2 + (half - 1);
      for (let y = top + 2; y <= hipBot; y++) for (let x = a; x <= b; x++) on(x, y, x === a ? 'n' : 'N', 'CL');
      for (let y = top; y < top + 2; y++) {
        on(a, y, 'N', 'CI');
        on(b, y, 'N', 'CIk');
      }
      for (let x = L; x <= R; x++) on(x, bot - 1, 'N');
      on(0, bot + 1, 'n', 'N');
      on(1, bot + 1, 'n', 'N');
    }
  } else if (face === 'r') {
    const lean = 2 * m.lean;
    on(2 + lean, top, 'I');
    on(3 + lean, top, 'k');
    for (let y = top + 2; y < bot; y += 2) on(2, y, '1');
    if (belt) {
      for (let x = -2; x <= 3 + 2 * (half - 1); x++) on(x, bot, '2');
      on(3 + 2 * (half - 1), bot, '3');
    }
    if (apron) {
      const x = 3 + 2 * (half - 1);
      for (let y = top + 2; y <= hipBot; y++) {
        on(x, y, 'N', 'CkLY');
        on(x - 1, y, 'n', 'CLY');
      }
      on(x, top + 1, 'N', 'Ck');
      // The bow at the back.
      fg.under(-3, bot - 1, 'N');
      fg.under(-3, bot, 'n');
    }
  } else {
    const L = -2 * half, R = 2 * half + 1;
    for (let x = L; x <= R; x++) on(x, top, 'c');
    for (let y = top + 2; y < bot; y++) on(1, y, 'c');
    if (belt) for (let x = L; x <= R; x++) on(x, bot, '2');
    if (apron) {
      // Straps down the back and the bow at the waist.
      for (let y = top; y < bot; y++) {
        on(-1, y, 'N');
        on(2, y, 'N');
      }
      for (let x = -1; x <= 2; x++) on(x, bot - 1, 'N');
      on(-2, bot - 2, 'N');
      on(3, bot - 2, 'N');
      on(-2, bot, 'n');
      on(3, bot, 'n');
    }
  }
  // A long skirt: a fold down the middle and the hem.
  if (w.spec.skirt) {
    let hem = -99;
    fg.each((x, y, c) => {
      if (c === 'L' && y < 0) hem = Math.max(hem, y);
    });
    fg.each((x, y, c) => {
      if (c !== 'L' || y > -1) return;
      if (y === hem && fg.get(x, y + 1) !== 'L') fg.set(x, y, 'l');
      else if (x === 0 && y > hipBot + 1 && face !== 'r') fg.set(x, y, 'l');
    });
  }
  // Scarf: the tail's end frayed.
  if (w.scarf) {
    let low = -999;
    fg.each((x, y, c) => {
      if (c === 'S') low = Math.max(low, y);
    });
    fg.each((x, y, c) => {
      if (c === 'S' && y === low && y > top + 1) fg.set(x, y, (x & 1) === 0 ? '6' : 'S');
    });
  }
}

// Boots: a sole underneath, a shine on the toe.
function bootsFine(fg: Grid) {
  const soles: [number, number][] = [], shine: [number, number][] = [];
  fg.each((x, y, c) => {
    if (c !== 'B') return;
    if (fg.get(x, y + 1) !== 'B' && fg.get(x, y + 1) !== '4') soles.push([x, y]);
    else if (fg.get(x, y - 1) !== 'B' && fg.get(x + 1, y) !== 'B') shine.push([x, y]);
  });
  for (const [x, y] of soles) fg.set(x, y, '4');
  for (const [x, y] of shine) fg.set(x, y, '5');
}

// Loads, drawn in fine pixels where the pose holds them: a bale of hay
// with its twine, a sack tied at the neck, a pail of water with a handle.
// Rows, left column and top row (fine rows below the shoulders' top).
const LOADS: Record<string, Record<Face3, [string[], number, number][]>> = {
  y: {
    d: [[['xxxxxxxxxxxxxx', 'XXXXZXXXXZXXXX', 'XXXXZXXXXZXXXX', 'ZZZZZZZZZZZZZZ'], -6, 2]],
    r: [[['xxxxxxxx', 'XXXZXXZX', 'XXXZXXZX', 'ZZZZZZZZ'], 2, 2]],
    u: [[['xx', 'XX', 'XX', 'ZZ'], -6, 2], [['xx', 'XX', 'XX', 'ZZ'], 6, 2]],
  },
  w: {
    d: [[['...xx...', '..ZXXZ..', '.xXXXXx.', 'xXXXXXXZ', 'XXXXXXXZ', '.ZZZZZZ.'], -3, 1]],
    r: [[['..xx..', '.ZXXZ.', 'xXXXXx', 'XXXXXZ', 'XXXXXZ', '.ZZZZ.'], 2, 1]],
    u: [[['x', 'X', 'X', 'X', 'Z'], -5, 1], [['x', 'X', 'X', 'X', 'Z'], 6, 1]],
  },
  t: {
    d: [[['..####..', '.#....#.', 'xxxxxxxx', 'XXXXXXXX', 'XXXXXXXX', '.ZZZZZZ.'], -3, 3]],
    r: [[['.####.', '#....#', 'xxxxxx', 'XXXXXX', 'XXXXXX', '.ZZZZ.'], 3, 3]],
    u: [],
  },
};

function loadFine(fg: Grid, item: string, m: Meta | null) {
  if (!m) return;
  const hands: Cell[] = [];
  fg.each((x, y, c) => {
    if (c === 'X' || c === 'Z') fg.del(x, y);
    if (c === 'U' || c === 'M') hands.push([x, y, c]);
  });
  const top = 2 * m.f.sh;
  for (const [rows, x0, y0] of (LOADS[item] ?? LOADS.w)[m.face]) fineStamp(fg, rows, x0, top + y0);
  // The hands hold it.
  for (const [x, y, c] of hands) fg.set(x, y, c);
}

// The chopping block: the cut top with its rings, bark round the side.
const STUMP = ['.JJJJ.', 'J7JJ7J', 'GG8GGG', '8GGG8G'];

function blockFine(fg: Grid) {
  let x0 = 999;
  fg.each((x, y, c) => {
    if (c === 'J' || c === 'G') {
      x0 = Math.min(x0, x);
      fg.del(x, y);
    }
  });
  if (x0 < 999) fineStamp(fg, STUMP, x0, -2, true);
}

// Draw a one-pixel line of `c` (Bresenham), behind what is there if `back`.
function fineLine(fg: Grid, x0: number, y0: number, x1: number, y1: number, c: string, back = false) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (back) fg.under(x0, y0, c);
    else fg.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x0 += sx);
    if (e2 <= dx) (err += dx), (y0 += sy);
  }
}

function fineStamp(fg: Grid, rows: string[], x0: number, y0: number, back = false) {
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] === '.') continue;
      if (back) fg.under(x0 + i, y0 + j, r[i]);
      else fg.set(x0 + i, y0 + j, r[i]);
    }
  });
}

// ---- Shade, colour, outline ----

const COAT = new Set(['C', 'A', 'Q', 'Y']);

function renderFine(g: Grid, w: Who, colour: Record<string, Ch>, item = ''): Pic {
  const fg = toFine(g);
  const m = g.meta;
  if (m) {
    headFine(fg, w, m);
    detailsFine(fg, w, m);
  }
  bootsFine(fg);
  if (item) loadFine(fg, item, m);
  blockFine(fg);
  for (const fn of g.fine) fn(fg);
  const { x0, x1, y0, y1 } = fg.bounds();
  const tpl = (x: number, y: number) => fg.get(x, y);
  const cell = (x: number, y: number): Ch | null => {
    const t = tpl(x, y);
    if (!t || t === '_' || t === '.') return null;
    const c = colour[t] ?? 'p';
    if (COAT.has(t)) {
      // A sleeve across the coat: a crease down its shaded side.
      if (t === 'Y') return COAT.has(tpl(x - 1, y) ?? '') && tpl(x - 1, y) !== 'Y' ? colour.c : colour.C;
      const lt = tpl(x - 1, y), rt = tpl(x + 1, y);
      // Front and back: a crease between the body and each arm.
      if (!fg.side && t === 'C' && (lt === 'A' || lt === 'Q' || rt === 'A' || rt === 'Q')) return colour.c;
      if (x <= 0 && !COAT.has(lt ?? '')) return colour.c1;
      if (x >= 1 && !COAT.has(rt ?? '')) return colour.k;
      return c;
    }
    if (t === 'L' && !fg.side) {
      const lt = tpl(x - 1, y);
      if (x <= 0 && lt !== 'L' && lt !== 'l') return colour.l2;
    }
    if (t === 'N' || t === 'S') {
      const lt = tpl(x - 1, y);
      if (lt !== t && x <= 0) return t === 'N' ? colour.n : colour.s2;
    }
    return c;
  };
  const filled = (x: number, y: number) => {
    const t = tpl(x, y);
    return !!t && t !== '_' && t !== '.';
  };
  const rows: string[] = [];
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    let line = '';
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const c = cell(x, y);
      if (c) line += c;
      else line += filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ? 'p' : '.';
    }
    rows.push(line);
  }
  const ax = 1 - x0, ay = 2 - y0;
  return Object.assign(spr2(rows, ax, ay), { hx: 2 * g.hx, hy: 2 * g.hy - 1 });
}

// ---- Building a set ----

// Properties built the first time they are read.
function lazy<T extends object>(o: T, fns: Record<string, () => unknown>): T {
  for (const [k, fn] of Object.entries(fns)) {
    Object.defineProperty(o, k, {
      configurable: true,
      enumerable: true,
      get() {
        const v = fn();
        Object.defineProperty(o, k, { value: v, enumerable: true });
        return v;
      },
    });
  }
  return o;
}

// Fine-pixel tools relative to a hand's fine top-left corner.
interface ToolDraw {
  line?: [number, number, number, number]; // the handle
  head?: [string[], number, number]; // rows at (dx, dy)
}

function poses(w: Who): PeopleSprites {
  const colour = colours(w);
  const pics = new Map<string, Pic>();
  // Identical frames share one canvas.
  const pic = (g: Grid, item = '', tag = '') => {
    let key = item + tag + '|';
    for (const [k, v] of g.cells) key += k + v + (g.over.has(k) ? '!' : '') + ',';
    const m = g.meta;
    if (m) key += `${m.face}${m.f.sh}${m.f.hip}${m.lean}${m.hdx}${m.hdy}${m.blink}${m.belt}`;
    key += g.hx + ':' + g.hy + (g.side ? 's' : '');
    let p = pics.get(key);
    if (!p) pics.set(key, (p = renderFine(g, w, item ? { ...colour, ...loadColours(item) } : colour, item)));
    return p;
  };
  const faces = <T>(fn: (f: Face3) => T): Record<Face3, T> => ({ d: fn('d'), u: fn('u'), r: fn('r') });
  const len = w.body.torsoH - 1;
  const fr0 = frame(w.body);

  // Something held in the near hand, drawn in fine pixels once the pose is.
  const holdTool = (g: Grid, t: ToolDraw, back = false) => {
    const hx = 2 * g.hx, hy = 2 * g.hy;
    g.fine.push((fg) => {
      const handCells: Cell[] = [];
      for (let y = hy; y <= hy + 1; y++) for (let x = hx; x <= hx + 1; x++) {
        const c = fg.get(x, y);
        if (c === 'U' || c === 'M') handCells.push([x, y, c]);
      }
      if (t.line) fineLine(fg, hx + t.line[0], hy + t.line[1], hx + t.line[2], hy + t.line[3], 'T', back);
      if (t.head) fineStamp(fg, t.head[0], hx + t.head[1], hy + t.head[2], back);
      // The hand round the handle.
      for (const [x, y, c] of handCells) fg.set(x, y, c);
    });
    return g;
  };
  // The lantern, hung from the hand: bail, cap, glass with a glint, base.
  const LANTERN = ['.#.', '###', '#90', '#99', '###'];
  const withLantern = (g: Grid) => holdTool(g, { head: [LANTERN, 0, 2] });
  // The crook: a staff through the hand from the ground to over the head,
  // its hook turned forward (outwards from the front and back).
  const withCrook = (g: Grid, dir: number) => {
    const hx = 2 * g.hx + (dir > 0 ? 1 : 0);
    g.fine.push((fg) => {
      const top = -30;
      fineLine(fg, hx, 1, hx, top + 2, 'T', true);
      const hook = dir > 0 ? ['.TT.', 'T..T', '...T', '...T'] : ['.TT.', 'T..T', 'T...', 'T...'];
      fineStamp(fg, hook, dir > 0 ? hx : hx - 3, top, true);
    });
    return g;
  };

  // Front and back: arms swung at the contacts; as each foot passes it
  // lifts and the body rides up a pixel.
  const FRONT_SEQ: [FrontLegs, number, number][] = [
    ['stand', 0, 0], ['stand', 0, 0], ['liftL', -1, 1], ['liftL', -1, 1],
    ['stand', 0, 2], ['stand', 0, 2], ['liftR', -1, 1], ['liftR', -1, 1],
  ];
  const swingL: ArmKind[] = ['fwd', 'down', 'back'];
  const swingR: ArmKind[] = ['back', 'down', 'fwd'];
  const frontWalk = (face: 'd' | 'u', armsL: ArmKind[], armsR: ArmKind[], extra?: (g: Grid) => Grid, tag = '') =>
    FRONT_SEQ.map(([legs, up, a]) => {
      const g = frontFigure(w, face, legs, armsL[a], armsR[a], { up });
      return pic(extra ? extra(g) : g, '', tag);
    });
  const sideWalk = (near: (i: number) => ArmKind, far: (i: number) => ArmKind | null, extra?: (g: Grid) => Grid, tag = '') =>
    SIDE_STEPS.map((_, i) => {
      const g = sideFigure(w, i, near(i), far(i), { flutter: (i >> 1) & 1 });
      return pic(extra ? extra(g) : g, '', tag);
    });

  const walk = faces((f) => (f === 'r'
    ? sideWalk((i) => SIDE_ARM[SIDE_SWING[i]], (i) => SIDE_ARM[-SIDE_SWING[i]])
    : frontWalk(f, swingL, swingR)));
  const stand = faces((f) => (f === 'r' ? pic(sideFigure(w, STAND_STEP, 's0', null, { up: 0 })) : pic(frontFigure(w, f, 'stand', 'down', 'down'))));
  const blink = pic(frontFigure(w, 'd', 'stand', 'down', 'down', { blink: true }));

  // A lantern or a crook held out on one side, steady; the other arm swings.
  const HOLD: ArmKind[] = ['lamp', 'lamp', 'lamp'];
  const holdWalk = (extra: (f: Face3) => (g: Grid) => Grid, tag: string) => faces((f) => (f === 'r'
    ? sideWalk(() => 'sLamp', (i) => SIDE_ARM[-SIDE_SWING[i]], extra(f), tag)
    : frontWalk(f, f === 'd' ? swingL : HOLD, f === 'd' ? HOLD : swingR, extra(f), tag)));
  const holdStand = (extra: (f: Face3) => (g: Grid) => Grid, tag: string) => faces((f) => pic(extra(f)(f === 'r'
    ? sideFigure(w, STAND_STEP, 'sLamp', null, { up: 0 })
    : frontFigure(w, f, 'stand', f === 'd' ? 'down' : 'lamp', f === 'd' ? 'lamp' : 'down')), '', tag));
  const lampX = () => withLantern;
  const crookX = (f: Face3) => (g: Grid) => withCrook(g, f === 'u' ? -1 : 1);
  const lamp = () => holdWalk(lampX, 'lamp');
  const lampStand = () => holdStand(lampX, 'lamp');
  const crook = () => holdWalk(crookX, 'crook');
  const crookStand = () => holdStand(crookX, 'crook');

  // A load held in front with both arms: a bale of hay, a sack, a pail.
  const carryOf = (item: string) => faces((f) => {
    if (f === 'r') {
      return SIDE_STEPS.map((_, i) => {
        const g = sideFigure(w, i, null, null);
        const fr = frame(w.body, SIDE_UP[i]);
        g.stamp(['ZXXZ', 'ZZZZ'], 1, fr.sh + 1);
        paint(g, w, 0, fr.sh, 1, [[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'U']], false, true);
        return pic(g, item);
      });
    }
    return FRONT_SEQ.map(([legs, up]) => {
      const fr = frame(w.body, up);
      const hw = w.body.half + 1;
      if (f === 'd') {
        const g = frontFigure(w, 'd', legs, 'down', 'down', { up });
        // A wide load in front, the arms round it.
        for (let x = -hw - 1; x <= hw + 1; x++) {
          g.set(x, fr.sh + 1, 'X');
          g.set(x, fr.sh + 2, 'Z');
        }
        // The hands round its sides.
        for (const s of [-1, 1]) g.set(s * hw, fr.sh + len, dressCell(w, 'U'));
        return pic(g, item);
      }
      // From behind: elbows out, and the ends of the load either side.
      const g = frontFigure(w, 'u', legs, 'tuck', 'tuck', { up });
      for (const s of [-1, 1]) {
        g.set(s * hw, fr.sh + 1, 'Q');
        g.set(s * hw, fr.sh + 2, '_');
        g.set(s * (hw + 1), fr.sh + 1, 'X');
        g.set(s * (hw + 1), fr.sh + 2, 'Z');
      }
      return pic(g, item);
    });
  });
  const carry = lazy({} as Record<string, Record<Face3, Pic[]>>, { y: () => carryOf('y'), w: () => carryOf('w'), t: () => carryOf('t') });

  // Talking: a hand up, palm out with a nod, a point, a nod.
  const talk = () => faces((f) => {
    if (f === 'r') {
      return [
        pic(sideFigure(w, STAND_STEP, 'sRaise', null, { up: 0 })),
        pic(sideFigure(w, STAND_STEP, 'sPalm', null, { up: 0, dy: 1 })),
        pic(sideFigure(w, STAND_STEP, 'sPoint', null, { up: 0 })),
        pic(sideFigure(w, STAND_STEP, 's0', null, { up: 0, dy: 1 })),
      ];
    }
    return [
      pic(frontFigure(w, f, 'stand', 'down', f === 'd' ? 'raise' : 'down')),
      pic(frontFigure(w, f, 'stand', 'down', f === 'd' ? 'palm' : 'raise', { dy: 1 })),
      pic(frontFigure(w, f, 'stand', 'hip', 'point')),
      pic(frontFigure(w, f, 'stand', 'down', 'down', { dy: 1 })),
    ];
  });

  const idle = () => faces((f) => (f === 'r' ? pic(sideFigure(w, STAND_STEP, 's-1', null, { up: 0 })) : pic(frontFigure(w, f, 'stand', 'hip', 'hip'))));

  // Tools, side on. Each frame: the near arm from the shoulder (world
  // cells), whether they lean in, and the tool from the hand (fine).
  const tool = (name: string, frames: { cells: Cell[]; lean?: number; tool: ToolDraw; under?: Cell[] }[]) =>
    frames.map((t, i) => {
      const g = sideFigure(w, STAND_STEP, null, null, { up: 0, lean: t.lean ?? 0 });
      if (t.under) for (const [x, y, c] of t.under) g.under(x, fr0.sh + y, c);
      paint(g, w, 0, fr0.sh, 1, t.cells, false, true);
      return pic(holdTool(g, t.tool), '', name + i);
    });
  // A hammer: a short handle and an iron head with a bright face.
  // A hammer: a short handle, an iron head with its bright striking face.
  const HAMMER_UP = ['PPPV', 'PPPV']; // across a raised handle, face forward
  const HAMMER_DOWN = ['PP', 'PP', 'VV']; // at the end of a level handle, face down
  const hammer = () => tool('hammer', [
    // raised in front
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 0, 'U']], tool: { line: [1, -1, 2, -4], head: [HAMMER_UP, 0, -6] } },
    // up high
    { cells: [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'Q'], [3, -2, 'U']], tool: { line: [0, -1, -1, -4], head: [HAMMER_UP, -3, -6] } },
    // strike: leaning in, the head down on the work
    { cells: [[1, 0, 'A'], [2, 1, 'Q'], [3, 1, 'U']], lean: 1, tool: { line: [2, 0, 5, 0], head: [HAMMER_DOWN, 6, -1] } },
    // bounce
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'U']], tool: { line: [2, -1, 4, -3], head: [['.PP', 'PPV', 'PV.'], 4, -6] } },
  ]);
  // The chopping block in front (drawn as a stump in fine pixels).
  const block: Cell[] = [[5, 4, 'J'], [6, 4, 'J'], [7, 4, 'J'], [5, 5, 'G'], [6, 5, 'G'], [7, 5, 'G']];
  // An axe: a long handle, the head widening to a bright edge.
  const AXE_FWD = ['.VV', 'PPV', 'PPV', '.VV']; // edge forward
  const AXE_BACK = ['VV.', 'VPP', 'VPP', 'VV.']; // cocked over the head, edge back
  const AXE_DOWN = ['PPP', 'PPP', 'VVV']; // edge down
  const axe = () => tool('axe', [
    // lifting, the axe up and forward
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'U']], under: block, tool: { line: [2, -1, 5, -5], head: [AXE_FWD, 5, -9] } },
    // up high before the face, the head over the hat
    { cells: [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'U']], under: block, tool: { line: [1, -1, 1, -9], head: [AXE_BACK, -1, -13] } },
    // strike: down into the block
    { cells: [[1, 0, 'A'], [2, 1, 'Q'], [3, 2, 'U']], lean: 1, under: block, tool: { line: [2, 1, 4, 2], head: [AXE_DOWN, 5, 1] } },
    // pulling it free
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'U']], under: block, tool: { line: [2, 0, 6, 0], head: [AXE_DOWN, 7, -1] } },
  ]);

  // Crouching, front: down on the heels between the knees, picking up
  // (an egg, a weed) and into the basket.
  const crouch = () => faces((f) => {
    if (f === 'd') {
      const fr = frame(w.body, 0, 2);
      const mk = (arms: string[], dy = 0, item: [number, number] | null = null) => {
        const g = new Grid();
        g.meta = { face: 'd', f: fr, lean: 0, hdx: 0, hdy: 0, blink: false, belt: false };
        torso(g, w, fr, 'd');
        scarf(g, w, fr, 'd', 0);
        // knees up either side, boots out
        g.stamp(['L...L', 'B___B'], -2, -1);
        g.stamp(arms, -3, fr.sh, (c) => dressCell(w, c));
        head(g, w, fr, 'd', { dy });
        g.meta!.belt = false;
        if (item) g.set(item[0], item[1], 'O');
        g.stamp(['OOO', 'OOO'], 4, -1);
        g.fine.push((fg) => basketFine(fg));
        return pic(g);
      };
      return [
        mk(['.A...A.', '.Q...Q.', '..Q.Q..', '..U.U..'], 1),
        mk(['.A...A.', '.Q...QU', '..Q....', '..U....'], 0, [3, fr.sh]),
        mk(['.A...AQ', '.Q.....', '..Q....', '..U....'], 0, [4, fr.sh + 1]),
        mk(['.A...A.', '.Q...Q.', '.U...U.', '.......']),
      ];
    }
    if (f === 'u') {
      // Kneeling with their back to us (at a trough): elbows working.
      const fr = frame(w.body, 0, 2);
      const mk = (arms: string[], dy = 0) => {
        const g = new Grid();
        g.meta = { face: 'u', f: fr, lean: 0, hdx: 0, hdy: 0, blink: false, belt: false };
        torso(g, w, fr, 'u');
        g.stamp(['.LLL.', 'BB_BB'], -2, -1);
        scarf(g, w, fr, 'u', 0);
        head(g, w, fr, 'u', { dy });
        g.meta!.belt = false;
        g.stamp(arms, -2, fr.sh, (c) => dressCell(w, c));
        return pic(g);
      };
      return [mk(['A...A', 'Q...Q'], 1), mk(['A....', 'Q...A'], 1), mk(['....A', 'A...Q'], 1), mk(['A...A', 'Q...Q'])];
    }
    // Side on: down on one knee, reaching to the ground in front.
    const fr = frame(w.body, 0, 1);
    const mk = (cells: Cell[], dy = 1, item: [number, number] | null = null) => {
      const g = new Grid();
      g.side = true;
      g.meta = { face: 'r', f: fr, lean: 1, hdx: 1, hdy: 0, blink: false, belt: false };
      g.stamp(['.lLLL.', 'bll__BB'], -3, -1, (c) => (c === 'b' ? 'B' : c));
      torso(g, w, fr, 'r', 1);
      head(g, w, fr, 'r', { dx: 1, dy });
      g.meta!.lean = 1;
      g.meta!.belt = false;
      scarf(g, w, fr, 'r', 0, 1);
      paint(g, w, 1, fr.sh, 1, cells, false, true);
      if (item) g.set(item[0], item[1], 'O');
      g.fine.push((fg) => basketFine(fg));
      return pic(g);
    };
    return [
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'Q'], [3, 3, 'U']]),
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'Q'], [3, 3, 'U']], 1, [5, 0]),
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'U']], 0, [3, fr.sh]),
      mk([[0, 0, 'A'], [0, 1, 'Q'], [1, 2, 'U']], 0),
    ];
  });

  // On the bench: down a row, thighs towards us over the seat, hands on the
  // knees; a foot swung now and then; a word with a hand up.
  const sit = () => {
    const fr = frame(w.body, 0, 1);
    const mk = (legs: string[], right: ArmKind, dy = 0) => {
      const g = new Grid();
      g.meta = { face: 'd', f: fr, lean: 0, hdx: 0, hdy: 0, blink: false, belt: false };
      torso(g, w, fr, 'd');
      scarf(g, w, fr, 'd', 0);
      g.stamp(legs, -2, fr.waist);
      paint(g, w, -2, fr.sh, -1, arm('tuck', len));
      paint(g, w, 2, fr.sh, 1, arm(right, len), false, true);
      head(g, w, fr, 'd', { dy });
      g.meta!.belt = false;
      return pic(g);
    };
    const legs = ['LLLLL', '.l_l.', '.B_B.'];
    const swing = ['LLLLL', '.l_B.', '.B___'];
    return [mk(legs, 'tuck'), mk(swing, 'tuck'), mk(legs, 'raise'), mk(legs, 'palm', 1)];
  };

  // Waving: the arm right up and the hand going.
  const wave = () => faces((f) => {
    if (f === 'r') {
      return [
        pic(sideFigure(w, STAND_STEP, 'sWave1', null, { up: 0 })),
        pic(sideFigure(w, STAND_STEP, 'sWave2', null, { up: 0 })),
      ];
    }
    return [pic(frontFigure(w, f, 'stand', 'hip', 'wave1')), pic(frontFigure(w, f, 'stand', 'hip', 'wave2'))];
  });

  // Only the walk is built up front; the rest on first use.
  return lazy({ stand, blink, walk, carry } as PeopleSprites, { lamp, lampStand, crook, crookStand, talk, idle, hammer, axe, crouch, sit, wave });
}

// The basket by a crouching figure: a rim, the weave, eggs or greens in it.
function basketFine(fg: Grid) {
  let y0 = 999;
  fg.each((x, y, c) => {
    if (c === 'O' && y > -4) y0 = Math.min(y0, y);
  });
  fg.each((x, y, c) => {
    if (c !== 'O') return;
    if (y < -4) fg.set(x, y, 'X'); // held up: an egg
    else if (y === y0) fg.set(x, y, (x & 1) === 0 ? 'X' : 'x');
    else if (y === y0 + 1) fg.set(x, y, 'O');
    else fg.set(x, y, (x + y) % 3 === 0 ? '8' : 'O');
  });
}

function loadColours(item: string): Record<string, Ch> {
  if (item === 't') return { X: 't', Z: 'p', x: 'w' }; // a pail of water: teal, the rim shining
  return { X: item, Z: soft(item) ?? 'o', x: LIGHT[item] ?? 'w' };
}

function colours(w: Who): Record<string, Ch> {
  const s = w.spec;
  const hat = w.hat === 'hood' ? s.coat : s.hatColor ?? 'p';
  const hair = s.hair ?? 'p';
  const sc = s.scarf ?? scarfFor(s.coat, hat);
  const coat = s.coat;
  const beard = typeof s.beard === 'string' ? s.beard : hair;
  return {
    H: hat,
    h: soft(hat) ?? (hat === 'p' ? 't' : 'p'),
    i: LIGHT[hat] ?? (hat === 'w' ? 'w' : hat),
    K: band(hat),
    F: 'w',
    f: 's',
    E: 'p',
    m: 's',
    R: hair,
    j: LIGHT[hair] ?? hair,
    g: soft(hair) ?? hair,
    D: beard,
    d: soft(beard) ?? (beard === 'p' ? 't' : 'p'),
    W: sc,
    C: coat,
    c: soft(coat) ?? 'p',
    c1: soft(coat) ?? coat,
    k: LIGHT[coat] ?? coat,
    A: coat,
    Q: coat,
    Y: coat,
    a: soft(coat) ?? 'p',
    q: soft(coat) ?? 'p',
    U: 'w',
    M: sc,
    I: coat === 'w' ? 's' : 'w',
    N: s.apron ?? 'w',
    n: soft(s.apron ?? 'w') ?? 'p',
    S: sc,
    s2: soft(sc) ?? 'p',
    '6': LIGHT[sc] ?? 'w',
    '1': button(coat),
    '2': 'p',
    '3': 'y',
    '4': 'p',
    '5': 't',
    L: s.legs,
    l: dk(s.legs),
    l2: soft(s.legs) ?? s.legs,
    B: 'p',
    T: 'o',
    P: 't',
    V: 'w',
    J: 'y',
    G: 'o',
    '7': 'o',
    X: 'y',
    Z: 'o',
    x: 'w',
    O: 'o',
    '8': 's',
    '#': 'p',
    '9': 'y',
    '0': 'w',
  };
}

// A hat band that stands out from the hat.
function band(hat: Ch): Ch {
  return ({ y: 't', w: 's', p: 't', t: 'p', s: 'p', o: 'p', m: 'p' } as Record<string, Ch>)[hat] ?? 'p';
}

// Buttons that show on the coat.
function button(coat: Ch): Ch {
  return ({ t: 'y', p: 'y', s: 'w', o: 'y', w: 's', y: 'o', m: 'p' } as Record<string, Ch>)[coat] ?? 'p';
}

// A scarf that stands out from the coat and the hat.
function scarfFor(coat: Ch, hat: Ch): Ch {
  for (const c of ['y', 's', 't', 'o', 'w']) if (c !== coat && c !== hat) return c;
  return 'y';
}

// ---- The cache ----

interface Entry {
  spec: VillagerSpec;
  sets: Partial<Record<Dress, PeopleSprites>>;
}

const byKey = new Map<string, Entry>();
const entryOf = new WeakMap<PeopleSprites, Entry>();

function make(spec: VillagerSpec, dress: Dress): PeopleSprites {
  const winter = dress === 'winter';
  const hat = dress === 'summer' && spec.summerHat ? spec.summerHat : spec.hat ?? 'brim';
  return poses({
    spec: winter && spec.winterCoat ? { ...spec, coat: spec.winterCoat } : spec,
    hat,
    body: BODIES[spec.build ?? 'normal'],
    mitts: winter,
    scarf: winter || dress === 'autumn',
    longCoat: winter && !spec.skirt,
    rolled: dress === 'summer',
    beanie: winter && (hat === 'cap' || hat === 'none' || hat === 'straw'),
  });
}

// A villager's sprites, dressed for spring. See the top of this file.
export function villager(spec: VillagerSpec): PeopleSprites {
  const key = JSON.stringify(spec);
  let e = byKey.get(key);
  if (!e) byKey.set(key, (e = { spec, sets: {} }));
  let s = e.sets.spring;
  if (!s) {
    s = e.sets.spring = make(spec, 'spring');
    entryOf.set(s, e);
  }
  return s;
}

// The same person dressed for the season (built once, on first use).
export function dressed(s: PeopleSprites, dress: Dress): PeopleSprites {
  if (dress === 'spring') return s;
  const e = entryOf.get(s);
  if (!e) return s;
  let d = e.sets[dress];
  if (!d) {
    d = e.sets[dress] = make(e.spec, dress);
    entryOf.set(d, e);
  }
  return d;
}

// The same, for drawing every frame: when the season turns, people change
// one at a time (a set takes a few milliseconds to build), wearing what
// they last wore until their turn comes (someone not yet seen is dressed
// at once).
let lastBuild = -1e9;
const worn = new WeakMap<Entry, PeopleSprites>();
export function dressedSoon(s: PeopleSprites, dress: Dress): PeopleSprites {
  const e = entryOf.get(s);
  if (!e) return s;
  let d = e.sets[dress];
  if (!d) {
    const now = performance.now(), was = worn.get(e);
    if (was && now - lastBuild < 40) return was;
    lastBuild = now;
    d = dressed(s, dress);
  }
  worn.set(e, d);
  return d;
}

// The old way in (a brimmed hat, coat, legs and hair), or a villager spec.
export function peopleSprites(look: Look | VillagerSpec): PeopleSprites {
  if ('coat' in look) return villager(look);
  return villager({ hat: 'brim', hatColor: look.H, coat: look.C, legs: look.L, hair: look.R });
}
