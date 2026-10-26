import type { SpeciesId } from '../world/map';
import { air, buildSprites, coatLook, compose, legs, mapRows, mirror, resolveEyes, rimLight, skew, stride, type AnimalGrids, type AnimalSprites, type Grid, type Stride } from './animals';

// The young (lambs, ducklings, kids, calves and foals, each in its
// mother's coat) and the fair's rare breeds, drawn at double density like
// the rest of the herd (art/animals.ts) and with the same frames.

// ---- Rare breeds: recolours of the species' grids ----
// Call duck: buff (buttercup) with a moss bill. Pygmy goat: dark, with
// pale horns and hooves. Highland cow: a golden coat with plum horns, a
// wool sheen and a moss muzzle.
export function rareCoat(id: SpeciesId, coat: number, rows: string[]): string[] | null {
  if (id === 'duck' && coat === 1) return rows.map((r) => r.replace(/[wy]/g, (m) => (m === 'w' ? 'y' : 'o')));
  if (id === 'goat' && coat === 2) return rows.map((r) => r.replace(/[wp]/g, (m) => (m === 'w' ? 'p' : 'w')));
  if (id === 'cow' && coat === 2) return mapRows(rows, { p: 'y', w: 'p', t: 'w', s: 'o', P: 'y' });
  return null;
}

// ---- Lambs: small, leggy and big-headed: a short tight fleece, a dark
// face with long ears, thin dark legs ----
const LB_BODY = ['..ww.www..', '.wwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwswwwsww', '.ssssssss.'];
const LB_HEAD = ['..ww...', 'ppppp..', '.pEEpp.', '.pegppp', '..pppp.', '...pp..'];
const LB_LOOK = ['..ww..', 'pppppp', 'pEpEpp', 'egpgep', '.pppp.', '..pp..'];
const LB_CHEW = ['..ww...', 'ppppp..', '.pEEpp.', '.pegppp', '..ppp..', '...p.p.'];
const LB_ALERT = ['...p...', '..pp...', '..ww...', '.pppp..', '.pEEpp.', '.pegppp', '..pppp.', '...pp..'];
const LB_GRAZE = ['pp.....', '.pppp..', '.pEEp..', '.pegpp.', '..pppp.', '...pp..'];
const LB_LEG = ['L', 'L', 'L'];
const LB_HIPS = { fh: 1, nh: 3, ff: 7, nf: 9 };

