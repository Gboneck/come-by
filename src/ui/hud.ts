import { C } from '../palette';
import { panel, rect, px } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { calmRating, type Game } from '../game';
import { DUSK_AT, NIGHT_LEN } from '../systems/day';
import { TIERS, nextGoal } from '../systems/progression';
import { wrap } from '../gfx/font';
import { touchLayout } from './touch';
import { safeArea } from './safe';
import { coachHint, drawCoach } from './coach';

// Rasterised triangle arrow pointing along `ang`.
export function arrow(g: CanvasRenderingContext2D, cx: number, cy: number, ang: number, size: number, color: string) {
  const pts = [0, 2.5, -2.5].map((o) => [cx + Math.cos(ang + o) * size * (o === 0 ? 1 : 0.8), cy + Math.sin(ang + o) * size * (o === 0 ? 1 : 0.8)]);
  const [a, b, c] = pts;
  const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const s = (p: number[], q: number[], r: number[]) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  g.fillStyle = color;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) g.fillRect(x, y, 1, 1);
    }
}

export interface Margins { top: number; bottom: number; left: number; right: number }

// Arrow at the screen edge towards an off-screen world point.
export function edgeArrow(g: CanvasRenderingContext2D, game: Game, wx: number, wy: number, color: string, label: string, M: Margins) {
  const { ox, oy, W, H } = game.view();
  const sx = wx - ox, sy = wy - oy;
  const x0 = M.left, x1 = W - M.right, y0 = M.top, y1 = H - M.bottom;
  if (sx > x0 + 4 && sx < x1 - 4 && sy > y0 && sy < y1) return;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const m = 9;
  const kx = Math.abs(Math.cos(ang)) > 1e-3 ? ((x1 - x0) / 2 - m) / Math.abs(Math.cos(ang)) : 1e9;
  const ky = Math.abs(Math.sin(ang)) > 1e-3 ? ((y1 - y0) / 2 - m) / Math.abs(Math.sin(ang)) : 1e9;
  const k = Math.min(kx, ky);
  const ax = Math.round(cx + Math.cos(ang) * k), ay = Math.round(cy + Math.sin(ang) * k);
  arrow(g, ax + 1, ay + 1, ang, 5, C.plum);
  arrow(g, ax, ay, ang, 5, color);
  if (label) {
    const lx = ax - Math.cos(ang) * 10, ly = ay - Math.sin(ang) * 9 - 2;
    text(g, label, lx, ly, color, { align: 'center', shadow: C.plum });
  }
}

// A HUD button. Touch gets a generous invisible hit area round it.
function button(game: Game, g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, rim: string, pulse = false): boolean {
  const hot = game.ui.isActive(id);
  const blink = pulse && Math.floor(game.t * 3) % 2 === 0;
  panel(g, x, y, w, h, hot || blink ? C.teal : C.plum, pulse ? C.butter : rim);
  const p = game.input.touchMode ? 3 : 0;
  return game.ui.click(id, x - p, y - p, w + p * 2, h + p * 2);
}

