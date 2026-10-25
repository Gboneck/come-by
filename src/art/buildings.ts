import { C } from '../palette';
import { line, rect, px } from '../gfx/draw';
import { text } from '../gfx/font';
import type { Building, Pen, RegionGate } from '../ranch/buildings';
import type { FieldGate, Fence, Barn, Kennel, Market, Windmill } from '../ranch/structures';
import { CS } from '../world/map';

export interface Drawable {
  y: number;
  draw: () => void;
}

// ---- Fences ----
// Horizontal fence: plum posts every 8px, two wool rails, a sage line of
// shadow on the ground. `base` is the ground line.
export function hFence(g: CanvasRenderingContext2D, xa: number, xb: number, base: number, gap?: [number, number]) {
  const inGap = (x: number) => !!gap && x > gap[0] && x < gap[1];
  rect(g, xa, base + 1, xb - xa, 1, C.sage);
  for (let x = xa; x <= xb; x++) {
    if (inGap(x)) continue;
    px(g, x, base - 2, C.wool);
    px(g, x, base - 4, C.wool);
  }
  for (let x = xa; x <= xb; x += 8) {
    if (inGap(x) && x !== gap![0] && x !== gap![1]) continue;
    rect(g, x, base - 5, 2, 6, C.plum);
    px(g, x, base - 5, C.moss);
  }
  if (gap) {
    rect(g, gap[0], base - 5, 2, 6, C.plum);
    rect(g, gap[1] - 1, base - 5, 2, 6, C.plum);
  }
}

// One post and the rail down to the next post of a north-south fence.
export function vFenceSeg(g: CanvasRenderingContext2D, x: number, ya: number, yb: number, rail = true) {
  if (rail) {
    rect(g, x + 2, ya - 2, 1, yb - ya, C.sage);
    rect(g, x, ya - 4, 1, yb - ya, C.wool);
    rect(g, x + 1, ya - 3, 1, yb - ya, C.wool);
  }
  rect(g, x, ya - 5, 2, 6, C.plum);
  px(g, x, ya - 5, C.moss);
}

function vFence(out: Drawable[], g: CanvasRenderingContext2D, x: number, ya: number, yb: number, gap?: [number, number]) {
  for (let y = ya; y < yb; y += 8) {
    const y2 = Math.min(yb, y + 8);
    const railGap = gap && y >= gap[0] && y < gap[1];
    out.push({ y, draw: () => vFenceSeg(g, x, y, y2, !railGap) });
  }
  out.push({ y: yb, draw: () => vFenceSeg(g, x, yb, yb, false) });
}

// A gate leaf swinging outward about its hinge. `along` is the unit vector
// along the fence from the hinge, `outward` points out of the pen.
function gateLeaf(g: CanvasRenderingContext2D, hx: number, hy: number, along: [number, number], outward: [number, number], len: number, swing: number, flash: number) {
  const a = swing * Math.PI * 0.5;
  const ex = hx + len * (along[0] * Math.cos(a) + outward[0] * Math.sin(a));
  const ey = hy + len * (along[1] * Math.cos(a) + outward[1] * Math.sin(a));
  line(g, hx, hy + 1, ex, ey + 1, C.sage);
  line(g, hx, hy - 2, ex, ey - 2, C.wool);
  line(g, hx, hy - 4, ex, ey - 4, C.wool);
  // Diagonal brace.
  line(g, hx, hy - 4, (hx + ex) / 2, (hy + ey) / 2 - 2, C.wool);
  rect(g, ex - 0.5, ey - 5, 1, 6, C.plum);
  if (flash > 0 && Math.floor(flash * 12) % 2 === 0) {
    px(g, ex + 1, ey - 6, C.butter);
    px(g, ex - 2, ey - 7, C.butter);
  }
}

