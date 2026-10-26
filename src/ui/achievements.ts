import { C } from '../palette';
import { panel, px, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { makeCanvas } from '../gfx/screen';
import type { Game } from '../game';
import { ACHIEVEMENTS, achById, isBig, type AchDef } from '../systems/achievements';
import { PTS, buyerDef, buyerLines, maxLevel, titleOf, type BuyerId } from '../systems/favour';
import { BADGE, drawBadge } from '../art/badges';
import { Person, type FolkId } from '../entities/folk';
import { peopleSprites } from '../art/people';
import { playerDogSprites } from '../art/dogstyle';
import type { LedgerInk, LedgerPage } from './ledger';
import { sharePng } from './photo';

// The achievements' screens: two Ledger pages, BUYERS (a favour bar for each
// buyer and what their next level brings) and BADGES (every badge, progress
// on the locked ones, a hint for the secret ones, and a postcard of any won
// badge to share), and the card that drops in when a badge is earned or a
// buyer's favour rises. The pages draw into whatever the Ledger gives them
// (`r`, in its ink), so they read on a dark panel or on the book's paper.

type Rect = { x: number; y: number; w: number; h: number; spine: number };

let toast = '';
let toastT = 0;

function say(s: string) {
  toast = s;
  toastT = 2.2;
}

const PORTRAIT: Partial<Record<BuyerId, Sprite>> = {};
const BIG: Partial<Record<BuyerId, HTMLCanvasElement>> = {};
function portrait(id: BuyerId): Sprite {
  let s = PORTRAIT[id];
  if (!s) {
    const folk = buyerDef(id).folk;
    // The shearer travels: in a sage cap, a teal smock.
    s = folk ? new Person(folk as FolkId, 0, 0).spr.stand.d : peopleSprites({ H: 's', C: 't', L: 'p' }).stand.d;
    PORTRAIT[id] = s;
  }
  return s;
}

function hearts(g: CanvasRenderingContext2D, x: number, y: number, level: number, max: number, on: string, off: string) {
  for (let i = 0; i < max; i++) text(g, '@', x + i * 5, y, i < level ? on : off);
}

// A bar: plum outline, teal filled, sage still to go.
function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, f: number) {
  rect(g, x, y, w, 4, C.plum);
  rect(g, x + 1, y + 1, w - 2, 2, C.sage);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, f)));
  if (fw > 0) rect(g, x + 1, y + 1, fw, 2, C.teal);
}

function button(game: Game, g: CanvasRenderingContext2D, id: string, label: string, x: number, y: number): { w: number; hit: boolean } {
  const touch = game.input.touchMode;
  const w = textWidth(label) + 10, h = touch ? 13 : 11;
  panel(g, x, y, w, h, game.ui.isActive(id) ? C.teal : C.plum, C.butter);
  text(g, label, x + w / 2, y + Math.floor((h - 5) / 2), C.wool, { align: 'center' });
  return { w, hit: game.ui.click(id, x, y, w, h) };
}

// ---- BUYERS ----

const BLOCK = 38;

