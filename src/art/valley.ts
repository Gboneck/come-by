import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { PX, fine } from '../gfx/screen';
import { grid } from './fine';
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

// A clump of bramble and thistle on a tile, as overgrown as `s` (0..1). On
// the fine grid: rounded bramble tangles with a dark underside and a few
// berries, thistles with spiky heads (in flower in spring and summer).
const BRAMBLE = ['..tt...', '.tttst.', 'ttpttst', '.ptttp.', '..ppp..'];
const BRAMBLE2 = ['.tt.tt.', 'ttsttpt', 'tpttttt', '.pptpp.'];
const THISTLE = ['.p.p.', 'ppHpp', '.ppp.', '..s..', '.ss..', '..s.s', '..s..'];
function scrub(fg: CanvasRenderingContext2D, tx: number, ty: number, s: number) {
  const X = tx * TS * PX, Y = ty * TS * PX;
  for (let i = 0; i < 4; i++) {
    const h = hash2(tx * 7 + i, ty, 711);
    if (h > s) continue;
    const bx = X + Math.floor(hash2(tx, ty * 3 + i, 712) * 11), by = Y + Math.floor(hash2(tx + i, ty, 713) * 11);
    if (i === 3) grid(fg, THISTLE, bx, by - 4, { H: seasonLook.bloom > 0.5 ? C.wool : C.plum });
    else {
      grid(fg, (tx + ty + i) & 1 ? BRAMBLE : BRAMBLE2, bx - 3, by);
      if (h < s * 0.4 && seasonLook.leaves > 0.3) px(fg, bx, by + 1, C.plum);
      else if (h < s * 0.3) px(fg, bx + 1, by + 1, C.butter);
    }
  }
}

// Wildflowers on a cleared paddock tile: little five-pixel flowers.
function flowers(fg: CanvasRenderingContext2D, tx: number, ty: number) {
  for (let i = 0; i < 2; i++) {
    const h = hash2(tx, ty * 5 + i, 721);
    if (h > 0.55) continue;
    const x = tx * TS * PX + 2 + Math.floor(hash2(tx * 3, ty + i, 722) * 12), y = ty * TS * PX + 2 + Math.floor(hash2(tx, ty * 3 + i, 723) * 12);
    const col = h < 0.25 ? C.butter : C.wool;
    rect(fg, x - 1, y, 3, 1, col);
    rect(fg, x, y - 1, 1, 3, col);
    px(fg, x, y, col === C.wool ? C.butter : C.moss);
    px(fg, x, y + 2, C.sage);
  }
}

function sign(g: CanvasRenderingContext2D, x: number, y: number, label: string, hot: boolean) {
  const w = textWidth(label) + 4;
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX + 1, L = (x - Math.floor(w / 2)) * PX, Wd = w * PX;
    rect(fg, X - 1, Y - 20, 3, 21, C.plum);
    rect(fg, X + 1, Y - 20, 1, 21, C.sage);
    rect(fg, L, Y - 37, Wd, 16, C.plum);
    rect(fg, L + 2, Y - 35, Wd - 4, 12, hot ? C.butter : C.wool);
    rect(fg, L + 2, Y - 24, Wd - 4, 1, hot ? C.moss : C.sage);
  });
  text(g, label, x, y - 16, C.plum, { align: 'center' });
}

// Rows of logs, their cut ends showing rings, bark along their length.
function logPile(g: CanvasRenderingContext2D, x: number, y: number, n: number) {
  fine(g, (fg) => {
    const rows = [[0, 4], [2, 3], [4, 2]];
    let left = n;
    for (const [ox, k] of rows)
      for (let i = 0; i < k && left > 0; i++, left--) {
        const LX = (x - 10 + ox + i * 5) * PX, LY = (y - (ox / 2) * 3) * PX;
        rect(fg, LX, LY - 6, 10, 6, C.plum);
        rect(fg, LX, LY - 6, 10, 1, C.teal);
        rect(fg, LX + 6, LY - 5, 4, 4, C.butter);
        px(fg, LX + 8, LY - 4, C.plum);
        px(fg, LX + 7, LY - 3, C.wool);
      }
  });
}

