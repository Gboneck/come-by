import { C } from '../palette';
import { BAYER4, rect, ring } from '../gfx/draw';
import { heading, headingWidth, text, textWidth } from '../gfx/font';
import { drawSpr } from '../gfx/sprite';
import { makeCanvas } from '../gfx/screen';
import type { Game } from '../game';
import { WORLD_H, WORLD_W } from '../world/map';
import { tierOf } from '../systems/progression';
import { calendar } from '../systems/season';
import { playerDogSprites } from '../art/dogstyle';
import { panel } from './frame';
import { safeArea } from './safe';
import { clamp } from '../util';

// Photo mode (pause menu, TAKE A PHOTO): the HUD goes, the camera can be
// moved to frame the shot, and the frame is a postcard: a wool border, the
// ranch's name and the date along the bottom, a stamp with the dog on it and
// a postmark. SNAP saves the card as a crisp PNG (the share sheet on a
// phone, a download elsewhere). The world keeps still unless friends are
// here, as in the pause menu.

const st = {
  from: 'pause' as Game['mode'],
  snap: false,
  flash: 0,
  toast: '',
  toastT: 0,
  drag: null as { id: number; x: number; y: number } | null,
};

export function openPhoto(game: Game) {
  st.from = game.mode === 'pause' ? 'play' : game.mode;
  st.snap = false;
  st.flash = 0;
  st.toastT = 0;
  game.mode = 'photo';
  game.input.clearQueue();
}

function close(game: Game) {
  game.mode = st.from === 'photo' ? 'play' : st.from;
  game.input.clearQueue();
}

export function photoKeys(game: Game, dt: number) {
  const inp = game.input;
  if (inp.pressed('cancel') || inp.pressed('pause')) return close(game);
  if (inp.pressed('confirm') || inp.pressed('bark')) st.snap = true;
  // Pan: held keys, the pad's stick, taps on the d-pad as nudges.
  const sp = 110 * dt;
  let dx = 0, dy = 0;
  if (inp.key('KeyA', 'ArrowLeft')) dx -= sp;
  if (inp.key('KeyD', 'ArrowRight')) dx += sp;
  if (inp.key('KeyW', 'ArrowUp')) dy -= sp;
  if (inp.key('KeyS', 'ArrowDown')) dy += sp;
  if (inp.pad.connected) {
    dx += inp.pad.lx * sp;
    dy += inp.pad.ly * sp;
  }
  for (const [a, x, y] of [['left', -8, 0], ['right', 8, 0], ['up', 0, -8], ['down', 0, 8]] as const) if (inp.pressed(a)) { dx += x; dy += y; }
  pan(game, dx, dy);
  st.flash = Math.max(0, st.flash - dt);
  st.toastT = Math.max(0, st.toastT - dt);
}

function pan(game: Game, dx: number, dy: number) {
  const { W, H } = game.screen;
  game.cam.x = clamp(game.cam.x + dx, W / 2, WORLD_W - W / 2);
  game.cam.y = clamp(game.cam.y + dy, H / 2, WORLD_H - H / 2);
}