function drawBuyers(game: Game, g: CanvasRenderingContext2D, r: Rect, ink: LedgerInk) {
  const lines = buyerLines(game);
  const cols = r.spine ? [{ x: r.x, w: r.spine - 6 }, { x: r.x + r.spine + 6, w: r.w - r.spine - 6 }] : [{ x: r.x, w: r.w }];
  const per = Math.ceil(lines.length / cols.length);
  if (game.tier < 2) {
    const c = cols[0];
    wrap('BUYERS START ASKING FOR STOCK AT TIER 2. FILL THEIR ORDERS AND THEY TAKE TO YOU: BETTER PRICES, SPECIAL ORDERS, GIFTS, AND YOUR NAME ON THEIR SIGN.', c.w).forEach((l, i) => text(g, l, c.x, r.y + i * 7, i ? ink.dim : ink.text));
    return;
  }
  lines.forEach((b, i) => {
    const c = cols[Math.floor(i / per)];
    const bx = c.x, by = r.y + (i % per) * BLOCK, cw = c.w;
    const max = maxLevel(b.def.id);
    const top = b.level >= max;
    drawSpr(g, portrait(b.def.id), bx + 4, by + 18);
    // A friend wears a rosette on their coat.
    if (top) px(g, bx + 6, by + 9, C.butter);
    const tx = bx + 12, tw = cw - 12;
    if (!b.met) {
      text(g, b.def.name, tx, by + 1, ink.dim);
      wrap('COMES THE FIRST DAY OF SUMMER, TO SHEAR YOUR SHEEP', tw).forEach((l, k) => text(g, l, tx, by + 9 + k * 7, ink.dim));
      return;
    }
    text(g, b.def.name, tx, by + 1, ink.text);
    text(g, titleOf(b.def.id, b.level), bx + cw, by + 1, top ? ink.accent : ink.dim, { align: 'right' });
    hearts(g, tx, by + 9, b.level, max, ink.accent, ink.dim);
    if (b.need) {
      const label = `${b.have}/${b.need}`;
      const bw = tw - max * 5 - textWidth(label) - 6;
      bar(g, tx + max * 5 + 2, by + 9, bw, b.have / b.need);
      text(g, label, bx + cw, by + 9, ink.dim, { align: 'right' });
    } else text(g, 'A FRIEND!', bx + cw, by + 9, ink.accent, { align: 'right' });
    const nl = wrap(b.next ? `NEXT: ${b.next}` : 'EVERYTHING THEY HAVE TO GIVE', tw).slice(0, 2);
    nl.forEach((l, k) => text(g, l, tx, by + 16 + k * 7, b.next ? ink.accent : ink.dim));
    text(g, `FILLED ${b.filled}${b.pay ? `  PAYS ${b.pay}% OVER` : ''}`, tx, by + 16 + nl.length * 7, ink.dim);
  });
  // How favour is won, under the first column.
  const c = cols[0];
  const fy = r.y + per * BLOCK;
  rect(g, c.x, fy - 2, c.w, 1, ink.dim);
  wrap(`FAVOUR @ +${PTS.fill} AN ORDER, +${PTS.calm} ALL CALM, +${PTS.early} EARLY. A MISSED ORDER COSTS ${-PTS.missed}.`, c.w)
    .slice(0, 3)
    .forEach((l, i) => text(g, l, c.x, fy + 1 + i * 7, ink.dim, { iconColor: ink.accent }));
}

export const BUYERS_PAGE: LedgerPage = { id: 'buyers', tab: 'BUYERS', draw: drawBuyers };

// ---- BADGES ----

const CELL = BADGE + 3;
let cols = 8; // the grid's columns, as last drawn

const stateOf = (game: Game, a: AchDef) => (game.achievements.has(a.id) ? 'got' : a.secret ? 'secret' : 'locked');

// Arrows move along the grid; confirm makes a postcard of a won badge.
function badgeKeys(game: Game): boolean {
  const inp = game.input, A = game.achievements;
  const n = ACHIEVEMENTS.length;
  const move = (d: number) => {
    A.sel = Math.max(0, Math.min(n - 1, A.sel + d));
    game.audio?.play('click', { vol: 0.5 });
  };
  if (inp.pressed('left')) move(-1);
  if (inp.pressed('right')) move(1);
  if (inp.pressed('up') && A.sel - cols >= 0) move(-cols);
  if (inp.pressed('down') && A.sel + cols < n) move(cols);
  if (!inp.pressed('confirm')) return false;
  const a = ACHIEVEMENTS[A.sel];
  if (A.has(a.id)) share(game, a);
  else say('NOT WON YET');
  return true;
}

