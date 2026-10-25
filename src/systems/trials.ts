import { C } from '../palette';
import type { Game } from '../game';
import { Animal } from '../entities/animal';
import { SPECIES } from '../entities/species';
import type { Coat } from '../art/animals';
import type { SpeciesId } from '../world/map';
import { admit, swingGate, type CourseGate } from '../ranch/fixtures';
import { mulberry32 } from '../rng';
import { clamp } from '../util';

// Sheepdog trials at the Show Ground. Every third day is a trial day: one
// run counts for prizes against three rival handlers; any other run is
// practice. The course is the classic one, shrunk: outrun and lift, fetch
// gate, round the post, drive gate, cross-drive gate, pen. Scored on gates
// and calm; bolting animals and gripping (nipping sheep) cost points.

export type ClassId = 'novice' | 'open' | 'cattle' | 'cup' | 'brace';

export interface TrialClass {
  id: ClassId;
  name: string;
  species: SpeciesId;
  n: number;
  tier: number; // ranch tier it opens at
  needs: ClassId | null; // class you must win first
  limit: number; // seconds
  rivals: [number, number]; // range of the rivals' scores
  prizes: [number, number, number];
}

export const CLASSES: TrialClass[] = [
  { id: 'novice', name: 'NOVICE', species: 'duck', n: 5, tier: 2, needs: null, limit: 150, rivals: [44, 66], prizes: [30, 18, 10] },
  { id: 'open', name: 'OPEN', species: 'sheep', n: 5, tier: 2, needs: 'novice', limit: 180, rivals: [54, 74], prizes: [50, 30, 15] },
  { id: 'cattle', name: 'CATTLE', species: 'cow', n: 4, tier: 4, needs: 'open', limit: 240, rivals: [50, 70], prizes: [80, 45, 20] },
  { id: 'cup', name: 'VALLEY CUP', species: 'sheep', n: 7, tier: 5, needs: 'cattle', limit: 210, rivals: [64, 82], prizes: [140, 70, 35] },
];

// Co-op: two dogs on one course, scored together. Not one of the ladder's
// classes: it runs whenever a friend's dog stands at the post with yours.
export const BRACE: TrialClass = { id: 'brace', name: 'BRACE', species: 'sheep', n: 10, tier: 2, needs: null, limit: 240, rivals: [52, 76], prizes: [70, 40, 20] };

// A friend's dog at the post beside yours (only the host starts runs).
export function braceReady(game: Game): boolean {
  if (game.net?.role !== 'host' || game.tier < BRACE.tier) return false;
  const p = game.ranch.course.post;
  return game.coop.some((d) => Math.hypot(d.x - p.x, d.y - (p.y + 4)) < 22);
}

export const TRIAL_EVERY = 3;
export const isTrialDay = (day: number) => day % TRIAL_EVERY === 0;
export const nextTrialDay = (day: number) => Math.ceil(day / TRIAL_EVERY) * TRIAL_EVERY;

export const PARTS = [
  { id: 'lift', name: 'OUTRUN + LIFT', short: 'THE LIFT', max: 10 },
  { id: 'fetch', name: 'FETCH GATE', short: 'FETCH GATE', max: 15 },
  { id: 'post', name: 'ROUND THE POST', short: 'THE POST', max: 10 },
  { id: 'drive', name: 'DRIVE GATE', short: 'DRIVE GATE', max: 15 },
  { id: 'cross', name: 'CROSS GATE', short: 'CROSS GATE', max: 15 },
  { id: 'pen', name: 'PEN', short: 'THE PEN', max: 20 },
] as const;
export const CALM_MAX = 15;
const PEN_STEP = PARTS.length - 1;
const GATE_OF: Record<string, number> = { fetch: 0, drive: 1, cross: 2 };

const RIVALS = ['OLD TOM + NELL', 'MAGS + FLY', 'BEN + ROY', 'JESS + CAP', 'IVY + MOSS', 'WILL + GLEN', 'ROSE + TESS', 'DAN + SWEEP'];

export interface Run {
  cls: TrialClass;
  prize: boolean;
  t: number;
  step: number; // index into PARTS
  flock: Animal[];
  scores: number[];
  bolts: number;
  grips: number;
  stressT: number; // time integral of the flock's mean stress
  outrun: number; // worst mean stress before the lift
  startX: number;
  startY: number;
  side: Map<Animal, number>; // which side of the current gate each is on
  through: Set<Animal>;
  panicking: Set<Animal>;
  awayT: number; // time the dog has been off the field
  endT: number; // pause between "that'll do" and the card
  penned: boolean; // all in the pen: the run is complete
}

