import { C } from '../palette';
import { prose, setNames } from './case';
import { rect } from '../gfx/draw';
import { panel } from './frame';
import { drawGoodsTally } from './goods';
import { drawObjective, objective } from './objective';
import { drawWhatsThis } from './whatsthis';
import { FIRST_STEPS, drawWelcome, firstDayStep, welcomeUp } from './firstday';
import { heading, headingWidth, text, textWidth } from '../gfx/font';
import { drawSpr, sprH, sprW } from '../gfx/sprite';
import { animalSprites } from '../art/animals';
import { bone, coin, dial, icon } from './hudart';
import { stamp } from './frame';
import { calmRating, type Game } from '../game';
import { DUSK_AT, NIGHT_LEN } from '../systems/day';
import { TIERS, nextGoal } from '../systems/progression';
import { touchLayout } from './touch';
import { safeArea } from './safe';
import { coachHint, drawCoach } from './coach';
import { defOf } from '../ranch/catalog';
import { jobArrows, jobCard } from './jobs';
import { seasonIcon, skyIcon } from './icons';
import { CALM_MAX } from '../systems/trials';
import { clamp } from '../util';
import { badgeUp, drawBadgeCard } from './achievements';

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

// A hint stays up long enough to be read before the next one replaces it
// (a fresh tip, which is about what just happened, still cuts in at once).
let held: string | null = null;
let heldAt = 0;
function steadyHint(game: Game, want: string | null): string | null {
  if (want === held) return held;
  const read = held ? Math.min(3.5, 1.2 + held.length * 0.045) : 0;
  const urgent = !!want && (want === game.tip?.text || want.startsWith('RESTING') || !!held?.startsWith('RESTING'));
  if (held && game.t - heldAt < read && !urgent) return held;
  held = want;
  heldAt = game.t;
  return held;
}

