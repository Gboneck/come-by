import { C } from '../palette';
import { line, px, rect } from '../gfx/draw';
import { text } from '../gfx/font';
import { hash2 } from '../rng';
import { hFence, hipRoof, penDrawables, shadowRect, vFenceSeg, type Drawable } from './buildings';
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
        const l = s.lane;
        for (let y = l.y0; y < l.y1; y++)
          for (let x = l.x0; x < l.x1; x++) {
            const h = hash2(x, y, 611);
            if (h < 0.18) px(g, x, y, C.moss);
            else if (h < 0.22) px(g, x, y, C.butter);
          }
        if (summer) for (let i = 0; i < 14; i++) px(g, Math.round(s.shearX0 + hash2(i, s.id, 612) * (s.shearX1 - s.shearX0)), l.y0 + 2 + Math.floor(hash2(s.id, i, 613) * 8), C.wool);
      },
    },
    {
      y: wallBase,
      draw: () => {
        rect(g, x0, eave, w, 10, C.plum);
        for (let x = x0 + 2; x < x1 - 1; x += 3) rect(g, x, eave + 1, 1, 8, C.teal);
        rect(g, x0, eave, 1, 10, C.wool);
        rect(g, x1 - 1, eave, 1, 10, C.wool);
        // The shearer's door: open in summer, a fleece on the hook.
        const dx = Math.round(s.cx) - 4;
        rect(g, dx - 1, wallBase - 9, 10, 9, C.wool);
        rect(g, dx, wallBase - 8, 8, 8, summer ? C.butter : C.plum);
        if (summer) {
          rect(g, dx + 2, wallBase - 6, 4, 3, C.wool);
          px(g, dx + 3, wallBase - 7, C.plum);
        } else line(g, dx, wallBase - 8, dx + 7, wallBase - 1, C.wool);
        // Small windows either side.
        for (const wx of [x0 + 8, x1 - 13]) {
          rect(g, wx, eave + 3, 5, 4, C.wool);
          rect(g, wx + 1, eave + 4, 3, 2, C.plum);
        }
        hipRoof(g, x0 - 2, x1 + 2, top, eave + 1, 4, C.teal, C.plum);
        snowCap(g, x0 + 2, top, w - 4, eave + 1);
        // Wool bales by the far end, in summer.
        if (summer)
          for (let i = 0; i < 3; i++) {
            rect(g, x1 + 1, wallBase - 4 - i * 4, 6, 4, C.wool);
            rect(g, x1 + 1, wallBase - 1 - i * 4, 6, 1, C.sage);
          }
      },
    },
    // The rail along the chute's south side, splaying into wings.
    { y: s.y0 + SHED_LANE.y1 + 4, draw: () => hFence(g, x0 + 12, x1 - 14, s.y0 + SHED_LANE.y1 + 3) },
    {
      y: s.y1,
      draw: () => {
        for (const [ax, ay, bx, by] of s.wings()) {
          line(g, ax, ay - 2, bx, by - 2, C.wool);
          line(g, ax, ay, bx, by, C.wool);
          for (let i = 0; i <= 4; i++) {
            const x = Math.round(ax + ((bx - ax) * i) / 4), y = Math.round(ay + ((by - ay) * i) / 4);
            rect(g, x, y - 4, 2, 5, C.plum);
            px(g, x - 1, y + 1, C.sage);
          }
        }
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
      rect(g, x0 + 1, eave, w - 2, 11, C.wool);
      rect(g, x0 + 1, eave, 1, 11, C.sage);
      rect(g, x0 + 1, base - 1, w - 2, 1, C.sage);
      for (let x = x0 + 4; x < x1 - 3; x += 7) rect(g, x, eave + 1, 1, 9, C.sage);
      // Door onto the yard and a round window.
      const cx = Math.round(d.cx);
      rect(g, cx - 3, base - 8, 6, 8, night ? C.butter : C.plum);
      rect(g, cx - 4, base - 9, 8, 1, C.plum);
      rect(g, x0 + 6, eave + 3, 4, 3, C.plum);
      px(g, x0 + 7, eave + 4, night ? C.butter : C.teal);
      rect(g, x1 - 10, eave + 3, 4, 3, C.plum);
      px(g, x1 - 9, eave + 4, night ? C.butter : C.teal);
      hipRoof(g, x0 - 1, x1 + 1, top, eave + 1, 5, C.teal, C.plum);
      snowCap(g, x0 + 4, top, w - 8, eave + 1);
      // A bell-shaped vent on the ridge.
      rect(g, cx - 2, top - 3, 5, 3, C.wool);
      rect(g, cx - 3, top - 4, 7, 1, C.plum);
      // Churns.
      for (const [i, ox] of [[0, x1 + 1], [1, x1 + 6]] as const) {
        rect(g, ox, base - 7 + i, 4, 7 - i, C.wool);
        rect(g, ox, base - 7 + i, 4, 1, C.teal);
        rect(g, ox + 1, base - 8 + i, 2, 1, C.plum);
        px(g, ox + 3, base - 4, C.sage);
      }
    },
  });
  return out;
}

