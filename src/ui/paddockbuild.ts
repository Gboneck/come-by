import { C } from '../palette';
import { prose, sentence } from './case';
import { ditherRect, px, rect } from '../gfx/draw';
import { heading, text, textWidth, lineHeight } from '../gfx/font';
import type { Game } from '../game';
import type { Building } from '../ranch/buildings';
import { SPECIES } from '../entities/species';
import { TS, type SpeciesId } from '../world/map';
import { buildingDrawables } from '../render/world';
import { panel } from './frame';
import { clamp } from '../util';

// Paddocks in build mode: a field you mark out yourself. Drag out a
// rectangle (or drop one at the cursor), then size it by its side handles,
// slide the gate along the fence, move it whole, and build. A built
// paddock reopens in the same editor to be extended, its sides only going
// outward. Phones get steppers for every handle, so no drag ever needs to
// be precise; keys and pads cycle the handle the arrows move.
//
// The rules (price, what it holds, where it may go) are the ranch's; this
// file only asks them, through PaddockRules.

export type Side = 0 | 1 | 2 | 3; // as Rot: 0 south, 1 west, 2 north, 3 east
export interface PRect { tx: number; ty: number; w: number; h: number } // tiles, the fence line included
export interface GateAt { side: Side; at: number } // first gate tile along the side, from its west / north end
export interface Holding { sp: SpeciesId; n: number }

export interface PaddockLike extends Building {
  readonly gate: GateAt;
  capacity: number;
  used: number;
  goods: number;
  mix(): Holding[];
}

export interface PaddockRules {
  tool: string; // the catalog item that marks out paddocks
  size: { minW: number; minH: number; maxW: number; maxH: number; gateW: number; minArea?: number };
  price(r: PRect): number;
  holds(r: PRect): Holding[];
  gateRange(r: PRect, side: Side): [number, number];
  // Why it cannot go there (null: it can). `land` is build mode's own
  // test: ranch land, within reach, off the farmhouse lot.
  problem(game: Game, r: PRect, gate: GateAt, land: (tx: number, ty: number) => boolean): string | null;
  build(game: Game, r: PRect, gate: GateAt): Building | null; // pays and adds it (counts it built)
  extendPrice(p: PaddockLike, r: PRect): number;
  extendProblem(game: Game, p: PaddockLike, r: PRect, land: (tx: number, ty: number) => boolean): string | null;
  extend(game: Game, p: PaddockLike, r: PRect): boolean; // pays the difference
  moveGate(game: Game, p: PaddockLike, gate: GateAt): string | null;
  remove(game: Game, p: PaddockLike): string | null;
  is(b: Building): b is PaddockLike;
  fixtureNames(p: PaddockLike): string[]; // for its card
  // A stand-in building for the preview, drawn as the real thing when the
  // spot is good.
  ghost?(r: PRect, gate: GateAt): Building;
  // Catalog items that go inside a paddock (troughs, shelters, hay racks):
  // build mode charges their catalog price, then places them.
  fixtures?: string[];
  fixtureProblem?(game: Game, p: PaddockLike, id: string, tx: number, ty: number): string | null;
  placeFixture?(game: Game, p: PaddockLike, id: string, tx: number, ty: number): void;
}

let RULES: PaddockRules | null = null;
export function setPaddockRules(r: PaddockRules | null) {
  RULES = r;
}
export function paddockRules(): PaddockRules | null {
  return RULES;
}

export type Handle = 'move' | 'e' | 's' | 'w' | 'n' | 'gate';
const CYCLE: Handle[] = ['move', 'e', 's', 'w', 'n', 'gate'];
const SIDE_NAME: Record<string, string> = { e: 'EAST', s: 'SOUTH', w: 'WEST', n: 'NORTH' };

interface Draft { r: PRect; gate: GateAt; base: PaddockLike | null }
interface Drag { id: number; what: Handle | 'band'; wx: number; wy: number; r0: PRect; g0: GateAt; moved: boolean }
type Land = (tx: number, ty: number) => boolean;

const copyR = (r: PRect): PRect => ({ tx: r.tx, ty: r.ty, w: r.w, h: r.h });
const sameR = (a: PRect, b: PRect) => a.tx === b.tx && a.ty === b.ty && a.w === b.w && a.h === b.h;

