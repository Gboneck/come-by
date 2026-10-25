import type { Game } from './game';
import type { Animal } from './entities/animal';
import { PARTS, type TrialResult } from './systems/trials';

// A simple herding controller (collect strays, then drive from behind),
// after Strömbom et al. 2014. Used for tuning runs and, later, helper dogs.
export interface BotOpts {
  goalX: number;
  goalY: number;
  bark?: number; // seconds between barks (0 = never)
  sprint?: boolean;
  crowd?: number; // 0..1: how far inside the flight zone the bot pushes
  keyboard?: boolean; // 8 directions, full speed or stopped, like a key player
  chase?: boolean; // naive: run straight at the nearest animal
  nip?: boolean; // nip the heel of a rearmost animal when close behind it
  flock?: Animal[]; // work only these (default: every loose animal)
}

export interface BotCmd {
  x: number;
  y: number;
  sprint: boolean;
  lie: boolean;
  bark: boolean;
  nip?: boolean;
  tx?: number; // where the dog is heading, for callers that path round obstacles
  ty?: number;
}

export function botStep(game: Game, o: BotOpts, t: number): BotCmd {
  const d = game.dog;
  const trial = !!game.trials.run;
  const flock: Animal[] = (o.flock ?? game.animals).filter((a) => !a.pen && !a.gone && !a.carried && a.trial === trial);
  if (!flock.length) return { x: 0, y: 0, sprint: false, lie: false, bark: false };
  // Lambs keep to their mothers: read the flock by the grown animals.
  const grown = flock.some((a) => !a.young) ? flock.filter((a) => !a.young) : flock;
  let cx = 0, cy = 0;
  for (const a of grown) { cx += a.x; cy += a.y; }
  cx /= grown.length;
  cy /= grown.length;
  const sp = grown[0].sp;
  const fN = sp.nbr * 0.55 * Math.sqrt(grown.length);
  let far = grown[0], fd = 0;
  for (const a of grown) {
    const dd = Math.hypot(a.x - cx, a.y - cy);
    if (dd > fd) { fd = dd; far = a; }
  }
  let tx: number, ty: number;
  if (o.chase) {
    let tgt = flock[0], td = 1e9;
    for (const a of flock) { const dd = Math.hypot(a.x - d.x, a.y - d.y); if (dd < td) { td = dd; tgt = a; } }
    const mx = tgt.x - d.x, my = tgt.y - d.y;
    const l = Math.hypot(mx, my) || 1;
    return { x: mx / l, y: my / l, sprint: !!o.sprint, lie: false, bark: false };
  }
  if (fd > fN) {
    // Collect: get behind the furthest animal and push it back in.
    const l = fd || 1;
    tx = far.x + ((far.x - cx) / l) * sp.flight * 0.4;
    ty = far.y + ((far.y - cy) / l) * sp.flight * 0.4;
  } else {
    // Drive: stand behind the flock, opposite the goal.
    const gx = cx - o.goalX, gy = cy - o.goalY;
    const gl = Math.hypot(gx, gy) || 1;
    const back = sp.flight * (0.45 - 0.4 * (o.crowd ?? 0)) + fd * 0.7;
    tx = cx + (gx / gl) * back;
    ty = cy + (gy / gl) * back;
  }
  // Flank round the flock instead of walking through it.
  const rx = d.x - cx, ry = d.y - cy;
  const rl = Math.hypot(rx, ry) || 1;
  const wx = tx - cx, wy = ty - cy;
  const wl = Math.hypot(wx, wy) || 1;
  const cosA = (rx * wx + ry * wy) / (rl * wl);
  const flankR = fd + sp.flight * 0.8;
  let mx = tx - d.x, my = ty - d.y;
  if (cosA < 0.6 && rl < flankR * 1.3) {
    const cross = rx * wy - ry * wx;
    const s = cross > 0 ? 1 : -1;
    mx = (-ry / rl) * s + (rx / rl) * (flankR - rl) / flankR;
    my = (rx / rl) * s + (ry / rl) * (flankR - rl) / flankR;
  }
  const ml = Math.hypot(mx, my);
  const dist = Math.hypot(tx - d.x, ty - d.y);
  if (o.keyboard) {
    if (dist < 4 || ml === 0) return { x: 0, y: 0, sprint: false, lie: false, bark: false };
    const ang = Math.round(Math.atan2(my, mx) / (Math.PI / 4)) * (Math.PI / 4);
    const bark = !!o.bark && Math.floor(t / o.bark) !== Math.floor((t - 1 / 60) / o.bark);
    return { x: Math.cos(ang), y: Math.sin(ang), sprint: !!o.sprint, lie: false, bark };
  }
  if (o.nip && fd <= fN) {
    // Get right behind the rearmost animal and nip it on.
    const gx = o.goalX - cx, gy = o.goalY - cy;
    const gl = Math.hypot(gx, gy) || 1;
    let rear = grown[0], rd = 1e9;
    for (const a of grown) { const p = (a.x - cx) * gx / gl + (a.y - cy) * gy / gl; if (p < rd) { rd = p; rear = a; } }
    const bx = rear.x - (gx / gl) * (rear.sp.r + 6), by = rear.y - (gy / gl) * (rear.sp.r + 6);
    const nx = bx - d.x, ny = by - d.y, nl = Math.hypot(nx, ny);
    const close = Math.hypot(rear.x - d.x, rear.y - d.y) < rear.sp.r + 9;
    const nipNow = close && d.nipCd <= 0 && Math.floor(t * 1.2) !== Math.floor((t - 1 / 60) * 1.2);
    if (nipNow) { d.hx = (rear.x - d.x) / (Math.hypot(rear.x - d.x, rear.y - d.y) || 1); d.hy = (rear.y - d.y) / (Math.hypot(rear.x - d.x, rear.y - d.y) || 1); }
    return { x: nl > 1 ? (nx / nl) * Math.min(1, nl / 6) : 0, y: nl > 1 ? (ny / nl) * Math.min(1, nl / 6) : 0, sprint: false, lie: false, bark: false, nip: nipNow, tx: bx, ty: by };
  }
  const k = ml > 0 ? Math.min(1, dist / 6) / ml : 0;
  const bark = !!o.bark && Math.floor(t / o.bark) !== Math.floor((t - 1 / 60) / o.bark);
  return { x: mx * k, y: my * k, sprint: !!o.sprint || dist > 120, lie: false, bark, tx, ty };
}

