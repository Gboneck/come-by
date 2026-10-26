import { U32, type ColorName } from '../palette';
import { makeCanvas } from '../gfx/screen';
import type { Sprite } from '../gfx/sprite';

// The townsfolk: small 3/4 people with a plum outline, lit from the upper
// right. Every frame is painted in code from parts (legs, torso, arms, head,
// hat, tool, load) onto a grid of template letters, then recoloured per
// person and outlined, so every pose of every person stays consistent.
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

// A frame, with where its near hand is (from the anchor, unflipped): the
// lantern hangs from it and the shepherd's crook is held in it.
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
  carry: Record<string, Record<Face3, Pic[]>>; // per load colour ('y' hay and eggs, 'w' sacks and pails)
  talk: Record<Face3, Pic[]>; // hand up, palm out, a point, a nod
  idle: Record<Face3, Pic>; // a rest while standing about: hands on hips, or behind the back
  hammer: Pic[]; // side on: raised, high, strike, bounce
  axe: Pic[];
  crouch: Record<Face3, Pic[]>; // reach down, pick, lift, rest
  sit: Pic[]; // idle, a foot swung, a hand up, palm out
  wave: Record<Face3, Pic[]>;
}

// ---- The grid ----

// Template letters:
//   H hat  K hat band  F skin  E eye  R hair  D beard
//   C coat  A sleeve  Q forearm  a q far sleeve and forearm
//   N apron  S scarf  M mitten  W bobble
//   L near leg  l far leg  B boot  _ a hole (the ground shows through)
//   T handle  P iron  V blade  G block  X load  Z load shade  O basket
type Cell = [number, number, string];