// "HOLDS 12 SHEEP / 24 DUCKS", the first few kinds.
export function holdsLine(hs: Holding[], max = 3): string {
  const parts = hs.filter((h) => h.n > 0).slice(0, max).map((h) => `${h.n} ${(h.n === 1 ? SPECIES[h.sp].name : SPECIES[h.sp].plural).toUpperCase()}`);
  return parts.length ? `HOLDS ${parts.join(' / ')}` : 'TOO SMALL TO HOLD STOCK';
}

export class PaddockEditor {
  draft: Draft | null = null;
  band: PRect | null = null; // being dragged out, before it is a draft
  handle: Handle = 'move';
  private drag: Drag | null = null;

  get busy() {
    return !!this.draft || !!this.band;
  }

  // A draft of the usual size, centred on the cursor, the gate in the
  // middle of the south side.
  start(R: PaddockRules, cx: number, cy: number, r?: PRect) {
    const s = R.size;
    const w = clamp(r?.w ?? 8, s.minW, s.maxW), h = clamp(r?.h ?? 7, s.minH, s.maxH);
    const rr = r ? { tx: r.tx, ty: r.ty, w, h } : { tx: cx - Math.floor(w / 2), ty: cy - Math.floor(h / 2), w, h };
    while (s.minArea && rr.w * rr.h < s.minArea && rr.w < s.maxW) rr.w++;
    this.draft = { r: rr, gate: { side: 0, at: Math.floor((w - s.gateW) / 2) }, base: null };
    this.handle = r ? 'e' : 'move';
    this.fixGate(R);
  }

  // Reopen a built paddock to extend it (or move its gate).
  extendFrom(R: PaddockRules, p: PaddockLike) {
    this.draft = { r: { tx: p.tx, ty: p.ty, w: p.w, h: p.h }, gate: { ...p.gate }, base: p };
    this.handle = 'e';
    this.fixGate(R);
  }

  cancel() {
    this.draft = null;
    this.band = null;
    this.drag = null;
  }

  // ---- Edits ----

  private fixGate(R: PaddockRules) {
    const d = this.draft!;
    const [a0, a1] = R.gateRange(d.r, d.gate.side);
    d.gate.at = clamp(d.gate.at, a0, Math.max(a0, a1));
  }

  // Move one edge (tile coordinates; right and bottom exclusive), held to
  // the size limits and, when extending, never inside the old fence. A
  // gate on a side running along the moved edge keeps its place.
  private setEdge(R: PaddockRules, e: 'l' | 't' | 'r' | 'b', v: number) {
    const d = this.draft!, r = d.r, s = R.size, b = d.base;
    let L = r.tx, T = r.ty, Rr = r.tx + r.w, B = r.ty + r.h;
    if (e === 'r') { v = clamp(v, L + s.minW, L + s.maxW); if (b) v = Math.max(v, b.tx + b.w); Rr = v; }
    if (e === 'l') { v = clamp(v, Rr - s.maxW, Rr - s.minW); if (b) v = Math.min(v, b.tx); L = v; }
    if (e === 'b') { v = clamp(v, T + s.minH, T + s.maxH); if (b) v = Math.max(v, b.ty + b.h); B = v; }
    if (e === 't') { v = clamp(v, B - s.maxH, B - s.minH); if (b) v = Math.min(v, b.ty); T = v; }
    if (d.gate.side === 0 || d.gate.side === 2) d.gate.at += r.tx - L;
    else d.gate.at += r.ty - T;
    r.tx = L; r.ty = T; r.w = Rr - L; r.h = B - T;
    this.fixGate(R);
  }

  private pushSide(R: PaddockRules, side: 'e' | 's' | 'w' | 'n', out: number) {
    const r = this.draft!.r;
    if (side === 'e') this.setEdge(R, 'r', r.tx + r.w + out);
    if (side === 's') this.setEdge(R, 'b', r.ty + r.h + out);
    if (side === 'w') this.setEdge(R, 'l', r.tx - out);
    if (side === 'n') this.setEdge(R, 't', r.ty - out);
  }

  // Every gate position, clockwise from the north-west corner.
  private ring(R: PaddockRules, r: PRect): GateAt[] {
    const out: GateAt[] = [];
    const add = (side: Side, rev: boolean) => {
      const [a, b] = R.gateRange(r, side);
      const xs: number[] = [];
      for (let i = a; i <= b; i++) xs.push(i);
      if (rev) xs.reverse();
      for (const at of xs) out.push({ side, at });
    };
    add(2, false); add(3, false); add(0, true); add(1, true);
    return out;
  }

