import { C } from '../palette';
import { disc, panel, rect, ring } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Game } from '../game';
import type { Dog } from '../entities/dog';
import type { View } from '../render/world';
import { edgeArrow, type Margins } from '../ui/hud';

// Pings: a quick word to the other dogs. A tap of F (or the PING button)
// says "over here" and leaves a marker where your dog stands; hold it and
// pick HOLD, COME BY (go round clockwise) or AWAY (anticlockwise), shown
// over your dog. Every screen sees and hears it.

export type PingKind = 'here' | 'hold' | 'come' | 'away';
export const PING_KINDS: PingKind[] = ['here', 'hold', 'come', 'away'];
export const PING_WORD: Record<PingKind, string> = { here: 'OVER HERE!', hold: 'HOLD!', come: 'COME BY!', away: 'AWAY!' };
const PING_LIFE: Record<PingKind, number> = { here: 4.5, hold: 2.6, come: 2.6, away: 2.6 };
const PICK_AFTER = 0.28; // seconds held before the choice opens
const EVERY = 0.6; // one ping this often at most

export interface Ping {
  slot: number;
  name: string;
  kind: PingKind;
  x: number;
  y: number;
  t: number;
}

// What the host's and a guest's sessions both offer the pings.
export interface PingNet {
  slot: number;
  pings: Pings;
  dogOf(slot: number): Dog | null;
  nameOf(slot: number): string;
  sendPing(game: Game, kind: PingKind): void;
}

export class Pings {
  list: Ping[] = [];
  lastSent = -9;

  add(game: Game, p: Omit<Ping, 't'>) {
    // A newer word from the same dog replaces the old one.
    this.list = this.list.filter((q) => q.slot !== p.slot || (q.kind === 'here') !== (p.kind === 'here'));
    this.list.push({ ...p, t: 0 });
    game.audio?.play(`ping-${p.kind}`, { x: p.x, y: p.y, force: true });
  }

  update(dt: number) {
    for (const p of this.list) p.t += dt;
    this.list = this.list.filter((p) => p.t < PING_LIFE[p.kind]);
  }

  // May we send another yet?
  ready(t: number) {
    if (t - this.lastSent < EVERY) return false;
    this.lastSent = t;
    return true;
  }
}

// ---- Drawing ----

function label(g: CanvasRenderingContext2D, s: string, x: number, y: number, hot: boolean) {
  const w = textWidth(s);
  panel(g, Math.round(x - w / 2 - 3), y - 2, w + 6, 9, hot ? C.butter : C.plum, C.plum);
  text(g, s, x, y, hot ? C.plum : C.butter, { align: 'center' });
}

// Markers in the field (call with the view's offset applied by the caller).
export function drawPings(game: Game, net: PingNet, g: CanvasRenderingContext2D, v: View) {
  for (const p of net.pings.list) {
    const fresh = p.t < 0.35 || Math.floor(p.t * 4) % 2 === 0;
    if (p.kind === 'here') {
      const x = Math.round(p.x - v.ox), y = Math.round(p.y - v.oy);
      // Rings going out, a little flag on a pole.
      const k = (p.t * 1.4) % 1;
      ring(g, x, y, 4 + k * 18, C.butter, 4);
      ring(g, x, y, 3, C.butter);
      rect(g, x, y - 13, 1, 13, C.plum);
      rect(g, x + 1, y - 13, 5, 4, C.butter);
      rect(g, x + 1, y - 9, 5, 1, C.plum);
      label(g, `${p.name}: ${PING_WORD.here}`, x, y - 23, fresh && p.t < 1);
    } else {
      // Over the dog that said it, wherever it has got to.
      const d = net.dogOf(p.slot);
      const wx = d ? d.x : p.x, wy = d ? d.y : p.y;
      const x = Math.round(wx - v.ox), y = Math.round(wy - v.oy);
      label(g, PING_WORD[p.kind], x, y - (p.slot === net.slot ? 20 : 28), fresh && p.t < 1);
    }
  }
}

// Arrows to pings off screen.
export function pingArrows(game: Game, net: PingNet, g: CanvasRenderingContext2D, M: Margins) {
  for (const p of net.pings.list) {
    if (p.slot === net.slot) continue;
    const d = p.kind === 'here' ? null : net.dogOf(p.slot);
    edgeArrow(g, game, d ? d.x : p.x, d ? d.y : p.y, C.butter, p.kind === 'here' ? `${p.name}!` : PING_WORD[p.kind], M);
  }
}

