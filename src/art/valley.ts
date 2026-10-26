import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import { hash2 } from '../rng';
import type { Drawable } from './buildings';
import { seasonLook } from './seasonlook';
import type { Game } from '../game';
import type { Light } from '../render/night';
import { MW, TS } from '../world/map';
import { skyDarkness } from '../render/sky';
import { BRIDGE_LOGS, bridgeLanding, woodpile } from '../systems/valley';
import { villageDrawables, villageLights } from './village';
import { fixtureDrawables } from './farm2';

// The valley's projects as they stand: the fields for sale (scrub that
// thins as a flock grazes it, then wildflowers), the woodpile and the old
// bridge at the ford (broken, then mended), a log dragged behind a cow; and
// the village. (Gameplay drew this; Graphics may restyle it.)

// A clump of bramble and thistle on a tile, as overgrown as `s` (0..1).
function scrub(g: CanvasRenderingContext2D, tx: number, ty: number, s: number) {
  const x = tx * TS, y = ty * TS;
  for (let i = 0; i < 6; i++) {
    const h = hash2(tx * 7 + i, ty, 711);
    if (h > s) continue;
    const bx = x + Math.floor(hash2(tx, ty * 3 + i, 712) * 7), by = y + Math.floor(hash2(tx + i, ty, 713) * 7);
    if (i % 3 === 0) {
      // A thistle: a stalk and a plum head.
      px(g, bx, by, C.sage);
      px(g, bx, by - 1, C.sage);
      px(g, bx, by - 2, C.plum);
      if (seasonLook.bloom > 0.5) px(g, bx, by - 3, C.wool);
    } else {
      // Bramble: a dark tangle.
      px(g, bx, by, C.teal);
      px(g, bx + 1, by, C.plum);
      px(g, bx, by - 1, C.plum);
      if (h < s * 0.5) px(g, bx - 1, by - 1, C.teal);
    }
  }
}

// Wildflowers on a cleared paddock tile.
function flowers(g: CanvasRenderingContext2D, tx: number, ty: number) {
  for (let i = 0; i < 2; i++) {
    const h = hash2(tx, ty * 5 + i, 721);
    if (h > 0.55) continue;
    px(g, tx * TS + Math.floor(hash2(tx * 3, ty + i, 722) * 8), ty * TS + Math.floor(hash2(tx, ty * 3 + i, 723) * 8), h < 0.25 ? C.butter : C.wool);
  }
}

function sign(g: CanvasRenderingContext2D, x: number, y: number, label: string, hot: boolean) {
  rect(g, x, y - 10, 1, 10, C.plum);
  const w = textWidth(label) + 4;
  rect(g, x - Math.floor(w / 2), y - 18, w, 8, C.plum);
  rect(g, x - Math.floor(w / 2) + 1, y - 17, w - 2, 6, hot ? C.butter : C.wool);
  text(g, label, x, y - 16, C.plum, { align: 'center' });
}

function logPile(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  // Rows of logs, ends showing their rings.
  const rows = [[0, 4], [2, 3], [4, 2]];
  let left = n;
  for (const [ox, k] of rows)
    for (let i = 0; i < k && left > 0; i++, left--) {
      const lx = x - 10 + ox + i * 5, ly = y - (ox / 2) * 3;
      rect(g, lx, ly - 3, 5, 3, C.plum);
      px(g, lx + 4, ly - 2, C.wool);
      px(g, lx, ly - 3, C.sage);
    }
}

function bridge(g: CanvasRenderingContext2D, game: Game, t: number) {
  const b = game.map.bridgeSpan();
  const x0 = b.x0 * TS - 4, x1 = b.x1 * TS + 4, y0 = b.y0 * TS + 2, y1 = b.y1 * TS - 2;
  const v = game.valley;
  if (v.bridge) {
    // The deck, its planks and handrails.
    rect(g, x0, y0, x1 - x0, y1 - y0, C.plum);
    for (let x = x0 + 1; x < x1 - 1; x += 3) rect(g, x, y0 + 1, 2, y1 - y0 - 2, hash2(x, y0, 731) < 0.3 ? C.sage : C.wool);
    for (const y of [y0 - 1, y1]) {
      rect(g, x0, y, x1 - x0, 1, C.plum);
      for (let x = x0; x <= x1; x += 6) rect(g, x, y - 3, 1, 4, C.plum);
      rect(g, x0, y - 3, x1 - x0, 1, C.wool);
    }
    return;
  }
  // Broken: stumps of the old piers in the water, a few planks left at the
  // banks, and more as logs come.
  for (let x = x0 + 4; x < x1 - 2; x += 6) {
    const bob = Math.round(Math.sin(t * 2 + x) * 0.5);
    rect(g, x, y0 + 3 + bob, 2, 3, C.plum);
    rect(g, x, y1 - 6 + bob, 2, 3, C.plum);
  }
  const done = Math.floor(((x1 - x0) * v.logs) / BRIDGE_LOGS / 2);
  for (const [a, dir] of [[x0, 1], [x1, -1]] as const)
    for (let i = 0; i < 6 + done; i += 3) rect(g, a + dir * i - (dir < 0 ? 2 : 0), y0 + 1, 2, y1 - y0 - 2, C.wool);
}

