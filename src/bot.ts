import type { Game } from './game';
import type { Animal } from './entities/animal';

// A simple herding controller (collect strays, then drive from behind),
// after Strömbom et al. 2014. Used for tuning runs and, later, helper dogs.
export interface BotOpts {
  goalX: number;
  goalY: number;
  bark?: number; // seconds between barks (0 = never)
  sprint?: boolean;
  crowd?: number; // 0..1: how far inside the flight zone the bot pushes
  keyboard?: boolean; // 8 directions, full speed or stopped, like a key player
  chase?: boolean; // naive: run straight at the middle of the flock
}

export function botStep(game: Game, o: BotOpts, t: number): { x: number; y: number; sprint: boolean; lie: boolean; bark: boolean } {
  const d = game.dog;
  const flock: Animal[] = game.animals.filter((a) => !a.pen && !a.gone);
  if (!flock.length) return { x: 0, y: 0, sprint: false, lie: false, bark: false };
  let cx = 0, cy = 0;
  for (const a of flock) { cx += a.x; cy += a.y; }
  cx /= flock.length;
  cy /= flock.length;
  const sp = flock[0].sp;
  const fN = sp.nbr * 0.55 * Math.sqrt(flock.length);
  let far = flock[0], fd = 0;
  for (const a of flock) {
    const dd = Math.hypot(a.x - cx, a.y - cy);
    if (dd > fd) { fd = dd; far = a; }
  }
  let tx: number, ty: number;
  if (o.chase) {
    const mx = cx - d.x, my = cy - d.y;
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
  const k = ml > 0 ? Math.min(1, dist / 6) / ml : 0;
  const bark = !!o.bark && Math.floor(t / o.bark) !== Math.floor((t - 1 / 60) / o.bark);
  return { x: mx * k, y: my * k, sprint: !!o.sprint || dist > 120, lie: false, bark };
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
    const c = botStep(game, o, t);
    game.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    if (c.bark) game.input.push('bark');
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
