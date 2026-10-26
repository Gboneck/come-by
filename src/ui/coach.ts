import { C } from '../palette';
import { ring } from '../gfx/draw';
import { panel } from './frame';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import type { Group } from '../entities/animal';
import { arrow } from './hud';
import { updateEmotes } from './emotes';
import { updateWhatsThis } from './whatsthis';
import { buzz } from './settings';
import { orderFor, penGateAt, yardOf } from '../systems/orders';
import { PARTS, atPost, currentClass } from '../systems/trials';
import { CATALOG, defOf } from '../ranch/catalog';

// In-the-moment coaching: markers showing where to stand or where the flock
// goes next, key caps and pulsing buttons for the move a hint asks for, and
// one-time tips when the player does the thing the tip is about.

interface Target { x: number; y: number; label: string; ang?: number } // ang: point in along it

// The next thing on the trial course, while a run is on.
export function trialTarget(game: Game): Target | null {
  const r = game.trials.run;
  const part = r && PARTS[r.step];
  if (!r || !part || r.endT > 0) return null;
  const c = game.ranch.course;
  if (part.id === 'post') return { x: c.post.x, y: c.post.y, label: 'POST' };
  if (part.id === 'pen') {
    const gp = c.pen.gatePoint(8);
    return { x: gp.x, y: gp.y, label: 'PEN', ang: Math.atan2(c.pen.cy - gp.y, c.pen.cx - gp.x) };
  }
  const gt = c.gates.find((x) => x.id === (part.id === 'lift' ? 'fetch' : part.id))!;
  return { x: gt.x, y: gt.y, label: part.id === 'lift' ? 'FETCH GATE' : part.short, ang: Math.atan2(gt.dy, gt.dx) };
}

// Where this flock should be heading: the course, a buyer's yard, or home.
function flockTarget(game: Game, gr: Group): { x: number; y: number } | null {
  const a = gr.members[0];
  if (a.trial) return trialTarget(game);
  const o = orderFor(game, a.sp.id);
  if (o) return yardOf(game, o.yard).pen.gatePoint(10);
  // No pen with room: still read the drive against the ranch's first pen.
  const pen = game.ranch.pens.find((p) => p.hasRoomFor(a)) ?? game.ranch.pens[0];
  return pen ? pen.gatePoint(10) : null;
}

interface Drive {
  gr: Group;
  spot: { x: number; y: number }; // where to stand to push them on
  behind: number; // cos of the dog's angle from the "push on" side
  gate: { x: number; y: number };
}

function driveInfo(game: Game): Drive | null {
  const gr = game.nearestGroup(150);
  if (!gr) return null;
  const gate = flockTarget(game, gr);
  if (!gate) return null;
  let bx = gr.x - gate.x, by = gr.y - gate.y;
  const bl = Math.hypot(bx, by) || 1;
  bx /= bl;
  by /= bl;
  let rad = 0;
  for (const a of gr.members) rad = Math.max(rad, Math.hypot(a.x - gr.x, a.y - gr.y));
  const back = rad + gr.members[0].sp.flight * 0.8;
  const dx = game.dog.x - gr.x, dy = game.dog.y - gr.y;
  const dl = Math.hypot(dx, dy) || 1;
  return { gr, spot: { x: gr.x + bx * back, y: gr.y + by * back }, behind: (dx * bx + dy * by) / dl, gate };
}

// A ranch pen holding stock that an open order wants, gate still shut.
function orderPen(game: Game) {
  for (const o of game.orders.open) {
    const p = game.ranch.pens.find((x) => x.species === o.species && x.animals.length && !x.letOut);
    if (p) return p;
  }
  return null;
}

let frontT = 0;
let stressT = 0;
let lastRun: unknown = null;
let penned = false;
let sold = -1;

// The big moments of the jobs get the same kick and buzz as a pen gate.
function watchJobs(game: Game) {
  const r = game.trials.run;
  if (r !== lastRun) {
    lastRun = r;
    penned = false;
  }
  // The run's own coaching takes the hint line from any tip on the way in.
  if (r && r.t < 1) game.tip = null;
  if (r?.penned && !penned) {
    penned = true;
    game.feel.kick(0, 2, 0.16);
    game.feel.moment = 1.6;
    buzz(game.input.touchMode, [18, 50, 36]);
  }
  const n = game.totals.orders ?? 0;
  if (sold >= 0 && n > sold) {
    game.feel.kick(0, 2, 0.16);
    buzz(game.input.touchMode, [18, 50, 36]);
  }
  sold = n;
  if (game.ranch.pens.some((p) => p.letOut)) game.tipsSeen.add('c-letout');
}

