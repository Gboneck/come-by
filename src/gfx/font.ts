import { makeCanvas } from './screen';

// Tiny 3x5 pixel font (a few glyphs are wider). Everything is upper case.
const G: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
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
  c: '.###.|#####|##.##|#####|.###.',
  h: '#.#|###|###|.#.|...',
  ' ': '..|..|..|..|..',
};

interface Glyph { w: number; bits: boolean[] }
const glyphs: Record<string, Glyph> = {};
for (const [ch, def] of Object.entries(G)) {
  const rows = def.split('|');
  const w = rows[0].length;
  glyphs[ch] = { w, bits: rows.join('').split('').map((c) => c === '#') };
}

const cache = new Map<string, HTMLCanvasElement>();
function glyphCanvas(ch: string, color: string): HTMLCanvasElement {
  const key = ch + color;
  let c = cache.get(key);
  if (!c) {
    const gl = glyphs[ch];
    const [cv, g] = makeCanvas(gl.w, 5);
    g.fillStyle = color;
    gl.bits.forEach((b, i) => b && g.fillRect(i % gl.w, Math.floor(i / gl.w), 1, 1));
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
  let w = 0;
  for (const ch of s) w += glyphs[glyphKey(ch)].w + 1;
  return Math.max(0, w - 1) * scale;
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  shadow?: string;
  scale?: number;
  // Per-character colour override for icons.
  iconColor?: string;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, o: TextOpts = {}): number {
  if (filter) s = filter(s);
  const scale = o.scale ?? 1;
  const w = textWidth(s, scale);
  let cx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  const cy = Math.round(y);
  for (const ch of s) {
    const k = glyphKey(ch);
    const gl = glyphs[k];
    const isIcon = k === 'c' || k === 'h';
    const col = isIcon && o.iconColor ? o.iconColor : color;
    if (o.shadow) g.drawImage(glyphCanvas(k, o.shadow), cx, cy + scale, gl.w * scale, 5 * scale);
    g.drawImage(glyphCanvas(k, col), cx, cy, gl.w * scale, 5 * scale);
    cx += (gl.w + 1) * scale;
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
