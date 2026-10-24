import { C } from '../palette';
import { ditherRect, panel, rect, ring } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import type { Game } from '../game';
import { CATALOG, defOfKind, footprint, type BuildDef } from '../ranch/catalog';
import { Building, Pen, type Rot } from '../ranch/buildings';
import { Barn, FieldGate, Fence, Kennel, Market, Windmill } from '../ranch/structures';
import { MW, TS, Ter, regionById } from '../world/map';
import { MAX_UP, UPGRADES, livestockPrice, penGoodsValue, priceMult, type UpKey } from '../systems/economy';
import { SPECIES } from '../entities/species';
import { HELPER_COSTS } from '../entities/helper';
import { buildingDrawables } from '../render/world';

export type Tab = 'build' | 'dog' | 'market';

// How far out from the ranch centre you may build, by tier.
const REACH = [0.72, 0.84, 0.94, 1, 1];

export function makeBuilding(def: BuildDef, tx: number, ty: number, rot: Rot): Building {
  switch (def.id) {
    case 'pen': return new Pen(tx, ty, rot);
    case 'fence': return new Fence(tx, ty, rot);
    case 'gate': return new FieldGate(tx, ty, rot);
    case 'kennel': return new Kennel(tx, ty);
    case 'market': return new Market(tx, ty);
    case 'barn': return new Barn(tx, ty);
    case 'windmill': return new Windmill(tx, ty);
    default: return new Building(def.kind, tx, ty, def.w, def.h, rot);
  }
}

interface Ghost {
  def: BuildDef;
  tx: number;
  ty: number;
  w: number;
  h: number;
  ok: boolean;
  reason: string;
  pen?: Pen;
}

export class BuildMode {
  tab: Tab = 'build';
  item = 0;
  cx = 0;
  cy = 0;
  rot: Rot = 0;
  row = 0;
  msg: { text: string; t: number; good: boolean } | null = null;
  private rep: Record<string, number> = {};
  private paintKey = '';

  enter(game: Game, tab: Tab = 'build') {
    this.tab = tab;
    this.cx = Math.floor(game.dog.x / TS);
    this.cy = Math.floor(game.dog.y / TS);
    if (!this.buildable(game, this.cx, this.cy)) {
      const r = regionById('ranch');
      this.cx = r.cx + 6;
      this.cy = r.cy + 2;
    }
    this.row = 0;
    game.input.stickEnabled = false;
  }

  exit(game: Game) {
    game.input.stickEnabled = true;
  }

  get def(): BuildDef {
    return CATALOG[this.item];
  }

  say(text: string, good = false) {
    this.msg = { text, t: 2, good };
  }

  // ---- Rules ----