export function drawHud(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const S = safeArea(game.screen);
  const touch = game.input.touchMode;
  const TL = touch ? touchLayout(game, W, H) : null;
  const L = 2 + S.left, T = 2 + S.top, R = W - 2 - S.right;
  const bh = touch ? 13 : 11; // button height
  const ty = (touch ? 4 : 3); // text inset in a button

  drawCoach(game, g);

  // ---- Edge arrows: groups out in the pastures, and home when driving ----
  const M: Margins = { top: T + 12, bottom: TL ? H - TL.top + 2 : S.bottom + 8, left: S.left, right: S.right };
  const gr = game.nearestGroup();
  const driving = gr && Math.hypot(gr.x - game.dog.x, gr.y - game.dog.y) < 90;
  if (driving) {
    const pen = game.ranch.pens.find((p) => p.hasRoomFor(gr!.members[0]));
    if (pen) {
      const gp = pen.gatePoint(10);
      edgeArrow(g, game, gp.x, gp.y, C.wool, 'PEN', M);
    }
  }
  if (game.day.phase === 'night') {
    for (const p of game.predators) if (p.active) edgeArrow(g, game, p.x, p.y, C.wool, p.carry ? '!!' : '!', M);
  } else if (!driving) {
    const groups = [...game.groups]
      .sort((a, b) => Math.hypot(a.x - game.dog.x, a.y - game.dog.y) - Math.hypot(b.x - game.dog.x, b.y - game.dog.y))
      .slice(0, 2);
    for (const grp of groups) edgeArrow(g, game, grp.x, grp.y, C.butter, `${grp.members.length}`, M);
  }

  // ---- Clock (top-left) ----
  const d = game.day;
  panel(g, L, T, 52, 18);
  text(g, `DAY ${d.day}`, L + 4, T + 3, C.wool);
  const resting = game.rest > 1.5;
  text(g, d.clock(), L + 49, T + 3, d.phase === 'dusk' || resting ? C.butter : C.wool, { align: 'right' });
  // Resting: the clock runs fast.
  if (resting && Math.floor(game.t * 4) % 2 === 0) text(g, '>>', L + 55, T + 3, C.butter, { shadow: C.plum });
  // Sun track: day in sage, dusk in teal; a sun dot travels along it.
  const tx = L + 4, tky = T + 12, tw = 44;
  rect(g, tx, tky, tw, 2, C.sage);
  rect(g, tx + Math.round(tw * DUSK_AT), tky, tw - Math.round(tw * DUSK_AT), 2, C.teal);
  if (d.phase === 'night') {
    // Moon crossing a dark track.
    rect(g, tx, tky, tw, 2, C.plum);
    const mx = tx + Math.round((d.nightT / NIGHT_LEN) * (tw - 1));
    rect(g, mx - 1, tky - 1, 3, 4, C.wool);
    px(g, mx + 1, tky - 1, C.plum);
  } else {
    const sx = tx + Math.round(d.frac * (tw - 1));
    rect(g, sx - 1, tky - 1, 3, 4, C.butter);
    px(g, sx, tky - 2, C.butter);
  }

  // ---- Coins (top-right): ticks up as coins land in the purse ----
  const f = game.feel;
  const shown = f.coinsShown(game.coins);
  const coinStr = `${shown}$`;
  const cw = Math.max(textWidth(coinStr), textWidth(`${game.coins}$`)) + 8;
  const ticking = shown !== game.coins || f.bump > 0;
  panel(g, R - cw, T, cw, 11, C.plum, ticking ? C.butter : C.sage);
  text(g, coinStr, R - 4, T + 3 - (f.bump > 0 ? 1 : 0), ticking ? C.butter : C.wool, { align: 'right', iconColor: C.butter });
  f.purse.x = R - 6;
  f.purse.y = T + 5;

  // ---- Pause (touch) ----
  let rightY = T + 13;
  let bx = R;
  if (touch) {
    const pw = 15;
    bx -= pw;
    if (button(game, g, 'hud-pause', bx, rightY, pw, bh, C.sage)) game.input.push('pause');
    const hot = game.ui.isActive('hud-pause') ? 1 : 0;
    rect(g, bx + 5, rightY + 4 + hot, 1, bh - 8, C.wool);
    rect(g, bx + 9, rightY + 4 + hot, 1, bh - 8, C.wool);
    bx -= 4;
  }

  // ---- Build button (on the ranch) ----
  if (game.inRanch()) {
    const label = touch ? 'BUILD' : 'B: BUILD';
    const w = textWidth(label) + 8;
    bx -= w;
    const pulse = game.tut === 6 && game.coins >= 20;
    if (button(game, g, 'hud-build', bx, rightY, w, bh, C.butter, pulse)) game.input.push('build');
    text(g, label, bx + w / 2, rightY + ty, C.wool, { align: 'center' });
  }
  rightY += bh + (touch ? 4 : 2);

  // ---- Helper dogs: what they are doing, and the command button ----
  if (game.helpers.length) {
    const mode = game.day.phase === 'night' ? 'GUARD' : game.helpers[0].mode === 'flank' ? 'FLANK' : game.helpers[0].mode === 'stay' ? 'STAY' : 'HOME';
    const label = touch ? `HELP: ${mode}` : `H: ${game.helpers.map((h) => h.name).join('+')} ${mode}`;
    const hw = textWidth(label) + 8;
    if (button(game, g, 'hud-help', R - hw, rightY, hw, bh, C.butter)) game.input.push('helper');
    text(g, label, R - hw / 2, rightY + ty, C.wool, { align: 'center' });
  }

  // ---- Next goal (always visible; tap or Tab for the ledger) ----
  let cardY = T + 20;
  {
    const ng = nextGoal(game);
    const label = ng ? `${ng.goal.label}${ng.goal.target > 1 ? ` ${Math.min(ng.value, ng.goal.target)}/${ng.goal.target}` : ''}` : game.won ? 'THE VALLEY THRIVES' : 'TIER DONE!';
    const tag = game.ledgerNew ? 'NEW' : '';
    const w = textWidth(label) + 13 + (tag ? textWidth(tag) + 5 : 0);
    if (button(game, g, 'hud-ledger', L, cardY, w, bh, C.butter, game.ledgerNew || game.tut === 5)) game.input.push('ledger');
    // Little ledger book icon.
    rect(g, L + 3, cardY + ty, 4, 5, C.butter);
    rect(g, L + 4, cardY + ty + 1, 2, 1, C.plum);
    text(g, label, L + 9, cardY + ty, C.wool, { iconColor: C.butter });
    if (tag) text(g, tag, L + w - 4, cardY + ty, C.butter, { align: 'right' });
    cardY += bh + 2;
  }

  // ---- Flock card: how they feel now, and what they will pay ----
  if (gr) {
    const sp = gr.members[0].sp;
    const n = gr.members.length;
    const peak = gr.members.reduce((s, a) => s + a.peakStress, 0) / n;
    const pay = calmRating(peak);
    const col = pay.mult > 1 ? C.butter : C.wool;
    const label = `${n} ${(n === 1 ? sp.name : sp.plural).toUpperCase()}`;
    const mood = `${pay.label} X${pay.mult}`;
    const w = Math.max(textWidth(label), 21 + textWidth(mood)) + 8;
    panel(g, L, cardY, w, 19);
    text(g, label, L + 4, cardY + 3, C.wool);
    const pips = 5, lit = Math.max(1, Math.round((1 - gr.stress) * pips));
    const panic = gr.stress >= 0.6;
    for (let i = 0; i < pips; i++) rect(g, L + 4 + i * 4, cardY + 11, 3, 4, i < lit ? (panic ? C.wool : C.butter) : C.sage);
    if (!panic || Math.floor(game.t * 6) % 2 === 0) text(g, mood, L + 25, cardY + 10, col);
  }

  // ---- Hint line (tutorial and region tips) ----
  const hint = coachHint(game) ?? game.hint();
  let bottomY = TL ? TL.top - 2 : H - 4 - S.bottom;
  let hcx = (L + R) / 2, hmax = Math.min(W - 16 - S.left - S.right, 200);
  if (TL && W > H) {
    // Landscape: the thumbs sit in the corners, so the hint can use the
    // bottom edge between them instead of the middle of the field.
    const x0 = TL.stickHome.x + 28, x1 = TL.lie.x - TL.lie.r - 6;
    if (x1 - x0 >= 120) {
      hcx = (x0 + x1) / 2;
      hmax = Math.min(200, x1 - x0 - 10);
      bottomY = H - 4 - S.bottom;
    }
  }
  if (hint) {
    const lines = wrap(hint, hmax);
    const hw = Math.max(...lines.map((l) => textWidth(l))) + 10;
    const hh = lines.length * 7 + 5;
    const hy = Math.round(bottomY - hh);
    const hx = Math.round(hcx - hw / 2);
    panel(g, hx, hy, hw, hh);
    lines.forEach((l, i) => text(g, l, hx + hw / 2, hy + 3 + i * 7, C.wool, { align: 'center', iconColor: C.butter }));
  }

  // ---- Place name and banners ----
  if (game.place) {
    const p = game.place;
    const show = p.t > 2.2 ? Math.floor(p.t * 20) % 2 === 0 : true;
    if (show) {
      const tw2 = textWidth(p.text);
      // Top centre, between the clock and the purse: clear of the banners.
      const py = T;
      panel(g, Math.round(W / 2 - tw2 / 2 - 5), py, tw2 + 10, 11);
      text(g, p.text, W / 2, py + 3, C.wool, { align: 'center' });
    }
  }
  if (f.tierCard) drawTierCard(game, g, W, H);
  else if (game.banner) {
    const b = game.banner;
    const age = b.max - b.t;
    const y = Math.round(H * 0.28 + Math.max(0, 1 - age * 5) * -20);
    const sc = textWidth(b.big, 2) <= W - 8 ? 2 : 1;
    // Big moments land with a stamp: one size up for a few frames.
    const stamp = b.big === "THAT'LL DO!" && age < 0.09 && textWidth(b.big, sc + 1) <= W - 8 ? 1 : 0;
    text(g, b.big, W / 2, y - stamp * 3, C.butter, { align: 'center', scale: sc + stamp, shadow: C.plum });
    if (b.small) wrap(b.small, W - 12).forEach((l, i) => text(g, l, W / 2, y + 7 * sc + 4 + i * 7, C.wool, { align: 'center', shadow: C.plum, iconColor: C.butter }));
  }
  f.drawTop(g);
}

