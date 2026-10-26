import { C } from '../palette';
import { ellipse, line, rect } from '../gfx/draw';
import { drawSpr } from '../gfx/sprite';
import { dressed, peopleSprites, type Dress, type PeopleSprites, type Pic, type VillagerSpec } from '../art/people';
import { seasonLook } from '../art/seasonlook';
import type { Drawable } from '../art/buildings';
import type { Light } from '../render/night';
import { calmRating, type Game } from '../game';
import type { PressureSource } from './animal';
import { Pen, type Building } from '../ranch/buildings';
import { DECOR } from '../ranch/decor';
import { BLOCK_DOG, REGIONS, TS, type YardId } from '../world/map';
import { collideCircle, wallRepulse } from '../world/collide';
import { PathFollower } from '../world/path';
import { SPECIES } from './species';
import { tToClock } from '../systems/orders';
import { defOf } from '../ranch/catalog';
import { isVillager, villageBrain, villageCast } from './villagers';

// The townsfolk. The rancher (your handler) lives in the farmhouse: out in
// the morning, helping at the pen gate when you bring a flock home, doing
// the chores in between, on the bench at dusk and round the yard with a
// lantern at night. Whatever you buy, they build (from tier 3 a carpenter
// comes for the big jobs): it works at once, the scaffold is just for show,
// and anything left is finished by morning. As the ranch grows, the valley
// fills: the buyers at their yards, the judge at the Show Ground and a
// shepherd up in the High Range, each with a word for what you do.
//
// Everything here reads game state and changes nothing in the sim, except
// the rancher at a pen gate: a mild pressure source the flock turns from.

export type FolkId = 'rancher' | 'carpenter' | 'miller' | 'drover' | 'auctioneer' | 'judge' | 'shepherd' | VillageId;
// Ready-made villagers for the village green: the smith, three stallholders,
// six cottagers (two of them children) and the hall's warden. Their looks
// are in CAST; whoever builds the village spawns them (new Person(id, x, y)
// into game.folk.people) and gives them their day with go(steps).
export type VillageId = 'smith' | 'baker' | 'grocer' | 'weaver' | 'cottager1' | 'cottager2' | 'cottager3' | 'cottager4' | 'cottager5' | 'cottager6' | 'warden';
type Facing = 'd' | 'u' | 'l' | 'r';
type Pose = 'stand' | 'walk' | 'carry' | 'work' | 'crouch' | 'sit' | 'wave';

// Who looks like what (see villager() in art/people.ts). `crook`: carries
// a shepherd's crook.
const CAST: Record<FolkId, { look: VillagerSpec; pitch: number; speed: number; crook?: boolean }> = {
  rancher: { look: { hat: 'brim', hatColor: 'y', coat: 't', legs: 's', summerHat: 'straw' }, pitch: 330, speed: 24 },
  carpenter: { look: { hat: 'cap', hatColor: 'o', coat: 'w', legs: 't', apron: 's', winterCoat: 't' }, pitch: 210, speed: 26 },
  miller: { look: { hat: 'cap', hatColor: 's', coat: 'w', legs: 't', build: 'stout', beard: 's' }, pitch: 270, speed: 20 },
  drover: { look: { hat: 'brim', hatColor: 'p', coat: 's', legs: 't', build: 'tall' }, pitch: 170, speed: 22 },
  auctioneer: { look: { hat: 'straw', hatColor: 'y', coat: 's', legs: 't', apron: 'y' }, pitch: 300, speed: 22 },
  judge: { look: { hat: 'bowler', hatColor: 'p', coat: 't', legs: 's', hair: 'w', beard: 'w', build: 'tall' }, pitch: 240, speed: 18 },
  shepherd: { look: { hat: 'hood', coat: 'o', legs: 't', beard: true }, pitch: 190, speed: 20, crook: true },
  smith: { look: { hat: 'cap', hatColor: 's', coat: 'w', legs: 't', apron: 'p', build: 'stout', beard: true }, pitch: 160, speed: 20 },
  baker: { look: { hat: 'bonnet', hatColor: 's', coat: 'w', legs: 't', skirt: true, apron: 'y' }, pitch: 350, speed: 21 },
  grocer: { look: { hat: 'straw', hatColor: 'y', coat: 'o', legs: 's', apron: 'w' }, pitch: 250, speed: 22 },
  weaver: { look: { hat: 'none', hair: 'p', coat: 't', legs: 'o', skirt: true, scarf: 'y' }, pitch: 320, speed: 21 },
  cottager1: { look: { hat: 'cap', hatColor: 't', coat: 'o', legs: 't' }, pitch: 220, speed: 23 },
  cottager2: { look: { hat: 'bonnet', hatColor: 'y', coat: 's', legs: 'w', skirt: true }, pitch: 340, speed: 22 },
  cottager3: { look: { hat: 'none', hair: 'y', coat: 'w', legs: 's', build: 'short' }, pitch: 420, speed: 27 },
  cottager4: { look: { hat: 'brim', hatColor: 's', coat: 't', legs: 'o', beard: true }, pitch: 200, speed: 22 },
  cottager5: { look: { hat: 'bonnet', hatColor: 't', coat: 'o', legs: 'y', skirt: true }, pitch: 310, speed: 21 },
  cottager6: { look: { hat: 'none', hair: 'p', coat: 's', legs: 'w', build: 'short' }, pitch: 440, speed: 28 },
  warden: { look: { hat: 'bowler', hatColor: 't', coat: 'w', legs: 't', build: 'tall', scarf: 'y' }, pitch: 230, speed: 19 },
};
const BUYER: Partial<Record<YardId, FolkId>> = { mill: 'miller', drover: 'drover', sale: 'auctioneer' };

