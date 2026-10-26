import { C } from '../palette';
import type { Game } from '../game';
import { Dog } from '../entities/dog';
import { Animal, findGroups, nipPick } from '../entities/animal';
import { Helper } from '../entities/helper';
import { Predator } from '../entities/predator';
import { Person } from '../entities/folk';
import { SPECIES_ORDER } from '../entities/species';
import { friendDogSprites } from '../art/dogstyle';
import type { Coat } from '../art/animals';
import { loadWorld, ownDiscovery, saveInfo, type SaveData } from '../systems/save';
import { Travels } from './travels';
import { toWire } from './buildwire';
import type { BuildResult } from '../ui/build';
import { SKIES } from '../systems/weather';
import { DAY_PACE, SEASON_LIST, calendar } from '../systems/season';
import { sharedIn } from './shared';
import { PING_KINDS, Pings, pingHelp, type PingKind, type PingNet } from './ping';
import { BRACE, CLASSES, type Run } from '../systems/trials';
import { tierOf } from '../systems/progression';
import type { StingerKind } from '../systems/music';
import { DOG_NAMES, pickName, readLook, type Look } from '../ui/look';
import { pauseKeys } from '../ui/title';
import { lookKeys } from '../ui/lookui';
import { updateCoach } from '../ui/coach';
import { RESULT_READY, resultAge } from '../ui/jobs';
import { buzz } from '../ui/settings';
import type { SpeciesId } from '../world/map';
import { clamp } from '../util';
import { Link, relayBase } from './link';
import { ledgerKeys } from '../ui/ledger';
import { COLOURS, DOG_HZ, FACES, INTERP_MS, K_JSON, K_SNAP, Reader, Writer, faceId, jsonFrame, writeDog, type DogEvent, type HostMode } from './protocol';
import { A_CARRIED, A_EAT, A_HOME, A_HOP, A_PANIC, A_ROCK, A_TRIAL, A_WATER, D_LYING, D_SPRINT, FOLK_IDS, PHASES, POSES, PRED_STATES, allPens, applyAnimalExtra, decodeSnap, faceOf, type AnimalRec, type Snap } from './snapshot';

// Playing on a friend's ranch. Their browser runs the world; this one runs
// only our own dog (moved here, so it never lags) and draws the rest from
// the host's snapshots, about 100ms behind so the motion stays smooth.
// Nothing here is ever saved: the friend's ranch is theirs, and our own
// save is left alone.

interface Frame {
  t: number; // host clock (ms)
  s: Snap;
  animals: Map<number, AnimalRec>;
}

export interface Ended {
  title: string;
  line: string;
}

interface Meta {
  coins: number;
  tier: number;
  won: boolean;
  totals: Game['totals'];
  owned: string[];
  upgrades: Game['upgrades'];
  orders: Game['orders']['list'];
  trials: { won: Game['trials']['won']; cups: number; last: number };
  run: { cls: string; prize: boolean; t: number; step: number; scores: number[]; bolts: number; grips: number; endT: number; penned: boolean } | null;
  result: Game['trials']['result'];
  summary: Game['summary'];
  mode: HostMode;
  host: string;
  helpers: string[];
  shared?: Record<string, unknown>; // round three's extra ranch state (shared.ts)
  builder?: number | null; // who has build mode open (one at a time)
  ready?: number[]; // guests ready for tomorrow
  hostReady?: boolean;
  tut?: number;
}

// The guest session being set up on the title screen (main.ts takes it).
export let joining: GuestNet | null = null;

