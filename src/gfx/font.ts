import { makeCanvas } from './screen';

// Two pixel faces, both upper case only.
//
// The body face is 5px tall and proportional: most letters are 3 wide, I and
// the stops are 1, M and W are 5. Letters sit one pixel apart, except where
// a pair leaves a gap anyway (L then T, a full stop after a P, ...): those
// are kerned together, as long as their nearest pixels are two rows apart.
//
// The heading face (heading(), below) is 7px tall and bold, for panel titles,
// banners and the logo.
const G: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '#|#|#|#|#',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#...#|##.##|#.#.#|#...#|#...#',
  N: '#..#|##.#|#.##|#..#|#..#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###',
  V: '#.#|#.#|#.#|#.#|.#.',
  W: '#...#|#...#|#.#.#|##.##|#...#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#.|##.|.#.|.#.|###',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  '.': '.|.|.|.|#',
  ',': '.|.|.|#|#',
  '!': '#|#|#|.|#',
  '?': '##.|..#|.#.|...|.#.',
  ':': '.|#|.|#|.',
  ';': '.|#|.|#|#',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  '/': '..#|..#|.#.|#..|#..',
  "'": '#|#|.|.|.',
  '"': '#.#|#.#|...|...|...',
  '(': '.#|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|#.',
  '%': '#.#|..#|.#.|#..|#.#',
  '=': '...|###|...|###|...',
  '<': '..#|.#.|#..|.#.|..#',
  '>': '#..|.#.|..#|.#.|#..',
  '*': '...|#.#|.#.|#.#|...',
  '_': '...|...|...|...|###',
  '#': '#.#|###|#.#|###|#.#',
  '^': '.#.|#.#|...|...|...',
  // Icons, addressed by lower-case letters in text: c = coin, h = heart.
  // '+' pixels are the coin's rim: drawn in `iconRim` when one is given
  // (plum on paper), else in the icon colour.
  c: '.+++.|+###+|+#.#+|+###+|.+++.',
  h: '#.#|###|###|.#.|...',
  ' ': '..|..|..|..|..',
};

interface Glyph { w: number; h: number; bits: number[]; left: number[]; right: number[] } // bits: 0 none, 1 ink, 2 rim
function build(defs: Record<string, string>): Record<string, Glyph> {
  const out: Record<string, Glyph> = {};
  for (const [ch, def] of Object.entries(defs)) {
    const rows = def.split('|');
    const w = rows[0].length, h = rows.length;
    const bits = rows.join('').split('').map((c) => (c === '#' ? 1 : c === '+' ? 2 : 0));
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
const glyphs = build(G);

// 0 or -1: how much closer the second glyph may sit to the first.
const kernCache = new Map<string, number>();
function kern(face: Record<string, Glyph>, a: string, b: string, tag: string): number {
  const k = tag + a + b;
  let v = kernCache.get(k);
  if (v === undefined) {
    const ga = face[a], gb = face[b];
    v = 0;
    if (ga && gb && a !== ' ' && b !== ' ' && ga.right.length && gb.left.length) {
      let near = 99;
      for (const i of ga.right) for (const j of gb.left) near = Math.min(near, Math.abs(i - j));
      if (near >= 2) v = -1;
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

function norm(ch: string): string {
  if (glyphs[ch]) return ch;
  const u = ch.toUpperCase();
  return glyphs[u] ? u : ' ';
}

// Text tokens: '$' renders the coin icon, '@' a heart.
function glyphKey(ch: string): string {
  if (ch === '$') return 'c';
  if (ch === '@') return 'h';
  return norm(ch);
}

export const LINE_H = 6;

// Rewrites text before it is measured or drawn: while a game pad is in use,
// src/ui/pad.ts swaps keyboard prompts ("SPACE TO BARK") for pad buttons.
let filter: ((s: string) => string) | null = null;
export function setTextFilter(f: ((s: string) => string) | null) {
  filter = f;
}

export function textWidth(s: string, scale = 1): number {
  if (filter) s = filter(s);
  let w = 0, prev = '';
  for (const ch of s) {
    const k = glyphKey(ch);
    w += glyphs[k].w + 1 + (prev ? kern(glyphs, prev, k, 'b') : 0);
    prev = k;
  }
  return Math.max(0, w - 1) * scale;
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  shadow?: string;
  scale?: number;
  // Per-character colour override for icons.
  iconColor?: string;
  // The coin's rim (plum on paper, so a buttercup coin still reads).
  iconRim?: string;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, o: TextOpts = {}): number {
  if (filter) s = filter(s);
  const scale = o.scale ?? 1;
  const w = textWidth(s, scale);
  let cx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  const cy = Math.round(y);
  let prev = '';
  for (const ch of s) {
    const k = glyphKey(ch);
    const gl = glyphs[k];
    if (prev) cx += kern(glyphs, prev, k, 'b') * scale;
    prev = k;
    const isIcon = k === 'c' || k === 'h';
    const col = isIcon && o.iconColor ? o.iconColor : color;
    const rim = isIcon ? o.iconRim : undefined;
    if (o.shadow) g.drawImage(glyphCanvas(glyphs, 'b', k, o.shadow), cx, cy + scale, gl.w * scale, 5 * scale);
    g.drawImage(glyphCanvas(glyphs, 'b', k, col, rim), cx, cy, gl.w * scale, 5 * scale);
    cx += (gl.w + 1) * scale;
  }
  return w;
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

// Greedy word wrap to a pixel width.
export function wrap(s: string, maxW: number): string[] {
  if (filter) s = filter(s);
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (textWidth(t) > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}