  buildable(game: Game, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MW) return false;
    const r = regionById('ranch');
    if (game.map.region[ty * MW + tx] !== r.index || game.map.t(tx, ty) !== Ter.Grass) return false;
    const f = REACH[Math.min(REACH.length, game.tier) - 1];
    const dx = (tx + 0.5 - r.cx) / (r.rx * f), dy = (ty + 0.5 - r.cy) / (r.ry * f);
    if (dx * dx + dy * dy > 1) return false;
    const lot = game.ranch.farmhouseLot();
    if (lot && tx >= lot.x0 && tx < lot.x1 && ty >= lot.y0 && ty < lot.y1) return false;
    return true;
  }

  buildingAt(game: Game, tx: number, ty: number): Building | null {
    for (const b of game.ranch.buildings) {
      if (b.kind === 'regiongate') continue;
      if (tx >= b.tx && tx < b.tx + b.w && ty >= b.ty && ty < b.ty + b.h) return b;
    }
    return null;
  }

  ghost(game: Game): Ghost {
    const def = this.def;
    const { w, h } = footprint(def, this.rot);
    const tx = this.cx - Math.floor(w / 2), ty = this.cy - Math.floor(h / 2);
    const gh: Ghost = { def, tx, ty, w, h, ok: false, reason: '' };
    const count = game.ranch.buildings.filter((b) => b.kind === def.kind).length;
    if (def.tier > game.tier) return { ...gh, reason: `UNLOCKS AT TIER ${def.tier}` };
    if (def.max && count >= def.max) return { ...gh, reason: 'YOU HAVE ONE ALREADY' };
    if (def.id === 'trough') {
      const b = this.buildingAt(game, this.cx, this.cy);
      if (!(b instanceof Pen)) return { ...gh, reason: 'PLACE IT IN A PEN' };
      if (b.hasTrough) return { ...gh, pen: b, reason: 'THIS PEN HAS ONE' };
      if (game.coins < def.cost) return { ...gh, pen: b, reason: `NEED ${def.cost}$` };
      return { ...gh, pen: b, ok: true };
    }
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (!this.buildable(game, x, y)) return { ...gh, reason: 'NOT ON RANCH LAND' };
    for (const b of game.ranch.buildings) if (b.kind !== 'regiongate' && b.overlapsTiles(tx, ty, w, h)) return { ...gh, reason: 'SOMETHING IS IN THE WAY' };
    const X0 = tx * TS - 3, Y0 = ty * TS - 3, X1 = (tx + w) * TS + 3, Y1 = (ty + h) * TS + 3;
    const inside = (x: number, y: number) => x > X0 && x < X1 && y > Y0 && y < Y1;
    if (inside(game.dog.x, game.dog.y)) return { ...gh, reason: 'YOUR DOG IS IN THE WAY' };
    if (game.animals.some((a) => !a.gone && !a.pen && inside(a.x, a.y))) return { ...gh, reason: 'ANIMALS IN THE WAY' };
    if (game.coins < def.cost) return { ...gh, reason: `NEED ${def.cost}$` };
    return { ...gh, ok: true };
  }

  private place(game: Game) {
    const gh = this.ghost(game);
    if (!gh.ok) {
      this.say(gh.reason);
      game.audio?.play('deny');
      return;
    }
    game.coins -= gh.def.cost;
    if (gh.pen) {
      gh.pen.hasTrough = true;
    } else {
      game.ranch.add(makeBuilding(gh.def, gh.tx, gh.ty, this.rot));
    }
    game.stats.built++;
    game.onBuilt(gh.def.id);
    this.say(`BUILT A ${gh.def.name}`, true);
    game.audio?.play('build');
    for (let i = 0; i < 8; i++)
      game.fx.dust(gh.tx * TS + Math.random() * gh.w * TS, (gh.ty + gh.h) * TS - 1, (Math.random() - 0.5) * 20, 0);
  }

  private upgrade(game: Game, b: Building) {
    const d = defOfKind(b.kind);
    if (!d?.upgrade || b.level >= 2) return this.say('NOTHING TO UPGRADE');
    if (game.tier < d.upgrade.tier) return this.say(`UPGRADE AT TIER ${d.upgrade.tier}`);
    if (game.coins < d.upgrade.cost) return this.say(`NEED ${d.upgrade.cost}$`);
    game.coins -= d.upgrade.cost;
    b.level++;
    game.ranch.restamp();
    game.onBuilt(`${d.id}2`);
    this.say(`${d.name} UPGRADED`, true);
    game.audio?.play('build');
  }

  private remove(game: Game, b: Building) {
    const d = defOfKind(b.kind);
    if (!d || b.kind === 'farmhouse') return this.say('THAT STAYS');
    if (b instanceof Pen && b.animals.length) return this.say('SELL OR MOVE THEM FIRST');
    game.ranch.remove(b);
    game.coins += Math.floor(d.cost / 2);
    this.say(`REMOVED (+${Math.floor(d.cost / 2)}$)`);
  }

  // ---- Input ----

  private repeat(game: Game, dir: 'up' | 'down' | 'left' | 'right', keys: string[], dt: number): boolean {
    let fire = game.input.pressed(dir);
    if (game.input.key(...keys)) {
      this.rep[dir] = (this.rep[dir] ?? 0) + dt;
      if (this.rep[dir] > 0.24) {
        this.rep[dir] -= 0.055;
        fire = true;
      }
    } else this.rep[dir] = 0;
    return fire;
  }

  update(game: Game, dt: number): 'exit' | null {
    const inp = game.input;
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (inp.pressed('cancel') || inp.pressed('build')) return 'exit';
    if (inp.pressed('tab1')) this.tab = 'build';
    if (inp.pressed('tab2')) { this.tab = 'dog'; this.row = 0; }
    if (inp.pressed('tab3')) { this.tab = 'market'; this.row = 0; }

    if (this.tab === 'build') {
      if (this.repeat(game, 'left', ['KeyA', 'ArrowLeft'], dt)) this.cx--;
      if (this.repeat(game, 'right', ['KeyD', 'ArrowRight'], dt)) this.cx++;
      if (this.repeat(game, 'up', ['KeyW', 'ArrowUp'], dt)) this.cy--;
      if (this.repeat(game, 'down', ['KeyS', 'ArrowDown'], dt)) this.cy++;
      const r = regionById('ranch');
      this.cx = Math.max(r.cx - r.rx, Math.min(r.cx + r.rx, this.cx));
      this.cy = Math.max(r.cy - r.ry, Math.min(r.cy + r.ry, this.cy));
      if (inp.pressed('prev') || inp.wheel < 0) this.item = (this.item + CATALOG.length - 1) % CATALOG.length;
      if (inp.pressed('next') || inp.wheel > 0) this.item = (this.item + 1) % CATALOG.length;
      if (inp.pressed('rotate')) this.rot = ((this.rot + 1) % 4) as Rot;
      const under = this.buildingAt(game, this.cx, this.cy);
      if (inp.pressed('confirm')) {
        this.place(game);
        this.paintKey = `${this.cx},${this.cy}`;
      } else if (this.def.id === 'fence' && inp.key('Space', 'Enter')) {
        // Hold to paint a run of fence.
        const k = `${this.cx},${this.cy}`;
        if (k !== this.paintKey) {
          this.paintKey = k;
          if (this.ghost(game).ok) this.place(game);
        }
      }
      if (inp.pressed('remove') && under) this.remove(game, under);
      if (inp.pressed('upgrade') && under) this.upgrade(game, under);
    } else if (this.tab === 'dog') {
      const rows = UPGRADES.length + 1;
      if (inp.pressed('up')) this.row = (this.row + rows - 1) % rows;
      if (inp.pressed('down')) this.row = (this.row + 1) % rows;
      if (inp.pressed('confirm')) {
        if (this.row < UPGRADES.length) this.buyUpgrade(game, UPGRADES[this.row].key);
        else this.hire(game);
      }
    } else {
      const pens = game.ranch.pens.filter((p) => p.animals.length);
      if (pens.length) {
        if (inp.pressed('up')) this.row = (this.row + pens.length - 1) % pens.length;
        if (inp.pressed('down')) this.row = (this.row + 1) % pens.length;
        this.row = Math.min(this.row, pens.length - 1);
        if (inp.pressed('confirm')) this.sellOne(game, pens[this.row]);
      }
    }
    return null;
  }

  buyUpgrade(game: Game, key: UpKey) {
    if (!game.ranch.buildings.some((b) => b.kind === 'kennel')) return this.say('BUILD A KENNEL FIRST');
    const lvl = game.upgrades[key];
    const def = UPGRADES.find((u) => u.key === key)!;
    if (lvl >= MAX_UP) return this.say('ALREADY THE BEST');
    const cost = def.costs[lvl - 1];
    if (game.coins < cost) return this.say(`NEED ${cost}$`);
    game.coins -= cost;
    game.upgrades[key]++;
    game.applyUpgrades();
    game.onBuilt(`up-${key}`);
    this.say(`${def.name} UP!`, true);
    game.audio?.play('build');
  }

  hire(game: Game) {
    const err = game.hireHelper();
    if (err) this.say(err);
    else {
      this.say(`${game.helpers[game.helpers.length - 1].name} JOINS THE RANCH!`, true);
      game.audio?.play('tierup');
    }
  }

  sellOne(game: Game, p: Pen) {
    if (!game.ranch.buildings.some((b) => b.kind === 'market')) return this.say('BUILD A MARKET FIRST');
    const a = [...p.animals].sort((x, y) => y.stress - x.stress)[0];
    if (!a) return;
    const price = livestockPrice(game, a.sp.id);
    a.gone = true;
    p.animals = p.animals.filter((x) => x !== a);
    game.earn(price);
    game.stats.sold += price;
    this.say(`SOLD A ${a.sp.name.toUpperCase()} +${price}$`, true);
    game.audio?.play('coin');
  }

  // ---- Drawing ----

  // World-space parts: buildable outline, shelter rings, the ghost.
  drawWorld(game: Game, g: CanvasRenderingContext2D) {
    if (this.tab !== 'build') return;
    const { ox, oy, W, H } = game.view();
    const t0x = Math.floor(ox / TS) - 1, t1x = Math.ceil((ox + W) / TS) + 1;
    const t0y = Math.floor(oy / TS) - 1, t1y = Math.ceil((oy + H) / TS) + 1;
    g.fillStyle = C.wool;
    for (let ty = t0y; ty < t1y; ty++)
      for (let tx = t0x; tx < t1x; tx++) {
        if (!this.buildable(game, tx, ty)) continue;
        const X = tx * TS, Y = ty * TS;
        if (!this.buildable(game, tx, ty - 1)) for (let i = 0; i < TS; i += 2) g.fillRect(X + i, Y, 1, 1);
        if (!this.buildable(game, tx, ty + 1)) for (let i = 0; i < TS; i += 2) g.fillRect(X + i, Y + TS - 1, 1, 1);
        if (!this.buildable(game, tx - 1, ty)) for (let i = 0; i < TS; i += 2) g.fillRect(X, Y + i, 1, 1);
        if (!this.buildable(game, tx + 1, ty)) for (let i = 0; i < TS; i += 2) g.fillRect(X + TS - 1, Y + i, 1, 1);
      }
    for (const b of game.ranch.buildings) if (b instanceof Barn) ring(g, b.cx, b.cy, b.shelterRadius, C.butter, 6);
    if (this.def.id === 'barn') ring(g, (this.cx + 0.5) * TS, (this.cy + 0.5) * TS, 84, C.butter, 6);

    const gh = this.ghost(game);
    const under = this.buildingAt(game, this.cx, this.cy);
    const X0 = gh.tx * TS, Y0 = gh.ty * TS, Wd = gh.w * TS, Hd = gh.h * TS;
    if (gh.def.id === 'trough') {
      if (gh.pen) outline(g, gh.pen.x0, gh.pen.y0, gh.pen.x1 - gh.pen.x0, gh.pen.y1 - gh.pen.y0, gh.ok ? C.butter : C.plum, game.t);
    } else if (under && !gh.ok) {
      outline(g, under.x0, under.y0, under.x1 - under.x0, under.y1 - under.y0, C.wool, game.t);
      ditherRect(g, X0, Y0, Wd, Hd, 6, C.plum);
    } else {
      if (gh.ok) {
        const temp = makeBuilding(gh.def, gh.tx, gh.ty, this.rot);
        const ds = buildingDrawables(g, temp, game.t, false).sort((a, b) => a.y - b.y);
        for (const d of ds) d.draw();
      } else ditherRect(g, X0, Y0, Wd, Hd, 8, C.plum);
      outline(g, X0, Y0, Wd, Hd, gh.ok ? C.butter : C.plum, game.t);
    }
    // Cursor tile marker.
    rect(g, this.cx * TS + 3, this.cy * TS + 3, 2, 2, C.butter);
  }

  // Screen-space UI.
  drawUI(game: Game, g: CanvasRenderingContext2D, W: number, H: number): 'exit' | null {
    const ui = game.ui;
    const inp = game.input;
    let result: 'exit' | null = null;

    // Tabs and DONE.
    const tabs: [Tab, string][] = [['build', 'BUILD'], ['dog', 'DOG'], ['market', 'MARKET']];
    let x = 2;
    for (const [id, label] of tabs) {
      const w = textWidth(label) + 8;
      const on = this.tab === id;
      panel(g, x, 2, w, 11, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, label, x + 4, 5, on ? C.butter : C.wool);
      if (ui.click(`tab-${id}`, x, 2, w, 11)) { this.tab = id; this.row = 0; }
      x += w + 2;
    }
    const dw = 30;
    panel(g, W - dw - 2, 2, dw, 11, C.plum, C.butter);
    text(g, 'DONE', W - dw / 2 - 2, 5, C.wool, { align: 'center' });
    if (ui.click('done', W - dw - 2, 2, dw, 11)) result = 'exit';
    const coinStr = `${game.coins}$`;
    const cw = textWidth(coinStr) + 8;
    panel(g, W - cw - 2, 15, cw, 11);
    text(g, coinStr, W - 6, 18, C.wool, { align: 'right', iconColor: C.butter });

    if (this.tab === 'build') this.drawBuildBar(game, g, W, H);
    else if (this.tab === 'dog') this.drawDog(game, g, W, H);
    else this.drawMarket(game, g, W, H);

    if (this.msg) {
      const m = this.msg;
      const tw = textWidth(m.text);
      panel(g, Math.round(W / 2 - tw / 2 - 5), 30, tw + 10, 11, C.plum, m.good ? C.butter : C.sage);
      text(g, m.text, W / 2, 33, m.good ? C.butter : C.wool, { align: 'center', iconColor: C.butter });
    }

    // World taps / clicks move the cursor (and a mouse click builds).
    if (this.tab === 'build') {
      const { ox, oy } = game.view();
      for (const p of inp.ptrs.values()) {
        if (p.justDown && !p.owner && p.y > 28) p.owner = 'world';
        if (p.owner === 'world') {
          this.cx = Math.floor((p.x + ox) / TS);
          this.cy = Math.floor((p.y + oy) / TS);
          if (p.justUp && !p.touch && Math.hypot(p.x - p.downX, p.y - p.downY) < 3) inp.push('confirm');
        }
      }
      const hv = inp.hover;
      if (hv && !inp.touchMode && hv.y > 28 && hv.y < H - 44) {
        this.cx = Math.floor((hv.x + ox) / TS);
        this.cy = Math.floor((hv.y + oy) / TS);
      }
    }
    return result;
  }

  private drawBuildBar(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const n = CATALOG.length;
    const cw = Math.min(28, Math.floor((W - 4) / n));
    const bx = Math.round(W / 2 - (cw * n) / 2), by = H - 26;
    panel(g, bx - 2, by - 2, cw * n + 4, 28);
    CATALOG.forEach((d, i) => {
      const x = bx + i * cw;
      const sel = i === this.item;
      const locked = d.tier > game.tier;
      if (sel) panel(g, x, by, cw - 1, 24, C.teal, C.butter);
      rect(g, x + 2, by + 2, cw - 5, 12, C.meadow);
      const ic = d.icon();
      drawSpr(g, ic, x + Math.floor((cw - 1 - ic.w) / 2), by + 2 + Math.floor((12 - ic.h) / 2));
      if (locked) {
        ditherRect(g, x + 1, by + 1, cw - 3, 22, 10, C.plum);
        text(g, `T${d.tier}`, x + cw / 2, by + 16, C.wool, { align: 'center' });
      } else {
        text(g, `${d.cost}`, x + cw / 2, by + 16, game.coins >= d.cost ? C.butter : C.sage, { align: 'center' });
      }
      if (ui.click(`item-${i}`, x, by, cw - 1, 24)) this.item = i;
    });

    // Info card: the building under the cursor, else the selected item.
    const under = this.buildingAt(game, this.cx, this.cy);
    const ud = under ? defOfKind(under.kind) : null;
    const lines: string[] = [];
    let title = '';
    if (under && ud && this.def.id !== 'trough') {
      title = `${ud.name}${under.level > 1 ? ' II' : ''}`;
      if (under instanceof Pen) {
        const sp = under.species ? SPECIES[under.species] : null;
        lines.push(sp ? `${under.animals.length} ${sp.plural.toUpperCase()}, ${under.goods} GOODS` : 'EMPTY');
        if (under.hasTrough) lines.push('HAS A TROUGH');
      }
      if (ud.upgrade && under.level < 2) lines.push(`U: UPGRADE ${ud.upgrade.cost}$ (${ud.upgrade.desc})`);
      lines.push('X: REMOVE');
    } else if (under && under.kind === 'farmhouse') {
      title = 'FARMHOUSE';
      lines.push('GROWS WITH YOUR RANCH');
    } else {
      title = `${this.def.name}  ${this.def.cost}$`;
      lines.push(...wrap(this.def.desc, W - 20));
      const gh = this.ghost(game);
      if (!gh.ok && gh.reason) lines.push(gh.reason);
    }
    const ih = 10 + lines.length * 6;
    const iy = by - 6 - ih;
    panel(g, 2, iy, W - 4, ih);
    text(g, title, 6, iy + 3, C.butter, { iconColor: C.butter });
    lines.forEach((l, i) => text(g, l, 6, iy + 10 + i * 6, C.wool, { iconColor: C.butter }));

    // Touch buttons.
    if (game.input.touchMode) {
      const bw = 34, bh = 13, rx = W - bw - 2;
      let y = iy - bh - 2;
      const btn = (id: string, label: string, act: () => void) => {
        panel(g, rx, y, bw, bh, ui.isActive(id) ? C.teal : C.plum, C.butter);
        text(g, label, rx + bw / 2, y + 4, C.wool, { align: 'center' });
        if (ui.click(id, rx, y, bw, bh)) act();
        y -= bh + 2;
      };
      btn('b-place', 'BUILD', () => game.input.push('confirm'));
      if (this.def.rotates) btn('b-rot', 'TURN', () => game.input.push('rotate'));
      if (under && ud) {
        btn('b-rm', 'REMOVE', () => game.input.push('remove'));
        if (ud.upgrade && under.level < 2) btn('b-up', 'UPGRADE', () => game.input.push('upgrade'));
      }
    } else {
      text(g, 'ARROWS MOVE  Q/E PICK  R TURN  SPACE BUILD', W / 2, by - ih - 14, C.wool, { align: 'center', shadow: C.plum });
    }
  }

  private drawDog(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const pw = Math.min(W - 8, 170), ph = 20 + (UPGRADES.length + 1) * 16;
    const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
    panel(g, x0, y0, pw, ph);
    const hasKennel = game.ranch.buildings.some((b) => b.kind === 'kennel');
    text(g, hasKennel ? 'KENNEL: TRAIN YOUR DOG' : 'BUILD A KENNEL TO TRAIN', W / 2, y0 + 5, C.butter, { align: 'center' });
    UPGRADES.forEach((u, i) => {
      const y = y0 + 16 + i * 16;
      const lvl = game.upgrades[u.key];
      const sel = i === this.row;
      if (sel) rect(g, x0 + 3, y - 2, pw - 6, 15, C.teal);
      text(g, u.name, x0 + 7, y, C.wool);
      for (let k = 0; k < MAX_UP; k++) rect(g, x0 + 7 + k * 5, y + 7, 4, 3, k < lvl ? C.butter : C.sage);
      const next = lvl < MAX_UP ? u.desc(lvl + 1) : 'MAXED';
      text(g, next, x0 + 36, y + 6, C.wool);
      if (lvl < MAX_UP) {
        const cost = u.costs[lvl - 1];
        const bw = 28, bx = x0 + pw - bw - 6;
        panel(g, bx, y, bw, 11, C.plum, hasKennel && game.coins >= cost ? C.butter : C.sage);
        text(g, `${cost}$`, bx + bw / 2, y + 3, game.coins >= cost ? C.butter : C.sage, { align: 'center', iconColor: C.butter });
        if (ui.click(`up-${u.key}`, bx, y, bw, 11)) { this.row = i; this.buyUpgrade(game, u.key); }
      }
      if (ui.click(`row-${u.key}`, x0, y - 2, pw - 40, 15)) this.row = i;
    });
    // Helper dogs.
    {
      const i = UPGRADES.length, y = y0 + 16 + i * 16;
      if (this.row === i) rect(g, x0 + 3, y - 2, pw - 6, 15, C.teal);
      const n = game.helpers.length;
      text(g, 'HELPER DOG', x0 + 7, y, C.wool);
      for (let k = 0; k < HELPER_COSTS.length; k++) rect(g, x0 + 7 + k * 5, y + 7, 4, 3, k < n ? C.butter : C.sage);
      const note = game.tier < 4 ? 'AT TIER 4' : n >= HELPER_COSTS.length ? 'FULL PACK' : 'HOLDS A FLANK';
      text(g, note, x0 + 36, y + 6, C.wool);
      if (n < HELPER_COSTS.length && game.tier >= 4) {
        const cost = HELPER_COSTS[n];
        const bw = 28, bx = x0 + pw - bw - 6;
        panel(g, bx, y, bw, 11, C.plum, hasKennel && game.coins >= cost ? C.butter : C.sage);
        text(g, `${cost}$`, bx + bw / 2, y + 3, game.coins >= cost ? C.butter : C.sage, { align: 'center', iconColor: C.butter });
        if (ui.click('hire', bx, y, bw, 11)) { this.row = i; this.hire(game); }
      }
    }
  }

  private drawMarket(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const pens = game.ranch.pens.filter((p) => p.animals.length);
    const hasMarket = game.ranch.buildings.some((b) => b.kind === 'market');
    const pw = Math.min(W - 8, 176), ph = 34 + Math.max(1, pens.length) * 14;
    const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
    panel(g, x0, y0, pw, ph);
    text(g, hasMarket ? 'MARKET STALL' : 'NO MARKET STALL YET', W / 2, y0 + 5, C.butter, { align: 'center' });
    text(g, `GOODS SELL AT DUSK  X${priceMult(game)}`, W / 2, y0 + 13, C.wool, { align: 'center' });
    if (!pens.length) text(g, 'NO STOCK IN YOUR PENS', W / 2, y0 + 26, C.sage, { align: 'center' });
    pens.forEach((p, i) => {
      const y = y0 + 24 + i * 14;
      const sp = SPECIES[p.species!];
      if (i === this.row) rect(g, x0 + 3, y - 2, pw - 6, 13, C.teal);
      text(g, `${p.animals.length} ${sp.plural.toUpperCase()}`, x0 + 7, y + 1, C.wool);
      text(g, `GOODS ${penGoodsValue(game, p)}$`, x0 + 64, y + 1, C.wool, { iconColor: C.butter });
      if (hasMarket) {
        const price = livestockPrice(game, sp.id);
        const bw = 40, bx = x0 + pw - bw - 6;
        panel(g, bx, y - 1, bw, 11, C.plum, C.butter);
        text(g, `SELL ${price}$`, bx + bw / 2, y + 2, C.butter, { align: 'center', iconColor: C.butter });
        if (ui.click(`sell-${p.id}`, bx, y - 1, bw, 11)) { this.row = i; this.sellOne(game, p); }
      }
    });
  }
}

function outline(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, t: number) {
  g.fillStyle = col;
  const off = Math.floor(t * 8) % 4;
  for (let i = 0; i < w; i++) if ((i + off) % 4 < 2) { g.fillRect(x + i, y, 1, 1); g.fillRect(x + i, y + h - 1, 1, 1); }
  for (let i = 0; i < h; i++) if ((i + off) % 4 < 2) { g.fillRect(x, y + i, 1, 1); g.fillRect(x + w - 1, y + i, 1, 1); }
}
