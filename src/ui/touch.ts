import { C } from '../palette';
import { disc, ring } from '../gfx/draw';
import { text } from '../gfx/font';
import type { Input } from '../input';
import type { UI } from './ui';

export interface TouchLayout {
  bark: { x: number; y: number; r: number };
  nip: { x: number; y: number; r: number };
  lie: { x: number; y: number; r: number };
  stickHome: { x: number; y: number };
}

export function touchLayout(W: number, H: number): TouchLayout {
  const portrait = H > W;
  const by = H - (portrait ? 38 : 30);
  return {
    bark: { x: W - 26, y: by, r: 15 },
    nip: { x: W - 62, y: by + 14, r: 11 },
    lie: { x: W - 58, y: by - 22, r: 11 },
    stickHome: { x: 34, y: by },
  };
}

function roundButton(g: CanvasRenderingContext2D, x: number, y: number, r: number, label: string, active: boolean) {
  disc(g, x, y + 1, r, C.sage);
  disc(g, x, y, r, active ? C.teal : C.plum);
  ring(g, x, y, r, active ? C.butter : C.sage);
  text(g, label, x + 1, y - 2, active ? C.butter : C.wool, { align: 'center' });
}

// On-screen controls for phones. Buttons push the same actions as keys.
export function drawTouchControls(g: CanvasRenderingContext2D, ui: UI, input: Input, W: number, H: number) {
  if (!input.touchMode) return;
  const L = touchLayout(W, H);
  const hit = (b: { x: number; y: number; r: number }) => [b.x - b.r - 3, b.y - b.r - 3, b.r * 2 + 6, b.r * 2 + 6] as const;

  if (ui.press('bark', ...hit(L.bark))) input.push('bark');
  if (ui.press('nip', ...hit(L.nip))) input.push('nip');
  if (ui.hold('lie', ...hit(L.lie))) input.uiHeld.add('lie');

  roundButton(g, L.bark.x, L.bark.y, L.bark.r, 'BARK', ui.isActive('bark'));
  roundButton(g, L.nip.x, L.nip.y, L.nip.r, 'NIP', ui.isActive('nip'));
  roundButton(g, L.lie.x, L.lie.y, L.lie.r, 'DOWN', input.lie);

  const st = input.stick;
  if (st.active) {
    ring(g, st.ox, st.oy, input.stickRadius, C.wool, 4);
    const sprint = Math.hypot(st.x, st.y) > 0.94;
    disc(g, st.ox + st.x * input.stickRadius, st.oy + st.y * input.stickRadius, 6, sprint ? C.butter : C.wool);
  } else {
    ring(g, L.stickHome.x, L.stickHome.y, input.stickRadius, C.sage, 4);
    disc(g, L.stickHome.x, L.stickHome.y, 3, C.sage);
  }
}