export function penDrawables(g: CanvasRenderingContext2D, p: Pen, t: number, showSign: boolean): Drawable[] {
  const out: Drawable[] = [];
  const x0 = p.x0, y0 = p.y0, x1 = p.x1, y1 = p.y1;
  const s = p.gateSpan();
  const topBase = y0 + CS - 1, botBase = y1 - 1;
  const lx = x0 + 1, rx = x1 - CS + 1;
  const LEN = s.x1 - s.x0 || s.y1 - s.y0;

  // Floor: trampled straw marks inside.
  out.push({
    y: -1e9 + p.id,
    draw: () => {
      for (let yy = p.iy0 + 3; yy < p.iy1 - 2; yy += 6)
        for (let xx = p.ix0 + 3 + ((yy / 6) % 2) * 3; xx < p.ix1 - 2; xx += 9) {
          px(g, xx, yy, C.moss);
          px(g, xx + 1, yy, C.moss);
        }
    },
  });

  // Trough along the back fence, goods piling up along the side.
  if (p.hasTrough) {
    const tx0 = Math.round(p.cx - 7), ty0 = p.iy0 + 2;
    out.push({
      y: ty0 + 4,
      draw: () => {
        rect(g, tx0, ty0, 14, 4, C.plum);
        rect(g, tx0 + 1, ty0 + 1, 12, 1, C.teal);
        px(g, tx0 + 4 + (Math.floor(t * 2) % 5), ty0 + 1, C.wool);
        rect(g, tx0 + 1, ty0 + 4, 1, 1, C.plum);
        rect(g, tx0 + 12, ty0 + 4, 1, 1, C.plum);
      },
    });
  }
  if (p.goods > 0 && p.species) {
    const n = Math.min(12, p.goods);
    const sp = p.species;
    out.push({
      y: p.iy1 - 2,
      draw: () => {
        for (let i = 0; i < n; i++) {
          const gx = p.ix0 + 3 + (i % 6) * 4, gy = p.iy1 - 4 - Math.floor(i / 6) * 4;
          drawGood(g, sp, gx, gy);
        }
      },
    });
  }

  const top = p.rot === 2 ? [s.x0, s.x1] as [number, number] : undefined;
  const bot = p.rot === 0 ? [s.x0, s.x1] as [number, number] : undefined;
  out.push({ y: topBase, draw: () => hFence(g, x0, x1 - 2, topBase, top) });
  out.push({ y: botBase, draw: () => hFence(g, x0, x1 - 2, botBase, bot) });
  vFence(out, g, lx, topBase + 8, botBase - 1, p.rot === 1 ? [s.y0, s.y1] : undefined);
  vFence(out, g, rx, topBase + 8, botBase - 1, p.rot === 3 ? [s.y0, s.y1] : undefined);

  // Gate leaf.
  const gy = p.rot === 0 ? botBase : p.rot === 2 ? topBase : (s.y0 + s.y1) / 2;
  out.push({
    y: p.rot === 2 ? topBase + 0.5 : p.rot === 0 ? botBase + 0.5 : s.y1,
    draw: () => {
      if (p.rot === 0) gateLeaf(g, s.x0 + 1, gy, [1, 0], [0, 1], LEN - 2, p.swing, p.shutFlash);
      else if (p.rot === 2) gateLeaf(g, s.x0 + 1, gy, [1, 0], [0, -1], LEN - 2, p.swing, p.shutFlash);
      else if (p.rot === 1) gateLeaf(g, lx, s.y0, [0, 1], [-1, 0], LEN - 1, p.swing, p.shutFlash);
      else gateLeaf(g, rx, s.y0, [0, 1], [1, 0], LEN - 1, p.swing, p.shutFlash);
    },
  });

  // Sign: head count and capacity.
  if (showSign && (p.animals.length > 0 || p.full)) {
    out.push({
      y: 1e9,
      draw: () => {
        const sp = p.animals[0]?.sp;
        const cap = sp ? Math.floor(p.capacity / sp.space) : 0;
        const label = p.full ? 'FULL' : `${p.animals.length}/${cap}`;
        const tx = Math.round(p.cx), ty = Math.round(y0 - 12);
        text(g, label, tx, ty, p.full ? C.butter : C.wool, { align: 'center', shadow: C.plum });
      },
    });
  }
  void t;
  return out;
}

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

// ---- Farmhouse: a whitewashed cabin that grows with the ranch. ----
// Where the chimney smoke leaves the farmhouse (see render/life.ts).
export function chimneyTop(b: Building): { x: number; y: number } {
  const roofTop = b.y0 - (b.level >= 3 ? 12 : 7);
  return { x: b.x1 - 10, y: roofTop - 6 };
}

export function farmhouseDrawable(g: CanvasRenderingContext2D, b: Building, night: boolean): Drawable {
  return { y: b.y1, draw: () => drawFarmhouse(g, b, night) };
}

