import type { Screen } from './gfx/screen';
import { isTyping } from './ui/textfield';

export type Action =
  | 'bark'
  | 'nip'
  | 'build'
  | 'ledger'
  | 'pause'
  | 'helper'
  | 'mute'
  | 'confirm'
  | 'cancel'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'rotate'
  | 'prev'
  | 'next'
  | 'remove'
  | 'upgrade'
  | 'tab1'
  | 'tab2'
  | 'tab3'
  | 'tab4'
  | 'tab5'
  | 'any';

const KEYMAP: Record<string, Action[]> = {
  Space: ['bark', 'confirm'],
  KeyK: ['bark'],
  KeyE: ['nip', 'next'],
  KeyJ: ['nip'],
  KeyB: ['build'],
  Tab: ['ledger'],
  KeyG: ['ledger'],
  KeyH: ['helper'],
  Escape: ['pause', 'cancel'],
  KeyP: ['pause'],
  KeyM: ['mute'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  KeyR: ['rotate'],
  KeyQ: ['prev'],
  BracketLeft: ['prev'],
  BracketRight: ['next'],
  Comma: ['prev'],
  Period: ['next'],
  KeyX: ['remove'],
  Backspace: ['remove', 'cancel'],
  Delete: ['remove'],
  KeyU: ['upgrade'],
  Digit1: ['tab1'],
  Digit2: ['tab2'],
  Digit3: ['tab3'],
  Digit4: ['tab4'],
  Digit5: ['tab5'],
  KeyW: ['up'],
  ArrowUp: ['up'],
  KeyS: ['down'],
  ArrowDown: ['down'],
  KeyA: ['left'],
  ArrowLeft: ['left'],
  KeyD: ['right'],
  ArrowRight: ['right'],
};

export interface Ptr {
  id: number;
  x: number;
  y: number;
  downX: number;
  downY: number;
  isDown: boolean;
  justDown: boolean;
  justUp: boolean;
  owner: string | null; // UI element that captured it
  touch: boolean;
}

// A game pad (Gamepad API, standard mapping): which buttons are down now and
// were down last frame, and the left stick. src/ui/pad.ts turns presses
// into actions for whatever screen is up.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export interface PadState {
  connected: boolean;
  down: boolean[];
  was: boolean[];
  lx: number;
  ly: number;
  lt: number; // triggers, 0..1
  rt: number;
}

const PAD_DEAD = 0.2; // stick dead zone