function drawBadges(game: Game, g: CanvasRenderingContext2D, r: Rect, ink: LedgerInk) {
  const A = game.achievements;
  A.unseen = 0;
  toastT = Math.max(0, toastT - 1 / 60);
  const wide = r.spine > 0;
  const gw = wide ? r.spine - 6 : r.w;
  cols = Math.max(4, Math.floor((gw + 3) / CELL));
  const rows = Math.ceil(ACHIEVEMENTS.length / cols);
  const gx = r.x + Math.floor((gw - (cols * CELL - 3)) / 2), gy = r.y + 1;
  const T = game.t;
  ACHIEVEMENTS.forEach((a, i) => {
    const cx = gx + (i % cols) * CELL, cy = gy + Math.floor(i / cols) * CELL;
    const st = stateOf(game, a);
    drawBadge(g, a.group, a.icon, st, cx, cy, 1, st === 'got' ? (T * 0.4 + i * 0.37) % 4 : -1);
    if (i === A.sel) {
      // Corners round the one picked.
      const b = Math.floor(T * 3) % 2;
      for (const [dx, dy] of [[-2 - b, -2 - b], [BADGE + b - 1, -2 - b], [-2 - b, BADGE + b - 1], [BADGE + b - 1, BADGE + b - 1]]) {
        rect(g, cx + dx, cy + dy, 3, 1, ink.accent);
        rect(g, cx + dx + (dx < 0 ? 0 : 2), cy + dy + (dy < 0 ? 0 : -2), 1, 3, ink.accent);
      }
    }
    if (game.ui.click(`badge-${i}`, cx - 1, cy - 1, CELL, CELL)) {
      if (A.sel === i && A.has(a.id) && game.input.touchMode) share(game, a);
      A.sel = i;
      game.audio?.play('click', { vol: 0.5 });
    }
  });
  const a = ACHIEVEMENTS[A.sel];
  const count = `${A.got.size}/${ACHIEVEMENTS.length}`;
  if (wide) {
    // The one picked, large, on the right-hand page.
    const x = r.x + r.spine + 6, w = r.w - r.spine - 6;
    text(g, count, x + w, r.y, ink.dim, { align: 'right' });
    const k = 3;
    drawBadge(g, a.group, a.icon, stateOf(game, a), Math.round(x + w / 2 - (BADGE * k) / 2), r.y + 4, k, A.has(a.id) ? (T * 0.5) % 2.5 : -1);
    const y = info(game, g, a, x, r.y + 8 + BADGE * k, w, ink);
    shareButton(game, g, a, Math.round(x + w / 2), y + 2, true);
  } else {
    const iy = gy + rows * CELL + 2;
    rect(g, r.x, iy - 2, r.w, 1, ink.dim);
    const k = A.has(a.id) ? 2 : 1;
    drawBadge(g, a.group, a.icon, stateOf(game, a), r.x, iy + 2, k);
    const tx = r.x + BADGE * k + 5;
    text(g, count, r.x + r.w, iy + 2, ink.dim, { align: 'right' });
    const y = info(game, g, a, tx, iy + 2, r.w - (tx - r.x) - textWidth(count) - 3, ink);
    shareButton(game, g, a, r.x + r.w, y + 1, false);
  }
}

// Name, how it is earned (or the hint), and progress or the day it was
// won. Returns the y under it.
function info(game: Game, g: CanvasRenderingContext2D, a: AchDef, x: number, y: number, w: number, ink: LedgerInk): number {
  const A = game.achievements;
  const got = A.has(a.id);
  const secret = !got && !!a.secret;
  text(g, secret ? '? ? ?' : a.name, x, y, got ? ink.accent : ink.text);
  const what = wrap(secret ? a.secret! : a.what, w).slice(0, 3);
  what.forEach((l, i) => text(g, l, x, y + 7 + i * 7, got ? ink.text : ink.dim, { iconColor: ink.accent }));
  let ly = y + 9 + what.length * 7;
  const day = A.got.get(a.id);
  const p = A.progress(game, a);
  if (got) text(g, day ? `EARNED ON DAY ${day}` : 'EARNED BEFORE THE BADGE BOOK', x, ly, ink.dim);
  else if (p && !secret) {
    const bw = Math.min(70, w - 30);
    bar(g, x, ly, bw, p[0] / p[1]);
    text(g, `${p[0]}/${p[1]}`, x + bw + 4, ly, ink.dim);
  } else if (!secret) text(g, 'CAUGHT AS IT HAPPENS', x, ly, ink.dim);
  ly += 7;
  if (toastT > 0) text(g, toast, x, ly, ink.accent);
  return ly;
}

