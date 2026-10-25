import { C } from './palette';
import type { Screen } from './gfx/screen';
import type { Input } from './input';
import { UI } from './ui/ui';
import { drawTouchControls, touchLayout } from './ui/touch';
import { Particles } from './systems/particles';
import { Dog } from './entities/dog';
import { Animal, barkAt, findGroups, nipFrom, updateHerd, type Group, type HerdCtx, type PressureSource } from './entities/animal';
import { WORLD_H, WORLD_W, WorldMap, type RegionDef, type SpeciesId } from './world/map';
import { bake, type Baked } from './world/terrain';
import { Ranch, type RanchEvent } from './ranch/ranch';
import type { Pen } from './ranch/buildings';
import { DayCycle } from './systems/day';
import { spawnMorning } from './systems/spawner';
import { NightOverlay } from './render/night';
import { Life } from './render/life';
import { Folk } from './entities/folk';
import { drawSpeech } from './ui/speech';
import { drawWorld } from './render/world';
import { drawHud } from './ui/hud';
import { drawSummary, type Summary } from './ui/summary';
import { BuildMode } from './ui/build';
import { CATALOG } from './ranch/catalog';
import { MAX_UP, UPGRADES, dogStatsFor, sellAllGoods, updateProduce, type UpKey } from './systems/economy';
import { TIERS, newTotals, tierComplete, tierOf, type Totals } from './systems/progression';
import { drawLedger } from './ui/ledger';
import { REGIONS } from './world/map';
import { Predator, type PredCtx } from './entities/predator';
import { Barn } from './ranch/structures';
import { Helper, HELPER_COSTS, HELPER_NAMES, type HelperMode } from './entities/helper';
import { CALLS, type Sound } from './systems/audio';
import { saveGame, saveInfo } from './systems/save';
import { applyLook, defaultLook, readLook, type Look } from './ui/look';
import { drawLook, lookKeys, type LookFrom } from './ui/lookui';
import { decorDrawables, type PlacedDecor } from './ui/decorbuild';
import { stopTyping } from './ui/textfield';
import { drawPause, drawTitle, pauseKeys, titleKeys, type MenuState } from './ui/title';
import { Feel } from './ui/feel';
import { buzz } from './ui/settings';
import { updateCoach } from './ui/coach';
import { botStep } from './bot';
import { clamp, damp } from './util';
import { Orders } from './systems/orders';
import { Weather } from './systems/weather';
import { Seasons } from './systems/season';
import { Discovery } from './systems/discovery';
import { landmarkDrawables } from './art/landmarks';
import { Trials, closeResult, trialNip } from './systems/trials';
import { jobGates, jobsAction, jobsHint, jobsMorning, jobsNight, jobsUpdate } from './systems/jobs';
import { RESULT_READY, drawJobs, resultAge } from './ui/jobs';
import { courseDrawables } from './art/course';
import type { Drawable } from './art/buildings';
import type { HostNet } from './net/host';
import type { GuestNet } from './net/guest';
import { coopKeys, drawCoop, openCoop } from './ui/coop';
import { drawTransfer, openTransfer, transferKeys } from './ui/transfer';

const REST_MAX = 12; // a rested hour of daylight takes about 2s

export type Mode = 'play' | 'summary' | 'build' | 'ledger' | 'title' | 'pause' | 'look' | 'coop' | 'transfer';
export type Request = 'new' | 'continue' | 'title' | 'join' | null;

export interface DayStats {
  delivered: Partial<Record<SpeciesId, number>>;
  deliveredValue: number;
  calm: number;
  lost: Partial<Record<SpeciesId, number>>;
  goodsValue: number;
  built: number;
  sold: number;
  lostOwn?: number; // of the losses, your own stock (penned, or let out of a pen)
}

export interface Banner {
  big: string;
  small?: string;
  t: number;
  max: number;
}

const REGION_TIPS: Partial<Record<string, string>> = {
  hills: 'SHEEP STICK TOGETHER. KEEP A STEADY DISTANCE AND THEY FLOW.',
  rocky: 'GOATS SPLIT UP AND CLIMB ROCKS YOU CANNOT. LIE DOWN, LET THEM COME DOWN.',
  ford: 'CATTLE ONLY MOVE FOR CLOSE PRESSURE OR A NIP (E). THEY BALK AT WATER.',
  high: 'PONIES SPOOK FROM FAR OFF. WORK WIDE, SLOW AND QUIET.',
  show: 'SHEEPDOG TRIALS EVERY 3RD DAY. STAND BY THE CROOK AND NIP (E) TO START A RUN.',
};

const NO_DOGS: Dog[] = [];

const newStats = (): DayStats => ({ delivered: {}, deliveredValue: 0, calm: 0, lost: {}, goodsValue: 0, built: 0, sold: 0 });


// Delivery value multiplier from how stressed an animal was on the way home.
export function calmRating(stress: number): { mult: number; label: string } {
  if (stress < 0.3) return { mult: 1.5, label: 'CALM' };
  if (stress < 0.55) return { mult: 1, label: 'STEADY' };
  if (stress < 0.8) return { mult: 0.6, label: 'RATTLED' };
  return { mult: 0.35, label: 'FRANTIC' };
}