export class Input {
  keys = new Set<string>();
  private queue = new Set<Action>();
  ptrs = new Map<number, Ptr>();
  uiHeld = new Set<string>(); // holds set by on-screen buttons this frame
  touchMode = false;
  padMode = false; // the last thing touched was a game pad: pad prompts
  pad: PadState = { connected: false, down: [], was: [], lx: 0, ly: 0, lt: 0, rt: 0 };
  active = 0; // performance.now() of the last key, touch, click or pad press
  hover: { x: number; y: number } | null = null;
  wheel = 0;
  // Virtual stick state (touch). x/y are the thumb offset in stickRadius
  // units: full walk well inside the rim, sprint once pushed past it.
  stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false, sprint: false };
  stickEnabled = true;
  readonly stickRadius = 20;
  readonly sprintRadius = 26; // thumb this far out (internal px) runs
  readonly stickReach = 30; // the base follows the thumb beyond this
  // Scripted control (debug bots and tests).
  override: { x: number; y: number; sprint: boolean; lie: boolean } | null = null;

  constructor(private screen: Screen) {
    this.touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.ptrs.clear();
      this.stick.active = false;
    });
    const c = screen.view;
    c.addEventListener('pointerdown', (e) => this.onPtr(e, 'down'));
    window.addEventListener('pointermove', (e) => this.onPtr(e, 'move'));
    window.addEventListener('pointerup', (e) => this.onPtr(e, 'up'));
    window.addEventListener('pointercancel', (e) => this.onPtr(e, 'up'));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.metaKey || e.ctrlKey) return;
    // A name is being typed: the keys are letters, not commands.
    if (isTyping()) {
      this.keys.clear();
      return;
    }
    const code = e.code;
    this.active = performance.now();
    if (down) {
      if (!e.repeat) {
        for (const a of KEYMAP[code] ?? []) this.queue.add(a);
        this.queue.add('any');
      }
      this.keys.add(code);
      this.touchMode = false;
      this.padMode = false;
      this.hover = null; // a resting mouse must not steal the menu selection
    } else {
      this.keys.delete(code);
    }
    if (KEYMAP[code] || code.startsWith('Shift')) e.preventDefault();
  }

  private onPtr(e: PointerEvent, kind: 'down' | 'move' | 'up') {
    const [x, y] = this.screen.toInternal(e.clientX, e.clientY);
    const touch = e.pointerType !== 'mouse';
    this.active = performance.now();
    if (kind === 'down') {
      if (touch) this.touchMode = true;
      this.padMode = false;
      this.ptrs.set(e.pointerId, { id: e.pointerId, x, y, downX: x, downY: y, isDown: true, justDown: true, justUp: false, owner: null, touch });
      this.queue.add('any');
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    } else {
      const p = this.ptrs.get(e.pointerId);
      if (!touch && (kind === 'up' || !this.padMode || Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) {
        this.hover = { x, y };
        this.padMode = false;
      }
      if (!p) return;
      p.x = x;
      p.y = y;
      if (kind === 'up') {
        p.isDown = false;
        p.justUp = true;
      }
    }
  }

  push(a: Action) {
    this.queue.add(a);
  }

  pressed(a: Action): boolean {
    if (this.queue.has(a)) {
      this.queue.delete(a);
      return true;
    }
    return false;
  }

  peek(a: Action): boolean {
    return this.queue.has(a);
  }

  clearQueue() {
    this.queue.clear();
  }

  key(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  get lie(): boolean {
    if (this.override) return this.override.lie;
    return this.key('KeyQ', 'KeyL', 'KeyC') || this.uiHeld.has('lie') || this.padHeld(PAD.X);
  }

  get sprint(): boolean {
    if (this.override) return this.override.sprint;
    if (this.key('ShiftLeft', 'ShiftRight')) return true;
    if (this.pad.rt > 0.35 || this.pad.lt > 0.35 || this.padHeld(PAD.RB)) return true;
    return this.stick.active && this.stick.sprint;
  }

  // ---- Game pad ----

  padHeld(b: number): boolean {
    return !!this.pad.down[b];
  }

  // Pressed since the last poll.
  padHit(b: number): boolean {
    return !!this.pad.down[b] && !this.pad.was[b];
  }

  // Once a frame, before the game updates: read the first pad there is.
  pollPad() {
    const p = this.pad;
    p.was = p.down;
    let gp: Gamepad | null = null;
    try {
      for (const c of navigator.getGamepads?.() ?? []) if (c && c.connected) { gp = c; break; }
    } catch { /* not allowed here */ }
    if (!gp) {
      p.connected = false;
      p.down = [];
      p.lx = p.ly = p.lt = p.rt = 0;
      return;
    }
    p.connected = true;
    p.down = gp.buttons.map((b, i) => b.pressed || b.value > (i === PAD.LT || i === PAD.RT ? 0.35 : 0.5));
    p.lt = gp.buttons[PAD.LT]?.value ?? 0;
    p.rt = gp.buttons[PAD.RT]?.value ?? 0;
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const l = Math.hypot(ax, ay);
    // Radial dead zone, rescaled so the stick still reaches full speed.
    const k = l < PAD_DEAD ? 0 : Math.min(1, (l - PAD_DEAD) / (1 - PAD_DEAD - 0.05)) / l;
    p.lx = ax * k;
    p.ly = ay * k;
    if (p.down.some((d, i) => d && !p.was[i]) || l > 0.5) {
      this.active = performance.now();
      if (!this.padMode) {
        this.padMode = true;
        this.touchMode = false;
        this.hover = null;
      }
    }
  }

  get move(): { x: number; y: number } {
    if (this.override) return { x: this.override.x, y: this.override.y };
    let x = 0, y = 0;
    if (this.key('KeyA', 'ArrowLeft')) x -= 1;
    if (this.key('KeyD', 'ArrowRight')) x += 1;
    if (this.key('KeyW', 'ArrowUp')) y -= 1;
    if (this.key('KeyS', 'ArrowDown')) y += 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    // A pad moves the dog once it is the thing in use (a resting stick that
    // drifts must not walk a touch player's dog).
    const pd = this.padMode ? this.pad.down : [];
    if (pd[PAD.LEFT] || pd[PAD.RIGHT] || pd[PAD.UP] || pd[PAD.DOWN]) {
      const dx = (pd[PAD.RIGHT] ? 1 : 0) - (pd[PAD.LEFT] ? 1 : 0), dy = (pd[PAD.DOWN] ? 1 : 0) - (pd[PAD.UP] ? 1 : 0);
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    if (this.padMode && (this.pad.lx || this.pad.ly)) {
      // The same gentle curve as the touch stick: easy to creep.
      const l = Math.hypot(this.pad.lx, this.pad.ly);
      const m = Math.min(1, l);
      const k = (m * (0.35 + 0.65 * m)) / l;
      return { x: this.pad.lx * k, y: this.pad.ly * k };
    }
    if (this.stick.active) {
      const l = Math.hypot(this.stick.x, this.stick.y);
      // Small dead zone, a gentle curve so slow creeping is easy, and full
      // walking pace from 80% of the rim, well before the sprint zone.
      if (l < 0.15) return { x: 0, y: 0 };
      const m = Math.min(1, (l - 0.15) / 0.65);
      const k = (m * (0.35 + 0.65 * m)) / l;
      return { x: this.stick.x * k, y: this.stick.y * k };
    }
    return { x: 0, y: 0 };
  }

  // Called once per rendered frame after the UI has claimed its pointers.
  endFrame() {
    for (const p of this.ptrs.values()) {
      if (p.justDown && !p.owner && p.touch && this.stickEnabled && !this.stick.active) {
        this.stick = { id: p.id, ox: p.x, oy: p.y, x: 0, y: 0, active: true, sprint: false };
        p.owner = 'stick';
      }
    }
    const sp = this.ptrs.get(this.stick.id);
    if (this.stick.active) {
      if (!sp || !sp.isDown || !this.stickEnabled) {
        this.stick.active = false;
        this.stick.sprint = false;
        this.stick.x = this.stick.y = 0;
      } else {
        let dx = sp.x - this.stick.ox;
        let dy = sp.y - this.stick.oy;
        const l = Math.hypot(dx, dy);
        if (l > this.stickReach) {
          // Drag the base along so the thumb never runs off the stick.
          this.stick.ox = sp.x - (dx / l) * this.stickReach;
          this.stick.oy = sp.y - (dy / l) * this.stickReach;
          dx = (dx / l) * this.stickReach;
          dy = (dy / l) * this.stickReach;
        }
        const d = Math.min(l, this.stickReach);
        // A little hysteresis so the run does not flicker at the edge.
        this.stick.sprint = this.stick.sprint ? d > this.sprintRadius - 3 : d > this.sprintRadius;
        this.stick.x = dx / this.stickRadius;
        this.stick.y = dy / this.stickRadius;
      }
    }
    for (const [id, p] of this.ptrs) {
      p.justDown = false;
      if (p.justUp) this.ptrs.delete(id);
    }
    this.uiHeld.clear();
    this.wheel = 0;
  }
}
