export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
export const dist = (ax: number, ay: number, bx: number, by: number) => len(bx - ax, by - ay);
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
// Frame-rate independent exponential smoothing factor.
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export const angleDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const TAU = Math.PI * 2;
