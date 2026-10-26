import { C } from '../palette';
import { ditherRect, rect, ring } from '../gfx/draw';
import { panel } from './frame';
import { heading, text, textWidth, wrap } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import type { Game } from '../game';
import { CATALOG, defOfKind, footprint, type BuildDef } from '../ranch/catalog';
import { Building, Pen, type Rot } from '../ranch/buildings';
import { AgilityYard, Barn, Dairy, FieldGate, Fence, Haystack, Kennel, Market, ShearingShed, Windmill } from '../ranch/structures';
import { MW, TS, Ter, regionById } from '../world/map';
import { MAX_UP, UPGRADES, livestockPrice, penGoodsValue, priceMult, type UpKey } from '../systems/economy';
import { SPECIES } from '../entities/species';
import { HELPER_COSTS } from '../entities/helper';
import { buildingDrawables } from '../render/world';
import { safeArea } from './safe';
import { nextGoal, tierOf } from '../systems/progression';
import { PIECES, clearDecorUnder, decorAt, decorBlocked, pieceDrawable, pieceIcon, pieceOf, type Piece } from './decorbuild';
import { RANCH_MAX, RANCH_NAMES, applyLook, pickName } from './look';
import { cycle, optionRow } from './rows';
import { focusField, isTyping, stopTyping, textField } from './textfield';
import { ROOFS, TRIMS, type Roof, type Trim } from '../art/ranchstyle';
import { drawGateMark, drawRoad } from '../art/road';
import { PaddockEditor, paddockRules, type PaddockLike, type PaddockRules } from './paddockbuild';
import './paddockrules'; // the ranch's paddock rules, when this build has them

// The ranch tab's paint rows (the name field sits above them).
const ROOF_IDS = Object.keys(ROOFS) as Roof[];
const TRIM_IDS = Object.keys(TRIMS) as Trim[];
const RANCH_ROWS: { label: string; value: (g: Game) => string; step: (g: Game, d: -1 | 1) => void }[] = [
  { label: 'ROOF', value: (g) => ROOFS[g.look.roof].name, step: (g, d) => { g.look.roof = cycle(ROOF_IDS, g.look.roof, d); } },
  { label: 'TRIM', value: (g) => TRIMS[g.look.trim].name, step: (g, d) => { g.look.trim = cycle(TRIM_IDS, g.look.trim, d); } },
];

export type Tab = 'build' | 'decor' | 'ranch' | 'dog' | 'market';
const TABS: [Tab, string][] = [['build', 'BUILD'], ['decor', 'DECOR'], ['ranch', 'RANCH'], ['dog', 'DOG'], ['market', 'MARKET']];

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
    case 'hay': return new Haystack(tx, ty);
    case 'shed': return new ShearingShed(tx, ty);
    case 'dairy': return new Dairy(tx, ty);
    case 'agility': return new AgilityYard(tx, ty);
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
  paddock?: PaddockLike; // a fixture's paddock
}

// The catalog item a "BUILD A ..." goal asks for, or -1.
function goalBuilding(game: Game): number {
  const ng = nextGoal(game);
  const m = ng?.goal.label.match(/^BUILD (?:A|THE) (\w+)$/);
  if (!m) return -1;
  const kind = m[1].toLowerCase();
  return CATALOG.findIndex((d) => d.kind === kind || d.id === kind);
}

