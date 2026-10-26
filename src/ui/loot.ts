import { C } from '../palette';
import { px, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import type { Game } from '../game';
import { HOARD_AT, LOOT, PAGES, type LootItem } from '../systems/loot';
import { placeById } from '../world/places';
import { lootIcon } from '../art/loot';
import type { LedgerInk, LedgerPage } from './ledger';

// The Ledger's FINDS page: everything there is to dig up, in a grid (a "?"
// for what is still in the ground), a frame for how rare each is, the one
// picked written up beside it, and how to find more: the bones in the stash,
// the old map's pages and where the next one lies. Plus the map's marks on
// the Ledger's ranch map: an X where the next page (or the hoard) is buried,
// a ring where a lost animal waits.

type Rect = { x: number; y: number; w: number; h: number; spine: number };

const CELL = 13;
let cols = 12; // the grid's columns, as last drawn

const RARE_WORD = { common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE', legendary: 'LEGENDARY' } as const;

// A cell: a dotted box with a "?" until found; then the find, framed by how
// rare it is (none, sage, teal, teal round buttercup).
function cell(g: CanvasRenderingContext2D, l: LootItem, got: boolean, x: number, y: number, ink: LedgerInk, t: number, i: number, k: number) {
  const S = (CELL - 2) * k;
  if (!got) {
    for (let k = 0; k < S; k += 2) {
      px(g, x + k, y, ink.dim);
      px(g, x + k, y + S - 1, ink.dim);
      px(g, x, y + k, ink.dim);
      px(g, x + S - 1, y + k, ink.dim);
    }
    text(g, '?', x + S / 2, y + 3 * k, ink.dim, { align: 'center', scale: k });
    return;
  }
  const frame = l.rarity === 'uncommon' ? ink.dim : l.rarity === 'rare' || l.rarity === 'legendary' ? ink.accent : '';
  if (frame) {
    rect(g, x, y, S, 1, frame);
    rect(g, x, y + S - 1, S, 1, frame);
    rect(g, x, y, 1, S, frame);
    rect(g, x + S - 1, y, 1, S, frame);
  }
  if (l.rarity === 'legendary') {
    rect(g, x + 1, y + 1, S - 2, S - 2, C.butter);
    if (Math.floor(t * 2 + i) % 5 === 0) px(g, x + S - 3, y + 2, C.wool);
  }
  lootIcon(g, l.id, x + Math.floor(S / 2), y + S - 2 * k, k);
}

// Where to look for what is still in the ground.
function hint(game: Game, l: LootItem): string {
  if (l.id === 'agedbone') return 'BURY A BONE ON THE RANCH, AND DIG IT UP ANOTHER DAY.';
  if (l.kind === 'page' && l.id !== 'page1') return 'WHERE THE PAGE BEFORE IT SAYS.';
  if (l.id === 'page1') return 'IN RICH GROUND: THE HIDDEN PLACES.';
  if (l.id === 'hoard' || l.id === 'tag-gold') return 'AT THE END OF THE OLD MAP.';
  if (l.rarity === 'rare') return 'MOSTLY IN HIDDEN PLACES, IN THEIR SEASON.';
  if (l.rarity === 'uncommon') return 'OUT IN THE PASTURES, MORE IN HIDDEN PLACES.';
  return game.loot.kinds ? 'ALMOST ANYWHERE.' : 'NEAR THE RANCH, MOST MORNINGS.';
}

// Name, rarity, the blurb (or where to look). Returns the y under it.
function info(game: Game, g: CanvasRenderingContext2D, l: LootItem, x: number, y: number, w: number, ink: LedgerInk): number {
  const n = game.loot.got.get(l.id) ?? 0;
  text(g, n ? l.name : '? ? ?', x, y, n ? ink.accent : ink.text);
  text(g, RARE_WORD[l.rarity] + (n > 1 ? `  FOUND ${n}` : ''), x, y + 7, ink.dim);
  const what = wrap(n ? l.blurb : hint(game, l), w).slice(0, 4);
  what.forEach((s, i) => text(g, s, x, y + 15 + i * 7, n ? ink.text : ink.dim));
  return y + 16 + what.length * 7;
}

// The stash, the map and how to dig: the next goal is always visible.
function footer(game: Game, w: number): { s: string; dim: boolean }[] {
  const L = game.loot;
  const out: { s: string; dim: boolean }[] = [];
  const add = (s: string, dim: boolean) => { for (const l of wrap(s, w)) out.push({ s: l, dim }); };
  if (L.bones || L.buried.length) add(`BONES ${L.bones}  BURIED ${L.buried.length}`, false);
  const pages = L.pages;
  if (!pages) add('OLD MAP: NO PAGES YET. ONE IS SAID TO LIE IN RICH GROUND.', true);
  else if (pages < 4) add(`OLD MAP ${pages}/4: THE NEXT PAGE IS MARKED X ON YOUR RANCH MAP.`, false);
  else if (!L.has('hoard')) add('OLD MAP 4/4: X MARKS THE SPOT, BY THE CAIRN ON LOOKOUT KNOLL.', false);
  else add('OLD MAP 4/4: THE HOARD IS YOURS.', true);
  for (const [, page] of L.lost) add(`${PAGES[page].lost!.label} WAITS: BRING IT HOME.`, false);
  add('WALK SLOW OR STAND STILL TO SNIFF; ON A SCENT, NIP TO DIG. NEW SPOTS EVERY MORNING, MORE AFTER RAIN.', true);
  return out;
}

function drawFinds(game: Game, g: CanvasRenderingContext2D, r: Rect, ink: LedgerInk) {
  const L = game.loot;
  L.unseen = 0;
  L.sel = Math.max(0, Math.min(LOOT.length - 1, L.sel));
  const wide = r.spine > 0;
  const gw = wide ? r.spine - 6 : r.w;
  // Twice the size on a wide screen's left-hand page, if it fits.
  const cols2 = Math.floor((gw + 2) / (CELL * 2 - 2));
  const k = wide && cols2 >= 6 && Math.ceil(LOOT.length / cols2) * (CELL * 2 - 2) <= r.h - 4 ? 2 : 1;
  const C2 = (CELL - 2) * k + 2;
  cols = Math.max(6, Math.floor((gw + 2) / C2));
  const rows = Math.ceil(LOOT.length / cols);
  const gx = r.x + Math.floor((gw - (cols * C2 - 2)) / 2), gy = r.y + 1;
  const T = game.t;
  LOOT.forEach((l, i) => {
    const cx = gx + (i % cols) * C2, cy = gy + Math.floor(i / cols) * C2;
    cell(g, l, L.has(l.id), cx, cy, ink, T, i, k);
    if (i === L.sel) {
      const b = Math.floor(T * 3) % 2, S = C2 - 2;
      for (const [dx, dy] of [[-1 - b, -1 - b], [S + b - 2, -1 - b], [-1 - b, S + b - 2], [S + b - 2, S + b - 2]]) {
        rect(g, cx + dx, cy + dy, 3, 1, ink.text);
        rect(g, cx + dx + (dx < 0 ? 0 : 2), cy + dy + (dy < 0 ? 0 : -2), 1, 3, ink.text);
      }
    }
    if (game.ui.click(`loot-${i}`, cx - 1, cy - 1, C2, C2)) {
      L.sel = i;
      game.audio?.play('click', { vol: 0.5 });
    }
  });
  const l = LOOT[L.sel];
  const count = `${L.kinds}/${LOOT.length}`;
  const lines = (x: number, y: number, w: number) => {
    for (const f of footer(game, w)) {
      text(g, f.s, x, y, f.dim ? ink.dim : ink.text);
      y += 7;
    }
  };
  if (wide) {
    // The one picked, large, on the right-hand page, and the rest under it.
    const x = r.x + r.spine + 6, w = r.w - r.spine - 6;
    text(g, count, x + w, r.y, ink.dim, { align: 'right' });
    const k = L.has(l.id) ? 3 : 2;
    if (L.has(l.id)) lootIcon(g, l.id, Math.round(x + w / 2), r.y + 26, k);
    else text(g, '?', Math.round(x + w / 2), r.y + 8, ink.dim, { align: 'center', scale: 3 });
    const y = info(game, g, l, x, r.y + 32, w, ink);
    lines(x, y + 4, w);
  } else {
    const iy = gy + rows * C2 + 2;
    rect(g, r.x, iy - 2, r.w, 1, ink.dim);
    if (L.has(l.id)) lootIcon(g, l.id, r.x + 9, iy + 16, 2);
    else text(g, '?', r.x + 9, iy + 4, ink.dim, { align: 'center', scale: 2 });
    const tx = r.x + 22;
    text(g, count, r.x + r.w, iy + 2, ink.dim, { align: 'right' });
    const y = info(game, g, l, tx, iy + 2, r.w - (tx - r.x) - textWidth(count) - 3, ink);
    rect(g, r.x, y + 1, r.w, 1, ink.dim);
    lines(r.x, y + 5, r.w);
  }
}

// Arrows move along the grid.
function findKeys(game: Game): boolean {
  const inp = game.input, L = game.loot;
  const n = LOOT.length;
  const move = (d: number) => {
    L.sel = Math.max(0, Math.min(n - 1, L.sel + d));
    game.audio?.play('click', { vol: 0.5 });
  };
  if (inp.pressed('left')) move(-1);
  if (inp.pressed('right')) move(1);
  if (inp.pressed('up') && L.sel - cols >= 0) move(-cols);
  if (inp.pressed('down') && L.sel + cols < n) move(cols);
  return false;
}

export const FINDS_PAGE: LedgerPage = { id: 'finds', tab: 'FINDS', draw: drawFinds, keys: findKeys, dot: (g) => g.loot.unseen > 0 };

// ---- On the Ledger's ranch map ----

// An X where the next map page lies (or the hoard), a ring round a lost
// animal's hidden place while it waits. Inked in plum like the map's marks.
export function drawLootMarks(game: Game, g: CanvasRenderingContext2D, x0: number, y0: number) {
  const L = game.loot;
  const pages = L.pages;
  const at = pages >= 1 && pages < 4 ? PAGES[pages].at : pages === 4 && !L.has('hoard') ? HOARD_AT : null;
  if (at) {
    const sx = x0 + Math.round(at[0] / 16), sy = y0 + Math.round(at[1] / 16);
    const locked = (pages < 4 ? PAGES[pages].tier : 2) > game.tier; // sage until its region opens
    for (let k = -2; k <= 2; k++) {
      px(g, sx + k, sy + k, locked ? C.sage : C.plum);
      px(g, sx + k, sy - k, locked ? C.sage : C.plum);
    }
    if (!locked && Math.floor(game.t * 2) % 2) px(g, sx, sy, C.butter);
  }
  for (const [, page] of L.lost) {
    const p = placeById(PAGES[page].lost!.place);
    const sx = x0 + Math.round(p.cx / 2), sy = y0 + Math.round(p.cy / 2) + 6;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) px(g, sx + dx, sy + dy, C.plum);
  }
}
