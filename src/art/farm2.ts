import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { hash2 } from '../rng';
import { hFence, hipRoof, penDrawables, postF, shadowRect, vFenceSeg, type Drawable } from './buildings';
import { PX, fine } from '../gfx/screen';
import { snowCap } from './seasonlook';
import { AGILITY, SHED_LANE, type AgilityYard, type Dairy, type ShearingShed } from '../ranch/structures';
import type { Game } from '../game';

// The ranch buildings with work of their own: the shearing shed, the dairy
// and the agility yard. (Gameplay drew these; Graphics may restyle them.)

const shadowFirst = (id: number, draw: () => void): Drawable => ({ y: -1e8 + id, draw });

// ---- Shearing shed: a long low shed of plum boards under a teal roof; its
// south wall has the shearer's door onto the chute, which a rail closes in.
export function shedDrawables(g: CanvasRenderingContext2D, s: ShearingShed, game?: Game): Drawable[] {
  const x0 = s.x0, x1 = s.x1, w = x1 - x0;
  const wallBase = s.y0 + 16, eave = wallBase - 10, top = s.y0 - 6;
  const summer = game?.season.season === 'summer';
  const out: Drawable[] = [
    shadowFirst(s.id, () => shadowRect(g, x0, top + 2, w, wallBase - top - 1)),
    // The chute floor: trodden straw.
    {
      y: -1e9 + s.id,
      draw: () => {
        // On the fine grid: a trodden lane edged by the rail's line, straw
        // in wisps, tufts of fleece by the shearer's door in summer.
        fine(g, (fg) => {
          const l = s.lane;
          const X0 = l.x0 * PX, X1 = l.x1 * PX, Y0 = l.y0 * PX, Y1 = l.y1 * PX;
          rect(fg, X0, Y0 + 2, X1 - X0, Y1 - Y0 - 4, C.moss);
          rect(fg, X0, Y1 - 3, X1 - X0, 1, C.sage);
          for (let x = X0 + 3; x < X1 - 3; x += 7) {
            const y = Y0 + 4 + Math.floor(hash2(x, s.id, 611) * (Y1 - Y0 - 10));
            px(fg, x, y, C.butter);
            px(fg, x + 1, y - 1, C.butter);
          }
          if (summer)
            for (let i = 0; i < 10; i++) {
              const fx = Math.round((s.shearX0 + hash2(i, s.id, 612) * (s.shearX1 - s.shearX0)) * PX), fy = Y0 + 4 + Math.floor(hash2(s.id, i, 613) * 14);
              rect(fg, fx, fy, 3, 2, C.wool);
              px(fg, fx + 1, fy - 1, C.wool);
            }
        });
      },
    },
    {
      y: wallBase,
      draw: () => {
        fine(g, (fg) => {
          const X0 = x0 * PX, X1 = x1 * PX, E = eave * PX, WB = wallBase * PX;
          // Plum boards and teal battens, wool corner boards.
          rect(fg, X0, E, X1 - X0, 20, C.plum);
          for (let x = X0 + 4; x < X1 - 2; x += 6) {
            rect(fg, x, E + 2, 1, 16, C.teal);
            if (hash2(x, s.id, 614) < 0.3) px(fg, x + 3, E + 5 + Math.floor(hash2(s.id, x, 615) * 10), C.sage);
          }
          rect(fg, X0, E, 2, 20, C.wool);
          rect(fg, X1 - 2, E, 2, 20, C.wool);
          rect(fg, X0, E + 20 - 2, X1 - X0, 2, C.sage);
          // The shearer's door: open in summer, a fleece on the hook.
          const DX = (Math.round(s.cx) - 4) * PX;
          rect(fg, DX - 2, WB - 18, 20, 18, C.wool);
          rect(fg, DX, WB - 16, 16, 16, summer ? C.butter : C.plum);
          if (summer) {
            rect(fg, DX + 4, WB - 12, 8, 6, C.wool);
            rect(fg, DX + 5, WB - 13, 6, 1, C.wool);
            px(fg, DX + 7, WB - 15, C.plum);
            px(fg, DX + 7, WB - 14, C.plum);
          } else {
            line(fg, DX, WB - 16, DX + 15, WB - 1, C.wool);
            rect(fg, DX, WB - 9, 16, 1, C.wool);
          }
          // Small windows either side.
          for (const wx of [x0 + 8, x1 - 13]) {
            const WX = wx * PX;
            rect(fg, WX, E + 5, 10, 8, C.wool);
            rect(fg, WX + 2, E + 7, 6, 4, C.plum);
            rect(fg, WX + 4, E + 7, 1, 4, C.wool);
            px(fg, WX + 7, E + 7, C.teal);
          }
          // Wool bales by the far end, in summer.
          if (summer)
            for (let i = 0; i < 3; i++) {
              const by = WB - 8 - i * 8;
              rect(fg, X1 + 2, by, 12, 8, C.wool);
              rect(fg, X1 + 2, by + 6, 12, 2, C.sage);
              rect(fg, X1 + 6, by, 1, 8, C.sage);
              px(fg, X1 + 4, by + 2, C.sage);
            }
        });
        hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 4, C.teal, C.plum);
        snowCap(g, x0 + 2, top, w - 4, eave + 1);
      },
    },
    // The rail along the chute's south side, splaying into wings.
    { y: s.y0 + SHED_LANE.y1 + 4, draw: () => hFence(g, x0 + 12, x1 - 14, s.y0 + SHED_LANE.y1 + 3) },
    {
      y: s.y1,
      draw: () => {
        fine(g, (fg) => {
          for (const [ax, ay, bx, by] of s.wings()) {
            const AX = ax * PX, AY = ay * PX + 1, BX = bx * PX, BY = by * PX + 1;
            line(fg, AX, AY + 1, BX, BY + 1, C.sage);
            for (const off of [5, 9]) {
              line(fg, AX, AY - off, BX, BY - off, C.wool);
              line(fg, AX, AY - off + 1, BX, BY - off + 1, C.sage);
            }
            for (let i = 0; i <= 4; i++) {
              const x = Math.round(AX + ((BX - AX) * i) / 4), y = Math.round(AY + ((BY - AY) * i) / 4);
              postF(fg, x, y, 6, C.moss, false);
            }
          }
        });
      },
    },
  ];
  return out;
}

