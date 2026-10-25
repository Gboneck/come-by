import type { Game } from './game';
import { findGroups, type Animal } from './entities/animal';
import { botStep, runTrial, type BotOpts } from './bot';
import { PathFollower, findPath } from './world/path';
import { clearLine } from './world/collide';
import { BLOCK_ANIMAL, BLOCK_DOG, REGIONS, regionById, type SpeciesId } from './world/map';
import { CATALOG, defOf, type ItemId } from './ranch/catalog';
import type { Pen, Rot } from './ranch/buildings';
import { MAX_UP, UPGRADES } from './systems/economy';
import { goalDone, tierOf } from './systems/progression';
import { SPECIES } from './entities/species';
import { closeResult, currentClass, prizeToday, startRun } from './systems/trials';
import { yardOf, type Order } from './systems/orders';
import { DAY_LEN, DUSK_AT } from './systems/day';
import { HELPER_COSTS } from './entities/helper';

// A "decent player" for pacing runs (scripts/pacetest.mjs). Each day it
// runs the trial if it is a trial day, fills orders it can, drives the
// pastures' flocks home along real routes, rests on the ranch when there is
// nothing left to do, defends the night, then spends at the day's end on
// what the goals ask for. It logs what it did and where it got stuck.

const DT = 1 / 60;
type P = { x: number; y: number };
type Cmd = { x: number; y: number; sprint: boolean; lie: boolean };
const STILL: Cmd = { x: 0, y: 0, sprint: false, lie: false };

// How the bot handles each species (from the tune.mjs scenarios).
const STYLE: Record<SpeciesId, Partial<BotOpts>> = { duck: {}, sheep: {}, goat: { crowd: 0.7 }, cow: { nip: true }, pony: {} };

export interface DayLog {
  day: number;
  tier: number;
  sky: string;
  real: number; // seconds at the controls, rest included
  rested: number; // of which resting
  earned: number;
  spent: number;
  coins: number;
  choice: number; // things affordable on the end-of-day card
  income: { stock: number; goods: number; orders: number; trials: number }; // where the day's coin came from
  penned: number; // head of stock in pens at the day's end
  did: string[];
  stuck: string[]; // open goals that could not move today, and why
}

const centroid = (list: Animal[]): P => {
  let x = 0, y = 0;
  for (const a of list) { x += a.x; y += a.y; }
  return { x: x / Math.max(1, list.length), y: y / Math.max(1, list.length) };
};
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const loose = (a: Animal) => !a.pen && !a.gone && !a.carried && !a.trial;

export class Pacer {
  real = 0;
  rested = 0;
  spent = 0;
  assisted = 0; // drives the bot could not do, walked through at a player's pace
  did: string[] = [];
  stuck: string[] = [];
  private skip = new Set<Animal>(); // given up on for today
  why: Record<string, number> = {}; // why building sites were turned down (debugging)
  private dogPath = new PathFollower();

  constructor(public g: Game) {}

  // ---- Frames ----

  private frame(c: Cmd | null, act?: 'bark' | 'nip') {
    const g = this.g;
    g.input.override = c;
    if (act) g.input.push(act);
    g.update(DT);
    g.input.clearQueue();
    this.real += DT;
  }

  private get playing() {
    return this.g.mode === 'play' && !this.g.trials.result;
  }

  // Seconds of daylight before dusk.
  private daylight() {
    const d = this.g.day;
    return d.phase === 'day' ? DAY_LEN * DUSK_AT - d.t : 0;
  }

  // ---- Moving the dog ----

  private stepTo(to: P, run = true) {
    const d = this.g.dog;
    const dd = dist(d, to);
    const wp = this.dogPath.next(this.g.map, d.x, d.y, to.x, to.y, BLOCK_DOG, DT);
    const mx = wp.x - d.x, my = wp.y - d.y, ml = Math.hypot(mx, my) || 1;
    const k = Math.min(1, dd / 8);
    // Sprint on open road, never past loose stock.
    const calm = this.g.animals.some((a) => loose(a) && dist(a, d) < 80);
    this.frame({ x: (mx / ml) * k, y: (my / ml) * k, sprint: run && dd > 90 && !calm && d.stamina > 40, lie: false });
  }

