import type { Input, Ptr } from '../input';

// Immediate-mode hit testing for on-screen buttons. Call button()/hold()
// while drawing; results apply to the pointers seen this frame.
export class UI {
  constructor(private input: Input) {}

  private inside(p: Ptr, x: number, y: number, w: number, h: number) {
    return p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;
  }

  private insideDown(p: Ptr, x: number, y: number, w: number, h: number) {
    return p.downX >= x && p.downY >= y && p.downX < x + w && p.downY < y + h;
  }

  // Fires on press (good for game actions like bark).
  press(id: string, x: number, y: number, w: number, h: number): boolean {
    for (const p of this.input.ptrs.values()) {
      if (p.justDown && !p.owner && this.insideDown(p, x, y, w, h)) {
        p.owner = id;
        return true;
      }
    }
    return false;
  }

  // Fires on release inside (good for menus). Also captures the pointer so
  // the stick does not grab it.
  click(id: string, x: number, y: number, w: number, h: number): boolean {
    for (const p of this.input.ptrs.values()) {
      if (p.justDown && !p.owner && this.insideDown(p, x, y, w, h)) p.owner = id;
      if (p.owner === id && p.justUp) return this.inside(p, x, y, w, h);
    }
    return false;
  }

  // True while a pointer that started on this button is down.
  hold(id: string, x: number, y: number, w: number, h: number): boolean {
    let held = false;
    for (const p of this.input.ptrs.values()) {
      if (p.justDown && !p.owner && this.insideDown(p, x, y, w, h)) p.owner = id;
      if (p.owner === id && p.isDown) held = true;
    }
    return held;
  }

  isActive(id: string): boolean {
    for (const p of this.input.ptrs.values()) if (p.owner === id && p.isDown) return true;
    return false;
  }

  hovering(x: number, y: number, w: number, h: number): boolean {
    const hv = this.input.hover;
    return !!hv && hv.x >= x && hv.y >= y && hv.x < x + w && hv.y < y + h;
  }

  // Swallow any fresh pointer anywhere (modal screens).
  captureAll(id: string): boolean {
    let tapped = false;
    for (const p of this.input.ptrs.values()) {
      if (p.justDown && !p.owner) p.owner = id;
      if (p.owner === id && p.justUp) tapped = true;
    }
    return tapped;
  }
}