  // Walk the gate round the fence, a tile at a time (1 clockwise).
  gateStep(R: PaddockRules, d: 1 | -1) {
    const dr = this.draft;
    if (!dr) return;
    const ring = this.ring(R, dr.r);
    if (!ring.length) return;
    const i = Math.max(0, ring.findIndex((g) => g.side === dr.gate.side && g.at === dr.gate.at));
    dr.gate = { ...ring[(i + d + ring.length) % ring.length] };
  }

  // The steppers: W and H grow or shrink the east and south sides.
  step(R: PaddockRules, what: 'w' | 'h', d: 1 | -1) {
    if (!this.draft) return;
    this.pushSide(R, what === 'w' ? 'e' : 's', d);
    this.handle = what === 'w' ? 'e' : 's';
  }

  nextHandle(dir: 1 | -1 = 1) {
    const cyc = this.draft?.base ? CYCLE.filter((h) => h !== 'move') : CYCLE;
    const i = Math.max(0, cyc.indexOf(this.handle));
    this.handle = cyc[(i + dir + cyc.length) % cyc.length];
  }

  // An arrow key (or the pad) for the handle in hand.
  nudge(R: PaddockRules, dir: 'up' | 'down' | 'left' | 'right') {
    const d = this.draft;
    if (!d) return;
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const h = this.handle;
    if (h === 'move') {
      if (d.base) return;
      d.r.tx += dx;
      d.r.ty += dy;
    } else if (h === 'gate') {
      // Along the side it is on; past a corner it carries on round.
      const s = d.gate.side;
      const along = s === 0 ? -dx : s === 2 ? dx : s === 3 ? dy : -dy;
      if (along) this.gateStep(R, along > 0 ? 1 : -1);
    } else {
      // The arrow pointing out of the side pushes it out, the other pulls it in.
      const out = h === 'e' ? dx : h === 'w' ? -dx : h === 's' ? dy : -dy;
      if (out) this.pushSide(R, h, out);
    }
  }

  // ---- Committing ----

  // What a build would cost now, and why it cannot be built (null: it can).
  quote(game: Game, R: PaddockRules, land: Land): { cost: number; why: string | null; changed: boolean } {
    const d = this.draft!;
    if (d.base) {
      const grown = !sameR(d.r, d.base);
      const gateMoved = d.gate.side !== d.base.gate.side || d.gate.at !== d.base.gate.at;
      const cost = grown ? R.extendPrice(d.base, d.r) : 0;
      let why = grown ? R.extendProblem(game, d.base, d.r, land) : null;
      if (!why && cost > game.coins) why = `NEED ${cost}$`;
      if (!grown && !gateMoved) why = 'DRAG A SIDE OUT TO EXTEND';
      return { cost, why, changed: grown || gateMoved };
    }
    const cost = R.price(d.r);
    let why = R.problem(game, d.r, d.gate, land);
    if (!why && cost > game.coins) why = `NEED ${cost}$`;
    return { cost, why, changed: true };
  }


  // ---- Pointers: drag out a band, or the handles ----

  private knobs(d: Draft, touch: boolean): { h: Handle; x: number; y: number }[] {
    const { tx, ty, w, h } = d.r;
    const X0 = tx * TS, Y0 = ty * TS, X1 = (tx + w) * TS, Y1 = (ty + h) * TS;
    const g = gateBox(d.r, d.gate, RULES!.size.gateW);
    const gm = { x: (g.x0 + g.x1) / 2, y: (g.y0 + g.y1) / 2 };
    // Each side's handle sits just outside the fence at its middle, or at
    // a quarter of the way along when the gate is in the middle.
    const o = touch ? 6 : 5;
    const mid = (a: number, b: number, gate: number | null) => {
      const m = (a + b) / 2;
      if (gate === null || Math.abs(gate - m) > 2.5 * TS) return m;
      return gate < m ? (m + b) / 2 : (a + m) / 2;
    };
    const s = d.gate.side;
    const out: { h: Handle; x: number; y: number }[] = [
      { h: 'e', x: X1 + o - 1, y: mid(Y0, Y1, s === 3 ? gm.y : null) },
      { h: 's', x: mid(X0, X1, s === 0 ? gm.x : null), y: Y1 + o - 1 },
      { h: 'w', x: X0 - o, y: mid(Y0, Y1, s === 1 ? gm.y : null) },
      { h: 'n', x: mid(X0, X1, s === 2 ? gm.x : null), y: Y0 - o },
      { h: 'gate', x: gm.x, y: gm.y },
    ];
    return out.map((k) => ({ ...k, x: Math.round(k.x), y: Math.round(k.y) }));
  }

