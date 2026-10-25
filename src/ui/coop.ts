import { C } from '../palette';
import { panel, rect } from '../gfx/draw';
import { text, textWidth, wrap } from '../gfx/font';
import type { Game } from '../game';
import type { View } from '../render/world';
import { HostNet } from '../net/host';
import { GuestNet, joining } from '../net/guest';
import { dimView } from './feel';
import { focusField, stopTyping, textField, typingId } from './textfield';
import { safeArea } from './safe';
import { edgeArrow } from './hud';
import { touchLayout } from './touch';
import { tierOf } from '../systems/progression';
import { drawPings, pingArrows, pingControls } from '../net/ping';

// The co-op screens. A host opens INVITE A FRIEND from the pause menu: a
// room code and a link to send. A guest opens JOIN A FRIEND on the title
// screen (or follows the link) and types the code. Over the game: friends'
// name tags, arrows to them when they are off screen, and on a guest's
// screen the cards for whatever the host is busy with.

type View2 = 'invite' | 'join';

const ui = { view: 'join' as View2, code: '', note: '', noteT: 0, back: 'pause' as 'pause' | 'title' };

const CODE_MAX = 5;
const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_MAX);

export function openCoop(game: Game, view: View2, code = '') {
  ui.view = view;
  ui.note = '';
  ui.back = game.mode === 'title' ? 'title' : 'pause';
  if (view === 'invite' && !(game.net instanceof HostNet) && !game.demo) new HostNet(game);
  if (view === 'join') {
    ui.code = cleanCode(code);
    if (ui.code.length >= 4) startJoin();
  }
  game.mode = 'coop';
  game.input.clearQueue();
}

// The pause menu's co-op row.
export function coopRowLabel(game: Game): string {
  const n = game.net;
  if (n instanceof GuestNet) return `LEAVE ${n.hostName}'S RANCH`;
  if (n instanceof HostNet && n.status !== 'failed') return n.code ? `FRIENDS: ${n.code}  (${n.players.length})` : 'FRIENDS...';
  return 'INVITE A FRIEND';
}

export function coopLeave(game: Game) {
  if (game.net instanceof GuestNet) game.net.leave(game);
}

function startJoin() {
  if (ui.code.length < 4) {
    ui.note = 'THE CODE IS FOUR LETTERS';
    return;
  }
  joining?.close();
  stopTyping();
  new GuestNet(ui.code);
}

function closeCoop(game: Game) {
  stopTyping();
  if (ui.view === 'join') {
    joining?.close();
    game.mode = 'title';
  } else game.mode = ui.back === 'title' ? 'title' : 'pause';
  game.input.clearQueue();
}

function shareLink(game: Game, net: HostNet) {
  const url = net.link_url;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  const say = (s: string) => {
    ui.note = s;
    ui.noteT = game.t;
  };
  if (game.input.touchMode && nav.share) {
    nav.share({ title: 'Come By', text: `Come and herd with me! Code ${net.code}`, url }).catch(() => {});
    return;
  }
  if (nav.clipboard?.writeText) nav.clipboard.writeText(url).then(() => say('LINK COPIED'), () => say(`CODE ${net.code}`));
  else say(`CODE ${net.code}`);
}

// Keys while a co-op screen is up.
export function coopKeys(game: Game) {
  const inp = game.input;
  const net = game.net;
  // A guest whose ranch has arrived: off to it.
  if (ui.view === 'join' && joining && joining.status === 'joining' && joining.world) {
    game.fadeTo(() => (game.request = 'join'));
    return;
  }
  if (typingId()) return;
  if (inp.pressed('cancel') || inp.pressed('pause')) closeCoop(game);
  else if (inp.pressed('confirm')) {
    if (ui.view === 'join') {
      if (!joining || joining.ended) startJoin();
    } else if (net instanceof HostNet && net.code) shareLink(game, net);
  }
}

// ---- Drawing ----

function button(game: Game, g: CanvasRenderingContext2D, id: string, label: string, x: number, y: number, w: number, hot = false): boolean {
  const touch = game.input.touchMode;
  const h = touch ? 15 : 12;
  const on = game.ui.isActive(id) || game.ui.hovering(x, y, w, h);
  panel(g, x, y, w, h, on ? C.teal : C.plum, hot || on ? C.butter : C.sage);
  text(g, label, x + w / 2, y + Math.floor((h - 5) / 2), C.wool, { align: 'center' });
  return game.ui.click(id, x - 2, y - 2, w + 4, h + 4);
}

const lines = (s: string, w: number) => wrap(s, w);