export interface TrialResult {
  cls: TrialClass;
  prize: boolean;
  retired: boolean;
  timeUp: boolean;
  parts: { name: string; got: number; max: number }[];
  faults: number;
  total: number;
  rivals: { name: string; score: number }[];
  place: number; // 1-4 on a trial day, 0 for practice
  coins: number;
  unlocked: TrialClass | null;
  best: boolean;
}

export class Trials {
  won: ClassId[] = [];
  cups = 0;
  lastPrizeDay = 0;
  run: Run | null = null;
  result: TrialResult | null = null;
}

export function availableClasses(game: Game): TrialClass[] {
  const won = game.trials.won;
  return CLASSES.filter((c) => c.tier <= game.tier && (!c.needs || won.includes(c.needs)));
}

// The first class you have not won yet; once all are won, the hardest.
// With a friend's dog at the post too, the brace.
export function currentClass(game: Game): TrialClass | null {
  if (braceReady(game)) return BRACE;
  const av = availableClasses(game);
  return av.find((c) => !game.trials.won.includes(c.id)) ?? av[av.length - 1] ?? null;
}

export const prizeToday = (game: Game) => game.tier >= 2 && isTrialDay(game.day.day) && game.trials.lastPrizeDay !== game.day.day;

export function atPost(game: Game): boolean {
  const p = game.ranch.course.post;
  return Math.hypot(game.dog.x - p.x, game.dog.y - (p.y + 4)) < 16;
}

export const classLabel = (c: TrialClass) => `${c.name} CLASS (${c.n} ${SPECIES[c.species].plural.toUpperCase()})`;

export function startRun(game: Game): boolean {
  const tr = game.trials;
  const cls = currentClass(game);
  if (tr.run || !cls) return false;
  if (game.day.phase === 'night') {
    game.showBanner('NO TRIALS AFTER DARK', undefined, 1.6);
    return true;
  }
  const c = game.ranch.course;
  const prize = prizeToday(game);
  if (prize) tr.lastPrizeDay = game.day.day;
  const sp = SPECIES[cls.species];
  const flock: Animal[] = [];
  for (let i = 0; i < cls.n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (4 + cls.n * 1.3);
    const an = new Animal(cls.species, c.release.x + Math.cos(a) * r, c.release.y + Math.sin(a) * r, Math.floor(Math.random() * sp.coats) as Coat);
    an.trial = true;
    an.wanderer = false;
    flock.push(an);
    game.animals.push(an);
  }
  tr.run = {
    cls, prize, t: 0, step: 0, flock, scores: PARTS.map(() => 0), bolts: 0, grips: 0, stressT: 0, outrun: 0,
    startX: c.release.x, startY: c.release.y, side: new Map(), through: new Set(), panicking: new Set(), awayT: 0, endT: 0, penned: false,
  };
  c.pen.open = false;
  game.totals.trialRuns = (game.totals.trialRuns ?? 0) + 1;
  game.showBanner(prize ? `${cls.name} CLASS` : 'PRACTICE RUN', `${cls.n} ${sp.plural.toUpperCase()} AT THE TOP. GO WIDE ROUND THEM`, 2.6);
  game.audio?.play('thatlldo');
  return true;
}

function centroid(list: Animal[]) {
  let x = 0, y = 0;
  for (const a of list) { x += a.x; y += a.y; }
  return { x: x / Math.max(1, list.length), y: y / Math.max(1, list.length) };
}

const sideOf = (g: CourseGate, x: number, y: number) => (x - g.x) * g.dx + (y - g.y) * g.dy;

// Is this part over? A gate is judged once the whole flock is past its line
// (or the bulk of it is well past); the post once the flock reaches it.
function partDone(game: Game, step: number, cx: number, cy: number, flock: Animal[]): boolean {
  const c = game.ranch.course;
  const id = PARTS[step].id;
  if (id === 'post') return Math.hypot(cx - c.post.x, cy - c.post.y) < 36;
  if (id === 'lift' || id === 'pen') return false;
  const g = c.gates[GATE_OF[id]];
  return sideOf(g, cx, cy) > 40 || flock.every((a) => sideOf(g, a.x, a.y) >= 0);
}

// Has the flock already got to a later target, skipping this one?
function skippedTo(game: Game, step: number, cx: number, cy: number): boolean {
  const c = game.ranch.course;
  const id = PARTS[step].id;
  if (id === 'post') return Math.hypot(cx - c.post.x, cy - c.post.y) < 36;
  if (id === 'lift' || id === 'pen') return false;
  const g = c.gates[GATE_OF[id]];
  return sideOf(g, cx, cy) > 12 && Math.hypot(cx - g.x, cy - g.y) < 70;
}

