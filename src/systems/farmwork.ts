import { C } from '../palette';
import { calmRating, type Game } from '../game';
import type { Animal } from '../entities/animal';
import { AGILITY, AgilityYard, Dairy, ShearingShed } from '../ranch/structures';
import { admit, evict, swingGate } from '../ranch/fixtures';
import { MAX_UP, type UpKey } from './economy';
import { hourToT } from './orders';

// Ranch buildings with work of their own (src/ranch/structures.ts):
//
// - The shearing shed: in summer, each sheep walked along its chute past the
//   shearer's door is shorn there and then: a wool bonus, calm ones more.
//   (Once a year a sheep, like the visiting shearer's.)
// - The dairy: mornings until noon its yard gate stands open; each cow
//   walked in is milked (pay by how calm she came, and she is calmer for
//   it) and then let back out of the gate, to be walked home.
// - The agility yard: nip (E) at the post and run the course: a jump, the
//   weave, a jump, the tunnel, a jump, home. A clean run inside par counts
//   once a day towards speed or stamina: three and the dog goes up a level,
//   free, instead of only buying training at the kennel.

export const SHED_PAY = 4; // per sheep, before the calm multiplier
export const MILK_PAY = 7; // per cow, before the calm multiplier
export const AGILITY_PAR = 5.5; // seconds: a steady trot round, no dawdling
export const AGILITY_MARKS = 3; // clean runs (one a day) to a level
const NOON = hourToT(12);

const shed = (g: Game) => g.ranch.buildings.filter((b): b is ShearingShed => b instanceof ShearingShed);
const dairies = (g: Game) => g.ranch.buildings.filter((b): b is Dairy => b instanceof Dairy);
const yards = (g: Game) => g.ranch.buildings.filter((b): b is AgilityYard => b instanceof AgilityYard);

export class Farmwork {
  // Agility: marks towards the next free level, per stat, and today's run.
  marks: Partial<Record<UpKey, number>> = {};
  trainedDay = 0;
  best = 0; // best clean time, seconds
  cleanRuns = 0;
  run: Run | null = null;
  result: { t: number; faults: number; clean: boolean; at: number } | null = null;
  shorn = 0; // sheep shorn in the shed, all time
  milked = 0; // milkings, all time
}

interface Run {
  yard: AgilityYard;
  t: number;
  step: number; // 0 jump, 1-4 weave poles, 5 jump, 6 tunnel, 7 jump, 8 home
  faults: number;
  touched: Set<number>;
  lx: number;
  ly: number;
}
const STEPS = 9;

export function farmworkUpdate(g: Game, dt: number) {
  shearing(g);
  milking(g, dt);
  agility(g, dt);
}

// ---- The shearing shed ----

function shearing(g: Game) {
  if (g.season.season !== 'summer' || g.day.phase === 'night') return;
  const year = g.season.year;
  for (const s of shed(g)) {
    const l = s.lane;
    for (const a of g.animals) {
      if (a.sp.id !== 'sheep' || a.pen || a.gone || a.young || a.trial || a.forSale || a.shorn === year) continue;
      if (a.y < l.y0 || a.y > l.y1 || a.x < s.shearX0 || a.x > s.shearX1) continue;
      a.shorn = year;
      const v = Math.max(1, Math.round(SHED_PAY * calmRating(a.peakStress).mult * (a.rare ? 1.5 : 1)));
      g.earn(v);
      g.farmwork.shorn++;
      g.fx.float(a.x, a.y - 10, `SHORN +${v}$`, C.wool, 1.1);
      g.fx.dust(a.x, a.y);
      g.audio?.play('coin', { x: a.x, y: a.y, vol: 0.6 });
      if (!g.tipsSeen.has('shed-first')) {
        g.tipsSeen.add('shed-first');
        g.tip = { text: 'SHORN IN THE SHED! WALK THE REST ALONG THE CHUTE. CALM ONES PAY MORE.', t: 7 };
      }
    }
  }
}

// ---- The dairy ----

const milkT = new WeakMap<Animal, number>();
const quiet = new WeakMap<Dairy, number>();

export const dairyOpen = (g: Game) => g.day.phase === 'day' && g.day.t < NOON;

