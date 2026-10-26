import { C } from '../palette';
import { ROOFS, TRIMS, farmLook } from './ranchstyle';
import { line, rect, px } from '../gfx/draw';
import { hash2 } from '../rng';
import { lightLook, seasonLook, snowCap } from './seasonlook';
import type { Building, RegionGate } from '../ranch/buildings';
import type { FieldGate, Fence, Barn, Kennel, Market, Windmill } from '../ranch/structures';
import { CS } from '../world/map';

export interface Drawable {
  y: number;
  draw: () => void;
}

// Buildings stand up a little (3/4 view) and are lit from the upper right:
// shadows fall down-left on the ground, left-hand faces are shaded. Each
// building's ground shadow is its own drawable sorted first, so it never
// lands on anything standing in front of it.
const shadowFirst = (b: Building, draw: () => void): Drawable => ({ y: -1e8 + b.id, draw });

// A standing thing's shadow on the ground: its silhouette (x0..x1 across,
// top..y1 tall) shifted the way the sun throws it (long and to the west at
// sunrise, east in the golden hour), and a soft dithered contact shadow
// hugging its foot.
export function groundShadow(g: CanvasRenderingContext2D, x0: number, top: number, x1: number, y1: number) {
  const sx = Math.round(lightLook.dx * 0.8), sy = Math.round(lightLook.dy * 0.5);
  rect(g, x0 + sx, top + sy, x1 - x0, y1 - top, C.sage);
  for (let x = x0 - 1; x <= x1; x++) {
    px(g, x, y1, C.sage);
    if ((x & 1) === 0) px(g, x, y1 + 1, C.sage);
  }
}

// ---- Fences ----
// Plum posts every 8px, wool rails, a sage line of shadow on the ground.
// They are not new: posts differ a little in height, some caps have greyed,
// a rail has the odd knot. An upgraded (sturdy) fence has thick capped posts
// on stone footings and a third rail.

// Rails are pale wood; in snow they show dark and wet against the white.
export const railCol = (): string => (seasonLook.snow > 0.4 ? C.sage : C.wool);

export const postH = (x: number, y: number) => (hash2(x, y, 401) < 0.22 ? 5 : 6);
export const postCap = (x: number, y: number) => (seasonLook.snow > 0.4 ? C.wool : hash2(x, y, 402) < 0.3 ? C.sage : C.moss);

export function post(g: CanvasRenderingContext2D, x: number, base: number, sturdy: boolean) {
  if (sturdy) {
    rect(g, x, base - 6, 2, 7, C.plum);
    rect(g, x, base - 7, 2, 1, C.wool);
    px(g, x - 1, base, C.wool);
    px(g, x + 2, base, C.sage);
    return;
  }
  const h = postH(x, base);
  rect(g, x, base - h + 1, 2, h, C.plum);
  px(g, x + (hash2(x, base, 403) < 0.5 ? 0 : 1), base - h + 1, postCap(x, base));
  if (hash2(x, base, 407) < 0.4) px(g, x - 1, base, C.moss);
  if (hash2(x, base, 408) < 0.2) px(g, x + 1, base - 2, C.teal);
}

export function hFence(g: CanvasRenderingContext2D, xa: number, xb: number, base: number, gap?: [number, number], sturdy = false) {
  const inGap = (x: number) => !!gap && x > gap[0] && x < gap[1];
  rect(g, xa, base + 1, xb - xa, 1, C.sage);
  const rc = railCol();
  for (let x = xa; x <= xb; x++) {
    if (inGap(x)) continue;
    const knot = hash2(x, base, 404) < 0.05;
    px(g, x, base - 2, rc);
    px(g, x, base - 4, knot ? C.sage : rc);
    if (sturdy) px(g, x, base - 6, rc);
  }
  for (let x = xa; x <= xb; x += 8) {
    if (inGap(x) && x !== gap![0] && x !== gap![1]) continue;
    post(g, x, base, sturdy);
  }
  if (gap) {
    post(g, gap[0], base, sturdy);
    post(g, gap[1] - 1, base, sturdy);
  }
}

// One post and the rail down to the next post of a north-south fence.
export function vFenceSeg(g: CanvasRenderingContext2D, x: number, ya: number, yb: number, rail = true, sturdy = false) {
  if (rail) {
    rect(g, x + 2, ya - 2, 1, yb - ya, C.sage);
    const rc = railCol();
    rect(g, x, ya - 4, 1, yb - ya, rc);
    rect(g, x + 1, ya - 3, 1, yb - ya, rc);
    if (sturdy) rect(g, x, ya - 6, 1, yb - ya, rc);
    const k = ya + Math.floor(hash2(x, ya, 405) * 6);
    if (hash2(x, ya, 406) < 0.4) px(g, x + 1, k - 3, C.sage);
  }
  post(g, x, ya, sturdy);
}