// Where a trial flock should go next: just past the next gate, the post, or
// up to the pen gate and then in.
export function trialGoal(game: Game): { x: number; y: number } | null {
  const r = game.trials.run;
  if (!r) return null;
  const c = game.ranch.course;
  const id = PARTS[r.step]?.id;
  if (!id) return null;
  if (id === 'post') return c.post;
  if (id === 'pen') {
    const flock = r.flock.filter((a) => !a.pen && !a.gone);
    let cx = 0, cy = 0;
    for (const a of flock) { cx += a.x; cy += a.y; }
    cx /= Math.max(1, flock.length);
    cy /= Math.max(1, flock.length);
    const front = c.pen.gatePoint(18);
    return Math.hypot(cx - front.x, cy - front.y) < 22 ? c.pen.gatePoint(-14) : front;
  }
  const g = c.gates.find((x) => x.id === (id === 'lift' ? 'fetch' : id))!;
  return { x: g.x + g.dx * 30, y: g.y + g.dy * 30 };
}

// Run a whole trial under bot control (the run must have been started).
export function runTrial(game: Game, o: Omit<BotOpts, 'goalX' | 'goalY'>, maxSeconds = 260): TrialResult | null {
  const dt = 1 / 60;
  let t = 0;
  while (t < maxSeconds && game.trials.run && !game.trials.result) {
    const goal = trialGoal(game) ?? game.ranch.course.post;
    const c = botStep(game, { ...o, goalX: goal.x, goalY: goal.y }, t);
    game.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    if (c.bark) game.input.push('bark');
    if (c.nip) game.input.push('nip');
    game.update(dt);
    game.input.clearQueue();
    t += dt;
  }
  game.input.override = null;
  return game.trials.result;
}

export interface SimResult {
  seconds: number;
  reached: boolean;
  meanStress: number;
  peakStress: number;
  maxGroups: number;
  panics: number;
}

// Fast-forward the game under bot control.
export function runSim(game: Game, o: BotOpts & { untilPenned?: boolean }, maxSeconds: number, reach = 24): SimResult {
  const dt = 1 / 60;
  let t = 0, sumS = 0, nS = 0, peak = 0, maxGroups = 0, panics = 0, reached = false;
  const wasPanic = new Set<Animal>();
  while (t < maxSeconds) {
    // Keep the clock in daylight so long runs never end the day.
    if (game.day.t > 200) game.day.t = 20;
    const c = botStep(game, o, t);
    game.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    if (c.bark) game.input.push('bark');
    if (c.nip) game.input.push('nip');
    game.update(dt);
    game.input.clearQueue();
    t += dt;
    const flock = game.animals.filter((a) => !a.pen && !a.gone);
    let cx = 0, cy = 0;
    for (const a of flock) {
      cx += a.x; cy += a.y; sumS += a.stress; nS++;
      peak = Math.max(peak, a.stress);
      if (a.panicT > 0 && !wasPanic.has(a)) { panics++; wasPanic.add(a); }
      if (a.panicT <= 0) wasPanic.delete(a);
    }
    maxGroups = Math.max(maxGroups, game.groups.length);
    if (o.untilPenned) {
      if (!flock.length) { reached = true; break; }
    } else if (flock.length) {
      cx /= flock.length; cy /= flock.length;
      if (Math.hypot(cx - o.goalX, cy - o.goalY) < reach) { reached = true; break; }
    }
  }
  game.input.override = null;
  return { seconds: +t.toFixed(1), reached, meanStress: +(sumS / Math.max(1, nS)).toFixed(3), peakStress: +peak.toFixed(2), maxGroups, panics };
}
