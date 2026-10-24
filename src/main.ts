import { Screen } from './gfx/screen';
import { Input } from './input';
import { Game } from './game';
import { Sound } from './systems/audio';
import { clearSave, loadInto, saveGame } from './systems/save';
import { installDebug, drawSpriteSheet } from './debug';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const screen = new Screen(canvas);
const input = new Input(screen);
const params = new URLSearchParams(location.search);

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
  const skipTitle = params.has('play') || (debug && !params.has('title'));
  let game = new Game(screen, input, { demo: !skipTitle, audio: sound });
  if (debug) installDebug(game);

  const swap = (next: Game) => {
    game = next;
    if (debug) installDebug(game);
    input.clearQueue();
  };

  window.addEventListener('pagehide', () => saveGame(game));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame(game);
  });

  let last = performance.now();
  const STEP = 1 / 60;
  const frame = (now: number) => {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    // Variable frame, fixed-ish substeps so the flock sim stays stable.
    const steps = Math.max(1, Math.ceil(dt / STEP - 0.01));
    if (dt > 0) for (let i = 0; i < steps; i++) game.update(dt / steps);
    input.clearQueue();
    game.render();
    screen.present();
    input.endFrame();
    const req = game.request;
    if (req) {
      game.request = null;
      if (req === 'title') swap(new Game(screen, input, { demo: true, audio: sound }));
      else {
        const next = new Game(screen, input, { audio: sound });
        if (req === 'continue') loadInto(next);
        else clearSave();
        if (req === 'new') saveGame(next);
        swap(next);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