// A gate leaf swinging outward about its hinge. `along` is the unit vector
// along the fence from the hinge, `outward` points out of the pen.
export function gateLeaf(g: CanvasRenderingContext2D, hx: number, hy: number, along: [number, number], outward: [number, number], len: number, swing: number, flash: number) {
  const a = swing * Math.PI * 0.5;
  const ex = hx + len * (along[0] * Math.cos(a) + outward[0] * Math.sin(a));
  const ey = hy + len * (along[1] * Math.cos(a) + outward[1] * Math.sin(a));
  line(g, hx, hy + 1, ex, ey + 1, C.sage);
  const rc = railCol();
  line(g, hx, hy - 2, ex, ey - 2, rc);
  line(g, hx, hy - 4, ex, ey - 4, rc);
  // Diagonal brace.
  line(g, hx, hy - 4, (hx + ex) / 2, (hy + ey) / 2 - 2, rc);
  rect(g, ex - 0.5, ey - 5, 1, 6, C.plum);
  // Hinge straps on the rails at the post, a latch at the free end.
  const ux = (ex - hx) / Math.max(1, len), uy = (ey - hy) / Math.max(1, len);
  px(g, hx + ux, hy - 2 + uy, C.plum);
  px(g, hx + ux, hy - 4 + uy, C.plum);
  px(g, ex - ux, ey - 3 - uy, C.butter);
  if (flash > 0 && Math.floor(flash * 12) % 2 === 0) {
    px(g, ex + 1, ey - 6, C.butter);
    px(g, ex - 2, ey - 7, C.butter);
  }
}

// Pens and paddocks: see paddock.ts.

// Tiny goods: egg, wool tuft, cheese wedge, milk can.
export function drawGood(g: CanvasRenderingContext2D, sp: string, x: number, y: number) {
  switch (sp) {
    case 'duck':
      rect(g, x, y, 2, 2, C.wool);
      px(g, x, y + 2, C.sage);
      break;
    case 'sheep':
      rect(g, x, y + 1, 3, 2, C.wool);
      px(g, x + 1, y, C.wool);
      break;
    case 'goat':
      rect(g, x, y + 1, 3, 2, C.butter);
      px(g, x, y, C.butter);
      px(g, x + 1, y + 2, C.plum);
      break;
    case 'cow':
      rect(g, x, y, 2, 3, C.wool);
      rect(g, x, y, 2, 1, C.plum);
      break;
  }
}

// ---- Shared pieces ----

// A hipped roof seen from the front: plum, staggered teal shingle courses,
// a sage ridge, the right hip catching the light and the left in shade.
function hipRoof(g: CanvasRenderingContext2D, xa: number, xb: number, top: number, eave: number, hip: number, base: string = C.plum, course: string = C.teal) {
  const rh = eave - top;
  for (let y = top; y < eave; y++) {
    const k = y - top;
    const inset = Math.round(hip * (1 - k / Math.max(1, rh - 1)));
    const a = xa + inset, b = xb - inset;
    rect(g, a, y, b - a, 1, base);
    const c = eave - 1 - y;
    if (c > 0 && c % 3 === 0 && k > 0) for (let x = a + 1; x < b - 1; x++) if ((x + (c / 3) * 2) % 5 !== 0) px(g, x, y, course);
    px(g, a, y, C.plum);
    if (k > 0) px(g, b - 1, y, C.sage);
  }
  const inset = hip;
  rect(g, xa + inset, top, xb - xa - inset * 2, 1, C.sage);
  rect(g, xa, eave - 1, xb - xa, 1, C.plum);
  // Moss creeping up from the eaves on the shady side, and along the hip.
  for (let x = xa; x < xb; x++) {
    const shade = 1 - (x - xa) / (xb - xa);
    if (hash2(x, eave, 420) < 0.55 * shade) px(g, x, eave - 1, C.moss);
    if (hash2(x, eave, 421) < 0.25 * shade) px(g, x, eave - 2, C.moss);
  }
  for (let y = top + 2; y < eave - 1; y++) {
    const k = y - top;
    const a = xa + Math.round(hip * (1 - k / Math.max(1, rh - 1)));
    if (hash2(a, y, 422) < 0.35) px(g, a + 1, y, C.moss);
    if (hash2(xa, y, 423) < 0.03) px(g, xa + 4 + Math.floor(hash2(y, xa, 424) * (xb - xa - 8)), y, C.plum);
  }
  // Winter: snow lies on the upper roof, the shingle courses showing
  // through as sage, its lower edge lumpy; icicles hang from the eaves.
  const sn = seasonLook.snow;
  if (sn > 0.2) {
    const depth = Math.round(rh * (0.2 + sn * 0.6));
    for (let y = top; y < Math.min(eave - 1, top + depth + 1); y++) {
      const k = y - top;
      const a = xa + Math.round(hip * (1 - k / Math.max(1, rh - 1))), b = xb - Math.round(hip * (1 - k / Math.max(1, rh - 1)));
      const c = eave - 1 - y;
      for (let x = a; x < b; x++) {
        if (k === depth && hash2(x, y, 425) < 0.5) continue;
        px(g, x, y, c > 0 && c % 3 === 0 && (x + (c / 3) * 2) % 5 !== 0 && k > 1 ? C.sage : C.wool);
      }
    }
    snowCap(g, xa, eave - 1, xb - xa, eave);
  }
}

