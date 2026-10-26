import { PX, makeCanvas } from './screen';
import { BODY, SMALL } from './glyphs';

// The game's text.
//
// Two faces drawn in fine pixels (PX to a world pixel; glyphs in
// src/gfx/glyphs.ts), with lower case, proportional and kerned:
// - body: capitals 9 fine pixels, x-height 6, descenders 2, a line every 12
//   fine pixels (LINE_H = 6 world pixels);
// - small: capitals 7, x-height 5, a line every 10 (5 world pixels);
// - heading: the body face blown up by Scale2x (rounded, strokes two fine
//   pixels): capitals 18, a line every 24 (12 world pixels).
// text(g, s, x, y, colour, { size }) takes world pixels as everything else
// does (x, y may be fractional: they snap to the fine grid); y is the top
// of the capitals. Widths come back in world pixels, in halves.
//
// The heading face (heading(), below) is the bold capitals face from
// before, in world pixels, for panel titles, banners and the logo.

interface Glyph { w: number; h: number; bits: number[]; left: number[]; right: number[] } // bits: 0 none, 1 ink, 2 rim
function build(defs: Record<string, string>, rows?: number): Record<string, Glyph> {
  const out: Record<string, Glyph> = {};
  for (const [ch, raw] of Object.entries(defs)) {
    // "N:" starts the glyph N rows down.
    const m = /^(\d+):/.exec(raw);
    const lines = (m ? raw.slice(m[0].length) : raw).split('|');
    const all = [...Array(m ? Number(m[1]) : 0).fill(''), ...lines];
    const h = rows ?? all.length;
    const w = Math.max(...all.map((r) => r.length));
    const bits: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = all[y]?.[x];
      bits.push(c === '#' ? 1 : c === '+' ? 2 : 0);
    }
    // The rows where the first and last columns have ink, for kerning.
    const left: number[] = [], right: number[] = [];
    for (let y = 0; y < h; y++) {
      if (bits[y * w]) left.push(y);
      if (bits[y * w + w - 1]) right.push(y);
    }
    out[ch] = { w, h, bits, left, right };
  }
  return out;
}

export type TextSize = 'body' | 'small' | 'heading';
// gap: fine pixels between letters (kerning takes away as many).
interface Face { tag: string; glyphs: Record<string, Glyph>; rows: number; line: number; gap: number }
function face(tag: string, f: typeof BODY): Face {
  const glyphs = build(f.glyphs, f.rows);
  glyphs[' '] = { w: f.space, h: f.rows, bits: Array(f.space * f.rows).fill(0), left: [], right: [] };
  return { tag, glyphs, rows: f.rows, line: f.line, gap: 1 };
}

// The heading face: the body face blown up 2x with Scale2x, which rounds
// the diagonals and curves as it doubles every stroke: capitals 18 fine
// pixels (9 world), a line every 24.
function scale2x(src: Face, tag: string): Face {
  const glyphs: Record<string, Glyph> = {};
  for (const [ch, gl] of Object.entries(src.glyphs)) {
    const w = gl.w * 2, h = gl.h * 2;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gl.w || y >= gl.h ? 0 : gl.bits[y * gl.w + x]);
    const bits = new Array<number>(w * h).fill(0);
    for (let y = 0; y < gl.h; y++)
      for (let x = 0; x < gl.w; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        const o = y * 2 * w + x * 2;
        bits[o] = C === A && C !== D && A !== B ? A : P;
        bits[o + 1] = A === B && A !== C && B !== D ? B : P;
        bits[o + w] = D === C && D !== B && C !== A ? C : P;
        bits[o + w + 1] = B === D && B !== A && D !== C ? D : P;
      }
    const left: number[] = [], right: number[] = [];
    for (let y = 0; y < h; y++) {
      if (bits[y * w]) left.push(y);
      if (bits[y * w + w - 1]) right.push(y);
    }
    glyphs[ch] = { w, h, bits, left, right };
  }
  return { tag, glyphs, rows: src.rows * 2, line: src.line * 2, gap: 2 };
}
const FACES: Record<TextSize, Face> = { body: face('b', BODY), small: face('s', SMALL), heading: face('b', BODY) };
FACES.heading = scale2x(FACES.body, 'H');

// 0 or -1: how much closer the second glyph may sit to the first.
const kernCache = new Map<string, number>();
function kern(face: Record<string, Glyph>, a: string, b: string, tag: string, rows = 2): number {
  const k = tag + a + b;
  let v = kernCache.get(k);
  if (v === undefined) {
    const ga = face[a], gb = face[b];
    v = 0;
    if (ga && gb && a !== ' ' && b !== ' ' && ga.right.length && gb.left.length) {
      let near = 99;
      for (const i of ga.right) for (const j of gb.left) near = Math.min(near, Math.abs(i - j));
      if (near >= rows) v = -1;
    }
    kernCache.set(k, v);
  }
  return v;
}