  // Walk somewhere, following a full A* route (long trips need more search
  // than the dog's own follower does).
  walkTo(to: P, maxT = 60, near = 6): boolean {
    const g = this.g, d = g.dog;
    const plan = () => [...(findPath(g.map, d.x, d.y, to.x, to.y, BLOCK_DOG, 60000) ?? []), to];
    let path = plan();
    let wi = 0, still = 0;
    for (let t = 0; t < maxT && this.playing; t += DT) {
      if (dist(d, to) < near) return true;
      while (wi < path.length - 1 && dist(d, path[wi]) < 6) wi++;
      const wp = path[wi] ?? to;
      const mx = wp.x - d.x, my = wp.y - d.y, ml = Math.hypot(mx, my) || 1, k = Math.min(1, dist(d, to) / 8);
      const calm = g.animals.some((a) => loose(a) && dist(a, d) < 80);
      const x0 = d.x, y0 = d.y;
      this.frame({ x: (mx / ml) * k, y: (my / ml) * k, sprint: dist(d, to) > 90 && !calm && d.stamina > 40, lie: false });
      still = Math.hypot(d.x - x0, d.y - y0) < 0.2 ? still + DT : 0;
      if (still > 1.5) {
        path = plan();
        wi = 0;
        still = 0;
      }
    }
    return dist(d, to) < near;
  }

  // ---- Driving a flock along a route ----

  private route(list: Animal[], to: P): P[] {
    const c = centroid(list);
    return findPath(this.g.map, c.x, c.y, to.x, to.y, BLOCK_ANIMAL) ?? [to];
  }

  // Drive `members` to `door` along an A* route, then (if given) on to
  // `inside`. Ends when they are all penned, `done()` says so, or progress
  // stalls. Animals that split far from the rest are left behind.
  drive(members: Animal[], door: P, inside: P | null, style: Partial<BotOpts>, maxT = 180, done?: () => boolean): { secs: number; ok: boolean } {
    const g = this.g;
    let list = members.filter(loose);
    let path = this.route(list, door);
    let wi = 0, replan = 0, best = 1e9, bestT = 0, t = 0;
    for (; t < maxT && this.playing; t += DT) {
      list = list.filter((a) => !a.pen && !a.gone && !a.carried);
      if (!list.length || done?.()) return { secs: t, ok: true };
      let c = centroid(list);
      if (t > 4 && list.length > 1) {
        const far = list.filter((a) => dist(a, c) > 130);
        if (far.length && far.length < list.length / 2) {
          for (const a of far) this.skip.add(a);
          list = list.filter((a) => !far.includes(a));
          c = centroid(list);
        }
      }
      while (wi < path.length && dist(c, path[wi]) < 22) wi++;
      const atDoor = wi >= path.length;
      if (!inside && atDoor && dist(c, door) < 26) return { secs: t, ok: true };
      const goal = atDoor && inside ? inside : path[wi] ?? door;
      // Progress: how far is left along the route.
      let left = dist(c, path[wi] ?? door);
      for (let i = wi; i < path.length - 1; i++) left += dist(path[i], path[i + 1]);
      if (inside && atDoor) left = dist(c, inside);
      if (left < best - 4) { best = left; bestT = t; }
      else if (t - bestT > 40) {
        // Stalled (goats on the rocks, cattle at the ford): walk the rest
        // through at a decent player's pace so the clock and money stay true.
        t += this.assistDrive(list, [...path.slice(wi), door, ...(inside ? [inside] : [])], maxT - t);
        this.assisted++;
        return { secs: t, ok: !list.some((a) => !a.pen && !a.gone && !a.carried) || !inside };
      }
      const dd = dist(g.dog, c);
      if (dd > 110) {
        // Far off: run round to the back of them first.
        const gx = goal.x - c.x, gy = goal.y - c.y, gl = Math.hypot(gx, gy) || 1;
        this.stepTo({ x: c.x - (gx / gl) * 40, y: c.y - (gy / gl) * 40 });
      } else {
        const cmd = botStep(g, { ...style, goalX: goal.x, goalY: goal.y, flock: list }, t);
        const d = g.dog;
        const ahead = { x: d.x + cmd.x * 14, y: d.y + cmd.y * 14 };
        if (cmd.tx !== undefined && cmd.ty !== undefined && (cmd.x || cmd.y) && !clearLine(g.map, d.x, d.y, ahead.x, ahead.y, BLOCK_DOG)) {
          // Something solid in the way (rocks, a fence): go round it.
          this.stepTo({ x: cmd.tx, y: cmd.ty }, false);
        } else this.frame({ x: cmd.x, y: cmd.y, sprint: cmd.sprint, lie: cmd.lie }, cmd.nip ? 'nip' : cmd.bark ? 'bark' : undefined);
      }
      if ((replan += DT) > 8) {
        replan = 0;
        path = this.route(list, door);
        wi = 0;
      }
    }
    return { secs: t, ok: false };
  }

