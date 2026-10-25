import { C } from '../palette';
import { panel } from '../gfx/draw';
import { text, textWidth } from '../gfx/font';
import type { Screen } from '../gfx/screen';

// A name field drawn in the pixel font, typed with the device's own
// keyboard: a hidden <input> takes the keys. Phones only show a keyboard for
// focus() inside a tap, so the tap handler below does the focusing, against
// the rects the fields registered when they were last drawn.

interface Field {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  max: number;
  set: (s: string) => void;
  done?: () => void;
  at: number; // when last drawn
}

const fields = new Map<string, Field>();
let el: HTMLInputElement | null = null;
let active: Field | null = null;
let screen: Screen | null = null;

export const isTyping = () => !!el && typeof document !== 'undefined' && document.activeElement === el;

export function typingId(): string | null {
  return isTyping() && active ? active.id : null;
}

function clean(s: string, max: number) {
  return s.toUpperCase().replace(/[^A-Z0-9 '.!-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, max);
}

function ensure(): HTMLInputElement {
  if (el) return el;
  el = document.createElement('input');
  el.type = 'text';
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.setAttribute('autocapitalize', 'characters');
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('enterkeyhint', 'done');
  // Out of sight but focusable; 16px so iOS does not zoom the page.
  el.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;font-size:16px;border:0;padding:0;background:transparent;color:transparent;';
  document.body.appendChild(el);
  el.addEventListener('input', () => {
    if (!active || !el) return;
    const v = clean(el.value, active.max);
    if (v !== el.value) {
      // Upper-casing rewrites the text: keep the caret where it was.
      const at = Math.min(v.length, el.selectionStart ?? v.length);
      el.value = v;
      try { el.setSelectionRange(at, at); } catch { /* fine */ }
    }
    active.value = v;
    active.set(v);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      el?.blur();
    }
    e.stopPropagation();
  });
  el.addEventListener('blur', () => {
    const f = active;
    active = null;
    f?.done?.();
  });
  return el;
}

// Start typing in a field (taps call this from the event; keys from the game).
export function focusField(id: string) {
  const f = fields.get(id);
  if (!f) return;
  const input = ensure();
  active = f;
  input.maxLength = f.max;
  input.value = f.value;
  input.focus();
  // The old name is selected, so typing replaces it.
  try { input.setSelectionRange(0, f.value.length); } catch { /* fine */ }
}

export function stopTyping() {
  el?.blur();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', (e) => {
    if (!screen) return;
    const [x, y] = screen.toInternal(e.clientX, e.clientY);
    const now = performance.now();
    for (const f of fields.values()) {
      if (now - f.at > 250) continue;
      if (x >= f.x - 2 && y >= f.y - 3 && x < f.x + f.w + 2 && y < f.y + f.h + 3) {
        focusField(f.id);
        return;
      }
    }
    // A tap anywhere else puts the keyboard away.
    if (isTyping()) stopTyping();
  }, true);
}

// Draw a field and register it for taps. `set` gets each edit as it is
// typed; `done` runs when typing ends.
export function textField(scr: Screen, g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, value: string, max: number, set: (s: string) => void, t: number, hot = false, done?: () => void) {
  screen = scr;
  const typing = typingId() === id;
  const f: Field = fields.get(id) ?? { id, x, y, w, h, value, max, set, done, at: 0 };
  Object.assign(f, { x, y, w, h, max, set, done, at: performance.now() });
  if (!typing) f.value = value;
  fields.set(id, f);
  panel(g, x, y, w, h, typing ? C.teal : C.plum, typing || hot ? C.butter : C.sage);
  const shown = typing ? f.value : value;
  const ty = y + Math.floor((h - 5) / 2);
  text(g, shown, x + 4, ty, C.wool);
  if (typing && Math.floor(t * 2.5) % 2 === 0) {
    g.fillStyle = C.butter;
    g.fillRect(x + 5 + textWidth(shown), ty, 1, 5);
  }
  else if (!typing && hot) text(g, '...', x + w - 4, ty, C.sage, { align: 'right' });
}