// Graphics' paddock art (art/paddock.ts, from world-r4) draws the fixtures
// itself; until it is merged in, they are drawn here. (A lazy glob: it only
// asks whether the file is there.)
const PADDOCK_ART = Object.keys(import.meta.glob('./paddock.ts')).length > 0;

export function valleyDrawables(game: Game, g: CanvasRenderingContext2D): Drawable[] {
  const { ox, oy, W, H } = game.view();
  const inView = (x0: number, y0: number, x1: number, y1: number) => x1 > ox - 40 && x0 < ox + W + 40 && y1 > oy - 40 && y0 < oy + H + 40;
  const night = skyDarkness(game.day) > 0.3;
  const out: Drawable[] = villageDrawables(game, g, inView, night);
  if (!PADDOCK_ART) out.push(...fixtureDrawables(game, g, (x, y) => inView(x - 8, y - 8, x + 8, y + 8)));
  const v = game.valley, t = game.t;
  // Paddocks: scrub on the ground (or flowers once cleared), and a sign.
  for (const p of v.fields) {
    const s = p.site;
    if (!inView((s.cx - s.rx - 2) * TS, (s.cy - s.ry - 2) * TS, (s.cx + s.rx + 2) * TS, (s.cy + s.ry + 2) * TS)) continue;
    out.push({
      y: -1e9 + 5,
      draw: () => {
        p.tiles.forEach((i, j) => {
          const tx = i % MW, ty = Math.floor(i / MW);
          if (p.cleared) flowers(g, tx, ty);
          else if (p.scrub[j] > 0.02) scrub(g, tx, ty, p.scrub[j]);
        });
      },
    });
    if (!p.owned) out.push({ y: p.mouth.y, draw: () => sign(g, p.mouth.x, p.mouth.y, `FOR SALE ${p.site.price}$`, true) });
    else if (!p.cleared) out.push({ y: p.mouth.y, draw: () => sign(g, p.mouth.x, p.mouth.y, `OVERGROWN ${Math.round((1 - v.left(p)) * 100)}%`, false) });
  }
  // The woodpile and the bridge.
  const wp = woodpile();
  if (!v.bridge && inView(wp.x - 30, wp.y - 30, wp.x + 30, wp.y + 20)) {
    out.push({ y: wp.y + 2, draw: () => logPile(g, wp.x, wp.y + 2, 9 - Math.min(8, v.logs)) });
    out.push({ y: wp.y + 16, draw: () => sign(g, wp.x + 26, wp.y + 16, game.ranch.village.has('smithy') ? `TIMBER ${v.logs}/${BRIDGE_LOGS}` : 'TIMBER', !!game.ranch.village.has('smithy')) });
  }
  const bl = bridgeLanding(game);
  if (inView(bl.x - 20, bl.y - 30, bl.x + 70, bl.y + 30)) out.push({ y: -1e9 + 6, draw: () => bridge(g, game, t) });
  // Logs dragged behind the cows hauling them.
  for (const a of game.animals) {
    if (a.load !== 'log' || a.gone || !inView(a.x - 10, a.y - 10, a.x + 10, a.y + 10)) continue;
    out.push({
      y: a.y - 0.5,
      draw: () => {
        const sp = Math.hypot(a.vx, a.vy);
        const hx = sp > 1 ? -a.vx / sp : a.face === 'l' ? 1 : -1, hy = sp > 1 ? -a.vy / sp : 0;
        const lx = Math.round(a.x + hx * 10), ly = Math.round(a.y + hy * 6 + 1);
        line(g, Math.round(a.x + hx * 4), Math.round(a.y), lx, ly, C.plum);
        rect(g, lx - 3, ly - 1, 7, 3, C.plum);
        px(g, lx + 3, ly, C.wool);
        px(g, lx - 3, ly - 1, C.sage);
      },
    });
  }
  return out;
}

export function valleyLights(game: Game, ox: number, oy: number): Light[] {
  return villageLights(game, ox, oy);
}