let stamped: object | null = null; // the banner whose stamp has puffed its dust

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

  // ---- Hint line layout (drawn later): it bounds the view from below ----
  const hint = steadyHint(game, coachHint(game) ?? game.hint());
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
  setNames([game.look.name, game.look.ranch, ...game.helpers.map((h) => h.name)]);
  const hl = hint ? prose(hint, hmax) : [];
  const hh = hl.length * 7 + 5;
  const hy = Math.round(bottomY - hh);
  // What is left of the field to point at: below this, a marker would hide
  // under the hint or the thumbs, so it gets an edge arrow instead.
  const viewBottom = Math.min(hint ? hy - 2 : H, TL ? TL.top : H - S.bottom - 4);

  drawCoach(game, g, T + 12, viewBottom);
  // The one thing to do now (ui/objective.ts): its arrow and marker here,
  // its words on the goal card below.
  const ob = objective(game);
  drawObjective(game, g, ob, T + 12, viewBottom);
  drawWhatsThis(game, g, T + 34, viewBottom);

  // ---- Stamina: a bone by the dog that empties as it runs ----
  {
    const dg = game.dog;
    if (dg.stamina < dg.stats.stamina - 0.01) {
      const v = game.view();
      const bx0 = Math.round(dg.x - v.ox + 5), by0 = Math.round(dg.y - v.oy - 19);
      bone(g, bx0, by0, dg.stamina / dg.stats.stamina, dg.exhausted, game.t);
      // Out of puff: a bead of sweat.
      if (dg.exhausted && Math.floor(game.t * 3) % 2 === 0) {
        rect(g, bx0 - 3, by0 + 1, 1, 2, C.wool);
        rect(g, bx0 - 4, by0 + 2, 1, 1, C.wool);
      }
    }
  }

  // ---- Edge arrows: groups out in the pastures, and home when driving ----
  const M: Margins = { top: T + 12, bottom: H - viewBottom + 2, left: S.left, right: S.right };
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
  jobArrows(game, g, M);

  // ---- Clock (top-left): a dial the sun climbs by day, the moon by night ----
  const d = game.day;
  panel(g, L, T, 62, 18);
  const night = d.phase === 'night';
  dial(g, L + 10, T + 13, 6, d.frac, d.duskAt ?? DUSK_AT, night, d.nightT / NIGHT_LEN, game.t);
  text(g, `DAY ${d.day}`, L + 20, T + 3, C.wool);
  const resting = game.rest > 1.5;
  text(g, d.clock(), L + 20, T + 10, d.phase === 'dusk' || resting ? C.butter : C.wool);
  // Today's sky at the end of the clock; on a clear day, the season.
  if (game.weather.sky === 'clear' && !night) seasonIcon(g, game.season.season, L + 51 + (game.season.season === 'summer' ? 0 : 1), T + 5);
  else skyIcon(g, game.weather.sky, L + 51, T + 5, night);
  // Resting: the clock runs fast.
  if (resting && Math.floor(game.t * 4) % 2 === 0) text(g, '>>', L + 65, T + 3, C.butter, { shadow: C.plum });

  // ---- Coins (top-right): ticks up as coins land in the purse ----
  const f = game.feel;
  const shown = f.coinsShown(game.coins);
  const coinStr = `${shown}`;
  const cw = Math.max(textWidth(coinStr), textWidth(`${game.coins}`)) + 18;
  const ticking = shown !== game.coins || f.bump > 0;
  panel(g, R - cw, T, cw, 11, C.plum, ticking ? C.butter : C.sage);
  text(g, coinStr, R - 12, T + 3 - (f.bump > 0 ? 1 : 0), ticking ? C.butter : C.wool, { align: 'right' });
  coin(g, R - 7, T + 5 - (f.bump > 0 ? 1 : 0), game.t, f.bump > 0);
  f.purse.x = R - 7;
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
    const w = textWidth(label) + 15;
    bx -= w;
    const pulse = (game.tut === 6 && game.coins >= defOf('kennel').cost) || ob?.ui === 'build';
    if (button(game, g, 'hud-build', bx, rightY, w, bh, C.butter, pulse)) game.input.push('build');
    icon(g, 'build', bx + 4, rightY + Math.floor((bh - 6) / 2));
    text(g, label, bx + 11, rightY + ty, C.wool);
  }
  rightY += bh + (touch ? 4 : 2);

  // ---- Helper dogs: what they are doing, and the command button ----
  if (game.helpers.length) {
    const mode = game.day.phase === 'night' ? 'GUARD' : game.helpers[0].mode === 'flank' ? 'FLANK' : game.helpers[0].mode === 'stay' ? 'STAY' : 'HOME';
    const label = touch ? `HELP: ${mode}` : `H: ${game.helpers.map((h) => h.name).join('+')} ${mode}`;
    const hw = textWidth(label) + 15;
    if (button(game, g, 'hud-help', R - hw, rightY, hw, bh, C.butter)) game.input.push('helper');
    icon(g, 'helper', R - hw + 4, rightY + Math.floor((bh - 5) / 2));
    text(g, label, R - hw + 11, rightY + ty, C.wool);
    rightY += bh + 2;
  }

  // ---- Today's goods, and what they fetch at day's end ----
  drawGoodsTally(game, g, R, rightY, W >= 300);

  // ---- What to do now (always visible; tap or Tab for the ledger) ----
  let cardY = T + 20;
  {
    const ng = nextGoal(game);
    const goal = ng ? `${ng.goal.label}${ng.goal.target > 1 ? ` ${Math.min(ng.value, ng.goal.target)}/${ng.goal.target}` : ''}` : game.won ? 'THE VALLEY THRIVES' : 'TIER DONE!';
    const label = ob ? `${ob.text}${ob.progress ? ` ${ob.progress[0]}/${ob.progress[1]}` : ''}` : goal;
    const tag = game.ledgerNew ? 'NEW' : '';
    // Clear of the right-hand buttons: long ones wrap onto a second line.
    const maxW = Math.max(90, W - L - 2 - S.right - 80);
    const lines = prose(label, maxW - 14 - (tag ? textWidth(tag) + 5 : 0)).slice(0, 2);
    const w = Math.max(...lines.map((l) => textWidth(l))) + 14 + (tag ? textWidth(tag) + 5 : 0);
    const ch = bh + (lines.length - 1) * 7;
    if (button(game, g, 'hud-ledger', L, cardY, w, ch, C.butter, game.ledgerNew || game.tut === 5)) game.input.push('ledger');
    // The Ledger's own little book.
    icon(g, 'ledger', L + 3, cardY + ty);
    lines.forEach((l, i) => text(g, l, L + 10, cardY + ty + i * 7, C.wool, { iconColor: C.butter }));
    if (tag) text(g, tag, L + w - 4, cardY + ty, C.butter, { align: 'right' });
    cardY += ch + 2;
  }

  // ---- Orders and trials: the day's jobs, under the goal ----
  cardY += jobCard(game, g, L, cardY, W);

  // ---- Flock card: how they feel now, and what they will pay ----
  if (gr) {
    const sp = gr.members[0].sp;
    const n = gr.members.length;
    const peak = gr.members.reduce((s, a) => s + a.peakStress, 0) / n;
    const pay = calmRating(peak);
    let col: string = pay.mult > 1 ? C.butter : C.wool;
    const label = `${n} ${(n === 1 ? sp.name : sp.plural).toUpperCase()}`;
    let mood = `${pay.label} X${pay.mult}`;
    const run = game.trials.run;
    if (run && gr.members[0].trial) {
      // On the course the flock earns calm points, not pay.
      const calm = Math.round(CALM_MAX * clamp(1 - (run.t > 0 ? run.stressT / run.t : 0) / 0.45, 0, 1));
      mood = `CALM ${calm}/${CALM_MAX}`;
      col = calm >= CALM_MAX * 0.7 ? C.butter : C.wool;
    }
    // The flock's own likeness at the left of the card.
    const a0 = gr.members[0];
    const pic = animalSprites(sp.id, a0.coat).stand[0];
    const pd = pic.d ?? 1; // a dense sprite's sizes are in fine pixels
    const iw = Math.min(16, sprW(pic)) + 4;
    const w = Math.max(textWidth(label), 21 + textWidth(mood)) + 8 + iw;
    panel(g, L, cardY, w, 19);
    g.save();
    g.beginPath();
    g.rect(L + 2, cardY + 2, iw, 15);
    g.clip();
    drawSpr(g, pic, L + 3 + pic.ax / pd, cardY + Math.max(2, Math.floor((19 - sprH(pic)) / 2)) + pic.ay / pd);
    g.restore();
    const lx = L + 3 + iw;
    text(g, label, lx, cardY + 3, C.wool);
    const pips = 5, lit = Math.max(1, Math.round((1 - gr.stress) * pips));
    const panic = gr.stress >= 0.6;
    for (let i = 0; i < pips; i++) rect(g, lx + i * 4, cardY + 11, 3, 4, i < lit ? (panic ? C.wool : C.butter) : C.sage);
    if (!panic || Math.floor(game.t * 6) % 2 === 0) text(g, mood, lx + 21, cardY + 10, col);
  }

  // ---- Hint line (tutorial and region tips) ----
  if (hint) {
    const hw = Math.max(...hl.map((l) => textWidth(l))) + 10;
    const hx = Math.round(hcx - hw / 2);
    // The first day's steps are gilt and carry their number.
    const step = firstDayStep(game);
    panel(g, hx, hy, hw, hh, C.plum, step ? C.butter : C.sage);
    if (step) {
      const tag = `FIRST DAY ${step}/${FIRST_STEPS}`;
      const tw = textWidth(tag) + 6;
      panel(g, hx + 3, hy - 8, tw, 9, C.teal, C.butter);
      text(g, tag, hx + 6, hy - 6, C.wool);
    }
    hl.forEach((l, i) => text(g, l, hx + hw / 2, hy + 3 + i * 7, C.wool, { align: 'center', iconColor: C.butter }));
  }
  drawWelcome(game, g, W, H);

  // ---- Place name and banners ----
  if (game.place) {
    const p = game.place;
    const show = p.t > 2.2 ? Math.floor(p.t * 20) % 2 === 0 : true;
    if (show) {
      // Top centre, between the clock and the purse: clear of the banners.
      // A heading-face plaque, like a sign at the field gate.
      const tw2 = headingWidth(p.text);
      const py = T;
      if (tw2 + 12 <= W - 2 * 70) {
        panel(g, Math.round(W / 2 - tw2 / 2 - 6), py, tw2 + 12, 11, C.teal, C.sage);
        heading(g, p.text, W / 2, py + 2, C.wool, { align: 'center', shade: C.sage });
      } else {
        const tw3 = textWidth(p.text);
        panel(g, Math.round(W / 2 - tw3 / 2 - 5), py, tw3 + 10, 11);
        text(g, p.text, W / 2, py + 3, C.wool, { align: 'center' });
      }
    }
  }
  if (f.tierCard) drawTierCard(game, g, W, H);
  else if (badgeUp(game)) drawBadgeCard(game, g, W, H); // a badge earned, a buyer's favour
  else if (game.banner && !welcomeUp(game)) {
    const b = game.banner;
    const age = b.max - b.t;
    const y = Math.round(H * 0.28 + Math.max(0, 1 - age * 5) * -20);
    // The shepherd's call names the dog, and lands like a rubber stamp.
    const thatll = b.big === "THAT'LL DO!";
    const big = thatll ? `THAT'LL DO, ${game.look.name}!` : b.big;
    const sc = headingWidth(big, 2) + 16 <= W - 8 ? 2 : 1;
    let bottom: number;
    if (thatll) {
      // Slammed down: one size bigger for a few frames, then pressed flat,
      // dust puffing out from under it.
      const slam = age < 0.08 && headingWidth(big, sc + 1) + 16 <= W - 8 ? 1 : 0;
      stamp(g, big, W / 2, y + 4, C.butter, sc + slam, true);
      if (stamped !== b && age >= 0.08) {
        stamped = b;
        f.stampDust(W / 2, y + 4, headingWidth(big, sc) + 12, 7 * sc + 10);
      }
      bottom = y + 4 + (7 * sc + 10) / 2 + 3;
    } else {
      heading(g, big, W / 2, y, C.butter, { align: 'center', scale: sc, outline: C.plum, shade: C.moss });
      bottom = y + 7 * sc + 4;
    }
    if (b.small) prose(b.small, W - 12).forEach((l, i) => text(g, l, W / 2, bottom + i * 7, C.wool, { align: 'center', shadow: C.plum, iconColor: C.butter }));
  }
}

// Tier-up: what you reached and everything it brings, for a few seconds.
function drawTierCard(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const c = game.feel.tierCard!;
  const age = c.max - c.t;
  const pw = Math.min(W - 12, 190);
  const lines = [...prose(c.blurb, pw - 14).map((s) => ({ s, col: C.wool as string })), ...c.brings.flatMap((b) => prose(`+ ${b}`, pw - 14).map((s) => ({ s, col: C.butter as string })))];
  const big = headingWidth(c.name, 2) <= pw - 10 ? 2 : 1;
  const ph = 36 + big * 7 + lines.length * 7;
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
  heading(g, c.name, W / 2, y0 + 20, C.butter, { align: 'center', scale: big, shade: C.moss, shadow: C.teal });
  let y = y0 + 26 + big * 7;
  for (const l of lines) {
    text(g, l.s, W / 2, y, l.col, { align: 'center', iconColor: C.butter });
    y += 7;
  }
  if (game.ui.click('tiercard', x0, y0, pw, ph)) game.feel.tierCard = null;
}