// SHARE under a won badge (centred at x, or right-aligned to it).
function shareButton(game: Game, g: CanvasRenderingContext2D, a: AchDef, x: number, y: number, centred: boolean) {
  if (!game.achievements.has(a.id)) return;
  const label = game.input.touchMode ? 'SHARE' : 'ENTER: SHARE';
  const w = textWidth(label) + 10;
  const b = button(game, g, 'badge-share', label, Math.round(centred ? x - w / 2 : x - w), y + (toastT > 0 ? 7 : 0));
  if (b.hit) share(game, a);
}

export const BADGES_PAGE: LedgerPage = { id: 'badges', tab: 'BADGES', draw: drawBadges, keys: badgeKeys, dot: (g) => g.achievements.unseen > 0 };

// ---- The card that drops in ----
//
// In the tier card's place (a third of the way down the screen), one at a
// time, never over the tier card, the judge's card or a banner: the HUD
// draws it in place of the banner (ui/hud.ts), and it waits its turn.

export const badgeUp = (game: Game) => !!game.achievements.card && !game.feel.tierCard && !game.trials.result && !game.banner;

export function drawBadgeCard(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const A = game.achievements;
  const c = A.card;
  if (!c) return;
  const age = A.cardT;
  const pw = Math.min(W - 12, 150);
  const big = isBig(c);
  // Lay out first (for the height), then draw.
  const lay = c.kind === 'badge' ? badgeLayout(c.id, pw) : c.kind === 'favour' ? favourLayout(c.buyer, c.level, pw) : null;
  const ph = lay ? lay.h : 36;
  const x0 = Math.round(W / 2 - pw / 2);
  const y0 = Math.round(H * 0.24 - ph / 2 + Math.max(0, 1 - age * 5) * -24);
  if (big) panel(g, x0 - 2, y0 - 2, pw + 4, ph + 4, C.teal, C.butter);
  panel(g, x0, y0, pw, ph, C.plum, C.butter);
  if (c.kind === 'badge') badgeCard(game, g, c.id, x0, y0, pw, ph, age);
  else if (c.kind === 'favour') favourCard(game, g, c.buyer, c.level, x0, y0, pw, ph, age);
  else pastCard(game, g, c.n, x0, y0, pw, age);
  // A tap on the card opens the Ledger at it.
  if (game.ui.click('ach-card', x0, y0, pw, ph)) {
    if (c.kind === 'badge') A.sel = Math.max(0, ACHIEVEMENTS.findIndex((a) => a.id === c.id));
    A.dismiss();
    game.openLedger(c.kind === 'favour' ? 'buyers' : 'badges');
  }
}

// The stamp lands at 0.45s: drawn a size up for a few frames, then put.
function stampAt(g: CanvasRenderingContext2D, label: string, x: number, y: number, age: number) {
  if (age < 0.45) return;
  const thump = age < 0.52 ? 1 : 0;
  const w = textWidth(label) + 6 + thump * 2, h = 9 + thump * 2;
  const l = Math.round(x - w / 2), t = Math.round(y - h / 2);
  rect(g, l, t, w, h, C.butter);
  rect(g, l + 1, t + 1, w - 2, h - 2, C.plum);
  rect(g, l + 2, t + 2, w - 4, h - 4, C.butter);
  text(g, label, x, t + 2 + thump, C.plum, { align: 'center' });
}

const BADGE_TX = 4 + BADGE * 2 + 5;

function badgeLayout(id: string, pw: number) {
  const a = achById(id)!;
  const tw = pw - BADGE_TX - 5;
  const name = wrap(a.name, tw), what = wrap(a.what, tw).slice(0, 3);
  return { name, what, h: Math.max(BADGE * 2 + 8, 4 + 7 + name.length * 7 + what.length * 7 + 12) };
}

