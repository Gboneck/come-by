import { CS, MH, MW, TS, type WorldMap } from './map';
import { clearLine } from './collide';

// A* over 8px tiles. A tile is open when none of its four collision cells
// block. Returns world-pixel waypoints (tile centres), string-pulled.

function tileOpen(map: WorldMap, tx: number, ty: number, mask: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false;
  const cx = tx * 2, cy = ty * 2;
  return ((map.cell(cx, cy) | map.cell(cx + 1, cy) | map.cell(cx, cy + 1) | map.cell(cx + 1, cy + 1)) & mask) === 0;
}

class Heap {
  k: number[] = [];
  v: number[] = [];
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p];
      i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop(): number {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c];
        i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.k.length; }
}

const g = new Float32Array(MW * MH);
const from = new Int32Array(MW * MH);
const stamp = new Uint32Array(MW * MH);
let gen = 1;

export function findPath(map: WorldMap, sx: number, sy: number, tx: number, ty: number, mask: number, maxNodes = 6000): { x: number; y: number }[] | null {
  let s0 = Math.floor(sx / TS), s1 = Math.floor(sy / TS);
  const t0 = Math.floor(tx / TS), t1 = Math.floor(ty / TS);
  if (!tileOpen(map, s0, s1, mask)) {
    // Start from the nearest open neighbour.
    let found = false;
    for (let r = 1; r <= 2 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r && !found; dx++)
          if (tileOpen(map, s0 + dx, s1 + dy, mask)) { s0 += dx; s1 += dy; found = true; }
    if (!found) return null;
  }
  gen++;
  const start = s1 * MW + s0, goal = t1 * MW + t0;
  const open = new Heap();
  g[start] = 0;
  stamp[start] = gen;
  from[start] = -1;
  const h = (i: number) => {
    const x = i % MW, y = (i / MW) | 0;
    const dx = Math.abs(x - t0), dy = Math.abs(y - t1);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  open.push(h(start), start);
  let best = start, bestH = h(start), n = 0;
  while (open.size && n++ < maxNodes) {
    const cur = open.pop();
    if (cur === goal) { best = cur; bestH = 0; break; }
    const hc = h(cur);
    if (hc < bestH) { bestH = hc; best = cur; }
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!tileOpen(map, nx, ny, mask)) continue;
        // No corner cutting.
        if (dx && dy && (!tileOpen(map, cx + dx, cy, mask) || !tileOpen(map, cx, cy + dy, mask))) continue;
        const ni = ny * MW + nx;
        const ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (stamp[ni] === gen && ng >= g[ni]) continue;
        stamp[ni] = gen;
        g[ni] = ng;
        from[ni] = cur;
        open.push(ng + h(ni), ni);
      }
  }
  // Walk back from the goal (or the closest we got).
  const tiles: number[] = [];
  for (let i = best; i !== -1; i = from[i]) tiles.push(i);
  tiles.reverse();
  const pts = tiles.map((i) => ({ x: (i % MW) * TS + TS / 2, y: ((i / MW) | 0) * TS + TS / 2 }));
  if (best === goal) pts.push({ x: tx, y: ty });
  // String-pull: drop waypoints we can see past.
  const out: { x: number; y: number }[] = [];
  let ax = sx, ay = sy;
  for (let i = 0; i < pts.length; i++) {
    const nxt = pts[i + 1];
    if (nxt && clearLine(map, ax, ay, nxt.x, nxt.y, mask)) continue;
    out.push(pts[i]);
    ax = pts[i].x;
    ay = pts[i].y;
  }
  void CS;
  return out;
}

// Follows a path, re-planning now and then. Use one per agent.
export class PathFollower {
  pts: { x: number; y: number }[] = [];
  private tx = 0;
  private ty = 0;
  private age = 99;

  // Next point to steer at, heading for (tx, ty).
  next(map: WorldMap, x: number, y: number, tx: number, ty: number, mask: number, dt: number): { x: number; y: number } {
    this.age += dt;
    const moved = Math.hypot(tx - this.tx, ty - this.ty) > 24;
    if (clearLine(map, x, y, tx, ty, mask)) {
      this.pts = [];
      return { x: tx, y: ty };
    }
    if (moved || this.age > 1.2 || !this.pts.length) {
      this.pts = findPath(map, x, y, tx, ty, mask) ?? [];
      this.tx = tx;
      this.ty = ty;
      this.age = 0;
    }
    while (this.pts.length && Math.hypot(this.pts[0].x - x, this.pts[0].y - y) < 6) this.pts.shift();
    if (this.pts.length > 1 && clearLine(map, x, y, this.pts[1].x, this.pts[1].y, mask)) this.pts.shift();
    return this.pts[0] ?? { x: tx, y: ty };
  }
}
