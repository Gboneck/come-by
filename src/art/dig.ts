import { C } from '../palette';
import { hash2 } from '../rng';
import { PX, fine, makeCanvas } from '../gfx/screen';

// Where things are buried and dug up (systems/loot.ts), on the fine grid:
// - 'near': the dog is nearly on it: a scuff of turned earth, a few clods
//   (o.close: a glint blinking over it);
// - 'dug': an open hole, its far wall lit, the near side in shadow, a lip of
//   thrown soil round it and the heap of earth beside it (o.snow: the heap
//   white);
// - 'buried': a little mound over a buried bone (o.ready: a knob of bone
//   showing once it has aged);
// - 'x': stones laid in a cross where the hoard is.
// (x, y) is the spot in world px. Ground layer: drawn every frame as one
// small picture per spot (four looks of each, chosen by where it is); only
// the glint moves, by the clock.

export type DigStage = 'near' | 'dug' | 'buried' | 'x';
export interface DigOpts { close?: boolean; snow?: boolean; ready?: boolean }

// A picture: the canvas and the fine pixel in it that sits on (x, y).
interface Pic { c: HTMLCanvasElement; ax: number; ay: number }
const pics = new Map<string, Pic>();

type Put = (x: number, y: number, col: string) => void;

function make(w: number, h: number, ax: number, ay: number, draw: (put: Put) => void): Pic {
  const [c, cg] = makeCanvas(w, h);
  draw((x, y, col) => {
    x += ax;
    y += ay;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    cg.fillStyle = col;
    cg.fillRect(x, y, 1, 1);
  });
  return { c, ax, ay };
}

// A clod of earth: lit on top, dark underneath.
function clod(put: Put, x: number, y: number, top: string, w = 3) {
  for (let i = 0; i < w - 1; i++) {
    put(x + i, y, top);
    put(x + i, y + 1, C.sage);
  }
  put(x + w - 1, y + 1, C.plum);
}

// An oval with a ragged edge: `fill(u, v, d)` picks the colour of each fine
// pixel inside (u, v from -1 to 1 across it, d its distance out).
function oval(put: Put, cx: number, cy: number, rx: number, ry: number, seed: number, fill: (u: number, v: number, d: number) => string | 0) {
  for (let y = -Math.ceil(ry) - 1; y <= Math.ceil(ry) + 1; y++)
    for (let x = -Math.ceil(rx) - 1; x <= Math.ceil(rx) + 1; x++) {
      const a = Math.atan2(y / ry, x / rx);
      const bump = 1 + 0.12 * (hash2(Math.floor((a + Math.PI) * 1.6), seed, 611) - 0.5);
      const u = x / rx, v = y / ry, d = Math.hypot(u, v) / bump;
      if (d > 1) continue;
      const col = fill(u, v, d);
      if (col) put(cx + x, cy + y, col);
    }
}

function nearPic(k: number): Pic {
  return make(20, 12, 10, 6, (put) => {
    // A scuff of bare earth, its top lip catching the light.
    oval(put, 0, 0, 5.2, 2.6, k, (_u, v, d) => (d > 0.72 && v < -0.2 ? C.moss : d > 0.8 && v > 0.3 ? C.plum : C.sage));
    // Clods kicked up round it, one each side and one below.
    for (let j = 0; j < 3; j++) {
      const a = (j * Math.PI * 2) / 3 + hash2(k, j, 612) * 1.2;
      const r = 6 + hash2(k, j, 613) * 1.5;
      clod(put, Math.round(Math.cos(a) * r * 1.1) - 1, Math.round(Math.sin(a) * r * 0.55) - 1, C.moss, j === 0 ? 3 : 2);
    }
  });
}

