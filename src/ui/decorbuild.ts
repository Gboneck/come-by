import type { Game } from '../game';
import type { Drawable } from '../art/buildings';
import { drawPiece, type PieceId } from '../art/decor2';
import { makeCanvas } from '../gfx/screen';
import { fromCanvas, type Sprite } from '../gfx/sprite';
import { DECOR } from '../ranch/decor';
import { TS } from '../world/map';
import { GIFT_PIECES } from '../art/favour';

// Decor the player places in build mode's DECOR tab. Purely for looks: it
// never blocks the stock or the dog, so it cannot spoil a drive. Some pieces
// open with the tiers, some are earned at the trials.

export interface Piece {
  id: PieceId;
  name: string;
  cost: number;
  w: number;
  h: number;
  desc: string;
  flat?: boolean; // lies on the ground: everything walks over it
  open: (g: Game) => boolean;
  lock: string; // what opens it
}

const ribbons = (g: Game) => g.totals.ribbons.reduce((s, n) => s + n, 0);
const kennel = (g: Game) => g.ranch.buildings.some((b) => b.kind === 'kennel');

export const PIECES: Piece[] = [
  { id: 'flowerbed', name: 'FLOWER BED', cost: 3, w: 2, h: 1, flat: true, desc: 'BUTTERCUPS AND DAISIES.', open: () => true, lock: '' },
  { id: 'hay', name: 'HAY BALE', cost: 2, w: 1, h: 1, desc: "A ROUND BALE OF LAST SUMMER'S HAY.", open: () => true, lock: '' },
  { id: 'dogbed', name: 'DOG BED', cost: 5, w: 1, h: 1, desc: 'A COZY SPOT OF ITS OWN.', open: kennel, lock: 'BUILD A KENNEL FIRST' },
  { id: 'bench', name: 'BENCH', cost: 6, w: 2, h: 1, desc: 'SOMEWHERE TO WATCH THE FLOCK.', open: (g) => g.tier >= 2, lock: 'OPENS AT TIER 2' },
  { id: 'signpost', name: 'SIGNPOST', cost: 4, w: 1, h: 1, desc: 'THIS WAY TO THE PASTURES.', open: (g) => g.tier >= 2, lock: 'OPENS AT TIER 2' },
  { id: 'birdbath', name: 'BIRDBATH', cost: 7, w: 1, h: 1, desc: 'NOW AND THEN A BIRD DROPS IN.', open: (g) => g.tier >= 3, lock: 'OPENS AT TIER 3' },
  { id: 'scarecrow', name: 'SCARECROW', cost: 10, w: 1, h: 1, desc: 'KEEPS THE CROWS GUESSING.', open: (g) => g.tier >= 3, lock: 'OPENS AT TIER 3' },
  { id: 'ribbons', name: 'RIBBON BOARD', cost: 8, w: 1, h: 1, desc: 'SHOWS THE RIBBONS YOU HAVE WON.', open: (g) => ribbons(g) > 0, lock: 'WIN A RIBBON AT THE TRIALS' },
  { id: 'trophy', name: 'TROPHY', cost: 20, w: 1, h: 1, desc: 'THE CUP, FOR WINNING A CLASS.', open: (g) => g.trials.won.length > 0, lock: 'WIN A CLASS AT THE TRIALS' },
  ...GIFT_PIECES, // buyers' gifts, free once given (art/favour.ts)
];

export const pieceOf = (id: PieceId) => PIECES.find((p) => p.id === id)!;

export interface PlacedDecor {
  id: PieceId;
  tx: number;
  ty: number;
}

const covers = (d: PlacedDecor, tx: number, ty: number) => {
  const p = pieceOf(d.id);
  return tx >= d.tx && tx < d.tx + p.w && ty >= d.ty && ty < d.ty + p.h;
};

export function decorAt(game: Game, tx: number, ty: number): PlacedDecor | null {
  return game.decor.find((d) => covers(d, tx, ty)) ?? null;
}

// Why this piece cannot go here, or null if it can. `land` is build mode's
// "is this ranch land" test.
export function decorBlocked(game: Game, p: Piece, tx: number, ty: number, land: (x: number, y: number) => boolean): string | null {
  if (!p.open(game)) return p.lock;
  for (let y = ty; y < ty + p.h; y++)
    for (let x = tx; x < tx + p.w; x++) {
      if (!land(x, y)) return 'NOT ON RANCH LAND';
      if (decorAt(game, x, y)) return 'SOMETHING IS IN THE WAY';
      // The ranch's own touches (sign, well, lanterns) keep their spots.
      if (DECOR.some((d) => d.tier <= game.tier && x >= d.x && x < d.x + (d.w ?? 1) && y >= d.y && y < d.y + (d.h ?? 1))) return 'SOMETHING IS IN THE WAY';
    }
  if (game.ranch.buildings.some((b) => b.kind !== 'regiongate' && b.overlapsTiles(tx, ty, p.w, p.h))) return 'SOMETHING IS IN THE WAY';
  if (game.coins < p.cost) return `NEED ${p.cost}$`;
  return null;
}

// Building over decor clears it away (and gives back what it cost).
export function clearDecorUnder(game: Game, tx: number, ty: number, w: number, h: number) {
  const keep: PlacedDecor[] = [];
  for (const d of game.decor) {
    const p = pieceOf(d.id);
    const hit = d.tx < tx + w && d.tx + p.w > tx && d.ty < ty + h && d.ty + p.h > ty;
    if (hit) game.coins += p.cost;
    else keep.push(d);
  }
  game.decor = keep;
}

export function pieceDrawable(game: Game, g: CanvasRenderingContext2D, p: Piece, tx: number, ty: number): Drawable {
  const x = (tx + p.w / 2) * TS, y = (ty + p.h) * TS - 2;
  return { y: p.flat ? -1e8 : y, draw: () => drawPiece(g, p.id, x, y, game.t, { ribbons: game.totals.ribbons }) };
}

// For the y-sorted world layer.
export function decorDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  return game.decor.map((d) => pieceDrawable(game, g, pieceOf(d.id), d.tx, d.ty));
}

// A small picture of each piece for the build bar.
const icons = new Map<PieceId, Sprite>();
export function pieceIcon(id: PieceId): Sprite {
  let s = icons.get(id);
  if (!s) {
    const [c, g] = makeCanvas(20, 24);
    drawPiece(g, id, 10, 21, 0, { ribbons: [2, 1, 1] });
    // Trim to what was drawn, so every icon sits square in its slot.
    const px = g.getImageData(0, 0, 20, 24).data;
    let x0 = 20, y0 = 24, x1 = -1, y1 = -1;
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 20; x++)
        if (px[(y * 20 + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const [t, tg] = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
    tg.drawImage(c, -x0, -y0);
    s = fromCanvas(t, 0, 0);
    icons.set(id, s);
  }
  return s;
}