const cache = new Map<string, HTMLCanvasElement>();
function glyphCanvas(face: Record<string, Glyph>, tag: string, ch: string, color: string, rim?: string, shade?: string): HTMLCanvasElement {
  const key = tag + ch + color + (rim ?? '') + (shade ?? '');
  let c = cache.get(key);
  if (!c) {
    const gl = face[ch];
    const [cv, g] = makeCanvas(gl.w, gl.h);
    gl.bits.forEach((b, i) => {
      if (!b) return;
      const y = Math.floor(i / gl.w);
      // A shade colour fills the lower rows: a two-tone, cast-metal look.
      g.fillStyle = b === 2 ? rim ?? color : shade && y >= gl.h - Math.ceil(gl.h / 3) ? shade : color;
      g.fillRect(i % gl.w, y, 1, 1);
    });
    cache.set(key, cv);
    c = cv;
  }
  return c;
}

// '$' is the coin, '@' a heart; anything the face lacks falls back to its
// capital, then to a space.
function glyphKey(f: Face, ch: string): string {
  if (f.glyphs[ch]) return ch;
  const u = ch.toUpperCase();
  return f.glyphs[u] ? u : ' ';
}
const isIcon = (k: string) => k === '$' || k === '@';

// Line pitch in world pixels: body 6, small 5, heading 12.
export const LINE_H = BODY.line / PX;
export const lineHeight = (size: TextSize = 'body') => FACES[size].line / PX;

// Rewrites text before it is measured or drawn: while a game pad is in use,
// src/ui/pad.ts swaps keyboard prompts ("SPACE TO BARK") for pad buttons.
let filter: ((s: string) => string) | null = null;
export function setTextFilter(f: ((s: string) => string) | null) {
  filter = f;
}

// Width in fine pixels, before any scale.
function fineWidth(f: Face, s: string): number {
  let w = 0, prev = '';
  for (const ch of s) {
    const k = glyphKey(f, ch);
    w += f.glyphs[k].w + f.gap + (prev ? kern(f.glyphs, prev, k, f.tag, 2 * f.gap) * f.gap : 0);
    prev = k;
  }
  return Math.max(0, w - f.gap);
}

// Width in world pixels (halves are possible).
export function textWidth(s: string, scale = 1, size: TextSize = 'body'): number {
  if (filter) s = filter(s);
  return (fineWidth(FACES[size], s) * scale) / PX;
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  shadow?: string; // one fine pixel below (two for headings)
  scale?: number; // whole number: every fine pixel drawn this many times
  size?: TextSize;
  // Per-character colour override for icons.
  iconColor?: string;
  // The coin's rim (plum on paper, so a buttercup coin still reads).
  iconRim?: string;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, o: TextOpts = {}): number {
  if (filter) s = filter(s);
  const f = FACES[o.size ?? 'body'];
  const scale = o.scale ?? 1;
  const wf = fineWidth(f, s) * scale;
  // Placed on the fine grid, in fine pixels.
  let fx = Math.round(x * PX - (o.align === 'center' ? wf / 2 : o.align === 'right' ? wf : 0));
  const fy = Math.round(y * PX);
  const gh = (f.rows * scale) / PX;
  let prev = '';
  for (const ch of s) {
    const k = glyphKey(f, ch);
    const gl = f.glyphs[k];
    if (prev) fx += kern(f.glyphs, prev, k, f.tag, 2 * f.gap) * f.gap * scale;
    prev = k;
    if (k !== ' ') {
      const icon = isIcon(k);
      const gw = (gl.w * scale) / PX;
      if (o.shadow) g.drawImage(glyphCanvas(f.glyphs, f.tag, k, o.shadow), fx / PX, (fy + f.gap * scale) / PX, gw, gh);
      g.drawImage(glyphCanvas(f.glyphs, f.tag, k, icon && o.iconColor ? o.iconColor : color, icon ? o.iconRim : undefined), fx / PX, fy / PX, gw, gh);
    }
    fx += (gl.w + f.gap) * scale;
  }
  return wf / PX;
}

// ---- Heading face: 7px, bold, for titles, banners and the logo ----

