import { C } from '../palette';
import { ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import type { Group } from '../entities/animal';
import type { SpeciesId } from '../world/map';
import { SPECIES } from '../entities/species';
import { CATALOG } from '../ranch/catalog';
import { nextGoal } from '../systems/progression';
import { orderFor, tToClock, yardOf } from '../systems/orders';
import { PARTS, currentClass } from '../systems/trials';
import { arrow } from './hud';

// The one thing to do now, always: worked out each frame from what is going
// on (the night, a trial run, a flock being driven, the first day's steps,
// a buyer's order, the tier's next goal), with where it is. The HUD's goal
// card shows the words; a butter arrow by the dog points the way, and a
// marker bobs over the spot once it is in view. On a friend's ranch the
// same works from the host's world as the guest sees it.

export interface Objective {
  text: string;
  at: { x: number; y: number } | null; // where in the world (null: nowhere in particular)
  label?: string; // over the spot once it is in view
  ui?: 'build' | 'rest'; // or a button to press instead of a place to go
  mark?: boolean; // false: the coach already marks the spot
  progress?: [number, number];
}

const plural = (id: SpeciesId, n: number) => (n === 1 ? SPECIES[id].name : SPECIES[id].plural).toUpperCase();

// The free flock nearest the dog, of a kind if one is given.
function nearestFlock(game: Game, sp?: SpeciesId): Group | null {
  let best: Group | null = null, bd = Infinity;
  for (const gr of game.groups) {
    if (sp && gr.species !== sp) continue;
    if (gr.members[0]?.trial || gr.members[0]?.pen) continue;
    const d = Math.hypot(gr.x - game.dog.x, gr.y - game.dog.y);
    if (d < bd) { bd = d; best = gr; }
  }
  return best;
}

// Where a flock of this kind goes home: the gate of a paddock with room.
function homeGate(game: Game, gr: Group) {
  const a = gr.members[0];
  const pen = game.ranch.pens.find((p) => p.hasRoomFor(a));
  return pen ? pen.gatePoint(10) : null;
}

const onRanch = (game: Game) => game.inRanch();

export function objective(game: Game): Objective | null {
  if (game.mode !== 'play' || game.trials.result || game.demo) return null;
  const night = game.day.phase === 'night';

  // Night: keep the coyotes off the stock.
  if (night) {
    const d = game.dog;
    const p = game.predators.filter((x) => x.active && x.state !== 'flee').sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (p) return { text: p.carry ? 'SAVE THE ONE BEING CARRIED OFF!' : 'CHASE OFF THE COYOTE', at: { x: p.x, y: p.y }, label: '!', mark: false };
    return { text: 'GUARD THE PADDOCKS TILL DAWN', at: null };
  }

  // A trial run: the next part of the course.
  const run = game.trials.run;
  if (run) {
    const part = PARTS[run.step];
    return { text: part ? `TRIAL: ${part.short}` : 'TRIAL', at: null, mark: false };
  }

  // Working a flock: where these go.
  const near = game.nearestGroup(90);
  if (near && !near.members[0].trial) {
    const sp = near.species;
    const n = near.members.length;
    const o = orderFor(game, sp);
    if (o) {
      const y = yardOf(game, o.yard);
      return { text: `TAKE THE ${plural(sp, n)} TO ${y.site.name}`, at: y.pen.gatePoint(10), label: y.site.name, mark: false };
    }
    const gate = homeGate(game, near);
    if (gate) return { text: `DRIVE THE ${plural(sp, n)} INTO THE PADDOCK`, at: gate, label: 'IN HERE', mark: game.tut !== 3 };
    return { text: `NO ROOM FOR ${plural(sp, 2)}: BUILD A PADDOCK`, at: null, ui: onRanch(game) ? 'build' : undefined };
  }

  // The first day: find the ducks.
  if (game.tut === 0) {
    const gr = nearestFlock(game, 'duck');
    return { text: 'FIND YOUR DUCKS', at: gr ? { x: gr.x, y: gr.y } : null, label: 'DUCKS' };
  }

  // A buyer's order: go and get what they want.
  const o = game.orders.open[0];
  if (o) {
    const y = yardOf(game, o.yard);
    const when = `BY ${tToClock(o.due)}`;
    const want = `${o.n - o.got} ${plural(o.species, o.n - o.got)} FOR ${y.site.name} ${when}`;
    const pen = game.ranch.pens.find((p) => p.animals.some((a) => a.sp.id === o.species && !a.gone));
    if (pen) return { text: want, at: pen.gatePoint(6), label: 'LET THEM OUT', mark: false };
    const gr = nearestFlock(game, o.species);
    if (gr) return { text: want, at: { x: gr.x, y: gr.y }, label: plural(o.species, 2) };
    return { text: want, at: y.pen.gatePoint(10), label: y.site.name };
  }

  // The tier's next goal.
  const ng = nextGoal(game);
  if (ng) {
    const label = ng.goal.label;
    const progress: [number, number] | undefined = ng.goal.target > 1 ? [Math.min(ng.value, ng.goal.target), ng.goal.target] : undefined;
    const build = label.match(/^BUILD (?:A|THE) (\w+)$/);
    if (build) {
      const kind = build[1].toLowerCase();
      const def = CATALOG.find((d) => d.kind === kind || d.id === kind || d.name === build[1]);
      const cost = def?.cost ?? 0;
      if (game.coins >= cost) return { text: label, at: null, ui: onRanch(game) ? 'build' : undefined, progress };
      // Not enough yet: goods sell at day's end, and flocks pay when penned.
      const gr = nearestFlock(game);
      return { text: `${label}: ${cost}$ (YOU HAVE ${game.coins}$)`, at: gr ? { x: gr.x, y: gr.y } : null, label: gr ? plural(gr.species, 2) : undefined, ui: gr ? undefined : 'rest' };
    }
    const pen = label.match(/^PEN \d+ (\w+)$/);
    if (pen) {
      const sp = (Object.keys(SPECIES) as SpeciesId[]).find((id) => SPECIES[id].plural.toUpperCase() === pen[1]);
      const gr = nearestFlock(game, sp);
      return { text: label, at: gr ? { x: gr.x, y: gr.y } : null, label: sp ? plural(sp, 2) : undefined, progress };
    }
    if (/TRIAL/.test(label) && currentClass(game)) {
      const p = game.ranch.course.post;
      return { text: label, at: { x: p.x, y: p.y }, label: 'THE CROOK', progress };
    }
    if (/ORDER/.test(label)) return { text: label, at: null, progress };
    // Anything else: the goal, and the nearest flock to be getting on with.
    const gr = nearestFlock(game);
    return { text: label, at: gr ? { x: gr.x, y: gr.y } : null, label: gr ? plural(gr.species, 2) : undefined, progress };
  }

  const gr = nearestFlock(game);
  if (gr) return { text: `BRING THE ${plural(gr.species, 2)} HOME`, at: { x: gr.x, y: gr.y }, label: plural(gr.species, 2) };
  return { text: 'REST TILL THE GOODS SELL', at: null, ui: onRanch(game) ? 'rest' : undefined };
}

// The objective's arrow and marker in the world: a buttercup arrow circling
// the dog towards the spot while it is out of view (or far), and a bobbing
// marker over the spot once it is in view. `top`/`bottom`: the clear field.
export function drawObjective(game: Game, g: CanvasRenderingContext2D, ob: Objective | null, top: number, bottom: number) {
  if (!ob?.at) return;
  const { ox, oy, W } = game.view();
  const t = game.t;
  const sx = Math.round(ob.at.x - ox), sy = Math.round(ob.at.y - oy);
  const inView = sx > 6 && sx < W - 6 && sy > top + 16 && sy < bottom - 4;
  const dx = ob.at.x - game.dog.x, dy = ob.at.y - game.dog.y;
  const dist = Math.hypot(dx, dy);
  if (inView && ob.mark !== false) {
    const bob = Math.floor(t * 4) % 2;
    ring(g, sx, sy, 5 + (Math.floor(t * 3) % 2), C.butter, 4);
    arrow(g, sx + 1, sy - 10 - bob + 1, Math.PI / 2, 4, C.plum);
    arrow(g, sx, sy - 10 - bob, Math.PI / 2, 4, C.butter);
    if (ob.label) {
      const hw = textWidth(ob.label) / 2;
      text(g, ob.label, Math.max(hw + 2, Math.min(W - hw - 2, sx)), sy - 21 - bob, C.wool, { align: 'center', shadow: C.plum });
    }
  }
  // The arrow by the dog, sliding out the way to go, unless the dog is
  // already there; while the spot is out of view, what it points at.
  if ((!inView || dist > 70) && dist > 24) {
    const ang = Math.atan2(dy, dx);
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const slide = Math.floor(((t * 1.5) % 1) * 5);
    const r = 16 + slide;
    const bx = game.dog.x - ox, by = game.dog.y - oy - 4;
    const ax = Math.round(bx + cx * r), ay = Math.round(by + cy * r);
    arrow(g, ax + 1, ay + 1, ang, 6, C.plum);
    arrow(g, ax, ay, ang, 6, C.butter);
    if (slide > 1) arrow(g, Math.round(bx + cx * (r - 6)), Math.round(by + cy * (r - 6)), ang, 3, C.butter);
    if (!inView && ob.label) {
      const hw = textWidth(ob.label) / 2;
      const lx = Math.max(hw + 2, Math.min(W - hw - 2, bx + cx * 33)), ly = Math.round(by + cy * 30 - 2);
      text(g, ob.label, lx, ly, C.wool, { align: 'center', shadow: C.plum });
    }
  }
}
