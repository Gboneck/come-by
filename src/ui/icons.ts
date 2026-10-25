import { drawSpr, spr, type Sprite } from '../gfx/sprite';
import type { Sky } from '../systems/weather';

// Little UI glyphs (7x7), drawn on plum panels. One char per pixel, as the
// sprites: y butter, w wool, s sage, t teal, p plum, '.' clear.
const SKY: Record<Sky | 'moon', string[]> = {
  clear: [
    '...y...',
    '.y...y.',
    '...y...',
    'y.yyy.y',
    '...y...',
    '.y...y.',
    '...y...',
  ],
  moon: [
    '..ww...',
    '.ww....',
    'www....',
    'www....',
    'www...w',
    '.wwwww.',
    '..www..',
  ],
  wind: [
    '.......',
    'wwwww..',
    '.....w.',
    '.wwww..',
    '.......',
    'www.ww.',
    '.......',
  ],
  rain: [
    '..www..',
    '.wwwww.',
    'wwwwwww',
    '.......',
    't.t.t..',
    '.t.t.t.',
    '.......',
  ],
  fog: [
    '.......',
    'sss.ss.',
    '.......',
    '.ss.sss',
    '.......',
    'sss.ss.',
    '.......',
  ],
  storm: [
    '..www..',
    '.wwwww.',
    'wwwwwww',
    '...y...',
    't.yy.t.',
    '...y...',
    '.t.y.t.',
  ],
};

export const SKY_WORD: Record<Sky, string> = { clear: 'FAIR', wind: 'WINDY', rain: 'RAIN', fog: 'FOG', storm: 'STORM' };

const cache = new Map<string, Sprite>();

// Top-left corner at (x, y). A clear night shows the moon.
export function skyIcon(g: CanvasRenderingContext2D, sky: Sky, x: number, y: number, night = false) {
  const key = sky === 'clear' && night ? 'moon' : sky;
  let s = cache.get(key);
  if (!s) {
    s = spr(SKY[key as Sky | 'moon'], 0, 0);
    cache.set(key, s);
  }
  drawSpr(g, s, Math.round(x), Math.round(y));
}