  // Claims world pointers that land on the draft (or, with no draft, drag
  // out a new one). Returns true while a pointer is held by the editor.
  pointers(game: Game, R: PaddockRules, uiTop: number, setCursor: (tx: number, ty: number) => void, onTap: (tx: number, ty: number, touch: boolean) => void, extendAt: (tx: number, ty: number) => PaddockLike | null): boolean {
    const { ox, oy } = game.view();
    const touch = game.input.touchMode;
    let held = false;
    for (const p of game.input.ptrs.values()) {
      const wx = p.x + ox, wy = p.y + oy;
      const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
      if (p.justDown && !p.owner && p.y > uiTop) {
        const d = this.draft;
        if (d) {
          const rad = touch ? 10 : 6;
          let best: Handle | null = null, bd = rad * rad + 1;
          for (const k of this.knobs(d, touch)) {
            const dd = (k.x - wx) ** 2 + (k.y - wy) ** 2;
            if (dd < bd) { bd = dd; best = k.h; }
          }
          const r = d.r;
          const inside = wx >= r.tx * TS && wx < (r.tx + r.w) * TS && wy >= r.ty * TS && wy < (r.ty + r.h) * TS;
          if (!best && inside && !d.base) best = 'move';
          if (best) {
            p.owner = 'paddock';
            this.handle = best;
            this.drag = { id: p.id, what: best, wx, wy, r0: copyR(d.r), g0: { ...d.gate }, moved: false };
          }
        } else if (!extendAt(tx, ty)) {
          p.owner = 'paddock';
          this.drag = { id: p.id, what: 'band', wx, wy, r0: { tx, ty, w: 1, h: 1 }, g0: { side: 0, at: 0 }, moved: false };
        }
      }
      const dg = this.drag;
      if (p.owner !== 'paddock' || !dg || dg.id !== p.id) continue;
      held = true;
      setCursor(tx, ty);
      const ddx = Math.round((wx - dg.wx) / TS), ddy = Math.round((wy - dg.wy) / TS);
      if (Math.abs(wx - dg.wx) > 3 || Math.abs(wy - dg.wy) > 3) dg.moved = true;
      if (dg.what === 'band') {
        if (dg.moved) this.band = bandRect(R, dg.r0.tx, dg.r0.ty, tx, ty);
      } else if (this.draft) {
        const d = this.draft;
        d.r = copyR(dg.r0);
        d.gate = { ...dg.g0 };
        if (dg.what === 'move') { d.r.tx += ddx; d.r.ty += ddy; }
        else if (dg.what === 'gate') d.gate = nearestGate(R, d.r, wx, wy);
        else if (dg.what === 'e') this.setEdge(R, 'r', dg.r0.tx + dg.r0.w + ddx);
        else if (dg.what === 'w') this.setEdge(R, 'l', dg.r0.tx + ddx);
        else if (dg.what === 's') this.setEdge(R, 'b', dg.r0.ty + dg.r0.h + ddy);
        else if (dg.what === 'n') this.setEdge(R, 't', dg.r0.ty + ddy);
      }
      if (p.justUp) {
        if (dg.what === 'band') {
          if (this.band) this.start(R, 0, 0, this.band);
          else onTap(tx, ty, p.touch);
          this.band = null;
        }
        this.drag = null;
      }
    }
    return held;
  }

  // ---- Drawing ----

