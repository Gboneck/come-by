import { C } from './palette';
import { rect } from './gfx/draw';
import { drawSpr, type Sprite } from './gfx/sprite';
import { text } from './gfx/font';
import { makeDogSprites } from './art/dog';
import type { Game } from './game';
import { runSim, type BotOpts } from './bot';
import type { SpeciesId } from './world/map';

declare global {
  interface Window {
    game?: Game;
    sim?: (o: BotOpts, seconds: number) => ReturnType<typeof runSim>;
    resetFlock?: (species: SpeciesId, x: number, y: number, n: number, dogX: number, dogY: number) => void;
  }
}

export function installDebug(game: Game) {
  game.debug = true;
  window.game = game;
  window.sim = (o, seconds) => runSim(game, o, seconds);
  window.resetFlock = (species, x, y, n, dogX, dogY) => {
    game.animals.length = 0;
    game.spawnFlock(species, x, y, n);
    game.dog.x = dogX;
    game.dog.y = dogY;
    game.dog.vx = game.dog.vy = 0;
    game.cam.x = dogX;
    game.cam.y = dogY;
  };
}

let sheet: { label: string; sprites: Sprite[] }[] | null = null;

function buildSheet() {
  const d = makeDogSprites('r');
  const h = makeDogSprites('y');
  return [
    { label: 'DOG SIDE', sprites: [d.sideStand, ...d.side, d.sideBark, d.sideLie] },
    { label: 'DOG GALLOP', sprites: d.gallop },
    { label: 'DOG DOWN', sprites: [d.downStand, ...d.down, d.downBark, d.downLie] },
    { label: 'DOG UP', sprites: [d.upStand, ...d.up, d.upLie] },
    { label: 'HELPER', sprites: [h.sideStand, h.downStand, h.upStand] },
  ];
}

export function registerSheetRow(label: string, sprites: Sprite[]) {
  sheet ??= buildSheet();
  sheet.push({ label, sprites });
}

// ?sprites: every sprite on a meadow background, plus an animated row.
export function drawSpriteSheet(g: CanvasRenderingContext2D, W: number, H: number, t: number) {
  sheet ??= buildSheet();
  rect(g, 0, 0, W, H, C.meadow);
  let y = 4;
  for (const row of sheet) {
    text(g, row.label, 3, y, C.plum);
    y += 8;
    let x = 4;
    let rowH = 0;
    for (const s of row.sprites) {
      drawSpr(g, s, x + s.ax, y + s.ay);
      x += s.w + 3;
      rowH = Math.max(rowH, s.h);
    }
    // Animated copy of the row at the end.
    if (row.sprites.length > 1) {
      const s = row.sprites[Math.floor(t * 8) % row.sprites.length];
      drawSpr(g, s, W - 20 + s.ax - s.w / 2, y + s.ay);
    }
    y += rowH + 5;
  }
}
