import type { Game } from '../game';
import type { Animal } from '../entities/animal';
import type { Pen } from '../ranch/buildings';
import { SPECIES_ORDER } from '../entities/species';
import { SKIES } from '../systems/weather';
import { SEASON_LIST } from '../systems/season';
import { FACES, HOST_MODES, K_SNAP, Reader, Writer, faceId, type HostMode } from './protocol';

// One moment of the host's world, as the guests see it. Everything is kept
// as the integers that travel (positions in 1/8 px, levels as bytes);
// guest.ts turns them back into the game's own objects.
//
// Animals go as changes against the last snapshot sent (a WebSocket never
// drops or reorders, so a change list is enough), plus the ids that left.
// A guest arriving gets one full snapshot of the same moment first.

export interface AnimalRec { id: number; sc: number; x: number; y: number; vx: number; vy: number; fl: number; st: number; pr: number; pen: number; ex: number }
export interface DogRec { slot: number; x: number; y: number; vx: number; vy: number; fl: number }
export interface HelperRec { x: number; y: number; vx: number; vy: number; fl: number }
export interface PredRec { k: number; x: number; y: number; vx: number; vy: number; dig: number }
export interface FolkRec { id: number; x: number; y: number; fl: number; phase: number; anim: number; item: number }
export interface SiteRec { b: number; k: number; big: number }
export interface PenRec { swing: number; fl: number; flash: number; goods: number; sp: number }

export interface Snap {
  t: number; // host clock, ms
  full: boolean;
  day: number;
  dayT: number; // day.t x 100
  phase: number;
  nightT: number; // x 100
  rest: number; // x 16
  mode: HostMode;
  sky: number;
  forecast: number;
  rain: number;
  fog: number;
  wind: number;
  dirX: number;
  dirY: number;
  season: number; // index into SEASON_LIST
  sprog: number; // season progress, byte
  bloom: number;
  leaves: number;
  snow: number;
  dogs: DogRec[];
  helpers: HelperRec[];
  preds: PredRec[];
  folk: FolkRec[];
  sites: SiteRec[];
  pens: PenRec[];
  fgates: number[]; // swing byte, top bit = open
  rgates: number[]; // swing byte, top bit = unlocked
  hurdle: number;
  animals: AnimalRec[];
  removed: number[];
  events: unknown[];
}

// Animal flag bits (the low two are the facing).
export const A_WATER = 4, A_ROCK = 8, A_CARRIED = 16, A_EAT = 32, A_PANIC = 64, A_HOP = 128, A_TRIAL = 256, A_HOME = 512;
// Dog and helper flag bits.
export const D_LYING = 4, D_SPRINT = 8, D_BARK = 16;

export const PHASES = ['day', 'dusk', 'night'] as const;
export const PRED_STATES = ['wait', 'hunt', 'dig', 'carry', 'flee', 'gone'] as const;
// Appended to, never reordered (the index travels): the village's people after the cast.
export const FOLK_IDS = ['rancher', 'carpenter', 'miller', 'drover', 'auctioneer', 'judge', 'shepherd', 'smith', 'baker', 'grocer', 'weaver', 'cottager1', 'cottager2', 'cottager3', 'cottager4', 'cottager5', 'cottager6', 'warden'] as const;
export const POSES = ['stand', 'walk', 'carry', 'work', 'crouch', 'sit', 'wave'] as const;

const q8 = (v: number) => Math.round(v * 8);
const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

// Every pen an animal can be in: the ranch's, the buyers' yards', the trial
// pen, the fair's show ring.
export function allPens(game: Game): Pen[] {
  return [...game.ranch.pens, ...game.ranch.yards.map((y) => y.pen), game.ranch.course.pen, game.ranch.ring.pen];
}

// Round three's per-animal state (a lamb, an age band, a breed beyond the
// coat): one byte, filled in here by whoever adds it and read back on a
// guest's screen in applyAnimalExtra (guest.ts). Zero means nothing extra.
// Bit 0: a lamb (drawn small, at its mother's side).
export function animalExtra(a: Animal): number {
  return a.young ? 1 : 0;
}

export function applyAnimalExtra(a: Animal, v: number) {
  a.young = (v & 1) !== 0;
}

export function animalRec(a: Animal, pens: Pen[]): AnimalRec {
  const fl =
    faceId(a.face) |
    (a.inWater ? A_WATER : 0) |
    (a.onRock ? A_ROCK : 0) |
    (a.carried ? A_CARRIED : 0) |
    (a.grazeMode === 'eat' ? A_EAT : 0) |
    (a.panicT > 0 ? A_PANIC : 0) |
    (a.hop > 0.05 ? A_HOP : 0) |
    (a.trial ? A_TRIAL : 0) |
    (a.home ? A_HOME : 0);
  return {
    id: a.id,
    sc: SPECIES_ORDER.indexOf(a.sp.id) | (a.coat << 3),
    x: q8(a.x),
    y: q8(a.y),
    vx: q8(a.vx),
    vy: q8(a.vy),
    fl,
    st: byte(a.stress),
    pr: byte(Math.min(1, a.pressure)),
    pen: a.pen ? pens.indexOf(a.pen as Pen) + 1 : 0,
    ex: animalExtra(a),
  };
}