// A window with a plum frame, mullions, sage shutters and a glint on the
// glass by day; lit buttercup at night.
function windowAt(g: CanvasRenderingContext2D, wx: number, wy: number, night: boolean, w = 5, h = 3, shutters = true, trim: string = C.sage) {
  rect(g, wx - 1, wy - 1, w + 2, h + 2, C.plum);
  rect(g, wx, wy, w, h, night ? C.butter : C.teal);
  rect(g, wx + (w >> 1), wy, 1, h, C.plum);
  if (h >= 3) rect(g, wx, wy + 1, w, 1, C.plum);
  if (!night) px(g, wx + w - 1, wy, C.wool);
  if (shutters) {
    rect(g, wx - 2, wy - 1, 1, h + 2, trim);
    rect(g, wx + w + 1, wy - 1, 1, h + 2, trim);
  }
}

// Brick chimney with a sage cap.
function chimney(g: CanvasRenderingContext2D, x: number, top: number, h: number) {
  rect(g, x, top, 4, h, C.plum);
  for (let y = top + 2; y < top + h - 1; y += 2) px(g, x + ((y >> 1) & 1 ? 1 : 2), y, C.sage);
  rect(g, x - 1, top, 6, 1, C.sage);
  snowCap(g, x - 1, top - 1, 6);
}

// ---- Farmhouse: a whitewashed cabin that grows with the ranch. ----
// Tier 1: a cabin. 2: flower boxes, a door hood, a stone path. 3: a second
// storey with dormers. 4: a porch and the flag. 5: a second chimney, a
// weathervane and lamps by the door.

const FH_TOP = (b: Building) => b.y0 - (b.level >= 3 ? 12 : 7);

// The farmhouse's lit windows at night, as rects (x, y, w, h), for the glow
// drawn round them above the dark (render/world.ts). Matches drawFarmhouse.
export function farmhouseWindows(b: Building): [number, number, number, number][] {
  const x0 = b.x0, x1 = b.x1, y1 = b.y1, two = b.level >= 3;
  const eave = y1 - (two ? 18 : 11), wy = y1 - 8;
  const out: [number, number, number, number][] = [];
  for (const wx of two ? [x0 + 5, x0 + 17, x1 - 22, x1 - 10] : [x0 + 5, x1 - 10]) out.push([wx, wy, 5, 3]);
  if (two) for (const wx of [x0 + 6, x0 + 18, x1 - 21, x1 - 9]) out.push([wx, eave + 3, 4, 3]);
  return out;
}

// A soft glow round a lit window, drawn above the night: a dithered ring of
// buttercup that fades out from the frame.
export function windowGlow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  const fl = Math.sin(t * 5 + x) > 0.85 ? 1 : 0;
  for (let yy = y - 3; yy <= y + h + 2; yy++)
    for (let xx = x - 3; xx <= x + w + 2; xx++) {
      const d = Math.max(x - 1 - xx, xx - (x + w), y - 1 - yy, yy - (y + h));
      if (d < 1) continue;
      if (d === 1 ? ((xx + yy) & 1) === 0 : d === 2 + fl ? ((xx + yy) & 3) === 0 : false) px(g, xx, yy, C.butter);
    }
}

// Where the chimney smoke leaves the farmhouse (see render/life.ts).
export function chimneyTop(b: Building): { x: number; y: number } {
  return { x: b.x1 - 10, y: FH_TOP(b) - 6 };
}

export function farmhouseDrawable(g: CanvasRenderingContext2D, b: Building, night: boolean, t = 0): Drawable[] {
  return [
    shadowFirst(b, () => groundShadow(g, b.x0, FH_TOP(b) + 3, b.x1, b.y1)),
    { y: b.y1, draw: () => drawFarmhouse(g, b, night, t) },
  ];
}