function badgeCard(game: Game, g: CanvasRenderingContext2D, id: string, x0: number, y0: number, pw: number, ph: number, age: number) {
  const a = achById(id);
  if (!a) return;
  const { name, what } = badgeLayout(id, pw);
  drawBadge(g, a.group, a.icon, 'got', x0 + 4, y0 + 4, 2, Math.min(1, age / 1.2));
  const tx = x0 + BADGE_TX;
  if (age > 0.25 || Math.floor(age * 16) % 2 === 0) text(g, a.big ? 'A BIG ONE!' : 'BADGE EARNED', tx, y0 + 4, C.sage);
  name.forEach((l, i) => text(g, l, tx, y0 + 11 + i * 7, C.butter));
  what.forEach((l, i) => text(g, l, tx, y0 + 11 + name.length * 7 + 1 + i * 7, C.wool, { iconColor: C.butter }));
  stampAt(g, `DAY ${game.achievements.got.get(id) || game.day.day}`, x0 + pw - 20, y0 + ph - 7, age);
}

function favourLayout(buyer: BuyerId, level: number, pw: number) {
  const s = portrait(buyer);
  const tw = pw - (10 + s.w * 2) - 5;
  const step = buyerDef(buyer).steps[level - 1];
  const line = wrap(`"${step.line}"`, tw).slice(0, 4), perk = wrap(step.perk, tw).slice(0, 2);
  return { line, perk, h: Math.max(s.h * 2 + 10, 4 + 14 + line.length * 7 + 1 + perk.length * 7 + (level >= maxLevel(buyer) ? 10 : 2)) };
}

function favourCard(game: Game, g: CanvasRenderingContext2D, buyer: BuyerId, level: number, x0: number, y0: number, pw: number, ph: number, age: number) {
  const def = buyerDef(buyer);
  const max = maxLevel(buyer);
  const s = portrait(buyer);
  const { line, perk } = favourLayout(buyer, level, pw);
  // The buyer, twice the size, on a teal ground.
  panel(g, x0 + 3, y0 + 3, s.w * 2 + 4, ph - 6, C.teal, C.sage);
  let c = BIG[buyer];
  if (!c) {
    const [cv, cg] = makeCanvas(s.w, s.h);
    drawSpr(cg, s, s.ax, s.ay);
    BIG[buyer] = c = cv;
  }
  g.drawImage(c, x0 + 5, y0 + Math.round(ph / 2 - s.h), s.w * 2, s.h * 2);
  const tx = x0 + 10 + s.w * 2;
  text(g, def.name, tx, y0 + 4, C.wool);
  // The hearts fill to the new level, the last one popping in.
  for (let i = 0; i < max; i++) {
    const on = i < level - 1 || (i === level - 1 && age > 0.4);
    text(g, '@', x0 + pw - 6 - (max - i) * 5, y0 + 4, on ? C.butter : C.sage);
  }
  text(g, titleOf(buyer, level), tx, y0 + 11, C.butter);
  line.forEach((l, i) => text(g, l, tx, y0 + 18 + i * 7, C.wool));
  perk.forEach((l, i) => text(g, l, tx, y0 + 19 + line.length * 7 + i * 7, C.butter));
  if (level >= max) stampAt(g, 'FRIEND', x0 + pw - 20, y0 + ph - 7, age);
}

function pastCard(game: Game, g: CanvasRenderingContext2D, n: number, x0: number, y0: number, pw: number, age: number) {
  text(g, 'THE BADGE BOOK', x0 + pw / 2, y0 + 4, C.butter, { align: 'center' });
  text(g, `${n} BADGE${n === 1 ? '' : 'S'} ALREADY EARNED`, x0 + pw / 2, y0 + 11, C.wool, { align: 'center' });
  const got = ACHIEVEMENTS.filter((a) => game.achievements.has(a.id)).slice(0, Math.floor((pw - 8) / 17));
  const w = got.length * 17 - 1;
  got.forEach((a, i) => {
    if (age > 0.2 + i * 0.06) drawBadge(g, a.group, a.icon, 'got', Math.round(x0 + pw / 2 - w / 2 + i * 17), y0 + 18, 1);
  });
}

// ---- Sharing: a postcard of a badge ----

