import { spr, type Sprite } from '../gfx/sprite';
import type { SpeciesId } from '../world/map';
import { rareCoat } from './young';

// Every species has whole-frame poses (like the dog), facing right and
// flipped for left, plus walk frames towards and away from the viewer.
// Anchors sit at the feet. White coats carry a sage underside so the body
// has some roundness; stress shows on the sprite itself: heads come up,
// ears prick, tails lift, a fright makes it jump, and a frightened animal
// runs instead of walking, eyes wide (its `scared` twin).
//
// Each kind moves its own way (render/animals.ts adds the bounce): a
// sheep's bouncy trot, a goat's stiff-legged pronk, a duck's waddle and
// flapping run (and swimming), cattle nodding along and landing heavy,
// ponies' manes and tails streaming at a gallop and lifting in a gust.
//
// Template letters: e the eye, E beside it on a pale face (the white of a
// wide eye shows as a dark ring there); resolved per coat and mood.
export interface AnimalSprites {
  side: Sprite[]; // walk cycle
  run: Sprite[]; // flat-out cycle
  grazing: Sprite[]; // head down, a nibble, a chew, a step on
  graze: Sprite; // the first of them (older callers)
  stand: Sprite[]; // idle: standing, a look round, the kind's habit
  chew: Sprite[]; // head up, chewing (or a duck preening)
  alert: Sprite; // head up, ears pricked: wary
  startle: Sprite; // the jump at a fright
  lie: Sprite; // lying down, at rest
  down: Sprite[];
  downAlert: Sprite;
  downStartle: Sprite;
  up: Sprite[];
  swim?: { side: Sprite[]; down: Sprite; up: Sprite }; // ducks afloat
  flow?: Sprite[]; // ponies standing in a gust: mane and tail lifted
}

interface Grids {
  side: string[][];
  run: string[][];
  graze: string[][];
  stand: string[][];
  chew: string[][];
  alert: string[];
  startle: string[];
  lie: string[];
  down: string[][];
  downAlert: string[];
  downStartle: string[];
  up: string[][];
  swim?: { side: string[][]; down: string[]; up: string[] };
  flow?: string[][];
}

