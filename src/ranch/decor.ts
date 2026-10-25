import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import type { Drawable } from '../art/buildings';
import { TS } from '../world/map';

// Little touches that make the ranch visibly grow with each tier. They do
// not collide, and hide when the player builds over them.
export type DecorKind = 'sign' | 'mailbox' | 'lantern' | 'flowers' | 'hay' | 'well' | 'bench' | 'flag';

export interface Decor {
  kind: DecorKind;
  x: number; // tile coords (ground point)
  y: number;
  tier: number;
}

export const DECOR: Decor[] = [
  { kind: 'sign', x: 119, y: 99, tier: 1 },
  { kind: 'mailbox', x: 92, y: 100, tier: 1 },
  { kind: 'flowers', x: 87, y: 100, tier: 2 },
  { kind: 'flowers', x: 94, y: 99, tier: 2 },
  { kind: 'hay', x: 84, y: 97, tier: 2 },
  { kind: 'lantern', x: 99, y: 102, tier: 2 },
  { kind: 'lantern', x: 115, y: 102, tier: 2 },
  { kind: 'well', x: 84, y: 101, tier: 3 },
  { kind: 'lantern', x: 99, y: 88, tier: 3 },
  { kind: 'hay', x: 85, y: 93, tier: 3 },
  { kind: 'lantern', x: 77, y: 102, tier: 4 },
  { kind: 'flowers', x: 90, y: 101, tier: 4 },
  { kind: 'bench', x: 95, y: 101, tier: 4 },
  { kind: 'lantern', x: 92, y: 110, tier: 4 },
  { kind: 'flag', x: 99, y: 100, tier: 5 },
  { kind: 'flowers', x: 101, y: 106, tier: 5 },
  { kind: 'lantern', x: 108, y: 116, tier: 5 },
  { kind: 'lantern', x: 80, y: 114, tier: 5 },
];

export function decorDrawable(g: CanvasRenderingContext2D, d: Decor, t: number, tierName: string, night: boolean): Drawable {
  const x = d.x * TS + 4, y = d.y * TS + 6;
  return { y, draw: () => drawDecor(g, d.kind, x, y, t, tierName, night) };
}

function drawDecor(g: CanvasRenderingContext2D, kind: DecorKind, x: number, y: number, t: number, tierName: string, night: boolean) {
  switch (kind) {
    case 'sign': {
      const label = `COME BY ${tierName}`;
      const w = label.length * 4 + 5;
      rect(g, x - 1, y - 9, 2, 10, C.plum);
      rect(g, x + w - 6, y - 9, 2, 10, C.plum);
      rect(g, x - 3, y - 16, w + 2, 9, C.plum);
      rect(g, x - 2, y - 15, w, 7, C.wool);
      text(g, label, x + 1, y - 14, C.plum);
      rect(g, x - 4, y + 1, w + 2, 1, C.sage);
      break;
    }
    case 'mailbox':
      rect(g, x, y - 6, 1, 7, C.plum);
      rect(g, x - 2, y - 9, 5, 3, C.wool);
      rect(g, x - 2, y - 9, 5, 1, C.plum);
      px(g, x + 3, y - 10, C.butter);
      break;
    case 'lantern': {
      rect(g, x - 2, y + 1, 4, 1, C.sage);
      rect(g, x, y - 10, 1, 11, C.plum);
      rect(g, x - 1, y - 13, 3, 3, night ? C.butter : C.wool);
      rect(g, x - 1, y - 14, 3, 1, C.plum);
      break;
    }
    case 'flowers':
      for (let i = 0; i < 7; i++) {
        const fx = x - 5 + ((i * 5) % 11), fy = y - (i % 3);
        px(g, fx, fy, C.sage);
        px(g, fx, fy - 1, i % 3 === 0 ? C.wool : C.butter);
      }
      break;
    case 'hay':
      rect(g, x - 4, y - 4, 8, 5, C.butter);
      rect(g, x - 4, y + 1, 8, 1, C.sage);
      line(g, x - 4, y - 2, x + 3, y - 2, C.moss);
      rect(g, x - 1, y - 4, 1, 5, C.plum);
      break;
    case 'well':
      rect(g, x - 5, y - 4, 10, 5, C.wool);
      rect(g, x - 4, y - 4, 8, 2, C.teal);
      rect(g, x - 5, y + 1, 10, 1, C.sage);
      rect(g, x - 5, y - 12, 1, 9, C.plum);
      rect(g, x + 4, y - 12, 1, 9, C.plum);
      rect(g, x - 6, y - 13, 12, 2, C.plum);
      rect(g, x, y - 11, 1, 5, C.wool);
      break;
    case 'bench':
      rect(g, x - 4, y - 3, 9, 2, C.plum);
      rect(g, x - 4, y - 1, 1, 2, C.plum);
      rect(g, x + 4, y - 1, 1, 2, C.plum);
      rect(g, x - 4, y - 5, 9, 1, C.plum);
      break;
    case 'flag': {
      rect(g, x, y - 18, 1, 19, C.plum);
      const wave = Math.floor(t * 3) % 2;
      rect(g, x + 1, y - 18, 6, 2, C.butter);
      rect(g, x + 1, y - 16 + wave, 6, 2, C.wool);
      break;
    }
  }
}

// Night light from decor (lanterns) in world pixels: a pool on the ground
// round the lantern's foot.
export function decorLights(tier: number): { x: number; y: number; r: number }[] {
  return DECOR.filter((d) => d.kind === 'lantern' && d.tier <= tier).map((d) => ({ x: d.x * TS + 4, y: d.y * TS + 2, r: 36 }));
}

// The lit lanterns' own glow, drawn above the dark.
export function drawLampGlow(g: CanvasRenderingContext2D, tier: number, t: number) {
  for (const d of DECOR) {
    if (d.kind !== 'lantern' || d.tier > tier) continue;
    const x = d.x * TS + 4, y = d.y * TS + 6 - 12;
    rect(g, x - 1, y - 1, 3, 3, C.butter);
    if (Math.sin(t * 9 + d.x) > -0.6) {
      px(g, x, y - 3, C.butter);
      px(g, x - 3, y, C.butter);
      px(g, x + 3, y, C.butter);
    }
  }
}
