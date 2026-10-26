// Animated water: where each body of water is, whether it flows, and the
// stepping stones in it. The highlights themselves are drawn each frame on
// the fine grid (render/sway.ts drawWater): the river carries little dashes
// downstream and ripples round the stepping stones; still water glints and
// twinkles; rings spread near the banks.

export const WATER_FRAMES = 16;
export const WATER_FPS = 8;

export interface WaterAnim {
  x: number;
  y: number;
  w: number;
  h: number;
  flowing: boolean;
  stones: { x: number; y: number }[];
}

export function makeWaterAnim(x0: number, y0: number, w: number, h: number, flowing: boolean, stones: { x: number; y: number }[]): WaterAnim {
  return { x: x0, y: y0, w, h, flowing, stones };
}