// One-time tips, shown through the hint line when they apply.
export function updateCoach(game: Game, dt: number) {
  if (game.demo) return;
  updateEmotes(game, dt);
  updateWhatsThis(game, dt);
  watchJobs(game);
  if (game.tip) return;
  const seen = game.tipsSeen;
  const touch = game.input.touchMode;
  const dr = driveInfo(game);
  const tip = (id: string, s: string, t = 6) => {
    seen.add(id);
    game.tip = { text: s, t };
  };
  if (!dr || game.day.phase === 'night') {
    frontT = stressT = 0;
    return;
  }
  const trial = !!dr.gr.members[0].trial;
  const near = Math.hypot(game.dog.x - dr.gr.x, game.dog.y - dr.gr.y) < dr.gr.members[0].sp.flight * 1.6 + 10;
  // Standing between the flock and where it is going pushes it back. (A
  // trial outrun starts in front by design, so not there.)
  frontT = near && dr.behind < -0.3 && game.tut >= 2 && !trial ? frontT + dt : 0;
  if (frontT > 2.5 && !seen.has('c-front') && game.tier <= 2)
    tip('c-front', 'YOU ARE IN FRONT, SO THEY TURN BACK. GO ROUND TO THE FAR SIDE.');
  stressT = dr.gr.stress > 0.55 && near ? stressT + dt : 0;
  if (stressT > 0.6 && !seen.has('c-stress') && game.tier <= 3)
    tip('c-stress', touch ? 'EASY! THEY ARE RATTLED. STOP, OR HOLD DOWN TILL THEY SETTLE.' : 'EASY! THEY ARE RATTLED. STOP, OR HOLD Q TILL THEY SETTLE.');
  // Driving a kind no pen can take: pens hold one kind at a time.
  const a = dr.gr.members[0];
  const drivingHome = near && !trial && !orderFor(game, a.sp.id) && game.tut >= 7;
  if (drivingHome && !game.ranch.pens.some((p) => p.hasRoomFor(a)) && !seen.has(`c-nopen-${a.sp.id}`))
    tip(`c-nopen-${a.sp.id}`, `NO PEN HAS ROOM FOR ${a.sp.plural.toUpperCase()}. A PEN HOLDS ONE KIND: BUILD ANOTHER AT THE RANCH (${CATALOG.find((d) => d.id === 'pen')!.cost}$).`, 7);
  // Two bits of the same flock close to the dog: it split.
  if (!seen.has('c-split') && game.tut >= 3) {
    const same = game.groups.filter((g) => g.species === dr.gr.species && Math.hypot(g.x - game.dog.x, g.y - game.dog.y) < 120);
    if (same.length >= 2 && same.every((g) => g.members.length >= 2)) tip('c-split', 'THEY SPLIT! CIRCLE WIDE ROUND THE SMALLER BUNCH TO JOIN THEM UP.');
  }
}

// Step 1 of the tutorial changes with where the dog stands.
export function coachHint(game: Game): string | null {
  if (game.tip || game.tut !== 1) return null;
  const dr = driveInfo(game);
  if (!dr) return null;
  return dr.behind > 0.7 ? 'NOW WALK IN SLOWLY. THEY MOVE AWAY FROM YOU.' : 'CIRCLE ROUND TO THE FAR SIDE OF THEM.';
}

// Which touch button to pulse.
export function coachButton(game: Game): 'bark' | 'nip' | 'lie' | null {
  if (game.tut === 2 || game.tip?.text.includes('HOLD DOWN')) return 'lie';
  if (game.tut === 6 && game.coins < defOf('kennel').cost && game.inRanch() && game.rest === 1) return 'lie';
  if (game.tip?.text.includes('NIP')) return 'nip';
  if (game.day.phase !== 'night') {
    // At the crook, or at the gate of a pen whose stock a buyer wants.
    if (!game.trials.run && atPost(game) && currentClass(game)) return 'nip';
    const p = penGateAt(game);
    if (p && p === orderPen(game)) return 'nip';
  }
  if (game.day.phase === 'night' && game.tier <= 3) {
    const d = game.dog;
    if (game.predators.some((p) => p.active && p.state !== 'flee' && Math.hypot(p.x - d.x, p.y - d.y) < d.stats.barkRange)) return 'bark';
  }
  return null;
}

// Desktop key cap floating by the dog, for the same moments.
function coachKey(game: Game): string | null {
  if (game.input.touchMode) return null;
  const b = coachButton(game);
  return b === 'lie' ? 'HOLD Q' : b === 'nip' ? 'E' : b === 'bark' ? 'SPACE' : null;
}

// A bobbing arrow down onto a spot, with a ring and a label.
function marker(g: CanvasRenderingContext2D, W: number, x: number, y: number, label: string, t: number, ringed = true) {
  if (ringed) ring(g, x, y, 4 + (Math.floor(t * 3) % 2), C.butter, 4);
  const bob = Math.floor(t * 4) % 2;
  arrow(g, x + 1, y - 9 - bob + 1, Math.PI / 2, 4, C.plum);
  arrow(g, x, y - 9 - bob, Math.PI / 2, 4, C.butter);
  if (label) {
    const hw = textWidth(label) / 2;
    text(g, label, Math.max(hw + 2, Math.min(W - hw - 2, x)), y - 20 - bob, C.wool, { align: 'center', shadow: C.plum });
  }
}