// One leg of an errand: walk to (x, y), then hold a pose for t seconds.
interface Step {
  x: number;
  y: number;
  pose?: Pose;
  t?: number;
  face?: Facing;
  item?: string | null; // what they carry on the way there (palette char)
  run?: boolean;
  done?: () => void;
}

export class Person {
  vx = 0;
  vy = 0;
  face: Facing = 'd';
  pose: Pose = 'stand';
  phase = 0; // walk cycle
  anim = 0; // time in the current pose
  item: string | null = null;
  lantern = false;
  shown = true;
  bubble: { text: string; t: number; max: number } | null = null;
  pending: { text: string; until: number } | null = null;
  sayCd = 0;
  steps: Step[] = [];
  stepT = 0;
  walkT = 0;
  stepFoot = 0;
  tool: 'hammer' | 'axe' = 'axe';
  home = { x: 0, y: 0 };
  readonly spr: PeopleSprites;
  readonly pitch: number;
  readonly speed: number;
  private path = new PathFollower();
  private tmp = { x: 0, y: 0 };

  constructor(public id: FolkId, public x: number, public y: number) {
    const c = CAST[id];
    this.spr = peopleSprites(c.look);
    this.pitch = c.pitch;
    this.speed = c.speed;
    this.home = { x, y };
  }

  setPose(p: Pose) {
    if (p !== this.pose) this.anim = 0;
    this.pose = p;
  }

  // Walk towards (tx, ty) round obstacles; true once there.
  walk(game: Game, tx: number, ty: number, dt: number, run = false): boolean {
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d < 2.5 || this.walkT > 14) {
      this.vx = this.vy = 0;
      this.walkT = 0;
      return true;
    }
    this.walkT += dt;
    const spd = this.speed * (run ? 1.7 : 1) * Math.min(1, d / 6 + 0.3);
    const wp = this.path.next(game.map, this.x, this.y, tx, ty, BLOCK_DOG, dt);
    let dx = wp.x - this.x, dy = wp.y - this.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    wallRepulse(game.map, this.x, this.y, 5, BLOCK_DOG, this.tmp);
    dx += this.tmp.x;
    dy += this.tmp.y;
    const l2 = Math.hypot(dx, dy) || 1;
    this.vx = (dx / l2) * spd;
    this.vy = (dy / l2) * spd;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    collideCircle(game.map, this, 2.5, BLOCK_DOG);
    if (Math.abs(this.vx) > Math.abs(this.vy) * 0.8) this.face = this.vx > 0 ? 'r' : 'l';
    else this.face = this.vy > 0 ? 'd' : 'u';
    this.setPose(this.item ? 'carry' : 'walk');
    this.phase += (spd * dt) / 4;
    return false;
  }

  // Work through the errand list; true when it is empty.
  run(game: Game, dt: number): boolean {
    const s = this.steps[0];
    if (!s) return true;
    if (this.stepT === 0) {
      this.item = s.item ?? null;
      if (!this.walk(game, s.x, s.y, dt, s.run)) return false;
      this.item = null;
      this.stepT = 1e-6;
      if (s.face) this.face = s.face;
      this.setPose(s.pose ?? 'stand');
    }
    this.stepT += dt;
    if (this.stepT >= (s.t ?? 0)) {
      this.steps.shift();
      this.stepT = 0;
      s.done?.();
    }
    return false;
  }

  go(steps: Step[]) {
    this.tool = 'axe';
    this.steps = steps;
    this.stepT = 0;
    this.walkT = 0;
  }
}

// A building going up: the scaffold stands until the builder has put in
// the hours, or until morning, whichever comes first.
export interface Job {
  b: Building;
  work: number;
  done: number;
  big: boolean; // scaffold and a carpenter (from tier 3)
  spot: number;
  spotT: number;
  said: boolean;
}

// The rancher's pressure at a gate, as a share of the flock's flight zone.
const HELP_RANGE = 0.55;

const WORK: Partial<Record<string, number>> = { pen: 8, fence: 1.2, trough: 2.5, gate: 3, kennel: 8, market: 9, barn: 14, windmill: 14 };
const BIG = new Set(['kennel', 'market', 'barn', 'windmill']);

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const decorAt = (kind: string, tier: number) => DECOR.find((d) => d.kind === kind && d.tier <= tier);
const tileCentre = (d: { x: number; y: number }) => ({ x: d.x * TS + 4, y: d.y * TS + 6 });

export class Folk {
  people: Person[] = [];
  rancher = new Person('rancher', 0, 0);
  jobs: Job[] = [];
  private seeded = false;
  private known = new Map<Building, number>();
  private day = 0;
  private tier = 0;
  private lost = 0;
  private lostTonight = 0;
  private flash = new WeakMap<Pen, number>();
  private orders = new WeakMap<object, string>();
  private run: unknown = null;
  private result: unknown = null;
  private help: { pen: Pen; x: number; y: number; face: Facing; there: boolean; lostT: number; said: boolean; strength: number } | null = null;
  private t = 0;
  private lastSay = -9;
  private duskSaid = 0;
  private tipDay = new Map<FolkId, number>();

  // ---- The frame ----

