import { C } from './palette';
import type { Screen } from './gfx/screen';
import { panel, rect } from './gfx/draw';
import { text, textWidth } from './gfx/font';
import type { Input } from './input';
import { UI } from './ui/ui';
import { drawTouchControls } from './ui/touch';
import { Particles } from './systems/particles';
import { Dog } from './entities/dog';
import { Animal, barkAt, drawAnimal, drawAnimalShadow, findGroups, nipFrom, updateHerd, type Group, type HerdCtx, type PressureSource } from './entities/animal';
import { ring } from './gfx/draw';
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
  showZones = false;
  animals: Animal[] = [];
  groups: Group[] = [];
  private groupT = 0;
  private sources: PressureSource[] = [];

  constructor(public screen: Screen, public input: Input) {
    this.g = screen.g;
    this.ui = new UI(input);
    this.map = new WorldMap();
    this.baked = bake(this.map);
    this.dog = new Dog(96 * TS + 4, 104 * TS + 4);
    this.cam.x = this.dog.x;
    this.cam.y = this.dog.y;
    this.spawnFlock('sheep', 96 * TS, 92 * TS, 12);
  }

  spawnFlock(id: Animal['sp']['id'], x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (6 + n * 1.2);
      const an = new Animal(id, x + Math.cos(a) * r, y + Math.sin(a) * r);
      this.animals.push(an);
    }
  }

  private herdCtx(): HerdCtx {
    const d = this.dog;
    this.sources.length = 0;
    this.sources.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, strength: 1, range: 1, kind: 'dog', lying: d.lying });
    return { map: this.map, sources: this.sources, dogX: d.x, dogY: d.y, dogR: d.r, dogLying: d.lying, gates: [] };
  }

  update(dt: number) {
    this.t += dt;
    this.dog.update(dt, this.input, this.map, this.fx);
    for (const ev of this.dog.events) this.onDogEvent(ev);
    this.dog.events.length = 0;
    updateHerd(this.animals, this.herdCtx(), dt);
    if ((this.groupT -= dt) <= 0) {
      this.groups = findGroups(this.animals);
      this.groupT = 0.25;
    }
    if (this.input.pressed('helper') && this.debug) this.showZones = !this.showZones;
    this.fx.update(dt);
    this.updateCamera(dt);

    const reg = this.map.regionAt(this.dog.x, this.dog.y);
    if (reg && reg !== this.lastRegion) {
      this.banner = { text: reg.name, t: 2.6 };
      this.lastRegion = reg;
    }
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
  }

  private onDogEvent(ev: 'bark' | 'nip') {
    const d = this.dog;
    if (ev === 'bark') {
      barkAt(this.animals, d.x, d.y, d.stats.barkRange);
    } else {
      const hit = nipFrom(this.animals, d.x + d.hx * 4, d.y + d.hy * 4, d.hx, d.hy, d.stats.nipPower);
      const nx = d.x + d.hx * 7, ny = d.y + d.hy * 7 - 2;
      for (let i = 0; i < 4; i++)
        this.fx.add({ kind: 'spark', x: nx, y: ny, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, max: 0.18, color: hit ? C.butter : C.wool });
    }
  }

  // The group nearest the dog (for the flock mood readout).
  nearestGroup(maxD = 140): Group | null {
    let best: Group | null = null, bd = maxD;
    for (const gr of this.groups) {
      for (const a of gr.members) {
        const d = Math.hypot(a.x - this.dog.x, a.y - this.dog.y);
        if (d < bd) { bd = d; best = gr; }
      }
    }
    return best;
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
    const inView = (x: number, y: number, m = 24) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
    for (const a of this.animals) if (!a.gone && inView(a.x, a.y)) drawAnimalShadow(g, a);
    this.dog.drawShadow(g);
    this.fx.drawLow(g);
    // Lying down lets you read the flock: its flight zone shows faintly.
    if (this.dog.lying) {
      const gr = this.nearestGroup(160);
      if (gr) {
        let rad = 0;
        for (const a of gr.members) rad = Math.max(rad, Math.hypot(a.x - gr.x, a.y - gr.y));
        const sp = gr.members[0].sp;
        ring(g, gr.x, gr.y, rad + sp.flight * (1 + 0.6 * gr.stress) * 0.85, C.sage, 6);
      }
    }
    if (this.showZones) {
      for (const a of this.animals) if (inView(a.x, a.y)) ring(g, a.x, a.y, a.sp.flight * (1 + 0.6 * a.stress), C.plum, 8);
    }
    const ents: { y: number; draw: () => void }[] = [];
    for (const a of this.animals) if (!a.gone && inView(a.x, a.y)) ents.push({ y: a.y, draw: () => drawAnimal(g, a, this.t) });
    ents.push({ y: this.dog.y, draw: () => this.dog.draw(g) });
    ents.sort((p, q) => p.y - q.y);
    for (const e of ents) e.draw();
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
    const gr = this.nearestGroup();
    if (gr) {
      const sp = gr.members[0].sp;
      const n = gr.members.length;
      const mood = gr.stress < 0.3 ? 'CALM' : gr.stress < 0.6 ? 'UNEASY' : 'PANIC';
      const col = gr.stress < 0.3 ? C.butter : gr.stress < 0.6 ? C.wool : C.butter;
      const label = `${n} ${(n === 1 ? sp.name : sp.plural).toUpperCase()}`;
      const w = Math.max(textWidth(label), 21 + textWidth(mood)) + 8;
      panel(g, 3, 3, w, 19);
      text(g, label, 7, 6, C.wool);
      const pips = 5, lit = Math.round((1 - gr.stress) * pips);
      for (let i = 0; i < pips; i++) rect(g, 7 + i * 4, 14, 3, 4, i < lit ? col : C.sage);
      if (mood !== 'PANIC' || Math.floor(this.t * 6) % 2 === 0) text(g, mood, 28, 13, col);
    }
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
