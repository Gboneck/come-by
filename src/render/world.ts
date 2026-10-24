import { C } from '../palette';
import { ring } from '../gfx/draw';
import type { Game } from '../game';
import { drawAnimal, drawAnimalShadow } from '../entities/animal';
import { Farmhouse, Pen, RegionGate } from '../ranch/buildings';
import { farmhouseDrawable, penDrawables, regionGateDrawables, type Drawable } from '../art/buildings';
import type { Light } from './night';

export interface View {
  ox: number;
  oy: number;
  W: number;
  H: number;
}

export function drawWorld(game: Game, g: CanvasRenderingContext2D, v: View) {
  const { ox, oy, W, H } = v;
  const night = game.day.darkness() > 0.3;
  g.drawImage(game.baked.ground, ox, oy, W, H, 0, 0, W, H);

  g.save();
  g.translate(-ox, -oy);
  const inView = (x0: number, y0: number, x1 = x0, y1 = y0, m = 24) => x1 > ox - m && x0 < ox + W + m && y1 > oy - m && y0 < oy + H + m;

  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) drawAnimalShadow(g, a);
  game.dog.drawShadow(g);
  game.fx.drawLow(g);

  // Lying down lets you read the flock: its flight zone shows faintly.
  if (game.dog.lying) {
    const gr = game.nearestGroup(160);
    if (gr) {
      let rad = 0;
      for (const a of gr.members) rad = Math.max(rad, Math.hypot(a.x - gr.x, a.y - gr.y));
      const sp = gr.members[0].sp;
      ring(g, gr.x, gr.y, rad + sp.flight * (1 + 0.6 * gr.stress) * 0.85, C.sage, 6);
    }
  }
  if (game.showZones) {
    for (const a of game.animals) if (inView(a.x, a.y)) ring(g, a.x, a.y, a.sp.flight * (1 + 0.6 * a.stress), C.plum, 8);
  }

  const ents: Drawable[] = [];
  for (const b of game.ranch.buildings) {
    if (!inView(b.x0, b.y0 - 24, b.x1, b.y1, 8)) continue;
    if (b instanceof Pen) {
      const near = Math.hypot(game.dog.x - b.cx, game.dog.y - b.cy) < 120;
      ents.push(...penDrawables(g, b, game.t, near));
    } else if (b instanceof Farmhouse) ents.push(farmhouseDrawable(g, b, night));
    else if (b instanceof RegionGate) ents.push(...regionGateDrawables(g, b, game.t));
  }
  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) ents.push({ y: a.y, draw: () => drawAnimal(g, a, game.t) });
  ents.push({ y: game.dog.y, draw: () => game.dog.draw(g) });
  ents.sort((p, q) => p.y - q.y);
  for (const e of ents) e.draw();
  g.restore();

  g.drawImage(game.baked.canopy, ox, oy, W, H, 0, 0, W, H);

  g.save();
  g.translate(-ox, -oy);
  drawStamina(game, g);
  game.fx.drawHigh(g);
  g.restore();

  // Dusk and night.
  const dark = game.day.darkness();
  if (dark > 0) {
    const lights: Light[] = [{ x: game.dog.x - ox, y: game.dog.y - oy, r: 34 }];
    const f = game.ranch.farmhouse;
    if (f) lights.push({ x: f.cx - ox, y: f.y1 - 6 - oy, r: 56 });
    game.night.draw(g, W, H, ox, oy, dark, lights);
  }
}

// A small bar beside the dog, only while stamina is not full.
function drawStamina(game: Game, g: CanvasRenderingContext2D) {
  const d = game.dog;
  if (d.stamina >= d.stats.stamina - 0.01) return;
  const h = 10;
  const x = Math.round(d.x + 8), y = Math.round(d.y - 12);
  g.fillStyle = C.plum;
  g.fillRect(x - 1, y - 1, 4, h + 2);
  const f = Math.round((d.stamina / d.stats.stamina) * h);
  const blink = d.exhausted && Math.floor(game.t * 6) % 2 === 0;
  g.fillStyle = blink ? C.moss : C.butter;
  g.fillRect(x, y + h - f, 2, f);
}