function drawFarmhouse(g: CanvasRenderingContext2D, b: Building, night: boolean, t: number) {
  const lvl = b.level;
  const x0 = b.x0, x1 = b.x1, y1 = b.y1;
  const w = x1 - x0;
  const two = lvl >= 3;
  const wallH = two ? 18 : 11;
  const roofTop = FH_TOP(b);
  const eave = y1 - wallH;

  // Walls: whitewashed boards, the left corner and the band under the eave
  // in shade, a footing of stones.
  rect(g, x0 + 1, eave, w - 2, wallH, C.wool);
  for (let y = eave + 3; y < y1 - 1; y += 3) for (let x = x0 + 2; x < x1 - 2; x++) if ((x * 7 + y) % 9 === 0) px(g, x, y, C.sage);
  rect(g, x0 + 1, eave, 1, wallH, C.sage);
  rect(g, x0 + 1, eave, w - 2, 1, C.sage);
  rect(g, x0 + 1, y1 - 1, w - 2, 1, C.sage);
  if (two) for (let x = x0 + 1; x < x1 - 1; x += 3) px(g, x, y1 - 1, C.plum);
  if (two) rect(g, x0 + 1, eave + 9, w - 2, 1, C.sage); // floor line
  // Damp and moss along the footing, thicker at the shady corner; a
  // drainpipe down the right-hand corner.
  for (let x = x0 + 1; x < x1 - 1; x++) {
    const shade = 1 - (x - x0) / w;
    if (hash2(x, y1, 430) < 0.5 * shade + 0.1) px(g, x, y1 - 2, C.moss);
    if (hash2(x, y1, 431) < 0.3 * shade) px(g, x, y1 - 3, C.moss);
  }
  rect(g, x1 - 3, eave + 1, 1, wallH - 1, C.sage);
  px(g, x1 - 3, y1 - 1, C.plum);

  // Roof and chimneys (the roof and trim are the player's choice).
  const roof = ROOFS[farmLook.roof], trim = TRIMS[farmLook.trim].color;
  hipRoof(g, x0 - 2, x1 + 2, roofTop, eave, two ? 7 : 5, roof.base, roof.course);
  chimney(g, x1 - 12, roofTop - 5, 8);
  if (lvl >= 5) chimney(g, x0 + 7, roofTop - 4, 7);
  // Dormers on the bigger house.
  if (two) {
    // A little gable with a window, sitting on the slope.
    const dy = roofTop + 9;
    for (const dx of [x0 + 13, x1 - 22]) {
      rect(g, dx + 3, dy - 3, 3, 1, C.plum);
      rect(g, dx + 2, dy - 2, 5, 1, C.plum);
      rect(g, dx + 1, dy - 1, 7, 1, C.plum);
      px(g, dx + 5, dy - 3, C.sage);
      px(g, dx + 6, dy - 2, C.sage);
      px(g, dx + 7, dy - 1, C.sage);
      rect(g, dx + 1, dy, 7, 5, C.wool);
      rect(g, dx + 1, dy, 1, 5, C.sage);
      rect(g, dx + 3, dy + 1, 3, 3, C.plum);
      rect(g, dx + 4, dy + 1, 1, 2, night ? C.butter : C.teal);
      rect(g, dx, dy + 5, 9, 1, C.plum);
    }
  }

  // Door, its frame and step.
  const doorX = x0 + Math.floor(w / 2) - 3;
  rect(g, doorX - 1, y1 - 10, 8, 10, trim);
  rect(g, doorX, y1 - 9, 6, 9, C.plum);
  rect(g, doorX + 2, y1 - 8, 1, 7, C.teal);
  px(g, doorX + 4, y1 - 5, C.butter);
  rect(g, doorX - 1, y1, 8, 1, C.wool);
  if (lvl >= 2 && lvl < 4) {
    // Door hood.
    rect(g, doorX - 3, y1 - 12, 12, 2, C.teal);
    rect(g, doorX - 3, y1 - 12, 12, 1, C.sage);
    rect(g, doorX - 3, y1 - 10, 12, 1, C.plum);
  }

  // Windows.
  const wy = y1 - 8;
  const lower = two ? [x0 + 5, x0 + 17, x1 - 22, x1 - 10] : [x0 + 5, x1 - 10];
  for (const wx of lower) windowAt(g, wx, wy, night, 5, 3, true, trim);
  if (two) for (const wx of [x0 + 6, x0 + 18, x1 - 21, x1 - 9]) windowAt(g, wx, eave + 3, night, 4, 3, true, trim);
  // Flower boxes.
  if (lvl >= 2) {
    for (const wx of lower) {
      rect(g, wx - 1, wy + 4, 7, 1, C.plum);
      px(g, wx, wy + 3, C.butter);
      px(g, wx + 2, wy + 3, C.sage);
      px(g, wx + 3, wy + 3, C.butter);
      px(g, wx + 5, wy + 3, C.wool);
    }
  }
  // Porch: a teal roof on posts along the front.
  if (lvl >= 4) {
    const pa = doorX - 7, pb = doorX + 14;
    rect(g, pa, y1 - 13, pb - pa, 2, C.teal);
    for (let x = pa + 1; x < pb - 1; x += 3) px(g, x, y1 - 13, C.sage);
    rect(g, pa, y1 - 11, pb - pa, 1, C.plum);
    for (const x of [pa + 1, pb - 2]) rect(g, x, y1 - 10, 1, 10, C.plum);
    rect(g, pa, y1, pb - pa, 1, C.wool);
  }
  // Lamps either side of the door.
  if (lvl >= 5) {
    for (const x of [doorX - 3, doorX + 8]) {
      px(g, x, y1 - 8, C.plum);
      px(g, x, y1 - 7, night || Math.floor(t * 2) % 7 === 0 ? C.butter : C.wool);
    }
  }
  // Flag on the ridge.
  if (lvl >= 4) {
    const fx = x0 + 26;
    rect(g, fx, roofTop - 10, 1, 10, C.plum);
    const wave = Math.floor(t * 3) % 2;
    rect(g, fx + 1, roofTop - 10, 5, 2, C.butter);
    rect(g, fx + 1, roofTop - 8 + wave, 4, 1, C.butter);
    px(g, fx + 5, roofTop - 8, wave ? C.butter : C.moss);
  }
  if (lvl >= 5) weathervane(g, Math.round(b.cx), roofTop, t);
}