export const sameAnimal = (a: AnimalRec, b: AnimalRec) =>
  a.x === b.x && a.y === b.y && a.vx === b.vx && a.vy === b.vy && a.fl === b.fl && a.st === b.st && a.pr === b.pr && a.pen === b.pen && a.sc === b.sc && a.ex === b.ex;

// Everything but the animals and the events, read from the host's game.
export function worldRecs(game: Game, mode: HostMode, dogs: DogRec[]): Omit<Snap, 't' | 'full' | 'animals' | 'removed' | 'events'> {
  const d = game.day, w = game.weather, se = game.season;
  const pens = allPens(game);
  return {
    day: d.day,
    dayT: Math.round(d.t * 100),
    phase: Math.max(0, PHASES.indexOf(d.phase)),
    nightT: Math.round(d.nightT * 100),
    rest: Math.round(game.rest * 16),
    mode,
    sky: SKIES.indexOf(w.sky),
    forecast: SKIES.indexOf(w.forecast),
    rain: byte(w.rain),
    fog: byte(w.fog),
    wind: byte(w.wind),
    dirX: Math.round(w.dirX * 127),
    dirY: Math.round(w.dirY * 127),
    season: Math.max(0, SEASON_LIST.indexOf(se.season)),
    sprog: byte(se.progress),
    bloom: byte(se.bloom),
    leaves: byte(se.leaves),
    snow: byte(se.snow),
    dogs,
    helpers: game.helpers.map((h) => ({ x: q8(h.x), y: q8(h.y), vx: q8(h.vx), vy: q8(h.vy), fl: faceId(h.face) | (h.lying ? D_LYING : 0) | (h.barkAnim > 0 ? D_BARK : 0) })),
    preds: game.predators
      .filter((p) => p.active)
      .map((p) => ({ k: (p.kind === 'wolf' ? 1 : 0) | (Math.max(0, PRED_STATES.indexOf(p.state)) << 1) | (faceId(p.face) << 4), x: q8(p.x), y: q8(p.y), vx: q8(p.vx), vy: q8(p.vy), dig: Math.floor(p.digT * 8) & 255 })),
    folk: game.folk.people.map((p) => ({
      id: Math.max(0, FOLK_IDS.indexOf(p.id)),
      x: q8(p.x),
      y: q8(p.y),
      fl: faceId(p.face) | (Math.max(0, POSES.indexOf(p.pose)) << 2) | (p.lantern ? 32 : 0) | (p.shown ? 64 : 0),
      phase: Math.floor(p.phase * 8) & 255,
      anim: Math.floor(p.anim * 16) & 255,
      item: p.item ? p.item.charCodeAt(0) : 0,
    })),
    sites: game.folk.jobs.map((j) => ({ b: Math.max(0, game.ranch.buildings.indexOf(j.b)), k: byte(j.done / j.work), big: j.big ? 1 : 0 })),
    pens: pens.map((p) => ({ swing: byte(p.swing), fl: (p.open ? 1 : 0) | (p.letOut ? 2 : 0) | (p.hasTrough ? 4 : 0), flash: byte(p.shutFlash), goods: Math.min(255, p.goods), sp: p.species ? SPECIES_ORDER.indexOf(p.species) : 255 })),
    fgates: game.ranch.fieldGates.map((g) => Math.round(g.swing * 127) | (g.open ? 128 : 0)),
    rgates: game.ranch.regionGates.map((g) => Math.round(g.swing * 127) | (g.unlocked ? 128 : 0)),
    hurdle: byte(game.discovery.hurdleSwing),
  };
}

const pos = (w: Writer, v: number) => w.i16(v);

