import { C } from '../palette';
import { panel, rect, px } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import { DUSK_AT, NIGHT_LEN } from '../systems/day';
import { nextGoal } from '../systems/progression';
import { wrap } from '../gfx/font';
import { touchLayout } from './touch';

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

// Arrow at the screen edge towards an off-screen world point.
export function edgeArrow(g: CanvasRenderingContext2D, game: Game, wx: number, wy: number, color: string, label: string, top = 26, bottom = 8) {
  const { ox, oy, W, H } = game.view();
  const sx = wx - ox, sy = wy - oy;
  if (sx > 4 && sx < W - 4 && sy > top && sy < H - bottom) return;
  const cx = W / 2, cy = (top + H - bottom) / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const m = 9;
  const kx = Math.abs(Math.cos(ang)) > 1e-3 ? (W / 2 - m) / Math.abs(Math.cos(ang)) : 1e9;
  const ky = Math.abs(Math.sin(ang)) > 1e-3 ? ((H - top - bottom) / 2 - m) / Math.abs(Math.sin(ang)) : 1e9;
  const k = Math.min(kx, ky);
  const ax = Math.round(cx + Math.cos(ang) * k), ay = Math.round(cy + Math.sin(ang) * k);
  arrow(g, ax + 1, ay + 1, ang, 5, C.plum);
  arrow(g, ax, ay, ang, 5, color);
  if (label) {
    const lx = ax - Math.cos(ang) * 10, ly = ay - Math.sin(ang) * 9 - 2;
    text(g, label, lx, ly, color, { align: 'center', shadow: C.plum });
  }
}

