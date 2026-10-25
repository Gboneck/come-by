import { C } from '../palette';
import { panel, ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import type { Group } from '../entities/animal';
import { arrow } from './hud';

// In-the-moment coaching: a marker showing where to stand to drive the
// flock, key caps and pulsing buttons for the move a hint asks for, and
// one-time tips when the player does the thing the tip is about.

interface Drive {
  gr: Group;
  spot: { x: number; y: number }; // where to stand to push them home
  behind: number; // cos of the dog's angle from the "push home" side
  gate: { x: number; y: number };
}

function driveInfo(game: Game): Drive | null {
  const gr = game.nearestGroup(150);
  if (!gr) return null;
  const pen = game.ranch.pens.find((p) => p.hasRoomFor(gr.members[0]));
  if (!pen) return null;
  const gate = pen.gatePoint(10);
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

let frontT = 0;
let stressT = 0;

// One-time tips, shown through the hint line when they apply.
export function updateCoach(game: Game, dt: number) {
  if (game.tip || game.demo) return;
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
  const near = Math.hypot(game.dog.x - dr.gr.x, game.dog.y - dr.gr.y) < dr.gr.members[0].sp.flight * 1.6 + 10;
  // Standing between the flock and home pushes them the wrong way.
  frontT = near && dr.behind < -0.3 && game.tut >= 2 ? frontT + dt : 0;
  if (frontT > 2.5 && !seen.has('c-front') && game.tier <= 2)
    tip('c-front', 'YOU ARE IN FRONT, SO THEY TURN BACK. GO ROUND TO THE FAR SIDE.');
  stressT = dr.gr.stress > 0.55 ? stressT + dt : 0;
  if (stressT > 0.6 && !seen.has('c-stress') && game.tier <= 3)
    tip('c-stress', touch ? 'EASY! THEY ARE RATTLED. STOP, OR HOLD DOWN TILL THEY SETTLE.' : 'EASY! THEY ARE RATTLED. STOP, OR HOLD Q TILL THEY SETTLE.');
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
  if (game.tut === 6 && game.coins < 20 && game.inRanch() && game.rest === 1) return 'lie';
  if (game.tip?.text.includes('NIP')) return 'nip';
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

// World-anchored markers, drawn with the HUD.
export function drawCoach(game: Game, g: CanvasRenderingContext2D) {
  if (game.mode !== 'play') return;
  const { ox, oy } = game.view();
  const t = game.t;
  if (game.tut === 1) {
    const dr = driveInfo(game);
    if (dr && dr.behind <= 0.7) {
      const x = Math.round(dr.spot.x - ox), y = Math.round(dr.spot.y - oy);
      ring(g, x, y, 4 + (Math.floor(t * 3) % 2), C.butter, 4);
      const bob = Math.floor(t * 4) % 2;
      arrow(g, x + 1, y - 9 - bob + 1, Math.PI / 2, 4, C.plum);
      arrow(g, x, y - 9 - bob, Math.PI / 2, 4, C.butter);
      text(g, 'HERE', x, y - 20 - bob, C.wool, { align: 'center', shadow: C.plum });
    }
  }
  if (game.tut === 3) {
    const dr = driveInfo(game);
    if (dr) {
      const gx = Math.round(dr.gate.x - ox), gy = Math.round(dr.gate.y - oy);
      const bob = Math.floor(t * 4) % 2;
      // Chevron pointing in through the open gate.
      const pen = game.ranch.pens.find((p) => p.hasRoomFor(dr.gr.members[0]))!;
      const ang = Math.atan2(pen.cy - dr.gate.y, pen.cx - dr.gate.x);
      const ax = Math.round(gx - Math.cos(ang) * (8 + bob)), ay = Math.round(gy - Math.sin(ang) * (8 + bob));
      arrow(g, ax + 1, ay + 1, ang, 4, C.plum);
      arrow(g, ax, ay, ang, 4, C.butter);
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
