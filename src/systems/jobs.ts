import type { Game } from '../game';
import type { Animal } from '../entities/animal';
import { gateAction, morningOrders, orderFor, penGateAt, updateOrders } from './orders';
import { PARTS, atPost, classLabel, currentClass, isTrialDay, nextTrialDay, prizeToday, startRun, updateRun } from './trials';
import { checkLegacy } from './progression';
import { SKY_LINE, SKY_TIP } from './weather';
import { Predator } from '../entities/predator';
import { breedNear, buyBreed, isFairDay, seasonalMorning, seasonalOrders, seasonalUpdate, type MorningBanner } from './seasonal';
import { valleyHint, valleyMorning, valleyUpdate } from './valley';
import { farmworkHint, farmworkUpdate, startAgility } from './farmwork';

// The jobs around the herding: buyers' orders and the Show Ground trials.
// Game calls in here at a handful of points; this keeps those hooks short.

export function jobsMorning(game: Game, fresh: boolean) {
  // The morning shows its most important banner: winter's feeding, the
  // shearer or the fair, then a trial day, a new season, the sky.
  const banners: MorningBanner[] = [];
  const season = seasonalMorning(game, fresh); // the calendar first: the rest reads it
  if (season) banners.push(season);
  if (fresh) {
    morningOrders(game);
    const shear = seasonalOrders(game);
    if (shear) banners.push(shear);
    game.weather.newDay(game.tier);
  }
  banners.push(...valleyMorning(game, fresh)); // the village grows, market day, festivals
  const sky = game.weather.sky;
  if (sky !== 'clear') banners.push({ big: `DAY ${game.day.day}`, small: SKY_LINE[sky], prio: 0 });
  const c = currentClass(game);
  if (c && isTrialDay(game.day.day)) banners.push({ big: `DAY ${game.day.day}: TRIAL DAY`, small: `THE ${c.name} CLASS RUNS AT THE SHOW GROUND`, prio: 2 });
  const top = banners.sort((a, b) => b.prio - a.prio)[0];
  if (top) game.showBanner(top.big, top.small, top.prio ? 3.4 : 2.8);
  // The first windy, wet, foggy or stormy day says what it does.
  const tip = SKY_TIP[sky];
  if (tip && !game.tipsSeen.has(`sky-${sky}`) && !game.tip) {
    game.tipsSeen.add(`sky-${sky}`);
    game.tip = { text: tip, t: 9 };
  }
}

// Nightfall: a storm brings an extra coyote, and they are all bolder.
export function jobsNight(game: Game) {
  if (game.weather.sky !== 'storm') return;
  const last = game.predators.reduce((t, p) => Math.max(t, p.waitT), 3);
  game.predators.push(new Predator('coyote', last + 4));
  for (const p of game.predators) p.bold = 1.6;
  game.showBanner('A STORMY NIGHT', 'THE COYOTES ARE BOLD TONIGHT. GET THEM ALL HOME', 3);
}

let legacyT = 0;

export function jobsUpdate(game: Game, dt: number) {
  updateOrders(game, dt);
  updateRun(game, dt);
  seasonalUpdate(game, dt);
  valleyUpdate(game, dt);
  farmworkUpdate(game, dt);
  if ((legacyT -= dt) <= 0) {
    legacyT = 0.5;
    checkLegacy(game);
  }
}

// E / NIP: start a trial at the handler's post, or open or shut a pen gate.
export function jobsAction(game: Game): boolean {
  if (atPost(game) && !game.trials.run && currentClass(game)) return startRun(game);
  if (buyBreed(game)) return true;
  if (startAgility(game)) return true;
  return gateAction(game);
}

// Gateways that draw driven animals in, as ranch pens do.
export function jobGates(game: Game) {
  const out: { x: number; y: number; open: boolean; accepts(a: Animal): boolean }[] = [];
  for (const y of game.ranch.yards) {
    const ord = game.orders.forYard(y.site.id);
    if (!ord) continue;
    const gp = y.pen.gatePoint(-6);
    const year = game.season.year;
    out.push({ x: gp.x, y: gp.y, open: y.pen.swing > 0.8, accepts: (a) => !a.pen && !a.trial && !a.young && !a.forSale && a.sp.id === ord.species && ord.got < ord.n && (ord.kind !== 'shear' || a.shorn !== year) });
  }
  if (isFairDay(game)) {
    const p = game.ranch.ring.pen;
    const gp = p.gatePoint(-6);
    out.push({ x: gp.x, y: gp.y, open: p.swing > 0.8, accepts: (a) => !a.pen && !a.trial && !a.young && !a.forSale && !game.seasonal.fair.some((e) => e.species === a.sp.id) });
  }
  if (game.trials.run) {
    const p = game.ranch.course.pen;
    const gp = p.gatePoint(-6);
    out.push({ x: gp.x, y: gp.y, open: p.swing > 0.8, accepts: (a) => a.trial && !a.pen });
  }
  return out;
}

// Contextual hint line: what E does here, and coaching on the first runs.
export function jobsHint(game: Game): string | null {
  const E = game.input.touchMode ? 'NIP' : 'E';
  const r = game.trials.run;
  if (r) {
    if (game.totals.trialRuns > 2 || r.endT > 0 || game.trials.result) return null;
    switch (PARTS[r.step].id) {
      case 'lift': return 'GO WIDE ROUND BEHIND THEM, THEN WALK THEM DOWN TO THE FETCH GATE. A QUIET LIFT SCORES.';
      case 'fetch': return 'THROUGH THE FETCH GATE (BRIGHT FLAGS), THEN ON TO THE POST.';
      case 'post': return 'BRING THEM ROUND TO THE POST WITH THE CROOK.';
      case 'drive': return 'NOW DRIVE THEM AWAY TO THE LEFT, THROUGH THE DRIVE GATE.';
      case 'cross': return 'ACROSS THE FIELD AND THROUGH THE CROSS GATE ON THE RIGHT.';
      case 'pen': return r.cls.species === 'cow' ? 'PEN THEM. THE GATE BESIDE THE POST IS OPEN.' : 'PEN THEM. THE GATE BESIDE THE POST IS OPEN. NO NIPPING: A GRIP IS A FAULT.';
    }
  }
  if (atPost(game)) {
    const c = currentClass(game);
    if (!c) return null;
    if (game.day.phase === 'night') return 'NO TRIALS AFTER DARK.';
    if (prizeToday(game)) return `${E}: RUN THE ${classLabel(c)} FOR PRIZES`;
    return `${E}: PRACTICE THE ${classLabel(c)}. NEXT TRIAL DAY IS DAY ${nextTrialDay(isTrialDay(game.day.day) ? game.day.day + 1 : game.day.day)}`;
  }
  const sale = breedNear(game);
  if (sale) return `${E}: BUY THE ${sale.breed.name} ${sale.a.forSale}$ (YOU HAVE ${game.coins}$)`;
  const work = farmworkHint(game);
  if (work) return work;
  const p = penGateAt(game);
  if (p) {
    if (p.letOut) return `WALK IN BEHIND THEM TO DRIVE THEM OUT. ${E}: SHUT THE GATE`;
    if (p.animals.length && p.species && orderFor(game, p.species)) return `${E}: OPEN THE GATE AND LET THEM OUT FOR THE BUYER`;
  }
  return valleyHint(game);
}