const HG: Record<string, string> = {
  A: '.###.|##.##|##.##|#####|##.##|##.##|##.##',
  B: '####.|##.##|##.##|####.|##.##|##.##|####.',
  C: '.####|##...|##...|##...|##...|##...|.####',
  D: '####.|##.##|##.##|##.##|##.##|##.##|####.',
  E: '#####|##...|##...|####.|##...|##...|#####',
  F: '#####|##...|##...|####.|##...|##...|##...',
  G: '.####|##...|##...|##.##|##.##|##.##|.####',
  H: '##.##|##.##|##.##|#####|##.##|##.##|##.##',
  I: '##|##|##|##|##|##|##',
  J: '...##|...##|...##|...##|##.##|##.##|.###.',
  K: '##.##|##.##|####.|###..|####.|##.##|##.##',
  L: '##...|##...|##...|##...|##...|##...|#####',
  M: '##...##|###.###|#######|##.#.##|##...##|##...##|##...##',
  N: '##..##|###.##|######|##.###|##..##|##..##|##..##',
  O: '.###.|##.##|##.##|##.##|##.##|##.##|.###.',
  P: '####.|##.##|##.##|####.|##...|##...|##...',
  Q: '.###.|##.##|##.##|##.##|##.##|##.#.|.##.#',
  R: '####.|##.##|##.##|####.|##.##|##.##|##.##',
  S: '.####|##...|##...|.###.|...##|...##|####.',
  T: '######|..##..|..##..|..##..|..##..|..##..|..##..',
  U: '##.##|##.##|##.##|##.##|##.##|##.##|.###.',
  V: '##.##|##.##|##.##|##.##|##.##|.###.|..#..',
  W: '##...##|##...##|##...##|##.#.##|#######|###.###|##...##',
  X: '##.##|##.##|.###.|..#..|.###.|##.##|##.##',
  Y: '##..##|##..##|.####.|..##..|..##..|..##..|..##..',
  Z: '#####|...##|..##.|.##..|##...|##...|#####',
  '0': '.###.|##.##|##.##|##.##|##.##|##.##|.###.',
  '1': '.##|###|.##|.##|.##|.##|.##',
  '2': '.###.|##.##|...##|..##.|.##..|##...|#####',
  '3': '####.|...##|...##|.###.|...##|...##|####.',
  '4': '##.##|##.##|##.##|#####|...##|...##|...##',
  '5': '#####|##...|####.|...##|...##|...##|####.',
  '6': '.###.|##...|####.|##.##|##.##|##.##|.###.',
  '7': '#####|...##|...##|..##.|..##.|.##..|.##..',
  '8': '.###.|##.##|##.##|.###.|##.##|##.##|.###.',
  '9': '.###.|##.##|##.##|.####|...##|...##|.###.',
  '!': '##|##|##|##|##|..|##',
  '?': '.###.|##.##|...##|..##.|.##..|.....|.##..',
  "'": '##|##|.#|..|..|..|..',
  '.': '..|..|..|..|..|##|##',
  ',': '..|..|..|..|..|##|.#',
  ':': '..|##|##|..|##|##|..',
  '-': '....|....|....|####|....|....|....',
  '+': '......|..##..|..##..|######|..##..|..##..|......',
  '/': '...##|...##|..##.|..#..|.##..|##...|##...',
  c: '.+++.|+###+|+#+#+|+#+#+|+#+#+|+###+|.+++.',
  h: '.#.#.|#####|#####|#####|.###.|..#..|.....',
  ' ': '...|...|...|...|...|...|...',
};
const hglyphs = build(HG);
export const HEAD_H = 7;

function hkey(ch: string): string {
  if (ch === '$') return 'c';
  if (ch === '@') return 'h';
  const u = ch.toUpperCase();
  return hglyphs[u] ? u : ' ';
}

export function headingWidth(s: string, scale = 1): number {
  if (filter) s = filter(s);
  let w = 0, prev = '';
  for (const ch of s) {
    const k = hkey(ch);
    w += hglyphs[k].w + 1 + (prev ? kern(hglyphs, prev, k, 'h') : 0);
    prev = k;
  }
  return Math.max(0, w - 1) * scale;
}

export interface HeadingOpts {
  align?: 'left' | 'center' | 'right';
  scale?: number;
  shade?: string; // lower third of each letter
  outline?: string; // a one-pixel outline all round
  shadow?: string; // a drop shadow one pixel down
  iconColor?: string;
  iconRim?: string;
}

export function heading(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, o: HeadingOpts = {}): number {
  if (filter) s = filter(s);
  const scale = o.scale ?? 1;
  const w = headingWidth(s, scale);
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  const cy = Math.round(y);
  // Lay the glyphs out once, then draw outline, shadow and face in passes so
  // no letter's outline covers its neighbour.
  const at: [string, number][] = [];
  let cx = x0, prev = '';
  for (const ch of s) {
    const k = hkey(ch);
    if (prev) cx += kern(hglyphs, prev, k, 'h') * scale;
    prev = k;
    at.push([k, cx]);
    cx += (hglyphs[k].w + 1) * scale;
  }
  const draw = (k: string, px: number, py: number, col: string, rim?: string, shade?: string) => {
    const gl = hglyphs[k];
    g.drawImage(glyphCanvas(hglyphs, 'h', k, col, rim, shade), px, py, gl.w * scale, gl.h * scale);
  };
  if (o.outline) {
    for (const [k, px] of at)
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(k, px + dx * scale, cy + dy * scale, o.outline);
  }
  if (o.shadow) for (const [k, px] of at) draw(k, px, cy + scale, o.shadow, o.shadow);
  for (const [k, px] of at) {
    const icon = k === 'c' || k === 'h';
    draw(k, px, cy, icon && o.iconColor ? o.iconColor : color, icon ? o.iconRim : undefined, icon ? undefined : o.shade);
  }
  return w;
}

// Greedy word wrap to a width in world pixels.
export function wrap(s: string, maxW: number, size: TextSize = 'body'): string[] {
  if (filter) s = filter(s);
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (textWidth(t, 1, size) > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}
