import { C } from '../palette';
import { rect } from '../gfx/draw';
import { drawSprAt, sprH, sprW } from '../gfx/sprite';
import { panel } from './frame';
import { heading, text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import { playerDogSprites, type Mask, type Neck, type Speckle, type Tag } from '../art/dogstyle';
import { dimView } from './feel';
import { safeArea } from './safe';
import { cycle, optionRow } from './rows';
import { focusField, isTyping, stopTyping, textField } from './textfield';
import { DOG_NAMES, NAME_MAX, applyLook, defaultLook, pickName } from './look';

// The dog's look: its name, coat markings and neck piece. Offered at the
// start of a new game, at the kennel, and from the pause menu.

export type LookFrom = 'new' | 'kennel' | 'pause';

const SPECKLES: Speckle[] = ['light', 'classic', 'heavy'];
const SPECKLE_NAME: Record<Speckle, string> = { light: 'FEW FLECKS', classic: 'BLUE FLECKED', heavy: 'HEAVY FLECKS' };
const MASKS: Mask[] = ['both', 'one', 'none'];
const MASK_NAME: Record<Mask, string> = { both: 'BOTH EYES', one: 'ONE EYE', none: 'NO MASK' };
const NECKS: Neck[] = ['bandana', 'neckerchief', 'collar', 'spotted'];
const NECK_NAME: Record<Neck, string> = { bandana: 'BANDANA', neckerchief: 'NECKERCHIEF', collar: 'COLLAR', spotted: 'SPOTTED' };
// Things to wear dug up (systems/loot.ts) join the choices once found.
const necks = (g: Game) => NECKS.filter((n) => n !== 'spotted' || g.loot.has('kerchief'));
const TAG_ITEM: Record<Tag, string> = { none: '', brass: 'tag-brass', bone: 'tag-bone', gold: 'tag-gold' };
const TAG_NAME: Record<Tag, string> = { none: 'NONE', brass: 'BRASS', bone: 'BONE-SHAPED', gold: 'GOLDEN' };
const tags = (g: Game) => (Object.keys(TAG_ITEM) as Tag[]).filter((t) => t === 'none' || g.loot.has(TAG_ITEM[t]));
type Marks = 'none' | 'socks' | 'blaze' | 'both';
const MARK_NAME: Record<Marks, string> = { none: 'NONE', socks: 'WHITE SOCKS', blaze: 'A BLAZE', both: 'SOCKS AND BLAZE' };
const marksOf = (g: Game): Marks => (g.look.dog.socks ? (g.look.dog.blaze ? 'both' : 'socks') : g.look.dog.blaze ? 'blaze' : 'none');
const marks = (g: Game): Marks[] => {
  const s = g.loot.has('photo-socks'), b = g.loot.has('photo-blaze');
  return (['none', 'socks', 'blaze', 'both'] as Marks[]).filter((m) => m === 'none' || (m === 'socks' ? s : m === 'blaze' ? b : s && b));
};

interface Row { label: string; value: (g: Game) => string; step: (g: Game, d: -1 | 1) => void; show?: (g: Game) => boolean }

const ROWS: Row[] = [
  { label: 'COAT', value: (g) => SPECKLE_NAME[g.look.dog.speckle], step: (g, d) => { g.look.dog.speckle = cycle(SPECKLES, g.look.dog.speckle, d); } },
  { label: 'MASK', value: (g) => MASK_NAME[g.look.dog.mask], step: (g, d) => { g.look.dog.mask = cycle(MASKS, g.look.dog.mask, d); } },
  { label: 'SADDLE', value: (g) => (g.look.dog.saddle ? 'DARK PATCH' : 'NONE'), step: (g) => { g.look.dog.saddle = !g.look.dog.saddle; } },
  { label: 'TAIL', value: (g) => (g.look.dog.tailTip ? 'WHITE TIP' : 'PLAIN'), step: (g) => { g.look.dog.tailTip = !g.look.dog.tailTip; } },
  { label: 'NECK', value: (g) => NECK_NAME[g.look.dog.neck], step: (g, d) => { g.look.dog.neck = cycle(necks(g), g.look.dog.neck, d); } },
  { label: 'TAG', value: (g) => TAG_NAME[g.look.dog.tag ?? 'none'], step: (g, d) => { g.look.dog.tag = cycle(tags(g), g.look.dog.tag ?? 'none', d); }, show: (g) => tags(g).length > 1 },
  {
    label: 'MARKS',
    value: (g) => MARK_NAME[marksOf(g)],
    step: (g, d) => {
      const m = cycle(marks(g), marksOf(g), d);
      g.look.dog.socks = m === 'socks' || m === 'both';
      g.look.dog.blaze = m === 'blaze' || m === 'both';
    },
    show: (g) => marks(g).length > 1,
  },
];
const rowsFor = (g: Game) => ROWS.filter((r) => !r.show || r.show(g));

function changed(game: Game) {
  applyLook(game.look);
}

export function lookKeys(game: Game) {
  const inp = game.input;
  if (isTyping()) return;
  // Row 0 is the name, then the rows, then the button.
  const rows = rowsFor(game), N = rows.length + 2;
  if (inp.pressed('up')) game.lookSel = (game.lookSel + N - 1) % N;
  if (inp.pressed('down')) game.lookSel = (game.lookSel + 1) % N;
  const s = game.lookSel;
  const row = rows[s - 1];
  if (inp.pressed('cancel') || inp.pressed('pause')) return game.closeLook();
  if (inp.pressed('left') && row) { row.step(game, -1); changed(game); }
  if (inp.pressed('right') && row) { row.step(game, 1); changed(game); }
  if (inp.pressed('confirm')) {
    if (s === 0) focusField('dogname');
    else if (row) { row.step(game, 1); changed(game); }
    else game.closeLook();
  }
}

export function drawLook(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const ui = game.ui;
  const touch = game.input.touchMode;
  const S = safeArea(game.screen);
  const rows = rowsFor(game), N = rows.length + 2;
  dimView(g, game.view());
  const rh = touch ? 14 : 12, gap = touch ? 3 : 2;
  const pw = Math.min(W - 12, 190);
  const big = H - S.top - S.bottom >= 250 ? 3 : 2; // preview scale
  const prevH = 11 * big + 6;
  const ph = 16 + prevH + 12 + N * (rh + gap) + 8;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(2 + S.top, Math.round(H / 2 - ph / 2));
  panel(g, x0, y0, pw, ph);
  const fresh = game.lookFrom === 'new';
  heading(g, fresh ? 'MEET YOUR HEELER' : 'YOUR DOG', W / 2, y0 + 4, C.butter, { align: 'center', shade: C.moss });

  // Preview: trotting side on, then facing you and facing away.
  const px0 = x0 + 6, py0 = y0 + 14;
  rect(g, px0, py0, pw - 12, prevH, C.meadow);
  rect(g, px0, py0 + prevH - 3, pw - 12, 3, C.moss);
  const P = playerDogSprites().poses;
  const f = Math.floor(game.t * 7);
  const views = [P.side.run[f % P.side.run.length], P.down.stand, P.up.run[Math.floor(f / 2) % P.up.run.length]];
  // Sizes in world pixels: a dense sprite's grid is finer (sprW/sprH).
  const total = views.reduce((s, v) => s + sprW(v) * big, 0) + 2 * 10;
  let vx = Math.round(W / 2 - total / 2);
  for (const v of views) {
    drawSprAt(g, v, vx, py0 + prevH - 2 - sprH(v) * big, big);
    vx += sprW(v) * big + 10;
  }
  const name = game.look.name || defaultLook().name;
  text(g, name, W / 2, py0 + prevH + 3, C.butter, { align: 'center' });

  let y = py0 + prevH + 12;
  const bx = x0 + 6, bw = pw - 12;
  // Name: tap to type (the phone's keyboard comes up), or roll a new one.
  {
    const dice = 16;
    if (ui.hovering(bx, y, bw, rh)) game.lookSel = 0;
    textField(game.screen, g, 'dogname', bx, y, bw - dice - 3, rh, game.look.name, NAME_MAX, (s) => { game.look.name = s; }, game.t, game.lookSel === 0, () => {
      if (!game.look.name.trim()) game.look.name = defaultLook().name;
    });
    const dx = bx + bw - dice;
    panel(g, dx, y, dice, rh, ui.isActive('dog-dice') ? C.teal : C.plum, C.butter);
    text(g, '?', dx + dice / 2 + 1, y + Math.floor((rh - 5) / 2), C.butter, { align: 'center' });
    if (ui.click('dog-dice', dx - 1, y - 2, dice + 2, rh + 4)) {
      stopTyping();
      game.look.name = pickName(DOG_NAMES, game.look.name);
      game.lookSel = 0;
    }
    y += rh + gap;
  }
  rows.forEach((r, i) => {
    const sel = game.lookSel === i + 1;
    if (optionRow(game, g, `look-${i}`, bx, y, bw, rh, r.label, r.value(game), sel, (d) => { game.lookSel = i + 1; r.step(game, d); changed(game); })) game.lookSel = i + 1;
    y += rh + gap;
  });
  const label = fresh ? "LET'S GO!" : 'DONE';
  const dw = Math.max(60, textWidth(label) + 20);
  const dx = Math.round(W / 2 - dw / 2);
  const on = game.lookSel === N - 1;
  if (ui.hovering(dx, y, dw, rh)) game.lookSel = N - 1;
  panel(g, dx, y, dw, rh, on || ui.isActive('look-done') ? C.teal : C.plum, C.butter);
  text(g, label, W / 2, y + Math.floor((rh - 5) / 2), on && Math.floor(game.t * 2.5) % 2 === 0 ? C.butter : C.wool, { align: 'center' });
  if (ui.click('look-done', dx - 3, y - 2, dw + 6, rh + 4)) game.closeLook();
  if (!touch && !isTyping()) text(g, game.lookSel === 0 ? 'ENTER: TYPE A NAME' : 'ARROWS: CHANGE', W / 2, y0 + ph + 3, C.wool, { align: 'center', shadow: C.plum });
  ui.captureAll('look-bg');
}