// A gilded cockerel on a pole, turning now and then with the wind. (x, y)
// is the foot of the pole.
function weathervane(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  rect(g, x, y - 5, 1, 5, C.plum);
  const d = Math.floor(t * 0.2) % 2 ? 1 : -1;
  rect(g, x - 1, y - 7, 3, 2, C.butter);
  px(g, x + 2 * d, y - 8, C.butter);
  px(g, x - 2 * d, y - 7, C.butter);
  px(g, x - 2 * d, y - 8, C.butter);
}

// ---- Region gates: a heavy locked gate across the corridor. ----
export function regionGateDrawables(g: CanvasRenderingContext2D, rg: RegionGate, t: number): Drawable[] {
  const out: Drawable[] = [];
  if (rg.vertical) {
    const x = Math.round(rg.cx) - 1;
    const ya = rg.y0, yb = rg.y1;
    const mid = Math.round((ya + yb) / 2 / 2) * 2;
    if (rg.swing < 1) {
      // Two leaves meeting in the middle, swinging back as it opens.
      if (rg.swing <= 0.02) {
        for (let y = ya; y < yb; y += 8) {
          const y2 = Math.min(yb, y + 8);
          out.push({ y, draw: () => vFenceSeg(g, x, y, y2, true, true) });
        }
      } else {
        out.push({ y: ya, draw: () => gateLeaf(g, x, ya + 4, [0, 1], [1, 0], mid - ya - 4, rg.swing, 0) });
        out.push({ y: yb, draw: () => gateLeaf(g, x, yb - 4, [0, -1], [1, 0], yb - mid - 4, rg.swing, 0) });
      }
    } else {
      out.push({ y: ya, draw: () => vFenceSeg(g, x, ya + 4, ya + 4, false, true) });
      out.push({ y: yb, draw: () => vFenceSeg(g, x, yb - 4, yb - 4, false, true) });
    }
    if (!rg.unlocked) out.push({ y: mid + 1, draw: () => lockSign(g, x + 1, mid - 6, t) });
  } else {
    const y = Math.round(rg.cy) + 2;
    const xa = rg.x0, xb = rg.x1;
    const mid = Math.round((xa + xb) / 2);
    if (rg.swing <= 0.02) out.push({ y, draw: () => hFence(g, xa, xb, y, undefined, true) });
    else {
      out.push({ y, draw: () => gateLeaf(g, xa + 2, y, [1, 0], [0, -1], mid - xa - 2, rg.swing, 0) });
      out.push({ y, draw: () => gateLeaf(g, xb - 2, y, [-1, 0], [0, -1], xb - mid - 2, rg.swing, 0) });
    }
    if (!rg.unlocked) out.push({ y: y + 1, draw: () => lockSign(g, mid, y - 10, t) });
  }
  return out;
}