function dugPic(k: number, snow: boolean): Pic {
  const lip = snow ? C.wool : C.moss;
  return make(34, 14, 12, 7, (put) => {
    // The lip of thrown soil round the hole, lit on its far side.
    oval(put, 0, 0, 9, 4.6, k, (_u, v, d) => (d < 0.74 ? 0 : v < -0.15 ? lip : v > 0.5 && d > 0.9 ? C.plum : C.sage));
    // The hole: its far wall lit (sage, then teal into the shadow), the
    // rest of it plum.
    oval(put, 0, 0, 6.8, 3.2, k + 1, (_u, v) => {
      if (v < -0.62) return C.sage;
      if (v < -0.25) return C.teal;
      return C.plum;
    });
    // The heap of earth beside it: a rounded pile, lit on top, its foot
    // in shadow, a clod or two rolled off it.
    const hx = 15, hy = 1;
    oval(put, hx, hy, 6, 3.2, k + 2, (u, v, d) => {
      if (v > 0.55 && d > 0.75) return C.plum;
      if (snow) return v < 0.15 ? C.wool : C.sage;
      return v < -0.35 && u < 0.5 ? C.moss : C.sage;
    });
    put(hx - 1, hy - 3, snow ? C.wool : C.moss);
    put(hx + 1, hy - 3, snow ? C.wool : C.moss);
    clod(put, hx + 6, hy + 2, snow ? C.wool : C.moss, 2);
    clod(put, hx - 7 + Math.round(hash2(k, 0, 614) * 2), hy + 3, snow ? C.wool : C.moss, 2);
  });
}

// The end of a bone standing out of the earth: its two knobs, its shaft.
const KNOB = ['wp.wp', 'wwwwp', '.wwp.', '.wwp.'];

function buriedPic(k: number, ready: boolean): Pic {
  return make(16, 11, 8, 7, (put) => {
    // A little mound of earth, lit on its upper left, its foot in shadow.
    oval(put, 0, 0, 6, 3, k, (u, v, d) => {
      if (v > 0.5 && d > 0.8) return C.plum;
      return v < -0.3 && u < 0.4 ? C.moss : C.sage;
    });
    put(-6, 2, C.plum);
    put(6, 1, C.plum);
    if (ready)
      KNOB.forEach((row, r) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(i - 1, r - 6, row[i] === 'p' ? C.plum : C.wool);
      });
  });
}

// A pebble: pale on top, grey beneath, a line of shadow at its foot.
function stone(put: Put, x: number, y: number, top: string) {
  put(x, y - 1, top);
  put(x + 1, y - 1, top);
  put(x - 1, y, top);
  put(x, y, top);
  put(x + 1, y, C.sage);
  put(x + 2, y, C.sage);
  put(x, y + 1, C.sage);
  put(x + 1, y + 1, C.plum);
}

function xPic(k: number): Pic {
  return make(24, 18, 12, 9, (put) => {
    const seen = new Set<string>();
    for (const [sx, sy] of [[-1, -1], [1, -1]])
      for (const f of [-1, -0.5, 0, 0.5, 1]) {
        const key = `${f * sx},${f * sy}`;
        if (f === 0 && seen.has(key)) continue;
        seen.add(key);
        const j = seen.size;
        const x = Math.round(f * sx * 8 + (hash2(k, j, 615) - 0.5) * 1.6), y = Math.round(f * sy * 6 + (hash2(k, j, 616) - 0.5) * 1.2);
        stone(put, x, y, hash2(k, j, 617) < 0.3 ? C.moss : C.wool);
      }
  });
}

function pic(stage: DigStage, k: number, o: DigOpts): Pic {
  const key = `${stage},${k},${o.snow ? 1 : 0},${o.ready ? 1 : 0}`;
  let p = pics.get(key);
  if (!p) {
    p = stage === 'near' ? nearPic(k) : stage === 'dug' ? dugPic(k, !!o.snow) : stage === 'buried' ? buriedPic(k, !!o.ready) : xPic(k);
    pics.set(key, p);
  }
  return p;
}

// The glint over a find the dog is right on top of: a spark that swells to
// a little star and back, now and then.
function glint(fg: CanvasRenderingContext2D, X: number, Y: number, t: number) {
  const f = Math.floor(t * 6) % 6;
  if (f > 2) return;
  fg.fillStyle = C.butter;
  fg.fillRect(X, Y, 1, 1);
  if (f !== 1) return;
  fg.fillStyle = C.wool;
  fg.fillRect(X - 2, Y, 2, 1);
  fg.fillRect(X + 1, Y, 2, 1);
  fg.fillRect(X, Y - 2, 1, 2);
  fg.fillRect(X, Y + 1, 1, 2);
}

export function digSpot(g: CanvasRenderingContext2D, x: number, y: number, stage: DigStage, t: number, o: DigOpts = {}) {
  const X = Math.round(x * PX), Y = Math.round(y * PX);
  const p = pic(stage, Math.floor(hash2(Math.round(x), Math.round(y), 610) * 4), o);
  fine(g, (fg) => {
    fg.drawImage(p.c, X - p.ax, Y - p.ay);
    if (stage === 'near' && o.close) glint(fg, X, Y - 9, t + (X & 7) * 0.13);
  });
}