// ---- Dairy: a whitewashed parlour with a teal roof and churns at the door,
// its milking yard in front.
export function dairyDrawables(g: CanvasRenderingContext2D, d: Dairy, t: number, night: boolean): Drawable[] {
  const x0 = d.x0, x1 = d.x1, w = x1 - x0;
  const base = d.y0 + 16, eave = base - 11, top = d.y0 - 8;
  const out = penDrawables(g, d.yard, t, false);
  out.push(shadowFirst(d.id, () => shadowRect(g, x0, top + 2, w, base - top - 1)));
  out.push({
    y: base,
    draw: () => {
      const cx = Math.round(d.cx);
      fine(g, (fg) => {
        const X0 = x0 * PX, X1 = x1 * PX, E = eave * PX, B = base * PX, CX = cx * PX;
        // Whitewashed walls with pilasters, the left in shade, a footing.
        rect(fg, X0 + 2, E, X1 - X0 - 4, 22, C.wool);
        rect(fg, X0 + 2, E, 2, 22, C.sage);
        rect(fg, X0 + 2, B - 2, X1 - X0 - 4, 2, C.sage);
        for (let x = X0 + 8; x < X1 - 6; x += 14) rect(fg, x, E + 2, 1, 18, C.sage);
        rect(fg, X0 + 2, E, X1 - X0 - 4, 1, C.sage);
        // A door onto the yard (lit at night), round windows either side.
        rect(fg, CX - 8, B - 18, 16, 18, C.plum);
        rect(fg, CX - 6, B - 16, 12, 16, night ? C.butter : C.plum);
        rect(fg, CX - 6, B - 16, 12, 1, C.teal);
        rect(fg, CX, B - 16, 1, 16, C.sage);
        px(fg, CX + 3, B - 8, C.butter);
        for (const wx of [X0 + 12, X1 - 20]) {
          rect(fg, wx + 1, E + 5, 6, 8, C.plum);
          rect(fg, wx, E + 6, 8, 6, C.plum);
          rect(fg, wx + 2, E + 7, 4, 4, night ? C.butter : C.teal);
          rect(fg, wx + 3, E + 6, 2, 6, night ? C.butter : C.teal);
          px(fg, wx + 5, E + 7, night ? C.wool : C.wool);
        }
        // Churns by the door.
        for (const [i, ox] of [[0, x1 + 1], [1, x1 + 6]] as const) {
          const OX = ox * PX, T = B - 14 + i * 2;
          rect(fg, OX + 1, T, 6, B - T, C.wool);
          rect(fg, OX, T + 3, 8, B - T - 4, C.wool);
          rect(fg, OX + 6, T + 3, 2, B - T - 4, C.sage);
          rect(fg, OX + 1, T, 6, 1, C.teal);
          rect(fg, OX + 2, T - 2, 4, 2, C.plum);
          rect(fg, OX, B - 4, 8, 1, C.sage);
        }
      });
      hipRoof(g, x0 - 1, x1 + 1, top, eave + 1, 5, C.teal, C.plum);
      snowCap(g, x0 + 4, top, w - 8, eave + 1);
      fine(g, (fg) => {
        // A bell-shaped vent on the ridge.
        const CX = cx * PX, T = top * PX;
        rect(fg, CX - 4, T - 6, 9, 6, C.wool);
        rect(fg, CX - 4, T - 6, 2, 6, C.sage);
        rect(fg, CX - 2, T - 4, 5, 3, C.plum);
        rect(fg, CX - 6, T - 8, 13, 2, C.plum);
        rect(fg, CX - 3, T - 10, 7, 2, C.plum);
      });
    },
  });
  return out;
}

