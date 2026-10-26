import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
import { grid } from './fine';
import { gust } from '../render/wind';
import { drawGift, type GiftId } from './favour';

// Decor the player places in build mode. (x, y) is the ground point at the
// middle of the piece's footprint, as for the ranch's own decor.

export type PieceId = 'flowerbed' | 'hay' | 'bench' | 'signpost' | 'dogbed' | 'scarecrow' | 'birdbath' | 'ribbons' | 'trophy' | GiftId;

export interface PieceInfo {
  ribbons?: [number, number, number]; // for the ribbon board
}

// Drawn on the fine grid (two fine pixels to a world pixel).
const ROUND_BALE = ['...yyyyyy...', '.yywyyyyyyy.', 'yyyyyyyyyyyy', 'yyyoooooyyyy', 'yyoyyyyyoyyy', 'yyoyywyyoyyy', 'yyoyyyyyoyyy', 'yyyoooooyyyy', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', 'oooooooooooo'];
const SIGN_ARMS = ['....p.......', '....pwwwwwww.', '....pwsssswww', '....pwwwwwww.', '....p.......', '.wwwwwwp....', 'wwwssssp....', '.wwwwwwp....', '....p.......'];
const SCARECROW = ['...yyyyy...', '.yyyyyyyyy.', '...wwwww...', '...wpwpw...', '...wwwww...', '....www....', 'pppptttpppp', 'y..ttttt..y', '...ttstt...', '...ttttt...', '...sssss...', '...ttttt...', '.....p.....', '.....p.....'];
const DOGBED = ['..pppppppp..', '.pttttttttp.', 'pttwwwwwwttp', 'ptwwwswwwwtp', 'ptwwwwwwswtp', 'pttwwwwwwttp', '.pppppppppp.'];
const TROPHY = ['.y.yyyyy.y.', '.yywyyyyyy.', '..ywyyyyy..', '...yyyyy...', '....yyy....', '.....y.....', '...wwwww...', '..wwwwwww..', '..swwwwww..', '..swwwwww..', '..swwwwww..', '..sssssss..'];

export function drawPiece(g: CanvasRenderingContext2D, id: PieceId, x: number, y: number, t: number, info: PieceInfo = {}) {
  x = Math.round(x);
  y = Math.round(y);
  if (id !== 'flowerbed' && id !== 'hay' && id !== 'bench' && id !== 'signpost' && id !== 'dogbed' && id !== 'scarecrow' && id !== 'birdbath' && id !== 'ribbons' && id !== 'trophy') {
    drawGift(g, id, x, y, t); // buyers' gifts (art/favour.ts)
    return;
  }
  fine(g, (fg) => {
    const X = x * PX, B = y * PX + 1;
    switch (id) {
      case 'flowerbed': {
        // A low bed edged in plum, leaves and heads that nod in a gust.
        rect(fg, X - 14, B - 6, 30, 9, C.plum);
        rect(fg, X - 12, B - 4, 26, 5, C.sage);
        rect(fg, X - 12, B - 4, 26, 1, C.moss);
        for (let i = 0; i < 7; i++) {
          const fx = X - 10 + i * 4, fy = B - 4 + (i % 2);
          const lean = gust(fx >> 1, fy >> 1, t) > 0.5 ? 1 : 0;
          rect(fg, fx, fy - 3, 1, 4, C.moss);
          px(fg, fx + 1, fy - 1, C.moss);
          const col = i % 3 === 1 ? C.wool : C.butter;
          rect(fg, fx - 1 + lean, fy - 5, 3, 1, col);
          rect(fg, fx + lean, fy - 6, 1, 3, col);
          px(fg, fx + lean, fy - 5, col === C.wool ? C.butter : C.moss);
        }
        break;
      }
      case 'hay':
        // A round bale lying on its side, its rolled face showing.
        rect(fg, X - 10, B + 1, 20, 1, C.sage);
        grid(fg, ROUND_BALE, X - 6, B - 10);
        for (const [wx, wy] of [[-9, -1], [8, 0], [-3, 2]]) { px(fg, X + wx, B + wy, C.butter); px(fg, X + wx + 1, B + wy - 1, C.butter); }
        break;
      case 'bench':
        rect(fg, X - 14, B + 1, 28, 1, C.sage);
        for (const yy of [B - 6, B - 14]) { rect(fg, X - 12, yy, 24, 3, C.teal); rect(fg, X - 12, yy, 24, 1, C.sage); }
        for (const lx of [X - 12, X + 10]) { rect(fg, lx, B - 14, 2, 15, C.plum); px(fg, lx + 1, B - 12, C.sage); }
        rect(fg, X - 12, B - 3, 24, 1, C.plum);
        break;
      case 'signpost':
        // Two arms, pointing the ways the stock goes.
        rect(fg, X - 2, B + 1, 6, 1, C.sage);
        rect(fg, X, B - 26, 2, 27, C.plum);
        rect(fg, X + 1, B - 26, 1, 27, C.sage);
        grid(fg, SIGN_ARMS, X - 4, B - 25);
        rect(fg, X - 1, B - 28, 4, 2, C.butter);
        break;
      case 'dogbed':
        // A round cushion with a raised rim: the heeler's own spot.
        grid(fg, DOGBED, X - 6, B - 7);
        rect(fg, X - 6, B, 12, 1, C.sage);
        break;
      case 'scarecrow': {
        const lean = gust(x, y, t) > 0.6 ? 1 : 0;
        rect(fg, X - 4, B + 1, 10, 1, C.sage);
        rect(fg, X, B - 24, 2, 25, C.plum);
        grid(fg, SCARECROW, X - 5 + lean, B - 40);
        px(fg, X - 6 - lean, B - 33, C.butter);
        px(fg, X + 6 + lean, B - 33, C.butter);
        px(fg, X + lean, B - 41, C.moss);
        break;
      }
      case 'birdbath':
        rect(fg, X - 8, B + 1, 18, 1, C.sage);
        rect(fg, X - 2, B - 10, 5, 11, C.wool);
        rect(fg, X - 2, B - 10, 1, 11, C.sage);
        rect(fg, X - 4, B - 1, 9, 2, C.wool);
        rect(fg, X - 10, B - 14, 22, 4, C.wool);
        rect(fg, X - 10, B - 11, 22, 1, C.sage);
        rect(fg, X - 8, B - 14, 18, 2, C.teal);
        rect(fg, X + 4, B - 14, 3, 1, C.wool);
        // Now and then a little bird drops in.
        if (Math.floor(t / 3) % 3 === 0) {
          rect(fg, X - 7, B - 18, 4, 2, C.plum);
          px(fg, X - 8, B - 19, C.plum);
          px(fg, X - 9, B - 19, C.butter);
          rect(fg, X - 4, B - 17, 2, 1, C.plum);
          px(fg, X - 6, B - 16, C.butter);
        }
        break;
      case 'ribbons': {
        // A board with the rosettes you have won: buttercup firsts, wool
        // seconds, teal thirds.
        rect(fg, X - 2, B + 1, 6, 1, C.sage);
        for (const px0 of [X - 3, X + 2]) rect(fg, px0, B - 12, 2, 13, C.plum);
        rect(fg, X - 12, B - 30, 26, 20, C.plum);
        rect(fg, X - 10, B - 28, 22, 16, C.sage);
        for (let i = X - 9; i < X + 11; i += 4) px(fg, i, B - 27, C.moss);
        const [a, b, c] = info.ribbons ?? [0, 0, 0];
        const cols = [...Array(Math.min(3, a)).fill(C.butter), ...Array(Math.min(3, b)).fill(C.wool), ...Array(Math.min(3, c)).fill(C.teal)].slice(0, 6);
        cols.forEach((col, i) => {
          const rx = X - 8 + (i % 3) * 8, ry = B - 26 + Math.floor(i / 3) * 8;
          rect(fg, rx, ry, 4, 4, col);
          px(fg, rx + 1, ry + 1, C.plum);
          rect(fg, rx, ry + 4, 1, 2, col);
          rect(fg, rx + 3, ry + 4, 1, 2, col);
        });
        break;
      }
      case 'trophy':
        // The class cup on a stone plinth, catching the light.
        rect(fg, X - 8, B + 1, 18, 1, C.sage);
        grid(fg, TROPHY, X - 5, B - 11);
        if (Math.floor(t * 2) % 5 === 0) { px(fg, X + 3, B - 12, C.wool); px(fg, X + 4, B - 13, C.wool); }
        break;
    }
  });
}
