import { C } from '../palette';
import { ellipse, ring } from '../gfx/draw';
import type { Game } from '../game';
import { drawAnimal, drawAnimalMarks, drawAnimalShadow } from './animals';
import { Building, Farmhouse, Pen, RegionGate } from '../ranch/buildings';
import { Barn, FieldGate, Fence, Haystack, Kennel, Market, Windmill } from '../ranch/structures';
import { haystackDrawable } from '../art/hay';
import { farmhouseWindows, windowGlow, barnDrawable, farmhouseDrawable, fenceDrawables, fieldGateDrawables, kennelDrawable, marketDrawable, penDrawables, regionGateDrawables, windmillDrawable, type Drawable } from '../art/buildings';
import type { Light } from './night';
import { DECOR, decorDrawable, decorLights, drawLampGlow } from '../ranch/decor';
import { blueHour, goldenHour, skyDarkness, skySlope, sunShadow } from './sky';
import { drawShafts } from './light';
import { quality } from '../gfx/quality';
import { tierOf } from '../systems/progression';
import { TS } from '../world/map';
import { drawSway, drawWater } from './sway';
import { lightLook, setSeasonLook } from '../art/seasonlook';
import { idlePose } from './dogidle';
import { playerDogSprites } from '../art/dogstyle';
import { drawSpr } from '../gfx/sprite';
import { yardFire } from '../art/course';
import { drawSleepingDog, drawSnores } from '../art/dog';
import { cached, picturesFrame } from '../gfx/picture';

// The player's dog: asleep while resting, its idles (sniff, scratch, the
// shake-off) when left standing, otherwise its own pose.
function drawPlayerDog(game: Game, g: CanvasRenderingContext2D) {
  const d = game.dog;
  if (sleeping(game)) return drawSleepingDog(g, d.x, d.y, d.face === 'l', game.t);
  const ip = idlePose(d, d.skin ?? playerDogSprites(), game.t, game.weather.rain > 0.3 && game.season.snow < 0.4, (x, y) => game.life.spray(x, y));
  if (ip) drawSpr(g, ip.s, d.x + ip.dx, d.y + 2, ip.flip);
  else d.draw(g);
}

// Sideways shift of moving things' shadows with the sun.
function sunShift(game: Game): number {
  if (game.day.phase === 'night') return 0;
  return Math.max(-3, Math.min(3, Math.round(sunShadow(game.day).dx / 3)));
}