export function drawHud(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  // ---- Edge arrows: groups out in the pastures, and home when driving ----
  const top = 14;
  const gr = game.nearestGroup();
  const driving = gr && Math.hypot(gr.x - game.dog.x, gr.y - game.dog.y) < 90;
  if (driving) {
    const pen = game.ranch.pens.find((p) => p.hasRoomFor(gr!.members[0]));
    if (pen) {
      const gp = pen.gatePoint(10);
      edgeArrow(g, game, gp.x, gp.y, C.wool, 'PEN', top);
    }
  }
  if (game.day.phase === 'night') {
    for (const p of game.predators) if (p.active) edgeArrow(g, game, p.x, p.y, C.wool, p.carry ? '!!' : '!', top);
  } else if (!driving) {
    const groups = [...game.groups]
      .sort((a, b) => Math.hypot(a.x - game.dog.x, a.y - game.dog.y) - Math.hypot(b.x - game.dog.x, b.y - game.dog.y))
      .slice(0, 2);
    for (const grp of groups) edgeArrow(g, game, grp.x, grp.y, C.butter, `${grp.members.length}`, top);
  }

  // ---- Clock (top-left) ----
  const d = game.day;
  panel(g, 2, 2, 52, 18);
  text(g, `DAY ${d.day}`, 6, 5, C.wool);
  text(g, d.clock(), 51, 5, d.phase === 'dusk' ? C.butter : C.wool, { align: 'right' });
  // Sun track: day in sage, dusk in plum-ish; a sun dot travels along it.
  const tx = 6, ty = 14, tw = 44;
  rect(g, tx, ty, tw, 2, C.sage);
  rect(g, tx + Math.round(tw * DUSK_AT), ty, tw - Math.round(tw * DUSK_AT), 2, C.teal);
  if (d.phase === 'night') {
    // Moon crossing a dark track.
    rect(g, tx, ty, tw, 2, C.plum);
    const mx = tx + Math.round((d.nightT / NIGHT_LEN) * (tw - 1));
    rect(g, mx - 1, ty - 1, 3, 4, C.wool);
    px(g, mx + 1, ty - 1, C.plum);
  } else {
    const sx = tx + Math.round(d.frac * (tw - 1));
    rect(g, sx - 1, ty - 1, 3, 4, C.butter);
    px(g, sx, ty - 2, C.butter);
  }

  // ---- Coins (top-right) ----
  const coinStr = `${game.coins}$`;
  const cw = textWidth(coinStr) + 8;
  panel(g, W - cw - 2, 2, cw, 11);
  text(g, coinStr, W - 6, 5, C.wool, { align: 'right', iconColor: C.butter });

  // ---- Build button (on the ranch) ----
  if (game.inRanch()) {
    const label = game.input.touchMode ? 'BUILD' : 'B: BUILD';
    const bw = textWidth(label) + 8;
    const hot = game.ui.isActive('hud-build');
    panel(g, W - bw - 2, 15, bw, 11, hot ? C.teal : C.plum, C.butter);
    text(g, label, W - bw / 2 - 2, 18, C.wool, { align: 'center' });
    if (game.ui.click('hud-build', W - bw - 2, 15, bw, 11)) game.input.push('build');
  }

  // ---- Next goal (always visible; tap or Tab for the ledger) ----
  let cardY = 22;
  {
    const ng = nextGoal(game);
    const blink = game.ledgerNew && Math.floor(game.t * 3) % 2 === 0;
    const label = game.ledgerNew ? 'NEW TIER! SEE LEDGER' : ng ? `${ng.goal.label}${ng.goal.target > 1 ? ` ${Math.min(ng.value, ng.goal.target)}/${ng.goal.target}` : ''}` : game.won ? 'THE VALLEY THRIVES' : 'TIER DONE!';
    const w = textWidth(label) + 13;
    panel(g, 2, cardY, w, 11, blink ? C.teal : C.plum, C.butter);
    // Little ledger book icon.
    rect(g, 5, cardY + 3, 4, 5, C.butter);
    rect(g, 6, cardY + 4, 2, 1, C.plum);
    text(g, label, 11, cardY + 3, C.wool, { iconColor: C.butter });
    if (game.ui.click('hud-ledger', 2, cardY, w, 11)) game.input.push('ledger');
    cardY += 13;
  }

  // ---- Flock card ----
  if (gr) {
    const sp = gr.members[0].sp;
    const n = gr.members.length;
    const mood = gr.stress < 0.3 ? 'CALM' : gr.stress < 0.6 ? 'UNEASY' : 'PANIC';
    const col = gr.stress < 0.3 ? C.butter : C.wool;
    const label = `${n} ${(n === 1 ? sp.name : sp.plural).toUpperCase()}`;
    const w = Math.max(textWidth(label), 21 + textWidth(mood)) + 8;
    panel(g, 2, cardY, w, 19);
    text(g, label, 6, cardY + 3, C.wool);
    const pips = 5, lit = Math.max(1, Math.round((1 - gr.stress) * pips));
    for (let i = 0; i < pips; i++) rect(g, 6 + i * 4, cardY + 11, 3, 4, i < lit ? col : C.sage);
    if (mood !== 'PANIC' || Math.floor(game.t * 6) % 2 === 0) text(g, mood, 27, cardY + 10, col);
  }

  // ---- Hint line (tutorial and region tips) ----
  const hint = game.hint();
  const bottomY = game.input.touchMode ? touchLayout(W, H).lie.y - 20 : H - 4;
  if (hint) {
    const lines = wrap(hint, Math.min(W - 16, 200));
    const hw = Math.max(...lines.map((l) => textWidth(l))) + 10;
    const hh = lines.length * 7 + 5;
    const hy = Math.round(bottomY - hh);
    panel(g, Math.round(W / 2 - hw / 2), hy, hw, hh);
    lines.forEach((l, i) => text(g, l, W / 2, hy + 3 + i * 7, C.wool, { align: 'center', iconColor: C.butter }));
  }

  // ---- Place name and banners ----
  if (game.place) {
    const p = game.place;
    const show = p.t > 2.2 ? Math.floor(p.t * 20) % 2 === 0 : true;
    if (show) {
      const tw2 = textWidth(p.text);
      const py = hint ? 40 : Math.round(bottomY - 12);
      panel(g, Math.round(W / 2 - tw2 / 2 - 5), py, tw2 + 10, 11);
      text(g, p.text, W / 2, py + 3, C.wool, { align: 'center' });
    }
  }
  if (game.banner) {
    const b = game.banner;
    const age = b.max - b.t;
    const y = Math.round(H * 0.28 + Math.max(0, 1 - age * 5) * -20);
    const sc = textWidth(b.big, 2) <= W - 8 ? 2 : 1;
    text(g, b.big, W / 2, y, C.butter, { align: 'center', scale: sc, shadow: C.plum });
    if (b.small) wrap(b.small, W - 12).forEach((l, i) => text(g, l, W / 2, y + 7 * sc + 4 + i * 7, C.wool, { align: 'center', shadow: C.plum, iconColor: C.butter }));
  }
}
