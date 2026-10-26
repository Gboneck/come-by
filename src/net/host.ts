import { C } from '../palette';
import type { Game } from '../game';
import { Dog } from '../entities/dog';
import { barkAt, nipAnimal, nipFrom } from '../entities/animal';
import { friendDogSprites } from '../art/dogstyle';
import { CALLS, type TapKind } from '../systems/audio';
import { saveData, type SaveData } from '../systems/save';
import { dogStatsFor } from '../systems/economy';
import { jobsAction } from '../systems/jobs';
import { closeResult } from '../systems/trials';
import { applyBuild } from '../ui/build';
import { fromWire, type WireAction } from './buildwire';
import { readLook, type Look } from '../ui/look';
import type { Particle } from '../systems/particles';
import { damp } from '../util';
import { sharedOut } from './shared';
import { PING_KINDS, Pings, pingHelp, type PingKind, type PingNet } from './ping';
import { atPost, braceReady, classLabel, currentClass, trialNip } from '../systems/trials';
import { Link, createRoom, relayBase } from './link';
import { allPens, animalRec, encodeSnap, sameAnimal, worldRecs, type AnimalRec, type DogRec } from './snapshot';
import { D_BARK, D_DIG, D_LYING, D_SNIFF, D_SPRINT } from './snapshot';
import { puppetAct } from '../systems/loot';
import { FACES, K_DOG, K_JSON, MAX_DOGS, Reader, SNAP_HZ, Writer, colourId, faceId, jsonFrame, readDog, type DogEvent, type DogState, type HostMode } from './protocol';

// Hosting co-op: this browser runs the ranch exactly as in single player,
// and friends' dogs join it as extra pressure on the herd. Each guest's
// browser runs its own dog (so it never lags for them) and sends where it
// is; their barks and nips are played here, at their dog.
//
// To the guests go: the ranch itself when they join (the save, as data)
// and whenever it changes, the ranch's numbers for their HUD, and a
// snapshot of everything that moves, 15 times a second.

interface Seat {
  slot: number;
  id: string;
  name: string;
  look: Look | null;
  dog: Dog | null; // once they have said hello
  want: DogState | null; // their dog as last sent
  at: number; // when that arrived (ms)
  away: number; // >0: dropped, seconds since
  leaving: number; // >0: trotting off, seconds left
  fresh: boolean; // needs the world and a full snapshot
  lastSeq: number;
  bg: boolean; // their screen is off (they said so): their dog naps
  ready: boolean; // at the day's end: ready for tomorrow
}

const LEAVE_AFTER = 45; // a dropped guest's dog waits this long, then trots off
const BG_KEEP = 240; // ... or this long, if they said their screen was going off
const TROT_OFF = 2.5;
const HOME_OFFSETS = [[-16, 10], [16, 10], [0, 18], [-24, 2]];

// Sounds that are the host's own menus, not the world.
const LOCAL_SOUND = /^(ui-|click)/;
const LOCAL_BANNER = /^GO HOME TO BUILD|: (HOLD THE FLANK|STAY|GO HOME)/;

export class HostNet implements PingNet {
  readonly role = 'host' as const;
  readonly slot = 0;
  pings = new Pings();
  private quiet = 0; // sounds played here that each screen plays for itself
  status: 'opening' | 'open' | 'reconnecting' | 'failed' | 'closed' = 'opening';
  error = '';
  code = '';
  private token = '';
  private base: string | null = relayBase();
  private link: Link | null = null;
  seats = new Map<number, Seat>();
  dogs: Dog[] = []; // the guests' dogs in the world, for the game
  private w = new Writer();
  private last = performance.now();
  private snapT = 0;
  private metaT = 0;
  private worldT = 0;
  private sentMeta = '';
  private sig = '';
  private cache = new Map<number, AnimalRec>();
  private events: unknown[] = [];
  private origin = 0; // the guest whose bark or nip is being played (their own screen already has it)
  private day = -1;
  private banner: unknown = null;
  private bubbles = new WeakMap<object, unknown>();
  private barkWas = new WeakMap<object, number>();
  private retry = 0;
  private retryT = 0;
  // For the test's numbers.
  stats = { snaps: 0, bytes: 0, maxSnap: 0 };

  constructor(private game: Game) {
    game.net = this;
    this.day = game.day.day;
    this.tap(true);
    document.addEventListener('visibilitychange', this.onVis);
    void this.start();
  }

