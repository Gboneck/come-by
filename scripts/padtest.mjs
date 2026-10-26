// Game pad: a simulated pad (navigator.getGamepads stubbed) plays through
// the title, the look screen and its name field, play (move, sprint, bark,
// nip, lie down, helpers), pause, the Ledger, build mode, the day's
// summary, the co-op join screen's code and MOVE A RANCH; and the prompts
// switch to pad buttons.
//   node scripts/padtest.mjs [--shots] (shots/pad/)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const SHOTS = process.argv.includes('--shots');
const PORT = Number(process.env.PAD_PORT || 5356);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  window.__pad = { buttons: Array(17).fill(0), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [{
    id: 'Test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes: window.__pad.axes.slice(),
    buttons: window.__pad.buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })),
  }];
  try { localStorage.clear(); } catch { /* ignore */ }
});
await page.goto(`http://localhost:${PORT}/?debug&title`);
await page.waitForFunction(() => window.game);
if (SHOTS) mkdirSync('shots/pad', { recursive: true });

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const wait = (ms) => page.waitForTimeout(ms);
const set = (b, v) => page.evaluate(([b, v]) => (window.__pad.buttons[b] = v), [b, v]);
const stick = (x, y) => page.evaluate(([x, y]) => (window.__pad.axes = [x, y, 0, 0]), [x, y]);
// Presses during a screen fade are dropped (as keys are): wait it out.
// A screen also needs one frame drawn before its fields exist.
const settled = async () => {
  await page.waitForFunction(() => !window.game.feel.fading, null, { timeout: 5000 });
  await page.waitForTimeout(50);
};
async function press(b, hold = 60) {
  await settled();
  await set(b, 1);
  await wait(hold);
  await set(b, 0);
  await wait(80);
}
const g = (fn, arg) => page.evaluate(fn, arg);
let failed = 0;
function check(name, ok, info = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info !== '' ? `  (${typeof info === 'string' ? info : JSON.stringify(info)})` : ''}`);
}
const shot = async (n) => SHOTS && page.screenshot({ path: `shots/pad/${n}.png` });

// ---- Title: the prompts read as pad buttons once the pad is touched ----
await press(B.DOWN);
await press(B.UP);
check('title: pad takes over from the keyboard', await g(() => window.game.input.padMode && !window.game.input.touchMode));
const lines = await g(async () => {
  const f = await import('/src/gfx/font.ts');
  return [f.wrap('WASD MOVE  SHIFT RUN  SPACE BARK  E NIP', 999)[0], f.wrap('HOLD Q TO LIE DOWN: THEY SETTLE AND SLOW.', 999)[0], f.wrap('NIP (E) TO START A RUN', 999)[0], f.wrap('YOU JOINED THIS RANCH FROM ANOTHER TAB.', 999)[0]];
});
check('prompts: the title controls', lines[0] === 'STICK MOVE  (RT) RUN  (A) BARK  (B) NIP', lines[0]);
check('prompts: hints', lines[1].startsWith('HOLD (X) TO LIE DOWN') && lines[2] === 'NIP (B) TO START A RUN', lines.slice(1, 3));
check('prompts: plain words untouched', lines[3] === 'YOU JOINED THIS RANCH FROM ANOTHER TAB.', lines[3]);
await shot('title');

// ---- START a new game: the look screen, the name typed with the pad ----
await press(B.A);
await page.waitForFunction(() => window.game.mode === 'look', null, { timeout: 5000 });
check('title: A starts a new ranch (look screen)', true);
const name0 = await g(() => window.game.look.name);
await press(B.A); // the name row: start typing
check('look: A on the name types', await g(async () => (await import('/src/ui/textfield.ts')).isTyping()), await g(() => ({ sel: window.game.lookSel, act: document.activeElement?.tagName, mode: window.game.mode })));
await press(B.UP);
await press(B.RIGHT);
await press(B.UP);
await press(B.UP);
await shot('look-typing');
await press(B.A); // done
const name1 = await g(() => window.game.look.name);
check('look: up, right, up, up type BLUE into BLUFC', name0 === 'BLUE' && name1 === 'BLUFC', `${name0} -> ${name1}`);
await press(B.DOWN);
const sel = await g(() => window.game.lookSel);
await press(B.RIGHT);
check('look: d-pad moves through the rows', sel === 1, sel);
await press(B.B);
await page.waitForFunction(() => window.game.mode === 'play', null, { timeout: 3000 });
check('look: B closes it', true);

// ---- Play ----
await g(() => { const gm = window.game; gm.banner = null; gm.tut = 99; gm.dog.stamina = gm.dog.stats.stamina; });
let x0 = await g(() => window.game.dog.x);
await stick(1, 0);
await wait(500);
await stick(0, 0);
let x1 = await g(() => window.game.dog.x);
check('play: left stick walks the dog', x1 - x0 > 10, Math.round(x1 - x0));
x0 = x1;
await set(B.RIGHT, 1);
await wait(300);
await set(B.RIGHT, 0);
x1 = await g(() => window.game.dog.x);
check('play: d-pad walks too', x1 - x0 > 5, Math.round(x1 - x0));
const st0 = await g(() => window.game.dog.stamina);
await stick(-1, 0);
await set(B.RT, 1);
await wait(600);
const sprinting = await g(() => window.game.input.sprint);
await set(B.RT, 0);
await stick(0, 0);
const st1 = await g(() => window.game.dog.stamina);
check('play: RT sprints', sprinting && st1 < st0, { sprinting, stamina: [+st0.toFixed(2), +st1.toFixed(2)] });
await wait(500);
await press(B.A);
check('play: A barks', await g(() => window.game.dog.barkCd > 0));
await wait(300);
await press(B.B);
check('play: B nips', await g(() => window.game.dog.nipCd > 0));
await set(B.X, 1);
await wait(400);
const lying = await g(() => window.game.dog.lying);
await set(B.X, 0);
check('play: X held lies down', lying);
const zones = await g(() => window.game.showZones);
await press(B.Y);
check('play: Y is the helper command (debug: zones with no helpers)', (await g(() => window.game.showZones)) !== zones);
await shot('play');

// ---- Pause ----
await press(B.START);
check('START pauses', (await g(() => window.game.mode)) === 'pause');
await press(B.DOWN);
check('pause: d-pad moves the selection', (await g(() => window.game.pauseSel)) === 1);
await shot('pause');
await press(B.B);
check('pause: B resumes', (await g(() => window.game.mode)) === 'play');

// ---- Ledger ----
await press(B.SELECT);
check('SELECT opens the Ledger', (await g(() => window.game.mode)) === 'ledger');
const page_ = () => g(async () => (await import('/src/ui/ledger.ts')).ledgerView.page);
await press(B.RB);
check('ledger: RB turns to BUYERS', (await page_()) === 1);
await press(B.RB);
check('ledger: RB again to BADGES', (await page_()) === 2);
await g(() => (window.game.achievements.sel = 0));
await press(B.RIGHT);
check('ledger: the d-pad moves on the badge grid', (await g(() => window.game.achievements.sel)) === 1);
await g(() => { const A = window.game.achievements; A.got.delete('home'); A.sel = 0; });
await press(B.A);
check('ledger: A on a badge is the page\'s own (the book stays open)', (await g(() => window.game.mode)) === 'ledger');
await shot('ledger-badges');
await press(B.LB);
await press(B.LB);
check('ledger: LB turns back to the ranch page', (await page_()) === 0);
await press(B.B);
check('ledger: B closes it', (await g(() => window.game.mode)) === 'play');

// ---- Build mode ----
await g(() => { const gm = window.game, d = gm.doorPoint(); gm.dog.x = d.x; gm.dog.y = d.y + 20; gm.coins = 500; });
await wait(100);
await press(B.LB);
check('LB on the ranch opens build mode', (await g(() => window.game.mode)) === 'build');
const item0 = await g(() => window.game.build.item);
await press(B.RB);
check('build: RB picks the next building', (await g(() => window.game.build.item)) === item0 + 1);
const c0 = await g(() => window.game.build.cx);
await press(B.RIGHT);
check('build: d-pad moves the cursor', (await g(() => window.game.build.cx)) === c0 + 1);
await press(B.RT);
check('build: RT changes tab', (await g(() => window.game.build.tab)) === 'decor');
await press(B.LT);
check('build: LT goes back', (await g(() => window.game.build.tab)) === 'build');
const rot0 = await g(() => window.game.build.rot);
await g(() => { const gm = window.game; gm.build.cx = 70; gm.build.cy = 100; }); // open ground
await press(B.Y);
check('build: Y turns the building', (await g(() => window.game.build.rot)) !== rot0);
await shot('build');
await press(B.B);
check('build: B is done', (await g(() => window.game.mode)) === 'play');

// ---- The day's summary ----
await g(() => window.game.endDay());
const day0 = await g(() => window.game.day.day);
await wait(900);
await press(B.A);
await wait(600);
check('summary: A starts the next day', (await g(() => [window.game.mode, window.game.day.day]))[1] === day0 + 1);

// ---- Back to the title: JOIN A FRIEND's code, and MOVE A RANCH ----
await g(() => window.game.quitToTitle());
await page.waitForFunction(() => window.game.mode === 'title' && window.game.demo, null, { timeout: 5000 });
await wait(200);
// CONTINUE, NEW RANCH, JOIN A FRIEND, MOVE A RANCH
await press(B.DOWN);
await press(B.DOWN);
await press(B.A);
check('title: JOIN A FRIEND', (await g(() => window.game.mode)) === 'coop');
await wait(150);
check('join: the code field takes the pad', await g(async () => (await import('/src/ui/textfield.ts')).isTyping()));
for (const b of [B.UP, B.UP, B.RIGHT, B.DOWN, B.DOWN]) await press(b); // A, B, BA, B(space), BZ
const typed = await g(() => document.activeElement?.value ?? '');
check('join: up/right/down type a code', typed === 'BZ', typed);
await shot('join');
await press(B.B); // B leaves the join screen, typing or not
check('join: B goes back to the title', (await g(() => window.game.mode)) === 'title');
await press(B.DOWN);
await press(B.A);
check('title: MOVE A RANCH', (await g(() => window.game.mode)) === 'transfer');
await shot('move');
await press(B.B);
check('move: B goes back', (await g(() => window.game.mode)) === 'title');

// ---- The keyboard takes over again ----
await page.keyboard.press('ArrowDown');
await wait(50);
check('a key press switches the prompts back', !(await g(() => window.game.input.padMode)));

if (errors.length) console.log('ERRORS', errors);
console.log(failed || errors.length ? `${failed} failed` : 'all passed');
await browser.close();
await server.close();
process.exit(failed || errors.length ? 1 : 0);