export class Game {
  g: CanvasRenderingContext2D;
  ui: UI;
  map: WorldMap;
  baked: Baked;
  ranch: Ranch;
  day = new DayCycle();
  dog: Dog;
  animals: Animal[] = [];
  groups: Group[] = [];
  fx = new Particles();
  night = new NightOverlay();
  life = new Life();
  folk = new Folk(); // the rancher and the valley's townsfolk
  cam = { x: 0, y: 0 };
  t = 0;
  mode: Mode = 'play';
  tier = 1;
  coins = 0;
  stats: DayStats = newStats();
  summary: Summary | null = null;
  banner: Banner | null = null;
  place: { text: string; t: number } | null = null;
  private lastRegion: RegionDef | null = null;
  private groupT = 0;
  private sources: PressureSource[] = [];
  debug = false;
  showZones = false;
  build = new BuildMode();
  buildFromSummary = false;
  upgrades: Record<UpKey, number> = { stamina: 1, speed: 1, bark: 1, nip: 1 };
  audio: Sound | null = null;
  // Things built or bought, for the progression goals.
  owned = new Set<string>();
  totals: Totals = newTotals();
  helpers: Helper[] = [];
  demo = false;
  menu: MenuState = { sel: 0, confirmNew: false };
  pauseSel = 0;
  request: Request = null;
  loading = true; // no autosave until construction (and any load) is done
  private demoLeg = 0;
  private callT = 4;
  won = false;
  predators: Predator[] = [];
  private quietT = 0;
  // The player's choices (dog and ranch looks) and the decor they placed.
  look: Look = defaultLook();
  decor: PlacedDecor[] = [];
  lookFrom: LookFrom = 'pause';
  lookSel = 0;
  private lookBack: Mode = 'play';
  tut = 0; // tutorial step
  tutT = 0;
  private tierCheckT = 0;
  orders = new Orders();
  trials = new Trials();
  feel = new Feel();
  weather = new Weather();
  season = new Seasons();
  discovery = new Discovery(); // hidden places, keepsakes, the Ledger map's fog
  rest = 1; // how fast the day passes: 1, or up to REST_MAX while resting
  private restT = 0;
  private idleT = 0;
  summaryT = 0; // time the end-of-day card has been up
  private buffered: Partial<Record<'bark' | 'nip', number>> = {};
  // Co-op (src/net/): hosting friends on this ranch, or a guest on theirs.
  net: HostNet | GuestNet | null = null;

  // The other players' dogs: guests' on the host, everyone else's on a guest.
  get coop(): Dog[] {
    return this.net ? this.net.dogs : NO_DOGS;
  }

  constructor(public screen: Screen, public input: Input, opts: { demo?: boolean; audio?: Sound | null; guest?: GuestNet } = {}) {
    this.demo = !!opts.demo;
    // Behind the title, the saved dog does the herding.
    if (this.demo) this.look = readLook(saveInfo()?.look);
    applyLook(this.look);
    this.audio = opts.audio ?? null;
    this.g = screen.g;
    this.ui = new UI(input);
    this.map = new WorldMap();
    this.baked = bake(this.map);
    this.ranch = new Ranch(this.map);
    this.ranch.setupStarter();
    const door = this.doorPoint();
    this.dog = new Dog(door.x, door.y);
    this.cam.x = this.dog.x;
    this.cam.y = this.dog.y;
    if (opts.guest) {
      // A friend's ranch: built from what their game sent, run by theirs.
      this.net = opts.guest;
      this.tut = 99;
      opts.guest.setup(this);
    } else if (this.demo) {
      // Attract mode behind the title: the heeler working a flock at home.
      this.mode = 'title';
      this.tut = 99;
      this.day.t = 90;
      this.spawnFlock('sheep', 800, 860, 11);
      this.dog.x = 700;
      this.dog.y = 900;
      for (const p of this.ranch.pens) { p.open = false; p.swing = 0; }
      this.ranch.restamp();
    } else this.startDay(true);
    this.loading = false;
  }

  // ---- Helpers ----

  hireHelper(): string | null {
    const n = this.helpers.length;
    if (n >= HELPER_COSTS.length) return 'TWO HELPERS IS PLENTY';
    if (this.tier < 4) return 'HELPERS COME AT TIER 4';
    if (!this.ranch.buildings.some((b) => b.kind === 'kennel')) return 'BUILD A KENNEL FIRST';
    const cost = HELPER_COSTS[n];
    if (this.coins < cost) return `NEED ${cost}$`;
    this.coins -= cost;
    const k = this.ranch.buildings.find((b) => b.kind === 'kennel')!;
    this.helpers.push(new Helper(HELPER_NAMES[n], k.cx, k.y1 + 6, 'flank', n));
    this.onBuilt('helper');
    return null;
  }

  cycleHelpers() {
    if (!this.helpers.length) return;
    const order: HelperMode[] = ['flank', 'stay', 'home'];
    const next = order[(order.indexOf(this.helpers[0].mode) + 1) % order.length];
    for (const h of this.helpers) h.mode = next;
    const names = this.helpers.map((h) => h.name).join(' + ');
    const what = next === 'flank' ? 'HOLD THE FLANK' : next === 'stay' ? 'STAY. LIE DOWN' : 'GO HOME';
    this.showBanner(`${names}: ${what}`, undefined, 1.8);
    this.audio?.play('click');
  }

  applyUpgrades() {
    this.dog.stats = dogStatsFor(this.upgrades);
  }

  onBuilt(id: string) {
    this.owned.add(id);
    if (id.startsWith('up-')) this.totals.upgrades++;
  }

  earn(n: number) {
    this.coins += n;
    this.totals.earned += n;
  }

  // ---- Progression ----

  private checkTier() {
    if (!tierComplete(this)) return;
    if (this.tier >= TIERS.length) {
      if (!this.won) {
        this.won = true;
        this.showBanner('THE VALLEY THRIVES!', 'THAT WILL DO. KEEP HERDING AS LONG AS YOU LIKE', 5);
        this.audio?.play('tierup');
      }
      return;
    }
    this.setTier(this.tier + 1, true);
  }

  // Apply everything a tier brings. `fresh` = it just happened (fanfare).
  setTier(n: number, fresh = false) {
    this.tier = n;
    for (const g of this.ranch.regionGates) {
      const reg = REGIONS.find((r) => r.id === g.region)!;
      if (reg.tier <= n && !g.unlocked) {
        g.unlocked = true;
        if (!fresh) g.swing = 1;
      }
    }
    this.ranch.growFarmhouse(n);
    this.ranch.restamp();
    if (fresh) {
      const t = tierOf(n);
      // The tier card is the banner; whatever banner was up waits behind it.
      this.feel.tierCard = { n, name: t.name, blurb: t.blurb, brings: t.brings, t: 5.5, max: 5.5 };
      this.feel.confetti(this.screen.W);
      this.feel.shake(1, 0.35);
      buzz(this.input.touchMode, [30, 60, 30, 60, 90]);
      this.audio?.play('tierup');
      // The new region's animals turn up straight away.
      this.animals.push(...spawnMorning(this.map, this.animals, this.day.day, this.tier, (r) => r.tier === n));
      this.ledgerNew = true;
    }
  }