function award(game: Game, r: Run, pts: number, x: number, y: number, text: string) {
  r.scores[r.step] = Math.round(pts);
  game.fx.float(x, y - 10, text, pts > 0 ? C.butter : C.wool, 1.6);
  game.audio?.play(pts > 0 ? 'coin' : 'deny', { x, y, vol: 0.6 });
}

function nextStep(game: Game, r: Run) {
  r.step++;
  r.side.clear();
  r.through.clear();
  const id = PARTS[r.step]?.id;
  if (id && GATE_OF[id] !== undefined) {
    const g = game.ranch.course.gates[GATE_OF[id]];
    for (const a of r.flock) r.side.set(a, sideOf(g, a.x, a.y));
  }
}

export function updateRun(game: Game, dt: number) {
  const tr = game.trials;
  const r = tr.run;
  const c = game.ranch.course;
  c.pen.open = !!r && r.step === PEN_STEP && r.endT <= 0 && !tr.result;
  swingGate(c.pen, dt, game.map);
  if (!r || tr.result) return;
  if (r.endT > 0) {
    if ((r.endT -= dt) <= 0) endRun(game, false);
    return;
  }
  r.t += dt;
  const flock = r.flock.filter((a) => !a.gone);
  const ctr = centroid(flock);
  const mean = flock.reduce((s, a) => s + a.stress, 0) / Math.max(1, flock.length);
  r.stressT += mean * dt;
  for (const a of flock) {
    if (a.panicT > 0 && !r.panicking.has(a)) {
      r.bolts++;
      r.panicking.add(a);
      if (r.bolts <= 5) game.fx.float(a.x, a.y - 12, 'BOLT -2', C.wool, 1);
    } else if (a.panicT <= 0) r.panicking.delete(a);
  }
  // Walking off the field retires the run (in a brace, either dog).
  const off = (d: { x: number; y: number }) => game.map.regionAt(d.x, d.y)?.id !== 'show';
  if (off(game.dog) || (r.cls === BRACE && game.coop.some(off))) {
    if ((r.awayT += dt) > 2.5) return endRun(game, true);
  } else r.awayT = 0;
  if (r.t >= r.cls.limit) return endRun(game, false);

  const part = PARTS[r.step];
  if (part.id === 'lift') {
    r.outrun = Math.max(r.outrun, mean);
    const mx = ctr.x - r.startX, my = ctr.y - r.startY, moved = Math.hypot(mx, my);
    if (moved > 14) {
      // A good lift is quiet and straight towards the fetch gate.
      const g = c.gates[0];
      const wx = g.x - c.release.x, wy = g.y - c.release.y, wl = Math.hypot(wx, wy);
      const dot = (mx * wx + my * wy) / (moved * wl);
      const pts = part.max * clamp(1 - r.outrun / 0.4, 0, 1) * clamp((dot + 0.3) / 1.1, 0, 1);
      award(game, r, pts, ctr.x, ctr.y, pts >= 7 ? `GOOD LIFT +${Math.round(pts)}` : `LIFT +${Math.round(pts)}`);
      nextStep(game, r);
    }
    return;
  }
  if (part.id === 'pen') {
    for (const a of admit(c.pen, game.animals, (a) => a.trial)) game.fx.float(a.x, a.y - 8, `${c.pen.animals.length}`, C.wool, 0.8);
    if (c.pen.animals.length >= flock.length) {
      r.scores[r.step] = part.max;
      r.penned = true;
      r.endT = 1.4;
      c.pen.shutFlash = 1;
      game.showBanner("THAT'LL DO!", 'ALL PENNED', 1.6);
      game.audio?.play('gate', { x: c.pen.cx, y: c.pen.cy });
      setTimeout(() => game.audio?.play('thatlldo'), 180);
    }
    return;
  }
  if (GATE_OF[part.id] !== undefined) {
    const g = c.gates[GATE_OF[part.id]];
    for (const a of flock) {
      if (r.through.has(a)) continue;
      const s = sideOf(g, a.x, a.y);
      const prev = r.side.get(a);
      r.side.set(a, s);
      if (prev !== undefined && prev < 0 && s >= 0 && Math.abs((a.x - g.x) * -g.dy + (a.y - g.y) * g.dx) <= g.half) r.through.add(a);
    }
  }
  if (partDone(game, r.step, ctr.x, ctr.y, flock)) {
    judge(game, r, flock);
    nextStep(game, r);
    return;
  }
  // Skipped this one and gone on to a later target: it scores nothing.
  for (let k = r.step + 1; k < PEN_STEP; k++) {
    if (!skippedTo(game, k, ctr.x, ctr.y)) continue;
    while (r.step < k) {
      award(game, r, 0, ctr.x, ctr.y - 8 * (k - r.step), `${PARTS[r.step].short} MISSED`);
      nextStep(game, r);
    }
    return;
  }
}