// A chevron leading in through a gateway along `ang`. The label goes on
// the near side, out beyond the chevron, so it never sits on the stock.
function pointer(g: CanvasRenderingContext2D, W: number, x: number, y: number, ang: number, label: string, t: number) {
  const bob = Math.floor(t * 4) % 2;
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const ax = Math.round(x - cx * (9 + bob)), ay = Math.round(y - cy * (9 + bob));
  arrow(g, ax + 1, ay + 1, ang, 4, C.plum);
  arrow(g, ax, ay, ang, 4, C.butter);
  if (label) {
    const hw = textWidth(label) / 2;
    const lx = x - cx * 20, ly = y - cy * 20 + (cy < -0.5 ? 2 : cy > 0.5 ? -8 : -3);
    text(g, label, Math.max(hw + 2, Math.min(W - hw - 2, lx)), ly, C.wool, { align: 'center', shadow: C.plum });
  }
}

// World-anchored markers, drawn with the HUD.
// Only between `top` and `bottom` (the field the HUD leaves clear); outside
// that the edge arrows point the way.
export function drawCoach(game: Game, g: CanvasRenderingContext2D, top: number, bottom: number) {
  if (game.mode !== 'play' || game.trials.result) return;
  const { ox, oy, W } = game.view();
  const t = game.t;
  const on = (x: number, y: number) => x > 4 && x < W - 4 && y > top + 18 && y < bottom - 2;
  if (game.tut === 1) {
    const dr = driveInfo(game);
    const x = dr ? Math.round(dr.spot.x - ox) : 0, y = dr ? Math.round(dr.spot.y - oy) : 0;
    if (dr && dr.behind <= 0.7 && on(x, y)) marker(g, W, x, y, 'HERE', t);
  }
  if (game.tut === 3) {
    const dr = driveInfo(game);
    if (dr) {
      const pen = game.ranch.pens.find((p) => p.hasRoomFor(dr.gr.members[0]));
      if (pen) pointer(g, W, Math.round(dr.gate.x - ox), Math.round(dr.gate.y - oy), Math.atan2(pen.cy - dr.gate.y, pen.cx - dr.gate.x), '', t);
    }
  }
  const night = game.day.phase === 'night';
  // A run: the next gate, the post or the pen.
  const tt = trialTarget(game);
  if (tt) {
    const x = Math.round(tt.x - ox), y = Math.round(tt.y - oy);
    if (on(x, y)) {
      if (tt.ang !== undefined) pointer(g, W, x, y, tt.ang, tt.label, t);
      else marker(g, W, x, y - 6, tt.label, t, false);
    }
  } else if (!game.trials.run && !night && currentClass(game) && game.map.regionAt(game.dog.x, game.dog.y)?.id === 'show' && !atPost(game)) {
    // At the Show Ground: stand here, by the crook, to start a run.
    const p = game.ranch.course.post;
    const x = Math.round(p.x - ox), y = Math.round(p.y + 4 - oy);
    if (on(x, y)) marker(g, W, x, y, 'HERE', t);
  }
  if (!night && !game.trials.run) {
    // A buyer wants what is in this pen: show how to let them out (until
    // the player has done it once).
    const p = orderPen(game);
    if (p && !game.tipsSeen.has('c-letout') && penGateAt(game) !== p) {
      const gp = p.gatePoint(2);
      const x = Math.round(gp.x - ox), y = Math.round(gp.y - oy);
      if (on(x, y)) pointer(g, W, x, y, Math.atan2(p.cy - gp.y, p.cx - gp.x), `${game.input.touchMode ? 'NIP' : 'E'} HOLDS THE GATE OPEN`, t);
    }
    // Driving a buyer's stock: in through the yard gate.
    const gr = game.nearestGroup(90);
    const o = gr && !gr.members[0].trial ? orderFor(game, gr.species) : undefined;
    if (o) {
      const pen = yardOf(game, o.yard).pen;
      const gp = pen.gatePoint(8);
      const x = Math.round(gp.x - ox), y = Math.round(gp.y - oy);
      if (on(x, y)) pointer(g, W, x, y, Math.atan2(pen.cy - gp.y, pen.cx - gp.x), yardOf(game, o.yard).site.name, t);
    }
  }
  const key = coachKey(game);
  if (key && !game.dog.lying) {
    const w = textWidth(key) + 6;
    const x = Math.round(game.dog.x - ox - w / 2), y = Math.round(game.dog.y - oy - 22 - (Math.floor(t * 2) % 2));
    panel(g, x, y, w, 9, C.plum, C.butter);
    text(g, key, x + 3, y + 2, C.wool);
  }
}