function lockSign(g: CanvasRenderingContext2D, x: number, y: number, _t: number) {
  // A little padlock sign.
  rect(g, x - 4, y, 9, 8, C.plum);
  rect(g, x - 3, y + 3, 7, 4, C.butter);
  rect(g, x - 2, y - 2, 1, 3, C.plum);
  rect(g, x + 2, y - 2, 1, 3, C.plum);
  rect(g, x - 1, y - 3, 3, 1, C.plum);
  px(g, x, y + 4, C.plum);
  px(g, x, y + 5, C.plum);
}

// ---- Free-standing fence panels and field gates ----

export function fenceDrawables(g: CanvasRenderingContext2D, f: Fence): Drawable[] {
  if (f.vertical) {
    const x = f.x0 + CS + 1;
    return [
      { y: f.y0 + 4, draw: () => vFenceSeg(g, x, f.y0 + 4, f.y1 + 4, true) },
      { y: f.y1 + 4, draw: () => vFenceSeg(g, x, f.y1 + 4, f.y1 + 4, false) },
    ];
  }
  return [{ y: f.y1 - 1, draw: () => hFence(g, f.x0, f.x1, f.y1 - 1) }];
}

export function fieldGateDrawables(g: CanvasRenderingContext2D, gt: FieldGate): Drawable[] {
  if (gt.vertical) {
    const x = gt.x0 + CS + 1;
    return [
      { y: gt.y0 + 2, draw: () => vFenceSeg(g, x, gt.y0 + 2, gt.y0 + 2, false) },
      { y: gt.y0 + 3, draw: () => gateLeaf(g, x, gt.y0 + 3, [0, 1], [1, 0], 13, gt.swing, 0) },
      { y: gt.y1 + 2, draw: () => vFenceSeg(g, x, gt.y1 + 2, gt.y1 + 2, false) },
    ];
  }
  const base = gt.y1 - 1;
  return [
    {
      y: base,
      draw: () => {
        rect(g, gt.x0, base - 5, 2, 6, C.plum);
        rect(g, gt.x1 - 2, base - 5, 2, 6, C.plum);
        gateLeaf(g, gt.x0 + 1, base, [1, 0], [0, 1], 13, gt.swing, 0);
      },
    },
  ];
}

function shadowRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  groundShadow(g, x, y, x + w, y + h);
}

// Barn: plum boards, wool trim and X-braced doors, a gambrel roof (teal)
// and a cupola. Upgraded, it gains a hayloft full of hay, a lean-to and a
// weathervane, and lanterns by the doors.
export function barnDrawable(g: CanvasRenderingContext2D, b: Barn, night: boolean, t = 0): Drawable[] {
  const x0 = b.x0, x1 = b.x1, y1 = b.y1, w = x1 - x0;
  const wallH = 15, eave = y1 - wallH, roofTop = b.y0 - 8;
  const big = b.level >= 2;
  return [
    shadowFirst(b, () => groundShadow(g, x0, roofTop + 1, x1 + (big ? 5 : 0), y1)),
    {
      y: b.y1,
      draw: () => {
        // Lean-to on the right.
        if (big) {
          rect(g, x1 - 2, y1 - 9, 7, 9, C.plum);
          for (let x = x1; x < x1 + 5; x += 2) rect(g, x, y1 - 8, 1, 7, C.teal);
          rect(g, x1 - 2, y1 - 12, 9, 3, C.teal);
          rect(g, x1 - 2, y1 - 12, 9, 1, C.sage);
          rect(g, x1 - 2, y1 - 10, 9, 1, C.plum);
        }
        rect(g, x0 + 1, eave, w - 2, wallH, C.plum);
        for (let x = x0 + 3; x < x1 - 2; x += 3) rect(g, x, eave + 1, 1, wallH - 2, C.teal);
        // Knots in the boards, moss and splashed mud at their feet.
        for (let x = x0 + 2; x < x1 - 2; x++) {
          if (hash2(x, eave, 432) < 0.08) px(g, x, eave + 3 + Math.floor(hash2(x, 0, 433) * (wallH - 6)), C.sage);
          if (hash2(x, y1, 434) < 0.45) px(g, x, y1 - 1, hash2(x, y1, 435) < 0.5 ? C.moss : C.sage);
        }
        rect(g, x0 + 1, eave, 1, wallH, C.wool);
        rect(g, x1 - 2, eave, 1, wallH, C.wool);
        rect(g, x0 + 1, eave, w - 2, 1, C.wool);
        // Doors.
        const dw = 16, dx = Math.round(b.cx - dw / 2), dh = 12;
        rect(g, dx - 1, y1 - dh - 1, dw + 2, dh + 1, C.wool);
        rect(g, dx, y1 - dh, dw, dh, night ? C.butter : C.plum);
        line(g, dx, y1 - dh, dx + dw / 2 - 1, y1 - 1, C.wool);
        line(g, dx + dw / 2 - 1, y1 - dh, dx, y1 - 1, C.wool);
        line(g, dx + dw / 2, y1 - dh, dx + dw - 1, y1 - 1, C.wool);
        line(g, dx + dw - 1, y1 - dh, dx + dw / 2, y1 - 1, C.wool);
        rect(g, dx + dw / 2 - 1, y1 - dh, 1, dh, C.wool);
        // Hay spilling from the doorway.
        for (let i = 0; i < 11; i++) px(g, dx - 2 + ((i * 7) % 21), y1 + (i % 3 === 0 ? 2 : i % 2), C.butter);
        if (big) {
          for (const lx of [dx - 4, dx + dw + 3]) {
            px(g, lx, y1 - 9, C.plum);
            px(g, lx, y1 - 8, night || Math.floor(t * 2) % 9 === 0 ? C.butter : C.wool);
          }
        }
        // Gambrel roof: steeper, darker lower slope; lit upper slope.
        const mid = roofTop + Math.round((eave - roofTop) * 0.45);
        hipRoof(g, x0 - 2, x1 + 2, mid, eave, 0, C.plum, C.teal);
        hipRoof(g, x0, x1, roofTop, mid, 3, C.teal, C.plum);
        rect(g, x0 - 2, mid, w + 4, 1, C.sage);
        // Hayloft door under the ridge.
        if (big) {
          const hx = Math.round(b.cx) - 4, hy = mid - 1;
          rect(g, hx - 1, hy - 1, 10, 7, C.wool);
          rect(g, hx, hy, 8, 5, C.plum);
          for (let i = 0; i < 8; i++) px(g, hx + i, hy + 3 + (i % 2), C.butter);
          rect(g, hx, hy + 5, 8, 1, C.butter);
        }
        // Cupola.
        const cx = Math.round(b.cx);
        rect(g, cx - 3, roofTop - 4, 7, 5, C.wool);
        rect(g, cx - 2, roofTop - 3, 1, 3, C.sage);
        rect(g, cx - 4, roofTop - 6, 9, 2, C.plum);
        rect(g, cx - 3, roofTop - 7, 7, 1, C.plum);
        rect(g, cx - 1, roofTop - 3, 3, 2, night ? C.butter : C.plum);
        if (big) weathervane(g, cx, roofTop - 7, t);
      },
    },
  ];
}