  ledgerNew = false;

  isOnScreen(x: number, y: number, m = 8) {
    const { ox, oy, W, H } = this.view();
    return x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
  }

  inRanch() {
    return this.map.regionAt(this.dog.x, this.dog.y)?.id === 'ranch';
  }

  enterBuild(fromSummary = false) {
    this.buildFromSummary = fromSummary;
    this.mode = 'build';
    this.build.enter(this);
    this.input.clearQueue();
  }

  exitBuild() {
    this.build.exit(this);
    this.input.clearQueue();
    if (this.buildFromSummary) this.startDay();
    else {
      this.mode = 'play';
      saveGame(this);
    }
  }

  // What the purse can buy right now (for the end-of-day choice).
  buildable(): string[] {
    const out: string[] = [];
    for (const d of CATALOG) {
      if (d.tier > this.tier || d.cost > this.coins) continue;
      if (d.max && this.ranch.buildings.filter((b) => b.kind === d.kind).length >= d.max) continue;
      out.push(`${d.name} ${d.cost}$`);
    }
    if (this.ranch.buildings.some((b) => b.kind === 'kennel'))
      for (const u of UPGRADES) {
        const l = this.upgrades[u.key];
        if (l < MAX_UP && u.costs[l - 1] <= this.coins) out.push(`${u.name} ${u.costs[l - 1]}$`);
      }
    return out.slice(0, 8);
  }

  doorPoint() {
    const f = this.ranch.farmhouse!;
    return { x: f.cx, y: f.y1 + 8 };
  }

  isUnlocked(r: RegionDef) {
    return r.tier <= this.tier;
  }

