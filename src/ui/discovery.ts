import { C, U32 } from '../palette';
import { BAYER4, px, rect } from '../gfx/draw';
import { text, wrap } from '../gfx/font';
import { makeCanvas } from '../gfx/screen';
import type { Game } from '../game';
import { REGIONS } from '../world/map';
import { KEEPSAKES, PLACES } from '../world/places';
import { FH, FW, GLIMPSED, SEEN } from '../systems/discovery';

// The Ledger map's fog of war, the hidden places found so far, and the
// found/total count for each open region (drawn on the map, where it is).

let fog: HTMLCanvasElement | null = null;
let fogVer = -1;

function fogCanvas(game: Game): HTMLCanvasElement {
  const d = game.discovery;
  if (fog && fogVer === d.fogVer) return fog;
  const [c, g] = fog ? [fog, fog.getContext('2d')!] : makeCanvas(FW, FH);
  const img = g.createImageData(FW, FH);
  const buf = new Uint32Array(img.data.buffer);
  const f = d.fog;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : f[y * FW + x]);
  // Unknown ground is a misty sage-on-plum weave, frayed where it meets
  // the known; ground seen from the lookout shows through a plum veil.
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const v = f[y * FW + x];
      if (v === SEEN) continue;
      const b = BAYER4[(y & 3) * 4 + (x & 3)];
      if (v === GLIMPSED) {
        if (((x + y) & 1) === 0) buf[y * FW + x] = U32.plum;
        continue;
      }
      const edge = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
      if (edge && b >= 11) continue;
      buf[y * FW + x] = b < 4 ? U32.sage : U32.plum;
    }
  g.putImageData(img, 0, 0);
  fog = c;
  fogVer = d.fogVer;
  return c;
}

export function drawFog(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number) {
  const c = fogCanvas(game);
  g.drawImage(c, x0, y0);
  // A sage frame, so the unknown reads as map and not as the panel.
  rect(g, x0 - 1, y0 - 1, c.width + 2, 1, C.sage);
  rect(g, x0 - 1, y0 + c.height, c.width + 2, 1, C.sage);
  rect(g, x0 - 1, y0, 1, c.height, C.sage);
  rect(g, x0 + c.width, y0, 1, c.height, C.sage);
}

// A buttercup star on each place found, and "found/total" on each open region.
export function drawPlaceMarks(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number) {
  const d = game.discovery;
  for (const p of PLACES) {
    if (!d.found.has(p.id)) continue;
    const [tx, ty] = p.rx ? [p.cx, p.cy] : p.way[Math.floor(p.way.length / 2)];
    const sx = x0 + Math.round(tx / 2), sy = y0 + Math.round(ty / 2);
    rect(g, sx - 1, sy - 2, 3, 5, C.plum);
    rect(g, sx - 2, sy - 1, 5, 3, C.plum);
    px(g, sx, sy - 1, C.butter);
    px(g, sx - 1, sy, C.butter);
    px(g, sx + 1, sy, C.butter);
    px(g, sx, sy + 1, C.butter);
    px(g, sx, sy, C.wool);
  }
  for (const r of REGIONS) {
    if (r.tier > game.tier) continue;
    const { found, total } = d.count(r.id);
    if (!total) continue;
    const cx = x0 + Math.round(r.cx / 2), cy = y0 + Math.round(r.cy / 2);
    text(g, `${found}/${total}`, cx, cy + 3, found === total ? C.butter : C.wool, { align: 'center', shadow: C.plum });
  }
}

// Ledger lines: places found and keepsakes kept.
export function discoveryLines(game: Game, w: number): { s: string; c: string }[] {
  const d = game.discovery;
  const { found, total } = d.count();
  const out: { s: string; c: string }[] = [{ s: `HIDDEN PLACES ${found}/${total}`, c: found === total ? C.butter : C.wool }];
  const kept = KEEPSAKES.filter((k) => d.keepsakes.has(k.id)).map((k) => k.short);
  const s = `KEEPSAKES ${kept.length}/${KEEPSAKES.length}${kept.length ? `: ${kept.join(', ')}` : ''}`;
  for (const l of wrap(s, w)) out.push({ s: l, c: C.sage });
  return out;
}
