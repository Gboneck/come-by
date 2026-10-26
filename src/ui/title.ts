import { C } from '../palette';
import { rect } from '../gfx/draw';
import { panel } from './frame';
import { heading, headingWidth, text, textWidth } from '../gfx/font';
import { drawTitleArt } from '../art/title';
import type { Game } from '../game';
import { saveInfo } from '../systems/save';
import { tierOf } from '../systems/progression';
import { canVibrate, saveSettings, settings } from './settings';
import { dimView } from './feel';
import { safeArea } from './safe';
import { coopLeave, coopRowLabel, openCoop } from './coop';
import { drawInstallHint } from './install';
import { openTransfer } from './transfer';
import { openPhoto } from './photo';
import { LEVELS, quality } from '../gfx/quality';
import { pitch } from './metrics';


// The logo in the heading face, scaled up: each letter drops in on its own
// with a little bounce when the title first shows, and every few seconds a
// glint runs along the word.
function logo(g: CanvasRenderingContext2D, s: string, cx: number, y: number, scale: number, t: number) {
  const x0 = Math.round(cx - headingWidth(s, scale) / 2);
  const glint = (t % 5) / 0.7; // 0..1 while it runs
  [...s].forEach((ch, i) => {
    if (ch === ' ') return;
    // Where this letter starts: the width of what comes before it, kerned.
    const lx = x0 + headingWidth(s.slice(0, i + 1), scale) - headingWidth(ch, scale);
    const at = 0.15 + i * 0.09, k = Math.min(1, Math.max(0, (t - at) / 0.35));
    if (k <= 0) return;
    // Ease out with an overshoot: falls, dips below its line, settles.
    const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
    const dy = Math.round((1 - e) * -scale * 6);
    const lit = glint < 1 && Math.floor(glint * (s.length + 2)) - 1 === i;
    heading(g, ch, lx, y + dy, lit ? C.wool : C.butter, { scale, outline: C.plum, shadow: C.plum, shade: lit ? C.butter : C.moss });
  });
}

export interface MenuState {
  sel: number;
  confirmNew: boolean;
}

export type TitleAction = 'continue' | 'new' | 'join' | 'move' | null;

const titleItems = (hasSave: boolean): Exclude<TitleAction, null>[] => (hasSave ? ['continue', 'new', 'join', 'move'] : ['new', 'join', 'move']);

export function drawTitle(game: Game, g: CanvasRenderingContext2D, W: number, H: number, m: MenuState): TitleAction {
  const ui = game.ui;
  const info = saveInfo();
  const items: { id: TitleAction; label: string }[] = [];
  if (info) items.push({ id: 'continue', label: `CONTINUE  DAY ${info.day}  ${tierOf(info.tier).name}` });
  items.push({ id: 'new', label: info ? 'NEW RANCH' : 'START' });
  items.push({ id: 'join', label: 'JOIN A FRIEND' });
  items.push({ id: 'move', label: 'MOVE A RANCH' }); // a save from another device (ui/transfer.ts)

  const S = safeArea(game.screen);
  const touch = game.input.touchMode;
  // The logo as big as fits: the heading face is seven pixels tall.
  let lscale = W >= 300 ? 6 : 5;
  while (lscale > 2 && headingWidth('COME BY', lscale) > W - 16) lscale--;
  const ly = Math.round(S.top + (H - S.top) * 0.14);
  // The illustration along the bottom: the heeler on its knoll, by season.
  const menuEnd = Math.round(H * 0.5) + items.length * (touch ? 21 : 15);
  drawTitleArt(g, W, H, menuEnd + 4, H - S.bottom - 34, game.season.season, game.t);
  logo(g, 'COME BY', W / 2, ly, lscale, game.t);
  const sw = textWidth('A HERDING GAME') + 8;
  const ty = ly + lscale * 7 + 6;
  rect(g, Math.round(W / 2 - sw / 2), ty, sw, 9, C.plum); // reads on snow too
  text(g, 'A HERDING GAME', W / 2, ty + 2, C.wool, { align: 'center', shadow: C.plum });

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
  const cy = H - 8 - S.bottom - lines.length * pitch();
  rect(g, 0, cy - 5, W, H - cy + 5, C.plum);
  lines.forEach((l, i) => text(g, l, W / 2, cy + i * pitch(), i === lines.length - 1 && game.input.touchMode ? C.butter : C.wool, { align: 'center' }));
  if (!m.confirmNew) drawInstallHint(game, g, W, my + items.length * (touch ? 21 : 15), cy - 5);
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
  // AUTO thins the weather and critters when frames run long (gfx/quality.ts).
  {
    id: 'quality',
    label: () => `GRAPHICS: ${settings.quality === 'auto' ? `AUTO (${quality.level.toUpperCase()})` : settings.quality.toUpperCase()}`,
    act: (_g, dir) => {
      const all = ['auto', ...LEVELS] as const;
      settings.quality = all[(all.indexOf(settings.quality) + (dir || 1) + all.length) % all.length];
      saveSettings();
    },
  },
  { id: 'photo', label: () => 'TAKE A PHOTO', act: (g, dir) => { if (dir === 0) openPhoto(g); } },
  // CLOSE (bigger, the default) or WIDE (more field, smaller sprites); text
  // keeps its size either way (gfx/font.ts).
  {
    id: 'view',
    label: () => `VIEW: ${settings.view === 'wide' ? 'WIDE' : 'CLOSE'}`,
    act: (g) => {
      settings.view = settings.view === 'wide' ? 'close' : 'wide';
      saveSettings();
      g.screen.setView(settings.view);
    },
  },
  { id: 'dog', label: (g) => `${g.look.name}'S LOOK`, act: (g, dir) => { if (dir === 0) g.openLook('pause'); }, show: (g) => g.net?.role !== 'guest' },
  // Co-op: invite a friend (or see who is here), or leave a friend's ranch.
  { id: 'coop', label: (g) => coopRowLabel(g), act: (g, dir) => { if (dir === 0) openCoop(g, 'invite'); }, show: (g) => g.net?.role !== 'guest' },
  { id: 'leave', label: (g) => coopRowLabel(g), act: (g, dir) => { if (dir === 0) coopLeave(g); }, show: (g) => g.net?.role === 'guest' },
  { id: 'move', label: () => 'MOVE THIS RANCH', act: (g, dir) => { if (dir === 0) openTransfer(g); }, show: (g) => g.net?.role !== 'guest' },
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
  let rh = touch ? 15 : 12, gap = touch ? 4 : 3;
  // A phone on its side is short: tighter rows, so every one fits.
  while (36 + rows.length * (rh + gap) > H - 8 && rh > 11) {
    if (gap > 2) gap--;
    else rh--;
  }
  const pw = Math.min(W - 16, 150), ph = 36 + rows.length * (rh + gap);
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2);
  dimView(g, game.view());
  panel(g, x0, y0, pw, ph);
  heading(g, 'PAUSED', W / 2, y0 + 4, C.butter, { align: 'center', shade: C.moss });
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