  // Our screen going off: friends are told (our game stops with it).
  private onVis = () => {
    const off = document.hidden;
    if (this.link?.open) this.link.send(jsonFrame(0, { t: 'bg', on: off }));
    if (!off) {
      this.link?.ask();
      if (this.status === 'reconnecting') this.retryT = 0;
    }
  };

  get name(): string {
    return this.game.look.name;
  }

  // Everyone at the ranch, for the invite screen.
  get players(): { slot: number; name: string; here: boolean }[] {
    return [{ slot: 0, name: this.name, here: true }, ...[...this.seats.values()].filter((s) => s.dog && s.leaving <= 0).map((s) => ({ slot: s.slot, name: s.name, here: s.away <= 0 }))];
  }

  get link_url(): string {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('join', this.code);
    const relay = new URLSearchParams(location.search).get('relay');
    if (relay) u.searchParams.set('relay', relay);
    return u.toString();
  }

  private async start() {
    if (!this.base) {
      this.status = 'failed';
      this.error = 'CO-OP IS NOT SET UP ON THIS COPY';
      return;
    }
    try {
      const r = await createRoom(this.base);
      this.code = r.code;
      this.token = r.token;
    } catch {
      this.status = 'failed';
      this.error = "CAN'T REACH THE CO-OP SERVER";
      return;
    }
    if (this.status === 'closed') return;
    this.connect();
  }

  private connect() {
    if (!this.base) return;
    const q = `role=host&token=${encodeURIComponent(this.token)}&name=${encodeURIComponent(this.name)}`;
    this.link = new Link(this.base, `/rooms/${this.code}/ws?${q}`, {
      open: () => {},
      text: (m) => this.onText(m),
      binary: (b) => this.onBinary(b),
      close: (code) => this.onClose(code),
    });
  }

  private onClose(code: number) {
    this.link = null;
    if (this.status === 'closed') return;
    if (code === 4000 || code === 4403) {
      this.status = 'failed';
      this.error = code === 4403 ? 'THE ROOM WAS LOST' : 'THE ROOM CLOSED';
      for (const s of this.seats.values()) if (s.leaving <= 0) s.leaving = TROT_OFF;
      return;
    }
    // A drop: try again for a while. Friends' dogs wait where they are.
    this.status = 'reconnecting';
    this.retryT = Math.min(5, 0.5 * 2 ** this.retry++);
  }

  private onText(m: { t: string; [k: string]: unknown }) {
    if (m.t === 'welcome') {
      this.status = 'open';
      this.retry = 0;
      // Back after a drop: everyone still here gets the world again.
      const list = (m.guests as { slot: number; id: string; name: string }[]) ?? [];
      for (const g of list) {
        const s = this.seat(g.slot, g.id, g.name);
        s.fresh = true;
        s.away = 0;
      }
    } else if (m.t === 'join') {
      const s = this.seat(m.slot as number, m.id as string, m.name as string);
      s.away = 0;
      s.leaving = 0;
      s.fresh = true; // the world goes once they say hello
    } else if (m.t === 'leave') {
      const s = this.seats.get(m.slot as number);
      if (!s) return;
      if (m.gone) s.leaving = TROT_OFF;
      else s.away = 1e-3;
      this.sendPlayers();
    }
  }

  private seat(slot: number, id: string, name: string): Seat {
    let s = this.seats.get(slot);
    if (!s || s.id !== id) {
      if (s?.dog) this.drop(s);
      s = { slot, id, name: name || 'DOG', look: null, dog: null, want: null, at: 0, away: 0, leaving: 0, fresh: true, lastSeq: -1, bg: false, ready: false };
      this.seats.set(slot, s);
    }
    return s;
  }

  private drop(s: Seat) {
    if (s.dog) this.dogs = this.dogs.filter((d) => d !== s.dog);
    this.seats.delete(s.slot);
    this.releaseBuild(s.slot);
    this.readyCheck();
  }