function lambGrids(): AnimalGrids {
  const W = 16;
  const side = (head: Grid, hx: number, hy: number, f: Stride, top = 0) =>
    compose(W, 10 + top, [legs(LB_LEG, stride(LB_HIPS, f), 7 + top), [LB_BODY, 0, 1 + top], [head, hx, hy + top]]);
  const std = (f: Stride = {}) => side(LB_HEAD, 8, 0, f);
  const tuck = (f: Stride) => air(side(LB_HEAD, 9, 0, f), 2);
  const up1 = { up: 1 };
  // Towards the viewer and away.
  const fleeceD = ['...wwwwww...', '.wwwwwwwwww.', 'wwwwwwwwwwww', 'wwwwwwwwwwww', '.wwwwwwwwww.', '..ssssssss..'];
  const faceD = ['ppp......ppp', '.ppwppppwpp.', '...pEppEp...', '...pgppgp...', '....pppp....', '.....pp.....'];
  const faceA = ['.pp......pp.', '..ppppppp...', '...pEppEp...', '...pgppgp...', '....pppp....', '.....pp.....'].map((r) => r.padEnd(12, '.'));
  const down = (lg: Grid, face = faceD) => compose(12, 12, [[lg, 0, 9], [fleeceD, 0, 0], [face, 0, 3]]);
  const backU = ['....pppp....', '.pp.pppp.pp.', '...pwwwwp...'];
  const rump = ['.wwwwwwwwww.', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', '.sssswwssss.', '.....ss.....'];
  const up = (lg: Grid) => compose(12, 12, [[lg, 0, 9], [rump, 0, 3], [backU, 0, 0]]);
  const lg = (l: boolean, r: boolean) => ['...p....p...', `...${l ? '.' : 'p'}....${r ? '.' : 'p'}...`, `...${l ? '.' : 'p'}....${r ? '.' : 'p'}...`];
  return {
    side: [std({ nf: 1, ff: -1, nh: -1, fh: 1 }), side(LB_HEAD, 8, 1, { nf: up1, fh: up1 }), std({ nf: -1, ff: 1, nh: 1, fh: -1 }), side(LB_HEAD, 8, 1, { ff: up1, nh: up1 })],
    // Running is all skipping: a stretch, then all four tucked up in the air.
    run: [std({ nf: 2, ff: 1, nh: -2, fh: -1 }), tuck({ nf: { up: 1, o: -1 }, ff: up1, nh: { up: 1, o: 1 }, fh: up1 }), std({ nf: 1, ff: 2, nh: -1, fh: -2 }), tuck({ nf: up1, ff: { up: 1, o: -1 }, nh: up1, fh: { up: 1, o: 1 } })],
    graze: [side(LB_GRAZE, 9, 4, {}), side(LB_GRAZE, 9, 5, {}), side(LB_GRAZE, 9, 4, { nf: 1, ff: up1 })],
    stand: [std(), side(LB_LOOK, 9, 0, {}), air(std({ nf: up1, ff: up1, nh: up1, fh: up1 }), 1)],
    chew: [std(), side(LB_CHEW, 8, 0, {})],
    alert: side(LB_ALERT, 8, -2, {}, 2),
    startle: air(side(LB_ALERT, 8, -2, { nf: 2, ff: 1, nh: -2, fh: -1 }, 2), 2),
    lie: compose(W, 8, [[['.pp..pp'], 7, 7], [LB_BODY, 0, 2], [LB_HEAD, 8, 1]]),
    down: [down(lg(false, false)), down(lg(true, false))],
    downAlert: down(lg(false, false), faceA),
    downStartle: air(down(['..p......p..', '.p........p.', 'p..........p'], faceA), 2),
    up: [up(lg(false, false)), up(lg(false, true))],
  };
}

// ---- Ducklings: a round ball of down, a big head, a stub of a bill and
// wings, tiny webbed feet; they swim like their mothers ----
const DL_HEAD = ['.www..', 'wwwww.', 'wwEwy.', 'wwewyy', '.www..'];
const DL_BODY = ['w.......', 'wwwwwww.', 'wwwsswww', '.sssss..'];
const DL_SWAY = ['........', 'wwwwwww.', 'wwwsswww', 'wsssss..'];
function ducklingGrids(): AnimalGrids {
  const W = 10;
  const side = (body: Grid, head: Grid, hx: number, hy: number, feet: string | null, extra: [Grid, number, number][] = [], top = 0) =>
    compose(W, (feet ? 9 : 8) + top, [feet ? [[feet], 0, 8 + top] : null, [body, 0, 4 + top], [head, hx, hy + top], ...extra.map(([g, x, y]) => [g, x, y + top] as const)]);
  const F = ['.yy.yy....', '.yy..yy...', '..yyyy....', 'yy...yy...'];
  const std = (f: string, body = DL_BODY) => side(body, DL_HEAD, 4, 0, f);
  const stub = ['.w', 'ww']; // a wing
  const peck = ['.ww..', 'wwww.', 'wwEw.', 'wwew.', '..yy.']; // head down at the grass
  return {
    side: [std(F[0]), std(F[1], DL_SWAY), std(F[2]), std(F[3], DL_SWAY)],
    run: [side(DL_BODY, DL_HEAD, 4, 1, F[3], [[stub, 2, 2]]), side(DL_BODY, DL_HEAD, 4, 1, F[2]), side(DL_SWAY, DL_HEAD, 4, 1, F[1], [[stub, 2, 2]]), air(side(DL_BODY, DL_HEAD, 4, 1, '..yy.yy...'), 1)],
    graze: [side(DL_BODY, peck, 5, 4, F[0]), side(DL_BODY, peck.map((r, i) => (i === 4 ? '..y..' : r)), 5, 4, F[0]), side(DL_BODY, peck, 5, 4, F[2])],
    stand: [std(F[0]), side(DL_BODY, mirror(DL_HEAD), 2, 0, F[0]), side(DL_BODY, DL_HEAD, 4, 0, F[0], [[stub, 1, 1]])],
    chew: [side(DL_BODY, ['.www.', 'wwwww', 'yewww', '.www.'], 2, 1, F[0]), side(DL_BODY, ['.www.', 'wwwww', 'yewww', 'y.ww.'], 2, 1, F[0])],
    alert: side(DL_BODY, [...DL_HEAD, '.ww...'], 4, -1, F[0], [], 1),
    startle: air(side(DL_BODY, [...DL_HEAD, '.ww...'], 4, -1, 'yy....yy..', [[stub, 1, 2], [stub, 3, 1]], 1), 2),
    lie: compose(W, 7, [[DL_BODY.map((r, i) => (i === 3 ? '.ssssss.' : r)), 0, 3], [['.www..', 'wwwww.', 'wpwwy.', 'wwwwyy'], 4, 0]]),
    down: [dlDown('.yy.yy'), dlDown('.yy...')],
    downAlert: dlDown('.yy.yy', 1),
    downStartle: air(dlDown('yy..yy', 1, true), 2),
    up: [dlUp('.yy.yy'), dlUp('...yy.')],
    swim: {
      side: [side(DL_BODY, DL_HEAD, 4, 0, null), side(DL_SWAY, DL_HEAD, 4, 0, null)],
      down: dlDown(null),
      up: dlUp(null),
    },
  };
}
function dlDown(feet: string | null, neck = 0, wings = false): Grid {
  const head = ['.wwww.', 'wwwwww', 'wEwwEw', 'wewwew', '..yy..'];
  const body = [wings ? 'ww..ww' : 'w....w', 'wwwwww', '.ssss.'];
  return compose(6, (feet ? 9 : 8) + neck, [feet ? [[feet], 0, 8 + neck] : null, [body, 0, 5 + neck], [head, 0, 0], neck ? [['.wwww.'], 0, 5] : null]);
}
function dlUp(feet: string | null): Grid {
  const body = ['.wwww.', 'wwwwww', 'wwwwww', '.wwww.', 'w.ww.w', 'wwwwww', 'wswwsw', '.swws.'];
  return compose(6, feet ? 9 : 8, [feet ? [[feet], 0, 8] : null, [body, 0, 0]]);
}

// ---- Goat kids: leggy and light on their feet, a big head with horn
// buds and ears out, the stub of a tail up ----
const KD_HEAD = ['...p.p..', '..wwww..', 'sswwEww.', '..wwegww', '...wwwwp', '...www..', '...ww...'];
const KD_LOOK = ['..p..p..', '..wwww..', 'sswwwwss', '..EwwE..', '..ewwe..', '...ww...', '...pp...'];
const KD_BODY = ['wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.sssssssss'];
const KD_LEG = ['L', 'L', 'L', 'p'];
const KD_HIPS = { fh: 1, nh: 3, ff: 7, nf: 9 };
function kidGrids(): AnimalGrids {
  const W = 15;
  const side = (head: Grid, hx: number, hy: number, f: Stride, top = 0) =>
    compose(W, 14 + top, [legs(KD_LEG, stride(KD_HIPS, f, 's', 'w'), 10 + top), [KD_BODY, 0, 6 + top], [['.w', 'ww'], 0, 4 + top], [head, hx, hy + top]]);
  const std = (f: Stride = {}) => side(KD_HEAD, 7, 0, f);
  const up1 = { up: 1 };
  const grazeH = ['ww......', '.www....', '..wwww..', '.p.wwEw.', '...wwegw', '....wwww', '.....wwp'];
  return {
    side: [std({ nf: 1, ff: -1, nh: -1, fh: 1 }), side(KD_HEAD, 7, 1, { nf: up1, fh: up1 }), std({ nf: -1, ff: 1, nh: 1, fh: -1 }), side(KD_HEAD, 7, 1, { ff: up1, nh: up1 })],
    // Bounding: stretched, gathered, a stiff-legged pronk in the air, down.
    run: [std({ nf: 2, ff: 1, nh: -2, fh: -1 }), air(side(KD_HEAD, 7, 1, { nf: -1, ff: up1, nh: 1, fh: up1 }), 2), air(std(), 3), std({ nf: 1, ff: 2, nh: -1, fh: -2 })],
    graze: [side(grazeH, 8, 7, {}), side(grazeH.map((r, i) => (i === 6 ? '.....ww.' : r)), 8, 7, {}), side(grazeH, 8, 7, { nf: 1, ff: up1 })],
    stand: [std(), side(KD_LOOK, 7, 0, {}), air(std({ nf: up1, ff: up1, nh: up1, fh: up1 }), 2)],
    chew: [std(), side(KD_HEAD.map((r, i) => (i === 4 ? '...wwww.' : i === 5 ? '...wwwp.' : r)), 7, 0, {})],
    alert: side(['...p.p..', '...p.p..', '.swwwww.', 's.wwEww.', '..wwegww', '...wwwwp', '...www..', '...ww...', '...ww...'], 7, -2, {}, 2),
    startle: air(side(['...p.p..', '...p.p..', '.swwwww.', 's.wwEww.', '..wwegww', '...wwwwp', '...www..', '...ww...', '...ww...'], 7, -2, { nf: 1, ff: -1, nh: -1, fh: 1 }, 2), 2),
    lie: compose(W, 11, [[['.pp...pp'], 1, 10], [KD_BODY, 0, 6], [['.w', 'ww'], 0, 4], [KD_HEAD, 7, 0]]),
    down: [kidDown(['..w....w..', '..w....w..', '..p....w..', '.......p..']), kidDown(['..w....w..', '..w....w..', '..w....p..', '..p.......'])],
    downAlert: kidDown(['..w....w..', '..w....w..', '..w....w..', '..p....p..'], 1),
    downStartle: air(kidDown(['.w......w.', '.w......w.', 'w........w', 'p........p'], 1), 2),
    up: [kidUp(['..w....w..', '..w....w..', '..p....w..', '.......p..']), kidUp(['..w....w..', '..w....w..', '..w....p..', '..p.......'])],
  };
}
function kidDown(lg: Grid, lift = 0): Grid {
  const face = ['...p..p...', '..wwwwww..', 'sswwwwwwss', '..EwwwwE..', '..ewwwwe..', '...wwww...', '...wppw...'];
  const chest = ['..wwwwww..', '.wwwwwwww.', '.wwwwwwww.', '.wwwwwwww.', '..ssssss..'];
  return compose(10, 14, [[lg, 0, 10], [chest, 0, 6], [face, 0, -lift]]);
}
function kidUp(lg: Grid): Grid {
  const head = ['...p..p...', '..wwwwww..', 'sswwwwwwss', '..wwwwww..', '...wwww...'];
  const back = ['..wwwwww..', '.wwwwwwww.', '.wwwwwwww.', '.wwwwwwww.', '.wwwwwwww.', '..ssssss..'];
  return compose(10, 14, [[lg, 0, 10], [back, 0, 5], [head, 0, 0], [['ww', 'ss'], 4, 5]]);
}

// ---- Calves: stocky and dark, a big head with ears out and no horns yet,
// the blaze and a pale muzzle, a teal sheen, a thin tail ----
const CF_HEAD = ['pp.....pp', '.ppppppp.', '..EpwpE..', '..gpwpg..', '..ppwpp..', '..sssss..', '..spsps..', '...sss...'];
const CF_BODY = ['.tttttttttt.', 'ptppppppttpp', 'ppPPpppppPPp', 'pPPPpppppPPp', 'ppPppppppppp', '.pppppppppp.'];
const CF_LEG = ['LL', 'LL', 'ss'];
const CF_HIPS = { fh: 3, nh: 5, ff: 10, nf: 12 };
function calfGrids(): AnimalGrids {
  const W = 19;
  const tail = ['p.', 'p.', 'p.', 'p.', 'pp'];
  const flick = ['.p', 'p.', '..', '..', '..'];
  const side = (head: Grid, hx: number, hy: number, f: Stride, top = 0, t: Grid = tail) =>
    compose(W, 13 + top, [legs(CF_LEG, stride(CF_HIPS, f), 10 + top), [CF_BODY, 2, 4 + top], [t, 0, 5 + top - (t === flick ? 2 : 0)], [head, hx, hy + top]]);
  const std = (f: Stride = {}) => side(CF_HEAD, 10, 0, f);
  const up1 = { up: 1 };
  const grazeH = CF_HEAD.slice(0, 7);
  return {
    side: [std({ nf: 1, ff: -1, nh: -1, fh: 1 }), side(CF_HEAD, 10, 1, { nf: up1, fh: up1 }), std({ nf: -1, ff: 1, nh: 1, fh: -1 }), side(CF_HEAD, 10, 1, { ff: up1, nh: up1 })],
    run: [side(CF_HEAD, 11, 1, { nf: 2, ff: 1, nh: -2, fh: -1 }, 0, flick), air(side(CF_HEAD, 11, 0, { nf: -1, ff: up1, nh: 1, fh: up1 }, 0, flick), 2), side(CF_HEAD, 11, 1, { nf: 1, ff: 2, nh: -1, fh: -2 }, 0, flick), air(side(CF_HEAD, 11, 0, { ff: -1, nf: up1, fh: 1, nh: up1 }, 0, flick), 2)],
    graze: [side(grazeH, 11, 6, {}), side(grazeH.map((r, i) => (i === 6 ? '...ssss..' : r)), 11, 6, {}), side(grazeH, 11, 6, { nf: 1, ff: up1 })],
    stand: [std(), side(mirror(CF_HEAD), 9, 0, {}), side(CF_HEAD, 10, 0, {}, 0, flick)],
    chew: [std(), side(CF_HEAD.map((r, i) => (i === 5 ? '...sssss.' : i === 6 ? '...spsps.' : i === 7 ? '....sss..' : r)), 10, 0, {})],
    alert: side(['pp.....pp', 'ppppppppp', '..EpwpE..', '..gpwpg..', '..ppwpp..', '..sssss..', '..spsps..', '...sss...', '...pp....'], 10, -2, {}, 2),
    startle: air(side(['pp.....pp', 'ppppppppp', '..EpwpE..', '..gpwpg..', '..ppwpp..', '..sssss..', '..spsps..', '...sss...', '...pp....'], 10, -2, { nh: { o: -3, up: 1 }, fh: { o: -2, up: 1 }, nf: 1 }, 2, flick), 2),
    lie: compose(W, 11, [[['.pp.....ppp'], 3, 10], [CF_BODY, 2, 4], [['p.', 'p.', 'p.', 'ppp'], 0, 6], [CF_HEAD, 10, 0]]),
    down: [calfDown(['..pp....pp..', '..pp....pp..', '..ss....pp..', '........ss..']), calfDown(['..pp....pp..', '..pp....pp..', '..pp....ss..', '..ss........'])],
    downAlert: calfDown(['..pp....pp..', '..pp....pp..', '..pp....pp..', '..ss....ss..'], 1),
    downStartle: air(calfDown(['.pp......pp.', '.pp......pp.', 'pp........pp', 'ss........ss'], 1), 2),
    up: [calfUp(['..pp....pp..', '..pp....pp..', '..ss....pp..', '........ss..']), calfUp(['..pp....pp..', '..pp....pp..', '..pp....ss..', '..ss........'])],
  };
}
function calfDown(lg: Grid, lift = 0): Grid {
  const chest = ['.tttttttttt.', 'tpppppppPPpt', 'pppppppPPPpp', 'pppppppppppp', '.pppppppppp.'];
  return compose(12, 15, [[lg, 0, 11], [chest, 0, 7], [CF_HEAD, 1, -lift]]);
}
function calfUp(lg: Grid): Grid {
  const head = ['pp......pp', '.pppppppp.', '..pppppp..'].map((r) => '.' + r);
  const back = ['.tttttttttt.', 'tttppppppttt', 'ppPPpppppppp', 'pPPPpppppppp', 'ppPppppppppp', 'pppppppppppp', 'pppppppppppp', '.pppppppppp.'];
  return compose(12, 15, [[lg, 0, 11], [back, 0, 3], [head, 0, 0], [['pp', 'pp', 'pp', 'pp', 'ss'], 5, 6]]);
}

// ---- Foals: all legs, a short brush of a mane and tail, a small body,
// a big-eyed head held up ----
const FL_FRONT = ['.....p.p..', '.....ppp..', '...ppwwww.', '..pp.wEwww', '.pp.wwegww', 'pp.ww..wws', 'p.www...ws', '.www......'];
const FL_BODY = ['.wwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.sssssssss'];
const FL_TAIL = ['.pp', 'ppp', 'pp.', 'p..', 'p..'];
const FL_FORE = ['L', 'L', 'L', 'L', 'L', 'p'];
const FL_HIND = ['LL', 'L.', 'L.', '.L', '.L', '.p'];
function foalGrids(): AnimalGrids {
  const W = 18;
  const L = (f: Stride, top: number) => {
    const [fh, ff, nh, nf] = stride({ fh: 4, ff: 10, nh: 6, nf: 12 }, f, 's', 'w');
    return [legs(FL_HIND, [fh, nh], top), legs(FL_FORE, [ff, nf], top)] as const;
  };
  const side = (front: Grid, fx: number, fy: number, f: Stride, top = 0, tail: Grid = FL_TAIL) => {
    const [hl, fl] = L(f, 10 + top);
    return compose(W, 16 + top, [hl, fl, [tail, 0, 6 + top], [FL_BODY, 3, 7 + top], [front, fx, fy + top]]);
  };
  const std = (f: Stride = {}) => side(FL_FRONT, 8, 0, f);
  const up1 = { up: 1 };
  const stream = ['ppp', 'pp.', '...', '...', '...'];
  const grazeF = ['pp.ww.....', '.p.wwww...', '....wwwww.', '......wwwp', '......wEwp', '......wegw', '......wwww', '.......ws.'];
  const lookF = ['.....p..p.', '.....pppp.', '....pwwwp.', '...pEwwE..', '..ppewwe..', '.pp..ww...', 'p.ww.ss...', '.www......'];
  const alertF = ['......pp..', '.....ppp..', '...ppwwww.', '..pp.wEwww', '.pp.wwegww', 'pp.ww..wws', 'p.www...ws', '.www......', 'www.......'];
  const rear = () => {
    const [hl] = L({ nh: -1, fh: -2 }, 0);
    const upper = skew(compose(W, 14, [[FL_TAIL, 0, 8], [FL_BODY, 3, 9], [alertF, 8, 0]]), 0.35, 6);
    const h = upper.length + 4;
    return compose(W, h, [[hl[0], 0, h - 6], [upper, 0, 0], [legs(['L', 'L', '.p'], [{ x: 11, c: 's' }, { x: 13, c: 'w' }], 0)[0], 0, h - 10]]);
  };
  return {
    side: [std({ nf: 1, ff: -1, nh: -1, fh: 1 }), side(FL_FRONT, 8, 1, { nf: { up: 2 }, fh: up1 }), std({ nf: -1, ff: 1, nh: 1, fh: -1 }), side(FL_FRONT, 8, 1, { ff: { up: 2 }, nh: up1 })],
    run: [side(FL_FRONT, 9, 1, { nf: 3, ff: 2, nh: -2, fh: -3 }, 0, stream), air(side(FL_FRONT, 9, 1, { nf: -1, ff: { up: 2 }, nh: 2, fh: { up: 2 } }, 0, stream), 2), side(FL_FRONT, 9, 1, { nf: 2, ff: 3, nh: -3, fh: -2 }, 0, stream), air(side(FL_FRONT, 9, 1, { ff: -1, nf: { up: 2 }, fh: 2, nh: { up: 2 } }, 0, stream), 2)],
    graze: [side(grazeF, 9, 7, { nf: 2, ff: 1 }), side(grazeF.map((r, i) => (i === 7 ? '......ws..' : r)), 9, 7, { nf: 2, ff: 1 }), side(grazeF, 9, 7, { nf: 3, ff: 1 })],
    stand: [std(), side(lookF, 8, 0, {}), side(FL_FRONT, 8, 0, { nf: { up: 2 } })],
    chew: [std(), side(FL_FRONT.map((r, i) => (i === 5 ? 'pp.ww..ww.' : i === 6 ? 'p.www...ws' : r)), 8, 0, {})],
    alert: side(alertF, 8, -1, {}, 1),
    startle: rear(),
    lie: compose(W, 12, [[['.pppp....ppp'], 3, 11], [FL_TAIL, 0, 6], [FL_BODY, 3, 8], [FL_FRONT, 8, 1]]),
    down: [foalDown(['.w..w.', '.w..w.', '.w..w.', '.w..w.', '.p..w.', '....p.']), foalDown(['.w..w.', '.w..w.', '.w..w.', '.w..w.', '.w..p.', '.p....'])],
    downAlert: foalDown(['.w..w.', '.w..w.', '.w..w.', '.w..w.', '.w..w.', '.p..p.'], 1),
    downStartle: air(foalDown(['w....w', 'w....w', 'w....w', 'p....p', '......', '......'], 1), 2),
    up: [foalUp(['.w..w.', '.w..w.', '.w..w.', '.w..w.', '.p..w.', '....p.']), foalUp(['.w..w.', '.w..w.', '.w..w.', '.w..w.', '.w..p.', '.p....'])],
  };
}
function foalDown(lg: Grid, lift = 0): Grid {
  const head = ['p....p', 'pp..pp', '.pppp.', 'EwwwwE', 'ewwwwe', '.wwww.', '.wwww.', '.ssss.'];
  const chest = ['.pwwp.', 'wwwwww', 'wwwwww', 'wwwwww', '.ssss.'];
  return compose(6, 18, [[lg, 0, 12], [chest, 0, 8], [head, 0, -lift]]);
}
function foalUp(lg: Grid): Grid {
  const head = ['p....p', 'pp..pp', '.pppp.', '.pppp.', '..pp..'];
  const back = ['.wppw.', 'wwwwww', 'wwwwww', 'wwwwww', 'wwwwww', 'wwwwww', '.wwww.'];
  return compose(6, 18, [[lg, 0, 12], [back, 0, 5], [head, 0, 0], [['pp', 'pp', 'p.', 'p.'], 2, 9]]);
}

const YOUNG: Partial<Record<SpeciesId, [() => AnimalGrids, number, number]>> = {
  duck: [ducklingGrids, 4, 3],
  goat: [kidGrids, 6, 4],
  cow: [calfGrids, 8, 6],
  pony: [foalGrids, 7, 2],
};
const grids = new Map<SpeciesId, AnimalGrids>();
const cache = new Map<string, AnimalSprites>();

// The young of any kind, in its mother's coat (a lamb for sheep: coat 1 is
// a black lamb, pale face and legs). `scared`: wide-eyed.
export function youngSprites(id: SpeciesId, coat: number, scared = false): AnimalSprites {
  const key = `${id}${coat}${scared ? 's' : ''}`;
  let s = cache.get(key);
  if (s) return s;
  if (id === 'sheep' || !YOUNG[id]) {
    const black = coat === 1;
    const look = (rows: string[]) => {
      const r = resolveEyes(black ? mapRows(rows, { w: 'p', p: 'w' }) : rows, black ? 'w' : 'p', scared);
      return black ? r : rimLight(r, 'w', 'y', false, 2);
    };
    let g = grids.get('sheep');
    if (!g) grids.set('sheep', (g = lambGrids()));
    s = buildSprites(g, look, 6, 4);
  } else {
    const [make, ax, axv] = YOUNG[id]!;
    let g = grids.get(id);
    if (!g) grids.set(id, (g = make()));
    s = buildSprites(g, coatLook(id, coat, scared), ax, axv);
  }
  cache.set(key, s);
  return s;
}

// Lambs by their old name.
export const lambSprites = (coat: number, scared = false): AnimalSprites => youngSprites('sheep', coat, scared);
