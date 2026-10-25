import { spr, type Sprite } from '../gfx/sprite';
import type { SpeciesId } from '../world/map';

// Every species has whole-frame poses (like the dog), facing right and
// flipped for left, plus walk frames towards and away from the viewer.
// Anchors sit at the feet. White coats carry a sage underside so the body
// has some roundness; stress shows on the sprite itself: heads come up,
// ears prick, tails lift, and a frightened animal runs instead of walking.
export interface AnimalSprites {
  side: Sprite[]; // walk cycle
  run: Sprite[]; // flat-out cycle
  grazing: Sprite[]; // head down, a nibble and a chew
  graze: Sprite; // the first of them (older callers)
  stand: Sprite[]; // idle: standing, and a look round / tail swish
  alert: Sprite; // head up, ears pricked: wary
  lie: Sprite; // lying down, at rest
  down: Sprite[];
  downAlert: Sprite;
  up: Sprite[];
}

interface Grids {
  side: string[][];
  run: string[][];
  graze: string[][];
  stand: string[][];
  alert: string[];
  lie: string[];
  down: string[][];
  downAlert: string[];
  up: string[][];
}

// ---- Sheep: a soft, lumpy fleece; plum face, ears and legs. ----
const SH_BODY = ['..w.ww....', '.wwwwwwp..', 'wwwwwwwppp', 'wwwwwwwpp.', '.swwwwws..'];
const SH_LOOK = ['..w.ww....', '.wwwwwp.p.', 'wwwwwwppp.', 'wwwwwwwp..', '.swwwwws..'];
const SH_ALERT = ['.......p..', '..w.ww.pp.', '.wwwwwwppp', 'wwwwwwwp..', 'wwwwwwww..', '.swwwwws..'];
const SH_RUN = ['..w.ww..p.', '.wwwwwwpp.', 'wwwwwwwppp', 'wwwwwwww..', '.swwwwws..'];
const SHEEP: Grids = {
  side: ['.p.p..p.p.', '..p.p..p..', '.p..p.p...'].map((l) => [...SH_BODY, l]),
  run: [
    [...SH_RUN, 'p.p....p.p'],
    [...SH_RUN, '...pp.pp..', ''],
  ],
  graze: [
    ['..w.ww....', '.wwwwww...', 'wwwwwwww..', 'wwwwwwwwp.', '.swwwwwpp.', '.p.p..p.p.'],
    ['..w.ww....', '.wwwwww...', 'wwwwwwww..', 'wwwwwwww..', '.swwwwwwp.', '.p.p..ppp.'],
  ],
  stand: [[...SH_BODY, '.p.p..p.p.'], [...SH_LOOK, '.p.p..p.p.'], [...SH_ALERT.slice(1), '.p.p..pp..']],
  alert: [...SH_ALERT, '.p.p..p.p.'],
  lie: ['...w.ww....', '..wwwwwwp..', '.wwwwwwwppp', '.wwwwwwwpp.', 'sswwwwwss..'],
  down: [
    ['.wwwww.', 'wwwwwww', 'wwwwwww', 'pwpppwp', '.wpppw.', '.sppps.', '.p...p.'],
    ['.wwwww.', 'wwwwwww', 'wwwwwww', 'pwpppwp', '.wpppw.', '.sppps.', '..p.p..'],
  ],
  downAlert: ['.wwwww.', 'wwwwwww', 'pwwwwwp', 'wwpppww', '.wpppw.', '.sppps.', '.p...p.'],
  up: [
    ['..ppp..', 'pwwpwwp', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.swwws.', '.p...p.'],
    ['..ppp..', 'pwwpwwp', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.swwws.', '..p.p..'],
  ],
};

// ---- Ducks: tiny and white, buttercup bill and feet. ----
const DUCK: Grids = {
  side: [
    ['...ww.', '...wpy', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
    ['...ww.', '...wpy', 'w..ww.', 'wwwww.', '.sww..', '.y.y..'],
  ],
  run: [
    ['...ww.', '...wpy', 'ww.ww.', '.wwww.', '.sww..', '.y..y.'],
    ['.w.ww.', '.w.wpy', '.wwww.', 'wwwww.', '.sww..', '..yy..'],
  ],
  graze: [
    ['......', '......', 'w.....', 'wwwww.', '.swwwy', '..y...'],
    ['......', '......', 'w.....', 'wwwww.', '.swwww', '..y..y'],
  ],
  stand: [
    ['...ww.', '...wpy', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
    ['..ww..', '.ypw..', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
    // A wing stretch.
    ['.w.ww.', 'ww.wpy', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
  ],
  alert: ['...ww.', '...wpy', '...ww.', 'w..w..', 'wwwww.', '.sww..', '..y...'],
  lie: ['...ww.', '...wpy', 'w..ww.', 'wwwww.', 'ssss..'],
  down: [
    ['.ww.', 'pwwp', '.yy.', 'wwww', '.ss.', '.yy.'],
    ['.ww.', 'pwwp', '.yy.', 'wwww', '.ss.', 'y..y'],
  ],
  downAlert: ['.ww.', 'pwwp', '.yy.', '.ww.', 'wwww', '.ss.', '.yy.'],
  up: [
    ['.ww.', '.ww.', 'wwww', 'wwww', '.sw.', '.yy.'],
    ['.ww.', '.ww.', 'wwww', 'wwww', '.sw.', 'y..y'],
  ],
};

// ---- Goats: lean, horns swept back, a beard, the tail carried high,
// longer legs. ----
const GT_TOP = ['....pp....', '.....p....', 'w....wwww.', 'w....wwpww', 'wwwwwwww.p', 'wwwwwwww..', '.swwwwws..'];
const GT_LOOK = ['....p.p...', '.....p....', 'w....www..', 'w....pwp..', 'wwwwwwwp..', 'wwwwwwww..', '.swwwwws..'];
const GT_RUN = ['....pp....', 'w....p....', 'w....wwww.', 'wwwwwwwpww', 'wwwwwwww.p', '.swwwwws..'];
const GOAT: Grids = {
  side: [
    [...GT_TOP, '.p.p..p.p.', '.p.p..p.p.'],
    [...GT_TOP, '.p.p..p.p.', 'p...p.p..p'],
    [...GT_TOP, '..pp...pp.', '..pp...pp.'],
  ],
  run: [
    [...GT_RUN, '.pp....pp.', 'p.......p.', 'p........p'],
    [...GT_RUN, '..pp.pp...', '...p..p...', ''],
  ],
  graze: [
    ['..........', '..........', 'w.........', 'w.........', 'wwwwwww...', 'wwwwwwwwpp', '.swwwwwwpw', '.p.p..p.pw', '.p.p..p.p.'],
    ['..........', '..........', '.w........', 'w.........', 'wwwwwww...', 'wwwwwwww..', '.swwwwwwpp', '.p.p..p.pw', '.p.p..p.pp'],
  ],
  stand: [
    [...GT_TOP, '.p.p..p.p.', '.p.p..p.p.'],
    [...GT_LOOK, '.p.p..p.p.', '.p.p..p.p.'],
    // Head down, horns forward: spoiling for a butt.
    ['..........', '..........', 'w.........', 'w.....ppp.', 'wwwwwwwwpp', 'wwwwwwwwwp', '.swwwwwwp.', '.p.p..p.p.', 'p..p...p.p'],
  ],
  alert: ['....pp....', '.....p....', '.....wwww.', 'w....wwpww', 'w....ww..p', 'wwwwwwww..', 'wwwwwwww..', '.swwwwws..', '.p.p..p.p.', '.p.p..p.p.'],
  lie: ['....pp....', '.....p....', 'w....wwww.', 'w....wwpww', 'wwwwwwww.p', 'swwwwwwws.'],
  down: [
    ['p...p', '.www.', 'wpwpw', '.www.', '.pwp.', 'wwwww', 'wwwww', '.sws.', 'p...p', '.p.p.'],
    ['p...p', '.www.', 'wpwpw', '.www.', '.pwp.', 'wwwww', 'wwwww', '.sws.', '.p.p.', 'p...p'],
  ],
  downAlert: ['p...p', 'pwwwp', 'wpwpw', '.www.', '.pwp.', '.www.', 'wwwww', 'wwwww', '.sws.', 'p...p', '.p.p.'],
  up: [
    ['p...p', '.pwp.', '.www.', 'wwwww', 'wwwww', 'wwwww', '.www.', '..w..', 'p...p', '.p.p.'],
    ['p...p', '.pwp.', '.www.', 'wwwww', 'wwwww', 'wwwww', '.www.', '..w..', '.p.p.', 'p...p'],
  ],
};

// ---- Cattle: big, boxy and dark, a teal sheen along the back, wool horns
// and blaze, a tufted tail. ----
const CW_TOP = ['...........w.w.', '...........ppp.', '..tttttttttpwpp', '.ppppppppppppwp', 'p.ppspppppppps.', 'p.pppppppspp...', 'p.pspppppppp...', '..ppppppppppp..'];
const CW_LOOK = ['..........w...w', '...........ppp.', '..ttttttttpwpwp', '.ppppppppppwpp.', 'p.ppsppppppps..', 'p.pppppppspp...', '..pspppppppp...', '..ppppppppppp..'];
const CW_ALERT = ['...........w.w.', '...........ppp.', '...........pwpp', '..tttttttttpwp.', '.ppppppppppps..', 'p.ppspppppppp..', 'p.pppppppsp....', 'p.pspppppppp...', '..ppppppppppp..'];
const CW_RUN = ['...........w.w.', 'pp.........ppp.', '..tttttttttpwpp', '.ppppppppppppwp', '..ppspppppppps.', '..pppppppspp...', '..pspppppppp...', '..ppppppppppp..'];
const COW: Grids = {
  side: [
    [...CW_TOP, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    [...CW_TOP, '...pp.....pp...', '...ss.....ss...'],
    [...CW_TOP, '..pp.pp..pp.pp.', '...s..s..s..s..'],
  ],
  run: [
    [...CW_RUN, '.pp.......pp.p.', 's..........s..s'],
    [...CW_RUN, '...pp.pppp.....', '....ss..ss.....', ''],
  ],
  graze: [
    ['...............', '...............', 'p..............', '.pppppppppppp..', 'p.ttttttttttpw.', 'p.pppppppspppww', 'p.pspppppppppwp', '..pppppppppppps', '..pp.pp..pp.pp.', '..s..s...s..s..'],
    ['...............', '...............', '.p.............', '.pppppppppppp..', 'p.ttttttttttp..', '..pppppppsppppw', '..pspppppppppww', '..ppppppppppppp', '..pp.pp..pp.pps', '..s..s...s..s..'],
  ],
  stand: [
    [...CW_TOP, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    [...CW_LOOK, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    // The tail flicked up at a fly.
    ['...........w.w.', 'p..........ppp.', '.ptttttttttpwpp', '.ppppppppppppwp', '..ppspppppppps.', '..pppppppspp...', '..pspppppppp...', '..ppppppppppp..', '..pp.pp..pp.pp.', '..s..s....s.s..'],
  ],
  alert: [...CW_ALERT, '..pp.pp..pp.pp.', '..s..s....s.s..'],
  lie: ['...........w.w.', '...........ppp.', '..tttttttttpwpp', '.ppppppppppppwp', 'pppppspppppppps', 'p.ppppppppsppp.', '.sppppppppppps.'],
  down: [
    ['w.....w', '.ppppp.', 'ppwppp.', '.pwpwp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '.s...s.'],
    ['w.....w', '.ppppp.', 'ppwppp.', '.pwpwp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '..s.s..'],
  ],
  downAlert: ['w.....w', 'wppppw.', '.pwppp.', '.pwpwp.', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '.s...s.'],
  up: [
    ['w.....w', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', 'ppppppp', '.ppppp.', '...p...', '.pp.pp.', '.s...s.'],
    ['w.....w', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', 'ppppppp', '.ppppp.', '...p...', '.pp.pp.', '..s.s..'],
  ],
};

// ---- Wild ponies: long legs, an arched neck, a flowing plum mane and tail.
const PN_TOP = ['..........pp..', '.........pwwp.', '........ppwwwp', 'pp......pww..w', 'pwwwwwwwpw....', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_SWISH = ['..........pp..', '.........pwwp.', '........ppwwwp', '........pww..w', 'pwwwwwwwpw....', 'pwwwwwwwww....', 'pwwwwwwwwww...', '.psswwwwss....'];
const PN_ALERT = ['...........p..', '..........pwp.', '.........pwwwp', '.........pww.w', 'pp......pw....', 'pwwwwwwwpw....', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_RUN = ['..........p...', '.........pwwp.', '........ppwwwp', 'ppp.....pww..w', '..wwwwwwpw....', '.wwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_LEGS = ['..w.w...w.w...', '.w...w.w...w..', '.p...p.p...p..'];
const PONY: Grids = {
  side: [
    [...PN_TOP, ...PN_LEGS],
    [...PN_TOP, '...ww....ww...', '...ww....ww...', '...pp....pp...'],
    [...PN_TOP, '..w..w..w..w..', '..w..w...ww...', '..p..p...pp...'],
  ],
  run: [
    [...PN_RUN, '..w......w....', '.w........w...', 'p..........p..'],
    [...PN_RUN, '...w....w.w...', '...w...w...w..', '...p...p...p..'],
    [...PN_RUN, '....w..ww.....', '....p.w..p....', ''],
  ],
  graze: [
    ['..............', '..............', '..............', 'pp............', 'pwwwwwwwpp....', 'pwwwwwwwwwp...', '.wwwwwwwwwwpw.', '..sswwwwss.www', ...PN_LEGS],
    ['..............', '..............', '..............', '.p............', 'pwwwwwwwpp....', 'pwwwwwwwwwp...', 'pwwwwwwwwwwp..', '..sswwwwss.pww', ...PN_LEGS],
  ],
  stand: [
    [...PN_TOP, ...PN_LEGS],
    [...PN_SWISH, ...PN_LEGS],
    // A forefoot lifted to stamp.
    [...PN_TOP, '..w.w...w.w...', '.w...w.w..ww..', '.p...p.p......'],
  ],
  alert: [...PN_ALERT, ...PN_LEGS],
  lie: ['..........pp..', '.........pwwp.', '........ppwwwp', '........pww..w', 'pp.wwwwwpw....', 'pwwwwwwwwww...', '.psswwwwwws...'],
  down: [
    ['.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', '.w.w', '.p.p'],
  ],
  downAlert: ['p..p', '.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
  up: [
    ['.pp.', '.pw.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', '.pw.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', '.w.w', '.p.p'],
  ],
};

const GRIDS: Record<SpeciesId, Grids> = { sheep: SHEEP, duck: DUCK, goat: GOAT, cow: COW, pony: PONY };
// Anchor columns: side poses, then the views towards / away from the viewer.
const AX: Record<SpeciesId, [number, number]> = { duck: [3, 2], sheep: [4, 3], goat: [5, 2], cow: [7, 3], pony: [6, 1] };

export type Coat = 0 | 1 | 2;

// `coat` gives herds some variety: ponies come in wool, dun (sage) and bay
// (plum with a wool mane); goats in wool or sage; cattle in solid plum or
// plum and wool (piebald).
function recoat(id: SpeciesId, coat: Coat, rows: string[]): string[] {
  if (coat === 0) return rows;
  switch (id) {
    case 'sheep': // the black sheep (found, never spawned): dark fleece, pale face and socks
      return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
    case 'goat':
      return rows.map((r) => r.replace(/w/g, 's'));
    case 'cow':
      return rows.map((r) => r.replace(/s/g, 'w'));
    case 'pony':
      if (coat === 1) return rows.map((r) => r.replace(/w/g, 's'));
      return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
  }
  return rows;
}

// Sunlight from the upper right: the coat's top edge catches a rim of light
// on the sunny side. On white coats the rim is a sparse buttercup glint, on
// plum a teal sheen, on sage moss. (The undersides are already in shade.)
export function rimLight(rows: string[], body: string, rim: string, sparse: boolean): string[] {
  const W = Math.max(...rows.map((r) => r.length));
  return rows.map((row, y) =>
    [...row.padEnd(W, '.')]
      .map((ch, x) => {
        if (ch !== body || x < W * 0.35 || y > rows.length * 0.62) return ch;
        const up = y > 0 ? rows[y - 1][x] ?? '.' : '.';
        if (up !== '.') return ch;
        if (sparse && (x + y) % 2) return ch;
        return rim;
      })
      .join(''),
  );
}

const RIM: Partial<Record<SpeciesId, Record<number, [string, string, boolean]>>> = {
  sheep: { 0: ['w', 'y', true] },
  goat: { 0: ['w', 'y', true], 1: ['s', 'o', false] },
  cow: { 0: ['p', 't', true], 1: ['p', 't', true] },
  pony: { 0: ['w', 'y', true], 1: ['s', 'o', false], 2: ['p', 't', true] },
};

function build(id: SpeciesId, coat: Coat): AnimalSprites {
  const G = GRIDS[id];
  const [ax, axv] = AX[id];
  const rim = RIM[id]?.[coat];
  const look = (rows: string[]) => {
    const r = recoat(id, coat, rows);
    return rim ? rimLight(r, ...rim) : r;
  };
  const side = (rows: string[]) => {
    const r = look(rows);
    return spr(r, ax, r.length - 1);
  };
  const vert = (rows: string[]) => {
    const r = look(rows);
    return spr(r, axv, r.length - 1);
  };
  return {
    side: G.side.map(side),
    run: G.run.map(side),
    grazing: G.graze.map(side),
    graze: side(G.graze[0]),
    stand: G.stand.map(side),
    alert: side(G.alert),
    lie: side(G.lie),
    down: G.down.map(vert),
    downAlert: vert(G.downAlert),
    up: G.up.map(vert),
  };
}

const cache = new Map<string, AnimalSprites>();

export function animalSprites(id: SpeciesId, coat: Coat = 0): AnimalSprites {
  const key = `${id}${coat}`;
  let s = cache.get(key);
  if (!s) cache.set(key, (s = build(id, coat)));
  return s;
}