  // The draft (or the band being dragged out, or where one would go) over
  // the world.
  drawWorld(game: Game, g: CanvasRenderingContext2D, R: PaddockRules, land: Land, cx: number, cy: number) {
    const t = game.t;
    const touch = game.input.touchMode;
    if (this.band) {
      drawFence(g, this.band, null, R.size.gateW, 'band', t);
      sizeTag(g, this.band);
      return;
    }
    const d = this.draft;
    if (!d) {
      // Where a paddock of the usual size would go: a faint outline.
      const w = clamp(8, R.size.minW, R.size.maxW), h = clamp(7, R.size.minH, R.size.maxH);
      const r = { tx: cx - Math.floor(w / 2), ty: cy - Math.floor(h / 2), w, h };
      drawFence(g, r, { side: 0, at: Math.floor((w - R.size.gateW) / 2) }, R.size.gateW, 'hint', t);
      rect(g, cx * TS + 3, cy * TS + 3, 2, 2, C.butter);
      return;
    }
    const q = this.quote(game, R, land);
    const bad = badTiles(game, d, land);
    const r = d.r;
    // The ground inside: refused tiles in plum, new ground (extending) in
    // a light buttercup wash, the rest a faint wool wash to show the area.
    for (let y = r.ty; y < r.ty + r.h; y++)
      for (let x = r.tx; x < r.tx + r.w; x++) {
        const b = d.base;
        const old = b && x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h;
        if (bad.has(y * 4096 + x)) ditherRect(g, x * TS, y * TS, TS, TS, 5, C.plum);
        else if (!old) ditherRect(g, x * TS, y * TS, TS, TS, b ? 4 : 2, b ? C.butter : C.wool);
      }
    if (!q.why && !d.base && R.ghost) {
      const ds = buildingDrawables(g, R.ghost(r, d.gate), t, false).sort((a, b) => a.y - b.y);
      for (const dr of ds) dr.draw();
    } else drawFence(g, r, d.gate, R.size.gateW, q.why ? 'bad' : 'good', t);
    if (d.base) drawFence(g, d.base, null, 0, 'old', t);
    // Handles: the one the arrows move breathes in buttercup.
    for (const k of this.knobs(d, touch)) {
      if (k.h === 'gate') gateKnob(g, k.x, k.y, this.handle === 'gate', t);
      else knob(g, k.x, k.y, k.h, this.handle === k.h, touch, t);
    }
    if (this.handle === 'move' && !d.base) {
      // Four little arrows at the middle: it moves as a whole.
      const mx = Math.round((r.tx + r.w / 2) * TS), my = Math.round((r.ty + r.h / 2) * TS);
      const o = Math.floor(t * 3) % 2;
      for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const bx = mx + ax * (4 + o), by = my + ay * (4 + o);
        rect(g, bx - 1, by - 1, 3, 3, C.plum);
        px(g, bx, by, C.butter);
      }
    }
    sizeTag(g, r);
  }

  // The card above the build bar: name and price, what it holds, why not,
  // and (on touch) the steppers and buttons. Returns its top edge.
  drawCard(game: Game, g: CanvasRenderingContext2D, R: PaddockRules, land: Land, L: number, Rx: number, bottom: number, act: (a: 'build' | 'cancel') => void): number {
    const ui = game.ui;
    const touch = game.input.touchMode;
    const d = this.draft;
    const W = Rx - L;
    const lines: { s: string; c: string }[] = [];
    let title: string, price = '';
    if (!d) {
      title = 'PADDOCK';
      const r = this.band ?? { tx: 0, ty: 0, w: 8, h: 7 };
      price = this.band ? `${R.price(r)}$` : `FROM ${R.price({ tx: 0, ty: 0, w: R.size.minW, h: R.size.minH })}$`;
      lines.push({ s: holdsLine(R.holds(r)), c: C.wool });
      lines.push({ s: touch ? 'DRAG OUT A FIELD, OR TAP MARK OUT' : 'DRAG ONE OUT, OR SPACE TO MARK ONE OUT', c: C.sage });
    } else {
      const q = this.quote(game, R, land);
      title = d.base ? 'EXTEND' : `PADDOCK ${d.r.w}x${d.r.h}`;
      price = d.base ? (q.cost ? `+${q.cost}$` : 'FREE') : `${q.cost}$`;
      lines.push({ s: holdsLine(R.holds(d.r)), c: C.wool });
      if (q.why) for (const l of prose(q.why, W - 8)) lines.push({ s: l, c: C.butter });
    }
    const rowH = touch ? 17 : 0;
    const rows = touch && d ? 2 : touch ? 1 : 0;
    const ch = 13 + lines.length * lineHeight() + rows * rowH + (rows ? 2 : 0);
    const y0 = bottom - ch;
    panel(g, L, y0, W, ch);
    const tw = heading(g, title, L + 4, y0 + 3, C.butter, { shade: C.moss });
    text(g, price, L + 4 + tw + 5, y0 + 5, C.wool, { iconColor: C.butter });
    lines.forEach((l, i) => text(g, sentence(l.s), L + 4, y0 + 13 + i * lineHeight(), l.c, { iconColor: C.butter }));

    if (touch) {
      // Buttons: a row of steppers, then CANCEL and BUILD.
      let y = y0 + 13 + lines.length * lineHeight() + 2;
      const btn = (id: string, x: number, w: number, label: string, on: boolean, fn: () => void, rim: string = C.sage) => {
        panel(g, x, y, w, rowH - 2, ui.isActive(id) ? C.teal : C.plum, on ? rim : C.plum);
        if (label.length === 1) glyph(g, label, Math.round(x + w / 2), y + Math.floor((rowH - 2) / 2), on ? C.wool : C.sage);
        else text(g, label, x + w / 2, y + Math.floor((rowH - 7) / 2), on ? C.wool : C.sage, { align: 'center', iconColor: C.butter });
        if (on && ui.click(id, x - 1, y - 1, w + 2, rowH)) fn();
      };
      if (d) {
        const sw = 15;
        let x = L + 4;
        const pair = (label: string, id: string, minus: () => void, plus: () => void) => {
          text(g, label, x, y + Math.floor((rowH - 7) / 2), C.sage);
          x += textWidth(label) + 3;
          btn(`${id}-`, x, sw, id === 'pd-g' ? '<' : '-', true, minus);
          x += sw + 2;
          btn(`${id}+`, x, sw, id === 'pd-g' ? '>' : '+', true, plus);
          x += sw + 6;
        };
        pair('W', 'pd-w', () => this.step(R, 'w', -1), () => this.step(R, 'w', 1));
        pair('H', 'pd-h', () => this.step(R, 'h', -1), () => this.step(R, 'h', 1));
        pair('GATE', 'pd-g', () => { this.handle = 'gate'; this.gateStep(R, -1); }, () => { this.handle = 'gate'; this.gateStep(R, 1); });
        y += rowH;
      }
      const q = d ? this.quote(game, R, land) : null;
      const bw = Math.min(70, Math.floor((W - 12) / 2));
      if (d) btn('pd-cancel', L + 4, bw, 'CANCEL', true, () => act('cancel'));
      const ok = d ? !q!.why : true;
      const label = d ? (d.base ? 'EXTEND' : 'BUILD') : 'MARK OUT';
      btn('pd-build', Rx - 4 - bw, bw, label, ok, () => act('build'), C.butter);
    }
    return y0;
  }

  // The keyboard's line for the handle in hand.
  prompt(): string {
    const d = this.draft;
    if (!d) return 'ARROWS MOVE  Q/E PICK  SPACE MARK OUT';
    const h = this.handle;
    const what = h === 'move' ? 'ARROWS MOVE IT' : h === 'gate' ? 'ARROWS SLIDE THE GATE' : `ARROWS PUSH THE ${SIDE_NAME[h]} SIDE`;
    return `${what}  R: NEXT HANDLE  SPACE: ${d.base ? 'EXTEND' : 'BUILD'}  ESC: CANCEL`;
  }
}