function playerId(): string {
  try {
    let id = sessionStorage.getItem('comeby-coop-id');
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Math.random()}`.slice(2);
      sessionStorage.setItem('comeby-coop-id', id);
    }
    return id;
  } catch {
    return `${Math.random()}`.slice(2);
  }
}

export class GuestNet implements PingNet {
  readonly role = 'guest' as const;
  pings = new Pings();
  status: 'connecting' | 'joining' | 'playing' | 'away' | 'reconnecting' | 'ended' = 'connecting';
  ended: Ended | null = null;
  slot = 0;
  hostName = 'YOUR FRIEND';
  world: SaveData | null = null;
  private worldNew = false;
  meta: Meta | null = null;
  players = new Map<number, { name: string; look: Look['dog']; away?: boolean }>();
  hostBg = false; // the host's screen is off: their game (the world) waits
  private failT = 0; // seconds spent failing to get back in
  private frames: Frame[] = [];
  private base: Map<number, AnimalRec> | null = null;
  private offset: number | null = null;
  private evq: { t: number; events: unknown[] }[] = [];
  private puppets = new Map<number, Dog>();
  dogs: Dog[] = [];
  private byId = new Map<number, Animal>();
  private hopWas = new Map<number, boolean>();
  private swingWas = new WeakMap<object, number>();
  private link: Link | null = null;
  private w = new Writer();
  private sendT = 0;
  private pending: DogEvent[] = [];
  private seq = 0;
  private game: Game | null = null;
  private retry = 0;
  private retryT = 0;
  private joinedAt = 0;
  private groupT = 0;
  private home: { x: number; y: number } | null = null;
  private lastTier = 0;
  private lastSnap = 0;
  fulls = 0; // whole snapshots received (one on joining, one after any drop)
  private id = playerId();
  readonly look: Look; // our own dog, from our own save
  readonly base_: string | null = relayBase();

  travels = new Travels(); // what we find here is ours to keep
  private resultSeen: string | null = null;
  private firstVisit = false;

  constructor(public code: string) {
    this.travels.include(ownDiscovery());
    const saved = saveInfo()?.look;
    this.look = readLook(saved);
    // No dog of our own yet: not BLUE as well (the host's most likely is).
    if (!saved?.name) this.look.name = pickName(DOG_NAMES, 'BLUE');
    joining = this;
    document.addEventListener('visibilitychange', this.onVis);
    this.connect();
  }

  // Our screen going off: the host is told, and our dog naps meanwhile.
  // Coming back: is the line still there?
  private onVis = () => {
    const off = document.hidden;
    if (this.link?.open) this.link.send(jsonFrame(0, { t: 'bg', on: off }));
    if (!off) {
      this.link?.ask();
      if (this.status === 'reconnecting') this.retryT = 0;
    }
  };

  // A word on a friend's name tag: napping, building, ready for tomorrow.
  noteOf(d: Dog): string {
    for (const [slot, p] of this.puppets) {
      if (p !== d) continue;
      if (this.players.get(slot)?.away) return 'ZZZ';
      if (this.meta?.builder === slot) return 'BUILDING';
      const ready = slot === 0 ? this.meta?.hostReady : this.meta?.ready?.includes(slot);
      return this.game?.mode === 'summary' && ready ? 'READY' : '';
    }
    return '';
  }

  // At the day's end: where each of us has got to.
  readyLines(): string[] {
    const m = this.meta;
    const state = (slot: number, ready: boolean) => (m?.builder === slot ? 'BUILDING' : ready ? 'READY' : 'NOT READY YET');
    const out = [`${this.hostName}: ${state(0, !!m?.hostReady)}`];
    for (const [slot, p] of this.players) if (slot !== 0 && slot !== this.slot) out.push(`${p.name}: ${state(slot, !!m?.ready?.includes(slot))}`);
    out.push(`YOU: ${state(this.slot, this.readyNow)}`);
    return out;
  }

  // Is this friend's dog napping or waiting on a dropped line?
  isAway(d: Dog): boolean {
    for (const [slot, p] of this.puppets) if (p === d) return !!this.players.get(slot)?.away;
    return false;
  }

  private connect() {
    const base = this.base_;
    if (!base) {
      this.end('NO CO-OP HERE', 'THIS COPY OF THE GAME HAS NO CO-OP SERVER SET UP.');
      return;
    }
    const q = `role=guest&id=${encodeURIComponent(this.id)}&name=${encodeURIComponent(this.look.name)}`;
    this.link = new Link(base, `/rooms/${encodeURIComponent(this.code)}/ws?${q}`, {
      open: () => {},
      text: (m) => this.onText(m),
      binary: (b) => this.onBinary(b),
      close: (code) => this.onClose(code),
    });
  }

  private end(title: string, line: string) {
    this.status = 'ended';
    document.removeEventListener('visibilitychange', this.onVis);
    this.ended = { title, line };
    this.link?.close(4000, 'bye');
    this.link = null;
  }

  private onClose(code: number) {
    this.link = null;
    if (this.status === 'ended') return;
    if (code === 4000) return this.end('THE RANCH CLOSED', `${this.hostName} HAS GONE IN FOR THE NIGHT. THANKS FOR HELPING!`);
    if (code === 4404) return this.end('NO RANCH THERE', 'NOBODY IS HOSTING WITH THAT CODE. CHECK IT WITH YOUR FRIEND.');
    if (code === 4409) return this.end('THE RANCH IS FULL', 'FOUR DOGS IS PLENTY. TRY AGAIN LATER.');
    if (code === 4001) return this.end('PLAYING ELSEWHERE', 'YOU JOINED THIS RANCH FROM ANOTHER TAB.');
    // Never got in at all: the server is not there.
    if (this.status === 'connecting' && this.retry === 0) return this.end("CAN'T CONNECT", "THE CO-OP SERVER DIDN'T ANSWER. CHECK YOUR CONNECTION.");
    // A drop: try again (for two minutes on screen; update() counts them).
    this.status = 'reconnecting';
    this.retryT = Math.min(4, 0.5 * 2 ** this.retry++);
  }

  private onText(m: { t: string; [k: string]: unknown }) {
    if (m.t === 'welcome') {
      this.slot = m.slot as number;
      this.retry = 0;
      this.failT = 0;
      this.buildAsk = null; // answers lost with the old line will not come
      if (this.game) this.game.build.waiting = null;
      this.base = null; // a whole snapshot comes after the hello
      this.status = this.game ? (m.host ? 'playing' : 'away') : 'joining';
      this.link?.send(jsonFrame(0, { t: 'hello', name: this.look.name, look: { dog: this.look.dog } }));
    } else if (m.t === 'host-away') this.status = 'away';
    else if (m.t === 'host-back') {
      this.status = 'playing';
      this.hostBg = false;
      this.base = null;
    }
  }

  private onBinary(buf: ArrayBuffer) {
    if (buf.byteLength < 2) return;
    const r = new Reader(buf);
    r.u8();
    const kind = r.u8();
    if (kind === K_JSON) this.onJson(JSON.parse(r.str()));
    else if (kind === K_SNAP) this.onSnap(decodeSnap(r));
  }

  private onJson(m: { t: string; [k: string]: unknown }) {
    if (m.t === 'world') {
      this.world = m.save as SaveData;
      this.hostName = String((m.host as { name?: string })?.name ?? this.hostName);
      this.worldNew = true;
      // First world: the title screen swaps us into the ranch (main.ts).
      if (!this.game && joining === this) this.status = 'joining';
    } else if (m.t === 'build') {
      // The host's answer about build mode.
      const ask = this.buildAsk;
      this.buildAsk = null;
      if (!this.game || !ask) return;
      if (m.ok) this.openBuild(this.game, ask.fromSummary);
      else this.game.showBanner(`${m.who || this.hostName} IS BUILDING`, 'ONE AT A TIME: HAVE A LOOK ROUND MEANWHILE', 2);
    } else if (m.t === 'said') {
      // What the host's build mode made of our change.
      if (this.game) this.game.build.answer(this.game, m.res as BuildResult);
    } else if (m.t === 'meta') {
      this.meta = m as unknown as Meta;
      this.hostName = this.meta.host || this.hostName;
      if (this.game) this.applyMeta(this.game);
    } else if (m.t === 'players') {
      this.players.clear();
      for (const p of m.list as { slot: number; name: string; look: Look['dog']; away?: boolean }[]) this.players.set(p.slot, { name: p.name, look: p.look, away: p.away });
      for (const [slot, d] of this.puppets) {
        const p = this.players.get(slot);
        if (p) {
          d.skin = friendDogSprites(readLook({ dog: p.look }).dog);
          d.tag = p.name;
        }
      }
    } else if (m.t === 'bg') this.hostBg = !!m.on;
    else if (m.t === 'home') {
      this.home = { x: m.x as number, y: m.y as number };
      if (this.game) this.goHome(this.game);
    }
  }

  private onSnap(s: Snap) {
    if (s.full) {
      this.fulls++;
      this.base = new Map(s.animals.map((a) => [a.id, a]));
      this.frames = [];
      this.evq = [];
    } else {
      if (!this.base) return; // waiting for a whole one
      const next = new Map(this.base);
      for (const a of s.animals) next.set(a.id, a);
      for (const id of s.removed) next.delete(id);
      this.base = next;
    }
    const now = performance.now();
    this.lastSnap = now;
    const off = now - s.t;
    if (this.offset === null || off < this.offset) this.offset = off;
    else this.offset += (off - this.offset) * 0.01; // creep up if the line slows
    this.frames.push({ t: s.t, s, animals: this.base });
    if (this.frames.length > 40) this.frames.shift();
    if (s.events.length) this.evq.push({ t: s.t, events: s.events });
  }

  get ready(): boolean {
    return !!this.world && !!this.base && this.frames.length > 0;
  }

  // Connected, but the host's game has stopped sending (their phone went
  // to sleep, or their tab is in the background).
  get stale(): boolean {
    return this.status === 'playing' && this.ready && performance.now() - this.lastSnap > 1500;
  }

  // ---- Into the game ----

  setup(game: Game) {
    this.game = game;
    if (joining === this) joining = null;
    game.demo = false;
    this.rebuild(game);
    if (this.meta) this.applyMeta(game);
    game.mode = 'play';
    this.goHome(game);
    this.joinedAt = game.t;
    this.firstVisit = this.travels.firstTime('coop-guest');
    // A stamp for the ranch.
    const ranch = this.world?.look?.ranch || `${this.hostName}'S RANCH`;
    if (this.travels.stamp(ranch, this.hostName)) game.showBanner(`A NEW STAMP: ${ranch}`, `RANCHES VISITED: ${this.travels.stamps.length}`, 3);
    if (this.status === 'joining') this.status = 'playing';
  }

  private rebuild(game: Game) {
    if (!this.world) return;
    this.worldNew = false;
    loadWorld(game, this.world, this.look);
    this.travels.overlay(game.discovery); // our own map and finds, over theirs
    this.lastTier = game.tier;
    // Pens and gates are new objects: the next frame re-finds them.
    this.swingWas = new WeakMap();
  }

  private goHome(game: Game) {
    const d = game.dog;
    const p = this.home ?? { x: game.doorPoint().x + 12, y: game.doorPoint().y + 10 };
    d.x = p.x;
    d.y = p.y;
    d.vx = d.vy = 0;
    d.face = 'd';
    d.stamina = d.stats.stamina;
    game.cam.x = d.x;
    game.cam.y = d.y;
  }

  private applyMeta(game: Game) {
    const m = this.meta!;
    game.coins = m.coins;
    game.won = m.won;
    game.totals = m.totals;
    game.owned = new Set(m.owned);
    game.upgrades = { ...m.upgrades };
    game.applyUpgrades(); // the kennel trains every dog on the ranch
    game.orders.list = m.orders;
    game.trials.won = m.trials.won;
    game.trials.cups = m.trials.cups;
    game.trials.lastPrizeDay = m.trials.last;
    game.trials.result = m.result;
    // A brace ribbon won here goes on our own shelf.
    const res = m.result;
    const key = res ? `${game.day.day}-${res.cls.id}-${res.total}` : null;
    if (res && key !== this.resultSeen && res.cls.id === 'brace' && res.place >= 1 && res.place <= 3) {
      this.travels.ribbon();
      game.tip = { text: 'A BRACE RIBBON FOR YOUR OWN SHELF: IT IS IN YOUR LEDGER AT HOME.', t: 6 };
    }
    if (key) this.resultSeen = key;
    game.summary = m.summary;
    const r = m.run;
    const cls = r ? [...CLASSES, BRACE].find((c) => c.id === r.cls) : undefined;
    if (r && cls) {
      const old = game.trials.run;
      const run: Run = old && old.cls === cls ? old : { cls, prize: r.prize, t: 0, step: 0, flock: [], scores: [], bolts: 0, grips: 0, stressT: 0, outrun: 0, startX: 0, startY: 0, side: new Map(), through: new Set(), panicking: new Set(), awayT: 0, endT: 0, penned: false };
      Object.assign(run, { prize: r.prize, t: r.t, step: r.step, scores: r.scores, bolts: r.bolts, grips: r.grips, endT: r.endT, penned: r.penned });
      run.flock = game.animals.filter((a) => a.trial);
      game.trials.run = run;
    } else game.trials.run = null;
    if (m.tier !== game.tier) {
      const up = m.tier > this.lastTier && this.lastTier > 0;
      game.setTier(m.tier, false);
      this.lastTier = m.tier;
      if (up) {
        // The same tier card the host sees, without the shower of new stock.
        const t = tierOf(m.tier);
        game.feel.tierCard = { n: m.tier, name: t.name, blurb: t.blurb, brings: t.brings, t: 5.5, max: 5.5 };
        game.feel.confetti(game.screen.W);
      }
    }
    sharedIn(game, m.shared);
    if (m.tut !== undefined) game.tut = m.tut; // the same first-days hints as the host's
    while (game.helpers.length < m.helpers.length) game.helpers.push(new Helper(m.helpers[game.helpers.length], 0, 0, 'flank', game.helpers.length));
    game.helpers.length = m.helpers.length;
  }

  // ---- The frame ----

  // What the host is doing, as of the moment being drawn.
  get hostMode(): HostMode {
    return this.frames.length ? this.frames[this.frames.length - 1].s.mode : 'play';
  }

  // The host is at a card everyone waits on: only the day's end (in build
  // mode or a menu the world goes on, and so do we).
  get waiting(): boolean {
    const m = this.hostMode;
    return m === 'summary' || m === 'title';
  }

  // ---- Doing everything the host can: build mode, the day's end ----

  private buildAsk: { fromSummary: boolean } | null = null;
  private wasMode: Game['mode'] = 'play';

  // Ask for build mode (one builder at a time; the host says yes or who has
  // it: what we last heard may be a moment old, so the host decides).
  private askBuild(_game: Game, fromSummary: boolean) {
    if (this.buildAsk) return;
    this.buildAsk = { fromSummary };
    this.link?.send(jsonFrame(0, { t: 'build', on: true }));
  }

  private openBuild(game: Game, fromSummary: boolean) {
    game.buildFromSummary = fromSummary;
    game.mode = 'build';
    game.build.remote = (a) => this.link?.send(jsonFrame(0, { t: 'cmd', a: toWire(game, a) }));
    game.build.enter(game);
    input(game).clearQueue();
  }

  private closeBuild(game: Game) {
    game.build.exit(game);
    game.build.remote = null;
    this.link?.send(jsonFrame(0, { t: 'build', on: false }));
    // Done building at the day's end is ready for tomorrow.
    if (game.buildFromSummary) this.setReady(game, true);
    game.mode = this.hostMode === 'summary' ? 'summary' : 'play';
    input(game).clearQueue();
  }

  private setReady(game: Game, on: boolean) {
    this.link?.send(jsonFrame(0, { t: 'ready', on }));
    this.readyNow = on;
    if (on) game.showBanner('READY FOR TOMORROW', `WAITING FOR ${this.hostName}`, 1.8);
  }

  readyNow = false; // we said ready at this day's end

  update(game: Game, dt: number) {
    game.t += dt;
    const input = game.input;
    if (input.pressed('mute') && game.audio) game.audio.setMuted(!game.audio.muted);
    if (this.status === 'reconnecting') {
      if (!document.hidden && (this.failT += dt) > 120) this.end('CONNECTION LOST', 'THE LINE TO YOUR FRIEND WENT QUIET.');
      else if ((this.retryT -= dt) <= 0) {
        this.retryT = 1e9;
        this.connect();
      }
    }
    if (this.worldNew) this.rebuild(game);
    if (this.ended) {
      game.dog.update(dt, input, game.map, game.fx, false);
      if (input.pressed('confirm') || input.pressed('bark') || input.pressed('cancel')) this.leave(game);
      this.apply(game, dt);
      return;
    }
    // The day's end: the same card as the host's, READY instead of NEXT.
    const hm = this.hostMode;
    if (hm === 'summary' && game.summary && (game.mode === 'play' || game.mode === 'pause' || game.mode === 'ledger')) {
      game.mode = 'summary';
      game.summaryT = 0;
      this.readyNow = false;
    } else if (hm !== 'summary' && game.mode === 'summary') game.mode = 'play';
    if (game.mode === 'pause') pauseKeys(game);
    else if (game.mode === 'ledger') {
      if (ledgerKeys(game)) game.mode = 'play';
    } else if (game.mode === 'look') lookKeys(game);
    else if (game.mode === 'build') {
      if (game.build.update(game, dt) === 'exit') this.closeBuild(game);
      game.buildCamera(dt);
    } else if (game.mode === 'summary') {
      if ((game.summaryT += dt) < 0.6) input.clearQueue();
      else if (input.pressed('build')) this.askBuild(game, true);
      else if (input.pressed('confirm') || input.pressed('bark')) this.setReady(game, !this.readyNow);
    } else if (game.mode === 'play') {
      if (game.trials.result) {
        // The judge's card: either of us may close it, for both.
        if (resultAge(game, 0) >= RESULT_READY && (input.pressed('confirm') || input.pressed('bark') || input.pressed('cancel'))) this.link?.send(jsonFrame(0, { t: 'close-result' }));
      } else if (input.pressed('pause')) {
        game.mode = 'pause';
        game.pauseSel = 0;
        input.clearQueue();
      } else if (input.pressed('ledger')) {
        game.mode = 'ledger';
        input.clearQueue();
      }
      if (input.pressed('build')) {
        if (game.inRanch()) this.askBuild(game, false);
        else game.showBanner('GO HOME TO BUILD', undefined, 1.4);
      }
      if (input.pressed('helper') && game.helpers.length) this.link?.send(jsonFrame(0, { t: 'helpers' }));
    } else game.mode = 'play';
    // Back from our dog's look screen: the others see the new markings.
    if (this.wasMode === 'look' && game.mode !== 'look') this.link?.send(jsonFrame(0, { t: 'hello', name: this.look.name, look: { dog: game.look.dog } }));
    this.wasMode = game.mode;

    // Our own dog, moved here. Not while everyone waits on the host.
    const free = game.mode === 'play' && this.status === 'playing' && this.ready && !this.waiting && !this.stale && !game.trials.result;
    if (!free) input.clearQueue();
    const d = game.dog;
    d.update(dt, input, game.map, game.fx, free);
    for (const ev of d.events) this.ownEvent(game, ev);
    d.events.length = 0;
    this.send(game, dt);

    this.apply(game, dt);
    this.pings.update(dt);
    if (free) this.travels.update(game, dt);
    if (game.trials.result) resultAge(game, dt);
    if ((this.groupT -= dt) <= 0) {
      game.groups = findGroups(game.animals);
      this.groupT = 0.25;
    }
    game.animalCalls(dt);
    game.fx.update(dt);
    game.life.update(game, dt);
    if (game.mode !== 'build') game.updateCamera(dt);
    game.updateTips(dt);
    if (game.mode === 'play') updateCoach(game, dt); // the same guidance as the host gets
  }

  // Our bark or nip: heard and felt here at once; the herd hears it from
  // the host, a moment later.
  private ownEvent(game: Game, ev: 'bark' | 'nip') {
    const d = game.dog;
    const [kx, ky] = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[d.face];
    let target = 0;
    if (ev === 'bark') {
      const opts = { x: d.x, y: d.y, who: this.slot }; // our own pitch
      game.audio?.play('bark', opts);
      game.feel.kick(kx, ky, 0.09);
      buzz(touch(game), 12);
    } else {
      const hit = nipPick(game.animals, d.x + d.hx * 4, d.y + d.hy * 4, d.hx, d.hy);
      target = hit?.id ?? 0;
      game.audio?.play('nip', { x: d.x, y: d.y });
      game.feel.kick(Math.round(d.hx * 2), Math.round(d.hy * 2), hit ? 0.14 : 0.08);
      buzz(touch(game), hit ? 24 : 10);
      const nx = d.x + d.hx * 7, ny = d.y + d.hy * 7 - 2;
      for (let i = 0; i < 4; i++) game.fx.add({ kind: 'spark', x: nx, y: ny, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, max: 0.18, color: hit ? C.butter : C.wool });
    }
    this.seq = (this.seq + 1) & 0xffff;
    this.pending.push({ kind: ev, seq: this.seq, x: d.x, y: d.y, hx: d.hx, hy: d.hy, target });
    this.sendT = 0; // now, not at the next tick
  }

  private send(game: Game, dt: number) {
    if ((this.sendT -= dt) > 0 || !this.link?.open || this.status === 'ended') return;
    this.sendT = 1 / DOG_HZ;
    const d = game.dog;
    writeDog(this.w, Math.round(performance.now()) >>> 0, { x: d.x, y: d.y, vx: d.vx, vy: d.vy, hx: d.hx, hy: d.hy, face: faceId(d.face), lying: d.lying, sprint: d.sprinting }, this.pending);
    this.pending = [];
    this.link.send(this.w.bytes());
  }

  // ---- The host's world, drawn a little behind ----

  private apply(game: Game, dt: number) {
    if (!this.frames.length || this.offset === null) return;
    const now = performance.now();
    const rt = now - this.offset - INTERP_MS;
    const F = this.frames;
    let bi = F.findIndex((f) => f.t > rt);
    if (bi < 0) bi = F.length - 1;
    const ai = Math.max(0, bi - 1);
    const A = F[ai], B = F[bi];
    const k = B.t > A.t ? clamp((rt - A.t) / (B.t - A.t), 0, 1) : 1;
    const near = k < 0.5 ? A.s : B.s;
    // Drop frames well behind us.
    while (F.length > 3 && F[1].t < rt - 200) F.shift();
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const P = (a: number, b: number) => (Math.abs(b - a) > 240 ? b : lerp(a, b)) / 8; // 30px: a jump, not a walk

    // The clock and the sky.
    const day = game.day;
    day.day = near.day;
    day.phase = PHASES[near.phase] ?? 'day';
    day.t = A.s.day === B.s.day ? lerp(A.s.dayT, B.s.dayT) / 100 : near.dayT / 100;
    day.nightT = lerp(A.s.nightT, B.s.nightT) / 100;
    game.rest = lerp(A.s.rest, B.s.rest) / 16;
    const w = game.weather;
    w.sky = SKIES[B.s.sky] ?? 'clear';
    w.forecast = SKIES[B.s.forecast] ?? 'clear';
    w.rain = lerp(A.s.rain, B.s.rain) / 255;
    w.fog = lerp(A.s.fog, B.s.fog) / 255;
    w.wind = lerp(A.s.wind, B.s.wind) / 255;
    const dx = lerp(A.s.dirX, B.s.dirX), dy = lerp(A.s.dirY, B.s.dirY), dl = Math.hypot(dx, dy) || 1;
    w.dirX = dx / dl;
    w.dirY = dy / dl;
    const se = game.season;
    se.season = SEASON_LIST[near.season] ?? 'summer';
    se.progress = near.sprog / 255;
    se.bloom = lerp(A.s.bloom, B.s.bloom) / 255;
    se.leaves = lerp(A.s.leaves, B.s.leaves) / 255;
    se.snow = lerp(A.s.snow, B.s.snow) / 255;
    const cal = calendar(day.day);
    se.year = cal.year;
    se.dayOf = cal.dayOf;
    Object.assign(day, DAY_PACE[se.season]); // winter's early dusk
    game.dog.drag = 0.08 * se.snow; // snow slows our own dog here too

    // Everyone else's dogs.
    const seenDogs = new Set<number>();
    for (const r of B.s.dogs) {
      if (r.slot === this.slot) continue;
      seenDogs.add(r.slot);
      let pd = this.puppets.get(r.slot);
      if (!pd) {
        pd = new Dog(r.x / 8, r.y / 8);
        const p = this.players.get(r.slot);
        pd.skin = friendDogSprites(readLook({ dog: p?.look }).dog);
        pd.tag = p?.name ?? (r.slot === 0 ? this.hostName : 'FRIEND');
        this.puppets.set(r.slot, pd);
      }
      const ra = A.s.dogs.find((o) => o.slot === r.slot) ?? r;
      const fl = (k < 0.5 ? ra : r).fl;
      pd.puppet(dt, { x: P(ra.x, r.x), y: P(ra.y, r.y), vx: lerp(ra.vx, r.vx) / 8, vy: lerp(ra.vy, r.vy) / 8, face: faceOf(fl), lying: !!(fl & D_LYING), sprint: !!(fl & D_SPRINT) }, game.map, game.fx);
      pd.stats = game.dog.stats;
    }
    for (const slot of [...this.puppets.keys()]) if (!seenDogs.has(slot)) this.puppets.delete(slot);
    this.dogs = [...this.puppets.values()];

    // Helpers.
    B.s.helpers.forEach((r, i) => {
      const h = game.helpers[i];
      if (!h) return;
      const ra = A.s.helpers[i] ?? r;
      const fl = (k < 0.5 ? ra : r).fl;
      h.x = P(ra.x, r.x);
      h.y = P(ra.y, r.y);
      h.vx = lerp(ra.vx, r.vx) / 8;
      h.vy = lerp(ra.vy, r.vy) / 8;
      h.face = faceOf(fl);
      h.lying = !!(fl & D_LYING);
      h.barkAnim -= dt;
      const v = Math.hypot(h.vx, h.vy);
      h.phase += (v * dt) / (v > 50 ? 7 : 4.5);
    });

    // Coyotes and wolves.
    const preds = B.s.preds;
    if (game.predators.length !== preds.length || preds.some((r, i) => (r.k & 1 ? 'wolf' : 'coyote') !== game.predators[i].kind))
      game.predators = preds.map((r, i) => {
        const p = new Predator(r.k & 1 ? 'wolf' : 'coyote', 0);
        p.exitX = i * 37;
        return p;
      });
    preds.forEach((r, i) => {
      const p = game.predators[i];
      const ra = A.s.preds[i] ?? r;
      p.x = P(ra.x, r.x);
      p.y = P(ra.y, r.y);
      p.vx = lerp(ra.vx, r.vx) / 8;
      p.vy = lerp(ra.vy, r.vy) / 8;
      p.face = FACES[(r.k >> 4) & 3];
      p.state = PRED_STATES[(r.k >> 1) & 7] ?? 'hunt';
      p.digT = r.dig / 8;
      p.phase += (Math.hypot(p.vx, p.vy) * dt) / 5;
    });

    // The townsfolk.
    const folk = game.folk;
    const people = B.s.folk;
    if (folk.people.length !== people.length || people.some((r, i) => FOLK_IDS[r.id] !== folk.people[i].id)) {
      folk.people = people.map((r) => new Person(FOLK_IDS[r.id] ?? 'rancher', r.x / 8, r.y / 8));
      folk.rancher = folk.people.find((p) => p.id === 'rancher') ?? folk.rancher;
    }
    people.forEach((r, i) => {
      const p = folk.people[i];
      const ra = A.s.folk[i] ?? r;
      p.x = P(ra.x, r.x);
      p.y = P(ra.y, r.y);
      p.face = faceOf(r.fl);
      p.pose = POSES[(r.fl >> 2) & 7] ?? 'stand';
      p.lantern = !!(r.fl & 32);
      p.shown = !!(r.fl & 64);
      p.phase = r.phase / 8;
      p.anim = r.anim / 16;
      p.item = r.item ? String.fromCharCode(r.item) : null;
      if (p.bubble && (p.bubble.t += dt) > p.bubble.max) p.bubble = null;
    });
    const bs = game.ranch.buildings;
    folk.jobs = B.s.sites.filter((j) => bs[j.b]).map((j) => ({ b: bs[j.b], work: 1, done: j.k / 255, big: !!j.big, spot: 0, spotT: 0, said: true }));

    // Gates: pens and the buyers' yards as the host has them; field gates
    // also open for our own dog straight away, as they would there.
    const pens = allPens(game);
    B.s.pens.forEach((r, i) => {
      const p = pens[i];
      if (!p) return;
      const ra = A.s.pens[i] ?? r;
      p.swing = lerp(ra.swing, r.swing) / 255;
      const was = this.swingWas.get(p) ?? -1;
      if (was < 0 || (was > 0.85) !== (p.swing > 0.85)) p.applyGate(game.map);
      this.swingWas.set(p, p.swing);
      p.open = !!(r.fl & 1);
      p.letOut = !!(r.fl & 2);
      p.hasTrough = !!(r.fl & 4);
      p.shutFlash = r.flash / 255;
      p.goods = r.goods;
      p.species = r.sp === 255 ? null : SPECIES_ORDER[r.sp];
      p.animals = [];
    });
    const night = day.phase === 'night';
    let restamp = false;
    game.ranch.fieldGates.forEach((gt, i) => {
      const host = B.s.fgates[i] ?? 0;
      const mine = !night && Math.hypot(game.dog.x - gt.cx, game.dog.y - gt.cy) < 22;
      gt.open = !!(host & 128) || mine;
      const before = gt.swing;
      gt.swing = clamp(gt.swing + (gt.open ? 1 : -1) * dt * 3, 0, 1);
      if ((before > 0.85) !== (gt.swing > 0.85)) restamp = true;
    });
    game.ranch.regionGates.forEach((g, i) => {
      const r = B.s.rgates[i];
      if (r === undefined) return;
      const before = g.swing;
      g.unlocked = !!(r & 128);
      g.swing = (r & 127) / 127;
      if ((before >= 0.9) !== (g.swing >= 0.9)) restamp = true;
    });
    const hs = B.s.hurdle / 255;
    game.discovery.hurdleSwing = hs;
    if ((hs > 0.5) !== game.map.hurdleOpen) {
      game.map.setHurdle(hs > 0.5);
      restamp = true;
    }
    if (restamp) game.ranch.restamp();

    // The herd.
    const live = new Set<number>();
    for (const [id, rb] of B.animals) {
      live.add(id);
      const ra = A.animals.get(id) ?? rb;
      let a = this.byId.get(id);
      if (!a) {
        const sp = (SPECIES_ORDER[rb.sc & 7] ?? 'sheep') as SpeciesId;
        a = new Animal(sp, rb.x / 8, rb.y / 8, (rb.sc >> 3) as Coat);
        a.id = id;
        this.byId.set(id, a);
        game.animals.push(a);
      }
      const fl = (k < 0.5 ? ra : rb).fl;
      a.x = P(ra.x, rb.x);
      a.y = P(ra.y, rb.y);
      a.vx = lerp(ra.vx, rb.vx) / 8;
      a.vy = lerp(ra.vy, rb.vy) / 8;
      a.speed = Math.hypot(a.vx, a.vy);
      a.face = faceOf(fl);
      a.inWater = !!(fl & A_WATER);
      a.onRock = !!(fl & A_ROCK);
      a.carried = !!(fl & A_CARRIED);
      a.grazeMode = fl & A_EAT ? 'eat' : 'amble';
      a.panicT = fl & A_PANIC ? 0.5 : 0;
      a.trial = !!(fl & A_TRIAL);
      a.home = !!(fl & A_HOME);
      a.stress = lerp(ra.st, rb.st) / 255;
      a.peakStress = Math.max(a.peakStress * 0.99, a.stress);
      a.pressure = lerp(ra.pr, rb.pr) / 255;
      const hop = !!(fl & A_HOP);
      if (hop && !this.hopWas.get(id)) a.hop = 1;
      else a.hop = Math.max(0, a.hop - dt * 6);
      this.hopWas.set(id, hop);
      const pen = (k < 0.5 ? ra : rb).pen;
      a.pen = pen ? pens[pen - 1] ?? null : null;
      if (a.pen) (a.pen as (typeof pens)[number]).animals.push(a);
      a.gone = false;
      a.phase += (a.speed * dt) / (a.sp.r * 1.3 + 1.5);
      applyAnimalExtra(a, rb.ex);
    }
    if (this.byId.size !== live.size) {
      for (const [id, a] of this.byId) if (!live.has(id)) {
        a.gone = true;
        this.byId.delete(id);
        this.hopWas.delete(id);
      }
      game.animals = game.animals.filter((a) => !a.gone);
    }

    // What happened, as the moment it happened is drawn.
    while (this.evq.length && this.evq[0].t <= rt) this.fire(game, this.evq.shift()!.events);
  }

  private fire(game: Game, events: unknown[]) {
    const audio = game.audio;
    for (const raw of events) {
      const e = raw as unknown[];
      const own = e[1] === this.slot; // our own bark or nip: done here already
      switch (e[0]) {
        case 'fx': {
          if (own) break;
          const [, , kind, x, y, vx, vy, max, size, col, text, dash] = e as [string, number, 'ring', number, number, number, number, number, number, number, string?, number?];
          game.fx.add({ kind, x, y, vx, vy, max, size, color: COLOURS[col] ?? C.wool, ...(text ? { text } : {}), ...(dash ? { dash } : {}) });
          break;
        }
        case 's': {
          if (own) break;
          const [, , name, x, y, vol, delay, force] = e as [string, number, string, number | null, number | null, number, number, number];
          // `who`: whose bark it was (each friend barks at their own pitch).
          const opts = { ...(x === null || y === null ? {} : { x, y }), vol, delay, force: !!force, who: e[1] as number };
          audio?.play(name, opts);
          break;
        }
        case 'st':
          if (!own) audio?.stinger(e[2] as StingerKind, { delay: e[3] as number, ...(e[4] === null ? {} : { amt: e[4] as number }) });
          break;
        case 'td':
          if (!own) {
            audio?.thatllDo(e[2] as string);
            game.feel.kick(0, 1, 0.12);
          }
          break;
        case 'v':
          if (!own) audio?.voice(e[2] as number, e[3] as string, e[4] as number, e[5] as number);
          break;
        case 'b':
          game.showBanner(e[1] as string, (e[2] as string) || undefined, e[3] as number);
          break;
        case 'say': {
          const p = game.folk.people[e[1] as number];
          if (p) p.bubble = { text: e[2] as string, t: 0, max: e[3] as number };
          break;
        }
        case 'db': {
          const pd = this.puppets.get(e[1] as number);
          if (pd) pd.puppetBark(game.fx);
          break;
        }
        case 'hb': {
          const h = game.helpers[e[1] as number];
          if (h) h.barkAnim = 0.25;
          break;
        }
        case 'ping':
          if (!own) this.pings.add(game, { slot: e[1] as number, name: this.nameOf(e[1] as number), kind: e[2] as PingKind, x: e[3] as number, y: e[4] as number });
          break;
      }
    }
  }

  // ---- Lines for the HUD and the cards ----

  hint(game: Game): string | null {
    const host = this.hostName, t = game.t - this.joinedAt;
    // The first visit ever explains a little more.
    if (this.firstVisit) {
      if (t < 9) return `YOU AND ${host} SHARE THIS RANCH AND ONE PURSE: BUILD, TRADE AND RUN TRIALS AS YOU LIKE. HIDDEN PLACES YOU FIND ARE YOURS.`;
      if (t < 18) return pingHelp(game.input.touchMode);
    } else if (t < 6) return `YOU AND ${host}: ONE RANCH, ONE PURSE.`;
    // The day's end: who we are waiting for.
    if (game.mode === 'summary') return this.readyNow ? `READY. WAITING FOR ${host}.` : null;
    return null; // then the same hints as the host's
  }

  // A region's first-visit tip, where a guest's is different (none now).
  regionTip(_id: string): string | undefined {
    return undefined;
  }

  nameOf(slot: number): string {
    return slot === 0 ? this.hostName : this.players.get(slot)?.name ?? 'A FRIEND';
  }

  dogOf(slot: number): Dog | null {
    return slot === this.slot ? this.game?.dog ?? null : this.puppets.get(slot) ?? null;
  }

  // Our ping: here at once, and to the host (who passes it on).
  sendPing(game: Game, kind: PingKind) {
    const d = game.dog;
    this.pings.add(game, { slot: this.slot, name: this.look.name, kind, x: d.x, y: d.y });
    this.seq = (this.seq + 1) & 0xffff;
    this.pending.push({ kind: 'ping', seq: this.seq, x: d.x, y: d.y, hx: d.hx, hy: d.hy, target: PING_KINDS.indexOf(kind) });
    this.sendT = 0;
  }

  // Leave the ranch, back to our own title screen.
  leave(game?: Game) {
    this.status = 'ended';
    document.removeEventListener('visibilitychange', this.onVis);
    this.link?.close(4000, 'left');
    this.link = null;
    if (joining === this) joining = null;
    if (game) game.fadeTo(() => (game.request = 'title'));
  }

  close() {
    this.leave();
  }

  // Tests (cooptest.mjs): lose the line for a moment.
  dropLine() {
    this.link?.drop();
  }

  get bytesIn(): number {
    return this.link?.got ?? 0;
  }
}

const touch = (game: Game) => game.input.touchMode;

const input = (game: Game) => game.input;