  private onBinary(buf: ArrayBuffer) {
    if (buf.byteLength < 2) return;
    const r = new Reader(buf);
    const slot = r.u8(), kind = r.u8();
    const s = this.seats.get(slot);
    if (!s) return;
    if (kind === K_JSON) {
      const m = JSON.parse(r.str()) as { t: string; name?: string; look?: Partial<Look>; on?: boolean; a?: WireAction };
      if (m.t === 'cmd' && m.a) this.command(s, m.a);
      else if (m.t === 'build') this.guestBuild(s, !!m.on);
      else if (m.t === 'ready') {
        s.ready = !!m.on;
        if (s.ready && this.game.mode === 'summary' && !this.hostReady) this.game.showBanner(`${s.name} IS READY`, 'FOR TOMORROW', 1.6);
        this.metaT = 0;
        this.readyCheck();
      } else if (m.t === 'helpers') this.game.cycleHelpers();
      else if (m.t === 'close-result') {
        if (this.game.trials.result) closeResult(this.game);
      } else if (m.t === 'bg') {
        // A friend's screen went off (or came back): their dog naps meanwhile.
        if (!!m.on !== s.bg && s.dog) this.game.showBanner(m.on ? `${s.name} STEPPED AWAY` : `${s.name} IS BACK`, m.on ? 'THEIR DOG HAS A NAP MEANWHILE' : undefined, 1.8);
        s.bg = !!m.on;
        this.sendPlayers();
      } else if (m.t === 'hello') {
        s.name = this.uniqueName(String(m.name ?? s.name).slice(0, 10) || 'DOG', slot);
        s.look = readLook({ name: s.name, dog: m.look?.dog });
        if (!s.dog) {
          const d = new Dog(0, 0);
          d.skin = friendDogSprites(s.look.dog);
          d.tag = s.name;
          const p = this.homeSpot(slot);
          d.x = p.x;
          d.y = p.y;
          s.dog = d;
          this.dogs.push(d);
          this.game.showBanner(`${s.name} IS HERE`, 'A FRIEND CAME TO HELP', 2.4);
          // The first friend ever: what they can do, and how to talk to them.
          const game = this.game;
          if (!game.tipsSeen.has('coop-host')) {
            game.tipsSeen.add('coop-host');
            game.tip = { text: `${s.name} SHARES THE RANCH: THEIR DOG HERDS, AND THEY CAN BUILD AND TRADE FROM YOUR ONE PURSE. ${pingHelp(game.input.touchMode)}`, t: 10 };
          }
        } else {
          s.dog.skin = friendDogSprites(s.look.dog);
          s.dog.tag = s.name;
        }
        s.fresh = true;
        s.away = 0;
        s.leaving = 0;
        s.bg = false;
      }
    } else if (kind === K_DOG && s.dog) {
      const { dog, events } = readDog(r);
      s.want = dog;
      s.at = performance.now();
      s.away = 0;
      for (const e of events) {
        // A resend after a hiccup must not bark twice.
        if (((e.seq - s.lastSeq) & 0xffff) === 0 || ((e.seq - s.lastSeq) & 0xffff) > 0x8000) continue;
        s.lastSeq = e.seq;
        this.guestEvent(s, e);
      }
    }
  }

  // Two dogs called BLUE would be one too many: the second is BLUE 2.
  private uniqueName(name: string, slot: number): string {
    const taken = new Set([this.name, ...[...this.seats.values()].filter((s) => s.slot !== slot && s.dog).map((s) => s.name)]);
    if (!taken.has(name)) return name;
    for (let n = 2; ; n++) if (!taken.has(`${name.slice(0, 8)} ${n}`)) return `${name.slice(0, 8)} ${n}`;
  }

  // Where a guest's dog stands at the farmhouse door.
  private homeSpot(slot: number) {
    const d = this.game.doorPoint();
    const [ox, oy] = HOME_OFFSETS[(slot - 1) % HOME_OFFSETS.length];
    return { x: d.x + ox, y: d.y + oy };
  }

  // ---- A guest's bark and nip, played here at their dog ----