function bridge(g: CanvasRenderingContext2D, game: Game, t: number) {
  const b = game.map.bridgeSpan();
  const x0 = b.x0 * TS - 4, x1 = b.x1 * TS + 4, y0 = b.y0 * TS + 2, y1 = b.y1 * TS - 2;
  const v = game.valley;
  fine(g, (fg) => {
    const X0 = x0 * PX, X1 = x1 * PX, Y0 = y0 * PX, Y1 = y1 * PX;
    if (v.bridge) {
      // The deck: planks with their seams and the odd grey one, handrails
      // on posts, a shadow on the water below.
      rect(fg, X0, Y1, X1 - X0, 3, C.plum);
      rect(fg, X0, Y0, X1 - X0, Y1 - Y0, C.plum);
      for (let x = X0 + 1; x < X1 - 1; x += 5) {
        rect(fg, x, Y0 + 2, 4, Y1 - Y0 - 4, hash2(x, y0, 731) < 0.25 ? C.sage : C.wool);
        px(fg, x + 1, Y0 + 4, C.sage);
        px(fg, x + 1, Y1 - 5, C.sage);
      }
      for (const y of [Y0 - 2, Y1]) {
        rect(fg, X0, y, X1 - X0, 2, C.plum);
        for (let x = X0; x <= X1; x += 12) { rect(fg, x, y - 7, 2, 9, C.plum); px(fg, x + 1, y - 6, C.sage); }
        rect(fg, X0, y - 7, X1 - X0, 1, C.wool);
        rect(fg, X0, y - 6, X1 - X0, 1, C.sage);
      }
      return;
    }
    // Broken: stumps of the old piers in the water, a few planks left at the
    // banks, and more as logs come.
    for (let x = X0 + 8; x < X1 - 4; x += 12) {
      const bob = Math.round(Math.sin(t * 2 + x) * 0.6);
      for (const y of [Y0 + 6, Y1 - 12]) {
        rect(fg, x, y + bob, 4, 6, C.plum);
        rect(fg, x, y + bob, 4, 1, C.sage);
        rect(fg, x - 1, y + 6, 6, 1, C.wool);
      }
    }
    const done = Math.floor(((X1 - X0) * v.logs) / BRIDGE_LOGS / 2);
    for (const [a, dir] of [[X0, 1], [X1, -1]] as const)
      for (let i = 0; i < 12 + done; i += 5) {
        const px0 = a + dir * i - (dir < 0 ? 4 : 0);
        rect(fg, px0, Y0 + 2, 4, Y1 - Y0 - 4, C.wool);
        rect(fg, px0 + 3, Y0 + 2, 1, Y1 - Y0 - 4, C.sage);
      }
  });
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
        fine(g, (fg) => {
          p.tiles.forEach((i, j) => {
            const tx = i % MW, ty = Math.floor(i / MW);
            if (p.cleared) flowers(fg, tx, ty);
            else if (p.scrub[j] > 0.02) scrub(fg, tx, ty, p.scrub[j]);
          });
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
        fine(g, (fg) => {
          const LX = lx * PX, LY = ly * PX;
          line(fg, Math.round((a.x + hx * 4) * PX), Math.round(a.y * PX), LX, LY, C.plum);
          rect(fg, LX - 6, LY - 2, 14, 6, C.plum);
          rect(fg, LX - 6, LY - 2, 14, 1, C.teal);
          rect(fg, LX + 5, LY - 1, 3, 4, C.butter);
          px(fg, LX + 6, LY, C.plum);
          rect(fg, LX - 6, LY + 4, 14, 1, C.sage);
        });
      },
    });
  }
  return out;
}

export function valleyLights(game: Game, ox: number, oy: number): Light[] {
  return villageLights(game, ox, oy);
}