// ---- Geometry ----

// The gate's opening in pixels, on the fence line.
function gateBox(r: PRect, gate: GateAt, gw: number): { x0: number; y0: number; x1: number; y1: number } {
  const X0 = r.tx * TS, Y0 = r.ty * TS, X1 = (r.tx + r.w) * TS, Y1 = (r.ty + r.h) * TS;
  const a = gate.at * TS, l = gw * TS;
  switch (gate.side) {
    case 0: return { x0: X0 + a, y0: Y1 - 4, x1: X0 + a + l, y1: Y1 };
    case 2: return { x0: X0 + a, y0: Y0, x1: X0 + a + l, y1: Y0 + 4 };
    case 1: return { x0: X0, y0: Y0 + a, x1: X0 + 4, y1: Y0 + a + l };
    default: return { x0: X1 - 4, y0: Y0 + a, x1: X1, y1: Y0 + a + l };
  }
}

// The gate position nearest a point: on the side the point is closest to.
function nearestGate(R: PaddockRules, r: PRect, wx: number, wy: number): GateAt {
  const X0 = r.tx * TS, Y0 = r.ty * TS, X1 = (r.tx + r.w) * TS, Y1 = (r.ty + r.h) * TS;
  const cxp = clamp(wx, X0, X1), cyp = clamp(wy, Y0, Y1);
  const ds: [Side, number][] = [[0, Math.abs(wy - Y1) + Math.abs(wx - cxp)], [2, Math.abs(wy - Y0) + Math.abs(wx - cxp)], [1, Math.abs(wx - X0) + Math.abs(wy - cyp)], [3, Math.abs(wx - X1) + Math.abs(wy - cyp)]];
  ds.sort((a, b) => a[1] - b[1]);
  const side = ds[0][0];
  const along = side === 0 || side === 2 ? (wx - X0) / TS : (wy - Y0) / TS;
  const [a0, a1] = R.gateRange(r, side);
  return { side, at: clamp(Math.round(along - R.size.gateW / 2), a0, Math.max(a0, a1)) };
}

