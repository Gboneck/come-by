import { C } from './palette';
import { rect } from './gfx/draw';
import { drawSpr, type Sprite } from './gfx/sprite';
import { text } from './gfx/font';
import { makeDogSprites } from './art/dog';
import { animalSprites, type Coat } from './art/animals';
import { SPECIES_ORDER, SPECIES } from './entities/species';
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
    game.mode = 'play';
    game.day.t = 20;
    game.day.phase = 'day';
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
    ...SPECIES_ORDER.flatMap((id) =>
      Array.from({ length: SPECIES[id].coats }, (_, c) => {
        const s = animalSprites(id, c as Coat);
        return { label: `${id.toUpperCase()} ${c}`, sprites: [...s.side, s.graze, ...s.down, ...s.up] };
      }),
    ),
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
  const skip = Number(new URLSearchParams(location.search).get('sprites') || 0);
  for (const row of sheet.slice(skip)) {
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