function drawFarmhouse(g: CanvasRenderingContext2D, b: Building, night: boolean) {
  const lvl = b.level;
  const x0 = b.x0, x1 = b.x1, y1 = b.y1;
  const w = x1 - x0;
  const wallH = lvl >= 3 ? 18 : 11;
  const roofTop = b.y0 - (lvl >= 3 ? 12 : 7);
  const eave = y1 - wallH;
  // Shadow down-left.
  rect(g, x0 - 4, eave + 3, w, wallH, C.sage);
  // Walls.
  rect(g, x0 + 1, eave, w - 2, wallH, C.wool);
  rect(g, x0 + 1, y1 - 1, w - 2, 1, C.sage);
  // Roof (front slope, seen from above) with shingle rows.
  rect(g, x0 - 1, roofTop, w + 2, eave - roofTop, C.plum);
  for (let y = roofTop + 3; y < eave - 1; y += 3) {
    for (let x = x0; x < x1; x++) if ((x + y) % 5 !== 0) px(g, x, y, C.teal);
  }
  rect(g, x0 - 1, roofTop, w + 2, 1, C.sage);
  rect(g, x0 - 1, eave - 1, w + 2, 1, C.plum);
  // Chimney with a curl of smoke.
  const chx = x1 - 12;
  rect(g, chx, roofTop - 5, 4, 7, C.plum);
  rect(g, chx, roofTop - 5, 4, 1, C.sage);
  // Door and windows.
  const doorX = x0 + Math.floor(w / 2) - 3;
  rect(g, doorX, y1 - 9, 6, 9, C.plum);
  px(g, doorX + 4, y1 - 5, C.butter);
  const winCol = night ? C.butter : C.teal;
  const wy = y1 - 8;
  for (const wx of [x0 + 5, x1 - 11]) {
    rect(g, wx - 1, wy - 1, 7, 5, C.plum);
    rect(g, wx, wy, 5, 3, winCol);
    px(g, wx + 2, wy, C.plum);
    px(g, wx + 2, wy + 1, C.plum);
    px(g, wx + 2, wy + 2, C.plum);
  }
  if (lvl >= 3) {
    const uy = eave + 3;
    for (const wx of [x0 + 6, doorX + 1, x1 - 12]) {
      rect(g, wx - 1, uy - 1, 6, 5, C.plum);
      rect(g, wx, uy, 4, 3, winCol);
    }
  }
  // Flower boxes and a porch at higher levels.
  if (lvl >= 2) {
    for (const wx of [x0 + 5, x1 - 11]) {
      rect(g, wx - 1, wy + 4, 7, 1, C.plum);
      px(g, wx, wy + 3, C.butter);
      px(g, wx + 3, wy + 3, C.butter);
      px(g, wx + 5, wy + 3, C.wool);
    }
  }
  if (lvl >= 4) {
    // Flag on the ridge.
    const fx = x0 + 6;
    rect(g, fx, roofTop - 10, 1, 10, C.plum);
    rect(g, fx + 1, roofTop - 10, 5, 3, C.butter);
  }
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
      for (let y = ya; y < yb; y += 8) {
        const y2 = Math.min(yb, y + 8);
        const inLeafA = y < mid, open = rg.swing;
        if (open > 0.02) continue;
        out.push({ y, draw: () => vFenceSeg(g, x, y, y2, true) });
        void inLeafA;
      }
      if (rg.swing > 0.02) {
        out.push({ y: ya, draw: () => gateLeaf(g, x, ya + 4, [0, 1], [1, 0], mid - ya - 4, rg.swing, 0) });
        out.push({ y: yb, draw: () => gateLeaf(g, x, yb - 4, [0, -1], [1, 0], yb - mid - 4, rg.swing, 0) });
      }
    } else {
      out.push({ y: ya, draw: () => vFenceSeg(g, x, ya + 4, ya + 4, false) });
      out.push({ y: yb, draw: () => vFenceSeg(g, x, yb - 4, yb - 4, false) });
    }
    if (!rg.unlocked) out.push({ y: mid + 1, draw: () => lockSign(g, x + 1, mid - 6, t) });
  } else {
    const y = Math.round(rg.cy) + 2;
    const xa = rg.x0, xb = rg.x1;
    const mid = Math.round((xa + xb) / 2);
    if (rg.swing <= 0.02) out.push({ y, draw: () => hFence(g, xa, xb, y) });
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
  rect(g, x - 4, y + 3, w, h, C.sage);
}