  spawnFlock(id: SpeciesId, x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (6 + n * 1.2);
      this.animals.push(new Animal(id, x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
  }

  // ---- Day flow ----

  startDay(first = false, spawn = true) {
    if (!first) this.day.nextDay();
    this.stats = newStats();
    const door = this.doorPoint();
    this.dog.x = door.x;
    this.dog.y = door.y;
    this.dog.vx = this.dog.vy = 0;
    this.dog.face = 'd';
    this.dog.stamina = this.dog.stats.stamina;
    this.rest = 1;
    this.restT = 0;
    this.idleT = 0;
    this.cam.x = this.dog.x;
    this.cam.y = this.dog.y;
    for (const a of this.animals) a.stress *= 0.3;
    if (spawn) this.animals.push(...spawnMorning(this.map, this.animals, this.day.day, this.tier, (r) => this.isUnlocked(r)));
    this.animals = this.animals.filter((a) => !a.gone);
    for (const p of this.ranch.pens) if (!p.full) p.open = true;
    for (const [i, h] of this.helpers.entries()) {
      h.x = door.x + (i ? 10 : -10);
      h.y = door.y + 6;
      h.vx = h.vy = 0;
    }
    this.mode = 'play';
    this.summary = null;
    this.showBanner(`DAY ${this.day.day}`, 'BRING THEM HOME BEFORE DUSK', 2.6);
    jobsMorning(this, spawn);
    this.discovery.morning(this);
    saveGame(this);
  }

  endDay() {
    if (this.day.phase === 'night') {
      // Wild flocks out in the far pastures are not yours to lose.
      if (!this.stats.lostOwn) this.totals.nightsNoLoss++;
      // Anyone still being carried off at dawn is dropped where they are.
      for (const p of this.predators) p.dropCarry();
    }
    this.predators = [];
    const sale = sellAllGoods(this);
    this.earn(sale.value);
    this.stats.goodsValue += sale.value;
    this.totals.days++;
    const wild = this.animals.filter((a) => !a.pen && !a.gone);
    const strays = wild.filter((a) => a.stray).length;
    this.summary = {
      day: this.day.day,
      stats: this.stats,
      leftOut: wild.length,
      strays,
      coins: this.coins,
      penned: this.ranch.pens.reduce((s, p) => s + p.animals.length, 0),
      buildable: this.buildable(),
    };
    this.mode = 'summary';
    this.summaryT = 0;
    this.input.clearQueue();
  }

  // Day transitions go through a dithered plum fade.
  fadeTo(act: () => void) {
    if (this.feel.fadeTo(act)) this.input.clearQueue();
  }

  quitToTitle() {
    this.fadeTo(() => {
      saveGame(this);
      this.request = 'title';
    });
  }

  // Co-op host with friends here: menus do not stop the world for them.
  private coopWorld(dt: number) {
    if (this.demo) {
      if (this.mode === 'coop') this.updateDemo(dt); // the join screen over the title
    } else if (this.net?.role === 'host' && this.net.dogs.length) this.stepWorld(dt, false);
  }

  showBanner(big: string, small?: string, max = 2.2) {
    this.banner = { big, small, t: max, max };
  }

  // ---- Update ----

  update(dt: number) {
    this.audio?.tick(this, dt); // keeps the music scheduled through fades and hit-pause
    this.feel.update(dt, this.coins, this.screen.H);
    if (this.feel.fading) return;
    if (this.net?.role === 'guest') {
      this.net.update(this, dt);
      return;
    }
    // A beat of hit-pause when a nip lands (never under the tuning bot).
    if (this.mode === 'play' && this.feel.hitstop > 0 && !this.input.override) {
      this.feel.hitstop -= dt;
      for (const a of ['bark', 'nip'] as const) if (this.input.pressed(a)) this.buffered[a] = 0.25;
      return;
    }
    this.t += dt;
    if (this.input.pressed('mute') && this.audio) this.audio.setMuted(!this.audio.muted);
    if (this.mode === 'title') {
      this.updateDemo(dt);
      const act = titleKeys(this, this.menu);
      if (act) this.startGame(act);
      return;
    }
    if (this.mode === 'coop') {
      coopKeys(this);
      this.coopWorld(dt);
      return;
    }
    if (this.mode === 'pause') {
      pauseKeys(this);
      this.coopWorld(dt);
      return;
    }
    if (this.mode === 'look') {
      lookKeys(this);
      this.coopWorld(dt);
      return;
    }
    if (this.mode === 'transfer') {
      transferKeys(this);
      if (this.demo) this.updateDemo(dt);
      else this.coopWorld(dt);
      return;
    }
    if (this.mode === 'summary') {
      this.fx.update(dt);
      // A beat before the card takes input, so a bark held through dusk
      // does not skip the day's choice.
      if ((this.summaryT += dt) < 0.6) {
        this.input.clearQueue();
        return;
      }
      if (this.input.pressed('build')) this.fadeTo(() => this.enterBuild(true));
      else if (this.input.pressed('confirm') || this.input.pressed('bark')) this.fadeTo(() => this.startDay());
      return;
    }
    if (this.mode === 'ledger') {
      if (this.input.pressed('ledger') || this.input.pressed('cancel') || this.input.pressed('confirm')) this.mode = 'play';
      this.coopWorld(dt);
      return;
    }
    if (this.mode === 'build') {
      this.fx.update(dt);
      this.life.update(this, dt);
      this.ranch.update(dt, this.animals, this.day.phase === 'night', -1e9, -1e9);
      if (this.build.update(this, dt) === 'exit') {
        if (this.buildFromSummary) this.fadeTo(() => this.exitBuild());
        else this.exitBuild();
      }
      // Keep the cursor in view without chasing it, so a tap or a mouse
      // pointer stays put; the view pans when the cursor nears an edge.
      const k = damp(6, dt);
      const { W, H } = this.screen;
      const bx = (this.build.cx + 0.5) * 8, by = (this.build.cy + 0.5) * 8;
      const mx = Math.min(W / 2 - 4, 28), mt = Math.min(H / 2 - 4, 40), mb = Math.min(H / 2 - 4, 76);
      this.cam.x += (clamp(this.cam.x, bx - W / 2 + mx, bx + W / 2 - mx) - this.cam.x) * k;
      this.cam.y += (clamp(this.cam.y, by - H / 2 + mb, by + H / 2 - mt) - this.cam.y) * k;
      this.cam.x = clamp(this.cam.x, W / 2, WORLD_W - W / 2);
      this.cam.y = clamp(this.cam.y, H / 2, WORLD_H - H / 2);
      return;
    }
    if (this.trials.result) {
      // Trial result card: everything waits until it is closed.
      this.fx.update(dt);
      // A beat before it takes input, so a press at the end of the run
      // does not skip the judge's card.
      if (resultAge(this, dt) < RESULT_READY) this.input.clearQueue();
      else if (this.input.pressed('confirm') || this.input.pressed('bark') || this.input.pressed('cancel')) closeResult(this);
      return;
    }
    if (this.input.pressed('ledger')) {
      this.mode = 'ledger';
      this.ledgerNew = false;
      this.input.clearQueue();
      return;
    }
    if (this.input.pressed('pause')) {
      this.mode = 'pause';
      this.pauseSel = 0;
      this.input.clearQueue();
      return;
    }
    // The tier-up waits for a "that'll do" moment to finish playing.
    if ((this.tierCheckT -= dt) <= 0 && this.feel.moment <= 0 && !this.ranch.pens.some((p) => p.batch.length)) {
      this.tierCheckT = 0.5;
      this.checkTier();
    }
    this.updateTutorial(dt);
    updateCoach(this, dt);
    if (this.input.pressed('build')) {
      if (this.inRanch()) {
        this.enterBuild();
        return;
      }
      this.showBanner('GO HOME TO BUILD', undefined, 1.4);
    }
    this.stepWorld(dt, true);
  }

  // The world going on: the clock, the night, the dogs, the herd, the ranch.
  // `control` is false while a co-op host is in a menu: their dog stands.
  private stepWorld(dt: number, control: boolean) {
    this.updateRest(dt);
    this.weather.update(dt);
    this.season.update(dt);
    const dayEv = this.trials.run ? null : this.day.update(dt * this.rest); // the clock waits for a trial run
    if (dayEv === 'dusk') {
      this.showBanner('DUSK', this.tier >= 2 ? 'GET THEM HOME. COYOTES COME AT NIGHT' : 'GET THEM HOME, THE LIGHT IS GOING', 2.8);
      this.audio?.play('dusk');
    }
    if (dayEv === 'nightfall') {
      if (this.tier >= 2) this.startNight();
      else {
        this.fadeTo(() => this.endDay());
        return;
      }
    }
    if (dayEv === 'dawn') {
      this.fadeTo(() => this.endDay());
      return;
    }
    if (this.day.phase === 'night') {
      const m = this.mode;
      this.updateNight(dt);
      if (this.mode !== m) return;
    }

    if (control) {
      this.bufferPress('bark', this.dog.barkCd, dt);
      this.bufferPress('nip', this.dog.nipCd, dt);
    }
    this.dog.update(dt, this.input, this.map, this.fx, control);
    for (const ev of this.dog.events) this.onDogEvent(ev);
    this.dog.events.length = 0;
    updateHerd(this.animals, this.herdCtx(), dt);
    const night = this.day.phase === 'night';
    for (const ev of this.ranch.update(dt, this.animals, night, this.dog.x, this.dog.y, this.coop)) this.onRanchEvent(ev);
    jobsUpdate(this, dt);
    this.discovery.update(this, dt);
    if (!night && !this.trials.run) updateProduce(this, dt * this.rest);
    if ((this.groupT -= dt) <= 0) {
      this.groups = findGroups(this.animals);
      this.groupT = 0.25;
    }
    if (control && this.input.pressed('helper')) {
      if (this.helpers.length) this.cycleHelpers();
      else if (this.debug) this.showZones = !this.showZones;
    }
    this.helpers.forEach((h, i) => h.update(this, dt, i));
    this.animalCalls(dt);
    this.fx.update(dt);
    this.life.update(this, dt);
    this.folk.update(this, dt);
    this.updateCamera(dt);
    this.updateTips(dt);
  }

  // The region's name (and a first-visit tip) as the dog enters, and the
  // timers on the lines that come and go.
  updateTips(dt: number) {
    const reg = this.map.regionAt(this.dog.x, this.dog.y);
    if (reg && reg !== this.lastRegion) {
      this.place = { text: reg.name.toUpperCase(), t: 2.4 };
      this.lastRegion = reg;
      const tip = REGION_TIPS[reg.id];
      if (tip && !this.tipsSeen.has(reg.id) && reg.tier <= this.tier) {
        this.tipsSeen.add(reg.id);
        this.tip = { text: this.input.touchMode ? tip.replace(' (E)', '') : tip, t: 8 };
      }
    }
    if (this.tip && (this.tip.t -= dt) <= 0) this.tip = null;
    if (this.place && (this.place.t -= dt) <= 0) this.place = null;
    if (this.banner && !this.feel.tierCard && (this.banner.t -= dt) <= 0) this.banner = null;
  }

  // ---- Resting ----
  //
  // Lying down on the ranch with no loose stock about rests the dog: the
  // clock (and the goods in the pens) speed up, so waiting for dusk or for
  // the eggs is never dead time. Getting up, or anything wandering close,
  // ends it at once. Never at night or under the bot.
  canRest(): boolean {
    const d = this.dog;
    if (!d.lying || this.day.phase === 'night' || this.trials.run || this.input.override || !this.inRanch()) return false;
    // Co-op: everyone has to be lying down at home for the day to fly by.
    if (this.coop.some((o) => !o.lying || this.map.regionAt(o.x, o.y)?.id !== 'ranch')) return false;
    // Anything loose right by the dog stops it; further off, only stock that
    // is moving or upset does (calm strays grazing by the yard do not).
    return !this.animals.some((a) => {
      if (a.pen || a.gone || a.trial) return false;
      const dd = Math.hypot(a.x - d.x, a.y - d.y);
      return dd < 40 || (dd < 110 && (a.stress > 0.25 || a.pressure > 0.05 || a.fleeT > 0));
    });
  }

  private updateRest(dt: number) {
    if (!this.canRest()) {
      this.restT = 0;
      this.rest = 1;
      // Standing about on a quiet ranch: say once that resting is a thing.
      // (Only once nothing is left out to herd: a morning with stock waiting
      // is no time to tell anyone to rest.)
      const idle = this.inRanch() && this.day.phase !== 'night' && this.dog.speed < 4 && !this.groups.some((gr) => !gr.members[0].trial);
      this.idleT = idle ? this.idleT + dt : 0;
      if (this.idleT > 4 && this.tut >= 7 && !this.tipsSeen.has('rest') && !this.input.override) {
        this.tipsSeen.add('rest');
        this.tip = { text: this.restHint(), t: 7 };
      }
      return;
    }
    this.restT += dt;
    // A second of lying still, then the clock eases up to full speed.
    const k = clamp((this.restT - 1) / 1.5, 0, 1);
    this.rest = 1 + (REST_MAX - 1) * k * k * (3 - 2 * k);
    // The dog curls up asleep and the valley runs fast (render/world.ts).
  }

  // ---- Night ----

  sheltered(p: Pen): boolean {
    if (this.ranch.buildings.some((b) => b instanceof Barn && Math.hypot(b.cx - p.cx, b.cy - p.cy) <= b.shelterRadius)) return true;
    // A helper lying by a pen's gate guards it.
    return this.day.phase === 'night' && this.helpers.some((h) => h.guardPen === p && Math.hypot(h.x - p.cx, h.y - p.cy) < 60);
  }

  startNight() {
    this.day.startNight();
    this.predators = [];
    // Helpers each take the most crowded pen nobody else is guarding.
    const open = this.ranch.pens.filter((p) => p.animals.length && !this.sheltered(p)).sort((a, b) => b.animals.length - a.animals.length);
    this.helpers.forEach((h, i) => (h.guardPen = open[i] ?? null));
    const coyotes = Math.min(4, 1 + Math.floor((this.day.day + this.tier) / 5));
    const wolves = this.tier >= 4 ? Math.min(2, 1 + Math.floor(this.day.day / 8)) : 0;
    let t = 3;
    for (let i = 0; i < coyotes + wolves; i++) {
      this.predators.push(new Predator(i < coyotes ? 'coyote' : 'wolf', t));
      t += 5 + Math.random() * 6;
    }
    this.quietT = 0;
    jobsNight(this);
    if (this.weather.sky !== 'storm') this.showBanner('NIGHT FALLS', wolves ? 'WOLVES AND COYOTES ARE ABOUT. GUARD THE STOCK' : 'COYOTES ARE ABOUT. GUARD THE STOCK', 3);
    if (!this.tipsSeen.has('night')) {
      this.tipsSeen.add('night');
      this.tip = { text: this.input.touchMode ? 'BARK AT A COYOTE TO SEND IT RUNNING. PENS IN A BARN\'S RING ARE SAFE.' : 'SPACE TO BARK A COYOTE AWAY (WOLVES NEED TWO). PENS IN A BARN\'S RING ARE SAFE.', t: 9 };
    }
    this.audio?.play('howl');
  }

  private predCtx(): PredCtx {
    const claimed = new Map<object, Predator>();
    for (const p of this.predators) {
      if (p.state === 'hunt' || p.state === 'dig') {
        if (p.target) claimed.set(p.target, p);
        if (p.pen) claimed.set(p.pen, p);
      }
    }
    return {
      map: this.map,
      dogX: this.dog.x,
      dogY: this.dog.y,
      dogLying: this.dog.lying,
      others: this.coop,
      animals: this.animals,
      pens: this.ranch.pens,
      sheltered: (p) => this.sheltered(p),
      fx: this.fx,
      claimed,
      onGrab: (a, p) => {
        this.audio?.play('yelp', { x: p.x, y: p.y });
        if (this.isOnScreen(a.x, a.y, 40)) this.fx.float(a.x, a.y - 12, '!', C.butter, 0.8);
      },
      onLoss: (a, p) => {
        this.stats.lost[a.sp.id] = (this.stats.lost[a.sp.id] ?? 0) + 1;
        if (a.home) this.stats.lostOwn = (this.stats.lostOwn ?? 0) + 1;
        this.totals.lost++;
        this.showBanner(`A ${p.kind.toUpperCase()} TOOK A ${a.sp.name.toUpperCase()}`, undefined, 2.2);
        this.audio?.play('howl');
      },
    };
  }

  private updateNight(dt: number) {
    const ctx = this.predCtx();
    for (const p of this.predators) {
      p.update(dt, ctx);
      // Catch a thief and it lets go.
      if (p.carry && (Math.hypot(p.x - this.dog.x, p.y - this.dog.y) < 11 || this.coop.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < 11))) {
        p.scare(2);
        const a = p.dropCarry();
        if (a) this.fx.float(a.x, a.y - 12, 'SAVED!', C.butter, 1.2);
      }
    }
    // A quiet night ends early once every visitor is gone.
    const left = this.predators.some((p) => p.state !== 'gone');
    if (!left) {
      this.quietT += dt;
      if (this.quietT > 2.5) this.fadeTo(() => this.endDay());
    }
  }

  private herdCtx(): HerdCtx {
    const d = this.dog;
    this.sources.length = 0;
    this.sources.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, strength: 1, range: 1, kind: 'dog', lying: d.lying });
    for (const p of this.predators)
      if (p.active && p.state !== 'flee') this.sources.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, strength: 1.3, range: 1.5, kind: 'predator', lying: false });
    for (const h of this.helpers) this.sources.push(h.source());
    this.sources.push(...this.folk.sources());
    for (const o of this.coop) this.sources.push({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, strength: 1, range: 1, kind: 'dog', lying: o.lying });
    const gates = this.ranch.pens.map((p: Pen) => {
      const gp = p.gatePoint(-6);
      return { x: gp.x, y: gp.y, open: p.swing > 0.8, accepts: (a: Animal) => p.accepts(a) };
    });
    gates.push(...jobGates(this));
    return { map: this.map, sources: this.sources, dogX: d.x, dogY: d.y, dogR: d.r, dogLying: d.lying, gates, weather: this.weather, dogs: this.coop.length ? this.coop : undefined };
  }

  private onDogEvent(ev: 'bark' | 'nip') {
    const d = this.dog;
    const [kx, ky] = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[d.face];
    if (ev === 'bark') {
      barkAt(this.animals, d.x, d.y, d.stats.barkRange, this.weather);
      this.audio?.play('bark', { x: d.x, y: d.y });
      this.feel.kick(kx, ky, 0.09);
      buzz(this.input.touchMode, 12);
      // Something in range answers back.
      const near = this.animals.filter((a) => !a.gone && !a.carried && Math.hypot(a.x - d.x, a.y - d.y) < d.stats.barkRange);
      if (near.length) {
        const a = near[Math.floor(Math.random() * near.length)];
        setTimeout(() => this.audio?.play(CALLS[a.sp.id], { x: a.x, y: a.y, vol: 0.9 }), 120 + Math.random() * 200);
      }
      for (const p of this.predators) {
        const dd = Math.hypot(p.x - d.x, p.y - d.y);
        if (dd < d.stats.barkRange * 1.15) p.scare((p.kind === 'wolf' ? 0.55 : 1.05) * (1 - (dd / (d.stats.barkRange * 1.15)) * 0.4));
      }
    } else {
      if (jobsAction(this)) return; // E at the trial post or a pen gate
      for (const p of this.predators) {
        const dx = p.x - d.x, dy = p.y - d.y, dd = Math.hypot(dx, dy);
        if (p.active && dd < 12 && (dx * d.hx + dy * d.hy) / (dd || 1) > 0) p.scare(1.5 * d.stats.nipPower);
      }
      const hit = nipFrom(this.animals, d.x + d.hx * 4, d.y + d.hy * 4, d.hx, d.hy, d.stats.nipPower);
      this.audio?.play('nip', { x: d.x, y: d.y });
      if (hit) setTimeout(() => this.audio?.play(CALLS[hit.sp.id], { x: hit.x, y: hit.y }), 60);
      if (hit) trialNip(this, hit);
      this.feel.kick(Math.round(d.hx * 2), Math.round(d.hy * 2), hit ? 0.14 : 0.08);
      if (hit) this.feel.hitstop = 0.06;
      buzz(this.input.touchMode, hit ? 24 : 10);
      const nx = d.x + d.hx * 7, ny = d.y + d.hy * 7 - 2;
      for (let i = 0; i < 4; i++)
        this.fx.add({ kind: 'spark', x: nx, y: ny, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, max: 0.18, color: hit ? C.butter : C.wool });
    }
  }

  private onRanchEvent(ev: RanchEvent) {
    if (ev.kind === 'penned') {
      const a = ev.animal;
      if (a.home) {
        // Your own stock coming back: no delivery pay.
        a.deliveryValue = 0;
        this.fx.float(a.x, a.y - 10, 'HOME', C.wool, 0.9);
        return;
      }
      const { mult } = calmRating(a.peakStress);
      const value = Math.max(1, Math.round(a.sp.value * mult));
      a.deliveryValue = value;
      this.earn(value);
      this.stats.deliveredValue += value;
      this.stats.delivered[a.sp.id] = (this.stats.delivered[a.sp.id] ?? 0) + 1;
      this.totals.delivered[a.sp.id] = (this.totals.delivered[a.sp.id] ?? 0) + 1;
      if (this.tut === 3) { this.tut = 4; this.tutT = 0; }
      if (mult > 1) this.stats.calm++;
      this.fx.float(a.x, a.y - 10, `+${value}$`, C.butter, 1.1);
      this.audio?.play('coin', { x: a.x, y: a.y, vol: 0.7 });
      const v = this.view();
      this.feel.flyCoins(a.x - v.ox, a.y - v.oy - 10, value, 2);
    } else if (ev.kind === 'shut') {
      this.audio?.play('gate', { x: ev.pen.cx, y: ev.pen.cy });
      const n = ev.batch.length;
      const avg = ev.batch.reduce((s, a) => s + a.peakStress, 0) / Math.max(1, n);
      const { label } = calmRating(avg);
      this.audio?.thatllDo(label);
      if (label === 'CALM') this.totals.calmBatches++;
      const value = ev.batch.reduce((s, a) => s + a.deliveryValue, 0);
      const sp = ev.batch[0].sp;
      this.showBanner("THAT'LL DO!", `${n} ${(n === 1 ? sp.name : sp.plural).toUpperCase()}  ${label}${value ? `  +${value}$` : ''}`, 2.8);
      this.feel.moment = 1.8;
      this.feel.kick(0, 2, 0.16);
      buzz(this.input.touchMode, [18, 50, 36]);
      const gp = ev.pen.gatePoint(0);
      this.fx.ring(gp.x, gp.y - 2, 26, C.butter, 0.4, 4);
      for (let i = 0; i < 10; i++)
        this.fx.add({ kind: 'spark', x: gp.x, y: gp.y - 4, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50, max: 0.5, color: C.butter });
    }
  }

  // The dog's look screen: at a new game, from the kennel, from the pause menu.
  openLook(from: LookFrom) {
    this.lookFrom = from;
    if (this.mode !== 'look') this.lookBack = this.mode;
    this.mode = 'look';
    this.lookSel = 0;
    this.input.clearQueue();
  }

  closeLook() {
    stopTyping();
    if (!this.look.name.trim()) this.look.name = defaultLook().name;
    applyLook(this.look);
    this.mode = this.lookFrom === 'new' ? 'play' : this.lookBack;
    this.input.clearQueue();
    saveGame(this);
  }

  // Title menu choice: fade out, then main.ts swaps in the new game.
  startGame(act: 'new' | 'continue' | 'join' | 'move') {
    if (act === 'join') openCoop(this, 'join');
    else if (act === 'move') openTransfer(this);
    else this.fadeTo(() => (this.request = act));
  }

  // A bark or nip pressed just before the dog is ready still happens.
  private bufferPress(a: 'bark' | 'nip', cd: number, dt: number) {
    const b = this.buffered[a] ?? 0;
    if (this.input.peek(a)) {
      if (cd > 0) {
        this.input.pressed(a);
        if (cd < 0.2) this.buffered[a] = 0.25;
      }
    } else if (b > 0) {
      if (cd <= 0) {
        this.input.push(a);
        this.buffered[a] = 0;
      } else this.buffered[a] = b - dt;
    }
  }

  // Attract mode: the bot drives the demo flock back and forth.
  private updateDemo(dt: number) {
    const legs = [{ x: 700, y: 880 }, { x: 880, y: 880 }];
    const goal = legs[this.demoLeg % 2];
    let cx = 0, cy = 0;
    for (const a of this.animals) { cx += a.x; cy += a.y; }
    cx /= Math.max(1, this.animals.length);
    cy /= Math.max(1, this.animals.length);
    if (Math.hypot(cx - goal.x, cy - goal.y) < 30) this.demoLeg++;
    const c = botStep(this, { goalX: goal.x, goalY: goal.y }, this.t);
    const save = this.input.override;
    this.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    this.dog.update(dt, this.input, this.map, this.fx);
    this.input.override = save;
    this.dog.events.length = 0;
    updateHerd(this.animals, this.herdCtx(), dt);
    if ((this.groupT -= dt) <= 0) {
      this.groups = findGroups(this.animals);
      this.groupT = 0.25;
    }
    this.fx.update(dt);
    this.life.update(this, dt);
    this.folk.update(this, dt);
    const k = damp(1.5, dt);
    this.cam.x += ((cx + this.dog.x) / 2 - this.cam.x) * k;
    this.cam.y += ((cy + this.dog.y) / 2 + 20 - this.cam.y) * k;
    const { W, H } = this.screen;
    this.cam.x = clamp(this.cam.x, W / 2, WORLD_W - W / 2);
    this.cam.y = clamp(this.cam.y, H / 2, WORLD_H - H / 2);
  }

  // Now and then a flock near the dog calls out; frightened ones more often.
  animalCalls(dt: number) {
    if (!this.audio) return;
    this.callT -= dt;
    if (this.callT > 0) return;
    const gr = this.nearestGroup(130);
    this.callT = 4 + Math.random() * 5;
    if (!gr) return;
    if (gr.stress > 0.5) this.callT *= 0.5;
    const a = gr.members[Math.floor(Math.random() * gr.members.length)];
    this.audio.play(CALLS[a.sp.id], { x: a.x, y: a.y, vol: 0.5 + gr.stress * 0.5 });
  }

  // Contextual first-day hints. Steps advance on what the player does.
  private updateTutorial(dt: number) {
    if (this.tut >= 7) return;
    this.tutT += dt;
    const near = this.nearestGroup(90);
    const step = (n: number) => { this.tut = n; this.tutT = 0; };
    switch (this.tut) {
      case 0: if (near) step(1); break;
      // Four seconds of actually pushing them, so the "walk in slowly" hint
      // has time to be read and tried.
      case 1: if (this.animals.some((a) => !a.pen && a.pressure > 0.15)) { if (this.tutT > 4) step(2); } else this.tutT = Math.max(0, this.tutT - 2 * dt); break;
      case 2: if ((this.dog.lying && this.tutT > 1) || this.tutT > 14) step(3); break;
      case 3: break; // advanced by the first penned animal
      case 4: if (this.tutT > 5) step(5); break;
      case 5: if (this.tutT > 5) step(6); break;
      case 6: if (this.ranch.buildings.some((b) => b.kind === 'kennel')) step(7); break;
    }
  }

  tip: { text: string; t: number } | null = null;
  tipsSeen = new Set<string>();

  restHint() {
    return this.input.touchMode ? 'HOLD DOWN ON THE RANCH TO REST: THE DAY PASSES QUICKLY.' : 'HOLD Q ON THE RANCH TO REST: THE DAY PASSES QUICKLY.';
  }

  hint(): string | null {
    if (this.rest > 1.5) return 'RESTING... THE PENS KEEP MAKING GOODS.';
    if (this.tip) return this.tip.text;
    if (this.net?.role === 'guest') return this.net.hint(this);
    const jh = jobsHint(this);
    if (jh) return jh;
    const touch = this.input.touchMode;
    switch (this.tut) {
      case 0: return 'YOUR DUCKS ARE OUT IN THE HOME MEADOW. HEAD EAST!';
      case 1: return 'CIRCLE ROUND BEHIND THEM, THEN WALK IN SLOWLY TO DRIVE THEM HOME.';
      case 2: return touch ? 'HOLD DOWN TO LIE DOWN: THEY SETTLE AND SLOW.' : 'HOLD Q TO LIE DOWN: THEY SETTLE AND SLOW.';
      case 3: return 'EASE THEM IN THROUGH THE OPEN PEN GATE.';
      case 4: return 'CALM DRIVES PAY X1.5. A BARK MOVES THEM FAST BUT SCARES THEM.';
      case 5: return touch ? 'TAP YOUR GOAL (TOP LEFT) FOR THE RANCH LEDGER.' : 'TAB OPENS THE RANCH LEDGER: GOALS AND WHAT COMES NEXT.';
      case 6:
        if (this.coins >= 20) return touch ? 'YOU CAN AFFORD A KENNEL: TAP BUILD AT THE RANCH.' : 'YOU CAN AFFORD A KENNEL: PRESS B AT THE RANCH.';
        // Not enough yet: the eggs sell at the end of the day.
        return this.day.phase === 'night' ? null : `GOODS SELL AT DAY'S END. ${this.restHint()}`;
    }
    return null;
  }

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

  updateCamera(dt: number) {
    const d = this.dog;
    let tx = d.x + d.vx * 0.35;
    let ty = d.y + d.vy * 0.35;
    // Lean towards the flock you are working so you can see both (on a
    // trial outrun, from the post).
    const gr = this.nearestGroup(this.trials.run ? 200 : 110);
    if (gr) {
      tx += (gr.x - d.x) * 0.3;
      ty += (gr.y - d.y) * 0.3;
    }
    // On a phone held upright, frame the dog in the field above the thumbs.
    const { W, H } = this.screen;
    const band = this.thumbBand();
    if (H > W) ty += band / 2;
    const k = damp(4, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.x = clamp(this.cam.x, W / 2, WORLD_W - W / 2);
    this.cam.y = clamp(this.cam.y, H / 2, WORLD_H - H / 2 + band);
  }

  // Height of the strip the touch controls cover at the bottom. The view may
  // run that far past the world's bottom edge, so nothing down there (the
  // Show Ground's crook and pen) is ever stuck under a thumb.
  thumbBand(): number {
    if (!this.input.touchMode || this.mode === 'title') return 0;
    const { W, H } = this.screen;
    return Math.max(0, H - touchLayout(this, W, H).top);
  }

  view() {
    const { W, H } = this.screen;
    const k = this.feel.offset();
    const ox = clamp(Math.round(this.cam.x - W / 2) + k.x, 0, WORLD_W - W);
    const oy = clamp(Math.round(this.cam.y - H / 2) + k.y, 0, WORLD_H - H + this.thumbBand());
    return { ox, oy, W, H };
  }

  // Trial course, buyers' yards and carts, hidden places, for the y-sorted world layer.
  extraDrawables(g: CanvasRenderingContext2D): Drawable[] {
    return [...courseDrawables(this, g), ...decorDrawables(this, g), ...landmarkDrawables(this, g)];
  }

  // Debug: the whole world as one image.
  debugMapImage(): string {
    const c = document.createElement('canvas');
    c.width = WORLD_W;
    c.height = WORLD_H;
    const g = c.getContext('2d')!;
    g.drawImage(this.baked.ground, 0, 0);
    g.drawImage(this.baked.canopy, 0, 0);
    return c.toDataURL('image/png');
  }

  // ---- Render ----

  render() {
    const g = this.g;
    const v = this.view();
    // Past the world's bottom edge (phones, see thumbBand) is more forest.
    if (v.oy + v.H > WORLD_H) {
      g.fillStyle = C.teal;
      g.fillRect(0, WORLD_H - v.oy, v.W, v.oy + v.H - WORLD_H);
    }
    drawWorld(this, g, v);
    drawSpeech(this, g, v);
    drawCoop(this, g, v, 'world');
    this.input.uiHeld.clear();
    if (this.mode === 'title') {
      const act = drawTitle(this, g, v.W, v.H, this.menu);
      if (act) this.startGame(act);
    } else if (this.mode === 'pause') {
      drawHud(this, g, v.W, v.H);
      drawPause(this, g, v.W, v.H);
    } else if (this.mode === 'play') {
      drawHud(this, g, v.W, v.H);
      if (drawJobs(this, g, v.W, v.H)) this.input.push('confirm');
      if (!this.trials.result) drawTouchControls(this, g, v.W, v.H);
    } else if (this.mode === 'summary' && this.summary) {
      const r = drawSummary(this, g, v.W, v.H);
      if (r === 'next') this.input.push('confirm');
      if (r === 'build') this.input.push('build');
    } else if (this.mode === 'build') {
      if (this.build.drawUI(this, g, v.W, v.H) === 'exit') this.input.push('cancel');
    } else if (this.mode === 'ledger') {
      if (drawLedger(this, g, v.W, v.H)) this.input.push('ledger');
    } else if (this.mode === 'look') {
      drawLook(this, g, v.W, v.H);
    } else if (this.mode === 'transfer') {
      drawTransfer(this, g, v.W, v.H);
    }
    drawCoop(this, g, v, 'ui');
    this.feel.drawCover(g, v.W, v.H);
  }
}
