import type { Game } from '../game';
import { quality } from '../gfx/quality';

// How the flock feels, shown over it now and then: a note rising from a
// flock grazing in peace, a heart over stock settled in a pen, stress lines
// over a flock that is nervous. Only on screen, only by day, and fewer on
// the lower graphics levels. Also tells the effects what the ground is
// like, so footfalls throw up dust, mud or snow.

let t = 0;

export function updateEmotes(game: Game, dt: number) {
  const fx = game.fx;
  fx.ground = game.season.snow > 0.4 ? 'snow' : game.weather.rain > 0.25 ? 'wet' : 'dry';
  if ((t -= dt) > 0) return;
  t = 0.35;
  if (game.mode !== 'play' || game.day.phase === 'night' || game.trials.run) return;
  const alive = fx.list.reduce((n, p) => n + (p.rise ? 1 : 0), 0);
  if (alive >= Math.round(6 * quality.fx)) return;
  const { ox, oy, W, H } = game.view();
  const on = (x: number, y: number) => x > ox + 8 && x < ox + W - 8 && y > oy + 24 && y < oy + H - 30;
  // A free flock in view, chosen at random.
  const groups = game.groups.filter((g) => on(g.x, g.y));
  const gr = groups[Math.floor(Math.random() * groups.length)];
  if (gr && Math.random() < quality.fx) {
    const a = gr.members[Math.floor(Math.random() * gr.members.length)];
    const top = a.y - a.sp.r * 2 - 5;
    if (gr.stress > 0.55 && Math.random() < 0.8) fx.emote(a.x + 2, top, 'stress');
    else if (gr.stress < 0.08 && game.dog.speed < 30 && Math.random() < 0.12) fx.emote(a.x, top, 'note');
  }
  // Stock at home in a pen, close to the dog: a heart now and then.
  if (Math.random() < 0.06 * quality.fx) {
    const pens = game.ranch.pens.filter((p) => p.animals.length && on(p.cx, p.cy));
    const p = pens[Math.floor(Math.random() * pens.length)];
    const a = p?.animals[Math.floor(Math.random() * p.animals.length)];
    if (a && a.stress < 0.2) fx.emote(a.x, a.y - a.sp.r * 2 - 5, 'heart');
  }
}