function milking(g: Game, dt: number) {
  const day = g.day.day;
  for (const d of dairies(g)) {
    const y = d.yard;
    const open = dairyOpen(g);
    const wants = (a: Animal) => a.sp.id === 'cow' && !a.young && !a.trial && !a.forSale && !a.load && a.milkedDay !== day;
    const gp = y.gatePoint(0);
    const inGate = g.animals.some((a) => !a.gone && !a.pen && Math.hypot(a.x - gp.x, a.y - gp.y) < a.sp.r + 9);
    // Open all morning: penned cows cannot pass a pen's gateway anyway.
    // Anyone loose inside when it shuts is put back out.
    const was = y.open;
    y.open = open || inGate;
    if (was && !y.open) evict(y, g.animals);
    if (open) for (const a of admit(y, g.animals, wants)) milkT.set(a, 0);
    swingGate(y, dt, g.map);
    let busy = false;
    for (const a of y.animals) {
      if (a.milkedDay === day) continue;
      const t = (milkT.get(a) ?? 0) + dt;
      milkT.set(a, t);
      busy = true;
      if (t < 2.5) continue;
      a.milkedDay = day;
      const v = Math.max(1, Math.round(MILK_PAY * calmRating(a.peakStress).mult * (a.rare ? 1.5 : 1)));
      g.earn(v);
      g.farmwork.milked++;
      a.stress = Math.max(0, a.stress - 0.15);
      g.fx.float(a.x, a.y - 12, `MILK +${v}$`, C.wool, 1.2);
      g.audio?.play('coin', { x: a.x, y: a.y, vol: 0.6 });
    }
    // All milked and nobody else coming: back out of the gate they go.
    const q = busy || !y.animals.length ? 0 : (quiet.get(d) ?? 0) + dt;
    quiet.set(d, q);
    if ((q > 1.5 && !inGate) || (!open && y.animals.length)) releaseYard(g, d);
  }
}

export function releaseYard(g: Game, d: Dairy) {
  const y = d.yard;
  const out = y.gatePoint(14);
  for (const a of y.animals) {
    a.pen = null;
    a.home = true;
    a.peakStress = a.stress;
    a.x = out.x + (Math.random() - 0.5) * 12;
    a.y = out.y + (Math.random() - 0.5) * 6;
  }
  y.animals = [];
}

// Evening: anyone still in a dairy yard goes back out.
export function farmworkEvening(g: Game) {
  for (const d of dairies(g)) if (d.yard.animals.length) releaseYard(g, d);
  g.farmwork.run = null;
}

// ---- The agility yard ----

const postOf = (y: AgilityYard) => y.at(AGILITY.post);
export function agilityPostNear(g: Game): AgilityYard | null {
  return yards(g).find((y) => {
    const p = postOf(y);
    return Math.hypot(g.dog.x - p.x, g.dog.y - (p.y + 4)) < 12;
  }) ?? null;
}

export function startAgility(g: Game): boolean {
  const y = agilityPostNear(g);
  if (!y || g.farmwork.run || g.day.phase === 'night') return false;
  g.farmwork.run = { yard: y, t: 0, step: 0, faults: 0, touched: new Set(), lx: g.dog.x, ly: g.dog.y };
  g.farmwork.result = null;
  g.showBanner('GO!', 'JUMP, WEAVE, JUMP, TUNNEL, JUMP, HOME', 1.6);
  g.audio?.play('whistle');
  return true;
}

