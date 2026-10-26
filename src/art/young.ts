import type { SpeciesId } from '../world/map';
import { buildSprites, resolveEyes, rimLight, type AnimalGrids, type AnimalSprites } from './animals';

// Lambs, and the fair's rare breeds. (Gameplay drew these; Graphics may
// polish them.)

// ---- Rare breeds: recolours of the species' grids ----
// Call duck: buff (buttercup) with a moss bill. Pygmy goat: dark, with a
// pale face and socks. Highland cow: a golden coat with plum horns.
export function rareCoat(id: SpeciesId, coat: number, rows: string[]): string[] | null {
  if (id === 'duck' && coat === 1) return rows.map((r) => r.replace(/[wy]/g, (m) => (m === 'w' ? 'y' : 'o')));
  if (id === 'goat' && coat === 2) return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
  if (id === 'cow' && coat === 2)
    return rows.map((r, i) => (i >= rows.length - 2 ? r : r.replace(/[pwts]/g, (m) => ({ p: 'y', w: 'p', t: 'w', s: 'o' })[m]!)));
  return null;
}

// ---- Lambs: small, leggy, big-headed; plum face, ears and legs ----
const LB_BODY = ['.www.pp.', 'wwwwwpep', 'wwwwww..', '.swwws..'];
const LB_LOOK = ['.www.p.p', 'wwwwwpp.', 'wwwwww..', '.swwws..'];
const LB_CHEW = ['.www.pp.', 'wwwwwpep', 'wwwwwwp.', '.swwws..'];
const LB_ALERT = ['.....pp.', '.www.pep', 'wwwwwppp', 'wwwwww..', '.swwws..'];
const LAMB: AnimalGrids = {
  side: ['.p..p.p.', '..p..p..', '.p.p..p.', '..pp.pp.'].map((l) => [...LB_BODY, l]),
  // Running is all skipping: a stretch, then all four tucked up in the air.
  run: [[...LB_BODY, 'p.p...pp'], [...LB_BODY, '..pp.p..', ''], [...LB_BODY, '.p.p..p.'], [...LB_BODY, '..pp.pp.', '']],
  graze: [
    ['.www....', 'wwwwww..', 'wwwwwwp.', '.swwwpp.', '.p..p.p.'],
    ['.www....', 'wwwwww..', 'wwwwwww.', '.swwwwpp', '.p..p.p.'],
    ['.www....', 'wwwwww..', 'wwwwwwp.', '.swwwpp.', '..p.p.p.'],
  ],
  stand: [[...LB_BODY, '.p..p.p.'], [...LB_LOOK, '.p..p.p.'], [...LB_BODY, '..pp.pp.', '']],
  chew: [[...LB_BODY, '.p..p.p.'], [...LB_CHEW, '.p..p.p.']],
  alert: [...LB_ALERT, '.p..p.p.'],
  startle: [...LB_ALERT, 'p.p...pp', ''],
  lie: ['..www.pp.', '.wwwwwppp', 'sswwwws..'],
  down: [
    ['.wwww.', 'wwwwww', 'pweewp', '.wppw.', '.spps.', '.p..p.'],
    ['.wwww.', 'wwwwww', 'pweewp', '.wppw.', '.spps.', '..pp..'],
  ],
  downAlert: ['.wwww.', 'pwwwwp', 'wweeww', '.wppw.', '.spps.', '.p..p.'],
  downStartle: ['.wwww.', 'pwwwwp', 'wweeww', '.wppw.', '.spps.', 'p....p', '......'],
  up: [
    ['..pp..', 'pwppwp', 'wwwwww', 'wwwwww', '.swws.', '.p..p.'],
    ['..pp..', 'pwppwp', 'wwwwww', 'wwwwww', '.swws.', '..pp..'],
  ],
};

const cache = new Map<string, AnimalSprites>();

// A lamb takes its mother's coat: coat 1 is a black lamb. `scared`: wide-eyed.
export function lambSprites(coat: number, scared = false): AnimalSprites {
  const key = `${coat}${scared ? 's' : ''}`;
  let s = cache.get(key);
  if (s) return s;
  const look = (rows: string[]) => {
    const r = resolveEyes(rows, 'p', scared);
    return coat === 1 ? r.map((x) => x.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w'))) : rimLight(r, 'w', 'y', true);
  };
  s = buildSprites(LAMB, look, 3, 2);
  cache.set(key, s);
  return s;
}
