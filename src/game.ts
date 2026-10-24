import { C } from './palette';
import type { Screen } from './gfx/screen';
import { panel, rect } from './gfx/draw';
import { text, textWidth } from './gfx/font';
import type { Input } from './input';
import { UI } from './ui/ui';
import { drawTouchControls } from './ui/touch';
import { Particles } from './systems/particles';
import { Dog } from './entities/dog';
import { TS, WORLD_H, WORLD_W, WorldMap, type RegionDef } from './world/map';
import { bake, type Baked } from './world/terrain';
import { clamp, damp } from './util';

export class Game {
  g: CanvasRenderingContext2D;
  ui: UI;
  map: WorldMap;
  baked: Baked;
  dog: Dog;
  fx = new Particles();
  cam = { x: 0, y: 0 };
  t = 0;
  private banner: { text: string; t: number } | null = null;
  private lastRegion: RegionDef | null = null;
  debug = false;

  constructor(public screen: Screen, public input: Input) {
    this.g = screen.g;
    this.ui = new UI(input);
    this.map = new WorldMap();
    this.baked = bake(this.map);
    this.dog = new Dog(96 * TS + 4, 104 * TS + 4);
    this.cam.x = this.dog.x;
    this.cam.y = this.dog.y;
  }

  update(dt: number) {
    this.t += dt;
    this.dog.update(dt, this.input, this.map, this.fx);
    this.dog.events.length = 0;
    this.fx.update(dt);
    this.updateCamera(dt);

    const reg = this.map.regionAt(this.dog.x, this.dog.y);
    if (reg && reg !== this.lastRegion) {
      this.banner = { text: reg.name, t: 2.6 };
      this.lastRegion = reg;
    }
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
  }

  private updateCamera(dt: number) {
    const d = this.dog;
    const tx = d.x + d.vx * 0.35;
    const ty = d.y + d.vy * 0.35;
    const k = damp(4.5, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const { W, H } = this.screen;
    this.cam.x = clamp(this.cam.x, W / 2, WORLD_W - W / 2);
    this.cam.y = clamp(this.cam.y, H / 2, WORLD_H - H / 2);
  }

  // Debug: the whole world as one image (ground, entities, canopy).
  debugMapImage(): string {
    const c = document.createElement('canvas');
    c.width = WORLD_W;
    c.height = WORLD_H;
    const g = c.getContext('2d')!;
    g.drawImage(this.baked.ground, 0, 0);
    this.dog.draw(g);
    g.drawImage(this.baked.canopy, 0, 0);
    return c.toDataURL('image/png');
  }

  view() {
    const { W, H } = this.screen;
    return { ox: Math.round(this.cam.x - W / 2), oy: Math.round(this.cam.y - H / 2), W, H };
  }

  render() {
    const g = this.g;
    const { ox, oy, W, H } = this.view();
    g.drawImage(this.baked.ground, ox, oy, W, H, 0, 0, W, H);

    g.save();
    g.translate(-ox, -oy);
    this.fx.drawLow(g);
    this.dog.drawShadow(g);
    this.dog.draw(g);
    g.restore();

    g.drawImage(this.baked.canopy, ox, oy, W, H, 0, 0, W, H);

    g.save();
    g.translate(-ox, -oy);
    this.drawStamina(g);
    this.fx.drawHigh(g);
    g.restore();

    this.drawHud(g, W, H);
    this.input.uiHeld.clear();
    drawTouchControls(g, this.ui, this.input, W, H);
  }

  // A small bar beside the dog, only while stamina is not full.
  private drawStamina(g: CanvasRenderingContext2D) {
    const d = this.dog;
    if (d.stamina >= d.stats.stamina - 0.01) return;
    const h = 10;
    const x = Math.round(d.x + 8), y = Math.round(d.y - 12);
    rect(g, x - 1, y - 1, 4, h + 2, C.plum);
    const f = Math.round((d.stamina / d.stats.stamina) * h);
    const blink = d.exhausted && Math.floor(this.t * 6) % 2 === 0;
    rect(g, x, y + h - f, 2, f, blink ? C.moss : C.butter);
  }

  private drawHud(g: CanvasRenderingContext2D, W: number, _H: number) {
    if (this.banner) {
      const b = this.banner;
      const show = b.t > 2.3 ? Math.floor(b.t * 20) % 2 === 0 : true;
      if (show) {
        const tw = textWidth(b.text.toUpperCase());
        const x = Math.round(W / 2 - tw / 2 - 5);
        panel(g, x, 16, tw + 10, 11);
        text(g, b.text.toUpperCase(), W / 2, 19, C.wool, { align: 'center' });
      }
    }
  }
}