// Tier-up: what you reached and everything it brings, for a few seconds.
function drawTierCard(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const c = game.feel.tierCard!;
  const age = c.max - c.t;
  const pw = Math.min(W - 12, 190);
  const lines = [...wrap(c.blurb, pw - 14).map((s) => ({ s, col: C.wool as string })), ...c.brings.flatMap((b) => wrap(`+ ${b}`, pw - 14).map((s) => ({ s, col: C.butter as string })))];
  const big = textWidth(c.name, 2) <= pw - 10 ? 2 : 1;
  const ph = 36 + big * 5 + lines.length * 7;
  const x0 = Math.round(W / 2 - pw / 2);
  const y0 = Math.round(H * 0.24 - ph / 2 + Math.max(0, 1 - age * 5) * -24);
  panel(g, x0, y0, pw, ph, C.plum, C.butter);
  if (age > 0.4 || Math.floor(age * 12) % 2 === 0) text(g, 'TIER UP!', W / 2, y0 + 5, C.butter, { align: 'center' });
  // Tier pips, the new one flashing in.
  const n = TIERS.length;
  for (let i = 0; i < n; i++) {
    const on = i < c.n - 1 || (i === c.n - 1 && (age > 0.9 || Math.floor(age * 8) % 2 === 0));
    rect(g, W / 2 - (n * 6) / 2 + i * 6, y0 + 13, 5, 3, on ? C.butter : C.sage);
  }
  text(g, c.name, W / 2, y0 + 20, C.butter, { align: 'center', scale: big, shadow: C.teal });
  let y = y0 + 26 + big * 5;
  for (const l of lines) {
    text(g, l.s, W / 2, y, l.col, { align: 'center', iconColor: C.butter });
    y += 7;
  }
  if (game.ui.click('tiercard', x0, y0, pw, ph)) game.feel.tierCard = null;
}