// The card's frame, over the world as it is drawn.
function postcard(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const b = 6, foot = 16;
  // Wool border, a plum keyline inside it.
  rect(g, 0, 0, W, b, C.wool);
  rect(g, 0, H - foot, W, foot, C.wool);
  rect(g, 0, 0, b, H, C.wool);
  rect(g, W - b, 0, b, H, C.wool);
  rect(g, b - 1, b - 1, W - b * 2 + 2, 1, C.plum);
  rect(g, b - 1, H - foot, W - b * 2 + 2, 1, C.plum);
  rect(g, b - 1, b - 1, 1, H - b - foot + 2, C.plum);
  rect(g, W - b, b - 1, 1, H - b - foot + 2, C.plum);
  // Photo corners: little sage triangles holding the picture.
  for (const [cx, cy, sx, sy] of [[b, b, 1, 1], [W - b - 1, b, -1, 1], [b, H - foot - 1, 1, -1], [W - b - 1, H - foot - 1, -1, -1]])
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5 - i; j++) rect(g, cx + sx * i, cy + sy * j, 1, 1, C.sage);
  // Along the foot: the ranch's name and the date.
  const name = game.look.ranch || tierOf(game.tier).name;
  const cal = calendar(game.day.day);
  const when = `DAY ${game.day.day}, ${cal.season.toUpperCase()}`;
  const fy = H - foot + 5;
  if (headingWidth(name) + textWidth(when) + 30 < W) {
    heading(g, name, b + 2, fy - 1, C.plum, { shade: C.teal });
    text(g, when, W - b - 2, fy + 1, C.teal, { align: 'right' });
  } else text(g, name, W / 2, fy, C.plum, { align: 'center' });
  // The stamp, top right: the dog itself, on teal, with a perforated edge.
  const sw = 17, sh = 19, sx = W - b - sw - 3, sy = b + 3;
  rect(g, sx, sy, sw, sh, C.wool);
  for (let i = 0; i < sw; i += 2) { rect(g, sx + i, sy - 1, 1, 1, C.wool); rect(g, sx + i, sy + sh, 1, 1, C.wool); }
  for (let j = 0; j < sh; j += 2) { rect(g, sx - 1, sy + j, 1, 1, C.wool); rect(g, sx + sw, sy + j, 1, 1, C.wool); }
  rect(g, sx + 2, sy + 2, sw - 4, sh - 4, C.teal);
  rect(g, sx + 2, sy + sh - 6, sw - 4, 4, C.moss);
  const dog = playerDogSprites().poses.down.stand;
  drawSpr(g, dog, sx + Math.floor(sw / 2), sy + sh - 4);
  // The postmark, overlapping the stamp: a ring and wavy lines.
  const pmx = sx - 6, pmy = sy + 12;
  ring(g, pmx, pmy, 8, C.plum, 5);
  text(g, 'COME', pmx, pmy - 5, C.plum, { align: 'center' });
  text(g, 'BY', pmx, pmy + 1, C.plum, { align: 'center' });
  for (let i = 0; i < 18; i++) if ((i & 3) !== 3) rect(g, pmx - 26 + i, pmy - 3 + (Math.floor(i / 3) % 2), 1, 1, C.plum);
}