// Barn: plum boards, wool trim and X-braced doors, a teal roof and cupola.
export function barnDrawable(g: CanvasRenderingContext2D, b: Barn, night: boolean): Drawable {
  return {
    y: b.y1,
    draw: () => {
      const x0 = b.x0, x1 = b.x1, y1 = b.y1, w = x1 - x0;
      const wallH = 15, eave = y1 - wallH, roofTop = b.y0 - 8;
      shadowRect(g, x0, eave, w, wallH);
      rect(g, x0 + 1, eave, w - 2, wallH, C.plum);
      for (let x = x0 + 3; x < x1 - 2; x += 3) rect(g, x, eave + 1, 1, wallH - 2, C.teal);
      rect(g, x0 + 1, eave, 1, wallH, C.wool);
      rect(g, x1 - 2, eave, 1, wallH, C.wool);
      // Doors.
      const dw = 16, dx = Math.round(b.cx - dw / 2), dh = 12;
      rect(g, dx - 1, y1 - dh - 1, dw + 2, dh + 1, C.wool);
      rect(g, dx, y1 - dh, dw, dh, night ? C.butter : C.plum);
      line(g, dx, y1 - dh, dx + dw / 2 - 1, y1 - 1, C.wool);
      line(g, dx + dw / 2 - 1, y1 - dh, dx, y1 - 1, C.wool);
      line(g, dx + dw / 2, y1 - dh, dx + dw - 1, y1 - 1, C.wool);
      line(g, dx + dw - 1, y1 - dh, dx + dw / 2, y1 - 1, C.wool);
      rect(g, dx + dw / 2 - 1, y1 - dh, 1, dh, C.wool);
      // Roof.
      rect(g, x0 - 2, roofTop, w + 4, eave - roofTop, C.teal);
      for (let y = roofTop + 3; y < eave - 1; y += 3) for (let x = x0 - 1; x < x1 + 1; x++) if ((x * 3 + y) % 7 !== 0) px(g, x, y, C.plum);
      rect(g, x0 - 2, roofTop, w + 4, 1, C.sage);
      rect(g, x0 - 2, eave - 1, w + 4, 1, C.plum);
      // Cupola.
      const cx = Math.round(b.cx);
      rect(g, cx - 3, roofTop - 4, 7, 5, C.wool);
      rect(g, cx - 4, roofTop - 6, 9, 2, C.plum);
      rect(g, cx - 1, roofTop - 3, 3, 2, night ? C.butter : C.plum);
    },
  };
}

// Kennel: a little A-frame doghouse with a bowl.
export function kennelDrawable(g: CanvasRenderingContext2D, k: Kennel): Drawable {
  return {
    y: k.y1,
    draw: () => {
      const cx = Math.round(k.cx), y1 = k.y1 - 2;
      shadowRect(g, cx - 9, y1 - 10, 18, 10);
      rect(g, cx - 8, y1 - 10, 16, 10, C.wool);
      // A-frame roof.
      for (let i = 0; i < 9; i++) rect(g, cx - 10 + i, y1 - 10 - i, 21 - i * 2, 1, i % 3 === 0 ? C.teal : C.plum);
      rect(g, cx - 10, y1 - 10, 21, 1, C.plum);
      // Arched door.
      rect(g, cx - 3, y1 - 7, 6, 7, C.plum);
      rect(g, cx - 2, y1 - 8, 4, 1, C.plum);
      // Bowl.
      rect(g, cx + 10, y1 - 2, 5, 2, C.teal);
      rect(g, cx + 11, y1 - 3, 3, 1, C.plum);
    },
  };
}

// Market stall: striped awning, counter with goods.
export function marketDrawable(g: CanvasRenderingContext2D, m: Market): Drawable {
  return {
    y: m.y1,
    draw: () => {
      const x0 = m.x0 + 1, x1 = m.x1 - 1, y1 = m.y1 - 1, w = x1 - x0;
      shadowRect(g, x0, y1 - 8, w, 8);
      // Posts.
      rect(g, x0 + 1, y1 - 18, 2, 18, C.plum);
      rect(g, x1 - 3, y1 - 18, 2, 18, C.plum);
      // Counter.
      rect(g, x0, y1 - 7, w, 7, C.plum);
      rect(g, x0, y1 - 7, w, 1, C.moss);
      for (let x = x0 + 2; x < x1 - 2; x += 4) {
        px(g, x, y1 - 9, C.wool);
        px(g, x + 1, y1 - 9, C.wool);
        px(g, x + 2, y1 - 8, C.butter);
      }
      // Awning stripes and scalloped edge.
      for (let x = x0 - 1; x < x1 + 1; x++) {
        const col = Math.floor((x - x0 + 1) / 3) % 2 === 0 ? C.wool : C.butter;
        rect(g, x, y1 - 24, 1, 7, col);
        if ((x - x0) % 3 !== 2) px(g, x, y1 - 17, col);
      }
      rect(g, x0 - 1, y1 - 25, w + 2, 1, C.plum);
    },
  };
}

// Windmill: whitewashed tower and four turning sails.
export function windmillDrawable(g: CanvasRenderingContext2D, wm: Windmill, t: number): Drawable {
  return {
    y: wm.y1,
    draw: () => {
      const cx = Math.round(wm.cx), y1 = wm.y1 - 1;
      shadowRect(g, cx - 6, y1 - 20, 12, 20);
      for (let i = 0; i < 22; i++) {
        const hw = Math.round(7 - i * 0.18);
        rect(g, cx - hw, y1 - i, hw * 2 + 1, 1, C.wool);
        px(g, cx - hw, y1 - i, C.plum);
        px(g, cx + hw, y1 - i, C.plum);
      }
      rect(g, cx - 2, y1 - 6, 5, 6, C.plum);
      rect(g, cx - 5, y1 - 26, 11, 4, C.plum);
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
  };
}
