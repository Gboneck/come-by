import { CS, WORLD_H, WORLD_W, type WorldMap } from './map';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// If the centre has ended up inside a blocked cell (squeezed by others),
// move it into the nearest open cell rather than through the wall.
function rescue(map: WorldMap, b: Body, mask: number): boolean {
  const cx = Math.floor(b.x / CS), cy = Math.floor(b.y / CS);
  if ((map.cell(cx, cy) & mask) === 0) return false;
  let best = 1e9, bx = b.x, by = b.y;
  for (let r = 1; r <= 6 && best === 1e9; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if ((map.cell(cx + dx, cy + dy) & mask) !== 0) continue;
        const L = (cx + dx) * CS, T = (cy + dy) * CS;
        const px = Math.min(Math.max(b.x, L + 0.5), L + CS - 0.5);
        const py = Math.min(Math.max(b.y, T + 0.5), T + CS - 0.5);
        const d = (px - b.x) ** 2 + (py - b.y) ** 2;
        if (d < best) { best = d; bx = px; by = py; }
      }
  }
  if (best === 1e9) return false;
  b.x = bx;
  b.y = by;
  b.vx = 0;
  b.vy = 0;
  return true;
}

// Push a circle out of blocked cells and kill velocity into walls.
export function collideCircle(map: WorldMap, b: Body, r: number, mask: number): boolean {
  let any = rescue(map, b, mask);
  for (let iter = 0; iter < 3; iter++) {
    let hit = false;
    const x0 = Math.floor((b.x - r) / CS), x1 = Math.floor((b.x + r) / CS);
    const y0 = Math.floor((b.y - r) / CS), y1 = Math.floor((b.y + r) / CS);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if ((map.cell(cx, cy) & mask) === 0) continue;
        const L = cx * CS, T = cy * CS;
        const px = b.x < L ? L : b.x > L + CS ? L + CS : b.x;
        const py = b.y < T ? T : b.y > T + CS ? T + CS : b.y;
        const dx = b.x - px, dy = b.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const push = r - d;
        b.x += nx * push;
        b.y += ny * push;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= vn * nx; b.vy -= vn * ny; }
        hit = true;
      }
    }
    if (!hit) break;
    any = true;
  }
  if (rescue(map, b, mask)) any = true;
  if (b.x < r) b.x = r;
  if (b.y < r) b.y = r;
  if (b.x > WORLD_W - r) b.x = WORLD_W - r;
  if (b.y > WORLD_H - r) b.y = WORLD_H - r;
  return any;
}

// Soft repulsion from nearby walls, for steering around obstacles.
export function wallRepulse(map: WorldMap, x: number, y: number, range: number, mask: number, out: { x: number; y: number }) {
  out.x = 0;
  out.y = 0;
  const x0 = Math.floor((x - range) / CS), x1 = Math.floor((x + range) / CS);
  const y0 = Math.floor((y - range) / CS), y1 = Math.floor((y + range) / CS);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if ((map.cell(cx, cy) & mask) === 0) continue;
      const L = cx * CS, T = cy * CS;
      const px = x < L ? L : x > L + CS ? L + CS : x;
      const py = y < T ? T : y > T + CS ? T + CS : y;
      const dx = x - px, dy = y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= range || d < 1e-4) continue;
      const w = (1 - d / range);
      out.x += (dx / d) * w * w;
      out.y += (dy / d) * w * w;
    }
  }
}

// Is there a clear straight line (sampled) between two points?
export function clearLine(map: WorldMap, ax: number, ay: number, bx: number, by: number, mask: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 3);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (map.blockedPx(ax + (bx - ax) * t, ay + (by - ay) * t, mask)) return false;
  }
  return true;
}