  update(game: Game, dt: number) {
    this.t += dt;
    if (!this.seeded) this.seed(game);
    this.watchBuildings(game);
    this.watchEvents(game);
    this.cast(game);
    for (const p of this.people) {
      p.sayCd -= dt;
      p.anim += dt;
      if (p.bubble && (p.bubble.t += dt) > p.bubble.max) p.bubble = null;
      if (p.pending) {
        if (this.t > p.pending.until) p.pending = null;
        else if (this.say(game, p, p.pending.text, true)) p.pending = null;
      }
    }
    this.rancherBrain(game, dt);
    for (const p of this.people) {
      if (p === this.rancher) continue;
      if (p.id === 'carpenter') this.carpenterBrain(game, p, dt);
      else if (isVillager(p.id)) villageBrain(game, this, p, dt);
      else this.valleyBrain(game, p, dt);
    }
    // Footsteps for anyone walking on screen; a blow on every downstroke
    // of a hammer or an axe.
    for (const p of this.people) {
      if (p.shown && p.pose === 'work' && Math.floor((p.anim - dt) * 2.4) !== Math.floor(p.anim * 2.4) && Math.floor(p.anim * 2.4) % 2 === 1)
        game.audio?.play(p.tool === 'hammer' ? 'hammer' : 'chop', { x: p.x, y: p.y, vol: 0.8 });
      if (!p.shown || (p.pose !== 'walk' && p.pose !== 'carry')) continue;
      const k = Math.floor(p.phase / 2);
      if (k !== p.stepFoot) {
        p.stepFoot = k;
        if (game.isOnScreen(p.x, p.y, 20)) game.audio?.footstep(p.x, p.y);
      }
    }
  }

  private seed(game: Game) {
    this.seeded = true;
    for (const b of game.ranch.buildings) this.known.set(b, b.level);
    this.day = game.day.day;
    this.tier = game.tier;
    this.lost = game.totals.lost;
    const d = game.doorPoint();
    this.rancher.x = this.rancher.home.x = d.x;
    this.rancher.y = this.rancher.home.y = d.y + 4;
    this.people = [this.rancher];
  }

  // ---- Talking ----

  // Show a bubble if the speaker is on screen (and nobody spoke a moment ago).
  say(game: Game, p: Person, text: string, force = false): boolean {
    if (!p.shown || !game.isOnScreen(p.x, p.y, -6) || game.mode !== 'play') return false;
    if (!force && (this.t - this.lastSay < 2.5 || p.sayCd > 0)) return false;
    if (this.t - this.lastSay < 1.2) return false;
    p.bubble = { text, t: 0, max: 1.6 + text.length * 0.06 };
    p.sayCd = 9;
    this.lastSay = this.t;
    game.audio?.voice(p.pitch, text, p.x, p.y);
    return true;
  }

  // Say it when they next come into view (within `wait` seconds).
  private tell(p: Person, text: string, wait = 20) {
    p.pending = { text, until: this.t + wait };
  }

  private person(id: FolkId) {
    return this.people.find((p) => p.id === id);
  }

  // ---- What happened ----

  private watchBuildings(game: Game) {
    const sameDay = game.day.day === this.day;
    for (const b of game.ranch.buildings) {
      const lv = this.known.get(b);
      if (lv === undefined || b.level > lv) {
        this.known.set(b, b.level);
        const work = WORK[b.kind];
        // Bought from the summary: built overnight, nothing to watch.
        if (!work || !sameDay) continue;
        this.jobs.push({ b, work: work * (lv === undefined ? 1 : 0.6), done: 0, big: BIG.has(b.kind), spot: 0, spotT: 0, said: false });
      }
    }
    this.jobs = this.jobs.filter((j) => j.done < j.work && game.ranch.buildings.includes(j.b));
  }

