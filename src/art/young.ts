import type { SpeciesId } from '../world/map';
import { buildSprites, resolveEyes, rimLight, type AnimalGrids, type AnimalSprites } from './animals';

// Lambs and the other young (ducklings, kids, calves, foals), and the
// fair's rare breeds. (Gameplay drew these; Graphics may polish them.)

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

// ---- Ducklings: a buttercup puff with a moss bill and feet ----
const DL = ['..yy.', '..yeo', 'yyyy.', '.ys..'];
const DL_SWAY = ['..yy.', '..yeo', '.yyy.', 'yys..'];
const DL_LOOK = ['.yy..', 'oey..', 'yyyy.', '.ys..'];
const DUCKLING: AnimalGrids = {
  side: [[...DL, '..o..'], [...DL_SWAY, '.o.o.'], [...DL, '...o.'], [...DL_SWAY, '.o.o.']],
  run: [[...DL, '.o..o'], [...DL_SWAY, '..oo.'], [...DL, 'o..o.'], [...DL_SWAY, '..oo.']],
  graze: [
    ['.....', 'y....', 'yyyy.', '.ysyo', '..o..'],
    ['.....', 'y....', 'yyyyo', '.ysy.', '..o..'],
    ['.....', 'yy...', 'yyyy.', '.ysyo', '..o..'],
  ],
  stand: [[...DL, '..o..'], [...DL_LOOK, '..o..'], [...DL, '.o.o.']],
  chew: [['.....', '..yy.', 'yyoy.', '.ys..', '..o..'], ['.....', '.yy..', 'yoyy.', '.ys..', '..o..']],
  alert: ['..yy.', '..yeo', '..y..', 'yyyy.', '.ys..', '..o..'],
  startle: ['y.yy.', '..yeo', '.yy..', 'yyyy.', '.ys..', '.o.o.', '.....'],
  lie: ['..yy.', '..yeo', 'yyyy.', 'ssss.'],
  down: [
    ['.yy.', 'eyye', '.oo.', 'yyyy', '.oo.'],
    ['.yy.', 'eyye', '.oo.', 'yyyy', 'o..o'],
  ],
  downAlert: ['.yy.', 'eyye', '.oo.', '.yy.', 'yyyy', '.oo.'],
  downStartle: ['.yy.', 'eyye', '.oo.', 'yyyy', 'yyyy', 'o..o', '....'],
  up: [
    ['.yy.', '.yy.', 'yyyy', '.ys.', '.oo.'],
    ['.yy.', '.yy.', 'yyyy', '.ys.', 'o..o'],
  ],
  swim: {
    side: [['..yy.', '..yeo', 'yyyy.', '.ss..'], ['..yy.', '..yeo', '.yyy.', 'yss..']],
    down: ['.yy.', 'eyye', '.oo.', 'yyyy', '.ss.'],
    up: ['.yy.', '.yy.', 'yyyy', '.ss.'],
  },
};

// ---- Kids: white, pointed plum ears, a tail held up; a bounce in them ----
const KD = ['w....p.p', 'w...wwew', 'wwwwwwp.', '.swwws..'];
const KD_LOOK = ['w...p.p.', 'w...wew.', 'wwwwwp..', '.swwws..'];
const KD_CHEW = ['w....p.p', 'w...wwew', 'wwwwwwpp', '.swwws..'];
const KD_ALERT = ['.....p.p', 'w...wwew', 'w...www.', 'wwwwww..', '.swwws..'];
const KID: AnimalGrids = {
  side: ['.p..p.p.', '..p..p..', '.p.p..p.', '..pp.pp.'].map((l) => [...KD, l]),
  run: [[...KD, 'p.p...pp'], [...KD, '..pp.p..', ''], [...KD, '.p.p..p.'], [...KD, '..pp.pp.', '']],
  graze: [
    ['w.......', 'wwwwww..', 'wwwwwww.', '.swwwwep', '.p..p.p.'],
    ['w.......', 'wwwwww..', 'wwwwwwwe', '.swwwwwp', '.p..p.p.'],
    ['w.......', 'wwwwww..', 'wwwwwww.', '.swwwwep', '..p.p.p.'],
  ],
  stand: [[...KD, '.p..p.p.'], [...KD_LOOK, '.p..p.p.'], [...KD, '..pp.pp.', '']],
  chew: [[...KD, '.p..p.p.'], [...KD_CHEW, '.p..p.p.']],
  alert: [...KD_ALERT, '.p..p.p.'],
  startle: [...KD_ALERT, 'p.p...pp', ''],
  lie: ['w....p.p', 'w...wwew', 'sswwwww.'],
  down: [
    ['p....p', 'pwwwwp', '.weew.', '.wppw.', '.swws.', '.p..p.'],
    ['p....p', 'pwwwwp', '.weew.', '.wppw.', '.swws.', '..pp..'],
  ],
  downAlert: ['p....p', 'pwwwwp', '.weew.', '.wppw.', '.wwww.', '.swws.', '.p..p.'],
  downStartle: ['p....p', 'pwwwwp', '.weew.', '.wppw.', '.swws.', 'p....p', '......'],
  up: [
    ['..w...', 'pwwwwp', 'wwwwww', 'wwwwww', '.swws.', '.p..p.'],
    ['..w...', 'pwwwwp', 'wwwwww', 'wwwwww', '.swws.', '..pp..'],
  ],
};