function postcard(game: Game, a: AchDef): HTMLCanvasElement {
  const w = 200, h = 112;
  const [c, g] = makeCanvas(w, h);
  // Card stock with an airmail edge of teal and buttercup.
  rect(g, 0, 0, w, h, C.plum);
  for (let i = 0; i < w + h; i += 6) {
    const col = (i / 6) % 2 ? C.teal : C.butter;
    for (let k = 0; k < 3; k++) {
      const x = i + k;
      if (x < w) { px(g, x, 1, col); px(g, x, 2, col); px(g, w - 1 - x, h - 3, col); px(g, w - 1 - x, h - 2, col); }
    }
  }
  rect(g, 4, 5, w - 8, h - 10, C.wool);
  // The badge, big, on the left.
  const k = 4;
  drawBadge(g, a.group, a.icon, 'got', 10, 20, k, 0.3);
  // The words on the right.
  const tx = 10 + BADGE * k + 8, tw = w - tx - 42;
  text(g, 'COME BY', tx, 10, C.sage);
  text(g, `A ${a.group === 'coop' ? 'CO-OP' : a.group.toUpperCase()} BADGE`, tx, 17, C.sage);
  const name = wrap(a.name, tw);
  name.forEach((l, i) => text(g, l, tx, 28 + i * 7, C.plum));
  const ny = 28 + name.length * 7 + 3;
  wrap(a.what, w - tx - 10).slice(0, 3).forEach((l, i) => text(g, l, tx, Math.max(ny, 46) + i * 7, C.teal));
  const day = game.achievements.got.get(a.id);
  const ranch = game.look.ranch || 'OUR RANCH';
  const lines = [day ? `EARNED ON DAY ${day}` : 'EARNED LONG AGO', `AT ${ranch}`, `BY ${game.look.name}`];
  lines.forEach((l, i) => text(g, l, tx, h - 32 + i * 7, i ? C.plum : C.sage));
  // A stamp in the corner with the dog on it, and a postmark.
  const sx = w - 30, sy = 9;
  rect(g, sx, sy, 22, 26, C.plum);
  for (let i = 0; i < 22; i += 2) { px(g, sx + i, sy, C.wool); px(g, sx + i, sy + 25, C.wool); }
  for (let i = 0; i < 26; i += 2) { px(g, sx, sy + i, C.wool); px(g, sx + 21, sy + i, C.wool); }
  rect(g, sx + 2, sy + 2, 18, 22, C.meadow);
  rect(g, sx + 2, sy + 17, 18, 7, C.moss);
  drawSpr(g, playerDogSprites(game.look.dog).sideStand, sx + 11, sy + 20);
  // The postmark cancels the stamp, not the words.
  for (let r = 0; r < 2; r++) {
    const rr = 7 + r * 3;
    for (let t = 0; t < 40; t++) {
      const ang = (t / 40) * Math.PI * 2;
      if (t % 5 === 4) continue;
      px(g, Math.round(sx + 3 + Math.cos(ang) * rr), Math.round(sy + 24 + Math.sin(ang) * rr), C.sage);
    }
  }
  return c;
}

function share(game: Game, a: AchDef) {
  if (!game.achievements.has(a.id)) return;
  game.audio?.play('click');
  void sharePng(postcard(game, a), `come-by-${a.id}.png`, { touch: game.input.touchMode, title: 'Come By', text: `${a.name}: ${game.look.name} of ${game.look.ranch || 'the ranch'}` }).then((r) => {
    if (r === 'shared') say('SHARED!');
    else if (r === 'saved') say('POSTCARD SAVED');
    else if (r === 'failed') say('COULD NOT MAKE THE POSTCARD');
  });
}

// For tests: the postcard, scaled up as shared, as a data URL.
export function postcardUrl(game: Game, id: string): string | null {
  const a = achById(id);
  if (!a || !game.achievements.has(id)) return null;
  const src = postcard(game, a);
  const [c, cg] = makeCanvas(src.width * 5, src.height * 5);
  cg.imageSmoothingEnabled = false;
  cg.drawImage(src, 0, 0, src.width * 5, src.height * 5);
  return c.toDataURL('image/png');
}