class Grid {
  cells = new Map<number, string>();
  over = new Set<number>(); // sleeves painted over the coat: an inner line
  side = false;
  hx = 0;
  hy = 0;
  private static k(x: number, y: number) {
    return (y + 64) * 128 + (x + 64);
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
  bounds() {
    let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
    for (const [k, c] of this.cells) {
      if (c === '_') continue;
      const x = (k % 128) - 64, y = Math.floor(k / 128) - 64;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }
}

// ---- Shading and outline ----

const DARK: Record<string, Ch> = { w: 's', y: 'o', t: 'p', s: 't', o: 's', m: 'o' };
const LIGHT: Record<string, Ch> = { t: 's', p: 't', s: 'o', o: 'm', y: 'w' };
const dk = (c: Ch) => DARK[c] ?? c;
// A shade for cloth: never all the way to plum (that is the outline).
const soft = (c: Ch) => (DARK[c] && DARK[c] !== 'p' ? DARK[c] : null);

// What counts as one surface for the edge light: a sleeve beside the coat
// is the same cloth.
const GROUP: Record<string, string> = { C: 'c', A: 'c', Q: 'c', L: 'l', N: 'n' };

const NAME: Record<string, ColorName> = { m: 'meadow', o: 'moss', s: 'sage', t: 'teal', p: 'plum', w: 'wool', y: 'butter' };

function render(g: Grid, colour: Record<string, Ch>): Pic {
  const { x0, x1, y0, y1 } = g.bounds();
  const w = x1 - x0 + 3, h = y1 - y0 + 3;
  const tpl = (x: number, y: number) => g.get(x, y);
  const filled = (x: number, y: number) => {
    const t = tpl(x, y);
    return !!t && t !== '_';
  };
  const cell = (x: number, y: number): Ch | null => {
    const t = tpl(x, y);
    if (!t || t === '_') return null;
    const c = colour[t] ?? t;
    const grp = GROUP[t];
    if (grp) {
      // A sleeve across the coat: a line of shade to show the arm (a teal
      // coat has no shade short of the plum outline, so none).
      if ((t === 'A' || t === 'Q') && g.isOver(x, y)) return soft(c) ?? c;
      if (grp === 'l' && g.side) return c;
      const lt = tpl(x - 1, y), rt = tpl(x + 1, y);
      if (x <= 0 && (!lt || GROUP[lt] !== grp) && soft(c)) return soft(c);
      if (grp === 'c' && x >= 0 && (!rt || GROUP[rt] !== grp) && LIGHT[c]) return LIGHT[c];
    }
    // A brim is a shade darker underneath on the left.
    if (t === 'H' && tpl(x, y + 1) !== 'H' && tpl(x - 1, y) !== 'H' && DARK[c]) return DARK[c];
    return c;
  };
  const [img, gg] = makeCanvas(w, h);
  const data = gg.createImageData(w, h);
  const buf = new Uint32Array(data.data.buffer);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const x = xx + x0 - 1, y = yy + y0 - 1;
      let c = cell(x, y);
      if (!c) {
        if (tpl(x, y) === '_') continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) c = 'p';
        else continue;
      }
      buf[yy * w + xx] = U32[NAME[c] ?? 'plum'];
    }
  }
  gg.putImageData(data, 0, 0);
  return { w, h, ax: 1 - x0, ay: 1 - y0, img, flipImg: null, hx: g.hx, hy: g.hy };
}

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
  if (c === 'F' && w.mitts) return 'M';
  if (c === 'Q' && w.rolled) return 'F';
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
    if (w.spec.apron) for (let y = f.sh + 1; y <= f.hip; y++) g.set(half, y, 'N');
    return;
  }
  for (let y = f.sh; y <= f.waist; y++) for (let x = -half; x <= half; x++) g.set(x, y, 'C');
  if (face === 'd' && w.spec.apron) for (let y = f.sh + 1; y <= f.hip; y++) for (let x = -half + 1; x <= half - 1; x++) g.set(x, y, 'N');
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
    case 'down': return [...sleeve(len - 1), [0, len, 'F']];
    case 'fwd': return [...sleeve(len), [0, len + 1, 'F']];
    case 'back': return [...sleeve(len - 2), [0, len - 1, 'F']];
    case 'hip': return [[0, 0, 'A'], [1, 1, 'Q'], [0, len, 'F']];
    case 'raise': return [[0, 0, 'A'], [1, 0, 'Q'], [1, -1, 'F']];
    case 'palm': return [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'F']];
    case 'point': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, 0, 'F']];
    case 'wave1': return [[0, 0, 'A'], [1, -1, 'Q'], [1, -2, 'Q'], [1, -3, 'F']];
    case 'wave2': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [2, -3, 'F']];
    case 'lamp': return [[0, 0, 'A'], [1, 1, 'Q'], [1, len - 1, 'F']];
    case 'tuck': return [[0, 0, 'A'], [0, 1, 'Q'], [-1, len, 'F']];
    // Side on (forward is +x).
    case 's-2': return [[0, 0, 'A'], [-1, 1, 'Q'], [-2, len, 'F']];
    case 's-1': return [[0, 0, 'A'], [0, 1, 'Q'], [-1, len, 'F']];
    case 's0': return [[0, 0, 'A'], [0, 1, 'Q'], [0, len, 'F']];
    case 's1': return [[0, 0, 'A'], [0, 1, 'Q'], [1, len, 'F']];
    case 's2': return [[0, 0, 'A'], [1, 1, 'Q'], [2, len - 1, 'F']];
    case 'sLamp': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'F']];
    case 'sRaise': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, -1, 'F']];
    case 'sPalm': return [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'Q'], [3, 0, 'F']];
    case 'sPoint': return [[0, 0, 'A'], [1, 0, 'Q'], [2, 0, 'Q'], [3, 0, 'Q'], [4, 0, 'F']];
    case 'sWave1': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [2, -3, 'F']];
    case 'sWave2': return [[0, 0, 'A'], [1, -1, 'Q'], [2, -2, 'Q'], [3, -3, 'F']];
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
    if (grip && c === 'F') {
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

// ---- Head and hat ----

interface HeadOpt {
  dy?: number;
  dx?: number;
  blink?: boolean;
  noNose?: boolean;
}

function head(g: Grid, w: Who, f: Frame, face: Face3, o: HeadOpt = {}) {
  const dy = o.dy ?? 0, dx = o.dx ?? 0;
  const eye = f.eye + dy, fore = f.fore + dy;
  const beard = w.spec.beard;
  const at = (x: number, y: number, c: string) => g.set(x + dx, y, c);
  if (face === 'r') {
    at(-1, fore, 'R');
    at(0, fore, 'F');
    at(1, fore, 'F');
    at(-1, eye, 'R');
    at(0, eye, 'F');
    at(1, eye, o.blink ? 'F' : 'E');
    if (!o.noNose) at(2, eye, 'F');
    if (beard) {
      at(0, eye + 1, 'D');
      at(1, eye + 1, 'D');
    }
  } else if (face === 'd') {
    for (let x = -1; x <= 1; x++) at(x, fore, 'F');
    at(-1, eye, o.blink ? 'F' : 'E');
    at(0, eye, 'F');
    at(1, eye, o.blink ? 'F' : 'E');
    if (beard) {
      for (let x = -1; x <= 1; x++) at(x, eye + 1, 'D');
      at(0, eye + 2, 'D');
    }
  } else {
    for (let x = -1; x <= 1; x++) {
      at(x, fore, 'R');
      at(x, eye, 'R');
    }
  }
  hatOn(g, w, fore, face, dx);
}

function hatOn(g: Grid, w: Who, fore: number, face: Face3, dx: number) {
  const row = (y: number, a: number, b: number, c = 'H') => {
    for (let x = a; x <= b; x++) g.set(x + dx, y, c);
  };
  const at = (x: number, y: number, c: string) => g.set(x + dx, y, c);
  const side = face === 'r';
  if (w.beanie) {
    // A woolly hat with a turned-up band and a bobble, down over the ears.
    row(fore - 1, -1, 1, 'K');
    row(fore - 2, -1, 1);
    at(side ? -1 : 0, fore - 3, 'W');
    if (side) {
      at(-2, fore - 1, 'K');
      at(-2, fore, 'H');
    } else {
      at(-2, fore - 1, 'K');
      at(2, fore - 1, 'K');
      at(-2, fore, 'H');
      at(2, fore, 'H');
    }
    return;
  }
  switch (w.hat) {
    case 'brim':
      row(fore - 2, -1, 1);
      if (side) row(fore - 1, -2, 3);
      else row(fore - 1, -2, 2);
      break;
    case 'straw':
      row(fore - 2, -1, 1, 'K');
      row(fore - 3, -1, 1);
      if (side) row(fore - 1, -3, 4);
      else row(fore - 1, -3, 3);
      break;
    case 'cap':
      row(fore - 2, -1, 1);
      if (side) row(fore - 1, -1, 3);
      else row(fore - 1, -2, 2, face === 'd' ? 'K' : 'H');
      break;
    case 'bowler':
      row(fore - 3, -1, 1);
      row(fore - 2, -1, 1, 'K');
      if (side) row(fore - 1, -2, 2);
      else row(fore - 1, -2, 2);
      break;
    case 'bonnet':
    case 'hood': {
      const c = w.hat === 'hood' ? 'C' : 'H';
      row(fore - 2, -1, 1, c);
      if (side) {
        row(fore - 1, -2, 1, c);
        at(-2, fore, c);
        at(-1, fore, c);
        at(-2, fore + 1, c);
        at(-1, fore + 1, c);
      } else {
        row(fore - 1, -2, 2, c);
        at(-2, fore, c);
        at(2, fore, c);
        at(-2, fore + 1, c);
        at(2, fore + 1, c);
        if (face === 'u') row(fore, -1, 1, c);
      }
      break;
    }
    case 'none':
      row(fore - 1, -1, 1, 'R');
      if (side) at(-2, fore, 'R');
      else {
        at(-2, fore, 'R');
        at(2, fore, 'R');
      }
      break;
  }
}

// ---- Whole figures ----

interface FigOpt extends HeadOpt {
  up?: number;
  sink?: number;
}

function frontFigure(w: Who, face: 'd' | 'u', legs: FrontLegs, left: ArmKind, right: ArmKind, o: FigOpt = {}): Grid {
  const g = new Grid();
  const f = frame(w.body, o.up ?? 0, o.sink ?? 0);
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
  legsSide(g, w, f, near, far);
  if (farArm) paint(g, w, 0, f.sh, 1, arm(farArm, len), true);
  torso(g, w, f, 'r', lean);
  head(g, w, f, 'r', { ...o, dx: lean });
  scarf(g, w, f, 'r', o.flutter ?? 0, lean);
  if (nearArm) paint(g, w, lean, f.sh, 1, arm(nearArm, len), false, true);
  return g;
}

// Standing side on: feet together.
const STAND_STEP = 2;

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

function poses(w: Who): PeopleSprites {
  const colour = colours(w);
  const pics = new Map<string, Pic>();
  // Identical frames share one canvas.
  const pic = (g: Grid, cmap = colour) => {
    let key = cmap === colour ? '' : JSON.stringify(cmap);
    for (const [k, v] of g.cells) key += k + v + (g.over.has(k) ? '!' : '') + ',';
    key += g.hx + ':' + g.hy + (g.side ? 's' : '');
    let p = pics.get(key);
    if (!p) pics.set(key, (p = render(g, cmap)));
    return p;
  };
  const faces = <T>(fn: (f: Face3) => T): Record<Face3, T> => ({ d: fn('d'), u: fn('u'), r: fn('r') });
  const len = w.body.torsoH - 1;
  const fr0 = frame(w.body);

  // Front and back: arms swung at the contacts; as each foot passes it
  // lifts and the body rides up a pixel.
  const FRONT_SEQ: [FrontLegs, number, number][] = [
    ['stand', 0, 0], ['stand', 0, 0], ['liftL', -1, 1], ['liftL', -1, 1],
    ['stand', 0, 2], ['stand', 0, 2], ['liftR', -1, 1], ['liftR', -1, 1],
  ];
  const swingL: ArmKind[] = ['fwd', 'down', 'back'];
  const swingR: ArmKind[] = ['back', 'down', 'fwd'];
  const frontWalk = (face: 'd' | 'u', armsL: ArmKind[], armsR: ArmKind[]) =>
    FRONT_SEQ.map(([legs, up, a]) => pic(frontFigure(w, face, legs, armsL[a], armsR[a], { up })));
  const sideWalk = (near: (i: number) => ArmKind, far: (i: number) => ArmKind | null) =>
    SIDE_STEPS.map((_, i) => pic(sideFigure(w, i, near(i), far(i), { flutter: (i >> 1) & 1 })));

  const walk = faces((f) => (f === 'r'
    ? sideWalk((i) => SIDE_ARM[SIDE_SWING[i]], (i) => SIDE_ARM[-SIDE_SWING[i]])
    : frontWalk(f, swingL, swingR)));
  const stand = faces((f) => (f === 'r' ? pic(sideFigure(w, STAND_STEP, 's0', null, { up: 0 })) : pic(frontFigure(w, f, 'stand', 'down', 'down'))));
  const blink = pic(frontFigure(w, 'd', 'stand', 'down', 'down', { blink: true }));

  // A lantern held out on one side, steady; the other arm swings.
  const LAMP: ArmKind[] = ['lamp', 'lamp', 'lamp'];
  const lamp = () => faces((f) => (f === 'r'
    ? sideWalk(() => 'sLamp', (i) => SIDE_ARM[-SIDE_SWING[i]])
    : frontWalk(f, f === 'd' ? swingL : LAMP, f === 'd' ? LAMP : swingR)));
  const lampStand = () => faces((f) => (f === 'r'
    ? pic(sideFigure(w, STAND_STEP, 'sLamp', null, { up: 0 }))
    : pic(frontFigure(w, f, 'stand', f === 'd' ? 'down' : 'lamp', f === 'd' ? 'lamp' : 'down'))));

  // A load held in front with both arms: a bale of hay, a sack, a pail.
  const carryOf = (item: string) => {
    const cmap = { ...colour, X: item, Z: dk(item) === item ? 's' : dk(item) };
    return faces((f) => {
      if (f === 'r') {
        return SIDE_STEPS.map((_, i) => {
          const g = sideFigure(w, i, null, null);
          const fr = frame(w.body, SIDE_UP[i]);
          g.stamp(['ZXXZ', 'ZZZZ'], 1, fr.sh + 1);
          paint(g, w, 0, fr.sh, 1, [[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'F']], false, true);
          return pic(g, cmap);
        });
      }
      return FRONT_SEQ.map(([legs, up]) => {
        const fr = frame(w.body, up);
        const hw = w.body.half + 1;
        if (f === 'd') {
          const g = frontFigure(w, 'd', legs, 'down', 'down', { up });
          // A wide load in front, the arms round it.
          for (let x = -hw - 1; x <= hw + 1; x++) {
            g.set(x, fr.sh + 1, Math.abs(x) > hw ? 'Z' : 'X');
            g.set(x, fr.sh + 2, 'Z');
          }
          g.hx = hw + 1;
          g.hy = fr.sh + 1;
          return pic(g, cmap);
        }
        // From behind: elbows out, and the ends of the load either side.
        const g = frontFigure(w, 'u', legs, 'tuck', 'tuck', { up });
        for (const s of [-1, 1]) {
          g.set(s * hw, fr.sh + 1, 'Q');
          g.set(s * hw, fr.sh + 2, '_');
          g.set(s * (hw + 1), fr.sh + 1, 'X');
          g.set(s * (hw + 1), fr.sh + 2, 'Z');
        }
        return pic(g, cmap);
      });
    });
  };
  const carry = lazy({} as Record<string, Record<Face3, Pic[]>>, { y: () => carryOf('y'), w: () => carryOf('w') });

  // Talking: a hand up, palm out with a nod, a point, a nod.
  const talk = () => faces((f) => {
    if (f === 'r') {
      return [
        pic(sideFigure(w, STAND_STEP, 'sRaise', null, { up: 0, noNose: true })),
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

  // Tools, side on. Each frame: the near arm and the tool from the shoulder
  // [x, y from the shoulder row], whether they lean in, and the nose.
  const tool = (frames: { cells: Cell[]; lean?: number; nose?: boolean; under?: Cell[] }[]) =>
    frames.map((t) => {
      const g = sideFigure(w, STAND_STEP, null, null, { up: 0, lean: t.lean ?? 0, noNose: t.nose === false });
      if (t.under) for (const [x, y, c] of t.under) g.under(x, fr0.sh + y, c);
      paint(g, w, 0, fr0.sh, 1, t.cells, false, true);
      return pic(g);
    });
  const hammer = () => tool([
    // raised in front
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 0, 'F'], [3, -1, 'T'], [3, -2, 'P'], [4, -2, 'P']] },
    // up high
    { cells: [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'Q'], [3, -2, 'F'], [3, -3, 'T'], [3, -4, 'P'], [4, -4, 'P']], nose: false },
    // strike: leaning in, the head down on the work
    { cells: [[1, 0, 'A'], [2, 1, 'Q'], [3, 1, 'F'], [4, 1, 'T'], [5, 1, 'P'], [5, 2, 'P']], lean: 1 },
    // bounce
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'F'], [3, 0, 'T'], [4, -1, 'P'], [4, 0, 'P']] },
  ]);
  // The chopping block in front.
  const block: Cell[] = [[5, 4, 'J'], [6, 4, 'J'], [7, 4, 'J'], [5, 5, 'G'], [6, 5, 'G'], [7, 5, 'G']];
  const axe = () => tool([
    // lifting, the axe up and forward
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'F'], [3, 0, 'T'], [4, -1, 'T'], [4, -2, 'P'], [5, -2, 'V'], [5, -3, 'V']], under: block },
    // up high before the face, the head over the hat
    { cells: [[0, 0, 'A'], [1, 0, 'Q'], [2, -1, 'F'], [2, -2, 'T'], [2, -3, 'T'], [2, -4, 'P'], [3, -4, 'V'], [3, -5, 'V']], nose: false, under: block },
    // strike: down into the block
    { cells: [[1, 0, 'A'], [2, 1, 'Q'], [3, 2, 'F'], [4, 2, 'T'], [5, 2, 'P'], [5, 3, 'V'], [6, 3, 'V']], lean: 1, under: block },
    // pulling it free
    { cells: [[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'F'], [3, 1, 'T'], [4, 0, 'T'], [5, 0, 'P'], [5, 1, 'V'], [6, 1, 'V']], under: block },
  ]);

  // Crouching, front: down on the heels between the knees, picking up
  // (an egg, a weed) and into the basket.
  const crouch = () => faces((f) => {
    if (f === 'd') {
      const fr = frame(w.body, 0, 2);
      const mk = (arms: string[], dy = 0, item: [number, number] | null = null) => {
        const g = new Grid();
        torso(g, w, fr, 'd');
        scarf(g, w, fr, 'd', 0);
        // knees up either side, boots out
        g.stamp(['L...L', 'B___B'], -2, -1);
        g.stamp(arms, -3, fr.sh, (c) => dressCell(w, c));
        head(g, w, fr, 'd', { dy });
        if (item) g.set(item[0], item[1], 'X');
        g.stamp(['XXX', 'OOO'], 4, -1);
        return pic(g);
      };
      return [
        mk(['.A...A.', '.Q...Q.', '..Q.Q..', '..F.F..'], 1),
        mk(['.A...A.', '.Q...QF', '..Q....', '..F....'], 0, [3, fr.sh]),
        mk(['.A...AQ', '.Q.....', '..Q....', '..F....'], 0, [4, fr.sh + 1]),
        mk(['.A...A.', '.Q...Q.', '.F...F.', '.......']),
      ];
    }
    if (f === 'u') {
      // Kneeling with their back to us (at a trough): elbows working.
      const fr = frame(w.body, 0, 2);
      const mk = (arms: string[], dy = 0) => {
        const g = new Grid();
        torso(g, w, fr, 'u');
        g.stamp(['.LLL.', 'BB_BB'], -2, -1);
        scarf(g, w, fr, 'u', 0);
        head(g, w, fr, 'u', { dy });
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
      g.stamp(['.lLLL.', 'bll__BB'], -3, -1);
      torso(g, w, fr, 'r', 1);
      head(g, w, fr, 'r', { dx: 1, dy });
      scarf(g, w, fr, 'r', 0, 1);
      paint(g, w, 1, fr.sh, 1, cells, false, true);
      if (item) g.set(item[0], item[1], 'X');
      return pic(g);
    };
    return [
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'Q'], [3, 3, 'F']]),
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 2, 'Q'], [3, 3, 'F']], 1, [5, 0]),
      mk([[0, 0, 'A'], [1, 1, 'Q'], [2, 1, 'F']], 0, [3, fr.sh]),
      mk([[0, 0, 'A'], [0, 1, 'Q'], [1, 2, 'F']], 0),
    ];
  });

  // On the bench: down a row, thighs towards us over the seat, hands on the
  // knees; a foot swung now and then; a word with a hand up.
  const sit = () => {
    const fr = frame(w.body, 0, 1);
    const mk = (legs: string[], right: ArmKind, dy = 0) => {
      const g = new Grid();
      torso(g, w, fr, 'd');
      scarf(g, w, fr, 'd', 0);
      g.stamp(legs, -2, fr.waist);
      paint(g, w, -2, fr.sh, -1, arm('tuck', len));
      paint(g, w, 2, fr.sh, 1, arm(right, len), false, true);
      head(g, w, fr, 'd', { dy });
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
        pic(sideFigure(w, STAND_STEP, 'sWave1', null, { up: 0, noNose: true })),
        pic(sideFigure(w, STAND_STEP, 'sWave2', null, { up: 0, noNose: true })),
      ];
    }
    return [pic(frontFigure(w, f, 'stand', 'hip', 'wave1')), pic(frontFigure(w, f, 'stand', 'hip', 'wave2'))];
  });

  // Only the walk is built up front; the rest on first use.
  return lazy({ stand, blink, walk, carry } as PeopleSprites, { lamp, lampStand, talk, idle, hammer, axe, crouch, sit, wave });
}