// ---- Agility yard: a low fence round a course of striped jumps, weave
// poles and a teal tunnel; the start post flies a pennant.
// A striped pole on the fine grid: bands of buttercup and wool, a cap, a
// little shadow at its foot.
function pole(g: CanvasRenderingContext2D, x: number, y: number, h: number) {
  fine(g, (fg) => {
    const X = x * PX, Y = y * PX + 1, Hh = h * PX;
    for (let i = 0; i < Hh; i++) rect(fg, X, Y - i, 2, 1, Math.floor(i / 3) % 2 ? C.wool : C.butter);
    rect(fg, X + 1, Y - Hh + 1, 1, Hh - 1, C.sage);
    rect(fg, X, Y - Hh - 1, 2, 2, C.plum);
    rect(fg, X - 1, Y + 1, 5, 1, C.sage);
  });
}

export function agilityDrawables(g: CanvasRenderingContext2D, y: AgilityYard, t: number, game?: Game): Drawable[] {
  const { x0, y0, x1, y1 } = y;
  const out: Drawable[] = [];
  const gate = AGILITY.gate;
  // Mown ring and a worn track round the course.
  out.push({
    y: -1e9 + y.id,
    draw: () => {
      // Mown in broad bands, the ring of the course worn in clean moss.
      fine(g, (fg) => {
        const X0 = (x0 + 4) * PX, X1 = (x1 - 4) * PX, Y0 = (y0 + 6) * PX, Y1 = (y1 - 4) * PX;
        for (let y = Y0; y < Y1; y += 16) rect(fg, X0, y, X1 - X0, Math.min(8, Y1 - y), C.moss);
        for (let y = Y0 + 8; y < Y1; y += 16) for (let x = X0 + 3; x < X1; x += 9) px(fg, x, y + 3, C.moss);
      });
    },
  });
  out.push({ y: y0 + 3, draw: () => hFence(g, x0, x1 - 2, y0 + 3) });
  out.push({ y: y1 - 1, draw: () => hFence(g, x0, x1 - 2, y1 - 1, [x0 + gate.x0, x0 + gate.x1]) });
  out.push({ y: y1 - 2, draw: () => { vFenceSeg(g, x0 + 1, y0 + 11, y1 - 2); vFenceSeg(g, x1 - 3, y0 + 11, y1 - 2); } });
  // Jumps: two striped wings and a bar.
  for (const j of AGILITY.jumps) {
    if (j.id !== 'jump') continue;
    const a = y.at(j.a), b = y.at(j.b);
    out.push({
      y: Math.max(a.y, b.y),
      draw: () => {
        pole(g, a.x, a.y, 6);
        pole(g, b.x, b.y, 6);
        fine(g, (fg) => {
          if (a.x === b.x) for (let yy = a.y * PX; yy <= b.y * PX; yy++) rect(fg, a.x * PX + 2, yy - 6, 1, 1, (yy >> 2) % 2 ? C.wool : C.plum);
          else for (let xx = a.x * PX; xx <= b.x * PX + 1; xx++) rect(fg, xx, a.y * PX - 7, 1, 2, (xx >> 2) % 2 ? C.wool : C.plum);
        });
      },
    });
  }
  for (const w of AGILITY.weave) {
    const p = y.at(w);
    out.push({ y: p.y, draw: () => pole(g, p.x, p.y, 8) });
  }
  // The tunnel: a teal tube with plum hoops.
  const tun = AGILITY.tunnel;
  out.push({
    y: y0 + tun.y1 + 1,
    draw: () => {
      const tx0 = x0 + tun.x0, tx1 = x0 + tun.x1, ty0 = y0 + tun.y0, ty1 = y0 + tun.y1;
      fine(g, (fg) => {
        const X0 = tx0 * PX, X1 = tx1 * PX, Y0 = ty0 * PX, Y1 = ty1 * PX;
        // A teal tube, lit along its top, hoops round it, dark mouths.
        rect(fg, X0, Y0 - 6, X1 - X0, Y1 - Y0 + 6, C.teal);
        rect(fg, X0, Y0 - 6, X1 - X0, 1, C.wool);
        rect(fg, X0, Y0 - 5, X1 - X0, 2, C.sage);
        rect(fg, X0, Y1 - 2, X1 - X0, 2, C.plum);
        rect(fg, X0, Y1, X1 - X0, 1, C.sage);
        for (let x = X0 + 4; x < X1 - 2; x += 8) rect(fg, x, Y0 - 6, 1, Y1 - Y0 + 4, C.plum);
        rect(fg, X0, Y0 - 3, 4, Y1 - Y0, C.plum);
        rect(fg, X1 - 4, Y0 - 3, 4, Y1 - Y0, C.plum);
      });
      snowCap(g, tx0, ty0 - 4, tx1 - tx0);
    },
  });
  // The start post, and the clock while a run is on.
  const sp = y.at(AGILITY.post);
  out.push({
    y: sp.y,
    draw: () => {
      fine(g, (fg) => {
        const X = sp.x * PX, Y = sp.y * PX + 1;
        rect(fg, X, Y - 24, 2, 25, C.plum);
        rect(fg, X + 1, Y - 24, 1, 25, C.sage);
        const flap = Math.floor(t * 3) % 2;
        for (let r = 0; r < 6; r++) rect(fg, X + 2, Y - 24 + r, 10 - r * 1.5 + flap, 1, C.butter);
        rect(fg, X - 2, Y + 1, 6, 1, C.sage);
      });
      if (!game) return;
      const r = game.farmwork.run;
      const res = game.farmwork.result;
      const label = r && r.yard === y ? `${r.t.toFixed(1)}` : res && game.t - res.at < 6 ? `${res.t}${res.clean ? ' CLEAN' : ''}` : null;
      if (label) text(g, label, sp.x, sp.y - 21, res?.clean && !r ? C.butter : C.wool, { align: 'center', shadow: C.plum });
    },
  });
  return out;
}