// ---- Agility yard: a low fence round a course of striped jumps, weave
// poles and a teal tunnel; the start post flies a pennant.
function pole(g: CanvasRenderingContext2D, x: number, y: number, h: number) {
  for (let i = 0; i < h; i++) px(g, x, y - i, Math.floor(i / 2) % 2 ? C.wool : C.butter);
  px(g, x, y - h, C.plum);
  px(g, x - 1, y + 1, C.sage);
  px(g, x + 1, y + 1, C.sage);
}

export function agilityDrawables(g: CanvasRenderingContext2D, y: AgilityYard, t: number, game?: Game): Drawable[] {
  const { x0, y0, x1, y1 } = y;
  const out: Drawable[] = [];
  const gate = AGILITY.gate;
  // Mown ring and a worn track round the course.
  out.push({
    y: -1e9 + y.id,
    draw: () => {
      for (let yy = y0 + 4; yy < y1 - 4; yy++)
        for (let xx = x0 + 4; xx < x1 - 4; xx++) if (((xx >> 2) + (yy >> 3)) % 2 === 0 && hash2(xx, yy, 621) < 0.35) px(g, xx, yy, C.moss);
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
        if (a.x === b.x) for (let yy = a.y; yy <= b.y; yy++) px(g, a.x + 1, yy - 3, (yy >> 1) % 2 ? C.wool : C.plum);
        else for (let xx = a.x; xx <= b.x; xx++) px(g, xx, a.y - 4, (xx >> 1) % 2 ? C.wool : C.plum);
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
      rect(g, tx0, ty0 - 3, tx1 - tx0, ty1 - ty0 + 3, C.teal);
      rect(g, tx0, ty0 - 3, tx1 - tx0, 1, C.wool);
      rect(g, tx0, ty1 - 1, tx1 - tx0, 1, C.sage);
      for (let x = tx0 + 2; x < tx1; x += 4) rect(g, x, ty0 - 3, 1, ty1 - ty0 + 3, C.plum);
      // The mouths.
      rect(g, tx0, ty0, 2, ty1 - ty0 - 1, C.plum);
      rect(g, tx1 - 2, ty0, 2, ty1 - ty0 - 1, C.plum);
      snowCap(g, tx0, ty0 - 4, tx1 - tx0);
    },
  });
  // The start post, and the clock while a run is on.
  const sp = y.at(AGILITY.post);
  out.push({
    y: sp.y,
    draw: () => {
      rect(g, sp.x, sp.y - 12, 1, 12, C.plum);
      const flap = Math.floor(t * 3) % 2;
      rect(g, sp.x + 1, sp.y - 12, 4 + flap, 2, C.butter);
      rect(g, sp.x + 1, sp.y - 10, 2, 1, C.butter);
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