// Kennel: a little A-frame doghouse with a bowl, a bone and a name board.
export function kennelDrawable(g: CanvasRenderingContext2D, k: Kennel): Drawable[] {
  const cx = Math.round(k.cx), y1 = k.y1 - 2;
  return [
    shadowFirst(k, () => shadowRect(g, cx - 9, y1 - 14, 18, 14)),
    {
      y: k.y1,
      draw: () => {
        rect(g, cx - 8, y1 - 10, 16, 10, C.wool);
        rect(g, cx - 8, y1 - 10, 1, 10, C.sage);
        rect(g, cx - 8, y1 - 1, 16, 1, C.sage);
        // A-frame roof.
        for (let i = 0; i < 9; i++) {
          rect(g, cx - 10 + i, y1 - 10 - i, 21 - i * 2, 1, i % 3 === 0 ? C.teal : C.plum);
          px(g, cx + 10 - i, y1 - 10 - i, C.sage);
        }
        rect(g, cx - 10, y1 - 10, 21, 1, C.plum);
        if (seasonLook.snow > 0.25) for (let i = 3; i < 9; i++) rect(g, cx - 10 + i, y1 - 10 - i, 21 - i * 2, 1, C.wool);
        snowCap(g, cx - 10, y1 - 10, 21, y1 - 9);
        // Arched door and a name board.
        rect(g, cx - 3, y1 - 7, 6, 7, C.plum);
        rect(g, cx - 2, y1 - 8, 4, 1, C.plum);
        rect(g, cx - 2, y1 - 13, 5, 2, C.butter);
        px(g, cx, y1 - 13, C.plum);
        // Bowl and bone.
        rect(g, cx + 10, y1 - 2, 5, 2, C.teal);
        rect(g, cx + 11, y1 - 3, 3, 1, C.plum);
        px(g, cx + 11, y1 - 3, C.wool);
        rect(g, cx - 14, y1 - 1, 4, 1, C.wool);
        px(g, cx - 14, y1 - 2, C.wool);
        px(g, cx - 11, y1 - 2, C.wool);
      },
    },
  ];
}