  private watchEvents(game: Game) {
    const r = this.rancher;
    // A new day: the jobs are done, the rancher comes out with a word.
    if (game.day.day !== this.day) {
      this.day = game.day.day;
      for (const j of this.jobs) j.done = j.work;
      this.jobs = [];
      const d = game.doorPoint();
      r.x = d.x;
      r.y = d.y + 2;
      r.shown = true;
      r.lantern = false;
      r.go([{ x: d.x, y: d.y + 6, pose: 'wave', t: 1.3, face: 'd' }]);
      this.tell(r, this.morningLine(game), 30);
      this.lostTonight = 0;
    }
    // Tier up.
    if (game.tier > this.tier) {
      const lines: Record<number, string> = {
        2: 'SHEEP NEXT! UP IN THE ROLLING HILLS.',
        3: 'GOATS! MIND, THEY CLIMB.',
        4: 'CATTLE AT THE FORD! GIVE THEM A NIP.',
        5: 'THE HIGH RANGE IS OPEN. PONIES!',
      };
      this.tell(r, lines[game.tier] ?? 'LOOK AT THE PLACE NOW!', 15);
    }
    this.tier = game.tier;
    // Losses at night.
    if (game.totals.lost > this.lost) {
      this.lostTonight += game.totals.lost - this.lost;
      if (r.shown) this.say(game, r, pick(['NO! THEY GOT ONE!', 'GET AWAY, YOU!', 'NOT ANOTHER ONE...']), true);
    }
    this.lost = game.totals.lost;
    // A pen shuts: the handler's verdict.
    for (const p of game.ranch.pens) {
      const prev = this.flash.get(p) ?? 0;
      this.flash.set(p, p.shutFlash);
      if (p.shutFlash > 0.95 && prev < 0.5 && p.batch.length) {
        const avg = p.batch.reduce((s, a) => s + a.peakStress, 0) / p.batch.length;
        const lab = calmRating(avg).label;
        const text = lab === 'CALM' ? pick(["THAT'LL DO!", 'QUIET AS YOU LIKE.', 'LOVELY WORK, THAT.']) : lab === 'STEADY' ? pick(["THAT'LL DO.", 'NOT BAD AT ALL.']) : pick(['EASY NEXT TIME, EH?', 'BIT OF A SCRAMBLE, THAT.']);
        if (Math.hypot(r.x - p.cx, r.y - p.cy) < 160) this.say(game, r, text, true);
      }
    }
    // Orders: the buyer comes to the yard to pay, or shrugs.
    for (const o of game.orders.list) {
      const prev = this.orders.get(o);
      this.orders.set(o, o.state);
      if (prev !== 'open' || o.state === 'open') continue;
      const who = BUYER[o.yard], b = who && this.person(who);
      const yard = game.ranch.yards.find((y) => y.site.id === o.yard);
      if (!b || !yard) continue;
      if (o.state === 'done') {
        const g = yard.pen.gatePoint(12);
        b.go([
          { x: g.x, y: g.y, pose: 'wave', t: 1.4, face: 'u', done: () => this.say(game, b, pick(['FINE STOCK! THERE\'S YOUR PAY.', 'GOOD AND CALM. THANK YOU!', 'JUST WHAT I NEEDED.']), true) },
          { x: g.x, y: g.y, pose: 'stand', t: 1.5 },
        ]);
      } else this.say(game, b, o.got ? 'I\'LL TAKE WHAT YOU BROUGHT.' : pick(['NO STOCK TODAY? SHAME.', 'NEVER MIND. ANOTHER DAY.']), true);
    }
    // Trials: the judge has a word at the start and at the end.
    const tr = game.trials;
    const judge = this.person('judge');
    if (tr.run && tr.run !== this.run && judge) this.say(game, judge, pick(['AWAY YOU GO!', 'TIME STARTS NOW.']), true);
    this.run = tr.run;
    if (tr.result && tr.result !== this.result) {
      const res = tr.result;
      const text = res.retired ? 'BETTER LUCK NEXT TIME.' : res.place === 1 ? 'A GRAND RUN. FIRST PLACE!' : res.place >= 2 && res.place <= 3 ? 'WELL RUN. A RIBBON FOR YOU.' : res.total >= 70 ? 'TIDY WORK, THAT.' : 'THEY GOT AWAY FROM YOU, EH?';
      if (judge) this.say(game, judge, text, true);
      if (res.place === 1) this.tell(r, 'WE WON! WAIT TILL THEY HEAR.', 8);
    }
    this.result = tr.result;
  }

  private morningLine(game: Game): string {
    if (this.lostTonight) {
      const barn = game.ranch.buildings.some((b) => b.kind === 'barn');
      return barn ? `WE LOST ${this.lostTonight} IN THE NIGHT.` : `WE LOST ${this.lostTonight} LAST NIGHT. A BARN WOULD HELP.`;
    }
    const o = game.orders.open[0];
    if (o) {
      const yard = game.ranch.yards.find((y) => y.site.id === o.yard);
      const sp = SPECIES[o.species];
      return `${yard?.site.name ?? 'A BUYER'} WANTS ${o.n} ${(o.n === 1 ? sp.name : sp.plural).toUpperCase()} BY ${tToClock(o.due)}.`;
    }
    if (game.tier >= 2 && game.day.day % 3 === 0) return 'IT\'S TRIAL DAY AT THE SHOW GROUND!';
    const pens = game.ranch.pens.filter((p) => p.animals.length);
    if (pens.some((p) => !p.hasTrough) && game.coins >= 12) return 'THAT PEN COULD DO WITH A TROUGH.';
    if (!game.ranch.buildings.some((b) => b.kind === 'kennel') && game.coins >= defOf('kennel').cost) return 'A KENNEL WOULD HELP YOU TRAIN.';
    return pick(['MORNING! LET\'S BRING THEM HOME.', 'MORNING! QUIET AND STEADY TODAY.', 'LOVELY MORNING FOR IT.']);
  }

  // ---- Who is about ----

  private cast(game: Game) {
    const open = (region: string | null) => !region || REGIONS.some((r) => r.id === region && r.tier <= game.tier);
    // Buyers at their yards once orders begin (tier 2).
    for (const y of game.ranch.yards) {
      const id = BUYER[y.site.id];
      if (!id || this.person(id) || game.tier < 2 || !open(y.site.region)) continue;
      const p = new Person(id, (y.site.cart.tx - 0.5) * TS, (y.site.cart.ty + 2) * TS);
      p.face = 'd';
      this.people.push(p);
    }
    // The judge at the Show Ground; a shepherd in the High Range.
    if (game.tier >= 2 && open('show') && !this.person('judge')) {
      const post = game.ranch.course.post;
      this.people.push(new Person('judge', post.x + 34, post.y - 6));
    }
    if (game.tier >= 5 && !this.person('shepherd')) {
      const hr = REGIONS.find((r) => r.id === 'high')!;
      this.people.push(new Person('shepherd', hr.cx * TS + 40, (hr.cy + 6) * TS));
    }
    // A carpenter comes for the big jobs from tier 3.
    if (game.tier >= 3 && this.jobs.some((j) => j.big) && !this.person('carpenter')) {
      const e = this.roadIn();
      this.people.push(new Person('carpenter', e.x, e.y));
    }
    // The village's people (entities/villagers.ts).
    villageCast(game, this);
  }