function judge(game: Game, r: Run, flock: Animal[]) {
  const part = PARTS[r.step];
  const n = flock.length;
  if (part.id === 'post') {
    const p = game.ranch.course.post;
    const near = flock.filter((a) => Math.hypot(a.x - p.x, a.y - p.y) < 52).length;
    const pts = (part.max * near) / n;
    award(game, r, pts, p.x, p.y - 8, near === n ? `ROUND THE POST +${Math.round(pts)}` : `POST ${near}/${n} +${Math.round(pts)}`);
    return;
  }
  const g = game.ranch.course.gates[GATE_OF[part.id]];
  const k = r.through.size;
  const pts = (part.max * k) / n;
  award(game, r, pts, g.x, g.y, k === 0 ? `${part.short} MISSED` : `${k}/${n} +${Math.round(pts)}`);
}

// A nip on a trial sheep is a grip: a fault (cattle may be heeled).
export function trialNip(game: Game, a: Animal) {
  const r = game.trials.run;
  if (!r || !a.trial || r.cls.species === 'cow') return;
  r.grips++;
  game.fx.float(a.x, a.y - 12, 'GRIP -3', C.wool, 1.2);
}

export function rivalsFor(game: Game, cls: TrialClass): { name: string; score: number }[] {
  const rng = mulberry32(game.day.day * 7919 + CLASSES.indexOf(cls) * 104729 + 17);
  const lift = cls.id === 'cup' ? Math.min(12, game.trials.cups * 3) : 0;
  const names = [...RIVALS];
  const out: { name: string; score: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const name = names.splice(Math.floor(rng() * names.length), 1)[0];
    out.push({ name, score: Math.round(cls.rivals[0] + lift + rng() * (cls.rivals[1] - cls.rivals[0])) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function scoreRun(r: Run, retired: boolean) {
  const parts: TrialResult['parts'] = PARTS.map((p, i) => ({ name: p.name, got: r.scores[i], max: p.max }));
  // A pen left unfinished still scores the share that went in.
  if (!r.penned && !retired) {
    const inPen = r.flock.filter((a) => a.pen && !a.gone).length;
    parts[PEN_STEP].got = Math.round((PARTS[PEN_STEP].max * inPen) / Math.max(1, r.flock.length) * 0.5);
  }
  const meanStress = r.t > 0 ? r.stressT / r.t : 0;
  parts.push({ name: 'CALM', got: Math.round(CALM_MAX * clamp(1 - meanStress / 0.45, 0, 1)), max: CALM_MAX });
  const faults = Math.min(10, r.bolts * 2) + r.grips * 3;
  const sum = parts.reduce((s, p) => s + p.got, 0);
  return { parts, faults, total: retired ? 0 : clamp(sum - faults, 0, 100) };
}

export function endRun(game: Game, retired: boolean) {
  const tr = game.trials;
  const r = tr.run;
  if (!r || tr.result) return;
  const { parts, faults, total } = scoreRun(r, retired);
  const counts = r.prize && !retired;
  const rivals = counts ? rivalsFor(game, r.cls) : [];
  const place = counts ? 1 + rivals.filter((x) => x.score > total).length : 0;
  const coins = place >= 1 && place <= 3 ? r.cls.prizes[place - 1] : 0;
  if (coins) game.earn(coins);
  if (place >= 1 && place <= 3) game.totals.ribbons[place - 1]++;
  let unlocked: TrialClass | null = null;
  if (place === 1) {
    if (!tr.won.includes(r.cls.id)) {
      tr.won.push(r.cls.id);
      unlocked = CLASSES.find((c) => c.needs === r.cls.id) ?? null;
    }
    if (r.cls.id === 'cup') tr.cups++;
  }
  const best = total > game.totals.bestTrial;
  if (best) game.totals.bestTrial = total;
  tr.result = { cls: r.cls, prize: r.prize, retired, timeUp: !retired && !r.penned, parts, faults, total, rivals, place, coins, unlocked, best };
  game.audio?.play(place === 1 ? 'tierup' : 'click');
  game.banner = null; // the card says it all
  game.input.clearQueue();
}

// Close the result card: the course crew takes their stock back.
export function closeResult(game: Game) {
  const tr = game.trials;
  const r = tr.run;
  if (r) for (const a of r.flock) {
    if (!a.gone) game.fx.dust(a.x, a.y + 2);
    a.gone = true;
  }
  game.animals = game.animals.filter((a) => !a.gone);
  const pen = game.ranch.course.pen;
  pen.animals = [];
  pen.open = false;
  tr.run = null;
  tr.result = null;
  game.input.clearQueue();
}