  // Move a flock along `pts` at about a walking drive's speed, the dog
  // behind it. Returns the seconds it took.
  private assistDrive(list: Animal[], pts: P[], maxT: number): number {
    const g = this.g, sp = list[0].sp;
    let pos = centroid(list);
    const off = list.map((a) => {
      const dx = a.x - pos.x, dy = a.y - pos.y, l = Math.hypot(dx, dy) || 1, k = Math.min(1, (6 + list.length * 1.2) / l);
      return { x: dx * k, y: dy * k };
    });
    const v = sp.walk * 0.6;
    let k = 0, t = 0;
    for (; k < pts.length && t < maxT && this.playing; t += DT) {
      const to = pts[k], dx = to.x - pos.x, dy = to.y - pos.y, dl = Math.hypot(dx, dy);
      if (dl < v * DT * 2) { pos = { ...to }; k++; continue; }
      pos = { x: pos.x + (dx / dl) * v * DT, y: pos.y + (dy / dl) * v * DT };
      const last = k === pts.length - 1;
      list.forEach((a, i) => {
        if (a.pen || a.gone || a.carried) return;
        const x = pos.x + (last ? off[i].x * 0.3 : off[i].x), y = pos.y + (last ? off[i].y * 0.3 : off[i].y);
        const free = !g.map.blockedPx(x, y, BLOCK_ANIMAL);
        a.x = free ? x : pos.x;
        a.y = free ? y : pos.y;
        a.vx = (dx / dl) * v;
        a.vy = (dy / dl) * v;
      });
      g.dog.x = pos.x - (dx / dl) * 34;
      g.dog.y = pos.y - (dy / dl) * 34;
      if (g.map.blockedPx(g.dog.x, g.dog.y, BLOCK_DOG)) { g.dog.x = pos.x; g.dog.y = pos.y; }
      this.frame(STILL);
    }
    // A moment for the last ones to settle in.
    for (let i = 0; i < 90 && this.playing; i++, t += DT) this.frame(STILL);
    return t;
  }

  // ---- Pens and building ----

  private room(p: Pen, sp: SpeciesId) {
    if (p.letOut || (p.species && p.species !== sp)) return 0;
    return Math.floor((p.capacity - p.used) / SPECIES[sp].space);
  }

  private penFor(sp: SpeciesId, n: number): Pen | null {
    const pens = this.g.ranch.pens.filter((p) => this.room(p, sp) > 0);
    pens.sort((a, b) => (this.room(b, sp) >= n ? 1 : 0) - (this.room(a, sp) >= n ? 1 : 0) || (b.species === sp ? 1 : 0) - (a.species === sp ? 1 : 0));
    return pens[0] ?? null;
  }

  roomFor(sp: SpeciesId) {
    return this.g.ranch.pens.reduce((s, p) => s + this.room(p, sp), 0);
  }