  // Where visitors arrive at the ranch: the track in from the east.
  private roadIn() {
    const sign = decorAt('sign', 1)!;
    return { x: sign.x * TS + 12, y: sign.y * TS + 14 };
  }

  // ---- The rancher ----

  private rancherBrain(game: Game, dt: number) {
    const r = this.rancher;
    const phase = game.day.phase;
    const tr = game.trials;
    // A trial: the handler stands at the post (there in a blink if far).
    if (tr.run || tr.result) {
      const p = game.ranch.course.post;
      this.help = null;
      if (Math.hypot(r.x - p.x, r.y - (p.y + 10)) > 60) {
        r.x = p.x - 8;
        r.y = p.y + 10;
      }
      r.shown = true;
      r.lantern = false;
      r.steps = [];
      if (!r.walk(game, p.x - 8, p.y + 10, dt)) return;
      r.setPose('stand');
      r.face = 'u';
      return;
    }
    if (phase === 'night') {
      this.help = null;
      this.nightRound(game, r, dt);
      return;
    }
    r.shown = true;
    r.lantern = false;
    // Bringing a flock home: go and stand by the gate.
    this.updateHelp(game);
    const h = this.help;
    if (h) {
      r.steps = [];
      if (!r.walk(game, h.x, h.y, dt, !h.there)) return;
      if (!h.there) {
        h.there = true;
        if (!h.said) {
          h.said = true;
          this.say(game, r, pick(['STEADY NOW...', 'BRING THEM ROUND!', 'IN THEY COME.', 'EASY... EASY...']));
        }
      }
      r.setPose('stand');
      r.face = h.face;
      return;
    }
    if (!r.run(game, dt)) return;
    // Something to build?
    const job = this.jobs.find((j) => !j.big || game.tier < 3);
    if (job) {
      this.build(game, r, job, dt);
      return;
    }
    // Resting with the dog, or the bench at dusk.
    if (game.rest > 1.3 || phase === 'dusk') {
      const seat = this.seat(game);
      if (!r.walk(game, seat.x, seat.y, dt)) return;
      r.setPose('sit');
      r.face = 'd';
      if (phase === 'dusk' && this.duskSaid !== game.day.day) {
        this.duskSaid = game.day.day;
        this.say(game, r, pick(['LOVELY EVENING.', 'GET THEM IN BEFORE DARK.', 'LISTEN TO THE BIRDS.']));
      }
      return;
    }
    this.chore(game, r);
  }

  private seat(game: Game) {
    const bench = decorAt('bench', game.tier);
    if (bench) return { x: bench.x * TS + 4, y: bench.y * TS + 6 };
    const d = game.doorPoint();
    return { x: d.x + 6, y: d.y + 2 };
  }

