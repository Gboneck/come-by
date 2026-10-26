import { DEFAULT_DOG, setPlayerLook, type DogLook } from '../art/dogstyle';
import { ROOFS, TRIMS, farmLook, type Roof, type Trim } from '../art/ranchstyle';

// The player's choices: the dog's name and coat, the ranch's name and paint.
// Kept in the save; old saves get the defaults.
export interface Look {
  name: string;
  dog: DogLook;
  ranch: string; // '' = the sign names the tier, as before
  roof: Roof;
  trim: Trim;
}

export const defaultLook = (): Look => ({ name: 'BLUE', dog: { ...DEFAULT_DOG }, ranch: '', roof: 'slate', trim: 'sage' });

export const NAME_MAX = 10;
export const RANCH_MAX = 12;

// Cozy names for a cattle dog (none shared with the helpers or the rivals).
export const DOG_NAMES = ['BLUE', 'MAC', 'SCOUT', 'RUBY', 'BANJO', 'JACK', 'MAGGIE', 'DUSTY', 'TILLY', 'BOSS', 'ZIGGY', 'OLLIE', 'KIP', 'MILO', 'ROSIE', 'BINDI'];
export const RANCH_NAMES = ['WILLOW CREEK', 'BLUE GUM', 'STONY FORD', 'HONEY HILL', 'TWO OAKS', 'FIDDLE FARM', 'WINDY GAP', 'APPLE CROSS', 'LONG MEADOW'];

export function pickName(list: string[], not: string): string {
  const others = list.filter((n) => n !== not);
  return others[Math.floor(Math.random() * others.length)];
}

// Letters the pixel font can draw.
export function cleanName(s: string, max: number): string {
  return s.toUpperCase().replace(/[^A-Z0-9 '.!-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, max);
}

// Merge a saved look over the defaults (any field may be missing).
export function readLook(saved: Partial<Look> | undefined): Look {
  const d = defaultLook();
  if (!saved) return d;
  const one = <T>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def);
  const sd = (saved.dog ?? {}) as Partial<DogLook>;
  return {
    name: cleanName(String(saved.name ?? d.name), NAME_MAX) || d.name,
    dog: {
      speckle: one(sd.speckle, ['light', 'classic', 'heavy'] as const, d.dog.speckle),
      mask: one(sd.mask, ['both', 'one', 'none'] as const, d.dog.mask),
      saddle: !!sd.saddle,
      tailTip: !!sd.tailTip,
      neck: one(sd.neck, ['bandana', 'neckerchief', 'collar', 'spotted'] as const, d.dog.neck),
      tag: one(sd.tag, ['none', 'brass', 'bone', 'gold'] as const, 'none'),
      socks: !!sd.socks,
      blaze: !!sd.blaze,
    },
    ranch: cleanName(String(saved.ranch ?? ''), RANCH_MAX).trim(),
    roof: one(saved.roof, Object.keys(ROOFS) as Roof[], d.roof),
    trim: one(saved.trim, Object.keys(TRIMS) as Trim[], d.trim),
  };
}

// Push the look into the art: the dog's sprites and the farmhouse paint.
export function applyLook(look: Look) {
  setPlayerLook(look.dog);
  farmLook.roof = look.roof;
  farmLook.trim = look.trim;
}
