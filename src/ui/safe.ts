import type { Screen } from '../gfx/screen';

// Safe-area insets (notch, status bar, home indicator) in internal pixels.
// The page uses viewport-fit=cover, so the canvas runs under them; the UI
// keeps out. `?safe=top,right,bottom,left` (CSS px) fakes them for tests.
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | null = null;
let css: Insets | null = null;
let key = '';
let cached: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

function readCss(): Insets {
  const fake = new URLSearchParams(location.search).get('safe');
  if (fake) {
    const [top = 0, right = 0, bottom = 0, left = 0] = fake.split(',').map(Number);
    return { top, right, bottom, left };
  }
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const s = getComputedStyle(probe);
  return { top: parseFloat(s.paddingTop) || 0, right: parseFloat(s.paddingRight) || 0, bottom: parseFloat(s.paddingBottom) || 0, left: parseFloat(s.paddingLeft) || 0 };
}

if (typeof window !== 'undefined') window.addEventListener('resize', () => { css = null; });

export function safeArea(screen: Screen): Insets {
  const k = `${screen.W}x${screen.H}@${screen.scale}/${screen.dpr}`;
  if (css && k === key) return cached;
  css = readCss();
  key = k;
  const f = screen.dpr / screen.scale;
  cached = {
    top: Math.ceil(css.top * f),
    right: Math.ceil(css.right * f),
    bottom: Math.ceil(css.bottom * f),
    left: Math.ceil(css.left * f),
  };
  return cached;
}