// Did the dog cross segment a-b this frame, going the right way?
function crossed(x0: number, y0: number, x1: number, y1: number, a: { x: number; y: number }, b: { x: number; y: number }, dx: number, dy: number) {
  if ((x1 - x0) * dx + (y1 - y0) * dy <= 0) return false;
  const side = (px: number, py: number) => (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
  const s0 = side(x0, y0), s1 = side(x1, y1);
  if (s0 === 0 || Math.sign(s0) === Math.sign(s1)) return false;
  // Within the posts.
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const t = ((x1 - a.x) * (b.x - a.x) + (y1 - a.y) * (b.y - a.y)) / (len * len);
  return t > -0.05 && t < 1.05;
}

function agility(g: Game, dt: number) {
  const r = g.farmwork.run;
  if (!r) return;
  const d = g.dog, y = r.yard;
  r.t += dt;
  // Out of the yard, or far too long: the run is off.
  if (d.x < y.x0 - 4 || d.x > y.x1 + 4 || d.y < y.y0 - 4 || d.y > y.y1 + 8 || r.t > 40) {
    g.farmwork.run = null;
    g.showBanner('RUN ABANDONED', 'NIP AT THE POST TO TRY AGAIN', 1.6);
    return;
  }
  // Touching a pole is a fault (once a pole).
  y.poles().forEach((p, i) => {
    if (!r.touched.has(i) && Math.hypot(d.x - p.x, d.y - p.y) < d.r + 3) { // brushing it: poles are solid, so contact is about r + 2
      r.touched.add(i);
      r.faults++;
      g.fx.float(p.x, p.y - 8, 'FAULT', C.wool, 0.8);
    }
  });
  const J = AGILITY.jumps, W = AGILITY.weave;
  const step = r.step;
  let pass = false;
  if (step === 0 || step === 5 || step === 6 || step === 7) {
    const j = J[step === 0 ? 0 : step - 4];
    pass = crossed(r.lx, r.ly, d.x, d.y, y.at(j.a), y.at(j.b), j.dx, j.dy);
  } else if (step >= 1 && step <= 4) {
    const p = y.at(W[step - 1]);
    if (r.lx < p.x && d.x >= p.x) {
      // Between the rows of poles, not round the outside.
      const top = y.at(W[0]).y, bottom = y.at(W[1]).y;
      if (d.y < top - 1 || d.y > bottom + 1) {
        r.faults++;
        g.fx.float(p.x, p.y - 8, 'MISSED A POLE', C.wool, 0.8);
      }
      pass = true;
    }
  } else if (step === 8) {
    const p = postOf(y);
    pass = Math.hypot(d.x - p.x, d.y - (p.y + 4)) < 10;
  }
  r.lx = d.x;
  r.ly = d.y;
  if (!pass) return;
  r.step++;
  if (r.step < STEPS) {
    if (r.step === 1 || r.step === 5 || r.step === 6 || r.step === 7) g.audio?.play('click');
    return;
  }
  finishAgility(g, r);
}

function finishAgility(g: Game, r: Run) {
  const f = g.farmwork;
  f.run = null;
  const t = Math.round(r.t * 10) / 10;
  const clean = r.faults === 0 && r.t <= AGILITY_PAR;
  f.result = { t, faults: r.faults, clean, at: g.t };
  if (!clean) {
    g.showBanner(`${t}S, ${r.faults} FAULT${r.faults === 1 ? '' : 'S'}`, r.faults ? 'A CLEAN RUN TRAINS THE DOG' : `PAR IS ${AGILITY_PAR}S: A LITTLE QUICKER`, 2.2);
    return;
  }
  f.cleanRuns++;
  if (!f.best || t < f.best) f.best = t;
  if (f.trainedDay === g.day.day) {
    g.showBanner(`CLEAN RUN, ${t}S!`, 'ONE COUNTS FOR TRAINING EACH DAY: COME BACK TOMORROW', 2.4);
    g.audio?.play('coin');
    return;
  }
  f.trainedDay = g.day.day;
  // Speed or stamina, whichever is behind.
  const key: UpKey = g.upgrades.stamina < g.upgrades.speed ? 'stamina' : 'speed';
  if (g.upgrades[key] >= MAX_UP) {
    g.showBanner(`CLEAN RUN, ${t}S!`, 'YOUR DOG IS AS QUICK AS DOGS GET', 2.4);
    return;
  }
  const m = (f.marks[key] ?? 0) + 1;
  if (m >= AGILITY_MARKS) {
    f.marks[key] = 0;
    g.upgrades[key]++;
    g.applyUpgrades();
    g.totals.upgrades++;
    g.showBanner(`${key.toUpperCase()} UP TO LEVEL ${g.upgrades[key]}!`, `CLEAN RUN, ${t}S: TRAINED ON THE COURSE`, 3);
    g.audio?.play('tierup');
  } else {
    f.marks[key] = m;
    g.showBanner(`CLEAN RUN, ${t}S!`, `${key.toUpperCase()} TRAINING ${m}/${AGILITY_MARKS}`, 2.6);
    g.audio?.play('coin');
  }
}

// ---- Hints ----

export function farmworkHint(g: Game): string | null {
  const E = g.input.touchMode ? 'NIP' : 'E';
  const r = g.farmwork.run;
  if (r) return r.step < 8 ? `${r.t.toFixed(1)}S  ${['JUMP', 'WEAVE', 'WEAVE', 'WEAVE', 'WEAVE', 'JUMP', 'TUNNEL', 'JUMP'][r.step]}${r.faults ? `  ${r.faults} FAULT${r.faults > 1 ? 'S' : ''}` : ''}` : `${r.t.toFixed(1)}S  HOME TO THE POST`;
  const y = agilityPostNear(g);
  if (y) {
    const f = g.farmwork;
    const key: UpKey = g.upgrades.stamina < g.upgrades.speed ? 'stamina' : 'speed';
    const mark = f.trainedDay === g.day.day ? 'TRAINED TODAY' : `${key.toUpperCase()} ${f.marks[key] ?? 0}/${AGILITY_MARKS}`;
    return `${E}: RUN THE AGILITY COURSE (PAR ${AGILITY_PAR}S, ${mark}${f.best ? `, BEST ${f.best}S` : ''})`;
  }
  return null;
}

// Near the shed or the dairy: what they do (after the pen gates' hints).
export function farmworkNearHint(g: Game): string | null {
  const d = g.dog;
  for (const s of shed(g))
    if (Math.hypot(d.x - s.cx, d.y - s.cy) < 44) return g.season.season === 'summer' ? 'SHEARING TIME: WALK SHEEP ALONG THE CHUTE, PAST THE DOOR.' : 'THE SHEARING SHED. IN SUMMER, SHEEP WALKED ALONG ITS CHUTE ARE SHORN.';
  for (const dy of dairies(g))
    if (Math.hypot(d.x - dy.cx, d.y - dy.cy) < 44) {
      const n = g.animals.filter((a) => a.milkedDay === g.day.day).length;
      return dairyOpen(g) ? `MILKING TILL NOON: WALK COWS INTO THE YARD (${n} MILKED TODAY).` : 'THE DAIRY MILKS IN THE MORNING, TILL NOON.';
    }
  return null;
}