export function encodeSnap(w: Writer, route: number, s: Snap) {
  w.reset();
  w.u8(route);
  w.u8(K_SNAP);
  w.u8(s.full ? 1 : 0);
  w.u32(s.t);
  w.u16(s.day);
  w.u16(s.dayT);
  w.u8(s.phase);
  w.u16(s.nightT);
  w.u8(s.rest);
  w.u8(Math.max(0, HOST_MODES.indexOf(s.mode)));
  w.u8(s.sky);
  w.u8(s.forecast);
  w.u8(s.rain);
  w.u8(s.fog);
  w.u8(s.wind);
  w.i8(s.dirX);
  w.i8(s.dirY);
  w.u8(s.season);
  w.u8(s.sprog);
  w.u8(s.bloom);
  w.u8(s.leaves);
  w.u8(s.snow);
  w.u8(s.dogs.length);
  for (const d of s.dogs) {
    w.u8(d.slot);
    pos(w, d.x);
    pos(w, d.y);
    pos(w, d.vx);
    pos(w, d.vy);
    w.u8(d.fl);
  }
  w.u8(s.helpers.length);
  for (const h of s.helpers) {
    pos(w, h.x);
    pos(w, h.y);
    pos(w, h.vx);
    pos(w, h.vy);
    w.u8(h.fl);
  }
  w.u8(s.preds.length);
  for (const p of s.preds) {
    w.u8(p.k);
    pos(w, p.x);
    pos(w, p.y);
    pos(w, p.vx);
    pos(w, p.vy);
    w.u8(p.dig);
  }
  w.u8(s.folk.length);
  for (const f of s.folk) {
    w.u8(f.id);
    pos(w, f.x);
    pos(w, f.y);
    w.u8(f.fl);
    w.u8(f.phase);
    w.u8(f.anim);
    w.u8(f.item);
  }
  w.u8(s.sites.length);
  for (const j of s.sites) {
    w.u8(j.b);
    w.u8(j.k);
    w.u8(j.big);
  }
  w.u8(s.pens.length);
  for (const p of s.pens) {
    w.u8(p.swing);
    w.u8(p.fl);
    w.u8(p.flash);
    w.u8(p.goods);
    w.u8(p.sp);
  }
  w.u8(s.fgates.length);
  for (const g of s.fgates) w.u8(g);
  w.u8(s.rgates.length);
  for (const g of s.rgates) w.u8(g);
  w.u8(s.hurdle);
  w.u16(s.animals.length);
  for (const a of s.animals) {
    w.u32(a.id);
    w.u8(a.sc);
    pos(w, a.x);
    pos(w, a.y);
    pos(w, a.vx);
    pos(w, a.vy);
    w.u16(a.fl);
    w.u8(a.st);
    w.u8(a.pr);
    w.u8(a.pen);
    w.u8(a.ex);
  }
  w.u16(s.removed.length);
  for (const id of s.removed) w.u32(id);
  w.str(s.events.length ? JSON.stringify(s.events) : '');
}

export function decodeSnap(r: Reader): Snap {
  const full = r.u8() === 1;
  const t = r.u32();
  const day = r.u16(), dayT = r.u16(), phase = r.u8(), nightT = r.u16(), rest = r.u8();
  const mode = HOST_MODES[r.u8()] ?? 'play';
  const sky = r.u8(), forecast = r.u8(), rain = r.u8(), fog = r.u8(), wind = r.u8(), dirX = r.i8(), dirY = r.i8();
  const season = r.u8(), sprog = r.u8(), bloom = r.u8(), leaves = r.u8(), snow = r.u8();
  const dogs: DogRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) dogs.push({ slot: r.u8(), x: r.i16(), y: r.i16(), vx: r.i16(), vy: r.i16(), fl: r.u8() });
  const helpers: HelperRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) helpers.push({ x: r.i16(), y: r.i16(), vx: r.i16(), vy: r.i16(), fl: r.u8() });
  const preds: PredRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) preds.push({ k: r.u8(), x: r.i16(), y: r.i16(), vx: r.i16(), vy: r.i16(), dig: r.u8() });
  const folk: FolkRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) folk.push({ id: r.u8(), x: r.i16(), y: r.i16(), fl: r.u8(), phase: r.u8(), anim: r.u8(), item: r.u8() });
  const sites: SiteRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) sites.push({ b: r.u8(), k: r.u8(), big: r.u8() });
  const pens: PenRec[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) pens.push({ swing: r.u8(), fl: r.u8(), flash: r.u8(), goods: r.u8(), sp: r.u8() });
  const fgates: number[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) fgates.push(r.u8());
  const rgates: number[] = [];
  for (let i = 0, n = r.u8(); i < n; i++) rgates.push(r.u8());
  const hurdle = r.u8();
  const animals: AnimalRec[] = [];
  for (let i = 0, n = r.u16(); i < n; i++) animals.push({ id: r.u32(), sc: r.u8(), x: r.i16(), y: r.i16(), vx: r.i16(), vy: r.i16(), fl: r.u16(), st: r.u8(), pr: r.u8(), pen: r.u8(), ex: r.u8() });
  const removed: number[] = [];
  for (let i = 0, n = r.u16(); i < n; i++) removed.push(r.u32());
  const ev = r.str();
  const events = ev ? (JSON.parse(ev) as unknown[]) : [];
  return { t, full, day, dayT, phase, nightT, rest, mode, sky, forecast, rain, fog, wind, dirX, dirY, season, sprog, bloom, leaves, snow, dogs, helpers, preds, folk, sites, pens, fgates, rgates, hurdle, animals, removed, events };
}

export const faceOf = (fl: number) => FACES[fl & 3];
