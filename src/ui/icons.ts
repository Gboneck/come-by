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

// The seasons, shown by the clock on a clear day.
const SEASON_ICON: Record<'spring' | 'autumn' | 'winter' | 'summer', string[]> = {
  spring: ['..w..', '.wyw.', 'wyyyw', '.wyw.', '..s..', '.ss..', '..s..'],
  summer: ['...y...', '.y...y.', '...y...', 'y.yyy.y', '...y...', '.y...y.', '...y...'],
  autumn: ['...y.', '..yyo', '.yyyo', 'yyyo.', 'yyo..', '.o...', 'o....'],
  winter: ['..w..', 'w.w.w', '.www.', 'wwwww', '.www.', 'w.w.w', '..w..'],
};

export function seasonIcon(g: CanvasRenderingContext2D, season: keyof typeof SEASON_ICON, x: number, y: number) {
  const key = `season-${season}`;
  let s = cache.get(key);
  if (!s) {
    s = spr(SEASON_ICON[season], 0, 0);
    cache.set(key, s);
  }
  drawSpr(g, s, Math.round(x), Math.round(y));
}

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
