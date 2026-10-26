import { C } from '../palette';
import { panel } from './frame';
import { text, textWidth, wrap } from '../gfx/font';
import type { Game } from '../game';
import { pwa, promptInstall } from '../pwa/register';
import { safeArea } from './safe';

// A small "add to home screen" card on the title screen, on phones that are
// not already running the installed app. Chrome offers its own install
// dialog (INSTALL); on an iPhone it says where Safari keeps the option.
// The X puts it away for good.

const KEY = 'comeby-install-hint';

let dismissed = (() => {
  try {
    return localStorage.getItem(KEY) === 'no';
  } catch {
    return false;
  }
})();

function dismiss() {
  dismissed = true;
  try {
    localStorage.setItem(KEY, 'no');
  } catch { /* fine */ }
}

// Where it was last drawn (internal px), for scripts/installtest.mjs.
export const hintAt = { x: 0, y: 0, w: 0, h: 0, close: { x: 0, y: 0 }, install: { x: 0, y: 0 } };

export function installHintShown(game: Game): boolean {
  return !dismissed && !pwa.standalone && !pwa.installed && game.input.touchMode && (!!pwa.offer || pwa.ios);
}

// `top`..`bottom` is the free band between the title menu and the controls
// at the foot of the screen; with no room there it sits above the logo.
export function drawInstallHint(game: Game, g: CanvasRenderingContext2D, W: number, top: number, bottom: number) {
  if (!installHintShown(game)) return;
  const ui = game.ui;
  const S = safeArea(game.screen);
  const pw = Math.min(W - 16 - S.left - S.right, 190);
  const lines = pwa.offer ? ['PLAY IT LIKE AN APP: FULL SCREEN,', 'AND OFFLINE TOO'] : wrap('ADD IT TO YOUR HOME SCREEN: TAP SHARE, THEN ADD TO HOME SCREEN', pw - 26);
  const ph = 8 + lines.length * 7 + (pwa.offer ? 17 : 0);
  let y = Math.round((top + bottom) / 2 - ph / 2);
  if (bottom - top < ph + 6) y = S.top + 4;
  const x = Math.round(W / 2 - pw / 2);
  panel(g, x, y, pw, ph, C.plum, C.butter);
  lines.forEach((l, i) => text(g, l, x + 6, y + 5 + i * 7, i === 0 ? C.butter : C.wool));
  // X: never show it again.
  const cx = x + pw - 12;
  text(g, 'X', cx + 3, y + 5, C.wool);
  Object.assign(hintAt, { x, y, w: pw, h: ph, close: { x: cx + 4, y: y + 7 } });
  if (ui.click('install-x', cx - 3, y - 3, 18, 16)) {
    dismiss();
    return;
  }
  if (pwa.offer) {
    const bw = textWidth('INSTALL') + 16, bx = Math.round(W / 2 - bw / 2), by = y + ph - 16;
    const on = ui.isActive('install-go');
    panel(g, bx, by, bw, 12, on ? C.teal : C.plum, C.butter);
    text(g, 'INSTALL', W / 2, by + 4, C.wool, { align: 'center' });
    hintAt.install = { x: W / 2, y: by + 6 };
    if (ui.click('install-go', bx - 4, by - 3, bw + 8, 17)) void promptInstall();
  }
}
