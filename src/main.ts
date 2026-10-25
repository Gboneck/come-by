import { Screen } from './gfx/screen';
import { Input } from './input';
import { Game } from './game';
import { Sound } from './systems/audio';
import { clearSave, loadInto, saveGame } from './systems/save';
import { installDebug, drawSpriteSheet } from './debug';
import { joining } from './net/guest';
import { mergeTravels } from './net/travels';
import { openCoop } from './ui/coop';
import { registerPwa } from './pwa/register';
import { padFrame } from './ui/pad';
import { AutoQuality } from './gfx/quality';
import { settings } from './ui/settings';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const screen = new Screen(canvas);
const input = new Input(screen);
const params = new URLSearchParams(location.search);
registerPwa();

if (params.has('sprites')) {
  const loop = () => {
    drawSpriteSheet(screen.g, screen.W, screen.H, performance.now() / 1000);
    screen.present();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  const sound = new Sound();
  const debug = params.has('debug');
  // The title screen runs the game in attract mode; ?play skips it.
  // A co-op link (?join=CODE) opens the title's JOIN A FRIEND.
  const joinCode = params.get('join');
  const skipTitle = !joinCode && (params.has('play') || (debug && !params.has('title')));
  let game = new Game(screen, input, { demo: !skipTitle, audio: sound });
  if (debug) installDebug(game);
  if (joinCode) openCoop(game, 'join', joinCode);

  const swap = (next: Game) => {
    if (game.net && game.net !== next.net) game.net.close(); // hosting ends with the ranch's game
    game = next;
    if (debug) installDebug(game);
    input.clearQueue();
  };

  window.addEventListener('pagehide', () => saveGame(game));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame(game);
  });

  // A menu (or build mode) that nobody has touched for a while, alone on
  // this ranch: nothing is moving that needs 60 frames a second.
  const QUIET = new Set(['pause', 'ledger', 'look', 'coop', 'summary', 'build', 'transfer']);
  const idle = (now: number) =>
    QUIET.has(game.mode) && !game.demo && !game.net && !game.feel.fading && now - input.active > 1500 && (game.mode !== 'summary' || game.summaryT > 2);

  const auto = new AutoQuality();
  let last = performance.now();
  let tick = 0; // the last animation frame the browser gave us
  let gap = 1000 / 60; // the screen's frame spacing, averaged
  const STEP = 1 / 60;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (tick) gap += (Math.min(100, now - tick) - gap) * 0.05;
    tick = now;
    // A 120Hz screen draws every other frame (60 is plenty for pixel art);
    // a quiet menu draws at 30. A hidden tab gets no frames at all, and the
    // sound suspends itself (systems/audio.ts).
    const minGap = idle(now) ? 1000 / 30 : gap < 10 ? 1000 / 60 : 0;
    if (now - last < minGap - 2) return;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    const t0 = performance.now();
    padFrame(game, dt);
    // Variable frame, fixed-ish substeps so the flock sim stays stable.
    const steps = Math.max(1, Math.ceil(dt / STEP - 0.01));
    if (dt > 0) for (let i = 0; i < steps; i++) game.update(dt / steps);
    input.clearQueue();
    if (game.net?.role === 'host') game.net.frame(now);
    game.render();
    screen.present();
    input.endFrame();
    auto.frame(performance.now() - t0, dt, settings.quality);
    const req = game.request;
    if (req) {
      game.request = null;
      if (req === 'title') swap(new Game(screen, input, { demo: true, audio: sound }));
      else if (req === 'join') {
        if (joining) swap(new Game(screen, input, { audio: sound, guest: joining }));
      } else {
        const next = new Game(screen, input, { audio: sound });
        if (req === 'continue') {
          try {
            loadInto(next);
          } catch (e) {
            // A save that will not load: back to the title, the save kept.
            console.error(e);
            swap(new Game(screen, input, { demo: true, audio: sound }));
            return;
          }
        } else clearSave();
        if (req === 'new') {
          mergeTravels(next); // anything found visiting friends before this ranch
          saveGame(next);
          next.openLook('new'); // name the dog and choose its look first
        }
        swap(next);
      }
    }
  };
  requestAnimationFrame(frame);
}
