import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import { playerDogSprites } from '../art/dogstyle';
import type { Game } from '../game';
import { saveInfo } from '../systems/save';
import { tierOf } from '../systems/progression';
import { canVibrate, saveSettings, settings } from './settings';
import { dimView } from './feel';
import { safeArea } from './safe';
import { coopLeave, coopRowLabel, openCoop } from './coop';


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

export type TitleAction = 'continue' | 'new' | 'join' | null;

const titleItems = (hasSave: boolean): Exclude<TitleAction, null>[] => (hasSave ? ['continue', 'new', 'join'] : ['new', 'join']);

export function drawTitle(game: Game, g: CanvasRenderingContext2D, W: number, H: number, m: MenuState): TitleAction {
  // The saved dog, dressed as the player left it (the demo game read it).
  const dogSpr = playerDogSprites(game.look.dog);
  const ui = game.ui;
  const info = saveInfo();
  const items: { id: TitleAction; label: string }[] = [];
  if (info) items.push({ id: 'continue', label: `CONTINUE  DAY ${info.day}  ${tierOf(info.tier).name}` });
  items.push({ id: 'new', label: info ? 'NEW RANCH' : 'START' });
  items.push({ id: 'join', label: 'JOIN A FRIEND' });

  const S = safeArea(game.screen);
  const touch = game.input.touchMode;
  const scale = W >= 300 ? 6 : 5;
  const ly = Math.round(S.top + (H - S.top) * 0.16);
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
    const bw = 50, bh = touch ? 14 : 11;
    for (const [i, label] of ['YES', 'NO'].entries()) {
      const bx = Math.round(W / 2 + (i ? 4 : -bw - 4)), by = my + 22;
      if (ui.hovering(bx, by, bw, bh)) m.sel = i;
      const on = m.sel === i;
      panel(g, bx, by, bw, bh, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, label, bx + bw / 2, by + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
      if (ui.click(`confirm-${i}`, bx - 2, by - 3, bw + 4, bh + 6)) {
        if (i === 0) result = 'new';
        else m.confirmNew = false;
      }
    }
  } else {
    const bh = touch ? 16 : 12, step = bh + (touch ? 5 : 3);
    items.forEach((it, i) => {
      const w = Math.max(touch ? 110 : 90, textWidth(it.label) + 16);
      const x = Math.round(W / 2 - w / 2), y = my + i * step;
      if (ui.hovering(x, y, w, bh)) m.sel = i;
      const on = m.sel === i;
      const pulse = on && Math.floor(game.t * 2.5) % 2 === 0;
      panel(g, x, y, w, bh, on ? C.teal : C.plum, on ? C.butter : C.sage);
      text(g, it.label, W / 2, y + Math.floor((bh - 5) / 2), pulse ? C.butter : C.wool, { align: 'center' });
      if (ui.click(`menu-${i}`, x, y - 2, w, bh + 4)) {
        m.sel = i;
        result = it.id === 'new' && info ? null : it.id;
        if (it.id === 'new' && info) { m.confirmNew = true; m.sel = 1; }
      }
    });
  }

  // Controls.
  const lines = game.input.touchMode
    ? ['DRAG TO MOVE. PUSH PAST THE RING TO RUN', 'BARK  NIP  HOLD DOWN TO LIE DOWN', 'CALM DRIVES PAY BEST']
    : ['WASD MOVE  SHIFT RUN  SPACE BARK  E NIP', 'HOLD Q LIE DOWN  B BUILD  TAB LEDGER', 'H HELPERS  ESC PAUSE  M SOUND'];
  const cy = H - 8 - S.bottom - lines.length * 7;
  rect(g, 0, cy - 5, W, H - cy + 5, C.plum);
  lines.forEach((l, i) => text(g, l, W / 2, cy + i * 7, i === lines.length - 1 && game.input.touchMode ? C.butter : C.wool, { align: 'center' }));
  return result;
}

// Keyboard handling for the title menu.
export function titleKeys(game: Game, m: MenuState): TitleAction {
  const info = saveInfo();
  const items = titleItems(!!info);
  const n = m.confirmNew ? 2 : items.length;
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
    const id = items[m.sel] ?? 'new';
    if (id !== 'new') return id;
    if (info) { m.confirmNew = true; m.sel = 1; return null; }
    return 'new';
  }
  return null;
}

// ---- Pause menu ----
//
// A list of rows. A row is a button (RESUME), a toggle or a choice (its act
// flips or cycles it), or a level such as a volume (give it `level`, 0..1
// in `steps` steps; left/right and the < > ends of the row step it).
// To add a setting, add a row here: nothing else needs to change.
export interface PauseItem {
  id: string;
  label: (game: Game) => string;
  // dir: 0 = click or confirm, -1 / +1 = left / right (or the < > ends).
  act: (game: Game, dir: -1 | 0 | 1) => void;
  level?: (game: Game) => number;
  steps?: number;
  show?: (game: Game) => boolean;
}

const onOff = (b: boolean) => (b ? 'ON' : 'OFF');
const toggle = (key: 'shake' | 'haptics') => () => {
  settings[key] = !settings[key];
  saveSettings();
};