  private guestEvent(s: Seat, e: DogEvent) {
    const game = this.game, dog = s.dog!;
    if (e.kind === 'ping') {
      const kind = PING_KINDS[e.target] ?? 'here';
      this.say(s.slot, s.name, kind, e.x, e.y);
      return;
    }
    const stats = dogStatsFor(game.upgrades); // the kennel trains every dog on the ranch
    if (game.mode === 'summary') return; // between days: nothing out there to bark at
    this.origin = s.slot;
    try {
      if (e.kind === 'bark') {
        barkAt(game.animals, e.x, e.y, stats.barkRange, game.weather);
        const opts = { x: e.x, y: e.y, who: s.slot }; // their own pitch
        game.audio?.play('bark', opts);
        game.fx.ring(e.x, e.y - 2, stats.barkRange, C.wool, 0.32, 6);
        game.fx.ring(e.x, e.y - 2, stats.barkRange * 0.55, C.wool, 0.22);
        dog.puppetBark(game.fx);
        this.events.push(['db', s.slot]);
        const near = game.animals.filter((a) => !a.gone && !a.carried && Math.hypot(a.x - e.x, a.y - e.y) < stats.barkRange);
        if (near.length) {
          const a = near[Math.floor(Math.random() * near.length)];
          setTimeout(() => game.audio?.play(CALLS[a.sp.id], { x: a.x, y: a.y, vol: 0.9 }), 120 + Math.random() * 200);
        }
        for (const p of game.predators) {
          const dd = Math.hypot(p.x - e.x, p.y - e.y);
          if (dd < stats.barkRange * 1.15) p.scare((p.kind === 'wolf' ? 0.55 : 1.05) * (1 - (dd / (stats.barkRange * 1.15)) * 0.4));
        }
        return;
      }
      // E on a dig spot (no animal at the nose): the guest dug it (theirs,
      // on their screen); it is gone for everyone.
      if (!e.target && game.loot.digBy(game, e.x, e.y)) return;
      // E does for a friend all it does for the host: the trial post, a pen
      // gate, a breed for sale, the agility post, a field. Played with their
      // dog as "the dog", where they saw it; runs it starts stay theirs.
      const was = game.dog;
      dog.x = e.x;
      dog.y = e.y;
      dog.hx = e.hx;
      dog.hy = e.hy;
      game.dog = dog;
      game.actor = s.slot;
      let done = false;
      try {
        this.origin = 0; // the guest has not seen what it does yet
        done = !game.trials.result && jobsAction(game);
      } finally {
        game.dog = was;
        game.actor = 0;
        this.origin = s.slot;
      }
      if (done) return;
      for (const p of game.predators) {
        const dx = p.x - e.x, dy = p.y - e.y, dd = Math.hypot(dx, dy);
        if (p.active && dd < 14 && (dx * e.hx + dy * e.hy) / (dd || 1) > 0) p.scare(1.5 * stats.nipPower);
      }
      // The animal the guest saw at its nose, if it is still about there
      // (their view is a little behind); else whatever is at the nose here.
      const nx = e.x + e.hx * 4, ny = e.y + e.hy * 4;
      let hit = e.target ? game.animals.find((a) => a.id === e.target && !a.gone && !a.pen && !a.carried && Math.hypot(a.x - nx, a.y - ny) < a.sp.r + 22) ?? null : null;
      if (hit) nipAnimal(hit, nx, ny, e.hx, e.hy, stats.nipPower);
      else hit = nipFrom(game.animals, nx, ny, e.hx, e.hy, stats.nipPower);
      game.audio?.play('nip', { x: e.x, y: e.y });
      if (hit) {
        const a = hit;
        setTimeout(() => game.audio?.play(CALLS[a.sp.id], { x: a.x, y: a.y }), 60);
        trialNip(game, a);
      }
    } finally {
      this.origin = 0;
    }
  }

  // The hint line: at the post with a friend about, say what makes a brace.
  hint(game: Game): string | null {
    if (!this.dogs.length || game.trials.run || !atPost(game) || braceReady(game)) return null;
    const c = currentClass(game);
    const friend = this.dogs[0].tag || 'A FRIEND';
    return c ? `${game.input.touchMode ? 'NIP' : 'E'}: ${classLabel(c)}. WITH ${friend} AT THE POST TOO, IT IS A BRACE.` : null;
  }

  // ---- Building, the day's end: the ranch is everyone's ----

  builder: number | null = null; // who has build mode open (one at a time)
  private hostReady = false;

  // May this player open build mode? (Tells them who is in it, if not.)
  canBuild(slot: number): boolean {
    if (this.builder === null || this.builder === slot || (this.builder && !this.seats.has(this.builder))) return true;
    if (slot === 0) this.game.showBanner(`${this.nameOf(this.builder)} IS BUILDING`, 'ONE AT A TIME: HAVE A LOOK ROUND MEANWHILE', 2);
    return false;
  }

  claimBuild(slot: number): boolean {
    if (!this.canBuild(slot)) return false;
    this.builder = slot;
    this.metaT = 0;
    return true;
  }

  releaseBuild(slot: number) {
    if (this.builder !== slot) return;
    this.builder = null;
    this.metaT = 0;
  }

  private guestBuild(s: Seat, on: boolean) {
    if (!on) return this.releaseBuild(s.slot);
    const ok = this.claimBuild(s.slot);
    this.link?.send(jsonFrame(s.slot, { t: 'build', ok, who: ok ? '' : this.nameOf(this.builder ?? 0) }));
  }

