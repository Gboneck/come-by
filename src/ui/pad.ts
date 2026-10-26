import { PAD, type Action } from '../input';
import type { Game } from '../game';
import { setTextFilter } from '../gfx/font';
import { isTyping, padType, stopTyping } from './textfield';

// Game pads (input.ts reads the Gamepad API). Each frame, before the game
// updates, the buttons pressed are turned into the same actions the keys
// push, for whichever screen is up:
//
//   play     left stick or d-pad move, RT / LT / RB (hold) sprint, A bark,
//            B nip, X (hold) lie down, Y helpers, LB build, START pause,
//            SELECT ledger
//   menus    d-pad or stick to choose, left/right to change, A to pick,
//            B to go back (START too)
//   build    stick or d-pad move the cursor, A build/place, B done,
//            X remove, Y upgrade (over a building) or turn, LB/RB pick,
//            LT/RT change tab
//   names    up/down change the last letter, right adds one, left
//            deletes, A or B is done (B on the join screen leaves it)
//
// While a pad is in use the keyboard prompts read as pad buttons (PROMPTS).

const DELAY = 0.32; // seconds before a held direction repeats
const RATE = 0.1;
const CURSOR_RATE = 0.055; // the build cursor, as the keys repeat it

const TAB_IDS = ['build', 'decor', 'ranch', 'dog', 'market'];

type Dir = 'up' | 'down' | 'left' | 'right';
const rep = { dir: null as Dir | null, t: 0 };

// The direction held on the d-pad, else the left stick (past half way).
function heldDir(game: Game): Dir | null {
  const p = game.input.pad;
  if (p.down[PAD.UP]) return 'up';
  if (p.down[PAD.DOWN]) return 'down';
  if (p.down[PAD.LEFT]) return 'left';
  if (p.down[PAD.RIGHT]) return 'right';
  const { lx, ly } = p;
  if (Math.max(Math.abs(lx), Math.abs(ly)) < 0.5) return null;
  return Math.abs(lx) > Math.abs(ly) ? (lx < 0 ? 'left' : 'right') : ly < 0 ? 'up' : 'down';
}

// A direction as presses: once at once, then repeating while held.
function dirPress(game: Game, dt: number, rate: number): Dir | null {
  const d = heldDir(game);
  if (d !== rep.dir) {
    rep.dir = d;
    rep.t = 0;
    return d;
  }
  if (!d) return null;
  rep.t += dt;
  if (rep.t < DELAY) return null;
  rep.t -= rate;
  return d;
}

export function padFrame(game: Game, dt: number) {
  const inp = game.input;
  inp.pollPad();
  setTextFilter(inp.padMode ? prompts : null);
  if (!inp.pad.connected) {
    rep.dir = null;
    return;
  }
  const hit = (b: number) => inp.padHit(b);
  const push = (...a: Action[]) => a.forEach((x) => inp.push(x));
  if (hit(PAD.A) || hit(PAD.B) || hit(PAD.START)) push('any');

  // Typing a name or a code.
  if (isTyping()) {
    const d = dirPress(game, dt, RATE);
    if (d === 'up') padType(1);
    else if (d === 'down') padType(-1);
    else if (d === 'right') padType('add');
    else if (d === 'left') padType('del');
    if (hit(PAD.A) || hit(PAD.B) || hit(PAD.START)) stopTyping();
    // The join screen is its code field (it takes the keys back at once):
    // B leaves the screen.
    if (hit(PAD.B) && game.mode === 'coop') push('cancel');
    return;
  }

  const mode = game.mode;
  if (mode === 'play') {
    // The stick and d-pad move the dog (input.move); presses still count
    // for the cards that come up over play (trial results, buyers).
    dirPress(game, dt, RATE);
    if (hit(PAD.A)) push('bark', 'confirm');
    if (hit(PAD.B)) push('nip', 'cancel');
    if (hit(PAD.Y)) push('helper');
    if (hit(PAD.LB)) push('build');
    if (hit(PAD.SELECT)) push('ledger');
    if (hit(PAD.START)) push('pause');
    return;
  }
  if (mode === 'build') {
    const d = dirPress(game, dt, game.build.tab === 'build' || game.build.tab === 'decor' ? CURSOR_RATE : RATE);
    if (d) push(d);
    if (hit(PAD.A)) push('confirm');
    if (hit(PAD.B) || hit(PAD.START)) push('cancel');
    if (hit(PAD.X)) push('remove');
    if (hit(PAD.Y)) {
      const { cx, cy } = game.build;
      const over = game.ranch.buildings.some((b) => b.kind !== 'regiongate' && b.overlapsTiles(cx, cy, 1, 1));
      push(over ? 'upgrade' : 'rotate');
    }
    if (hit(PAD.LB)) push('prev');
    if (hit(PAD.RB)) push('next');
    const step = hit(PAD.RT) ? 1 : hit(PAD.LT) ? -1 : 0;
    if (step) {
      const i = TAB_IDS.indexOf(game.build.tab);
      push(`tab${((i + step + TAB_IDS.length) % TAB_IDS.length) + 1}` as Action);
    }
    return;
  }
  if (mode === 'summary') {
    if (hit(PAD.A)) push('confirm');
    if (hit(PAD.LB)) push('build');
    return;
  }
  if (mode === 'ledger') {
    // Pages with the bumpers; the badge grid with the d-pad.
    const d = dirPress(game, dt, RATE);
    if (d) push(d);
    if (hit(PAD.A)) push('confirm');
    if (hit(PAD.B)) push('cancel');
    if (hit(PAD.LB)) push('prev');
    if (hit(PAD.RB)) push('next');
    if (hit(PAD.SELECT) || hit(PAD.START)) push('ledger');
    return;
  }
  // Title, pause, the dog's look, co-op, moving a save: lists of rows.
  const d = dirPress(game, dt, RATE);
  if (d) push(d);
  if (hit(PAD.A)) push('confirm');
  if (hit(PAD.B)) push('cancel');
  if (hit(PAD.START)) push(mode === 'title' ? 'confirm' : 'pause');
}