// Draws the photo mode over the world; returns nothing (keys and taps act).
export function drawPhoto(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  postcard(game, g, W, H);
  if (st.snap) {
    // The card exactly as it is now, before any button is drawn on it.
    st.snap = false;
    save(game, g.canvas, W, H);
    st.flash = 0.18;
  }
  // The shutter: a quick wool flash, dithered.
  if (st.flash > 0) {
    g.fillStyle = C.wool;
    const lv = (st.flash / 0.18) * 12;
    for (let y = 0; y < H; y += 1)
      for (let x = (y & 1); x < W; x += 2) if (BAYER4[((y & 3) << 2) | (x & 3)] < lv) g.fillRect(x, y, 1, 1);
  }
  // Buttons (not in the photo): BACK and SNAP, over the foot.
  const ui = game.ui;
  const touch = game.input.touchMode;
  const S = safeArea(game.screen);
  const bh = touch ? 15 : 12, bw = touch ? 52 : 46;
  const by = H - S.bottom - bh - 22;
  const bx2 = Math.round(W / 2 + 4), bx1 = Math.round(W / 2 - bw - 4);
  panel(g, bx1, by, bw, bh, ui.isActive('ph-back') ? C.teal : C.plum, C.sage);
  text(g, 'BACK', bx1 + bw / 2, by + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
  panel(g, bx2, by, bw, bh, ui.isActive('ph-snap') ? C.teal : C.plum, C.butter);
  text(g, 'SNAP', bx2 + bw / 2, by + Math.floor((bh - 5) / 2), C.butter, { align: 'center' });
  if (ui.click('ph-back', bx1 - 2, by - 2, bw + 4, bh + 4)) close(game);
  if (ui.click('ph-snap', bx2 - 2, by - 2, bw + 4, bh + 4)) st.snap = true;
  if (!touch) text(g, 'ARROWS: FRAME  SPACE: SNAP  ESC: BACK', W / 2, by - 9, C.wool, { align: 'center', shadow: C.plum });
  else text(g, 'DRAG TO FRAME THE SHOT', W / 2, by - 9, C.wool, { align: 'center', shadow: C.plum });
  if (st.toastT > 0) {
    const tw = textWidth(st.toast) + 10;
    panel(g, Math.round(W / 2 - tw / 2), S.top + 24, tw, 11, C.plum, C.butter);
    text(g, st.toast, W / 2, S.top + 27, C.butter, { align: 'center' });
  }
  // Dragging the picture moves the camera (touch or mouse).
  for (const p of game.input.ptrs.values()) {
    if (p.justDown && !p.owner) {
      p.owner = 'ph-drag';
      st.drag = { id: p.id, x: p.x, y: p.y };
    }
    if (p.owner === 'ph-drag' && st.drag?.id === p.id) {
      pan(game, st.drag.x - p.x, st.drag.y - p.y);
      st.drag.x = p.x;
      st.drag.y = p.y;
      if (p.justUp) st.drag = null;
    }
  }
}

function toast(s: string) {
  st.toast = s;
  st.toastT = 2.2;
}

// Scale the card up by a whole number (crisp, for sharing) and hand it on.
function save(game: Game, src: HTMLCanvasElement, W: number, H: number) {
  game.audio?.play('click');
  const name = `come-by-${(game.look.ranch || 'ranch').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-day-${game.day.day}.png`;
  sharePng(src, name, { touch: game.input.touchMode, w: W, h: H, text: `${game.look.name} on ${game.look.ranch || 'the ranch'}` })
    .then((r) => { if (r !== 'cancelled') toast(r === 'shared' ? 'SHARED!' : r === 'saved' ? 'PHOTO SAVED' : 'COULD NOT SAVE THE PHOTO'); });
}

// Any canvas as a PNG, scaled up by a whole number to about 1200px on its
// long side: the share sheet on a phone (when it takes files), a download
// elsewhere. (w, h) is the part of `src` to take from its top-left (all of
// it by default). Call it straight from the tap or key press: the share
// sheet only opens while the press still counts as the player's. Closing
// the share sheet is 'cancelled' (nothing is downloaded then).
export type ShareResult = 'shared' | 'saved' | 'cancelled' | 'failed';
export function sharePng(src: HTMLCanvasElement, name: string, o: { touch: boolean; w?: number; h?: number; title?: string; text?: string }): Promise<ShareResult> {
  const W = o.w ?? src.width, H = o.h ?? src.height;
  const k = Math.max(2, Math.round(1200 / Math.max(W, H)));
  const [c, cg] = makeCanvas(W * k, H * k);
  cg.imageSmoothingEnabled = false;
  cg.drawImage(src, 0, 0, W, H, 0, 0, W * k, H * k);
  // A data URL turned into a file at once, so nothing waits on a callback.
  let file: File;
  try {
    const url = c.toDataURL('image/png');
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    file = new File([bytes], name, { type: 'image/png' });
  } catch {
    return Promise.resolve('failed');
  }
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (o.touch && nav.share && nav.canShare?.({ files: [file] }))
    return nav.share({ files: [file], title: o.title ?? 'Come By', text: o.text })
      .then((): ShareResult => 'shared')
      .catch((e: unknown): ShareResult => (e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : download(file, name)));
  return Promise.resolve(download(file, name));
}

function download(file: File, name: string): 'saved' | 'failed' {
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