  // Tiles kept free: the roads through the ranch and the space in front of
  // every pen gate.
  private keepClear(tx: number, ty: number, w: number, h: number, pen = false) {
    const hit = (r: { x0: number; y0: number; x1: number; y1: number }) => tx < r.x1 && tx + w > r.x0 && ty < r.y1 && ty + h > r.y0;
    const zones = [{ x0: 93, y0: 76, x1: 100, y1: 92 }, { x0: 60, y0: 101, x1: 130, y1: 107 }];
    for (const b of this.g.ranch.buildings) {
      if (b.kind === 'regiongate' || b.kind === 'fence') continue;
      // Pens may stand fence to fence; anything else keeps a path round it.
      const m = pen && b.kind === 'pen' ? 0 : 1;
      zones.push({ x0: b.tx - m, y0: b.ty - m, x1: b.tx + b.w + m, y1: b.ty + b.h + m });
      if (b.kind === 'pen') {
        const gp = (b as Pen).gatePoint(20);
        zones.push({ x0: Math.floor(gp.x / 8) - 2, y0: Math.floor(gp.y / 8) - 2, x1: Math.floor(gp.x / 8) + 3, y1: Math.floor(gp.y / 8) + 3 });
      }
    }
    return zones.some(hit);
  }

  private site(id: ItemId): { cx: number; cy: number; rot: Rot } | null {
    const g = this.g, b = g.build, def = defOf(id), r = regionById('ranch');
    b.item = CATALOG.indexOf(def);
    let best: { cx: number; cy: number; rot: Rot } | null = null, bs = 1e9;
    for (const rot of (def.rotates ? [0, 1, 2, 3] : [0]) as Rot[])
      for (let cy = r.cy - r.ry; cy <= r.cy + r.ry; cy++)
        for (let cx = r.cx - r.rx; cx <= r.cx + r.rx; cx++) {
          b.cx = cx;
          b.cy = cy;
          b.rot = rot;
          const gh = b.ghost(g);
          if (!gh.ok) { this.why[gh.reason] = (this.why[gh.reason] ?? 0) + 1; continue; }
          if (id === 'pen') {
            // The gate must not face the forest edge, and the ground in front
            // of it must be open ranch with no building on it.
            const [gx, gy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot];
            const mx = r.cx - (gh.tx + gh.w / 2), my = r.cy - (gh.ty + gh.h / 2), ml = Math.hypot(mx, my) || 1;
            if ((gx * mx + gy * my) / ml < -0.2) { this.why.facing = (this.why.facing ?? 0) + 1; continue; }
            const fx = Math.floor(gh.tx + gh.w / 2 + gx * (gh.w / 2 + 2)), fy = Math.floor(gh.ty + gh.h / 2 + gy * (gh.h / 2 + 2));
            const front = { x0: fx - 1, y0: fy - 1, x1: fx + 2, y1: fy + 2 };
            const blocked = !b.buildable(g, fx, fy) || g.ranch.buildings.some((q) => q.kind !== 'regiongate' && q.overlapsTiles(front.x0, front.y0, 3, 3));
            if (blocked) { this.why.front = (this.why.front ?? 0) + 1; continue; }
          }
          if (this.keepClear(gh.tx, gh.ty, gh.w, gh.h, id === 'pen')) { this.why.clear = (this.why.clear ?? 0) + 1; continue; }
          // Pens go near the middle (they are visited all day); the rest
          // keep to the edges and leave the middle for pens.
          const dc = Math.hypot(cx - r.cx, (cy - r.cy) * 1.3);
          // Pens line up in a row along the road, gates onto it.
          const s = id === 'pen' ? Math.abs(gh.ty - 107) * 3 + Math.abs(cx - r.cx) + (rot === 2 ? 0 : 6) : -dc;
          if (s < bs) { bs = s; best = { cx, cy, rot }; }
        }
    return best;
  }

  buy(id: ItemId): boolean {
    const g = this.g, def = defOf(id);
    if (g.coins < def.cost || def.tier > g.tier) return false;
    const s = this.site(id);
    if (!s) {
      this.stuck.push(`NO ROOM FOR A ${def.name}`);
      return false;
    }
    const b = g.build;
    b.item = CATALOG.indexOf(def);
    b.cx = s.cx;
    b.cy = s.cy;
    b.rot = s.rot;
    const before = g.coins;
    b['place'](g);
    if (g.coins >= before) return false;
    this.spent += before - g.coins;
    this.did.push(`BUILT ${def.name} ${def.cost}$`);
    return true;
  }

