import { C } from '../palette';
import { panel, px, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import { drawSpr, type Sprite } from '../gfx/sprite';
import { makeCanvas } from '../gfx/screen';
import type { Game } from '../game';
import { ACHIEVEMENTS, achById, cardLife, isBig, type AchDef } from '../systems/achievements';
import { PTS, buyerDef, buyerLines, maxLevel, titleOf, type BuyerId } from '../systems/favour';
import { BADGE, drawBadge } from '../art/badges';
import { Person, type FolkId } from '../entities/folk';
import { peopleSprites } from '../art/people';
import { playerDogSprites } from '../art/dogstyle';
import { dimView } from './feel';
import { safeArea } from './safe';
import { TIERS } from '../systems/progression';

// The achievements' screens: the card that slides in when a badge is
// earned (or a buyer's favour rises), and two Ledger pages, BUYERS (a
// favour bar for each buyer and what their next level brings) and BADGES
// (every badge, progress on the locked ones, a hint for the secret ones,
// and a postcard of any won badge to share).

// ---- Ledger pages ----

export const PAGES = ['RANCH LEDGER', 'BUYERS', 'BADGES'];
let page = 0;
let pending: number | null = null; // the page to open at next time
let lastT = -9; // game time the Ledger's keys last ran
let cols = 8; // the badge grid's columns, as last drawn
let toast = '';
let toastT = 0;

export const ledgerPage = () => page;

// Open the Ledger at a page (a badge or a buyer's card tapped).
export function openLedgerAt(game: Game, p: number, badge?: string) {
  pending = p;
  if (badge) {
    const i = ACHIEVEMENTS.findIndex((a) => a.id === badge);
    if (i >= 0) game.achievements.sel = i;
  }
  game.achievements.detail = false;
  game.mode = 'ledger';
  game.ledgerNew = false;
  game.input.clearQueue();
}

function flip(game: Game, to: number) {
  page = (to + PAGES.length) % PAGES.length;
  game.achievements.detail = false;
  game.audio?.play('click');
}

// The Ledger's keys (also a co-op guest's): pages, the badge grid, closing.
export function ledgerKeys(game: Game) {
  const inp = game.input, A = game.achievements;
  if (Math.abs(game.t - lastT) > 0.25) {
    // Just opened: at the ranch page, unless something asked for another.
    page = pending ?? 0;
    pending = null;
    A.detail = false;
  }
  lastT = game.t;
  toastT = Math.max(0, toastT - 1 / 60);
  const close = () => {
    game.mode = 'play';
    inp.clearQueue();
  };
  if (inp.pressed('ledger')) return close();
  if (inp.pressed('cancel')) return A.detail ? void (A.detail = false) : close();
  if (inp.pressed('prev')) flip(game, page - 1);
  if (inp.pressed('next')) flip(game, page + 1);
  for (let i = 0; i < PAGES.length; i++) if (inp.pressed(`tab${i + 1}` as 'tab1')) flip(game, i);
  if (page !== 2) {
    if (inp.pressed('confirm')) close();
    return;
  }
  const n = ACHIEVEMENTS.length;
  const move = (d: number) => {
    A.sel = Math.max(0, Math.min(n - 1, A.sel + d));
    game.audio?.play('click', { vol: 0.5 });
  };
  if (inp.pressed('left')) move(-1);
  if (inp.pressed('right')) move(1);
  if (!A.detail) {
    if (inp.pressed('up') && A.sel - cols >= 0) move(-cols);
    if (inp.pressed('down') && A.sel + cols < n) move(cols);
    if (inp.pressed('confirm')) A.detail = true;
  } else if (inp.pressed('confirm')) share(game, ACHIEVEMENTS[A.sel]);
}

// The tab strip across the top of every Ledger page.
export function drawLedgerTabs(game: Game, g: CanvasRenderingContext2D, x: number, y: number) {
  const ui = game.ui;
  let tx = x;
  PAGES.forEach((name, i) => {
    const w = textWidth(name) + 6;
    const on = i === page;
    if (on) {
      rect(g, tx, y - 2, w, 9, C.teal);
      rect(g, tx, y + 7, w, 1, C.butter);
    }
    text(g, name, tx + 3, y, on ? C.butter : ui.isActive(`ledger-tab${i}`) ? C.wool : C.sage);
    // A dot on BADGES while there are new ones to see.
    if (i === 2 && game.achievements.unseen && !on) rect(g, tx + w - 2, y - 2, 2, 2, C.butter);
    if (ui.click(`ledger-tab${i}`, tx, y - 3, w, 11) && !on) flip(game, i);
    tx += w + 3;
  });
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

function hearts(g: CanvasRenderingContext2D, x: number, y: number, level: number, max: number) {
  for (let i = 0; i < max; i++) text(g, '@', x + i * 5, y, i < level ? C.butter : C.sage);
}

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, f: number, col: string = C.butter) {
  rect(g, x, y, w, 4, C.sage);
  rect(g, x + 1, y + 1, w - 2, 2, C.plum);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, f)));
  if (fw > 0) rect(g, x + 1, y + 1, fw, 2, col);
}