function drawPanel(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  const touch = game.input.touchMode;
  const pw = Math.min(W - 16, 180);
  const bh = touch ? 15 : 12;
  dimView(g, game.view());
  const net = game.net;
  const rows: { s: string; c: string; scale?: number }[] = [];
  let buttons: { id: string; label: string; act: () => void; hot?: boolean }[] = [];
  let field = false;

  if (ui.view === 'invite') {
    rows.push({ s: 'INVITE A FRIEND', c: C.butter });
    if (!(net instanceof HostNet)) {
      rows.push({ s: 'CO-OP NEEDS A RANCH OF YOUR OWN.', c: C.wool });
    } else if (net.status === 'failed') {
      for (const l of lines(net.error || 'SOMETHING WENT WRONG', pw - 16)) rows.push({ s: l, c: C.wool });
      buttons.push({ id: 'coop-retry', label: 'TRY AGAIN', act: () => { net.close(); new HostNet(game); }, hot: true });
    } else if (!net.code || net.status === 'opening') {
      rows.push({ s: 'OPENING THE GATE...', c: C.wool });
    } else {
      rows.push({ s: 'YOUR FRIEND TAPS JOIN A FRIEND', c: C.sage });
      rows.push({ s: 'ON THE TITLE AND TYPES:', c: C.sage });
      rows.push({ s: net.code.split('').join(' '), c: C.butter, scale: 3 });
      if (net.status === 'reconnecting') rows.push({ s: 'RECONNECTING...', c: C.wool });
      rows.push({ s: '', c: C.wool });
      const ps = net.players;
      rows.push({ s: `HERE: ${ps.map((p) => (p.slot === 0 ? `${p.name} (YOU)` : p.here ? p.name : `${p.name}...`)).join(', ')}`, c: C.wool });
      if (ps.length < 2) rows.push({ s: 'WAITING FOR A FRIEND. PLAY ON!', c: C.sage });
      buttons.push({ id: 'coop-share', label: touch && 'share' in navigator ? 'SHARE LINK' : 'COPY LINK', act: () => shareLink(game, net), hot: true });
      buttons.push({ id: 'coop-stop', label: 'CLOSE RANCH', act: () => { net.close(); closeCoop(game); } });
    }
    buttons.push({ id: 'coop-back', label: 'BACK', act: () => closeCoop(game) });
  } else {
    rows.push({ s: 'JOIN A FRIEND', c: C.butter });
    const j = joining;
    if (j && !j.ended) {
      rows.push({ s: `CODE ${j.code}`, c: C.wool });
      rows.push({ s: j.status === 'connecting' ? 'KNOCKING ON THE GATE...' : 'WALKING OVER...', c: C.sage });
      buttons.push({ id: 'coop-cancel', label: 'CANCEL', act: () => j.close() });
    } else {
      if (j?.ended) {
        rows.push({ s: j.ended.title, c: C.butter });
        for (const l of lines(j.ended.line, pw - 16)) rows.push({ s: l, c: C.wool });
      } else for (const l of lines('ASK YOUR FRIEND FOR THE CODE: PAUSE, THEN INVITE A FRIEND.', pw - 16)) rows.push({ s: l, c: C.sage });
      field = true;
      buttons.push({ id: 'coop-join', label: 'JOIN', act: startJoin, hot: ui.code.length >= 4 });
    }
    buttons.push({ id: 'coop-back', label: 'BACK', act: () => closeCoop(game) });
  }
  if (ui.note && game.t - ui.noteT < 3) rows.push({ s: ui.note, c: C.butter });

  const rowH = (r: { scale?: number }) => (r.scale ?? 1) * 5 + 3;
  const fh = field ? bh + 8 : 0;
  // Buttons two to a row.
  const bw = Math.floor((pw - 20) / 2);
  const brows = Math.ceil(buttons.length / 2);
  const ph = 10 + rows.reduce((s, r) => s + rowH(r), 0) + fh + brows * (bh + 4) + 6;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(4, Math.round(H / 2 - ph / 2));
  panel(g, x0, y0, pw, ph);
  let y = y0 + 6;
  for (const r of rows) {
    if (r.s) text(g, r.s, W / 2, y, r.c, { align: 'center', scale: r.scale });
    y += rowH(r);
  }
  if (field) {
    const fw = 70, fx = Math.round(W / 2 - fw / 2);
    textField(game.screen, g, 'coop-code', fx, y + 2, fw, bh, ui.code, CODE_MAX, (s) => (ui.code = cleanCode(s)), game.t, true, () => {
      if (ui.code.length >= 4) startJoin();
    });
    // Keyboards type straight away; a phone taps the field (textfield.ts).
    if (!game.input.touchMode && !typingId() && !joining) focusField('coop-code');
    y += fh;
  }
  buttons.forEach((b, i) => {
    const bx = x0 + 8 + (i % 2) * (bw + 4), by = y + Math.floor(i / 2) * (bh + 4);
    const w = buttons.length % 2 === 1 && i === buttons.length - 1 ? pw - 16 : bw;
    if (button(game, g, b.id, b.label, bx, by, w, b.hot)) b.act();
  });
  buttons = [];
}

// A small card in the middle of the field, for a guest.
function card(game: Game, g: CanvasRenderingContext2D, W: number, H: number, big: string, small: string[], dim = true) {
  if (dim) dimView(g, game.view(), 6);
  const pw = Math.min(W - 16, 170);
  const ls = small.flatMap((s) => lines(s, pw - 14));
  const ph = 16 + ls.length * 7;
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H * 0.38 - ph / 2);
  panel(g, x0, y0, pw, ph);
  text(g, big, W / 2, y0 + 5, C.butter, { align: 'center' });
  ls.forEach((l, i) => text(g, l, W / 2, y0 + 14 + i * 7, C.wool, { align: 'center' }));
}