// ---- Calves: small, dark and deep-bodied, a teal back and a wool muzzle ----
const CF = ['.......p.p', '.......pep', '.ttttttpww', 'pppppppp..', 'p.psppps..', '..pppppp..'];
const CF_LOOK = ['......p.p.', '......pep.', '.tttttpwp.', 'pppppppp..', 'p.psppps..', '..pppppp..'];
const CF_CHEW = ['.......p.p', '.......pep', '.ttttttpww', 'ppppppppw.', 'p.psppps..', '..pppppp..'];
const CF_ALERT = ['.......p.p', '.......pep', '.......pww', '.tttttttp.', 'pppppppp..', 'p.psppps..', '..pppppp..'];
const CF_LEGS = [['..p.p..p.p', '..s.s..s.s'], ['...pp..pp.', '...ss..ss.'], ['..p.p..p.p', '...s.s.s.s'], ['...pp..pp.', '...ss..ss.']];
const CALF: AnimalGrids = {
  side: CF_LEGS.map((l) => [...CF, ...l]),
  run: [[...CF, '.p......pp', 's.......s.'], [...CF, '...pp.pp..', '...ss.ss..', ''], [...CF, '..p.p..p.p', '..s.s..s.s'], [...CF, '...pp.pp..', '...ss.ss..', '']],
  graze: [
    ['..........', '..........', '.ttttttt..', 'ppppppppp.', 'p.psppppep', '..pppppppw', ...CF_LEGS[0]],
    ['..........', '..........', '.ttttttt..', 'ppppppppp.', 'p.pspppppe', '..ppppppww', ...CF_LEGS[0]],
    ['..........', '..........', '.ttttttt..', 'ppppppppp.', 'p.psppppep', '..pppppppw', ...CF_LEGS[2]],
  ],
  stand: [[...CF, ...CF_LEGS[0]], [...CF_LOOK, ...CF_LEGS[0]], [...CF, '..p.p..pp.', '..s.s..ss.']],
  chew: [[...CF, ...CF_LEGS[0]], [...CF_CHEW, ...CF_LEGS[0]]],
  alert: [...CF_ALERT, ...CF_LEGS[0]],
  startle: [...CF_ALERT, '.p......pp', 's.......s.', ''],
  lie: ['.......p.p', '.......pep', '.ttttttpww', 'pppppppps.', '.spppppps.'],
  down: [
    ['p....p', '.pwwp.', '.ewwe.', '.pppp.', 'pttttp', 'pspppp', '.p..p.', '.s..s.'],
    ['p....p', '.pwwp.', '.ewwe.', '.pppp.', 'pttttp', 'pspppp', '..pp..', '..ss..'],
  ],
  downAlert: ['p....p', 'ppwwpp', '.ewwe.', '.pppp.', '.pppp.', 'pttttp', 'pspppp', '.p..p.', '.s..s.'],
  downStartle: ['p....p', '.pwwp.', '.ewwe.', '.pppp.', 'pttttp', 'pspppp', 'p....p', 's....s', '......'],
  up: [
    ['p....p', '.pppp.', '.pppp.', 'pttttp', 'pspppp', '.pppp.', '..p...', '.p..p.', '.s..s.'],
    ['p....p', '.pppp.', '.pppp.', 'pttttp', 'pspppp', '.pppp.', '..p...', '..pp..', '..ss..'],
  ],
};