// Market stall: striped awning with a scalloped edge, a counter of goods,
// crates and a basket, a price board.
export function marketDrawable(g: CanvasRenderingContext2D, m: Market): Drawable[] {
  const x0 = m.x0 + 1, x1 = m.x1 - 1, y1 = m.y1 - 1, w = x1 - x0;
  return [
    shadowFirst(m, () => shadowRect(g, x0, y1 - 22, w, 22)),
    {
      y: m.y1,
      draw: () => {
        // Posts.
        rect(g, x0 + 1, y1 - 18, 2, 18, C.plum);
        rect(g, x1 - 3, y1 - 18, 2, 18, C.plum);
        // Counter, boards and goods.
        rect(g, x0, y1 - 7, w, 7, C.plum);
        for (let x = x0 + 3; x < x1 - 1; x += 4) rect(g, x, y1 - 6, 1, 5, C.teal);
        rect(g, x0, y1 - 7, w, 1, C.moss);
        for (let x = x0 + 2; x < x1 - 2; x += 4) {
          px(g, x, y1 - 9, C.wool);
          px(g, x + 1, y1 - 9, C.wool);
          px(g, x, y1 - 8, C.wool);
          px(g, x + 1, y1 - 8, C.sage);
          px(g, x + 2, y1 - 8, C.butter);
        }
        // Crates at the sides, a basket in front.
        for (const cx of [x0 - 5, x1 + 1]) {
          rect(g, cx, y1 - 5, 5, 5, C.plum);
          rect(g, cx, y1 - 5, 5, 1, C.wool);
          rect(g, cx, y1 - 3, 5, 1, C.wool);
          px(g, cx + 1, y1 - 6, C.butter);
          px(g, cx + 3, y1 - 6, C.butter);
        }
        rect(g, x0 + 4, y1 - 1, 5, 2, C.butter);
        rect(g, x0 + 4, y1 + 1, 5, 1, C.plum);
        px(g, x0 + 5, y1 - 2, C.wool);
        px(g, x0 + 7, y1 - 2, C.wool);
        // Awning stripes and scalloped edge.
        for (let x = x0 - 1; x < x1 + 1; x++) {
          const col = Math.floor((x - x0 + 1) / 3) % 2 === 0 ? C.wool : C.butter;
          rect(g, x, y1 - 24, 1, 7, col);
          if ((x - x0) % 3 !== 2) px(g, x, y1 - 17, col);
          if ((x - x0) % 3 === 1) px(g, x, y1 - 16, col);
        }
        rect(g, x0 - 1, y1 - 25, w + 2, 1, C.plum);
        snowCap(g, x0 - 1, y1 - 26, w + 2, y1 - 16);
        rect(g, x0 - 1, y1 - 24, 1, 7, C.sage);
        // Price board with a coin.
        rect(g, x1 - 2, y1 - 31, 7, 6, C.plum);
        rect(g, x1 - 1, y1 - 30, 5, 4, C.wool);
        rect(g, x1, y1 - 29, 3, 2, C.butter);
      },
    },
  ];
}

// Windmill: a whitewashed tower on a stone footing, four turning sails.
export function windmillDrawable(g: CanvasRenderingContext2D, wm: Windmill, t: number): Drawable[] {
  const cx = Math.round(wm.cx), y1 = wm.y1 - 1;
  return [
    shadowFirst(wm, () => shadowRect(g, cx - 6, y1 - 22, 13, 22)),
    {
      y: wm.y1,
      draw: () => {
        for (let i = 0; i < 22; i++) {
          const hw = Math.round(7 - i * 0.18);
          rect(g, cx - hw, y1 - i, hw * 2 + 1, 1, C.wool);
          px(g, cx - hw, y1 - i, C.plum);
          px(g, cx - hw + 1, y1 - i, C.sage);
          px(g, cx + hw, y1 - i, C.plum);
        }
        for (let x = cx - 7; x <= cx + 7; x += 2) px(g, x, y1, C.sage);
        rect(g, cx - 2, y1 - 6, 5, 6, C.plum);
        rect(g, cx - 1, y1 - 12, 3, 3, C.plum);
        px(g, cx, y1 - 11, C.teal);
        rect(g, cx - 5, y1 - 26, 11, 4, C.plum);
        snowCap(g, cx - 5, y1 - 27, 11);
        rect(g, cx - 5, y1 - 26, 11, 1, C.sage);
        const hx = cx, hy = y1 - 24;
        const a0 = t * 1.1;
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k * Math.PI) / 2;
          const ex = hx + Math.cos(a) * 15, ey = hy + Math.sin(a) * 15;
          line(g, hx, hy, ex, ey, C.plum);
          const ox = -Math.sin(a) * 2, oy = Math.cos(a) * 2;
          line(g, hx + Math.cos(a) * 5 + ox, hy + Math.sin(a) * 5 + oy, ex + ox, ey + oy, C.wool);
        }
        rect(g, hx - 1, hy - 1, 3, 3, C.butter);
      },
    },
  ];
}
