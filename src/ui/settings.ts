// Player settings from the pause menu, remembered in localStorage.
// (Sound on/off lives in the Sound object, which stores its own.)
import type { QualitySetting } from '../gfx/quality';

const KEY = 'comeby-settings';

export type ZoneMode = 'lying' | 'always';

export interface Settings {
  shake: boolean; // camera kicks on bark, nip, gate and tier-up
  zones: ZoneMode; // when the nearest flock's flight zone ring shows
  haptics: boolean; // navigator.vibrate on phones that have it
  quality: QualitySetting; // GRAPHICS: auto, or a level (gfx/quality.ts)
  view: 'close' | 'wide'; // VIEW: the screen's scale (gfx/screen.ts)
}

const DEFAULTS: Settings = { shake: true, zones: 'lying', haptics: true, quality: 'auto', view: 'close' };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* storage may be blocked */ }
  return { ...DEFAULTS };
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

// A short buzz (ms, or an on/off pattern). Only on touch devices that can.
export function buzz(touch: boolean, pattern: number | number[]) {
  if (!touch || !settings.haptics || !canVibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch { /* some browsers throw without a user gesture */ }
}