// The frame all my pages share: panel, tabs, tier pips, the close button.
// Returns the content box.
function frame(game: Game, g: CanvasRenderingContext2D, W: number, H: number, ph: number) {
  const S = safeArea(game.screen);
  const wide = W >= 300;
  const pw = wide ? Math.min(W - 20, 330) : Math.min(W - 16, 220);
  ph = Math.min(ph, H - 6 - S.top - S.bottom);
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2 + S.top, Math.round(H / 2 - ph / 2));
  dimView(g, game.view());
  panel(g, x0, y0, pw, ph);
  drawLedgerTabs(game, g, x0 + 5, y0 + 4);
  for (let i = 0; i < TIERS.length; i++) rect(g, x0 + pw - 8 - (TIERS.length - i) * 5, y0 + 4, 4, 4, i < game.tier ? C.butter : C.sage);
  rect(g, x0 + 5, y0 + 13, pw - 10, 1, C.sage);
  return { x0, y0, pw, ph, wide };
}

function closeButton(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number, pw: number, ph: number): boolean {
  const touch = game.input.touchMode;
  const label = touch ? 'CLOSE' : 'TAB: CLOSE';
  const bw = textWidth(label) + (touch ? 16 : 10), bh = touch ? 13 : 11;
  const bx = Math.round(x0 + pw / 2 - bw / 2), by = y0 + ph - bh - 2;
  panel(g, bx, by, bw, bh, game.ui.isActive('ledger-close') ? C.teal : C.plum, C.butter);
  text(g, label, bx + bw / 2, by + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
  if (!touch) text(g, 'Q/E: PAGES', x0 + 7, by + Math.floor((bh - 5) / 2), C.sage);
  return game.ui.click('ledger-close', bx, by, bw, bh);
}

// A page other than the ranch's own (ui/ledger.ts draws that one).
export function drawLedgerPage(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  if (page === 2) game.achievements.unseen = 0;
  const shut = page === 1 ? buyersPage(game, g, W, H) : badgesPage(game, g, W, H);
  return shut || game.ui.captureAll('ledger-bg');
}

function buyersPage(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  const lines = buyerLines(game);
  const wide = W >= 300;
  const blockH = 38;
  const per = wide ? 2 : 1;
  const ph = 20 + Math.ceil(lines.length / per) * blockH + 22 + 16;
  const { x0, y0, pw } = frame(game, g, W, H, ph);
  const colW = Math.floor((pw - 14 - (per - 1) * 8) / per);
  const T = game.t;
  if (game.tier < 2) {
    text(g, 'BUYERS START ASKING FOR STOCK AT TIER 2.', x0 + 7, y0 + 20, C.wool);
    wrap('FILL THEIR ORDERS AND THEY TAKE TO YOU: BETTER PRICES, SPECIAL ORDERS, GIFTS, AND YOUR NAME ON THEIR SIGN.', pw - 14).forEach((l, i) => text(g, l, x0 + 7, y0 + 30 + i * 7, C.sage));
  } else
    lines.forEach((b, i) => {
      const bx = x0 + 7 + (i % per) * (colW + 8), by = y0 + 18 + Math.floor(i / per) * blockH;
      const top = b.level >= maxLevel(b.def.id);
      // The buyer, standing; a friend gets a rosette on their coat.
      const s = portrait(b.def.id);
      drawSpr(g, s, bx + 5, by + 18);
      if (top && Math.floor(T * 2) % 6) px(g, bx + 7, by + 9, C.butter);
      const tx = bx + 14;
      if (!b.met) {
        text(g, b.def.name, tx, by + 1, C.sage);
        wrap('COMES THE FIRST DAY OF SUMMER, TO SHEAR YOUR SHEEP', colW - 16).forEach((l, k) => text(g, l, tx, by + 9 + k * 7, C.sage));
        return;
      }
      text(g, b.def.name, tx, by + 1, C.wool);
      const title = titleOf(b.def.id, b.level);
      text(g, title, bx + colW, by + 1, top ? C.butter : C.sage, { align: 'right' });
      const max = maxLevel(b.def.id);
      hearts(g, tx, by + 9, b.level, max);
      const bw = colW - 16 - max * 5 - 28;
      if (b.need) {
        bar(g, tx + max * 5 + 2, by + 9, bw, b.have / b.need);
        text(g, `${b.have}/${b.need}`, bx + colW, by + 9, C.sage, { align: 'right' });
      } else text(g, 'A FRIEND!', bx + colW, by + 9, C.butter, { align: 'right' });
      const next = b.next ? `NEXT: ${b.next}` : 'EVERYTHING THEY HAVE TO GIVE';
      const nl = wrap(next, colW - 16).slice(0, 2);
      nl.forEach((l, k) => text(g, l, tx, by + 16 + k * 7, b.next ? C.butter : C.sage));
      text(g, `FILLED ${b.filled}${b.pay ? `  PAYS ${b.pay}% OVER` : ''}`, tx, by + 16 + nl.length * 7, C.sage);
    });
  const fy = y0 + 18 + Math.ceil(lines.length / per) * blockH;
  rect(g, x0 + 5, fy - 2, pw - 10, 1, C.sage);
  const note = `FAVOUR @ +${PTS.fill} AN ORDER, +${PTS.calm} ALL CALM, +${PTS.early} EARLY. A MISSED ORDER COSTS ${-PTS.missed}.`;
  wrap(note, pw - 14).slice(0, 2).forEach((l, i) => text(g, l, x0 + 7, fy + 1 + i * 7, C.sage, { iconColor: C.butter }));
  return closeButton(game, g, x0, y0, pw, ph);
}

function stateOf(game: Game, a: AchDef) {
  return game.achievements.has(a.id) ? 'got' : a.secret ? 'secret' : 'locked';
}

function badgesPage(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  const A = game.achievements;
  const n = ACHIEVEMENTS.length;
  const S = safeArea(game.screen);
  const wide = W >= 300;
  const pw = wide ? Math.min(W - 20, 330) : Math.min(W - 16, 220);
  const cell = BADGE + 3;
  cols = Math.max(4, Math.floor((pw - 12) / cell));
  const rows = Math.ceil(n / cols);
  if (A.detail) return detailPage(game, g, W, H);
  const ph = 20 + rows * cell + 4 + 36 + 16;
  const { x0, y0 } = frame(game, g, W, H, Math.min(ph, H - 6 - S.top - S.bottom));
  const gx = x0 + Math.round((pw - cols * cell + 3) / 2), gy = y0 + 18;
  const T = game.t;
  ACHIEVEMENTS.forEach((a, i) => {
    const cx = gx + (i % cols) * cell, cy = gy + Math.floor(i / cols) * cell;
    const st = stateOf(game, a);
    const glint = st === 'got' ? ((T * 0.4 + i * 0.37) % 4) : -1;
    drawBadge(g, a.group, a.icon, st, cx, cy, 1, glint);
    if (i === A.sel) {
      // Buttercup corners round the one picked.
      const b = Math.floor(T * 3) % 2;
      for (const [dx, dy] of [[-2 - b, -2 - b], [BADGE + b - 1, -2 - b], [-2 - b, BADGE + b - 1], [BADGE + b - 1, BADGE + b - 1]]) {
        rect(g, cx + dx, cy + dy, 3, 1, C.butter);
        rect(g, cx + dx + (dx < 0 ? 0 : 2), cy + dy + (dy < 0 ? 0 : -2), 1, 3, C.butter);
      }
    }
    if (game.ui.click(`badge-${i}`, cx - 1, cy - 1, cell, cell)) {
      if (A.sel === i) A.detail = true;
      else A.sel = i;
      game.audio?.play('click', { vol: 0.5 });
    }
  });
  // The one picked, below the grid.
  const a = ACHIEVEMENTS[A.sel];
  const iy = gy + rows * cell + 3;
  rect(g, x0 + 5, iy - 2, pw - 10, 1, C.sage);
  info(game, g, a, x0 + 7, iy + 1, pw - 14);
  text(g, `${A.got.size}/${n}`, x0 + pw - 7, iy + 1, C.butter, { align: 'right' });
  return closeButton(game, g, x0, y0, pw, ph);
}

// Name, how it is earned (or the hint), and progress or the day won.
function info(game: Game, g: CanvasRenderingContext2D, a: AchDef, x: number, y: number, w: number) {
  const A = game.achievements;
  const got = A.has(a.id);
  const secret = !got && !!a.secret;
  text(g, secret ? '? ? ?' : a.name, x, y, got ? C.butter : C.wool);
  const what = secret ? a.secret! : a.what;
  wrap(what, w).slice(0, 2).forEach((l, i) => text(g, l, x, y + 7 + i * 7, got ? C.wool : C.sage, { iconColor: C.butter }));
  const day = A.got.get(a.id);
  const p = A.progress(game, a);
  const ly = y + 22;
  if (got) text(g, day ? `EARNED ON DAY ${day}${game.input.touchMode ? '' : '  ENTER: OPEN'}` : 'EARNED BEFORE THE BADGE BOOK', x, ly, C.sage);
  else if (p && !secret) {
    bar(g, x, ly, Math.min(80, w - 40), p[0] / p[1], C.wool);
    text(g, `${p[0]}/${p[1]}`, x + Math.min(80, w - 40) + 4, ly, C.sage);
  } else if (!secret) text(g, 'CAUGHT AS IT HAPPENS', x, ly, C.sage);
}

function detailPage(game: Game, g: CanvasRenderingContext2D, W: number, H: number): boolean {
  const A = game.achievements;
  const a = ACHIEVEMENTS[A.sel];
  const st = stateOf(game, a);
  const ph = 20 + 52 + 34 + 18 + 16;
  const { x0, y0, pw } = frame(game, g, W, H, ph);
  const k = 3;
  const bx = Math.round(x0 + pw / 2 - (BADGE * k) / 2), by = y0 + 19;
  drawBadge(g, a.group, a.icon, st, bx, by, k, st === 'got' ? (game.t * 0.5) % 2.5 : -1);
  const iw = Math.min(pw - 14, 190);
  info(game, g, a, Math.round(x0 + pw / 2 - iw / 2), by + BADGE * k + 4, iw);
  // Back, and (once won) share.
  const touch = game.input.touchMode;
  const yb = by + BADGE * k + 34;
  const back = touch ? 'BACK' : 'ESC: BACK';
  const bw = textWidth(back) + 10, bh = touch ? 13 : 11;
  let x = Math.round(x0 + pw / 2 - (st === 'got' ? bw + 4 : bw / 2));
  panel(g, x, yb, bw, bh, game.ui.isActive('badge-back') ? C.teal : C.plum, C.sage);
  text(g, back, x + bw / 2, yb + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
  if (game.ui.click('badge-back', x, yb, bw, bh)) A.detail = false;
  if (st === 'got') {
    const lab = touch ? 'SHARE' : 'ENTER: SHARE';
    const sw = textWidth(lab) + 10;
    x = Math.round(x0 + pw / 2 + 4);
    panel(g, x, yb, sw, bh, game.ui.isActive('badge-share') ? C.teal : C.plum, C.butter);
    text(g, lab, x + sw / 2, yb + Math.floor((bh - 5) / 2), C.wool, { align: 'center' });
    if (game.ui.click('badge-share', x, yb, sw, bh)) share(game, a);
  }
  if (toastT > 0) text(g, toast, x0 + pw / 2, yb - 8, C.butter, { align: 'center' });
  return closeButton(game, g, x0, y0, pw, ph);
}

// ---- The card that slides in ----

const ease = (u: number) => 1 - (1 - u) * (1 - u);

export function drawCards(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const A = game.achievements;
  const c = A.card;
  if (!c || game.feel.tierCard || game.trials.result) return;
  const S = safeArea(game.screen);
  const age = A.cardT, life = cardLife(c);
  const pw = Math.min(W - 12, c.kind === 'favour' ? 196 : 176);
  const ph = c.kind === 'favour' ? 46 : 38;
  const inn = ease(Math.min(1, age / 0.3)), out = Math.max(0, (age - (life - 0.3)) / 0.3);
  const x0 = Math.round(W / 2 - pw / 2);
  const y0 = Math.round(2 + S.top + 14 - (1 - inn) * (ph + 20) - out * (ph + 20));
  const big = isBig(c);
  if (big) panel(g, x0 - 2, y0 - 2, pw + 4, ph + 4, C.teal, C.butter);
  panel(g, x0, y0, pw, ph, C.plum, C.butter);
  if (c.kind === 'badge') badgeCard(game, g, c.id, x0, y0, pw, ph, age);
  else if (c.kind === 'favour') favourCard(game, g, c.buyer, c.level, x0, y0, pw, age);
  else pastCard(game, g, c.n, x0, y0, pw, age);
  // A tap on the card opens the Ledger at it.
  if (game.ui.click('ach-card', x0, y0, pw, ph)) {
    if (c.kind === 'favour') openLedgerAt(game, 1);
    else openLedgerAt(game, 2, c.kind === 'badge' ? c.id : undefined);
    A.dismiss();
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

function badgeCard(game: Game, g: CanvasRenderingContext2D, id: string, x0: number, y0: number, pw: number, ph: number, age: number) {
  const a = achById(id);
  if (!a) return;
  const k = 2;
  drawBadge(g, a.group, a.icon, 'got', x0 + 4, y0 + 3, k, Math.min(1, age / 1.2));
  const tx = x0 + 4 + BADGE * k + 5, tw = pw - (tx - x0) - 5;
  if (age > 0.25 || Math.floor(age * 16) % 2 === 0) text(g, a.big ? 'A BIG ONE!' : 'BADGE EARNED', tx, y0 + 4, C.sage);
  text(g, a.name, tx, y0 + 11, C.butter);
  wrap(a.what, tw).slice(0, 2).forEach((l, i) => text(g, l, tx, y0 + 19 + i * 7, C.wool, { iconColor: C.butter }));
  stampAt(g, `DAY ${game.achievements.got.get(id) ?? game.day.day}`, x0 + pw - 22, y0 + ph - 7, age);
}

function favourCard(game: Game, g: CanvasRenderingContext2D, buyer: BuyerId, level: number, x0: number, y0: number, pw: number, age: number) {
  const def = buyerDef(buyer);
  const max = maxLevel(buyer);
  const s = portrait(buyer);
  // The buyer, a little taller: twice the size, on a teal ground.
  panel(g, x0 + 3, y0 + 3, s.w * 2 + 4, 40, C.teal, C.sage);
  let c = BIG[buyer];
  if (!c) {
    const [cv, cg] = makeCanvas(s.w, s.h);
    drawSpr(cg, s, s.ax, s.ay);
    BIG[buyer] = c = cv;
  }
  g.drawImage(c, x0 + 5, y0 + 8, s.w * 2, s.h * 2);
  const tx = x0 + 10 + s.w * 2, tw = pw - (tx - x0) - 5;
  text(g, def.name, tx, y0 + 4, C.wool);
  // The hearts fill to the new level, the last one popping in.
  for (let i = 0; i < max; i++) {
    const on = i < level - 1 || (i === level - 1 && age > 0.4);
    text(g, '@', x0 + pw - 6 - (max - i) * 5, y0 + 4, on ? C.butter : C.sage);
  }
  const title = titleOf(buyer, level);
  text(g, title, tx, y0 + 11, C.butter);
  const step = def.steps[level - 1];
  wrap(`"${step.line}"`, tw).slice(0, 2).forEach((l, i) => text(g, l, tx, y0 + 19 + i * 7, C.wool));
  text(g, wrap(step.perk, tw)[0], tx, y0 + 35, C.butter);
  if (level >= max) stampAt(g, 'FRIEND', x0 + pw - 20, y0 + 41, age);
}

function pastCard(game: Game, g: CanvasRenderingContext2D, n: number, x0: number, y0: number, pw: number, age: number) {
  text(g, 'THE BADGE BOOK', x0 + pw / 2, y0 + 4, C.butter, { align: 'center' });
  text(g, `${n} BADGE${n === 1 ? '' : 'S'} YOUR RANCH HAS EARNED`, x0 + pw / 2, y0 + 11, C.wool, { align: 'center' });
  const got = ACHIEVEMENTS.filter((a) => game.achievements.has(a.id)).slice(0, Math.floor((pw - 8) / 17));
  const w = got.length * 17 - 1;
  got.forEach((a, i) => {
    if (age > 0.2 + i * 0.06) drawBadge(g, a.group, a.icon, 'got', Math.round(x0 + pw / 2 - w / 2 + i * 17), y0 + 19, 1);
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
  const dog = playerDogSprites(game.look.dog).sideStand;
  drawSpr(g, dog, sx + 11, sy + 20);
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

// Scale it up by a whole number and hand it to the share sheet (a phone)
// or save it as a file.
function bigPostcard(game: Game, a: AchDef): HTMLCanvasElement {
  const src = postcard(game, a);
  const k = 5;
  const [c, cg] = makeCanvas(src.width * k, src.height * k);
  cg.imageSmoothingEnabled = false;
  cg.drawImage(src, 0, 0, src.width * k, src.height * k);
  return c;
}

function share(game: Game, a: AchDef) {
  if (!game.achievements.has(a.id)) return;
  const c = bigPostcard(game, a);
  game.audio?.play('click');
  const name = `come-by-${a.id}.png`;
  let file: File | null = null;
  try {
    // A file at once, so the share sheet opens while the tap still counts.
    const url = c.toDataURL('image/png');
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    file = new File([bytes], name, { type: 'image/png' });
  } catch {
    return say('COULD NOT MAKE THE POSTCARD');
  }
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (game.input.touchMode && nav.share && nav.canShare?.({ files: [file] })) {
    nav.share({ files: [file], title: 'Come By', text: `${a.name}: ${game.look.name} of ${game.look.ranch || 'the ranch'}` })
      .then(() => say('SHARED!'))
      .catch(() => download(file!, name));
    return;
  }
  download(file, name);
}

function download(file: File, name: string) {
  try {
    const url = URL.createObjectURL(file);
    const el = document.createElement('a');
    el.href = url;
    el.download = name;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say('POSTCARD SAVED');
  } catch {
    say('COULD NOT SAVE THE POSTCARD');
  }
}

function say(s: string) {
  toast = s;
  toastT = 2.2;
}

// For tests: the postcard as a data URL.
export function postcardUrl(game: Game, id: string): string | null {
  const a = achById(id);
  return a && game.achievements.has(id) ? bigPostcard(game, a).toDataURL('image/png') : null;
}

