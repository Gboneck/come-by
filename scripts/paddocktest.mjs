// Paddocks you size yourself, end to end: capacity by area and price by
// fence (one big paddock cheaper per head than many small), the placing
// rules (size, corners, the drove road, ranch land), a gate on any side at
// any point, extending a side (paying only for new fence, the gate moving
// with its side or staying put), mixed flocks (sheep with goats, never with
// cattle), goods by kind, the fixtures (trough, field shelter, hay rack),
// barn shelter through a big paddock's gate, a flock driven into a big
// paddock and let out again, old saves' pens, and co-op's copy.
// Prints PASS/FAIL per check; exits 1 on a failure or console error.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.PADDOCK_PORT || 5251);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  let s = 777;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
await page.evaluate(() => localStorage.clear());

const res = await page.evaluate(async () => {
  const g = window.game;
  const out = [];
  const check = (name, ok, info) => out.push({ name, ok: !!ok, info });
  const P = await import('/src/ranch/paddock.ts');
  const BD = await import('/src/ranch/buildings.ts');
  const A = await import('/src/entities/animal.ts');
  const E = await import('/src/systems/economy.ts');
  const Z = await import('/src/systems/seasonal.ts');
  const M = await import('/src/world/map.ts');
  const SV = await import('/src/systems/save.ts');
  const SH = await import('/src/net/shared.ts');
  const B = await import('/src/ui/build.ts');
  const K = await import('/src/ranch/catalog.ts');
  const step = (s, input = { x: 0, y: 0, sprint: false, lie: false }) => {
    for (let i = 0; i < s * 60; i++) { g.input.override = input; g.update(1 / 60); g.input.clearQueue(); }
    g.input.override = null;
  };
  const pen0 = (id, p, i, n) => { const a = new A.Animal(id, p.ix0 + 8 + (i % 4) * 9, p.iy0 + 8 + Math.floor(i / 4) * 9); a.home = true; a.pen = p; p.animals.push(a); if (!p.species) p.species = id; g.animals.push(a); return a; };
  g.tut = 99;
  g.setTier(5, false);
  g.day.t = 30;
  g.animals = [];
  g.coins = 10000;

  // ---- Size, capacity, price ----
  check('an 8x7 paddock holds 16 and costs 25$, as the old pen did', P.paddockCapacity(8, 7) === 16 && P.paddockPrice(8, 7) === 25);
  const small = P.paddockPrice(8, 7) / 16, big = P.paddockPrice(16, 14) / P.paddockCapacity(16, 14);
  check('one big paddock is cheaper per head than small ones', big < small * 0.6, { perSpaceSmall: +small.toFixed(2), perSpaceBig: +big.toFixed(2), bigHolds: P.paddockCapacity(16, 14), bigCosts: P.paddockPrice(16, 14) });

  // ---- Placing ----
  const tooSmall = P.placeProblem(g, { tx: 100, ty: 108, w: 5, h: 5 }, P.defaultGate(5, 5, 0));
  const corner = P.placeProblem(g, { tx: 100, ty: 108, w: 8, h: 7 }, { side: 0, at: 0 });
  const offRanch = P.placeProblem(g, { tx: 60, ty: 60, w: 8, h: 7 }, P.defaultGate(8, 7, 0));
  const onRoad = P.placeProblem(g, { tx: 92, ty: 101, w: 8, h: 7 }, P.defaultGate(8, 7, 0));
  check('too small, a gate on a corner, off the ranch, on the drove road: refused', tooSmall && corner && offRanch === 'NOT ON RANCH LAND' && onRoad, { tooSmall, corner, offRanch, onRoad });
  // The first clear spot for a 12x9 with its gate on the east side, two
  // tiles down.
  const gate = { side: 3, at: 2 };
  const spot = (w, h, gt) => {
    // Room to grow 4 to the west as well.
    for (let ty = 86; ty < 120; ty++) for (let tx = 76; tx < 120; tx++) if (!P.placeProblem(g, { tx, ty, w, h }, gt) && !P.placeProblem(g, { tx: tx - 4, ty, w: w + 4, h }, gt)) return { tx, ty, w, h };
    return null;
  };
  const r = spot(12, 9, gate);
  const why = r ? P.placeProblem(g, r, gate) : 'NO ROOM';
  const coins0 = g.coins;
  const big1 = P.placePaddock(g, r, gate);
  const s = big1?.gateSpan();
  check('a 12x9 paddock with its gate on the east side, two tiles down', !why && big1 && g.coins === coins0 - P.paddockPrice(12, 9) && big1.capacity === P.paddockCapacity(12, 9) && s.x0 === (r.tx + r.w) * 8 - 4 && s.y0 === (r.ty + 2) * 8, { why, cap: big1?.capacity, span: s });
  // The fence is solid, the gate a gap.
  const solid = (x, y) => (g.map.flagsAtPx(x, y) & M.SOLID) !== 0;
  check('its fence is solid, its gate opens', solid(big1.x0 + 2, big1.cy) && solid(big1.x1 - 2, big1.y1 - 6) && (big1.swing < 0.85 || !solid(s.x0 + 2, s.y0 + 6)));

  // ---- A flock driven in through the side gate, and let out again ----
  window.resetFlock('sheep', big1.x1 + 60, big1.gatePoint(0).y, 8, big1.x1 + 120, big1.gatePoint(0).y);
  g.coins = 10000;
  const run = window.sim({ goalX: big1.gatePoint(-20).x, goalY: big1.gatePoint(-20).y, untilPenned: true }, 90);
  step(2);
  const penned = big1.animals.length;
  check('a flock driven in at the side gate is penned, the gate shuts', penned === 8 && !big1.open, { penned, secs: run.seconds, open: big1.open });
  const gp = big1.gatePoint(9);
  g.dog.x = gp.x; g.dog.y = gp.y; g.dog.hx = -1; g.dog.hy = 0;
  step(0.1);
  g.input.push('nip');
  step(0.1);
  check('nip at its gate holds it open to let them out', big1.letOut && big1.open);
  g.ranch.setLetOut(big1, false);
  step(1);

  // ---- Extending ----
  const before = { tx: big1.tx, w: big1.w, h: big1.h, cap: big1.capacity, gate: big1.gatePoint(0) };
  const ePrice = P.extendPrice(big1, 1, 4);
  const coinsE = g.coins;
  const why1 = P.extendProblem(g, big1, 1, 4);
  const ok1 = P.extendPaddock(g, big1, 1, 4); // out to the west by 4
  check('extending a side pays only for the new fence', !why1 && ok1 && g.coins === coinsE - ePrice && ePrice === Math.round(0.8 * 2 * 4) && big1.w === before.w + 4 && big1.tx === before.tx - 4, { why1, ePrice, w: big1.w });
  const gNow = big1.gatePoint(0);
  check('the east gate stays where it was when the west side moves', Math.abs(gNow.x - before.gate.x - 0) < 0.1 && Math.abs(gNow.y - before.gate.y) < 0.1, { before: before.gate, now: gNow });
  check('more room, the flock still penned', big1.capacity > before.cap && big1.animals.length === 8 && big1.animals.every((a) => big1.contains(a.x, a.y)), { cap: big1.capacity });
  const ok2 = P.extendPaddock(g, big1, 3, 3); // the gate side out by 3
  check('the gate moves out with its own side', ok2 && Math.abs(big1.gatePoint(0).x - (gNow.x + 24)) < 0.1, { gate: big1.gatePoint(0) });
  const blocked = P.extendProblem(g, big1, 1, 40);
  check('it will not extend off the ranch or past the most', !!blocked, blocked);

  // ---- Moving the gate ----
  const moved = P.moveGate(g, big1, { side: 2, at: 4 });
  const ns = big1.gateSpan();
  check('the gate moves to another side for free', moved && big1.rot === 2 && ns.y0 === big1.y0 && ns.x0 === (big1.tx + 4) * 8);

  // ---- Mixed flocks ----
  check('who gets along', BD.getsAlong('sheep', 'goat') && BD.getsAlong('duck', 'cow') && BD.getsAlong('cow', 'pony') && !BD.getsAlong('sheep', 'cow') && !BD.getsAlong('goat', 'pony'));
  const goat = new A.Animal('goat', 0, 0);
  const cow = new A.Animal('cow', 0, 0);
  check('sheep and goats share; cattle are refused', big1.hasRoomFor(goat) && !big1.hasRoomFor(cow));
  // A cow that slips in is not penned, and is put out when the gate shuts.
  big1.open = true; big1.swing = 1; big1.applyGate(g.map);
  cow.x = big1.cx; cow.y = big1.cy; cow.home = true;
  g.animals.push(cow);
  step(0.1);
  const cowPenned = cow.pen === big1;
  // The gate shuts behind a batch, as after a drive.
  big1.batch = [big1.animals[0]];
  big1.quietT = 1;
  step(0.6);
  check('a cow that slips in is not penned, and is put out as it shuts', !cowPenned && !big1.covers(cow.x, cow.y), { at: [Math.round(cow.x), Math.round(cow.y)] });
  // Goods by kind.
  big1.goods = 0; big1.goodsBy = {};
  const g1 = pen0('goat', big1, 9);
  g1.produceT = g1.sp.goodEvery - 0.001;
  const sh = big1.animals.filter((a) => a.sp.id === 'sheep')[0];
  big1.animals.forEach((a) => (a.produceT = 0));
  g1.produceT = g1.sp.goodEvery - 0.001;
  sh.produceT = sh.sp.goodEvery - 0.001;
  step(1 / 60);
  const want = Math.round((A.SPECIES ?? {}).x ?? 0);
  const value = E.penGoodsValue(g, big1);
  check('a mixed paddock keeps its goods by kind', big1.goodsBy.goat === 1 && big1.goodsBy.sheep === 1 && value === Math.round((6 + 4) * E.priceMult(g)), { goodsBy: big1.goodsBy, value, want });

  // ---- Fixtures ----
  const fx = big1.tx + 2, fy = big1.ty + 2;
  const okS = P.placeFixture(g, 'shelter', fx, fy);
  check('a field shelter inside makes it safe at night', okS && big1.has('shelter') && g.sheltered(big1) && solid(fx * 8 + 8, fy * 8 + 10));
  const need0 = Z.penHay(big1);
  P.placeFixture(g, 'hayrack', fx, fy + 4);
  check('a hay rack: a third less hay', big1.has('hayrack') && Z.penHay(big1) < need0, { without: need0, with: Z.penHay(big1) });
  const dupe = P.fixtureProblem(g, 'shelter', fx + 6, fy + 3).why;
  const outside = P.fixtureProblem(g, 'trough', 96, 104).why;
  check('one of each, and only inside a paddock', dupe === 'THIS PADDOCK HAS ONE' && outside === 'PLACE IT IN A PADDOCK', { dupe, outside });
  P.placeFixture(g, 'trough', fx + 7, fy);
  check('a trough placed where it was put', big1.hasTrough && big1.fixtures.some((f) => f.kind === 'trough' && f.tx === fx + 7));
  // A barn whose ring reaches only the gate still shelters a big paddock.
  const r2 = spot(12, 9, { side: 2, at: 1 });
  const other = r2 && P.placePaddock(g, r2, { side: 2, at: 1 });
  let barnOk = false;
  if (other) {
    const gp2 = other.gatePoint(0);
    const barn = B.makeBuilding(K.defOf('barn'), Math.round(gp2.x / 8) - 3, Math.round(gp2.y / 8) - 12, 0);
    g.ranch.buildings.push(barn);
    const dGate = Math.hypot(barn.cx - gp2.x, barn.cy - gp2.y), dMid = Math.hypot(barn.cx - other.cx, barn.cy - other.cy);
    barnOk = g.sheltered(other) && dMid > barn.shelterRadius && dGate <= barn.shelterRadius;
    g.ranch.buildings = g.ranch.buildings.filter((b) => b !== barn);
  }
  check("a barn's ring reaching a big paddock's gate shelters it", barnOk);

  // ---- Saves ----
  SV.saveGame(g);
  const saved = JSON.parse(localStorage.getItem('comeby-save-v1'));
  SV.loadInto(g);
  const back = g.ranch.pens.find((p) => p.w === big1.w && p.h === big1.h);
  check('a save keeps size, gate, fixtures and stock', back && back.rot === 2 && back.gateStart === 4 && back.has('shelter') && back.has('hayrack') && back.hasTrough && back.animals.length === big1.animals.length, { w: back?.w, h: back?.h, rot: back?.rot });
  // An old save: pens with no size, one upgraded, one with a trough.
  const old = JSON.parse(JSON.stringify(saved));
  old.buildings = old.buildings.filter((b) => b.kind !== 'pen');
  old.buildings.push({ kind: 'pen', tx: 104, ty: 93, rot: 0, level: 2, trough: true, goods: 3, animals: [{ id: 'sheep', coat: 0, stress: 0 }, { id: 'sheep', coat: 0, stress: 0 }] });
  old.buildings.push({ kind: 'pen', tx: 76, ty: 106, rot: 1, level: 1, trough: false, goods: 0, animals: [{ id: 'duck', coat: 0, stress: 0 }] });
  localStorage.setItem('comeby-save-v1', JSON.stringify(old));
  SV.loadInto(g);
  const [o1, o2] = g.ranch.pens;
  const g1x = o1 ? o1.gateSpan().x0 : -1;
  check("an old save's pens become paddocks with the same room, gate and stock", o1 && o1.w === 8 && o1.h === 7 && o1.capacity === 24 && o1.hasTrough && o1.animals.length === 2 && o1.goods === 3 && g1x === 107 * 8 && o2.w === 7 && o2.h === 8 && o2.capacity === 16 && o2.animals.length === 1, { o1: o1 && [o1.w, o1.h, o1.capacity, g1x], o2: o2 && [o2.w, o2.h, o2.capacity] });
  const value3 = E.penGoodsValue(g, o1);
  check("an old save's goods are still worth what they were", value3 === Math.round(3 * 4 * E.priceMult(g)), value3);

  // ---- Co-op: the guest's copy ----
  const sent = JSON.parse(JSON.stringify(SH.sharedOut(g)));
  o1.w = 20; o1.gateAt = 1;
  SH.sharedIn(g, sent);
  check("a guest is sent each paddock's size and gate", o1.w === 8 && o1.gateAt === null);
  return out;
});

let fails = 0;
for (const r of res) {
  if (!r.ok) fails++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info !== undefined ? `  ${typeof r.info === 'string' ? r.info : JSON.stringify(r.info)}` : ''}`);
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
await server.close();
process.exit(fails || errors.length ? 1 : 0);