// A band from one tile to another, inclusive, grown to the least size in
// the direction it was dragged.
function bandRect(R: PaddockRules, ax: number, ay: number, bx: number, by: number): PRect {
  const s = R.size;
  let L = Math.min(ax, bx), Rr = Math.max(ax, bx) + 1, T = Math.min(ay, by), B = Math.max(ay, by) + 1;
  if (Rr - L < s.minW) { if (bx >= ax) Rr = L + s.minW; else L = Rr - s.minW; }
  if (B - T < s.minH) { if (by >= ay) B = T + s.minH; else T = B - s.minH; }
  if (Rr - L > s.maxW) { if (bx >= ax) Rr = L + s.maxW; else L = Rr - s.maxW; }
  if (B - T > s.maxH) { if (by >= ay) B = T + s.maxH; else T = B - s.maxH; }
  // Big enough to hold stock: wider first, the way it was dragged.
  while (s.minArea && (Rr - L) * (B - T) < s.minArea && Rr - L < s.maxW) { if (bx >= ax) Rr++; else L--; }
  return { tx: L, ty: T, w: Rr - L, h: B - T };
}

// Tiles a draft cannot use (key y*4096+x): off the land, the drove road,
// another building (the paddock being extended is not in the way).
function badTiles(game: Game, d: Draft, land: Land): Set<number> {
  const out = new Set<number>();
  const r = d.r;
  for (let y = r.ty; y < r.ty + r.h; y++)
    for (let x = r.tx; x < r.tx + r.w; x++) {
      const b = d.base;
      if (b && x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) continue;
      if (!land(x, y) || game.ranch.onRoad(x, y)) out.add(y * 4096 + x);
    }
  for (const b of game.ranch.buildings) {
    if (b === d.base || b.kind === 'regiongate' || !b.overlapsTiles(r.tx, r.ty, r.w, r.h)) continue;
    for (let y = Math.max(r.ty, b.ty); y < Math.min(r.ty + r.h, b.ty + b.h); y++)
      for (let x = Math.max(r.tx, b.tx); x < Math.min(r.tx + r.w, b.tx + b.w); x++) out.add(y * 4096 + x);
  }
  return out;
}

// ---- Art ----

// A fence drawn as a plan: posts at every tile, two rails between, the gate
// a gap with buttercup posts. 'good' in wool, 'bad' in plum, the band being
// dragged out dashed, 'old' (the fence being extended) faint, 'hint' the
// faintest.
function drawFence(g: CanvasRenderingContext2D, r: PRect, gate: GateAt | null, gw: number, style: 'good' | 'bad' | 'band' | 'old' | 'hint', t: number) {
  const X0 = r.tx * TS, Y0 = r.ty * TS, X1 = (r.tx + r.w) * TS, Y1 = (r.ty + r.h) * TS;
  const gb = gate ? gateBox(r, gate, gw) : null;
  const inGate = (x: number, y: number) => !!gb && x >= gb.x0 && x < gb.x1 && y >= gb.y0 && y < gb.y1;
  const rail = style === 'bad' ? C.plum : style === 'old' || style === 'hint' ? C.sage : C.wool;
  const off = Math.floor(t * 8) % 4;
  const dash = (i: number) => style === 'band' || style === 'hint' ? (i + off) % 4 < 2 : style === 'old' ? i % 2 === 0 : true;
  g.fillStyle = rail;
  // Rails one and three pixels in from the outside edge.
  for (let i = 0; i < X1 - X0; i++) {
    if (!dash(i)) continue;
    const x = X0 + i;
    for (const y of [Y0 + 1, Y0 + 3]) if (!inGate(x, y)) g.fillRect(x, y, 1, 1);
    for (const y of [Y1 - 4, Y1 - 2]) if (!inGate(x, y)) g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < Y1 - Y0; i++) {
    if (!dash(i)) continue;
    const y = Y0 + i;
    for (const x of [X0 + 1, X0 + 3]) if (!inGate(x, y)) g.fillRect(x, y, 1, 1);
    for (const x of [X1 - 4, X1 - 2]) if (!inGate(x, y)) g.fillRect(x, y, 1, 1);
  }
  if (style === 'old' || style === 'hint') return;
  // Posts, every tile, plum with a light cap.
  const post = (x: number, y: number) => {
    if (inGate(x + 1, y + 1)) return;
    rect(g, x, y, 2, 4, C.plum);
    px(g, x, y, style === 'bad' ? C.sage : C.wool);
  };
  for (let x = X0; x <= X1 - 2; x += TS) { post(x, Y0); post(x, Y1 - 4); }
  post(X1 - 2, Y0); post(X1 - 2, Y1 - 4);
  for (let y = Y0 + TS; y < Y1 - 4; y += TS) { post(X0, y); post(X1 - 2, y); }
  if (gb) {
    // The gateway: buttercup posts either side and a dotted swing line.
    const vert = gate!.side === 1 || gate!.side === 3;
    g.fillStyle = C.butter;
    if (vert) {
      g.fillRect(gb.x0, gb.y0 - 1, 4, 2);
      g.fillRect(gb.x0, gb.y1 - 1, 4, 2);
      for (let y = gb.y0 + 1; y < gb.y1 - 1; y += 2) g.fillRect(gb.x0 + 2, y, 1, 1);
    } else {
      g.fillRect(gb.x0 - 1, gb.y0, 2, 4);
      g.fillRect(gb.x1 - 1, gb.y0, 2, 4);
      for (let x = gb.x0 + 1; x < gb.x1 - 1; x += 2) g.fillRect(x, gb.y0 + 2, 1, 1);
    }
  }
}