// ---- Foals: all legs, a short plum mane and a brush of a tail ----
const FL = ['......pp', '.....pwe', 'p....pww', 'pwwwwpw.', '.wwwwww.', '..swws..'];
const FL_RUN = ['......p.', '.....pwe', 'pp...pww', '.wwwwpw.', '.wwwwww.', '..swws..'];
const FL_LOOK = ['.....pp.', '.....ew.', 'p....pw.', 'pwwwwpw.', '.wwwwww.', '..swws..'];
const FL_CHEW = ['......pp', '.....pwe', 'p....pwp', 'pwwwwpw.', '.wwwwww.', '..swws..'];
const FL_LEGS = [
  ['.w..w.w.', '.w..w.w.', '.p..p.p.'],
  ['..w..w..', '..w..w..', '..p..p..'],
  ['.w.w..w.', '.w.w..w.', '.p.p..p.'],
  ['..ww.ww.', '..ww.ww.', '..pp.pp.'],
];
const FOAL: AnimalGrids = {
  side: FL_LEGS.map((l) => [...FL, ...l]),
  run: [
    [...FL_RUN, 'w.w...ww', 'w.....w.', 'p.....p.'],
    [...FL_RUN, '..ww.w..', '..p..p..', ''],
    [...FL_RUN, '.w.w..w.', '.w...w..', '.p...p..'],
    [...FL_RUN, '..ww.w..', '..p..p..', ''],
  ],
  graze: [
    ['........', '........', 'p.......', 'pwwwwp..', '.wwwwwp.', '..swwwwe', ...FL_LEGS[0]],
    ['........', '........', '.p......', 'pwwwwp..', '.wwwwwp.', '..swwwwe', ...FL_LEGS[0]],
    ['........', '........', 'p.......', 'pwwwwp..', '.wwwwwp.', '..swwwwe', ...FL_LEGS[2]],
  ],
  stand: [[...FL, ...FL_LEGS[0]], [...FL_LOOK, ...FL_LEGS[0]], [...FL, '.w..w.w.', '.w..w.ww', '.p..p...']],
  chew: [[...FL, ...FL_LEGS[0]], [...FL_CHEW, ...FL_LEGS[0]]],
  alert: ['.......p', '......pe', '.....pww', 'p....pw.', 'pwwwwpw.', '.wwwwww.', '..swws..', ...FL_LEGS[0]],
  startle: ['.......p', '......pe', '.....pww', 'p...pww.', 'pwwwwww.', '.wwwww..', '..sws...', '.w..w...', '.w...w..', '.p...p..'],
  lie: ['......pp', '.....pwe', 'pp.wwpww', 'pwwwwww.', '.pswwws.'],
  down: [
    ['.pp.', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', '.ss.', 'w..w', '.w.w', '.p.p'],
  ],
  downAlert: ['p..p', '.pp.', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
  downStartle: ['p..p', 'pppp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', '.ss.', 'w..w', 'p..p', '....'],
  up: [
    ['.pp.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', '.w.w', '.p.p'],
  ],
};

// Each kind's young: its grids, anchors, and per coat (the mother's) how
// the rows are recoloured, the face the eyes sit on and the rim of light.
interface YoungLook { recolour: (rows: string[]) => string[]; face: string; rim: [string, string, boolean] | null }
const swap = (map: Record<string, string>) => (rows: string[]) => rows.map((r) => r.replace(/[wpsyot]/g, (m) => map[m] ?? m));
const same = (rows: string[]) => rows;
const YOUNG: Partial<Record<SpeciesId, { G: AnimalGrids; ax: number; axv: number; look: (coat: number) => YoungLook }>> = {
  goat: {
    G: KID, ax: 3, axv: 2,
    look: (c) => c === 2 ? { recolour: (r) => rareCoat('goat', 2, r)!, face: 'p', rim: ['p', 't', true] }
      : c === 1 ? { recolour: swap({ w: 's' }), face: 's', rim: ['s', 'o', false] } : { recolour: same, face: 'w', rim: ['w', 'y', true] },
  },
  cow: {
    G: CALF, ax: 4, axv: 2,
    look: (c) => c === 2 ? { recolour: (r) => rareCoat('cow', 2, r)!, face: 'y', rim: null }
      : c === 1 ? { recolour: swap({ s: 'w' }), face: 'p', rim: ['p', 't', true] } : { recolour: same, face: 'p', rim: ['p', 't', true] },
  },
  pony: {
    G: FOAL, ax: 3, axv: 1,
    look: (c) => c === 2 ? { recolour: swap({ w: 'p', p: 'w' }), face: 'p', rim: ['p', 't', true] }
      : c === 1 ? { recolour: swap({ w: 's' }), face: 's', rim: ['s', 'o', false] } : { recolour: same, face: 'w', rim: ['w', 'y', true] },
  },
};

const youngCache = new Map<string, AnimalSprites>();

// Any young one's sprites: a lamb's, duckling's, kid's, calf's or foal's,
// in its mother's coat.
export function youngSprites(id: SpeciesId, coat: number, scared = false): AnimalSprites {
  if (id === 'sheep') return lambSprites(coat, scared);
  const key = `${id}${coat}${scared ? 's' : ''}`;
  let s = youngCache.get(key);
  if (s) return s;
  if (id === 'duck') s = buildSprites(DUCKLING, (rows) => resolveEyes(rows, 'y', scared), 2, 2);
  else {
    const Y = YOUNG[id]!, L = Y.look(coat);
    s = buildSprites(Y.G, (rows) => {
      const r = resolveEyes(L.recolour(rows), L.face, scared);
      return L.rim ? rimLight(r, ...L.rim) : r;
    }, Y.ax, Y.axv);
  }
  youngCache.set(key, s);
  return s;
}
