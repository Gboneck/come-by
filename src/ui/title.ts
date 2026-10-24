import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import { makeDogSprites } from '../art/dog';
import type { Game } from '../game';
import { saveInfo } from '../systems/save';
import { tierOf } from '../systems/progression';

let dogSpr: ReturnType<typeof makeDogSprites> | null = null;

// Big chunky letters: the 3x5 font scaled up, with a plum outline.
function logo(g: CanvasRenderingContext2D, s: string, cx: number, y: number, scale: number) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
    text(g, s, cx + dx * Math.max(1, scale / 3), y + dy * Math.max(1, scale / 3), C.plum, { align: 'center', scale });
  text(g, s, cx, y + scale, C.plum, { align: 'center', scale });
  text(g, s, cx, y, C.butter, { align: 'center', scale });
}

export interface MenuState {
  sel: number;
  confirmNew: boolean;
}

export type TitleAction = 'continue' | 'new' | null;

export function drawTitle(game: Game, g: CanvasRenderingContext2D, W: number, H: number, m: MenuState): TitleAction {
  dogSpr ??= makeDogSprites('r');
  const ui = game.ui;
  const info = saveInfo();
  const items: { id: TitleAction; label: string }[] = [];
  if (info) items.push({ id: 'continue', label: `CONTINUE  DAY ${info.day}  ${tierOf(info.tier).name}` });
  items.push({ id: 'new', label: info ? 'NEW RANCH' : 'START' });

  const scale = W >= 300 ? 6 : 5;
  const ly = Math.round(H * 0.16);
  logo(g, 'COME BY', W / 2, ly, scale);
  text(g, 'A HERDING GAME', W / 2, ly + scale * 5 + 8, C.wool, { align: 'center', shadow: C.plum });
  // The heeler, trotting beside the title.
  const run = dogSpr.side;
  const f = Math.floor(game.t * 8) % run.length;
  const lw = textWidth('COME BY', scale);
  const sp = run[f];
  const dx = Math.round(W / 2 + lw / 2 + 6), dy = Math.round(ly + scale * 5 - sp.h * 2 + 2);
  if (dx + sp.w * 2 < W - 2) g.drawImage(sp.img, dx, dy, sp.w * 2, sp.h * 2);
  else drawSpr(g, sp, W / 2, ly - 4);

  // Menu.
  let result: TitleAction = null;
  const my = Math.round(H * 0.5);
  if (m.confirmNew) {
    const pw = Math.min(W - 16, 170);
    panel(g, W / 2 - pw / 2, my - 4, pw, 42);
    text(g, 'START OVER?', W / 2, my + 2, C.butter, { align: 'center' });
    text(g, 'YOUR RANCH WILL BE LOST', W / 2, my + 10, C.wool, { align: 'center' });
    const bw = 50;
    for (const [i, label] of ['YES', 'NO'].entries()) {
      const bx = Math.round(W / 2 + (i ? 4 : -bw - 4)), by = my + 22;
      const on = m.sel === i;
      panel(g, bx, by, bw, 11, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, label, bx + bw / 2, by + 3, C.wool, { align: 'center' });
      if (ui.click(`confirm-${i}`, bx, by, bw, 11)) {
        if (i === 0) result = 'new';
        else m.confirmNew = false;
      }
    }
  } else {
    items.forEach((it, i) => {
      const w = Math.max(90, textWidth(it.label) + 16);
      const x = Math.round(W / 2 - w / 2), y = my + i * 15;
      const on = m.sel === i;
      const pulse = on && Math.floor(game.t * 2.5) % 2 === 0;
      panel(g, x, y, w, 12, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, it.label, W / 2, y + 4, pulse ? C.butter : C.wool, { align: 'center' });
      if (ui.click(`menu-${i}`, x, y, w, 12)) {
        m.sel = i;
        result = it.id === 'new' && info ? null : it.id;
        if (it.id === 'new' && info) { m.confirmNew = true; m.sel = 1; }
      }
    });
  }

  // Controls.
  const lines = game.input.touchMode
    ? ['LEFT THUMB: MOVE, PUSH TO THE RIM TO RUN', 'BARK  NIP  HOLD DOWN TO LIE DOWN', 'CALM DRIVES PAY BEST']
    : ['WASD MOVE  SHIFT RUN  SPACE BARK  E NIP', 'HOLD Q LIE DOWN  B BUILD  TAB LEDGER', 'H HELPERS  ESC PAUSE  M SOUND'];
  const cy = H - 8 - lines.length * 7;
  rect(g, 0, cy - 5, W, lines.length * 7 + 13, C.plum);
  lines.forEach((l, i) => text(g, l, W / 2, cy + i * 7, i === lines.length - 1 && game.input.touchMode ? C.butter : C.wool, { align: 'center' }));
  return result;
}

// Keyboard handling for the title menu.
export function titleKeys(game: Game, m: MenuState): TitleAction {
  const info = saveInfo();
  const n = m.confirmNew ? 2 : info ? 2 : 1;
  const inp = game.input;
  if (inp.pressed('up') || inp.pressed('left')) m.sel = (m.sel + n - 1) % n;
  if (inp.pressed('down') || inp.pressed('right')) m.sel = (m.sel + 1) % n;
  if (inp.pressed('cancel') && m.confirmNew) { m.confirmNew = false; m.sel = 1; }
  if (inp.pressed('confirm')) {
    if (m.confirmNew) {
      if (m.sel === 0) return 'new';
      m.confirmNew = false;
      return null;
    }
    if (info && m.sel === 0) return 'continue';
    if (info) { m.confirmNew = true; m.sel = 1; return null; }
    return 'new';
  }
  return null;
}

export function drawPause(game: Game, g: CanvasRenderingContext2D, W: number, H: number, sel: number): 'resume' | 'sound' | 'quit' | null {
  const ui = game.ui;
  const items: ['resume' | 'sound' | 'quit', string][] = [
    ['resume', 'RESUME'],
    ['sound', `SOUND: ${game.audio && 'muted' in game.audio && (game.audio as { muted: boolean }).muted ? 'OFF' : 'ON'}`],
    ['quit', 'SAVE AND QUIT'],
  ];
  const pw = 110, ph = 26 + items.length * 15;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
  panel(g, x0, y0, pw, ph);
  text(g, 'PAUSED', W / 2, y0 + 6, C.butter, { align: 'center' });
  let out: 'resume' | 'sound' | 'quit' | null = null;
  items.forEach(([id, label], i) => {
    const y = y0 + 18 + i * 15;
    const on = sel === i;
    panel(g, x0 + 8, y, pw - 16, 12, on ? C.teal : C.plum, on ? C.butter : C.sage);
    text(g, label, W / 2, y + 4, C.wool, { align: 'center' });
    if (ui.click(`pause-${id}`, x0 + 8, y, pw - 16, 12)) out = id;
  });
  return out;
}