  // Is the dog bringing a flock to an open pen? Then stand by the gate on
  // the far side from the dog, so the flock cannot slip past it.
  private updateHelp(game: Game) {
    const dog = game.dog;
    const h = this.help;
    if (h) {
      const gp = h.pen.gatePoint(0);
      const still = h.pen.open && !h.pen.letOut && game.groups.some((g) => Math.hypot(g.x - gp.x, g.y - gp.y) < 230 && g.members.some((a) => !a.pen && h.pen.accepts(a)));
      const dogNear = Math.hypot(dog.x - gp.x, dog.y - gp.y) < 260;
      h.lostT = still && dogNear ? 0 : h.lostT + 1 / 60;
      if (h.lostT > 1.5) this.help = null;
      return;
    }
    let best: { pen: Pen; d: number; flight: number } | null = null;
    for (const p of game.ranch.pens) {
      if (!p.open || p.swing < 0.6 || p.letOut) continue;
      const gp = p.gatePoint(0);
      for (const g of game.groups) {
        const d = Math.hypot(g.x - gp.x, g.y - gp.y);
        if (d > 170 || Math.hypot(dog.x - g.x, dog.y - g.y) > 110) continue;
        if (!g.members.some((a) => !a.pen && p.accepts(a))) continue;
        if (!best || d < best.d) best = { pen: p, d, flight: g.members[0].sp.flight };
      }
    }
    if (!best) return;
    const p = best.pen, gp = p.gatePoint(0);
    const [nx, ny] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.rot];
    const tx = -ny, ty = nx;
    const s = Math.sign((dog.x - gp.x) * tx + (dog.y - gp.y) * ty) || 1;
    // Far enough along the fence that their pressure ends at the edge of
    // the gateway: it guards the side without blocking the way in (ponies,
    // who spook from far off, get a wide berth).
    const along = 8 + best.flight * HELP_RANGE * 0.9;
    const x = gp.x + nx * 7 - tx * s * along, y = gp.y + ny * 7 - ty * s * along;
    // Face across the gateway, towards where the flock comes in.
    const fx = gp.x + nx * 30 - x, fy = gp.y + ny * 30 - y;
    const face: Facing = Math.abs(fx) > Math.abs(fy) ? (fx > 0 ? 'r' : 'l') : fy > 0 ? 'd' : 'u';
    // Wary animals (a wide flight zone) get a gentler presence too.
    this.help = { pen: p, x, y, face, there: false, lostT: 0, said: false, strength: 0.4 * Math.min(1, 44 / best.flight) };
  }

  // Night: a turn round the yard with a lantern, then indoors.
  private nightRound(game: Game, r: Person, dt: number) {
    const nt = game.day.nightT;
    const d = game.doorPoint();
    if (nt > 28) {
      if (r.shown && !r.walk(game, d.x, d.y + 2, dt)) return;
      r.shown = false;
      r.lantern = false;
      r.steps = [];
      return;
    }
    r.shown = true;
    r.lantern = true;
    if (!r.run(game, dt)) return;
    const pens = game.ranch.pens;
    const p = pens.length ? pick(pens) : null;
    const g = p ? p.gatePoint(14) : { x: d.x + 20, y: d.y + 16 };
    r.go([
      { x: g.x, y: g.y, pose: 'stand', t: 2 + Math.random() * 2, face: 'u' },
      { x: d.x + (Math.random() - 0.5) * 30, y: d.y + 14, pose: 'stand', t: 1.5 },
    ]);
  }

  // Between jobs: the eggs and the wool, hay for the troughs, the garden,
  // the woodpile, the well.
  private chore(game: Game, r: Person) {
    const tier = game.tier;
    const d = game.doorPoint();
    const opts: (() => void)[] = [];
    const goodPens = game.ranch.pens.filter((p) => p.goods > 0 && p.species);
    if (goodPens.length) {
      const p = pick(goodPens);
      const sp = p.species!;
      const g = p.gatePoint(9);
      const load = sp === 'duck' ? 'y' : 'w'; // a basket of eggs, or wool, cheese and milk
      opts.push(() => r.go([
        { x: g.x, y: g.y, pose: 'crouch', t: 2.5 },
        { x: d.x, y: d.y + 4, pose: 'stand', t: 0.6, face: 'u', item: load },
      ]));
    }
    const troughs = game.ranch.buildings.filter((b) => b.kind === 'trough');
    const hay = decorAt('hay', tier);
    if (troughs.length && hay) {
      const tg = pick(troughs), h = tileCentre(hay);
      opts.push(() => r.go([
        { x: h.x, y: h.y + 4, pose: 'crouch', t: 1.4 },
        { x: tg.cx, y: tg.y1 + 6, pose: 'crouch', t: 2, item: 'y', face: 'u' },
      ]));
    }
    const garden = decorAt('garden', tier);
    if (garden) {
      const gx = (garden.x + Math.random() * (garden.w ?? 1)) * TS, gy = (garden.y + 1) * TS + 4;
      opts.push(() => r.go([
        { x: gx, y: gy, pose: 'crouch', t: 3 + Math.random() * 2 },
        { x: gx + 8, y: gy, pose: 'crouch', t: 2 + Math.random() * 2 },
      ]));
    }
    const wood = decorAt('woodpile', tier);
    if (wood) {
      const w = tileCentre(wood);
      opts.push(() => r.go([{ x: w.x + 9, y: w.y + 2, pose: 'work', t: 3 + Math.random() * 2, face: 'l' }]));
    }
    const well = decorAt('well', tier);
    if (well) {
      const w = tileCentre(well);
      opts.push(() => r.go([
        { x: w.x + 8, y: w.y + 2, pose: 'crouch', t: 1.8, face: 'l' },
        { x: d.x - 6, y: d.y + 4, pose: 'stand', t: 0.5, item: 'w' },
      ]));
    }
    // Or just a look at the stock and a moment in the sun.
    opts.push(() => {
      const p = game.ranch.pens.length ? pick(game.ranch.pens) : null;
      const g = p ? p.gatePoint(16) : { x: d.x + 24, y: d.y + 20 };
      r.go([{ x: g.x, y: g.y, pose: 'stand', t: 3 + Math.random() * 3, face: 'u' }]);
    });
    opts.push(() => r.go([{ x: d.x + (Math.random() - 0.5) * 24, y: d.y + 8, pose: 'stand', t: 3 + Math.random() * 3, face: 'd' }]));
    pick(opts)();
  }

  // ---- Building ----

  // Places to stand and hammer round a building (side on to it).
  private spots(b: Building): { x: number; y: number; face: Facing }[] {
    if (b instanceof Pen) return [
      { x: b.x0 - 5, y: b.y0 + 10, face: 'r' }, { x: b.x1 + 5, y: b.y0 + 10, face: 'l' },
      { x: b.x1 + 5, y: b.y1 - 8, face: 'l' }, { x: b.x0 - 5, y: b.y1 - 8, face: 'r' },
    ];
    return [
      { x: b.x0 - 5, y: b.y1 - 3, face: 'r' }, { x: b.cx - 6, y: b.y1 + 6, face: 'r' },
      { x: b.x1 + 5, y: b.y1 - 3, face: 'l' }, { x: b.cx + 6, y: b.y1 + 6, face: 'l' },
    ];
  }

  private build(game: Game, p: Person, job: Job, dt: number) {
    const spots = this.spots(job.b);
    const s = spots[job.spot % spots.length];
    if (!p.walk(game, s.x, s.y, dt, true)) return;
    if (!job.said) {
      job.said = true;
      this.say(game, p, p.id === 'carpenter' ? pick(['RIGHT, LET\'S GET THIS UP.', 'GOOD TIMBER, THIS.']) : pick(['I\'LL GET THAT BUILT.', 'LEAVE IT TO ME.']));
    }
    p.setPose('work');
    p.tool = 'hammer';
    p.face = s.face;
    job.done += dt;
    job.spotT += dt;
    if (job.spotT > Math.max(1.2, job.work / 3)) {
      job.spotT = 0;
      job.spot++;
    }
    if (job.done >= job.work) {
      for (let i = 0; i < 6; i++) game.fx.dust(job.b.cx + (Math.random() - 0.5) * (job.b.x1 - job.b.x0), job.b.y1 + 1);
      game.audio?.play('build', { x: job.b.cx, y: job.b.cy, vol: 0.6 });
      this.say(game, p, pick(['ALL DONE!', 'THERE WE ARE.', 'THAT\'LL STAND A HUNDRED YEARS.']), true);
      p.setPose('stand');
    }
  }

  private carpenterBrain(game: Game, p: Person, dt: number) {
    const job = this.jobs.find((j) => j.big);
    if (job && game.day.phase !== 'night') {
      this.build(game, p, job, dt);
      return;
    }
    // Off home again.
    const e = this.roadIn();
    if (p.walk(game, e.x, e.y, dt)) this.people = this.people.filter((x) => x !== p);
  }

  // ---- Out in the valley ----

  private valleyBrain(game: Game, p: Person, dt: number) {
    p.shown = game.day.phase !== 'night';
    if (!p.shown) return;
    if (!p.run(game, dt)) return;
    // Home again, idling: turn about now and then, walk a step or two.
    if (Math.hypot(p.x - p.home.x, p.y - p.home.y) > 3) {
      p.walk(game, p.home.x, p.home.y, dt);
      return;
    }
    p.setPose('stand');
    if (p.anim > 4 + Math.random() * 20) {
      p.anim = 0;
      p.face = pick(['d', 'l', 'r', 'd'] as Facing[]);
      if (p.id === 'shepherd') {
        const a = Math.random() * Math.PI * 2;
        p.go([{ x: p.home.x + Math.cos(a) * 30, y: p.home.y + Math.sin(a) * 14, pose: 'stand', t: 3 }, { x: p.home.x, y: p.home.y, t: 0 }]);
      }
    }
    // A word when the dog comes by.
    const dog = game.dog;
    if (Math.hypot(dog.x - p.x, dog.y - p.y) > 70 || this.tipDay.get(p.id) === game.day.day) return;
    let text: string | null = null;
    const yardId = (Object.keys(BUYER) as YardId[]).find((k) => BUYER[k] === p.id);
    if (yardId) {
      const o = game.orders.forYard(yardId);
      if (o) {
        const sp = SPECIES[o.species];
        const left = o.n - o.got;
        text = `${left} ${(left === 1 ? sp.name : sp.plural).toUpperCase()} BY ${tToClock(o.due)}, PLEASE!`;
      }
    } else if (p.id === 'judge') text = game.trials.run ? null : 'STAND AT THE POST AND SEND YOUR DOG.';
    else if (p.id === 'shepherd') text = 'PONIES SPOOK FROM FAR OFF. GO WIDE.';
    if (text && this.say(game, p, text)) this.tipDay.set(p.id, game.day.day);
  }

  // ---- For the game ----

  // The rancher at a pen gate is a mild pressure: the flock turns from them
  // into the gateway instead of slipping past it.
  sources(): PressureSource[] {
    const h = this.help, r = this.rancher;
    if (!h || !h.there || !r.shown) return [];
    return [{ x: r.x, y: r.y, vx: 0, vy: 0, strength: h.strength, range: HELP_RANGE, kind: 'helper', lying: false }];
  }

  drawShadows(g: CanvasRenderingContext2D) {
    for (const p of this.people) if (p.shown) ellipse(g, p.x, p.y + 1, 3, 1, C.sage);
  }

  drawables(g: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean): Drawable[] {
    const out: Drawable[] = [];
    for (const p of this.people) if (p.shown && inView(p.x, p.y)) out.push({ y: p.y, draw: () => drawPerson(g, p, this.jobs) });
    for (const j of this.jobs) if (inView(j.b.cx, j.b.cy)) out.push({ y: j.b.y1 + 1, draw: () => drawSite(g, j) });
    return out;
  }

  // Everyone carrying a lantern lights their way.
  lights(ox: number, oy: number): Light[] {
    const out: Light[] = [];
    for (const p of this.people) if (p.shown && p.lantern) out.push({ x: p.x - ox, y: p.y - 4 - oy, r: 30 });
    return out;
  }
}