  private train(): boolean {
    const g = this.g;
    if (!g.ranch.buildings.some((b) => b.kind === 'kennel')) return false;
    const opts = UPGRADES.filter((u) => g.upgrades[u.key] < MAX_UP).sort((a, b) => a.costs[g.upgrades[a.key] - 1] - b.costs[g.upgrades[b.key] - 1]);
    const u = opts[0];
    if (!u) return false;
    const cost = u.costs[g.upgrades[u.key] - 1];
    if (g.coins < cost) return false;
    const before = g.coins;
    g.build.buyUpgrade(g, u.key);
    if (g.coins >= before) return false;
    this.spent += before - g.coins;
    this.did.push(`TRAINED ${u.name} ${cost}$`);
    return true;
  }

  // The day's-end choice: what the goals ask for first, then pens for the
  // stock that is coming, then a barn, then training with spare coin.
  shop() {
    const g = this.g;
    for (const goal of tierOf(g.tier).goals) {
      if (goalDone(g, goal)) continue;
      const L = goal.label;
      if (L === 'BUILD A KENNEL') this.buy('kennel');
      else if (L === 'BUILD A MARKET') this.buy('market');
      else if (L === 'BUILD A BARN') this.buy('barn');
      else if (L === 'BUILD THE WINDMILL') this.buy('windmill');
      else if (L.startsWith('TRAIN')) while (!goalDone(g, goal) && this.train()) { /* keep training */ }
      else if (L.startsWith('HIRE')) {
        const before = g.coins;
        if (g.hireHelper() === null) {
          this.spent += before - g.coins;
          this.did.push(`HIRED A HELPER ${before - g.coins}$`);
        }
      }
    }
    // Room for the species this tier is about (and for anything out there).
    const sp = tierOf(g.tier).species;
    if (this.roomFor(sp) < SPECIES[sp].spawnGroup[1] && g.coins >= defOf('pen').cost + 5) this.buy('pen');
    if (g.tier >= 2 && !g.ranch.buildings.some((b) => b.kind === 'barn') && g.coins >= 95) this.buy('barn');
    while (g.coins > 150 && this.train()) { /* spare coin into the dog */ }
  }

  // ---- What to work on ----

  private groupsOut(): Animal[][] {
    const g = this.g;
    const groups = findGroups(g.animals).map((gr) => gr.members.filter((a) => loose(a) && !this.skip.has(a))).filter((m) => m.length);
    // Merge groups of one kind that graze close together.
    const out: Animal[][] = [];
    for (const m of groups) {
      const c = centroid(m);
      const near = out.find((o) => o[0].sp === m[0].sp && dist(centroid(o), c) < 100);
      if (near) near.push(...m);
      else out.push([...m]);
    }
    return out;
  }

