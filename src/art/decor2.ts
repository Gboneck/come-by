import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { gust } from '../render/wind';

// Decor the player places in build mode. (x, y) is the ground point at the
// middle of the piece's footprint, as for the ranch's own decor.

export type PieceId = 'flowerbed' | 'hay' | 'bench' | 'signpost' | 'dogbed' | 'scarecrow' | 'birdbath' | 'ribbons' | 'trophy';

export interface PieceInfo {
  ribbons?: [number, number, number]; // for the ribbon board
}

export function drawPiece(g: CanvasRenderingContext2D, id: PieceId, x: number, y: number, t: number, info: PieceInfo = {}) {
  x = Math.round(x);
  y = Math.round(y);
  switch (id) {
    case 'flowerbed': {
      // A low bed edged in plum, leaves and heads that nod in a gust.
      rect(g, x - 7, y - 3, 15, 5, C.plum);
      rect(g, x - 6, y - 2, 13, 3, C.moss);
      for (let i = 0; i < 6; i++) {
        const fx = x - 5 + i * 2 + (i & 1), fy = y - 2 + (i % 2);
        const lean = gust(fx, fy, t) > 0.5 ? 1 : 0;
        px(g, fx, fy, C.sage);
        px(g, fx + lean, fy - 1, i % 3 === 1 ? C.wool : C.butter);
      }
      break;
    }
    case 'hay': {
      // A round bale lying on its side, twine round the middle.
      rect(g, x - 5, y + 1, 10, 1, C.sage);
      rect(g, x - 4, y - 6, 8, 7, C.butter);
      rect(g, x - 5, y - 5, 10, 5, C.butter);
      rect(g, x - 2, y - 4, 4, 3, C.moss);
      px(g, x - 1, y - 3, C.butter);
      for (let i = 0; i < 4; i++) px(g, x - 4 + i * 3, y - 6 + (i & 1), C.wool);
      rect(g, x - 5, y - 1, 10, 1, C.moss);
      break;
    }
    case 'bench': {
      rect(g, x - 7, y + 1, 14, 1, C.sage);
      rect(g, x - 6, y - 3, 12, 2, C.teal);
      rect(g, x - 6, y - 3, 12, 1, C.sage);
      rect(g, x - 6, y - 7, 12, 2, C.teal);
      rect(g, x - 6, y - 7, 12, 1, C.sage);
      for (const lx of [x - 6, x + 5]) {
        rect(g, lx, y - 7, 1, 8, C.plum);
      }
      rect(g, x - 6, y - 1, 12, 1, C.plum);
      break;
    }
    case 'signpost': {
      // Two arms, pointing the ways the stock goes.
      rect(g, x - 1, y + 1, 3, 1, C.sage);
      rect(g, x, y - 13, 1, 14, C.plum);
      rect(g, x + 1, y - 12, 6, 3, C.wool);
      px(g, x + 7, y - 11, C.wool);
      rect(g, x + 2, y - 11, 4, 1, C.sage);
      rect(g, x - 6, y - 8, 6, 3, C.wool);
      px(g, x - 7, y - 7, C.wool);
      rect(g, x - 5, y - 7, 4, 1, C.sage);
      px(g, x, y - 14, C.butter);
      break;
    }
    case 'dogbed': {
      // A round cushion with a raised rim: the heeler's own spot.
      rect(g, x - 6, y - 3, 12, 5, C.plum);
      rect(g, x - 5, y - 4, 10, 7, C.plum);
      rect(g, x - 4, y - 2, 8, 3, C.wool);
      rect(g, x - 5, y - 3, 10, 1, C.teal);
      px(g, x - 2, y - 1, C.sage);
      px(g, x + 2, y, C.sage);
      break;
    }
    case 'scarecrow': {
      const lean = gust(x, y, t) > 0.6 ? 1 : 0;
      rect(g, x - 2, y + 1, 5, 1, C.sage);
      rect(g, x, y - 12, 1, 13, C.plum);
      rect(g, x - 6, y - 11, 13, 1, C.plum); // the cross-arm
      rect(g, x - 3, y - 11, 7, 6, C.teal); // coat
      rect(g, x - 3, y - 7, 7, 1, C.sage);
      px(g, x - 6 - lean, y - 10, C.butter); // straw at the cuffs
      px(g, x + 6 + lean, y - 10, C.butter);
      rect(g, x - 2, y - 16, 5, 4, C.wool); // sack head
      px(g, x - 1, y - 15, C.plum);
      px(g, x + 1, y - 15, C.plum);
      rect(g, x - 4, y - 17, 9, 1, C.butter); // hat brim
      rect(g, x - 2, y - 19, 5, 2, C.butter);
      px(g, x + lean, y - 20, C.moss);
      break;
    }
    case 'birdbath': {
      rect(g, x - 4, y + 1, 9, 1, C.sage);
      rect(g, x - 1, y - 5, 3, 6, C.wool);
      rect(g, x - 2, y, 5, 1, C.wool);
      rect(g, x - 5, y - 7, 11, 2, C.wool);
      rect(g, x - 4, y - 7, 9, 1, C.teal);
      px(g, x + 2, y - 7, C.wool);
      // Now and then a little bird drops in.
      if (Math.floor(t / 3) % 3 === 0) {
        px(g, x - 3, y - 9, C.plum);
        px(g, x - 2, y - 9, C.plum);
        px(g, x - 1, y - 8, C.plum);
      }
      break;
    }
    case 'ribbons': {
      // A board with the rosettes you have won: buttercup firsts, wool
      // seconds, teal thirds.
      rect(g, x - 1, y + 1, 3, 1, C.sage);
      rect(g, x - 1, y - 6, 1, 7, C.plum);
      rect(g, x + 1, y - 6, 1, 7, C.plum);
      rect(g, x - 6, y - 15, 13, 10, C.plum);
      rect(g, x - 5, y - 14, 11, 8, C.sage);
      const [a, b, c] = info.ribbons ?? [0, 0, 0];
      const cols = [...Array(Math.min(3, a)).fill(C.butter), ...Array(Math.min(3, b)).fill(C.wool), ...Array(Math.min(3, c)).fill(C.teal)].slice(0, 6);
      cols.forEach((col, i) => {
        const rx = x - 4 + (i % 3) * 4, ry = y - 13 + Math.floor(i / 3) * 4;
        rect(g, rx, ry, 2, 2, col);
        px(g, rx, ry + 2, C.plum);
        px(g, rx + 1, ry + 2, col);
      });
      break;
    }
    case 'trophy': {
      // The class cup on a stone plinth, catching the light.
      rect(g, x - 4, y + 1, 9, 1, C.sage);
      rect(g, x - 3, y - 5, 7, 6, C.wool);
      rect(g, x - 3, y - 5, 1, 6, C.sage);
      rect(g, x - 4, y - 6, 9, 1, C.wool);
      rect(g, x - 1, y - 8, 3, 2, C.butter);
      rect(g, x - 3, y - 13, 7, 5, C.butter);
      px(g, x - 4, y - 12, C.butter);
      px(g, x + 4, y - 12, C.butter);
      px(g, x - 4, y - 11, C.butter);
      px(g, x + 4, y - 11, C.butter);
      line(g, x - 2, y - 12, x - 2, y - 10, C.wool);
      if (Math.floor(t * 2) % 5 === 0) px(g, x + 2, y - 13, C.wool);
      break;
    }
  }
}