// ---- Drawing ----

// What the season has everyone wearing (from the art's view of the season,
// which guests in co-op have too): whichever look is strongest.
function dressNow(): Dress {
  const { snow, leaves, bloom } = seasonLook;
  let best: Dress = 'summer', v = 1 - snow - leaves - bloom;
  if (bloom > v) (best = 'spring'), (v = bloom);
  if (leaves > v) (best = 'autumn'), (v = leaves);
  if (snow > v) best = 'winter';
  return best;
}

// A small per-person offset so folk do not blink and gesture in step.
const SEED: Partial<Record<FolkId, number>> = { rancher: 0, carpenter: 1.3, miller: 2.1, drover: 0.7, auctioneer: 1.9, judge: 2.6, shepherd: 0.4, smith: 1.1, baker: 2.4, grocer: 0.2, weaver: 1.7, cottager1: 0.9, cottager2: 2.2, cottager3: 0.5, cottager4: 1.5, cottager5: 2.8, cottager6: 0.3, warden: 1.0 };

// Talking: frames of the gesture loop (hand up, palm out and a nod, a
// point, a nod) at five a second.
const TALK = [0, 0, 0, 1, 1, 1, 3, 3, 0, 0, 2, 2, 2, 2, 3, 3, 1, 1];
// Crouching: reach, pick, lift, rest, at six a second.
const CROUCH = [0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3];