  private pickGroup(): Animal[] | null {
    const g = this.g;
    const goalSp = this.goalSpecies();
    const home = g.doorPoint();
    let best: Animal[] | null = null, bs = 1e9;
    for (const m of this.groupsOut()) {
      const sp = m[0].sp.id;
      if (this.roomFor(sp) === 0 && (g.coins < defOf('pen').cost || (g.ranch.pens.some((p) => p.species === sp) && !goalSp.has(sp) && g.tier < 3))) continue;
      const d = dist(centroid(m), home);
      const s = d - (goalSp.has(sp) ? 2000 : 0) - SPECIES[sp].value * 8 * m.length;
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  }

  // Make room for `n` more of a species: upgrade one of its pens, or build
  // one if it has none (or it is what the goals want).
  private makeRoom(sp: SpeciesId, n: number) {
    const g = this.g;
    if (this.roomFor(sp) >= n) return;
    const own = g.ranch.pens.filter((p) => p.species === sp && p.level < 2 && !p.letOut);
    if (own.length && g.tier >= 3 && g.coins >= (defOf('pen').upgrade?.cost ?? 40)) {
      const before = g.coins;
      g.build['upgrade'](g, own[0]);
      if (g.coins < before) {
        this.spent += before - g.coins;
        this.did.push(`UPGRADED A ${SPECIES[sp].name.toUpperCase()} PEN ${before - g.coins}$`);
        if (this.roomFor(sp) >= n) return;
      }
    }
    // Land is short: a species a goal names gets a new pen first; others
    // only once every named one has room.
    const named = this.goalSpecies(true);
    const waiting = [...named].some((s) => s !== sp && this.roomFor(s) === 0);
    if (named.has(sp) || (!waiting && (!g.ranch.pens.some((p) => p.species === sp) || this.goalSpecies().has(sp)))) this.buy('pen');
  }

  private goalSpecies(namedOnly = false): Set<SpeciesId> {
    const g = this.g, out = new Set<SpeciesId>();
    for (const goal of tierOf(g.tier).goals) {
      if (goalDone(g, goal)) continue;
      const m = /^PEN \d+ (\w+)/.exec(goal.label);
      if (m) out.add(SPECIES_BY_PLURAL[m[1]]);
      if (!namedOnly && /ANIMALS PENNED/.test(goal.label)) for (const id of Object.keys(SPECIES) as SpeciesId[]) out.add(id);
    }
    return out;
  }

  bringHome(members: Animal[]) {
    const sp = members[0].sp.id, n = members.length;
    this.makeRoom(sp, n);
    const pen = this.penFor(sp, n);
    if (!pen) {
      this.stuck.push(`NO PEN ROOM FOR ${SPECIES[sp].plural.toUpperCase()}`);
      for (const a of members) this.skip.add(a);
      return;
    }
    const before = pen.animals.length;
    const assisted0 = this.assisted;
    const r = this.drive(members, pen.gatePoint(24), pen.gatePoint(-14), STYLE[sp], 200, () => pen.full || members.every((a) => a.pen || a.gone));
    const got = pen.animals.length - before;
    this.did.push(`${got}/${n} ${SPECIES[sp].plural.toUpperCase()} HOME ${Math.round(r.secs)}S${this.assisted > assisted0 ? ' (ASSISTED)' : ''}`);
    for (const a of members) if (!a.pen) this.skip.add(a);
    // Let the gate swing shut before the next job.
    for (let i = 0; i < 60 && this.playing; i++) this.frame(STILL);
  }

  // ---- Orders ----

  private doOrder(o: Order) {
    const g = this.g;
    const yard = yardOf(g, o.yard);
    const left = () => o.due - g.day.t;
    if (left() < 50) return;
    const door = yard.pen.gatePoint(24), inside = yard.pen.gatePoint(-12);
    const wild = this.groupsOut().filter((m) => m[0].sp.id === o.species && m.length >= o.n - o.got).sort((a, b) => dist(centroid(a), g.dog) - dist(centroid(b), g.dog))[0];
    let herd = wild;
    let from: Pen | null = null;
    if (!herd) {
      from = g.ranch.pens.find((p) => p.species === o.species && p.animals.length >= o.n - o.got) ?? null;
      if (!from) return;
      herd = this.letOut(from, o.n - o.got);
      if (!herd.length) return;
    }
    const assisted0 = this.assisted;
    const r = this.drive(herd, door, inside, STYLE[o.species], Math.max(30, left()), () => o.state !== 'open');
    this.did.push(`ORDER ${o.yard.toUpperCase()} ${o.got}/${o.n} ${SPECIES[o.species].plural.toUpperCase()} ${o.state === 'done' ? 'FILLED' : 'MISSED'} ${Math.round(r.secs)}S${this.assisted > assisted0 ? ' (ASSISTED)' : ''}`);
    // Home stock that did not go: back to its pen.
    const spare = herd.filter((a) => loose(a));
    if (from && spare.length) this.bringHome(spare);
  }

  // Let `n` (or more) out of a pen: E at the gate, walk round behind them.
  private letOut(p: Pen, n: number): Animal[] {
    const g = this.g, d = g.dog;
    if (!this.walkTo(p.gatePoint(9), 40, 3)) return [];
    const c = { x: p.cx, y: p.cy };
    const gl = Math.hypot(c.x - d.x, c.y - d.y) || 1;
    d.hx = (c.x - d.x) / gl;
    d.hy = (c.y - d.y) / gl;
    this.frame(STILL, 'nip');
    if (!p.letOut) return [];
    const before = new Set(p.animals);
    const along = Math.abs(p.gatePoint(1).x - p.gatePoint(0).x) > 0.5;
    const back = along ? { x: p.cx - (p.gatePoint(1).x - p.gatePoint(0).x) * 18, y: p.cy } : { x: p.cx, y: p.cy - (p.gatePoint(1).y - p.gatePoint(0).y) * 18 };
    const side = along ? { x: p.cx, y: p.iy1 - 6 } : { x: p.ix1 - 6, y: p.cy };
    const steps = [p.gatePoint(-6), side, back];
    let si = 0;
    for (let t = 0; t < 25 && this.playing; t += DT) {
      const out = [...before].filter((a) => !a.pen && !a.gone);
      if (out.length >= n) break;
      if (si < steps.length - 1 && dist(d, steps[si]) < 4) si++;
      const to = steps[si];
      const dx = to.x - d.x, dy = to.y - d.y, dl = Math.hypot(dx, dy);
      this.frame(dl > 2 ? { x: (dx / dl) * Math.min(1, dl / 8), y: (dy / dl) * Math.min(1, dl / 8), sprint: false, lie: false } : STILL);
    }
    return [...before].filter((a) => !a.pen && !a.gone);
  }

  // ---- Trials ----

  private doTrial() {
    const g = this.g;
    const cls = currentClass(g);
    if (!cls) return;
    const post = g.ranch.course.post;
    if (!this.walkTo({ x: post.x, y: post.y + 10 }, 90, 5)) {
      this.stuck.push('COULD NOT REACH THE TRIAL POST');
      return;
    }
    if (!startRun(g)) return;
    const run = g.trials.run!;
    const res = runTrial(g, STYLE[cls.species], 300);
    this.real += run.t + 1.4;
    if (res) this.did.push(`TRIAL ${cls.name} ${res.total} PTS, ${res.place ? ['1ST', '2ND', '3RD', '4TH'][res.place - 1] : 'PRACTICE'}${res.coins ? ` +${res.coins}$` : ''}`);
    closeResult(g);
  }

  // ---- Resting, nights ----

  rest() {
    const g = this.g;
    const door = g.doorPoint();
    this.walkTo({ x: door.x - 20, y: door.y + 14 }, 60, 6);
    g.input.override = null;
    g.input.keys.add('KeyQ');
    let blocked = 0;
    while (this.playing && g.day.phase !== 'night') {
      g.update(DT);
      g.input.clearQueue();
      this.real += DT;
      this.rested += DT;
      if (g.rest < 1.5) blocked += DT;
      if (this.real > 4000) break;
    }
    g.input.keys.delete('KeyQ');
    if (blocked > 20) this.stuck.push(`COULD NOT REST FOR ${Math.round(blocked)}S (STOCK LOOSE NEAR THE HOUSE)`);
  }

  night() {
    const g = this.g, d = g.dog;
    let barkT = 0;
    const home = g.doorPoint();
    for (let t = 0; t < 120 && this.playing && g.day.phase === 'night'; t += DT) {
      const act = g.predators.filter((p) => p.active && p.state !== 'flee').sort((a, b) => dist(a, d) - dist(b, d));
      barkT -= DT;
      if (act.length) {
        const p = act[0];
        const near = dist(p, d) < 45 && barkT <= 0;
        if (near) barkT = 0.8;
        const wp = this.dogPath.next(g.map, d.x, d.y, p.x, p.y, BLOCK_DOG, DT);
        const mx = wp.x - d.x, my = wp.y - d.y, ml = Math.hypot(mx, my) || 1;
        this.frame({ x: mx / ml, y: my / ml, sprint: dist(p, d) > 60, lie: false }, near ? 'bark' : undefined);
      } else if (dist(d, home) > 12) this.stepTo(home, false);
      else this.frame({ ...STILL, lie: true });
    }
  }

  // ---- Bookkeeping ----

  // Open goals that cannot move today, and why.
  private blockers() {
    const g = this.g;
    for (const goal of tierOf(g.tier).goals) {
      if (goalDone(g, goal)) continue;
      const L = goal.label;
      const pen = /^PEN (\d+) (\w+)/.exec(L);
      if (pen) {
        const sp = SPECIES_BY_PLURAL[pen[2]];
        const have = g.animals.filter((a) => a.sp.id === sp && !a.gone && !a.trial && (a.pen || REGIONS.some((r) => r.tier <= g.tier && g.map.regionAt(a.x, a.y) === r))).length;
        if (have < goal.target) this.stuck.push(`${L}: ONLY ${have} ABOUT`);
        continue;
      }
      const build: Record<string, ItemId> = { 'BUILD A KENNEL': 'kennel', 'BUILD A MARKET': 'market', 'BUILD A BARN': 'barn', 'BUILD THE WINDMILL': 'windmill' };
      if (build[L] && g.coins < defOf(build[L]).cost) this.stuck.push(`${L}: ${g.coins}/${defOf(build[L]).cost}$`);
      if (L.startsWith('HIRE') && g.coins < HELPER_COSTS[g.helpers.length]) this.stuck.push(`${L}: ${g.coins}/${HELPER_COSTS[g.helpers.length]}$`);
      if (L === 'PLACE IN A TRIAL' && !prizeToday(g)) this.stuck.push(`${L}: NOT A TRIAL DAY`);
      if (L === 'FILL AN ORDER' && !g.orders.open.length) this.stuck.push(`${L}: NO ORDERS TODAY`);
    }
  }

  playDay(): DayLog {
    const g = this.g;
    this.real = this.rested = this.spent = 0;
    this.did = [];
    this.stuck = [];
    this.skip.clear();
    const day = g.day.day, tier = g.tier;
    const earned0 = g.totals.earned;
    const orders0 = g.orders.list.reduce((s, o) => s + o.paid, 0);
    let prize = 0;
    this.blockers();
    const practise = tierOf(g.tier).goals.some((x) => x.label.includes('IN A TRIAL') && !goalDone(g, x));
    if ((prizeToday(g) || practise) && currentClass(g)) {
      const before = g.totals.earned;
      this.doTrial();
      prize = g.totals.earned - before;
    }
    for (const o of [...g.orders.open].sort((a, b) => a.due - b.due)) if (this.playing) this.doOrder(o);
    for (let k = 0; k < 10 && this.playing && this.daylight() > 35; k++) {
      const m = this.pickGroup();
      if (!m) break;
      this.bringHome(m);
    }
    this.rest();
    this.night();
    // Wait out the fade into the end-of-day card.
    for (let i = 0; i < 120 && g.mode === 'play'; i++) this.frame({ ...STILL, lie: true });
    const choice = g.summary?.buildable?.length ?? 0;
    const income = { stock: g.stats.deliveredValue, goods: g.stats.goodsValue, orders: g.orders.list.reduce((s, o) => s + o.paid, 0) - orders0, trials: prize };
    if (g.mode === 'summary') {
      this.shop();
      g.startDay();
    }
    return { day, tier, sky: g.weather.sky, real: Math.round(this.real), rested: Math.round(this.rested), earned: g.totals.earned - earned0, spent: this.spent, coins: g.coins, choice, income, penned: g.ranch.pens.reduce((s, p) => s + p.animals.length, 0), did: this.did, stuck: this.stuck };
  }
}

const SPECIES_BY_PLURAL: Record<string, SpeciesId> = Object.fromEntries(
  Object.values(SPECIES).map((s) => [s.plural.toUpperCase(), s.id]),
) as Record<string, SpeciesId>;