// ---- Prompts ----
//
// Keyboard prompts as drawn by the screens, and what they read as on a pad.
// Whole lines first, then phrases. A new keyboard prompt only needs a line
// here to read right on a pad.
const RULES: [RegExp, string][] = [
  // The title's controls.
  [/^WASD MOVE {2}SHIFT RUN {2}SPACE BARK {2}E NIP$/, 'STICK MOVE  (RT) RUN  (A) BARK  (B) NIP'],
  [/^HOLD Q LIE DOWN {2}B BUILD {2}TAB LEDGER$/, 'HOLD (X) LIE DOWN  (LB) BUILD  (SELECT) LEDGER'],
  [/^H HELPERS {2}ESC PAUSE {2}M SOUND$/, '(Y) HELPERS  (START) PAUSE'],
  // Build mode's foot lines and info card.
  [/^ARROWS MOVE {2}Q\/E PICK {2}R TURN {2}SPACE BUILD$/, '(LB)(RB) PICK  (Y) TURN  (A) BUILD  (LT)(RT) TABS'],
  [/^ARROWS MOVE {2}Q\/E PICK {2}SPACE PLACE {2}X PICK UP$/, '(LB)(RB) PICK  (A) PLACE  (X) PICK UP'],
  [/\bU: UPGRADE/g, '(Y) UPGRADE'],
  [/\bX: (REMOVE|PICK IT UP)/g, '(X) $1'],
  // Buttons and cards.
  [/\bSPACE: NEXT DAY\b/g, '(A) NEXT DAY'],
  [/\bB: BUILD\b/g, '(LB) BUILD'],
  [/\bTAB: CLOSE\b/g, '(B) CLOSE'],
  [/\bQ\/E: PAGES\b/g, '(LB)(RB) PAGES'],
  [/\bENTER: (OPEN|SHARE)\b/g, '(A) $1'],
  [/\bESC: BACK\b/g, '(B) BACK'],
  [/\bESC: RESUME\b/g, '(B) RESUME'],
  [/\bENTER: TYPE A NAME\b/g, '(A) TYPE A NAME'],
  [/\bARROWS: CHANGE\b/g, '(D-PAD) CHANGE'],
  [/\bPRESS ENTER\b/g, 'PRESS (A)'],
  [/^H: /, '(Y) '],
  // Hints and tips.
  [/^TAB OPENS\b/, '(SELECT) OPENS'],
  [/\bPRESS B AT\b/g, 'PRESS (LB) AT'],
  [/\bSPACE TO BARK\b/g, '(A) TO BARK'],
  [/\bHOLD Q\b/g, 'HOLD (X)'],
  [/\(E\)/g, '(B)'],
  [/\bE: /g, '(B) '],
  [/\bWITH E AT\b/g, 'WITH (B) AT'],
  [/^E HOLDS\b/, '(B) HOLDS'],
  // The key cap that floats by the dog.
  [/^SPACE$/, '(A)'],
  [/^E$/, '(B)'],
];

const seen = new Map<string, string>();
function prompts(s: string): string {
  let out = seen.get(s);
  if (out === undefined) {
    out = s;
    for (const [re, to] of RULES) out = out.replace(re, to);
    if (seen.size > 500) seen.clear();
    seen.set(s, out);
  }
  return out;
}