// Is this person at a building job (a hammer) rather than the woodpile (an
// axe)? Guests do not get `tool`, but they do get the sites.
function hammering(p: Person, jobs: Job[]): boolean {
  if (p.tool === 'hammer' || p.id === 'smith') return true;
  for (const j of jobs) {
    if (Math.abs(p.x - j.b.cx) < (j.b.x1 - j.b.x0) / 2 + 12 && Math.abs(p.y - j.b.cy) < (j.b.y1 - j.b.y0) / 2 + 12) return true;
  }
  return false;
}

function drawPerson(g: CanvasRenderingContext2D, p: Person, jobs: Job[]) {
  const s: PeopleSprites = dressed(p.spr, dressNow());
  const f = p.face === 'l' ? 'r' : p.face;
  const seed = SEED[p.id] ?? 0;
  const crook = !!CAST[p.id]?.crook;
  // Something held out on one side: the lantern, or the shepherd's crook.
  const holding = p.lantern || crook;
  let flip = p.face === 'l';
  let sp: Pic;
  switch (p.pose) {
    case 'walk': sp = (holding ? s.lamp : s.walk)[f][Math.floor(p.phase * 2) & 7]; break;
    case 'carry': sp = (s.carry[p.item ?? 'w'] ?? s.carry.w)[f][Math.floor(p.phase * 2) & 7]; break;
    case 'work': {
      // The blow lands as the strike frame starts (the sound is on it).
      const u = (p.anim * 2.4) % 2;
      sp = (hammering(p, jobs) ? s.hammer : s.axe)[u < 0.5 ? 0 : u < 1 ? 1 : u < 1.35 ? 2 : 3];
      if (f !== 'r') flip = false;
      break;
    }
    case 'crouch': sp = s.crouch[f][CROUCH[Math.floor((p.anim + seed) * 6) % CROUCH.length]]; break;
    case 'sit':
      flip = false;
      if (p.bubble) sp = s.sit[2 + (Math.floor(p.bubble.t * 3) & 1)];
      else sp = s.sit[(p.anim + seed * 3) % 5 > 4.3 ? 1 : 0];
      break;
    case 'wave': sp = s.wave[f][Math.floor(p.anim * 4) & 1]; break;
    default:
      if (holding) sp = s.lampStand[f];
      else if (p.bubble) sp = s.talk[f][TALK[Math.floor((p.bubble.t + seed) * 5) % TALK.length]];
      else if (p.anim > 5 && (p.anim + seed * 4) % 11 > 8) sp = s.idle[f];
      else if (f === 'd' && (p.anim + seed) % 3.7 < 0.14) sp = s.blink;
      else sp = s.stand[f];
  }
  const x = Math.round(p.x), y = Math.round(p.y);
  const held = p.pose === 'stand' || p.pose === 'walk';
  const hx = x + (flip ? -sp.hx : sp.hx), hy = y + sp.hy;
  if (crook && held) {
    // The crook in the hand (behind the body, the hand round it), its hook
    // turned outwards.
    const out = f === 'u' ? -1 : f === 'd' ? 1 : flip ? -1 : 1;
    const top = y - 14;
    line(g, hx, y, hx, top + 1, C.plum);
    rect(g, hx + out, top, 1, 1, C.plum);
    rect(g, hx + out * 2, top + 1, 1, 2, C.plum);
  }
  drawSpr(g, sp, x, y, flip);
  // The lantern hangs from the hand: the bail, and the glass glowing.
  if (p.lantern && held) box(g, hx, hy + 2, 1, 2, 'y');
}

const COLOR: Record<string, string> = { y: C.butter, w: C.wool, o: C.moss, s: C.sage, t: C.teal };

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  rect(g, x - 1, y - 1, w + 2, h + 2, C.plum);
  rect(g, x, y, w, h, COLOR[c] ?? C.wool);
}

// Scaffolding round a big job, and a stack of timber by any site.
function drawSite(g: CanvasRenderingContext2D, j: Job) {
  const b = j.b, k = j.done / j.work;
  const x0 = b.x0 + 1, x1 = b.x1 - 2, top = b.y0 - 8, base = b.y1;
  if (j.big) {
    for (const x of [x0, x1, Math.round((x0 + x1) / 2)]) line(g, x, base, x, top, C.plum);
    if (k > 0.15) {
      // A ladder up the left side.
      line(g, x0 + 3, base, x0 + 3, top + 6, C.plum);
      line(g, x0 + 5, base, x0 + 5, top + 6, C.plum);
      for (let y = base - 2; y > top + 6; y -= 3) line(g, x0 + 3, y, x0 + 5, y, C.plum);
    }
    for (const [at, from] of [[base - 6, 0.3], [Math.round((top + base) / 2), 0.55], [top + 3, 0.8]] as const) {
      if (k < from) continue;
      rect(g, x0, at, x1 - x0 + 1, 2, C.moss);
      line(g, x0, at + 2, x1, at + 2, C.plum);
    }
  }
  if (k < 0.92) {
    // The timber pile, getting smaller as it goes up.
    const n = Math.max(1, Math.ceil((1 - k) * 3));
    const px = b.x1 + 3, py = b.y1 + 2;
    for (let i = 0; i < n; i++) {
      rect(g, px - 1, py - 2 - i * 2, 9, 3, C.plum);
      rect(g, px, py - 1 - i * 2, 7, 1, C.moss);
    }
  }
}