  // A guest's change in build mode, made here by build mode's own
  // applyBuild; the result goes back to their screen (the ranch's paint is
  // sent quietly and wants no answer).
  private command(s: Seat, wire: WireAction) {
    const game = this.game;
    if (this.builder !== s.slot) {
      if (wire.k !== 'look') this.link?.send(jsonFrame(s.slot, { t: 'said', res: { good: false, say: 'BUILD MODE CLOSED', sound: 'deny' } }));
      return;
    }
    const res = applyBuild(game, fromWire(game, wire));
    if (wire.k !== 'look') this.link?.send(jsonFrame(s.slot, { t: 'said', res }));
    if (res.good && res.sound && res.at) {
      // Heard (and seen) here too; the guest hears it from their own answer.
      const x = (res.at.tx + res.at.w / 2) * 8, y = (res.at.ty + res.at.h) * 8;
      this.origin = s.slot;
      game.audio?.play(res.sound, { x, y });
      this.origin = 0;
      for (let i = 0; i < 8; i++) game.fx.dust(res.at.tx * 8 + Math.random() * res.at.w * 8, y - 1, (Math.random() - 0.5) * 20, 0);
    }
    // Everyone's copy of the ranch, now rather than in a second.
    this.worldT = 0;
    this.metaT = 0;
  }

  // The host pressed for the next day: start it if everyone is ready, or on
  // a second press; otherwise wait for them.
  nextDay(game: Game): boolean {
    const waiting = this.waitingFor();
    if (!waiting.length || this.hostReady) return true;
    this.hostReady = true;
    this.metaT = 0;
    game.showBanner(`WAITING FOR ${waiting.join(' + ')}`, game.input.touchMode ? 'TAP NEXT AGAIN TO GO WITHOUT THEM' : 'PRESS AGAIN TO GO WITHOUT THEM', 2.6);
    return false;
  }

  // Friends at the day's card who have not said ready (napping ones count as ready).
  private waitingFor(): string[] {
    return [...this.seats.values()].filter((s) => s.dog && s.leaving <= 0 && !s.ready && !s.bg && s.away <= 0 && this.builder !== s.slot).map((s) => s.name);
  }

  // Everyone ready: on to tomorrow.
  private readyCheck() {
    const game = this.game;
    if (game.mode === 'summary' && this.hostReady && !this.waitingFor().length && this.builder === null) game.fadeTo(() => game.startDay());
  }

  // ---- Pings ----

  dogOf(slot: number): Dog | null {
    return slot === 0 ? this.game.dog : this.seats.get(slot)?.dog ?? null;
  }

  nameOf(slot: number): string {
    return slot === 0 ? this.name : this.seats.get(slot)?.name ?? 'A FRIEND';
  }

  sendPing(game: Game, kind: PingKind) {
    this.say(0, this.name, kind, game.dog.x, game.dog.y);
  }

  // A ping on this screen and everyone's (each plays its own whistle).
  private say(slot: number, name: string, kind: PingKind, x: number, y: number) {
    this.quiet++;
    try {
      this.pings.add(this.game, { slot, name, kind, x, y });
    } finally {
      this.quiet--;
    }
    this.events.push(['ping', slot, kind, Math.round(x), Math.round(y)]);
  }

  // ---- Listening to the world (sounds and effects go to the guests) ----

  private tap(on: boolean) {
    const game = this.game;
    game.fx.tap = on ? (p) => this.onFx(p) : null;
    if (game.audio) game.audio.tap = on ? (k, a) => this.onSound(k, a) : null;
  }