function summaryCard(game: Game, g: CanvasRenderingContext2D, W: number, H: number, host: string) {
  const s = game.summary;
  const out: string[] = [];
  if (s) {
    const got = Object.values(s.stats.delivered).reduce((a, b) => a + (b ?? 0), 0);
    out.push(`${got} BROUGHT HOME  +${s.stats.deliveredValue}$`);
    if (s.stats.goodsValue) out.push(`GOODS SOLD  +${s.stats.goodsValue}$`);
    const lost = Object.values(s.stats.lost).reduce((a, b) => a + (b ?? 0), 0);
    if (lost) out.push(`LOST IN THE NIGHT: ${lost}`);
    out.push(`${host}'S PURSE: ${s.coins}$`);
  }
  out.push('');
  out.push(`WAITING FOR ${host} TO START THE NEXT DAY...`);
  card(game, g, W, H, s ? `DAY ${s.day} IS DONE` : 'THE DAY IS DONE', out);
}

// Name tags over friends' dogs ('world', under the HUD); the guest's cards
// and the co-op screens ('ui', over it).
export function drawCoop(game: Game, g: CanvasRenderingContext2D, v: View, layer: 'world' | 'ui') {
  const { W, H } = v;
  const net = game.net;
  if (layer === 'world') {
    if (game.mode === 'title' || game.mode === 'summary' || game.mode === 'build') return;
    for (const d of game.coop) {
      if (!d.tag) continue;
      const sx = Math.round(d.x - v.ox), sy = Math.round(d.y - v.oy);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      const tag = net?.isAway(d) ? `${d.tag} ZZZ` : d.tag;
      const w = textWidth(tag);
      rect(g, sx - Math.ceil(w / 2) - 1, sy - 19, w + 3, 7, C.plum);
      text(g, tag, sx + 1, sy - 18, C.butter, { align: 'center' });
    }
    if (net) drawPings(game, net, g, v);
    return;
  }
  if (game.mode === 'coop') {
    drawPanel(game, g, W, H);
    return;
  }
  const together = !!net && game.mode === 'play' && (net.role === 'guest' || net.dogs.length > 0);
  const S = safeArea(game.screen);
  const TL = game.input.touchMode ? touchLayout(game, W, H) : null;
  // Off-screen friends get an arrow with their name, so you can find each
  // other; so do pings out of sight.
  if (together && net) {
    const top = TL ? TL.top : H - 12 - S.bottom;
    const M = { top: S.top + 24, bottom: H - top + 10, left: S.left, right: S.right };
    for (const d of net.dogs) if (d.tag) edgeArrow(g, game, d.x, d.y, C.wool, d.tag, M);
    pingArrows(game, net, g, M);
  }
  if (net instanceof GuestNet) {
    const host = net.hostName;
    if (net.ended) {
      card(game, g, W, H, net.ended.title, [net.ended.line, '', game.input.touchMode ? 'TAP TO GO BACK' : 'PRESS ENTER']);
      if (game.ui.captureAll('coop-ended')) game.input.push('confirm');
      return;
    }
    if (net.status === 'reconnecting') return card(game, g, W, H, 'RECONNECTING...', ['THE LINE TO YOUR FRIEND DROPPED. HANG ON.'], false);
    if (net.status === 'away') return card(game, g, W, H, `WAITING FOR ${host}`, ['THEIR CONNECTION DROPPED. THE RANCH WAITS FOR THEM A WHILE.']);
    if (!net.ready) return card(game, g, W, H, 'WALKING OVER...', [`TO ${host}'S RANCH`]);
    if (net.hostBg) return card(game, g, W, H, `${host} STEPPED AWAY`, ['THEIR SCREEN IS OFF, SO THE RANCH IS WAITING. IT WILL GO ON WHEN THEY ARE BACK.']);
    if (net.stale) return card(game, g, W, H, `WAITING FOR ${host}`, ['THEIR GAME HAS STOPPED FOR A MOMENT. MAYBE THEIR SCREEN WENT TO SLEEP.']);
    const m = net.hostMode;
    if (m === 'summary') return summaryCard(game, g, W, H, host);
    if (m === 'build') return card(game, g, W, H, `${host} IS BUILDING`, [`${tierOf(game.tier).name}: ${game.coins}$ IN THE PURSE`, 'THE HERD WAITS TILL THEY ARE DONE.']);
    if (m === 'result') return void text(g, `WAITING FOR ${host}...`, W / 2, H - 14 - S.bottom, C.wool, { align: 'center', shadow: C.plum });
  }
  // Pings: F, or the PING button by the thumb buttons.
  if (together && net && !game.trials.result) {
    const btn = TL ? { x: TL.bark.x + 2, y: TL.lie.y - 13, r: 10 } : null;
    pingControls(game, net, g, W, H, btn);
  }
}
