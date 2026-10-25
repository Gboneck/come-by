import type { Screen } from './gfx/screen';

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

export class Input {
  keys = new Set<string>();
  private queue = new Set<Action>();
  ptrs = new Map<number, Ptr>();
  uiHeld = new Set<string>(); // holds set by on-screen buttons this frame
  touchMode = false;
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
    const code = e.code;
    if (down) {
      if (!e.repeat) {
        for (const a of KEYMAP[code] ?? []) this.queue.add(a);
        this.queue.add('any');
      }
      this.keys.add(code);
      this.touchMode = false;
    } else {
      this.keys.delete(code);
    }
    if (KEYMAP[code] || code.startsWith('Shift')) e.preventDefault();
  }

  private onPtr(e: PointerEvent, kind: 'down' | 'move' | 'up') {
    const [x, y] = this.screen.toInternal(e.clientX, e.clientY);
    const touch = e.pointerType !== 'mouse';
    if (kind === 'down') {
      if (touch) this.touchMode = true;
      this.ptrs.set(e.pointerId, { id: e.pointerId, x, y, downX: x, downY: y, isDown: true, justDown: true, justUp: false, owner: null, touch });
      this.queue.add('any');
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    } else {
      const p = this.ptrs.get(e.pointerId);
      if (!touch) this.hover = { x, y };
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
    return this.key('KeyQ', 'KeyL', 'KeyC') || this.uiHeld.has('lie');
  }

  get sprint(): boolean {
    if (this.override) return this.override.sprint;
    if (this.key('ShiftLeft', 'ShiftRight')) return true;
    return this.stick.active && this.stick.sprint;
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
