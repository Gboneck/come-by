import { C } from '../palette';
import { heading, text, wrap } from '../gfx/font';
import type { Game } from '../game';
import { panel } from './frame';
import { safeArea } from './safe';

// The first day, so it cannot be missed: a welcome card as a new ranch
// opens (what you are, what to do first, how to move), put away by moving
// off or a tap; and the first day's hints carry their step ("FIRST DAY 2/7").

export const FIRST_STEPS = 7;
let from: { x: number; y: number; t: number } | null = null;

export function welcomeUp(game: Game): boolean {
  return game.mode === 'play' && game.day.day === 1 && game.tut === 0 && !game.tipsSeen.has('welcome') && !game.net && !game.demo && !game.input.override;
}

export function drawWelcome(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  if (!welcomeUp(game)) {
    from = null;
    return;
  }
  const d = game.dog;
  if (!from) from = { x: d.x, y: d.y, t: game.t };
  const age = game.t - from.t;
  // Moving off (once it has been up a moment) puts it away.
  if ((age > 1.2 && Math.hypot(d.x - from.x, d.y - from.y) > 28) || age > 12) {
    game.tipsSeen.add('welcome');
    return;
  }
  const S = safeArea(game.screen);
  const touch = game.input.touchMode;
  const pw = Math.min(W - 16 - S.left - S.right, 196);
  const body = [
    `YOU ARE ${game.look.name}, A CATTLE DOG ON A LITTLE RANCH.`,
    'YOUR DUCKS ARE OUT IN THE MEADOW. BRING THEM HOME TO THE PADDOCK.',
  ].flatMap((p) => wrap(p, pw - 14));
  const how = touch ? 'DRAG WITH YOUR LEFT THUMB TO RUN' : 'WASD OR THE ARROW KEYS TO RUN';
  const ph = 20 + body.length * 7 + 14;
  const x0 = Math.round(W / 2 - pw / 2);
  const y0 = Math.round(H * 0.3 - ph / 2 + Math.max(0, 1 - age * 4) * -12);
  panel(g, x0, y0, pw, ph, C.plum, C.butter);
  heading(g, 'COME BY!', W / 2, y0 + 5, C.butter, { align: 'center', shade: C.moss });
  body.forEach((l, i) => text(g, l, W / 2, y0 + 16 + i * 7, C.wool, { align: 'center' }));
  if (Math.floor(age * 2) % 2 === 0 || age < 1) text(g, how, W / 2, y0 + ph - 9, C.butter, { align: 'center' });
  if (game.ui.click('welcome', x0, y0, pw, ph)) game.tipsSeen.add('welcome');
}

// The first day's step, for its hints: null once it is over.
export function firstDayStep(game: Game): number | null {
  if (game.tut >= FIRST_STEPS || game.tip || game.net) return null;
  return game.tut + 1;
}
