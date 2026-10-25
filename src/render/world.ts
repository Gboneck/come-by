import { C } from '../palette';
import { ring } from '../gfx/draw';
import type { Game } from '../game';
import { drawAnimal, drawAnimalMarks, drawAnimalShadow } from './animals';
import { Building, Farmhouse, Pen, RegionGate } from '../ranch/buildings';
import { Barn, FieldGate, Fence, Kennel, Market, Windmill } from '../ranch/structures';
import { barnDrawable, farmhouseDrawable, fenceDrawables, fieldGateDrawables, kennelDrawable, marketDrawable, penDrawables, regionGateDrawables, windmillDrawable, type Drawable } from '../art/buildings';
import type { Light } from './night';
import { DECOR, decorDrawable, decorLights, drawLampGlow } from '../ranch/decor';
import { skyDarkness, skySlope } from './sky';
import { tierOf } from '../systems/progression';
import { TS } from '../world/map';
import { drawSway, drawWater } from './sway';
import { settings } from '../ui/settings';

export interface View {
  ox: number;
  oy: number;
  W: number;
  H: number;
}

export function drawWorld(game: Game, g: CanvasRenderingContext2D, v: View) {
  const { ox, oy, W, H } = v;
  const night = skyDarkness(game.day) > 0.3;
  g.drawImage(game.baked.ground, ox, oy, W, H, 0, 0, W, H);
  drawWater(g, game.baked.water, ox, oy, W, H, game.t);

  g.save();
  g.translate(-ox, -oy);
  drawSway(g, game.baked.sway, ox, oy, W, H, game.t);
  const inView = (x0: number, y0: number, x1 = x0, y1 = y0, m = 24) => x1 > ox - m && x0 < ox + W + m && y1 > oy - m && y0 < oy + H + m;

  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) drawAnimalShadow(g, a);
  game.dog.drawShadow(g);
  for (const p of game.predators) if (inView(p.x, p.y)) p.drawShadow(g);
  for (const h of game.helpers) if (inView(h.x, h.y)) h.drawShadow(g);
  game.fx.drawLow(g);
  game.life.drawGround(g);

  // Lying down lets you read the flock: its flight zone shows faintly
  // (always, if the player turned that on in the pause menu).
  if (game.dog.lying || settings.zones === 'always') {
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
    if (!inView(b.x0, b.y0 - 30, b.x1, b.y1, 8)) continue;
    const near = Math.hypot(game.dog.x - b.cx, game.dog.y - b.cy) < 120 || game.mode === 'build';
    ents.push(...buildingDrawables(g, b, game.t, night, near));
  }
  const tierName = game.look.ranch || tierOf(game.tier).name; // the ranch sign
  ents.push(...game.extraDrawables(g));
  for (const d of DECOR) {
    if (d.tier > game.tier || !inView(d.x * TS, d.y * TS, (d.x + (d.w ?? 1)) * TS, (d.y + (d.h ?? 1)) * TS, 40)) continue;
    if (game.ranch.buildings.some((b) => b.kind !== 'regiongate' && b.overlapsTiles(d.x, d.y, d.w ?? 1, d.h ?? 1))) continue;
    ents.push(decorDrawable(g, d, game.t, tierName, night));
  }
  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) ents.push({ y: a.y, draw: () => drawAnimal(g, a, game.t, night) });
  ents.push({ y: game.dog.y, draw: () => game.dog.draw(g) });
  for (const p of game.predators) if (p.active && inView(p.x, p.y)) ents.push({ y: p.y, draw: () => p.draw(g) });
  for (const h of game.helpers) if (inView(h.x, h.y)) ents.push({ y: h.y, draw: () => h.draw(g) });
  ents.sort((p, q) => p.y - q.y);
  for (const e of ents) e.draw();
  if (game.mode === 'build') game.build.drawWorld(game, g);
  g.restore();

  g.drawImage(game.baked.canopy, ox, oy, W, H, 0, 0, W, H);

  g.save();
  g.translate(-ox, -oy);
  game.life.drawAir(g);
  drawStamina(game, g);
  game.fx.drawHigh(g);
  g.restore();

  // Dawn, dusk and night. Lamps and lanterns flicker a little.
  const dark = skyDarkness(game.day);
  if (dark > 0) {
    const fl = (i: number) => Math.sin(game.t * 7.3 + i * 2.1) * 0.8 + Math.sin(game.t * 13.1 + i) * 0.6;
    const lights: Light[] = [{ x: game.dog.x - ox, y: game.dog.y - oy, r: 44 }];
    for (const h of game.helpers) lights.push({ x: h.x - ox, y: h.y - oy, r: 26 });
    const f = game.ranch.farmhouse;
    if (f) lights.push({ x: f.cx - ox, y: f.y1 + 2 - oy, r: 64 + fl(0) });
    decorLights(game.tier).forEach((l, i) => lights.push({ x: l.x - ox, y: l.y - oy, r: l.r + fl(i + 1) }));
    for (const b of game.ranch.buildings) if (b instanceof Barn) lights.push({ x: b.cx - ox, y: b.y1 + 2 - oy, r: (b.level >= 2 ? 70 : 60) + fl(b.id) });
    game.night.draw(g, W, H, ox, oy, dark, lights, skySlope(game.day));
    // Above the dark: lamp glow, eyes, fireflies.
    g.save();
    g.translate(-ox, -oy);
    if (dark > 0.2) drawLampGlow(g, game.tier, game.t);
    for (const p of game.predators) if (inView(p.x, p.y)) p.drawEyes(g, game.t);
    game.life.drawGlow(g);
    g.restore();
  }
  g.save();
  g.translate(-ox, -oy);
  for (const a of game.animals) if (inView(a.x, a.y)) drawAnimalMarks(g, a, game.t);
  g.restore();
}

export function buildingDrawables(g: CanvasRenderingContext2D, b: Building, t: number, night: boolean, sign = false): Drawable[] {
  if (b instanceof Pen) return penDrawables(g, b, t, sign);
  if (b instanceof Farmhouse) return farmhouseDrawable(g, b, night, t);
  if (b instanceof RegionGate) return regionGateDrawables(g, b, t);
  if (b instanceof Fence) return fenceDrawables(g, b);
  if (b instanceof FieldGate) return fieldGateDrawables(g, b);
  if (b instanceof Barn) return barnDrawable(g, b, night, t);
  if (b instanceof Kennel) return kennelDrawable(g, b);
  if (b instanceof Market) return marketDrawable(g, b);
  if (b instanceof Windmill) return windmillDrawable(g, b, t);
  return [];
}

// A small bar beside the dog, only while stamina is not full.
function drawStamina(game: Game, g: CanvasRenderingContext2D) {
  const d = game.dog;
  if (game.mode === 'title' || d.stamina >= d.stats.stamina - 0.01) return;
  const h = 10;
  const x = Math.round(d.x + 8), y = Math.round(d.y - 12);
  g.fillStyle = C.plum;
  g.fillRect(x - 1, y - 1, 4, h + 2);
  const f = Math.round((d.stamina / d.stats.stamina) * h);
  const blink = d.exhausted && Math.floor(game.t * 6) % 2 === 0;
  g.fillStyle = blink ? C.moss : C.butter;
  g.fillRect(x, y + h - f, 2, f);
}