  private onFx(p: Particle) {
    if (p.kind === 'anim' || !this.dogs.length) return;
    const ev: unknown[] = ['fx', this.origin, p.kind, Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), +p.max.toFixed(2), +p.size.toFixed(1), colourId(p.color)];
    if (p.text) ev.push(p.text);
    else if (p.dash) ev.push('', p.dash);
    this.events.push(ev);
  }

  private onSound(kind: TapKind, a: unknown[]) {
    if (!this.dogs.length || this.quiet) return;
    if (kind === 'play') {
      const name = a[0] as string;
      if (LOCAL_SOUND.test(name)) return;
      const o = (a[1] ?? {}) as { x?: number; y?: number; vol?: number; delay?: number; force?: boolean };
      this.events.push(['s', this.origin, name, o.x === undefined ? null : Math.round(o.x), o.y === undefined ? null : Math.round(o.y), o.vol ?? 1, o.delay ?? 0, o.force ? 1 : 0]);
    } else if (kind === 'stinger') {
      const o = (a[1] ?? {}) as { delay?: number; amt?: number };
      this.events.push(['st', this.origin, a[0], o.delay ?? 0, o.amt ?? null]);
    } else if (kind === 'thatllDo') this.events.push(['td', this.origin, a[0]]);
    else if (kind === 'voice') this.events.push(['v', this.origin, a[0], a[1], Math.round(a[2] as number), Math.round(a[3] as number)]);
  }

  // ---- Each frame (main.ts) ----

  frame(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const game = this.game;
    if (this.status === 'reconnecting' && (this.retryT -= dt) <= 0) {
      this.retryT = 1e9;
      this.connect();
    }
    this.moveDogs(dt, now);
    this.pings.update(dt);
    this.watch();
    if (!this.link?.open) {
      this.events.length = 0; // the guests get a whole snapshot when it is back
      return;
    }
    // A new morning: everyone's dog to the farmhouse door.
    if (game.day.day !== this.day) {
      this.day = game.day.day;
      this.hostReady = false;
      for (const s of this.seats.values()) s.ready = false;
      for (const s of this.seats.values()) {
        if (!s.dog) continue;
        const p = this.homeSpot(s.slot);
        s.dog.x = p.x;
        s.dog.y = p.y;
        s.want = null;
        this.link.send(jsonFrame(s.slot, { t: 'home', x: p.x, y: p.y }));
      }
    }
    if ((this.worldT -= dt) <= 0) {
      this.worldT = 1;
      const sig = this.worldSig();
      if (sig !== this.sig) {
        this.sig = sig;
        for (const s of this.seats.values()) if (s.dog && !s.fresh) this.sendWorld(s.slot);
      }
    }
    if ((this.metaT -= dt) <= 0) {
      this.metaT = 0.25;
      const meta = JSON.stringify(this.meta());
      if (meta !== this.sentMeta) {
        this.sentMeta = meta;
        this.link.send(jsonFrame(0, JSON.parse(meta)));
      }
    }
    if ((this.snapT -= dt) <= 0) {
      this.snapT += 1 / SNAP_HZ;
      if (this.snapT < 0) this.snapT = 0;
      this.snapshot(now);
    }
  }

  private dogRecs(): DogRec[] {
    const q = (v: number) => Math.round(v * 8);
    const d = this.game.dog;
    const out: DogRec[] = [{ slot: 0, x: q(d.x), y: q(d.y), vx: q(d.vx), vy: q(d.vy), fl: faceId(d.face) | (d.lying ? D_LYING : 0) | (d.sprinting ? D_SPRINT : 0) | (d.barkAnim > 0 ? D_BARK : 0) | (d.sniff > 0.4 ? D_SNIFF : 0) | (d.dig > 0 ? D_DIG : 0) }];
    for (const s of this.seats.values()) {
      const g = s.dog;
      if (!g || s.leaving > 0) continue;
      out.push({ slot: s.slot, x: q(g.x), y: q(g.y), vx: q(g.vx), vy: q(g.vy), fl: faceId(g.face) | (g.lying ? D_LYING : 0) | (g.sprinting ? D_SPRINT : 0) | (g.barkAnim > 0 ? D_BARK : 0) | (g.sniff > 0.4 ? D_SNIFF : 0) | (g.dig > 0 ? D_DIG : 0) });
    }
    return out.slice(0, MAX_DOGS);
  }

  private hostMode(): HostMode {
    const g = this.game;
    if (g.trials.result) return 'result';
    return g.mode as HostMode;
  }

  private snapshot(now: number) {
    const game = this.game;
    const pens = allPens(game);
    const animals: AnimalRec[] = [];
    const seen = new Set<number>();
    for (const a of game.animals) {
      if (a.gone) continue;
      const rec = animalRec(a, pens);
      seen.add(rec.id);
      const old = this.cache.get(rec.id);
      if (!old || !sameAnimal(old, rec)) {
        animals.push(rec);
        this.cache.set(rec.id, rec);
      }
    }
    const removed: number[] = [];
    for (const id of this.cache.keys()) if (!seen.has(id)) removed.push(id);
    for (const id of removed) this.cache.delete(id);
    const base = { t: Math.round(now) >>> 0, ...worldRecs(game, this.hostMode(), this.dogRecs()) };
    const events = this.events;
    this.events = [];
    encodeSnap(this.w, 0, { ...base, full: false, animals, removed, events });
    this.send(this.w.bytes());
    // Anyone who just arrived: the world, the numbers, then this moment whole.
    for (const s of this.seats.values()) {
      if (!s.fresh || !s.dog) continue;
      s.fresh = false;
      this.sendWorld(s.slot);
      this.sendPlayers();
      this.link!.send(jsonFrame(s.slot, this.meta()));
      encodeSnap(this.w, s.slot, { ...base, full: true, animals: [...this.cache.values()], removed: [], events: [] });
      this.send(this.w.bytes());
    }
  }

  private send(b: ArrayBuffer) {
    this.stats.snaps++;
    this.stats.bytes += b.byteLength;
    this.stats.maxSnap = Math.max(this.stats.maxSnap, b.byteLength);
    this.link?.send(b);
  }

  // Banners, speech bubbles and barks seen here, for the guests.
  private watch() {
    const game = this.game;
    if (!this.dogs.length) return;
    const b = game.banner;
    if (b && b !== this.banner && !LOCAL_BANNER.test(b.big)) {
      // A pen shut: the dog nearest its gate gets the "that'll do".
      if (b.big === "THAT'LL DO!") {
        const pen = [...game.ranch.pens].sort((p, q) => q.shutFlash - p.shutFlash)[0];
        if (pen) {
          const gp = pen.gatePoint(0);
          const near = (d: Dog) => Math.hypot(d.x - gp.x, d.y - gp.y);
          const best = this.dogs.reduce<Dog>((m, d) => (near(d) < near(m) ? d : m), game.dog);
          b.big = `THAT'LL DO, ${best === game.dog ? this.name : best.tag}!`;
        }
      }
      this.events.push(['b', b.big, b.small ?? '', b.max]);
    }
    this.banner = b;
    game.folk.people.forEach((p, i) => {
      if (p.bubble && this.bubbles.get(p) !== p.bubble) this.events.push(['say', i, p.bubble.text, +p.bubble.max.toFixed(2)]);
      this.bubbles.set(p, p.bubble);
    });
    const d = game.dog;
    if (d.barkAnim > (this.barkWas.get(d) ?? 0) + 0.1) this.events.push(['db', 0]);
    this.barkWas.set(d, d.barkAnim);
    game.helpers.forEach((h, i) => {
      if (h.barkAnim > (this.barkWas.get(h) ?? 0) + 0.1) this.events.push(['hb', i]);
      this.barkWas.set(h, h.barkAnim);
    });
  }

  // The guests' dogs: eased towards where they said they were, a step
  // ahead along their heading (what is sent is already a little old).
  private moveDogs(dt: number, now: number) {
    const game = this.game;
    for (const s of [...this.seats.values()]) {
      const d = s.dog;
      if (!d) continue;
      d.stats = dogStatsFor(game.upgrades);
      if (s.leaving > 0) {
        // Trotting off home, then gone.
        s.leaving -= dt;
        const door = game.doorPoint();
        const dx = door.x - d.x, dy = door.y - d.y, l = Math.hypot(dx, dy) || 1;
        const v = Math.min(60, l / Math.max(0.05, s.leaving));
        d.puppet(dt, { x: d.x + (dx / l) * v * dt, y: d.y + (dy / l) * v * dt, vx: (dx / l) * v, vy: (dy / l) * v, face: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u', lying: false, sprint: false }, game.map, game.fx);
        if (s.leaving <= 0) {
          game.fx.puff(d.x, d.y + 2);
          this.drop(s);
          this.sendPlayers();
        }
        continue;
      }
      if (s.away > 0 && (s.away += dt) > (s.bg ? BG_KEEP : LEAVE_AFTER)) {
        s.leaving = TROT_OFF;
        game.showBanner(`${s.name} HEADED HOME`, undefined, 2);
        continue;
      }
      const w = s.want;
      if (s.bg) {
        d.puppet(dt, { x: d.x, y: d.y, vx: 0, vy: 0, face: d.face, lying: true, sprint: false }, game.map, game.fx);
        continue;
      }
      if (!w) {
        d.puppet(dt, { x: d.x, y: d.y, vx: 0, vy: 0, face: d.face, lying: d.lying, sprint: false }, game.map, game.fx);
        continue;
      }
      const age = Math.min(0.25, Math.max(0, (now - s.at) / 1000));
      const tx = w.x + w.vx * age, ty = w.y + w.vy * age;
      let x = d.x, y = d.y;
      if (Math.hypot(tx - x, ty - y) > 40) {
        x = tx;
        y = ty;
      } else {
        const k = damp(14, dt);
        x += (tx - x) * k;
        y += (ty - y) * k;
      }
      d.puppet(dt, { x, y, vx: w.vx, vy: w.vy, face: FACES[w.face], lying: w.lying, sprint: w.sprint }, game.map, game.fx);
      puppetAct(d, !!w.sniff, !!w.dig, dt);
      d.hx = w.hx;
      d.hy = w.hy;
    }
  }

  // ---- What the guests are told ----

  private worldSig(): string {
    const g = this.game;
    const b = g.ranch.buildings.map((x) => `${x.kind}${x.tx},${x.ty},${x.w},${x.h},${x.rot},${x.level}`).join(';');
    const d = g.decor.map((x) => `${x.id}${x.tx},${x.ty}`).join(';');
    return `${b}|${d}|${g.look.ranch}${g.look.roof}${g.look.trim}|${g.discovery.found.size},${g.discovery.keepsakes.size}|${g.tier}`;
  }

  private sendWorld(slot: number) {
    const g = this.game;
    const save: SaveData = saveData(g);
    // The guests' copy needs the buildings, not the stock (that is in the snapshots).
    save.wild = [];
    save.buildings = save.buildings.map((b) => ({ ...b, animals: [] }));
    if (save.discovery) save.discovery = { ...save.discovery, out: [] };
    this.link?.send(jsonFrame(slot, { t: 'world', save, host: { name: this.name, look: g.look } }));
    if (!this.sig) this.sig = this.worldSig();
  }

  // A word on a friend's name tag: napping, building, ready for tomorrow.
  noteOf(d: Dog): string {
    for (const s of this.seats.values()) {
      if (s.dog !== d) continue;
      if (s.bg || s.away > 0) return 'ZZZ';
      if (this.builder === s.slot) return 'BUILDING';
      return this.game.mode === 'summary' && s.ready ? 'READY' : '';
    }
    return '';
  }

  // At the day's end: where each friend has got to (and we, once we pressed).
  readyLines(): string[] {
    const out = [...this.seats.values()].filter((s) => s.dog && s.leaving <= 0).map((s) => `${s.name}: ${this.builder === s.slot ? 'BUILDING' : s.ready ? 'READY' : s.bg || s.away > 0 ? 'AWAY' : 'NOT READY YET'}`);
    if (this.hostReady && out.length) out.push(this.game.input.touchMode ? 'YOU ARE READY. TAP NEXT DAY AGAIN TO GO NOW' : 'YOU ARE READY. PRESS AGAIN TO GO NOW');
    return out;
  }

  // Is this friend's dog napping (their screen off) or waiting on a dropped line?
  isAway(d: Dog): boolean {
    for (const s of this.seats.values()) if (s.dog === d) return s.bg || s.away > 0;
    return false;
  }

  private sendPlayers() {
    const list = [{ slot: 0, name: this.name, look: this.game.look.dog, away: false }];
    for (const s of this.seats.values()) if (s.dog && s.look && s.leaving <= 0) list.push({ slot: s.slot, name: s.name, look: s.look.dog, away: s.bg || s.away > 0 });
    this.link?.send(jsonFrame(0, { t: 'players', list }));
  }

  private meta() {
    const g = this.game;
    const r = g.trials.run;
    return {
      t: 'meta',
      coins: g.coins,
      tier: g.tier,
      won: g.won,
      totals: g.totals,
      owned: [...g.owned],
      upgrades: g.upgrades,
      orders: g.orders.list,
      trials: { won: g.trials.won, cups: g.trials.cups, last: g.trials.lastPrizeDay },
      run: r ? { cls: r.cls.id, prize: r.prize, t: Math.round(r.t * 10) / 10, step: r.step, scores: r.scores.map((x) => Math.round(x * 10) / 10), bolts: r.bolts, grips: r.grips, endT: r.endT > 0 ? 1 : 0, penned: r.penned } : null,
      result: g.trials.result,
      summary: g.mode === 'summary' ? g.summary : null,
      mode: this.hostMode(),
      host: this.name,
      builder: this.builder, // who has build mode open
      ready: [...this.seats.values()].filter((s) => s.ready).map((s) => s.slot),
      hostReady: this.hostReady,
      tut: g.tut,
      helpers: g.helpers.map((h) => h.name),
      shared: sharedOut(g),
    };
  }

  // ---- Ending ----

  // Tests (cooptest.mjs): lose the line for a moment.
  dropLine() {
    this.link?.drop();
  }

  // Stop hosting: friends are told the ranch closed.
  close() {
    if (this.status === 'closed') return;
    this.status = 'closed';
    this.tap(false);
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.link) {
      this.link.sendText(JSON.stringify({ t: 'close' }));
      this.link.close(4000, 'the ranch closed');
    }
    this.link = null;
    this.dogs = [];
    this.seats.clear();
    if (this.game.net === this) this.game.net = null;
  }
}