function colours(w: Who): Record<string, Ch> {
  const s = w.spec;
  const hat = s.hatColor ?? 'p';
  const hair = s.hair ?? 'p';
  const sc = s.scarf ?? scarfFor(s.coat, hat);
  return {
    H: hat,
    K: soft(hat) ?? (hat === 'p' ? 't' : 'p'),
    F: 'w',
    E: 'p',
    R: hair,
    D: typeof s.beard === 'string' ? s.beard : hair,
    C: s.coat,
    A: s.coat,
    Q: s.coat,
    a: soft(s.coat) ?? 'p',
    q: soft(s.coat) ?? 'p',
    N: s.apron ?? 'w',
    S: sc,
    M: sc,
    W: sc,
    L: s.legs,
    l: dk(s.legs),
    B: 'p',
    T: 'o',
    P: 't',
    V: 'w',
    G: 'o',
    J: 'y',
    X: 'y',
    Z: 'o',
    O: 'o',
  };
}

// A scarf that stands out from the coat and the hat.
function scarfFor(coat: Ch, hat: Ch): Ch {
  for (const c of ['y', 'w', 't', 's']) if (c !== coat && c !== hat) return c;
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

// The old way in (a brimmed hat, coat, legs and hair), or a villager spec.
export function peopleSprites(look: Look | VillagerSpec): PeopleSprites {
  if ('coat' in look) return villager(look);
  return villager({ hat: 'brim', hatColor: look.H, coat: look.C, legs: look.L, hair: look.R });
}
