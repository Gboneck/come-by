import { Screen } from './gfx/screen';
import { Input } from './input';
import { Game } from './game';
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
  const game = new Game(screen, input);
  if (params.has('debug')) installDebug(game);

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
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