// ---- The controls: F on a keyboard, the PING button on a phone ----

const pad = { down: false, held: 0, pick: null as PingKind | null, ox: 0, oy: 0, froze: false, last: 0 };

const DIRS: [PingKind, number, number][] = [['hold', 0, -1], ['come', 1, 0], ['away', -1, 0], ['here', 0, 1]];

// `btn` is the touch button (or null without touch). Returns true while the
// choice is open, so the caller can hide what it covers.
export function pingControls(game: Game, net: PingNet, g: CanvasRenderingContext2D, W: number, H: number, btn: { x: number; y: number; r: number } | null): boolean {
  const input = game.input, ui = game.ui;
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, Math.max(0, now - (pad.last || now)));
  pad.last = now;
  let down = input.key('KeyF');
  let px = 0, py = 0, touch = false;
  if (btn) {
    const held = ui.hold('ping', btn.x - btn.r - 3, btn.y - btn.r - 3, btn.r * 2 + 6, btn.r * 2 + 6);
    if (held) {
      for (const p of input.ptrs.values()) if (p.owner === 'ping') { px = p.x; py = p.y; }
      down = true;
      touch = true;
    }
    // The button.
    const on = held;
    disc(g, btn.x, btn.y + 1, btn.r, C.sage);
    disc(g, btn.x, btn.y + (on ? 1 : 0), btn.r, on ? C.teal : C.plum);
    ring(g, btn.x, btn.y + (on ? 1 : 0), btn.r, on ? C.butter : C.sage);
    text(g, 'PING', btn.x + 1, btn.y - 2 + (on ? 1 : 0), on ? C.butter : C.wool, { align: 'center' });
  }
  if (down && !pad.down) {
    pad.held = 0;
    pad.pick = null;
    pad.ox = touch ? px : 0;
    pad.oy = touch ? py : 0;
  }
  let open = false;
  if (down) {
    pad.held += dt;
    open = pad.held >= PICK_AFTER;
    if (open) {
      if (touch) {
        const dx = px - pad.ox, dy = py - pad.oy;
        if (Math.hypot(dx, dy) > 8) pad.pick = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'come' : 'away') : dy > 0 ? 'here' : 'hold';
      } else {
        if (input.key('KeyW', 'ArrowUp')) pad.pick = 'hold';
        else if (input.key('KeyD', 'ArrowRight')) pad.pick = 'come';
        else if (input.key('KeyA', 'ArrowLeft')) pad.pick = 'away';
        else if (input.key('KeyS', 'ArrowDown')) pad.pick = 'here';
      }
      // The dog waits while you choose.
      if (!input.override) {
        input.override = { x: 0, y: 0, sprint: false, lie: game.dog.lying };
        pad.froze = true;
      }
      drawPicker(game, g, W, H, touch ? pad.ox : Math.round(game.dog.x - game.view().ox), touch ? pad.oy : Math.round(game.dog.y - game.view().oy));
    }
  } else if (pad.down) {
    // Let go: a tap says "over here"; a choice says what was chosen.
    const kind = pad.held < PICK_AFTER ? 'here' : pad.pick ?? 'here';
    if (net.pings.ready(game.t)) net.sendPing(game, kind);
  }
  if (!down && pad.froze) {
    input.override = null;
    pad.froze = false;
  }
  pad.down = down;
  return open;
}

function drawPicker(game: Game, g: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number) {
  // Kept on screen: the choices sit round the middle point.
  const x = Math.max(34, Math.min(W - 34, cx)), y = Math.max(22, Math.min(H - 22, cy));
  for (const [k, dx, dy] of DIRS) {
    const s = PING_WORD[k].replace('!', '');
    label(g, s, x + dx * 26, y + dy * 15 - 2, pad.pick === k);
  }
  disc(g, x, y, 2, C.butter);
}

export function pingHelp(touch: boolean): string {
  return touch ? 'TAP PING: OVER HERE. HOLD IT AND SLIDE: HOLD, COME BY, AWAY.' : 'F: OVER HERE. HOLD F AND PRESS A WAY: HOLD, COME BY, AWAY.';
}
