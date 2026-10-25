import { C } from '../palette';
import { disc, ring } from '../gfx/draw';
import { text } from '../gfx/font';
import type { Game } from '../game';
import { safeArea } from './safe';
import { coachButton } from './coach';

interface Btn { x: number; y: number; r: number }

export interface TouchLayout {
  bark: Btn;
  nip: Btn;
  lie: Btn;
  stickHome: { x: number; y: number };
  top: number; // highest pixel the controls use
}

// Thumb fan in the bottom-right corner: BARK under the resting thumb, NIP
// and DOWN a short reach up and left. Kept clear of the home indicator.
export function touchLayout(game: Game, W: number, H: number): TouchLayout {
  const S = safeArea(game.screen);
  const portrait = H > W;
  const by = H - S.bottom - (portrait ? 34 : 26);
  const rx = W - S.right;
  const bark = { x: rx - 24, y: by, r: 16 };
  const nip = { x: rx - 62, y: by + 12, r: 13 };
  const lie = { x: rx - 55, y: by - 25, r: 13 };
  return { bark, nip, lie, stickHome: { x: S.left + 36, y: by }, top: lie.y - lie.r - 2 };
}

function roundButton(g: CanvasRenderingContext2D, b: Btn, label: string, active: boolean, ready: boolean, pulse: boolean) {
  // Pressed buttons sink a pixel onto their shadow.
  const y = b.y + (active ? 1 : 0);
  if (!active) disc(g, b.x, b.y + 1, b.r, C.sage);
  disc(g, b.x, y, b.r, active ? C.teal : C.plum);
  ring(g, b.x, y, b.r, active || pulse ? C.butter : ready ? C.sage : C.plum);
  if (pulse) ring(g, b.x, y, b.r + 2, C.butter, 4);
  text(g, label, b.x + 1, y - 2, active ? C.butter : ready ? C.wool : C.sage, { align: 'center' });
}

// Dashed arc from 12 o'clock, clockwise, `frac` of the way round.
function arc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, color: string) {
  g.fillStyle = color;
  const n = Math.round(r * 6.3);
  for (let i = 0; i < n; i++) {
    const a = i / n;
    if (a > frac || i % 3 === 2) continue;
    const ang = a * Math.PI * 2 - Math.PI / 2;
    g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1);
  }
}

// On-screen controls for phones. Buttons push the same actions as keys.
export function drawTouchControls(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const input = game.input, ui = game.ui;
  if (!input.touchMode) return;
  const L = touchLayout(game, W, H);
  const btns = [['bark', L.bark], ['nip', L.nip], ['lie', L.lie]] as const;

  // A fresh touch near the cluster goes to the nearest button, so a thumb
  // that lands between them (or a little off) still does something.
  for (const p of input.ptrs.values()) {
    if (!p.justDown || p.owner) continue;
    let best: string | null = null, bd = 1e9;
    for (const [id, b] of btns) {
      const d = Math.hypot(p.downX - b.x, p.downY - b.y) - b.r;
      if (d < 9 && d < bd) { bd = d; best = id; }
    }
    if (!best) continue;
    p.owner = best;
    if (best === 'bark') input.push('bark');
    if (best === 'nip') input.push('nip');
  }
  if (ui.isActive('lie')) input.uiHeld.add('lie');

  const d = game.dog;
  const coach = coachButton(game);
  roundButton(g, L.bark, 'BARK', ui.isActive('bark'), d.barkCd <= 0, coach === 'bark');
  roundButton(g, L.nip, 'NIP', ui.isActive('nip'), d.nipCd <= 0 && !d.lying, coach === 'nip');
  roundButton(g, L.lie, 'DOWN', input.lie, true, coach === 'lie' && !input.lie);

  // The stick: walk inside the inner ring, run past it. The outer ring is
  // the stamina left, so the run gauge sits right under the thumb.
  const st = input.stick;
  const R = input.stickRadius, SR = input.sprintRadius;
  const stam = d.stamina / d.stats.stamina;
  if (st.active) {
    ring(g, st.ox, st.oy, R, C.wool, 4);
    arc(g, st.ox, st.oy, SR, stam, st.sprint ? (d.exhausted ? C.moss : C.butter) : C.sage);
    disc(g, st.ox + st.x * R, st.oy + st.y * R, 6, st.sprint ? C.butter : C.wool);
  } else {
    ring(g, L.stickHome.x, L.stickHome.y, R, C.sage, 4);
    disc(g, L.stickHome.x, L.stickHome.y, 3, C.sage);
    if (stam < 0.99) arc(g, L.stickHome.x, L.stickHome.y, SR, stam, C.sage);
  }
}