export class BuildMode {
  tab: Tab = 'build';
  item = 0;
  piece = 0; // selected decor piece
  cx = 0;
  cy = 0;
  rot: Rot = 0;
  row = 0;
  msg: { text: string; t: number; good: boolean } | null = null;
  paddock = new PaddockEditor();
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
    // When the goal is to build something, have it ready to place.
    const want = goalBuilding(game);
    if (want >= 0) this.item = want;
    game.input.stickEnabled = false;
  }

  exit(game: Game) {
    game.input.stickEnabled = true;
    this.paddock.cancel();
  }

  // ---- Paddocks ----

  // The rules, when the paddock tool is in hand (or a draft is open).
  private padRules(): PaddockRules | null {
    const R = paddockRules();
    if (!R) return null;
    return this.paddock.busy || this.def.id === R.tool ? R : null;
  }

  private paddockAt(game: Game, tx: number, ty: number): PaddockLike | null {
    const R = paddockRules(), b = this.buildingAt(game, tx, ty);
    return R && b && R.is(b) ? b : null;
  }

  // Open a built paddock in the editor, with the paddock tool in hand.
  private extend(game: Game, p: PaddockLike) {
    const R = paddockRules();
    if (!R) return;
    const i = CATALOG.findIndex((d) => d.id === R.tool);
    if (i >= 0) this.item = i;
    this.paddock.extendFrom(R, p);
  }

  private commitPaddock(game: Game, R: PaddockRules) {
    const res = this.paddock.commit(game, R, (x, y) => this.buildable(game, x, y));
    this.say(res.say, res.good);
    if (!res.good) {
      game.audio?.play('deny');
      return;
    }
    const b = res.built!; // the rules count it built
    clearDecorUnder(game, b.tx, b.ty, b.w, b.h);
    game.audio?.play('build');
    for (let i = 0; i < 12; i++)
      game.fx.dust(b.tx * TS + Math.random() * b.w * TS, (b.ty + b.h) * TS - 1, (Math.random() - 0.5) * 20, 0);
  }

  // Keys while a paddock is being marked out; true when they were used.
  private paddockKeys(game: Game, R: PaddockRules, dt: number): boolean {
    const inp = game.input, ed = this.paddock;
    if (!ed.draft) return false;
    for (const [dir, keys] of [['left', ['KeyA', 'ArrowLeft']], ['right', ['KeyD', 'ArrowRight']], ['up', ['KeyW', 'ArrowUp']], ['down', ['KeyS', 'ArrowDown']]] as const)
      if (this.repeat(game, dir, [...keys], dt)) ed.nudge(R, dir);
    if (inp.pressed('rotate') || inp.pressed('upgrade')) {
      ed.nextHandle();
      game.audio?.play('click');
    }
    if (inp.pressed('confirm')) this.commitPaddock(game, R);
    // Keep the view on the handle in hand (the view follows the cursor),
    // and, while it fits, on the whole of the paddock.
    const r = ed.draft?.r;
    if (r) {
      const h = ed.handle;
      this.cx = h === 'e' ? r.tx + r.w : h === 'w' ? r.tx - 1 : Math.floor(r.tx + r.w / 2);
      this.cy = h === 's' ? r.ty + r.h : h === 'n' ? r.ty - 1 : Math.floor(r.ty + r.h / 2);
      // The view keeps the cursor 76px clear of the bottom; the card and
      // the bar need more, so the cursor goes a few tiles past the edge.
      const { ox, oy, W, H } = game.view();
      const m = 12, top = 34, foot = 120;
      if (h !== 'e' && h !== 'w' && r.w * TS < W - 2 * m) {
        if ((r.tx + r.w) * TS > ox + W - m) this.cx = r.tx + r.w;
        else if (r.tx * TS < ox + m) this.cx = r.tx - 1;
      }
      if (r.h * TS < H - top - foot) {
        if ((r.ty + r.h) * TS + 8 > oy + H - foot) this.cy = r.ty + r.h + Math.ceil((foot - 76) / TS);
        else if (r.ty * TS - 8 < oy + top) this.cy = r.ty - 1;
      }
    }
    return true;
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
    const land = game.valley.landAt(tx, ty); // a paddock: land once grazed clear
    if (land !== null) return land;
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
    // Troughs, shelters and hay racks go inside a paddock, where the
    // cursor puts them.
    const PR = paddockRules();
    if (PR?.fixtures?.includes(def.id)) {
      const pd = this.paddockAt(game, this.cx, this.cy);
      if (!pd) return { ...gh, reason: 'PLACE IT IN A PADDOCK' };
      const why = PR.fixtureProblem?.(game, pd, def.id, tx, ty) ?? null;
      if (why) return { ...gh, paddock: pd, reason: why };
      if (game.coins < def.cost) return { ...gh, paddock: pd, reason: `NEED ${def.cost}$` };
      return { ...gh, paddock: pd, ok: true };
    }
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (!this.buildable(game, x, y)) return { ...gh, reason: 'NOT ON RANCH LAND' };
    for (const b of game.ranch.buildings) if (b.kind !== 'regiongate' && b.overlapsTiles(tx, ty, w, h)) return { ...gh, reason: 'SOMETHING IS IN THE WAY' };
    const why = game.ranch.placementProblem(def.kind, tx, ty, w, h, this.rot); // the drove road, a pen gate onto a wall
    if (why) return { ...gh, reason: why };
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
    if (gh.paddock) {
      paddockRules()!.placeFixture!(game, gh.paddock, gh.def.id, gh.tx, gh.ty);
    } else {
      game.ranch.add(makeBuilding(gh.def, gh.tx, gh.ty, this.rot));
      clearDecorUnder(game, gh.tx, gh.ty, gh.w, gh.h);
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
    const R = paddockRules();
    if (R && R.is(b)) {
      const err = R.remove(game, b);
      if (err) this.say(err);
      else this.say('PADDOCK TAKEN DOWN');
      return;
    }
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
    if (this.paddock.busy && inp.pressed('cancel')) {
      this.paddock.cancel();
      return null;
    }
    if (inp.pressed('cancel') || inp.pressed('build')) return 'exit';
    (['tab1', 'tab2', 'tab3', 'tab4', 'tab5'] as const).forEach((k, i) => { if (inp.pressed(k)) this.setTab(game, TABS[i][0]); });

    if (this.tab === 'decor') {
      this.moveCursor(game, dt);
      if (inp.pressed('prev') || inp.wheel < 0) this.piece = (this.piece + PIECES.length - 1) % PIECES.length;
      if (inp.pressed('next') || inp.wheel > 0) this.piece = (this.piece + 1) % PIECES.length;
      if (inp.pressed('confirm')) this.placeDecor(game);
      if (inp.pressed('remove')) this.removeDecor(game);
    } else if (this.tab === 'ranch') {
      if (!isTyping()) {
        const rows = RANCH_ROWS.length + 1;
        if (inp.pressed('up')) this.row = (this.row + rows - 1) % rows;
        if (inp.pressed('down')) this.row = (this.row + 1) % rows;
        const r = RANCH_ROWS[this.row - 1];
        if (inp.pressed('left') && r) { r.step(game, -1); applyLook(game.look); }
        if (inp.pressed('right') && r) { r.step(game, 1); applyLook(game.look); }
        if (inp.pressed('confirm')) {
          if (this.row === 0) focusField('ranchname');
          else if (r) { r.step(game, 1); applyLook(game.look); }
        }
      }
    } else if (this.tab === 'build') {
      const item = this.item;
      if (inp.pressed('prev') || inp.wheel < 0) this.item = (this.item + CATALOG.length - 1) % CATALOG.length;
      if (inp.pressed('next') || inp.wheel > 0) this.item = (this.item + 1) % CATALOG.length;
      if (this.item !== item) this.paddock.cancel();
      const R = this.padRules();
      if (R && this.paddockKeys(game, R, dt)) return null;
      this.moveCursor(game, dt);
      if (inp.pressed('rotate')) this.rot = ((this.rot + 1) % 4) as Rot;
      const under = this.buildingAt(game, this.cx, this.cy);
      const pd = this.paddockAt(game, this.cx, this.cy);
      if (pd && inp.pressed('upgrade')) this.extend(game, pd);
      else if (R && inp.pressed('confirm')) {
        if (pd) this.extend(game, pd);
        else this.paddock.start(R, this.cx, this.cy);
      } else if (inp.pressed('confirm')) {
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
      if (inp.pressed('upgrade') && under && !pd) this.upgrade(game, under);
    } else if (this.tab === 'dog') {
      const rows = UPGRADES.length + 2; // the upgrades, a helper, the dog's look
      if (inp.pressed('up')) this.row = (this.row + rows - 1) % rows;
      if (inp.pressed('down')) this.row = (this.row + 1) % rows;
      if (inp.pressed('confirm')) {
        if (this.row < UPGRADES.length) this.buyUpgrade(game, UPGRADES[this.row].key);
        else if (this.row === UPGRADES.length) this.hire(game);
        else game.openLook('kennel');
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

  private moveCursor(game: Game, dt: number) {
    if (this.repeat(game, 'left', ['KeyA', 'ArrowLeft'], dt)) this.cx--;
    if (this.repeat(game, 'right', ['KeyD', 'ArrowRight'], dt)) this.cx++;
    if (this.repeat(game, 'up', ['KeyW', 'ArrowUp'], dt)) this.cy--;
    if (this.repeat(game, 'down', ['KeyS', 'ArrowDown'], dt)) this.cy++;
    const r = regionById('ranch');
    this.cx = Math.max(r.cx - r.rx, Math.min(r.cx + r.rx, this.cx));
    this.cy = Math.max(r.cy - r.ry, Math.min(r.cy + r.ry, this.cy));
  }

  setTab(game: Game, tab: Tab) {
    this.tab = tab;
    this.paddock.cancel();
    this.row = 0;
    if (tab === 'ranch') {
      // Bring the farmhouse into view while it is being painted.
      const f = game.ranch.farmhouse;
      if (f) { this.cx = Math.floor(f.cx / TS); this.cy = Math.floor(f.cy / TS); }
    }
  }

  // ---- Decor ----

  get pieceDef(): Piece {
    return PIECES[this.piece];
  }

  // Top-left tile of the selected piece at the cursor.
  private pieceSpot() {
    const p = this.pieceDef;
    return { tx: this.cx - Math.floor(p.w / 2), ty: this.cy - Math.floor(p.h / 2) };
  }

  private placeDecor(game: Game) {
    const p = this.pieceDef;
    const { tx, ty } = this.pieceSpot();
    const why = decorBlocked(game, p, tx, ty, (x, y) => this.buildable(game, x, y));
    if (why) {
      this.say(why);
      game.audio?.play('deny');
      return;
    }
    game.coins -= p.cost;
    game.decor.push({ id: p.id, tx, ty });
    this.say(`PLACED A ${p.name}`, true);
    game.audio?.play('build');
    game.fx.dust((tx + p.w / 2) * TS, (ty + p.h) * TS - 1, 0, 0);
  }

  private removeDecor(game: Game) {
    const d = decorAt(game, this.cx, this.cy);
    if (!d) return;
    const p = pieceOf(d.id);
    game.decor = game.decor.filter((x) => x !== d);
    game.coins += p.cost; // decor comes back in full
    this.say(`PICKED UP THE ${p.name} (+${p.cost}$)`);
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
    const price = livestockPrice(game, a.sp.id, a);
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
    if (this.tab !== 'build' && this.tab !== 'decor') return;
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
    drawRoad(g, game.ranch, t0x, t0y, t1x, t1y, game.t);
    if (this.tab === 'decor') return this.drawDecorGhost(game, g);
    for (const b of game.ranch.buildings) if (b instanceof Barn) ring(g, b.cx, b.cy, b.shelterRadius, C.butter, 6);
    const R = this.padRules();
    if (R) {
      // Over a built paddock with nothing drafted: show it can be opened.
      const pd = !this.paddock.busy ? this.paddockAt(game, this.cx, this.cy) : null;
      if (pd) outline(g, pd.x0, pd.y0, pd.x1 - pd.x0, pd.y1 - pd.y0, C.butter, game.t);
      else this.paddock.drawWorld(game, g, R, (x, y) => this.buildable(game, x, y), this.cx, this.cy);
      return;
    }
    if (this.def.id === 'barn') ring(g, (this.cx + 0.5) * TS, (this.cy + 0.5) * TS, 84, C.butter, 6);

    const gh = this.ghost(game);
    const under = this.buildingAt(game, this.cx, this.cy);
    const X0 = gh.tx * TS, Y0 = gh.ty * TS, Wd = gh.w * TS, Hd = gh.h * TS;
    if (paddockRules()?.fixtures?.includes(gh.def.id)) {
      // The paddock it goes in, and the piece itself where it would sit.
      if (gh.paddock) outline(g, gh.paddock.x0, gh.paddock.y0, gh.paddock.x1 - gh.paddock.x0, gh.paddock.y1 - gh.paddock.y0, gh.ok ? C.butter : C.plum, game.t);
      if (gh.ok) {
        const ic = gh.def.icon();
        drawSpr(g, ic, X0 + Math.floor((Wd - ic.w) / 2), Y0 + Math.floor((Hd - ic.h) / 2));
      } else ditherRect(g, X0, Y0, Wd, Hd, 8, C.plum);
      placeMark(g, X0, Y0, Wd, Hd, gh.ok, game.t);
    } else if (under && !gh.ok) {
      outline(g, under.x0, under.y0, under.x1 - under.x0, under.y1 - under.y0, C.wool, game.t);
      ditherRect(g, X0, Y0, Wd, Hd, 6, C.plum);
    } else {
      if (gh.ok) {
        const temp = makeBuilding(gh.def, gh.tx, gh.ty, this.rot);
        const ds = buildingDrawables(g, temp, game.t, false).sort((a, b) => a.y - b.y);
        for (const d of ds) d.draw();
      } else ditherRect(g, X0, Y0, Wd, Hd, 8, C.plum);
      placeMark(g, X0, Y0, Wd, Hd, gh.ok, game.t);
    }
    if (gh.def.id === 'pen') drawGateMark(g, gh.tx, gh.ty, this.rot, gh.ok, game.t);
    // Cursor tile marker.
    rect(g, this.cx * TS + 3, this.cy * TS + 3, 2, 2, C.butter);
  }

  private drawDecorGhost(game: Game, g: CanvasRenderingContext2D) {
    const p = this.pieceDef;
    const { tx, ty } = this.pieceSpot();
    const under = decorAt(game, this.cx, this.cy);
    const ok = !decorBlocked(game, p, tx, ty, (x, y) => this.buildable(game, x, y));
    if (under && !ok) {
      const up = pieceOf(under.id);
      outline(g, under.tx * TS, under.ty * TS, up.w * TS, up.h * TS, C.wool, game.t);
    } else {
      if (ok) pieceDrawable(game, g, p, tx, ty).draw();
      else ditherRect(g, tx * TS, ty * TS, p.w * TS, p.h * TS, 8, C.plum);
      placeMark(g, tx * TS, ty * TS, p.w * TS, p.h * TS, ok, game.t);
    }
    rect(g, this.cx * TS + 3, this.cy * TS + 3, 2, 2, C.butter);
  }

  // Screen-space UI.
  drawUI(game: Game, g: CanvasRenderingContext2D, W: number, H: number): 'exit' | null {
    const ui = game.ui;
    const inp = game.input;
    let result: 'exit' | null = null;
    const S = safeArea(game.screen);
    const top = 2 + S.top, R = W - 2 - S.right;
    const touch = inp.touchMode;
    const th = touch ? 13 : 11, tt = touch ? 4 : 3, p = touch ? 3 : 0;

    // Tabs and DONE.
    let x = 2 + S.left;
    for (const [id, label] of TABS) {
      const w = textWidth(label) + (touch ? 8 : 6);
      const on = this.tab === id;
      panel(g, x, top, w, th, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, label, x + w / 2, top + tt, on ? C.butter : C.wool, { align: 'center' });
      if (ui.click(`tab-${id}`, x - 1, top - p, w + 2, th + p * 2)) this.setTab(game, id);
      x += w + 2;
    }
    const dw = touch ? 34 : 30;
    panel(g, R - dw, top, dw, th, ui.isActive('done') ? C.teal : C.plum, C.butter);
    text(g, 'DONE', R - dw / 2, top + tt, C.wool, { align: 'center' });
    if (ui.click('done', R - dw - p, top - p, dw + p * 2, th + p * 2)) result = 'exit';
    const coinStr = `${game.coins}$`;
    const cw = textWidth(coinStr) + 8;
    panel(g, R - cw, top + th + 2, cw, 11);
    text(g, coinStr, R - 4, top + th + 5, C.wool, { align: 'right', iconColor: C.butter });
    const uiTop = top + th + 14; // world taps start below the top bar

    if (this.tab === 'build') this.drawBuildBar(game, g, W, H);
    else if (this.tab === 'decor') this.drawDecorBar(game, g, W, H);
    else if (this.tab === 'ranch') this.drawRanch(game, g, W, H);
    else if (this.tab === 'dog') this.drawDog(game, g, W, H);
    else this.drawMarket(game, g, W, H);

    if (this.msg) {
      const m = this.msg;
      const tw = textWidth(m.text);
      panel(g, Math.round(W / 2 - tw / 2 - 5), uiTop + 2, tw + 10, 11, C.plum, m.good ? C.butter : C.sage);
      text(g, m.text, W / 2, uiTop + 5, m.good ? C.butter : C.wool, { align: 'center', iconColor: C.butter });
    }

    // World taps / clicks move the cursor (and a mouse click builds).
    if (this.tab === 'build' || this.tab === 'decor') {
      const { ox, oy } = game.view();
      const PR = this.tab === 'build' ? this.padRules() : null;
      if (PR)
        this.paddock.pointers(game, PR, uiTop,
          (tx, ty) => { this.cx = tx; this.cy = ty; },
          (tx, ty, touch) => { this.cx = tx; this.cy = ty; if (!touch) inp.push('confirm'); },
          (tx, ty) => this.paddockAt(game, tx, ty));
      for (const p of inp.ptrs.values()) {
        if (p.justDown && !p.owner && p.y > uiTop) p.owner = 'world';
        if (p.owner === 'world') {
          this.cx = Math.floor((p.x + ox) / TS);
          this.cy = Math.floor((p.y + oy) / TS);
          // A click builds, but never a click beside a paddock being drafted.
          if (p.justUp && !p.touch && Math.hypot(p.x - p.downX, p.y - p.downY) < 3 && !this.paddock.draft) inp.push('confirm');
        }
      }
      const hv = inp.hover;
      if (hv && !inp.touchMode && hv.y > uiTop && hv.y < H - 44 - S.bottom && !this.paddock.busy) {
        this.cx = Math.floor((hv.x + ox) / TS);
        this.cy = Math.floor((hv.y + oy) / TS);
      }
    }
    return result;
  }

  private drawBuildBar(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const n = CATALOG.length;
    const S = safeArea(game.screen);
    const L = 2 + S.left, R_ = W - 2 - S.right;
    const cw = Math.min(28, Math.floor((R_ - L) / n));
    const bx = Math.round((L + R_) / 2 - (cw * n) / 2), by = H - 26 - S.bottom;
    const goalItem = goalBuilding(game);
    panel(g, bx - 2, by - 2, cw * n + 4, 28);
    CATALOG.forEach((d, i) => {
      const x = bx + i * cw;
      const sel = i === this.item;
      // The building the current goal asks for blinks in the bar.
      if (i === goalItem && !sel && Math.floor(game.t * 3) % 2 === 0) panel(g, x, by, cw - 1, 24, C.plum, C.butter);
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
      if (ui.click(`item-${i}`, x, by, cw - 1, 24)) {
        if (i !== this.item) this.paddock.cancel();
        this.item = i;
      }
    });

    // Info card: the paddock being marked out, else the building under the
    // cursor, else the selected item.
    const under = this.buildingAt(game, this.cx, this.cy);
    const ud = under ? defOfKind(under.kind) : null;
    const R = this.padRules();
    const fixTool = !!paddockRules()?.fixtures?.includes(this.def.id);
    const pd = !this.paddock.busy && !fixTool ? this.paddockAt(game, this.cx, this.cy) : null;
    if (R && !pd) {
      const iy = this.paddock.drawCard(game, g, R, (x, y) => this.buildable(game, x, y), L, R_, by - 6, (a) => {
        if (a === 'cancel') this.paddock.cancel();
        else if (this.paddock.draft) game.input.push('confirm');
        else this.paddock.start(R, this.cx, this.cy);
      });
      if (!game.input.touchMode) text(g, this.paddock.prompt(), W / 2, iy - 8, C.wool, { align: 'center', shadow: C.plum });
      return;
    }
    const lines: string[] = [];
    let title = '';
    if (pd) {
      title = `PADDOCK ${pd.w}x${pd.h}`;
      const mix = pd.mix().filter((m) => m.n > 0);
      lines.push(`${pd.used}/${pd.capacity} SPACES${pd.goods ? `, ${pd.goods} GOODS` : ''}`);
      lines.push(mix.length ? mix.map((m) => `${m.n} ${(m.n === 1 ? SPECIES[m.sp].name : SPECIES[m.sp].plural).toUpperCase()}`).join(', ') : 'EMPTY');
      const fx = paddockRules()!.fixtureNames(pd);
      if (fx.length) lines.push(fx.join(', '));
      if (!game.input.touchMode) lines.push('U: EXTEND  X: REMOVE');
    } else if (under && ud && !fixTool && this.def.id !== 'trough') {
      title = `${ud.name}${under.level > 1 ? ' II' : ''}`;
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
    const ih = 13 + lines.length * 6 + (pd ? 6 : 0);
    const iy = by - 6 - ih;
    panel(g, L, iy, R_ - L, ih);
    infoTitle(g, title, L + 4, iy + 3);
    lines.forEach((l, i) => text(g, l, L + 4, iy + 13 + i * 6, C.wool, { iconColor: C.butter }));
    if (pd) {
      // How full it is: a bar of spaces.
      const bw0 = Math.min(R_ - L - 8, 120), bx0 = L + 4, by0 = iy + 13 + lines.length * 6;
      rect(g, bx0, by0, bw0, 4, C.sage);
      rect(g, bx0, by0, Math.round((bw0 * Math.min(pd.used, pd.capacity)) / Math.max(1, pd.capacity)), 4, C.teal);
      rect(g, bx0, by0, bw0, 1, C.plum);
    }

    // Touch buttons.
    if (game.input.touchMode) {
      const bw = 40, bh = 15, rx = R_ - bw;
      let y = iy - bh - 3;
      const btn = (id: string, label: string, act: () => void) => {
        panel(g, rx, y, bw, bh, ui.isActive(id) ? C.teal : C.plum, C.butter);
        text(g, label, rx + bw / 2, y + 5, C.wool, { align: 'center' });
        if (ui.click(id, rx - 3, y - 1, bw + 4, bh + 2)) act();
        y -= bh + 3;
      };
      if (pd) {
        btn('b-rm', 'REMOVE', () => game.input.push('remove'));
        btn('b-ext', 'EXTEND', () => this.extend(game, pd));
      } else {
        btn('b-place', 'BUILD', () => game.input.push('confirm'));
        if (this.def.rotates) btn('b-rot', 'TURN', () => game.input.push('rotate'));
        if (under && ud) {
          btn('b-rm', 'REMOVE', () => game.input.push('remove'));
          if (ud.upgrade && under.level < 2) btn('b-up', 'UPGRADE', () => game.input.push('upgrade'));
        }
      }
    } else {
      text(g, 'ARROWS MOVE  Q/E PICK  R TURN  SPACE BUILD', W / 2, by - ih - 14, C.wool, { align: 'center', shadow: C.plum });
    }
  }

  private drawDog(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const pw = Math.min(W - 8, 170), ph = 20 + (UPGRADES.length + 2) * 16;
    const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
    panel(g, x0, y0, pw, ph);
    const hasKennel = game.ranch.buildings.some((b) => b.kind === 'kennel');
    heading(g, hasKennel ? `TRAIN ${game.look.name}` : 'BUILD A KENNEL', W / 2, y0 + 4, C.butter, { align: 'center', shade: C.moss });
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
    // The dog's look: name, coat and neck piece.
    {
      const i = UPGRADES.length + 1, y = y0 + 16 + i * 16;
      if (this.row === i) rect(g, x0 + 3, y - 2, pw - 6, 15, C.teal);
      text(g, `${game.look.name}'S LOOK`, x0 + 7, y, C.wool);
      text(g, 'COAT, MASK, NECK', x0 + 7, y + 6, C.sage);
      const bw = 34, bx = x0 + pw - bw - 6;
      panel(g, bx, y, bw, 11, ui.isActive('dog-look') ? C.teal : C.plum, C.butter);
      text(g, 'DRESS', bx + bw / 2, y + 3, C.wool, { align: 'center' });
      if (ui.click('dog-look', bx - 2, y - 2, bw + 4, 15)) { this.row = i; game.openLook('kennel'); }
      else if (ui.click('row-look', x0, y - 2, pw - 40, 15)) this.row = i;
    }
  }

  // ---- Decor tab: a bar of pieces, as the build bar ----
  private drawDecorBar(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const n = PIECES.length;
    const S = safeArea(game.screen);
    const L = 2 + S.left, R = W - 2 - S.right;
    const cw = Math.min(26, Math.floor((R - L) / n));
    const bx = Math.round((L + R) / 2 - (cw * n) / 2), by = H - 32 - S.bottom;
    panel(g, bx - 2, by - 2, cw * n + 4, 34);
    PIECES.forEach((p, i) => {
      const x = bx + i * cw;
      const sel = i === this.piece;
      const open = p.open(game);
      if (sel) panel(g, x, by, cw - 1, 30, C.teal, C.butter);
      rect(g, x + 2, by + 2, cw - 5, 19, C.meadow);
      const ic = pieceIcon(p.id);
      const sx = Math.max(0, Math.floor((ic.w - (cw - 5)) / 2)), sw = Math.min(ic.w, cw - 5);
      const sh = Math.min(ic.h, 19);
      g.drawImage(ic.img, sx, ic.h - sh, sw, sh, x + 2 + Math.floor((cw - 5 - sw) / 2), by + 2 + 19 - sh, sw, sh);
      if (!open) ditherRect(g, x + 1, by + 1, cw - 3, 28, 10, C.plum);
      text(g, open ? `${p.cost}` : 'X', x + cw / 2, by + 23, !open ? C.wool : game.coins >= p.cost ? C.butter : C.sage, { align: 'center' });
      if (ui.click(`piece-${i}`, x, by, cw - 1, 30)) this.piece = i;
    });

    // Info card: the piece under the cursor, else the selected one.
    const under = decorAt(game, this.cx, this.cy);
    const lines: string[] = [];
    let title: string;
    if (under) {
      const up = pieceOf(under.id);
      title = up.name;
      lines.push(`X: PICK IT UP (+${up.cost}$)`);
    } else {
      const p = this.pieceDef;
      title = `${p.name}  ${p.cost}$`;
      lines.push(...wrap(p.desc, R - L - 8));
      const { tx, ty } = this.pieceSpot();
      const why = decorBlocked(game, p, tx, ty, (x, y) => this.buildable(game, x, y));
      if (why) lines.push(why);
      else lines.push('DECOR NEVER GETS IN THE STOCK\'S WAY');
    }
    const ih = 13 + lines.length * 6;
    const iy = by - 6 - ih;
    panel(g, L, iy, R - L, ih);
    infoTitle(g, title, L + 4, iy + 3);
    lines.forEach((l, i) => text(g, l, L + 4, iy + 13 + i * 6, C.wool, { iconColor: C.butter }));
    if (game.input.touchMode) {
      const bw = 40, bh = 15, rx = R - bw;
      let y = iy - bh - 3;
      const btn = (id: string, label: string, act: () => void) => {
        panel(g, rx, y, bw, bh, ui.isActive(id) ? C.teal : C.plum, C.butter);
        text(g, label, rx + bw / 2, y + 5, C.wool, { align: 'center' });
        if (ui.click(id, rx - 3, y - 1, bw + 4, bh + 2)) act();
        y -= bh + 3;
      };
      btn('d-place', 'PLACE', () => game.input.push('confirm'));
      if (under) btn('d-rm', 'PICK UP', () => game.input.push('remove'));
    } else {
      text(g, 'ARROWS MOVE  Q/E PICK  SPACE PLACE  X PICK UP', W / 2, iy - 8, C.wool, { align: 'center', shadow: C.plum });
    }
  }

  // ---- Ranch tab: the name on the sign, the farmhouse paint ----
  private drawRanch(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const touch = game.input.touchMode;
    const S = safeArea(game.screen);
    const rh = touch ? 14 : 12, gap = touch ? 3 : 2;
    const pw = Math.min(W - 8 - S.left - S.right, 190);
    const ph = 30 + (RANCH_ROWS.length + 1) * (rh + gap) + 10;
    const x0 = Math.round(W / 2 - pw / 2), y0 = H - S.bottom - 4 - ph;
    panel(g, x0, y0, pw, ph);
    heading(g, 'YOUR RANCH', W / 2, y0 + 4, C.butter, { align: 'center', shade: C.moss });
    const signName = game.look.ranch || tierOf(game.tier).name;
    text(g, `THE SIGN READS: COME BY ${signName}`, W / 2, y0 + 13, C.sage, { align: 'center' });
    let y = y0 + 22;
    const bx = x0 + 6, bw = pw - 12;
    {
      const dice = 16;
      if (ui.hovering(bx, y, bw, rh)) this.row = 0;
      textField(game.screen, g, 'ranchname', bx, y, bw - dice - 3, rh, game.look.ranch || 'NAME YOUR RANCH', RANCH_MAX, (s) => { game.look.ranch = s; }, game.t, this.row === 0, () => {
        game.look.ranch = game.look.ranch.trim();
      });
      const dx = bx + bw - dice;
      panel(g, dx, y, dice, rh, ui.isActive('ranch-dice') ? C.teal : C.plum, C.butter);
      text(g, '?', dx + dice / 2 + 1, y + Math.floor((rh - 5) / 2), C.butter, { align: 'center' });
      if (ui.click('ranch-dice', dx - 1, y - 2, dice + 2, rh + 4)) {
        stopTyping();
        game.look.ranch = pickName(RANCH_NAMES, game.look.ranch);
        this.row = 0;
      }
      y += rh + gap;
    }
    RANCH_ROWS.forEach((r, i) => {
      const sel = this.row === i + 1;
      if (optionRow(game, g, `ranch-${i}`, bx, y, bw, rh, r.label, r.value(game), sel, (d) => { this.row = i + 1; r.step(game, d); applyLook(game.look); })) this.row = i + 1;
      y += rh + gap;
    });
    ui.captureAll('ranch-bg');
  }

  private drawMarket(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
    const ui = game.ui;
    const pens = game.ranch.pens.filter((p) => p.animals.length);
    const hasMarket = game.ranch.buildings.some((b) => b.kind === 'market');
    const pw = Math.min(W - 8, 176), ph = 34 + Math.max(1, pens.length) * 14;
    const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
    panel(g, x0, y0, pw, ph);
    heading(g, hasMarket ? 'MARKET STALL' : 'NO MARKET YET', W / 2, y0 + 4, C.butter, { align: 'center', shade: C.moss });
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

// An info card's title: the name in the heading face, a price after it in
// the body face ("KENNEL  15$").
function infoTitle(g: CanvasRenderingContext2D, title: string, x: number, y: number) {
  const m = title.match(/^(.*?)( {2}\d+\$)?$/);
  const name = m?.[1] ?? title, price = m?.[2] ?? '';
  const w = heading(g, name, x, y, C.butter, { shade: C.moss });
  if (price) text(g, price.trim(), x + w + 5, y + 2, C.wool, { iconColor: C.butter });
}

// Where the piece would go: gilt corner brackets that breathe in and out
// when it can be built there, a plum cross over the spot when it cannot.
function placeMark(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ok: boolean, t: number) {
  if (!ok) {
    g.fillStyle = C.plum;
    const n = Math.min(w, h);
    for (let i = 0; i < n; i++) {
      const fx = Math.round((i / n) * w), fy = Math.round((i / n) * h);
      g.fillRect(x + fx, y + fy, 1, 1);
      g.fillRect(x + w - 1 - fx, y + fy, 1, 1);
    }
    outline(g, x, y, w, h, C.plum, t);
    return;
  }
  const o = Math.floor(t * 3) % 2; // one pixel out, then back
  const L = 4;
  for (const [cx, cy, sx, sy] of [[x - o, y - o, 1, 1], [x + w - 1 + o, y - o, -1, 1], [x - o, y + h - 1 + o, 1, -1], [x + w - 1 + o, y + h - 1 + o, -1, -1]]) {
    g.fillStyle = C.plum;
    g.fillRect(Math.min(cx, cx + sx * (L - 1)), cy + sy, L, 1);
    g.fillRect(cx + sx, Math.min(cy, cy + sy * (L - 1)), 1, L);
    g.fillStyle = C.butter;
    g.fillRect(Math.min(cx, cx + sx * (L - 1)), cy, L, 1);
    g.fillRect(cx, Math.min(cy, cy + sy * (L - 1)), 1, L);
  }
}

function outline(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, t: number) {
  g.fillStyle = col;
  const off = Math.floor(t * 8) % 4;
  for (let i = 0; i < w; i++) if ((i + off) % 4 < 2) { g.fillRect(x + i, y, 1, 1); g.fillRect(x + i, y + h - 1, 1, 1); }
  for (let i = 0; i < h; i++) if ((i + off) % 4 < 2) { g.fillRect(x, y + i, 1, 1); g.fillRect(x + w - 1, y + i, 1, 1); }
}
