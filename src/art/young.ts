import { spr } from '../gfx/sprite';
import type { SpeciesId } from '../world/map';
import { rimLight, type AnimalSprites } from './animals';

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
const LB_BODY = ['.www.pp.', 'wwwwwppp', 'wwwwww..', '.swwws..'];
const LB_LOOK = ['.www.p.p', 'wwwwwpp.', 'wwwwww..', '.swwws..'];
const LB_ALERT = ['.....pp.', '.www.pp.', 'wwwwwppp', 'wwwwww..', '.swwws..'];
const LAMB = {
  side: ['.p..p.p.', '..p..p..', '.p.p..p.'].map((l) => [...LB_BODY, l]),
  run: [[...LB_BODY, 'p.p...pp'], [...LB_BODY, '..pp.p..']],
  graze: [
    ['.www....', 'wwwwww..', 'wwwwwwp.', '.swwwpp.', '.p..p.p.'],
    ['.www....', 'wwwwww..', 'wwwwwww.', '.swwwwpp', '.p..p.p.'],
  ],
  stand: [[...LB_BODY, '.p..p.p.'], [...LB_LOOK, '.p..p.p.']],
  alert: [...LB_ALERT, '.p..p.p.'],
  lie: ['..www.pp.', '.wwwwwppp', 'sswwwws..'],
  down: [
    ['.wwww.', 'wwwwww', 'pwppwp', '.wppw.', '.spps.', '.p..p.'],
    ['.wwww.', 'wwwwww', 'pwppwp', '.wppw.', '.spps.', '..pp..'],
  ],
  downAlert: ['.wwww.', 'pwwwwp', 'wwppww', '.wppw.', '.spps.', '.p..p.'],
  up: [
    ['..pp..', 'pwppwp', 'wwwwww', 'wwwwww', '.swws.', '.p..p.'],
    ['..pp..', 'pwppwp', 'wwwwww', 'wwwwww', '.swws.', '..pp..'],
  ],
};

const cache = new Map<number, AnimalSprites>();

// A lamb takes its mother's coat: coat 1 is a black lamb.
export function lambSprites(coat: number): AnimalSprites {
  let s = cache.get(coat);
  if (s) return s;
  const look = (rows: string[]) =>
    coat === 1 ? rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w'))) : rimLight(rows, 'w', 'y', true);
  const side = (rows: string[]) => {
    const r = look(rows);
    return spr(r, 3, r.length - 1);
  };
  const vert = (rows: string[]) => {
    const r = look(rows);
    return spr(r, 2, r.length - 1);
  };
  s = {
    side: LAMB.side.map(side),
    run: LAMB.run.map(side),
    grazing: LAMB.graze.map(side),
    graze: side(LAMB.graze[0]),
    stand: LAMB.stand.map(side),
    alert: side(LAMB.alert),
    lie: side(LAMB.lie),
    down: LAMB.down.map(vert),
    downAlert: vert(LAMB.downAlert),
    up: LAMB.up.map(vert),
  };
  cache.set(coat, s);
  return s;
}