// ---- Fixtures inside a paddock: a field shelter (a lean-to on posts over
// straw) and a hay rack (a slatted V of hay). The trough is drawn with the
// paddock (art/buildings.ts).
export function fixtureDrawables(game: Game, g: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean): Drawable[] {
  const out: Drawable[] = [];
  for (const p of game.ranch.pens)
    for (const f of p.fixtures) {
      const x = f.tx * 8, y = f.ty * 8;
      if (f.kind === 'trough' || !inView(x + 8, y + 8)) continue;
      if (f.kind === 'shelter') {
        // Three tiles wide, open to the south.
        out.push({ y: y + 15, draw: () => {
          for (let i = 0; i < 16; i++) px(g, x + 2 + ((i * 5) % 20), y + 9 + (i % 5), C.butter);
          rect(g, x + 1, y + 3, 22, 4, C.plum);
          rect(g, x + 1, y + 6, 1, 10, C.plum);
          rect(g, x + 22, y + 6, 1, 10, C.plum);
          for (let i = 0; i < 4; i++) rect(g, x - 1 + i, y + 5 - i, 26 - i * 2, 1, i % 2 ? C.plum : C.teal);
          snowCap(g, x + 2, y + 1, 20);
        } });
      } else {
        out.push({ y: y + 7, draw: () => {
          rect(g, x + 1, y + 1, 14, 5, C.butter);
          for (let xx = x + 2; xx < x + 15; xx += 3) rect(g, xx, y + 1, 1, 5, C.plum);
          rect(g, x + 1, y + 6, 14, 1, C.plum);
          rect(g, x + 2, y + 7, 1, 1, C.plum);
          rect(g, x + 13, y + 7, 1, 1, C.plum);
          px(g, x + 4, y, C.butter);
          px(g, x + 9, y, C.butter);
        } });
      }
    }
  return out;
}