// A side handle: a round plum knob with an arrow pointing outward.
function knob(g: CanvasRenderingContext2D, x: number, y: number, h: Handle, on: boolean, big: boolean, t: number) {
  const [dx, dy] = h === 'e' ? [1, 0] : h === 'w' ? [-1, 0] : h === 's' ? [0, 1] : [0, -1];
  const bob = on && Math.floor(t * 3) % 2 ? 1 : 0;
  x += dx * bob;
  y += dy * bob;
  const r = big ? 4 : 3;
  rect(g, x - r + 1, y - r, r * 2 - 1, r * 2 + 1, C.plum);
  rect(g, x - r, y - r + 1, r * 2 + 1, r * 2 - 1, C.plum);
  const fill = on ? C.butter : C.wool;
  rect(g, x - r + 2, y - r + 1, r * 2 - 3, r * 2 - 1, fill);
  rect(g, x - r + 1, y - r + 2, r * 2 - 1, r * 2 - 3, fill);
  // The arrow: a little wedge pointing out of the side.
  g.fillStyle = C.plum;
  if (dx) {
    g.fillRect(x + dx, y - 1, 1, 3);
    g.fillRect(x - dx, y, 1, 1);
    g.fillRect(x, y - 1, 1, 3);
    g.fillRect(x + dx * 2, y, 1, 1);
  } else {
    g.fillRect(x - 1, y + dy, 3, 1);
    g.fillRect(x, y - dy, 1, 1);
    g.fillRect(x - 1, y, 3, 1);
    g.fillRect(x, y + dy * 2, 1, 1);
  }
}

// The gate's knob: a buttercup diamond on the fence line.
function gateKnob(g: CanvasRenderingContext2D, x: number, y: number, on: boolean, t: number) {
  const r = on && Math.floor(t * 3) % 2 ? 4 : 3;
  for (let i = -r - 1; i <= r + 1; i++) {
    const s = r + 1 - Math.abs(i);
    rect(g, x - s, y + i, s * 2 + 1, 1, C.plum);
  }
  for (let i = -r; i <= r; i++) {
    const s = r - Math.abs(i);
    rect(g, x - s, y + i, s * 2 + 1, 1, on ? C.butter : C.wool);
  }
  px(g, x, y, C.plum);
}

// The steppers' signs, bigger than the font's: minus, plus, and the
// arrows that walk the gate round the fence. Centred on (x, y).
function glyph(g: CanvasRenderingContext2D, ch: string, x: number, y: number, col: string) {
  g.fillStyle = col;
  if (ch === '-' || ch === '+') g.fillRect(x - 2, y, 5, 1);
  if (ch === '+') g.fillRect(x, y - 2, 1, 5);
  if (ch === '<' || ch === '>') {
    const d = ch === '<' ? -1 : 1;
    for (let i = 0; i < 3; i++) g.fillRect(x - d * (i - 1), y - i, 1, i * 2 + 1);
  }
}

// "8x7" on a little tag just inside the top-left corner.
function sizeTag(g: CanvasRenderingContext2D, r: PRect) {
  const s = `${r.w}x${r.h}`;
  const w = textWidth(s) + 6;
  const x = r.tx * TS + 6, y = r.ty * TS + 6;
  panel(g, x, y, w, 9, C.plum, C.sage);
  text(g, s, x + 3, y + 2, C.wool);
}