// Resting: the dog curls up asleep while the day runs fast.
const sleeping = (game: Game) => game.dog.lying && game.rest > 1.3;
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
  picturesFrame();
  // The season: recoloured layers (rebuilt only when a step changes) and
  // the look that roofs, fences and decor read as they draw.
  setSeasonLook(game.season);
  game.life.seasons.sync(game.baked, game.season);
  // The ground with the trees' shadows thrown by the sun (none at night);
  // buildings read the same light as they draw.
  const sh = sunShadow(game.day);
  lightLook.dx = sh.dx;
  lightLook.dy = sh.dy;
  lightLook.golden = goldenHour(game.day);
  const ground = game.life.lit.picture(game.baked, game.life.seasons.ground ?? game.baked.ground, sh.dx, sh.dy, game.day.phase !== 'night');
  g.drawImage(ground, ox, oy, W, H, 0, 0, W, H);
  game.life.wx.drawGroundShade(g, game, ox, oy, W, H, skyDarkness(game.day));
  drawWater(g, game.baked.water, ox, oy, W, H, game.life.vt);

  g.save();
  g.translate(-ox, -oy);
  drawSway(g, game.baked.sway, ox, oy, W, H, game.life.vt);
  game.life.wx.drawGround(g, game);
  const inView = (x0: number, y0: number, x1 = x0, y1 = y0, m = 24) => x1 > ox - m && x0 < ox + W + m && y1 > oy - m && y0 < oy + H + m;

  // Shadows of things that move swing with the sun: west in the morning,
  // east by evening (a time-lapse while resting shows them sweep round).
  const sun = sunShift(game);
  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) drawAnimalShadow(g, a, sun);
  for (const d of [game.dog, ...game.helpers, ...game.coop]) if (inView(d.x, d.y)) ellipse(g, d.x - 1 + sun, d.y + 2, d.face === 'l' || d.face === 'r' ? 5 : 3, 1, C.sage);
  for (const p of game.predators) if (inView(p.x, p.y)) p.drawShadow(g);
  game.folk.drawShadows(g);
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
    ents.push(...cached(g, `b${b.id}`, (cg) => buildingDrawables(cg, b, game.t, night, near)));
  }
  const tierName = game.look.ranch || tierOf(game.tier).name; // the ranch sign
  ents.push(...game.extraDrawables(g));
  for (const d of DECOR) {
    if (d.tier > game.tier || !inView(d.x * TS, d.y * TS, (d.x + (d.w ?? 1)) * TS, (d.y + (d.h ?? 1)) * TS, 40)) continue;
    if (game.ranch.buildings.some((b) => b.kind !== 'regiongate' && b.overlapsTiles(d.x, d.y, d.w ?? 1, d.h ?? 1))) continue;
    ents.push(...cached(g, `d${d.x},${d.y}`, (cg) => [decorDrawable(cg, d, game.t, tierName, night)]));
  }
  for (const a of game.animals) if (!a.gone && inView(a.x, a.y)) ents.push({ y: a.y, draw: () => drawAnimal(g, a, game.t, night) });
  ents.push({ y: game.dog.y, draw: () => drawPlayerDog(game, g) });
  for (const p of game.predators) if (p.active && inView(p.x, p.y)) ents.push({ y: p.y, draw: () => p.draw(g) });
  for (const h of game.helpers) if (inView(h.x, h.y)) ents.push({ y: h.y, draw: () => h.draw(g) });
  // Co-op friends' dogs, curled up too while everyone rests.
  for (const o of game.coop) if (inView(o.x, o.y)) ents.push({ y: o.y, draw: () => (o.lying && game.rest > 1.3 ? drawSleepingDog(g, o.x, o.y, o.face === 'l', game.t, true) : o.draw(g)) });
  ents.push(...game.folk.drawables(g, (x, y) => inView(x, y)));
  ents.sort((p, q) => p.y - q.y);
  for (const e of ents) e.draw();
  if (game.mode === 'build') game.build.drawWorld(game, g);
  g.restore();

  g.drawImage(game.life.seasons.canopy ?? game.baked.canopy, ox, oy, W, H, 0, 0, W, H);
  // Low sun slanting through the treetops (light comes against the shadow).
  if (quality.fx >= 1 && game.weather.rain < 0.2 && game.weather.fog < 0.4) drawShafts(g, game.baked, ox, oy, W, H, sh.dx, sh.dy, lightLook.golden * 1.4, game.life.vt);

  g.save();
  g.translate(-ox, -oy);
  game.life.drawAir(g);
  drawStamina(game, g);
  game.fx.drawHigh(g);
  g.restore();

  // Dawn, dusk and night, the weather's light, rain over everything. Lamps
  // and lanterns flicker a little.
  const dark = skyDarkness(game.day);
  const fogged = game.weather.fog > 0.03;
  const lights: Light[] = [];
  if (fogged && dark <= 0) lights.push({ x: game.dog.x - ox, y: game.dog.y - oy, r: 56 });
  if (dark > 0) {
    const fl = (i: number) => Math.sin(game.t * 7.3 + i * 2.1) * 0.8 + Math.sin(game.t * 13.1 + i) * 0.6;
    lights.push({ x: game.dog.x - ox, y: game.dog.y - oy, r: 44 });
    for (const h of game.helpers) lights.push({ x: h.x - ox, y: h.y - oy, r: 26 });
    for (const o of game.coop) lights.push({ x: o.x - ox, y: o.y - oy, r: 36 });
    lights.push(...game.folk.lights(ox, oy));
    const f = game.ranch.farmhouse;
    if (f) lights.push({ x: f.cx - ox, y: f.y1 + 2 - oy, r: 64 + fl(0) });
    decorLights(game.tier).forEach((l, i) => lights.push({ x: l.x - ox, y: l.y - oy, r: l.r + fl(i + 1), warm: true }));
    for (const b of game.ranch.buildings) if (b instanceof Barn) lights.push({ x: b.cx - ox, y: b.y1 + 2 - oy, r: (b.level >= 2 ? 70 : 60) + fl(b.id) });
    for (const y of game.ranch.yards) if (y.site.id === 'drover') { const f = yardFire(y.site); lights.push({ x: f.x - ox, y: f.y - oy, r: 30 + fl(7) * 2, warm: true }); }
  }
  // Morning mist, lying in drifts until the sun gets up (fair days only).
  const sk = game.life.wx.sky(game, dark);
  const f = game.day.frac, w = game.weather;
  if (quality.shade && game.day.phase === "day" && f < 0.12 && w.rain < 0.1) sk.fog = Math.max(sk.fog ?? 0, 0.18 * (1 - f / 0.12) * (1 - w.wind * 0.7));
  if ((sk.fog ?? 0) > 0.03 && dark <= 0 && !lights.length) lights.push({ x: game.dog.x - ox, y: game.dog.y - oy, r: 56 });
  game.night.draw(g, W, H, ox, oy, { dark, lights, slope: skySlope(game.day), blue: blueHour(game.day), ...sk });
  game.life.wx.drawAir(g, game, W, H, dark > 0.25);
  if (sleeping(game)) {
    g.save();
    g.translate(-ox, -oy);
    drawSnores(g, game.dog.x, game.dog.y, game.t);
    g.restore();
  }
  if (dark > 0) {
    // Above the dark: lamp glow, eyes, fireflies.
    g.save();
    g.translate(-ox, -oy);
    if (dark > 0.2) {
      drawLampGlow(g, game.tier, game.t);
      // The farmhouse windows glow out into the dark.
      const fh = game.ranch.farmhouse;
      if (fh && inView(fh.x0, fh.y0 - 20, fh.x1, fh.y1)) for (const [x, y, w, h] of farmhouseWindows(fh)) windowGlow(g, x, y, w, h, game.t);
    }
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
  if (b instanceof Haystack) return [haystackDrawable(g, b)];
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
