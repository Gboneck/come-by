// The whole game is drawn with these eight colours. Bandana red is the single
// accent outside the reference palette and only ever appears on the player.
export const C = {
  meadow: '#A3AD6E',
  moss: '#8E9F6C',
  sage: '#6F8F7C',
  teal: '#487282',
  plum: '#42315A',
  wool: '#D4D0C6',
  butter: '#E2D27A',
  red: '#C8483C',
} as const;

export type ColorName = keyof typeof C;

function pack(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // ImageData is RGBA in memory; on little-endian that is ABGR as a uint32.
  // Unsigned, so it compares equal to a pixel read back from a Uint32Array.
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const U32 = Object.fromEntries(
  Object.entries(C).map(([k, v]) => [k, pack(v)]),
) as Record<ColorName, number>;

// Sprite grid characters.
export const CHAR: Record<string, string> = {
  m: C.meadow,
  o: C.moss,
  s: C.sage,
  t: C.teal,
  p: C.plum,
  w: C.wool,
  y: C.butter,
  r: C.red,
};