export const PAUSE_ITEMS: PauseItem[] = [
  { id: 'resume', label: () => 'RESUME', act: (g, dir) => { if (dir === 0) g.mode = 'play'; } },
  { id: 'mute', label: (g) => `MUTE: ${onOff(!!g.audio?.muted)}`, act: (g) => g.audio?.setMuted(!g.audio.muted) },
  { id: 'shake', label: () => `SCREEN SHAKE: ${onOff(settings.shake)}`, act: toggle('shake') },
  {
    id: 'zones',
    label: () => `FLIGHT ZONES: ${settings.zones === 'always' ? 'ALWAYS' : 'LYING DOWN'}`,
    act: () => {
      settings.zones = settings.zones === 'always' ? 'lying' : 'always';
      saveSettings();
    },
  },
  { id: 'haptics', label: () => `VIBRATION: ${onOff(settings.haptics)}`, act: toggle('haptics'), show: (g) => g.input.touchMode && canVibrate },
  // Volumes, 0-10: left/right or the < > ends step them, confirm steps round.
  { id: 'music', label: () => 'MUSIC', act: (g, dir) => g.audio?.stepMusic(dir), level: (g) => g.audio?.musicVol ?? 0, steps: 10, show: (g) => !!g.audio },
  { id: 'sfx', label: () => 'SOUND', act: (g, dir) => g.audio?.stepSound(dir), level: (g) => g.audio?.soundVol ?? 0, steps: 10, show: (g) => !!g.audio },
  { id: 'dog', label: (g) => `${g.look.name}'S LOOK`, act: (g, dir) => { if (dir === 0) g.openLook('pause'); }, show: (g) => g.net?.role !== 'guest' },
  // Co-op: invite a friend (or see who is here), or leave a friend's ranch.
  { id: 'coop', label: (g) => coopRowLabel(g), act: (g, dir) => { if (dir === 0) openCoop(g, 'invite'); }, show: (g) => g.net?.role !== 'guest' },
  { id: 'leave', label: (g) => coopRowLabel(g), act: (g, dir) => { if (dir === 0) coopLeave(g); }, show: (g) => g.net?.role === 'guest' },
  // Keep this last (savetest presses Up from RESUME to reach it).
  { id: 'quit', label: () => 'SAVE AND QUIT', act: (g, dir) => { if (dir === 0) g.quitToTitle(); }, show: (g) => g.net?.role !== 'guest' },
];

function pauseRows(game: Game) {
  return PAUSE_ITEMS.filter((it) => !it.show || it.show(game));
}

// Keyboard handling for the pause menu.
export function pauseKeys(game: Game) {
  const inp = game.input;
  const rows = pauseRows(game);
  const n = rows.length;
  game.pauseSel = Math.min(game.pauseSel, n - 1);
  if (inp.pressed('up')) game.pauseSel = (game.pauseSel + n - 1) % n;
  if (inp.pressed('down')) game.pauseSel = (game.pauseSel + 1) % n;
  const it = rows[game.pauseSel];
  if (inp.pressed('pause') || inp.pressed('cancel')) game.mode = 'play';
  else if (inp.pressed('confirm')) it.act(game, 0);
  else if (inp.pressed('left')) it.act(game, -1);
  else if (inp.pressed('right')) it.act(game, 1);
}

export function drawPause(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const ui = game.ui;
  const touch = game.input.touchMode;
  const rows = pauseRows(game);
  const rh = touch ? 15 : 12, gap = touch ? 4 : 3;
  const pw = Math.min(W - 16, 150), ph = 36 + rows.length * (rh + gap);
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
  dimView(g, game.view());
  panel(g, x0, y0, pw, ph);
  text(g, 'PAUSED', W / 2, y0 + 6, C.butter, { align: 'center' });
  text(g, `DAY ${game.day.day}  ${tierOf(game.tier).name}`, W / 2, y0 + 14, C.sage, { align: 'center' });
  rows.forEach((it, i) => {
    const y = y0 + 24 + i * (rh + gap);
    const bx = x0 + 8, bw = pw - 16;
    if (ui.hovering(bx, y, bw, rh)) game.pauseSel = i;
    const on = game.pauseSel === i;
    panel(g, bx, y, bw, rh, on || ui.isActive(`pause-${it.id}`) ? C.teal : C.plum, on ? C.butter : C.sage);
    const ty = y + Math.floor((rh - 5) / 2);
    if (it.level) {
      // Label on the left, pips on the right, < > to step.
      const steps = it.steps ?? 5, lit = Math.round(it.level(game) * steps);
      text(g, it.label(game), bx + 10, ty, C.wool);
      for (let k = 0; k < steps; k++) rect(g, bx + bw - 14 - (steps - k) * 5, ty, 4, 5, k < lit ? C.butter : C.sage);
      text(g, '<', bx + 4, ty, on ? C.butter : C.sage);
      text(g, '>', bx + bw - 7, ty, on ? C.butter : C.sage);
      if (ui.click(`pause-${it.id}-l`, bx - 4, y - 2, bw / 2 + 4, rh + 4)) { game.pauseSel = i; it.act(game, -1); }
      if (ui.click(`pause-${it.id}-r`, bx + bw / 2, y - 2, bw / 2 + 4, rh + 4)) { game.pauseSel = i; it.act(game, 1); }
    } else {
      text(g, it.label(game), W / 2, ty, C.wool, { align: 'center' });
      if (ui.click(`pause-${it.id}`, bx - 4, y - Math.floor(gap / 2), bw + 8, rh + gap)) { game.pauseSel = i; it.act(game, 0); }
    }
  });
  if (!touch) text(g, 'ESC: RESUME', W / 2, y0 + ph + 4, C.wool, { align: 'center', shadow: C.plum });
}