// ---- Sheep: a soft, lumpy fleece; plum face, ears and legs. ----
const SH_BODY = ['..w.ww....', '.wwwwwwp..', 'wwwwwwwpep', 'wwwwwwwpp.', '.swwwwws..'];
const SH_NOD = ['..w.ww....', '.wwwwww...', 'wwwwwwwp..', 'wwwwwwwpep', '.swwwwwpp.']; // head low as it walks on
const SH_CHEW = ['..w.ww....', '.wwwwwwp..', 'wwwwwwwpep', 'wwwwwwwp.p', '.swwwwws..'];
const SH_LOOK = ['..w.ww....', '.wwwwwp.p.', 'wwwwwwppp.', 'wwwwwwwp..', '.swwwwws..'];
const SH_ALERT = ['.......p..', '..w.ww.pp.', '.wwwwwwpep', 'wwwwwwwp..', 'wwwwwwww..', '.swwwwws..'];
const SH_RUN = ['..w.ww..p.', '.wwwwwwpe.', 'wwwwwwwppp', 'wwwwwwww..', '.swwwwws..'];
const SH_RUN_UP = ['...ww.w.p.', '.wwwwwwpe.', 'wwwwwwwppp', 'wwwwwwww..', '.swwwwws..']; // fleece bouncing
const SHEEP: Grids = {
  side: [
    [...SH_BODY, '.p.p..p.p.'],
    [...SH_NOD, '..p.p..p..'],
    [...SH_BODY, '.p..p.p...'],
    [...SH_NOD, '...pp..pp.'],
  ],
  // A bouncy trot: stretched, then all four tucked under in the air.
  run: [
    [...SH_RUN, 'p.p....p.p'],
    [...SH_RUN_UP, '...pp.pp..', ''],
    [...SH_RUN, '.p.p...p.p'],
    [...SH_RUN_UP, '..pp..pp..', ''],
  ],
  graze: [
    ['..w.ww....', '.wwwwww...', 'wwwwwwww..', 'wwwwwwwwp.', '.swwwwwpp.', '.p.p..p.p.'],
    ['..w.ww....', '.wwwwww...', 'wwwwwwww..', 'wwwwwwww..', '.swwwwwwp.', '.p.p..ppp.'],
    ['..w.ww....', '.wwwwww...', 'wwwwwwww..', 'wwwwwwwwp.', '.swwwwwpp.', '..p.p..pp.'],
  ],
  stand: [[...SH_BODY, '.p.p..p.p.'], [...SH_LOOK, '.p.p..p.p.'], [...SH_ALERT.slice(1), '.p.p..pp..']],
  chew: [[...SH_BODY, '.p.p..p.p.'], [...SH_CHEW, '.p.p..p.p.']],
  alert: [...SH_ALERT, '.p.p..p.p.'],
  startle: [...SH_ALERT, 'p.p....p.p', ''],
  lie: ['...w.ww....', '..wwwwwwp..', '.wwwwwwwppp', '.wwwwwwwpp.', 'sswwwwwss..'],
  down: [
    ['.wwwww.', 'wwwwwww', 'wwwwwww', 'pwpppwp', '.wepew.', '.sppps.', '.p...p.'],
    ['.wwwww.', 'wwwwwww', 'wwwwwww', 'pwpppwp', '.wepew.', '.sppps.', '..p.p..'],
  ],
  downAlert: ['.wwwww.', 'wwwwwww', 'pwwwwwp', 'wwpppww', '.wepew.', '.sppps.', '.p...p.'],
  downStartle: ['.wwwww.', 'pwwwwwp', 'pwwwwwp', 'wwpppww', '.wepew.', '.sppps.', 'p.....p', '.......'],
  up: [
    ['..ppp..', 'pwwpwwp', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.swwws.', '.p...p.'],
    ['..ppp..', 'pwwpwwp', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.swwws.', '..p.p..'],
  ],
};

// ---- Ducks: tiny and white, buttercup bill and feet. ----
const DK = ['...ww.', '...Eey', 'w..ww.', 'wwwww.', '.sww..'];
const DK_SWAY = ['...ww.', '...Eey', '...ww.', 'wwwww.', 'wsww..']; // the waddle: tail swung down
const DUCK: Grids = {
  side: [
    [...DK, '..y...'],
    [...DK_SWAY, '.y.y..'],
    [...DK, '...y..'],
    [...DK_SWAY, '.y.y..'],
  ],
  // Running flat out, wings beating.
  run: [
    ['.w.ww.', '.w.Eey', '.wwww.', 'wwwww.', '.sww..', '..yy..'],
    ['...ww.', '...Eey', 'ww.ww.', '.wwww.', '.sww..', '.y..y.'],
    ['...ww.', '...Eey', '..www.', 'wwwww.', 'wswww.', '..yy..'],
    ['...ww.', '...Eey', 'ww.ww.', '.wwww.', '.sww..', '.y..y.'],
  ],
  graze: [
    ['......', '......', 'w.....', 'wwwww.', '.swwwy', '..y...'],
    ['......', '......', 'w.....', 'wwwww.', '.swwww', '..y..y'],
    ['......', 'w.....', 'w.....', 'wwwww.', '.swwwy', '..y...'],
  ],
  stand: [
    [...DK, '..y...'],
    ['..ww..', '.yeE..', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
    // A wing stretch.
    ['.w.ww.', 'ww.Eey', 'w..ww.', 'wwwww.', '.sww..', '..y...'],
  ],
  // Preening: bill tucked to the back.
  chew: [
    ['......', '..ww..', 'w.wyw.', 'wwwww.', '.sww..', '..y...'],
    ['......', '.ww...', 'wwyww.', 'wwwww.', '.sww..', '..y...'],
  ],
  alert: ['...ww.', '...Eey', '...ww.', 'w..w..', 'wwwww.', '.sww..', '..y...'],
  startle: ['w..ww.', 'w..Eey', '.w.ww.', 'w..w..', 'wwwww.', '.sww..', '.y..y.', '......'],
  lie: ['...ww.', '...wpy', 'w..ww.', 'wwwww.', 'ssss..'],
  down: [
    ['.ww.', 'pwwp', '.yy.', 'wwww', '.ss.', '.yy.'],
    ['.ww.', 'pwwp', '.yy.', 'wwww', '.ss.', 'y..y'],
  ],
  downAlert: ['.ww.', 'pwwp', '.yy.', '.ww.', 'wwww', '.ss.', '.yy.'],
  downStartle: ['.ww.', 'pwwp', '.yy.', 'wwww', 'wwww', '.ss.', 'y..y', '....'],
  up: [
    ['.ww.', '.ww.', 'wwww', 'wwww', '.sw.', '.yy.'],
    ['.ww.', '.ww.', 'wwww', 'wwww', '.sw.', 'y..y'],
  ],
  // Afloat: no feet, the underside under water.
  swim: {
    side: [
      ['...ww.', '...Eey', 'w..ww.', 'wwwww.', '.sss..'],
      ['...ww.', '...Eey', '...ww.', 'wwwww.', 'wsss..'],
    ],
    down: ['.ww.', 'pwwp', '.yy.', 'wwww', '.ss.'],
    up: ['.ww.', '.ww.', 'wwww', 'wwww', '.ss.'],
  },
};

// ---- Goats: lean, horns swept back, a beard, the tail carried high,
// longer legs. ----
const GT_TOP = ['....pp....', '.....p....', 'w....wwww.', 'w....wEeww', 'wwwwwwww.p', 'wwwwwwww..', '.swwwwws..'];
const GT_NOD = ['..........', '....pp....', 'w....p....', 'w....wwww.', 'wwwwwwEeww', 'wwwwwwww.p', '.swwwwws..'];
const GT_CHEW = ['....pp....', '.....p....', 'w....wwww.', 'w....wEeww', 'wwwwwwwwp.', 'wwwwwwww..', '.swwwwws..'];
const GT_LOOK = ['....p.p...', '.....p....', 'w....www..', 'w....pwp..', 'wwwwwwwp..', 'wwwwwwww..', '.swwwwws..'];
const GT_RUN = ['....pp....', 'w....p....', 'w....wwww.', 'wwwwwwEeww', 'wwwwwwww.p', '.swwwwws..'];
const GT_ALERT = ['....pp....', '.....p....', '.....wwww.', 'w....wEeww', 'w....ww..p', 'wwwwwwww..', 'wwwwwwww..', '.swwwwws..'];
const GOAT: Grids = {
  side: [
    [...GT_TOP, '.p.p..p.p.', '.p.p..p.p.'],
    [...GT_NOD, '.p.p..p.p.', 'p...p.p..p'],
    [...GT_TOP, '..pp...pp.', '..pp...pp.'],
    [...GT_NOD, '.p.p..p.p.', '.p..p.p..p'],
  ],
  // Bounding: stretched, gathered, then a stiff-legged pronk high in the
  // air, and down.
  run: [
    [...GT_RUN, '.pp....pp.', 'p.......p.', 'p........p'],
    [...GT_RUN, '..pp.pp...', '...p..p...', ''],
    [...GT_RUN, '..p.p.p.p.', '..p.p.p.p.', '', ''],
    [...GT_RUN, '.p.p...pp.', 'p..p...p..', 'p......p..'],
  ],
  graze: [
    ['..........', '..........', 'w.........', 'w.........', 'wwwwwww...', 'wwwwwwwwpp', '.swwwwwwpw', '.p.p..p.pw', '.p.p..p.p.'],
    ['..........', '..........', '.w........', 'w.........', 'wwwwwww...', 'wwwwwwww..', '.swwwwwwpp', '.p.p..p.pw', '.p.p..p.pp'],
    ['..........', '..........', 'w.........', 'w.........', 'wwwwwww...', 'wwwwwwwwpp', '.swwwwwwpw', '.p.p..p.pw', '..p.p..p.p'],
  ],
  stand: [
    [...GT_TOP, '.p.p..p.p.', '.p.p..p.p.'],
    [...GT_LOOK, '.p.p..p.p.', '.p.p..p.p.'],
    // Head down, horns forward: spoiling for a butt.
    ['..........', '..........', 'w.........', 'w.....ppp.', 'wwwwwwwwpp', 'wwwwwwwwwp', '.swwwwwwp.', '.p.p..p.p.', 'p..p...p.p'],
  ],
  chew: [[...GT_TOP, '.p.p..p.p.', '.p.p..p.p.'], [...GT_CHEW, '.p.p..p.p.', '.p.p..p.p.']],
  alert: [...GT_ALERT, '.p.p..p.p.', '.p.p..p.p.'],
  startle: [...GT_ALERT, '.p.p..p.p.', 'p..p...p.p', ''],
  lie: ['....pp....', '.....p....', 'w....wwww.', 'w....wwpww', 'wwwwwwww.p', 'swwwwwwws.'],
  down: [
    ['p...p', '.www.', 'wewew', '.www.', '.pwp.', 'wwwww', 'wwwww', '.sws.', 'p...p', '.p.p.'],
    ['p...p', '.www.', 'wewew', '.www.', '.pwp.', 'wwwww', 'wwwww', '.sws.', '.p.p.', 'p...p'],
  ],
  downAlert: ['p...p', 'pwwwp', 'wewew', '.www.', '.pwp.', '.www.', 'wwwww', 'wwwww', '.sws.', 'p...p', '.p.p.'],
  downStartle: ['p...p', 'pwwwp', 'wewew', '.www.', '.pwp.', '.www.', 'wwwww', 'wwwww', '.sws.', 'p...p', 'p...p', '.....'],
  up: [
    ['p...p', '.pwp.', '.www.', 'wwwww', 'wwwww', 'wwwww', '.www.', '..w..', 'p...p', '.p.p.'],
    ['p...p', '.pwp.', '.www.', 'wwwww', 'wwwww', 'wwwww', '.www.', '..w..', '.p.p.', 'p...p'],
  ],
};

// ---- Cattle: big, boxy and dark, a teal sheen along the back, wool horns
// and blaze, a tufted tail. ----
const CW_TOP = ['...........w.w.', '...........pep.', '..tttttttttpwpp', '.ppppppppppppwp', 'p.ppspppppppps.', 'p.pppppppspp...', 'p.pspppppppp...', '..ppppppppppp..'];
// Walking on, the head nods low and the tail swings.
const CW_NOD = ['...............', '...........w.w.', '..ttttttttttpep', '.pppppppppppppw', '.pppspppppppppp', 'p.pppppppsppps.', '.ppspppppppp...', '..ppppppppppp..'];
const CW_CHEW = ['...........w.w.', '...........pep.', '..tttttttttpwpp', '.pppppppppppppp', 'p.ppspppppppw..', 'p.pppppppspp...', 'p.pspppppppp...', '..ppppppppppp..'];
const CW_LOOK = ['..........w...w', '...........ppp.', '..ttttttttpepep', '.ppppppppppwpp.', 'p.ppsppppppps..', 'p.pppppppspp...', '..pspppppppp...', '..ppppppppppp..'];
const CW_ALERT = ['...........w.w.', '...........ppp.', '...........pepp', '..tttttttttpwp.', '.ppppppppppps..', 'p.ppspppppppp..', 'p.pppppppsp....', 'p.pspppppppp...', '..ppppppppppp..'];
const CW_RUN = ['...........w.w.', 'pp.........pep.', '..tttttttttpwpp', '.ppppppppppppwp', '..ppspppppppps.', '..pppppppspp...', '..pspppppppp...', '..ppppppppppp..'];
const COW: Grids = {
  side: [
    [...CW_TOP, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    [...CW_NOD, '...pp.....pp...', '...ss.....ss...'],
    [...CW_TOP, '..pp.pp..pp.pp.', '...s..s..s..s..'],
    [...CW_NOD, '...pp.....pp...', '...ss.....ss...'],
  ],
  // A heavy lumbering gallop: it lands hard (render/animals.ts sinks it).
  run: [
    [...CW_RUN, '.pp.......pp.p.', 's..........s..s'],
    [...CW_RUN, '...pp.pppp.....', '....ss..ss.....', ''],
    [...CW_RUN, '..pp.pp..pp.pp.', '..s...s...s..s.'],
    [...CW_RUN, '...pp.pppp.....', '....ss..ss.....', ''],
  ],
  graze: [
    ['...............', '...............', 'p..............', '.pppppppppppp..', 'p.ttttttttttpw.', 'p.pppppppspppww', 'p.pspppppppppwp', '..pppppppppppps', '..pp.pp..pp.pp.', '..s..s...s..s..'],
    ['...............', '...............', '.p.............', '.pppppppppppp..', 'p.ttttttttttp..', '..pppppppsppppw', '..pspppppppppww', '..ppppppppppppp', '..pp.pp..pp.pps', '..s..s...s..s..'],
    ['...............', '...............', 'p..............', '.pppppppppppp..', 'p.ttttttttttpw.', 'p.pppppppspppww', 'p.pspppppppppwp', '..pppppppppppps', '...pp.pp..pp.pp', '...s..s...s..s.'],
  ],
  stand: [
    [...CW_TOP, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    [...CW_LOOK, '..pp.pp..pp.pp.', '..s..s....s.s..'],
    // The tail flicked up at a fly.
    ['...........w.w.', 'p..........pep.', '.ptttttttttpwpp', '.ppppppppppppwp', '..ppspppppppps.', '..pppppppspp...', '..pspppppppp...', '..ppppppppppp..', '..pp.pp..pp.pp.', '..s..s....s.s..'],
  ],
  // Chewing the cud.
  chew: [[...CW_TOP, '..pp.pp..pp.pp.', '..s..s....s.s..'], [...CW_CHEW, '..pp.pp..pp.pp.', '..s..s....s.s..']],
  alert: [...CW_ALERT, '..pp.pp..pp.pp.', '..s..s....s.s..'],
  // A buck: hind legs kicked out, tail up.
  startle: ['...........w.w.', 'pp.........ppp.', '...........pepp', '..tttttttttpwp.', '.ppppppppppps..', '.pppspppppppp..', 'pp.pppppppsp...', '.ppspppppppp...', '..ppppppppppp..', '.pp......pp.pp.', 's........s..s..', '...............'],
  lie: ['...........w.w.', '...........ppp.', '..tttttttttpwpp', '.ppppppppppppwp', 'pppppspppppppps', 'p.ppppppppsppp.', '.sppppppppppps.'],
  down: [
    ['w.....w', '.ppppp.', 'pewpep.', '.pwpwp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '.s...s.'],
    ['w.....w', '.ppppp.', 'pewpep.', '.pwpwp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '..s.s..'],
  ],
  downAlert: ['w.....w', 'wppppw.', '.pewpe.', '.pwpwp.', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', '.pp.pp.', '.s...s.'],
  downStartle: ['w.....w', 'wppppw.', '.pewpe.', '.pwpwp.', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', '.ppppp.', 'pp...pp', 's.....s', '.......'],
  up: [
    ['w.....w', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', 'ppppppp', '.ppppp.', '...p...', '.pp.pp.', '.s...s.'],
    ['w.....w', '.ppppp.', '.ppppp.', 'ptttttp', 'ppspppp', 'ppppspp', 'ppppppp', '.ppppp.', '...p...', '.pp.pp.', '..s.s..'],
  ],
};

// ---- Wild ponies: long legs, an arched neck, a flowing plum mane and tail.
const PN_TOP = ['..........pp..', '.........pEep.', '........ppwwwp', 'pp......pww..w', 'pwwwwwwwpw....', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_NOD = ['..............', '..........pp..', '.........pEep.', 'pp......ppwwwp', 'pwwwwwwwpww..w', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_SWISH = ['..........pp..', '.........pEep.', '........ppwwwp', '........pww..w', 'pwwwwwwwpw....', 'pwwwwwwwww....', 'pwwwwwwwwww...', '.psswwwwss....'];
// In a gust: the mane lifts off the neck, the tail streams out.
const PN_FLOW = ['..........pp..', '........ppEep.', '.......p.pwwwp', 'ppp.....pww..w', '.wwwwwwwpw....', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_CHEW = ['..........pp..', '.........pEep.', '........ppwwwp', 'pp......pww...', 'pwwwwwwwpw...w', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_ALERT = ['...........p..', '..........pEp.', '.........pwewp', '.........pww.w', 'pp......pw....', 'pwwwwwwwpw....', 'pwwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_RUN = ['..........p...', '.........pEep.', '........ppwwwp', 'ppp.....pww..w', '..wwwwwwpw....', '.wwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
// Flat out, the mane flying.
const PN_RUN2 = ['.........pp...', '........ppEep.', '.......p.pwwwp', 'pppp....pww..w', '..wwwwwwpw....', '.wwwwwwwww....', '.wwwwwwwwww...', '..sswwwwss....'];
const PN_LEGS = ['..w.w...w.w...', '.w...w.w...w..', '.p...p.p...p..'];
const PONY: Grids = {
  side: [
    [...PN_TOP, ...PN_LEGS],
    [...PN_NOD, '...ww....ww...', '...ww....ww...', '...pp....pp...'],
    [...PN_TOP, '..w..w..w..w..', '..w..w...ww...', '..p..p...pp...'],
    [...PN_NOD, '...ww....ww...', '...ww...w.w...', '...pp...p..p..'],
  ],
  run: [
    [...PN_RUN, '..w......w....', '.w........w...', 'p..........p..'],
    [...PN_RUN2, '...w....w.w...', '...w...w...w..', '...p...p...p..'],
    [...PN_RUN, '....w..ww.....', '....p.w..p....', ''],
    [...PN_RUN2, '..w.w...w.....', '.w...w..w.....', '.p....p.p.....'],
  ],
  graze: [
    ['..............', '..............', '..............', 'pp............', 'pwwwwwwwpp....', 'pwwwwwwwwwp...', '.wwwwwwwwwwpw.', '..sswwwwss.www', ...PN_LEGS],
    ['..............', '..............', '..............', '.p............', 'pwwwwwwwpp....', 'pwwwwwwwwwp...', 'pwwwwwwwwwwp..', '..sswwwwss.pww', ...PN_LEGS],
    ['..............', '..............', '..............', 'pp............', 'pwwwwwwwpp....', 'pwwwwwwwwwp...', '.wwwwwwwwwwpw.', '..sswwwwss.www', '..w.w...w..w..', '.w...w.w...w..', '.p...p.p...p..'],
  ],
  stand: [
    [...PN_TOP, ...PN_LEGS],
    [...PN_SWISH, ...PN_LEGS],
    // A forefoot lifted to stamp.
    [...PN_TOP, '..w.w...w.w...', '.w...w.w..ww..', '.p...p.p......'],
  ],
  chew: [[...PN_TOP, ...PN_LEGS], [...PN_CHEW, ...PN_LEGS]],
  alert: [...PN_ALERT, ...PN_LEGS],
  // Rearing: forelegs off the ground, head flung up.
  startle: ['............p.', '...........pEp', '..........pwew', 'pp.......pww.w', 'pp......pwww..', 'pwwwwwwwpwww..', 'pwwwwwwwwww.w.', '.wwwwwwwwwww..', '..sswwwwss....', '..w.w.........', '.w...w........', '.p...p........'],
  lie: ['..........pp..', '.........pwwp.', '........ppwwwp', '........pww..w', 'pp.wwwwwpw....', 'pwwwwwwwwww...', '.psswwwwwws...'],
  down: [
    ['.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', '.w.w', '.p.p'],
  ],
  downAlert: ['p..p', '.pp.', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', 'w..w', 'p..p'],
  downStartle: ['p..p', 'pppp', 'pwwp', 'pwwp', '.ww.', '.pw.', 'wwww', 'wwww', 'wwww', '.ss.', 'w..w', 'p..p', '....'],
  up: [
    ['.pp.', '.pw.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', 'w..w', 'p..p'],
    ['.pp.', '.pw.', '.pw.', '.pp.', 'wwww', 'wwww', 'wwww', 'wwww', '.pp.', 'w..w', '.w.w', '.p.p'],
  ],
  flow: [[...PN_TOP, ...PN_LEGS], [...PN_FLOW, ...PN_LEGS]],
};

const GRIDS: Record<SpeciesId, Grids> = { sheep: SHEEP, duck: DUCK, goat: GOAT, cow: COW, pony: PONY };
// Anchor columns: side poses, then the views towards / away from the viewer.
const AX: Record<SpeciesId, [number, number]> = { duck: [3, 2], sheep: [4, 3], goat: [5, 2], cow: [7, 3], pony: [6, 1] };

export type Coat = 0 | 1 | 2;

// The face colour per coat (where the eyes sit): a dark face shows a wide
// eye as a wool pixel, a pale one as a dark ring round it.
const FACE: Record<SpeciesId, string[]> = { sheep: ['p', 'w'], duck: ['w', 'y'], goat: ['w', 's', 'p'], cow: ['p', 'p', 'y'], pony: ['w', 's', 'p'] };

export function resolveEyes(rows: string[], face: string, scared: boolean): string[] {
  const dark = face === 'p';
  return rows.map((r) =>
    r.replace(/[eE]/g, (m) => {
      if (m === 'e') return scared && dark ? 'w' : 'p';
      return scared ? 'p' : face;
    }),
  );
}

// `coat` gives herds some variety: ponies come in wool, dun (sage) and bay
// (plum with a wool mane); goats in wool or sage; cattle in solid plum or
// plum and wool (piebald).
function recoat(id: SpeciesId, coat: Coat, rows: string[]): string[] {
  if (coat === 0) return rows;
  const rare = rareCoat(id, coat, rows); // the fair's rare breeds (art/young.ts)
  if (rare) return rare;
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

// Build a set from grids: `look` turns template rows into palette rows.
export function buildSprites(G: Grids, look: (rows: string[]) => string[], ax: number, axv: number): AnimalSprites {
  const side = (rows: string[]) => {
    const r = look(rows);
    return spr(r, ax, r.length - 1);
  };
  const vert = (rows: string[]) => {
    const r = look(rows);
    return spr(r, axv, r.length - 1);
  };
  const grazing = G.graze.map(side);
  return {
    side: G.side.map(side),
    run: G.run.map(side),
    grazing,
    graze: grazing[0],
    stand: G.stand.map(side),
    chew: G.chew.map(side),
    alert: side(G.alert),
    startle: side(G.startle),
    lie: side(G.lie),
    down: G.down.map(vert),
    downAlert: vert(G.downAlert),
    downStartle: vert(G.downStartle),
    up: G.up.map(vert),
    swim: G.swim && { side: G.swim.side.map(side), down: vert(G.swim.down), up: vert(G.swim.up) },
    flow: G.flow?.map(side),
  };
}
export type { Grids as AnimalGrids };

function build(id: SpeciesId, coat: Coat, scared: boolean): AnimalSprites {
  const [ax, axv] = AX[id];
  const rim = RIM[id]?.[coat];
  const face = FACE[id][coat] ?? FACE[id][0];
  const look = (rows: string[]) => {
    const r = resolveEyes(recoat(id, coat, rows), face, scared);
    return rim ? rimLight(r, ...rim) : r;
  };
  return buildSprites(GRIDS[id], look, ax, axv);
}

const cache = new Map<string, AnimalSprites>();

// `scared`: the same animal wide-eyed (stressed hard, or running for it).
export function animalSprites(id: SpeciesId, coat: Coat = 0, scared = false): AnimalSprites {
  const key = `${id}${coat}${scared ? 's' : ''}`;
  let s = cache.get(key);
  if (!s) cache.set(key, (s = build(id, coat, scared)));
  return s;
}
