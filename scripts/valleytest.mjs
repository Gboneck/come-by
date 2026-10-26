// The valley grows, end to end: the village built step by step from what
// you do (one step a morning, in order), market day and the festival
// parade; an overgrown paddock grazed clear by a flock (and ducks or a
// stressed flock not grazing it), becoming land to build on; cattle hauling
// timber to mend the old bridge, and the ford easier to cross after; the
// shearing shed's chute, the dairy's morning milking and the agility
// yard's course; the valley in the save, old saves loading.
// Prints PASS/FAIL per check; exits 1 on a failure or console error.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.VALLEY_PORT || 5247);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  let s = 4242;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
await page.evaluate(() => localStorage.clear());

const res = await page.evaluate(async () => {
  const g = window.game;
  const out = [];
  const check = (name, ok, info) => out.push({ name, ok: !!ok, info });
  const V = await import('/src/systems/valley.ts');
  const F = await import('/src/systems/farmwork.ts');
  const VIL = await import('/src/ranch/village.ts');
  const B = await import('/src/ui/build.ts');
  const K = await import('/src/ranch/catalog.ts');
  const A = await import('/src/entities/animal.ts');
  const ST = await import('/src/ranch/structures.ts');
  const M = await import('/src/world/map.ts');
  const SV = await import('/src/systems/save.ts');
  const O = await import('/src/systems/orders.ts');
  const step = (s, input = { x: 0, y: 0, sprint: false, lie: false }) => {
    for (let i = 0; i < s * 60; i++) { g.input.override = input; g.update(1 / 60); }
    g.input.override = null;
  };
  const morning = (day) => { g.day.day = day - 1; g.startDay(); g.mode = 'play'; g.day.t = 30; };
  const add = (id, tx, ty, rot = 0) => { const b = B.makeBuilding(K.defOf(id), tx, ty, rot); g.ranch.add(b); return b; };
  const loose = (id, x, y, coat = 0) => { const a = new A.Animal(id, x, y, coat); a.home = true; g.animals.push(a); return a; };
  const clearStock = () => { g.animals = g.animals.filter((a) => a.pen && g.ranch.pens.includes(a.pen)); };
  g.tut = 99;
  g.setTier(5, false);
  g.coins = 5000;

  // ---- The village ----
  const vil = g.ranch.village;
  check('a new valley: the crossroads has only its well', vil.built.size === 0 && V.nextStep(g)?.id === 'cottage1');
  g.totals.orders = 1;
  morning(2);
  const solid = (p) => (g.map.flagsAtPx((p.tx + 1) * 8 + 2, (p.ty + p.h - 1) * 8 + 2) & M.SOLID) !== 0;
  const cot1 = VIL.PLOTS.find((p) => p.step === 'cottage1');
  check('first order filled: a cottage the next morning, solid, a newcomer', vil.has('cottage1') && solid(cot1) && g.valley.newcomer?.step === 'cottage1' && g.banner?.big?.includes('VILLAGE'), { banner: g.banner?.big });
  // Its family walks in up the road and finds the door.
  step(0.5);
  const fam = g.folk.people.filter((p) => p.id === 'cottager1' || p.id === 'cottager2');
  const road = VIL.SPOTS.road, door = VIL.doorOf(cot1);
  check('the newcomers walk in up the road', fam.length === 2 && fam.every((p) => Math.hypot(p.x - road.x, p.y - road.y) < 30), fam.map((p) => [Math.round(p.x), Math.round(p.y)]));
  let atDoor = 1e9;
  for (let i = 0; i < 40; i++) { step(1); atDoor = Math.min(atDoor, Math.max(...fam.map((p) => Math.hypot(p.x - door.x, p.y - door.y)))); }
  check('...and reach their cottage door', atDoor < 6, { atDoor: Math.round(atDoor) });
  // Everything else done at once: still one step a morning, in order.
  g.totals.orders = 4;
  g.totals.ribbons = [1, 0, 0];
  morning(3);
  const after3 = [...vil.built];
  morning(4);
  const after4 = [...vil.built];
  check('one step a morning, in order (the square before the hall)', after3.length === 2 && after3.includes('square') && after4.length === 3 && after4.includes('hall'), { after3, after4 });
  check('the smithy waits on cattle', !vil.has('smithy') && V.nextStep(g)?.id === 'cottage2', V.nextStep(g)?.id);

  // ---- Market day (the third of the season) ----
  morning(7); // spring day... 7 is summer day 3
  const ord = g.orders.forYard('drover');
  check('market day: the drover always has an order, at market prices', V.isMarketDay(g) && ord && ord.market, ord);
  if (ord) {
    const yard = g.ranch.yards.find((y) => y.site.id === 'drover');
    clearStock();
    const a = loose(ord.species, yard.pen.cx, yard.pen.cy);
    a.stress = a.peakStress = 0;
    const coins0 = g.coins;
    step(0.3);
    const want = Math.round(O.headPrice(ord.species, 0, false) * 1.5);
    check('a head delivered on market day pays half again', g.coins - coins0 === want, { paid: g.coins - coins0, want });
  }
  // Goods sell dearer.
  {
    const pen = g.ranch.pens[0];
    pen.species = 'duck';
    pen.goods = 10;
    const E = await import('/src/systems/economy.ts');
    const plain = E.penGoodsValue(g, pen);
    const sold = E.sellAllGoods(g).value;
    check('goods sell for a quarter more on market day', sold === Math.round(plain * 1.25), { plain, sold });
  }

  // ---- The festival parade (the last day of the season) ----
  morning(8);
  check('festival day with a hall', V.isFestival(g));
  clearStock();
  const flock = [0, 1, 2, 3, 4].map((i) => loose('sheep', VIL.ARCH.x + 12, VIL.ARCH.y0 + 6 + i * 3));
  const coinsP = g.coins;
  step(0.1);
  flock.forEach((a) => { a.x = VIL.ARCH.x - 12; });
  step(0.1);
  check('five sheep through the arch make a parade', g.valley.parades === 1 && g.valley.paradeDone && g.coins > coinsP, { parades: g.valley.parades, paid: g.coins - coinsP });
  step(0.3);
  const vill = () => g.folk.people.filter((p) => /^(smith|baker|grocer|weaver|warden|cottager\d)$/.test(p.id));
  check('the village turns out and cheers a parade', vill().filter((p) => p.shown).length >= 3 && vill().some((p) => p.pose === 'wave'), vill().map((p) => `${p.id}:${p.shown ? p.pose : 'in'}`).join(' '));
  // Night: everyone indoors but the warden, round the green with a lantern.
  g.day.startNight();
  g.quietT = -1e9; // (a night with no visitors ends early; hold it)
  step(12);
  check('at night the villagers are indoors, the warden out with a lantern', vill().every((p) => !p.shown || (p.id === 'warden' && p.lantern)) && vill().some((p) => p.id === 'warden' && p.shown), `${g.mode} ${g.day.nightT.toFixed(1)}: ${vill().map((p) => `${p.id}:${p.shown ? p.pose : 'in'}`).join(' ')}`);
  g.day.nightT = 30;
  step(8);
  check('...and the warden goes in too', vill().every((p) => !p.shown), vill().filter((p) => p.shown).map((p) => `${p.id} ${Math.round(p.x)},${Math.round(p.y)} home ${Math.round(p.home.x)},${Math.round(p.home.y)} ${p.pose} walkT ${p.walkT.toFixed(1)} nightT ${g.day.nightT.toFixed(1)} ${g.day.phase} ${g.mode}`).join(' '));
  g.day.phase = 'day';
  g.day.nightT = 0;

  // ---- Fields past the clearing ----
  const v = g.valley;
  const sw = v.fields[0];
  const t0 = sw.tiles[Math.floor(sw.tiles.length / 2)], tx = t0 % 192, ty = Math.floor(t0 / 192);
  check('fields are for sale: not land to build on yet', sw.tiles.length > 60 && v.landAt(tx, ty) === false && !g.build.buildable(g, tx, ty) && v.landAt(96, 104) === null, { tiles: sw.tiles.length });
  g.dog.x = sw.mouth.x; g.dog.y = sw.mouth.y;
  const coinsF = g.coins;
  V.buyField(g);
  check('nip at its sign: the field is bought, yours to fence', sw.owned && g.coins === coinsF - sw.site.price && g.build.buildable(g, tx, ty), { price: sw.site.price });
  check('under scrub it takes paddocks and fences, nothing else yet', g.ranch.placementProblem('pen', tx, ty, 1, 1, 0) !== 'GRAZE THIS FIELD CLEAR FIRST' && g.ranch.placementProblem('kennel', tx, ty, 3, 3, 0) === 'GRAZE THIS FIELD CLEAR FIRST');
  // Ducks and a frightened flock do not graze it.
  morning(9);
  clearStock();
  const c = { x: tx * 8 + 4, y: ty * 8 + 4 };
  for (let i = 0; i < 8; i++) loose('duck', c.x + (i % 4) * 5, c.y + Math.floor(i / 4) * 5);
  step(10, { x: 0, y: 0, sprint: false, lie: true });
  const afterDucks = v.left(sw);
  clearStock();
  const scared = [0, 1, 2, 3, 4, 5].map((i) => { const a = loose('sheep', c.x + i * 5, c.y); a.stress = 0.9; return a; });
  step(3);
  check('ducks do not eat scrub, nor does a frightened flock', afterDucks === 1 && v.left(sw) > 0.995, { ducks: afterDucks, scared: +v.left(sw).toFixed(3) });
  // Eight calm sheep grazing in it, the dog lying at its mouth.
  clearStock();
  scared.forEach((a) => (a.gone = true));
  const sheep = [];
  for (let i = 0; i < 8; i++) sheep.push(loose('sheep', c.x + (i % 4) * 6 - 9, c.y + Math.floor(i / 4) * 6));
  g.dog.x = sw.mouth.x; g.dog.y = sw.mouth.y - 10;
  let secs = 0;
  const half = [];
  while (!sw.cleared && secs < 600) {
    g.day.t = Math.min(g.day.t, 150);
    step(5, { x: 0, y: 0, sprint: false, lie: true });
    secs += 5;
    if (secs % 60 === 0) half.push(+(1 - v.left(sw)).toFixed(2));
  }
  const inside = sheep.filter((a) => v.fieldAt(a.x, a.y) === sw).length;
  check('a flock left to graze in it eats it down (some of it in a minute)', half[0] > 0.05, { grazedByMinute: half });
  // A player moves the flock round; here we help it along: finish the job.
  if (!sw.cleared) {
    sw.scrub.fill(0.05);
    step(0.2);
  }
  check('grazed down: the field is clear, anything can be built on it', sw.cleared && v.landAt(tx, ty) === true && g.ranch.placementProblem('kennel', tx, ty, 3, 3, 0) !== 'GRAZE THIS FIELD CLEAR FIRST', { secs, inside });
  morning(10);
  check('a cleared field brings the second cottage', vil.has('cottage2'));
  // Stock penned in a paddock on a field grazes it too.
  const se = v.fields[1];
  g.coins += 1000;
  g.dog.x = se.mouth.x; g.dog.y = se.mouth.y;
  V.buyField(g);
  const P = await import('/src/ranch/paddock.ts');
  const st = se.tiles.map((i) => ({ x: i % 192, y: Math.floor(i / 192) }));
  const x0 = Math.min(...st.map((t) => t.x)) + 2, y0 = Math.min(...st.map((t) => t.y)) + 1;
  let fieldPen = null;
  for (let dy = 0; dy < 4 && !fieldPen; dy++)
    for (let dx = 0; dx < 8 && !fieldPen; dx++) fieldPen = P.buildPaddock(g, { tx: x0 + dx, ty: y0 + dy, w: 8, h: 7 }, { side: 2, at: 3 });
  const left0 = v.left(se);
  if (fieldPen) for (let i = 0; i < 6; i++) { const a = new A.Animal('goat', fieldPen.cx + (i % 3) * 8 - 8, fieldPen.cy + Math.floor(i / 3) * 8 - 4); a.home = true; a.pen = fieldPen; fieldPen.animals.push(a); g.animals.push(a); }
  step(20, { x: 0, y: 0, sprint: false, lie: true });
  check('goats penned in a paddock on a field graze it down', fieldPen && v.left(se) < left0 - 0.02, { placed: !!fieldPen, before: +left0.toFixed(2), after: +v.left(se).toFixed(2) });

  // ---- The old bridge ----
  clearStock();
  const pile = V.woodpile(), land = V.bridgeLanding(g);
  const cow = loose('cow', pile.x + 4, pile.y);
  step(0.2);
  check('no smithy, no yoke: a cow at the woodpile takes no log', !cow.load);
  vil.built.add('smithy');
  g.ranch.restamp();
  step(0.2);
  check('with the smithy: a cow through the woodpile picks up a log', cow.load === 'log');
  const bx = Math.floor(land.x / 8) + 3, by = Math.floor(land.y / 8);
  const shallow = () => (g.map.flagsAtPx(bx * 8 + 4, by * 8 + 4) & M.SHALLOW) !== 0;
  const fordShallow = () => (g.map.flagsAtPx(bx * 8 + 4, (M.FORD_Y0 + 1) * 8 + 4) & M.SHALLOW) !== 0;
  check('before mending, the ford under the bridge is shallow water', shallow() && fordShallow());
  for (let i = 0; i < V.BRIDGE_LOGS; i++) {
    cow.x = pile.x; cow.y = pile.y;
    step(0.1);
    cow.x = land.x; cow.y = land.y;
    step(0.1);
  }
  check('six logs mend the old bridge: dry going on it, the rest of the ford still wet', v.bridge && v.logs === V.BRIDGE_LOGS && !shallow() && fordShallow(), { logs: v.logs });
  // Cattle driven over the river: the bridge against the ford.
  const crossing = async (bridge) => {
    g.map.setBridge(bridge);
    const r = [];
    for (let i = 0; i < 2; i++) {
      window.resetFlock('cow', land.x - 50, land.y, 4, land.x - 110, land.y);
      r.push(window.sim({ goalX: land.x + 80, goalY: land.y, nip: true }, 90));
    }
    return { home: r.filter((x) => x.reached).length, t: +(r.reduce((s, x) => s + x.seconds, 0) / r.length).toFixed(1) };
  };
  const wet = await crossing(false), dry = await crossing(true);
  check('cattle cross quicker on the mended bridge than through the ford', dry.home >= wet.home && dry.t < wet.t, { ford: wet, bridge: dry });
  g.map.setBridge(true);

  // ---- The shearing shed ----
  morning(11); // summer... day 11 is autumn day 3; the shed only shears in summer
  clearStock();
  const shed = add('shed', 100, 109);
  const inLane = (a) => { const l = shed.lane; a.x = (shed.shearX0 + shed.shearX1) / 2; a.y = (l.y0 + l.y1) / 2; };
  const ewe = loose('sheep', 0, 0);
  inLane(ewe);
  step(0.1);
  check('out of summer the shed shears nobody', ewe.shorn !== g.season.year);
  morning(5 + 16); // summer, year 2
  clearStock();
  const ewes = [0, 1, 2].map(() => loose('sheep', 0, 0));
  const coinsS = g.coins;
  ewes.forEach((a, i) => { inLane(a); a.x += (i - 1) * 8; a.stress = a.peakStress = 0; });
  step(0.1);
  check('in summer, sheep in the chute are shorn for a wool bonus', ewes.every((a) => a.shorn === g.season.year) && g.coins - coinsS === 3 * Math.round(F.SHED_PAY * 1.5), { paid: g.coins - coinsS });
  // A calm walk along the chute with the herding bot.
  clearStock();
  const walkers = [];
  for (let i = 0; i < 5; i++) walkers.push(loose('sheep', shed.x0 - 30 - (i % 3) * 6, (shed.lane.y0 + shed.lane.y1) / 2 + (Math.floor(i / 3) - 0.5) * 8));
  g.dog.x = shed.x0 - 70; g.dog.y = (shed.lane.y0 + shed.lane.y1) / 2;
  window.sim({ goalX: shed.x1 + 40, goalY: (shed.lane.y0 + shed.lane.y1) / 2 }, 60);
  const thru = walkers.filter((a) => a.shorn === g.season.year).length;
  check('a calm drive walks a small flock along the chute: most are shorn', thru >= 3, { shorn: thru, of: walkers.length });

  // ---- The dairy ----
  morning(12 + 16); // autumn day 4, year 2: mornings
  clearStock();
  const dairy = add('dairy', 88, 108);
  step(0.5);
  check('the dairy yard opens in the morning', dairy.yard.open);
  const cows = [0, 1].map((i) => loose('cow', dairy.yard.cx - 6 + i * 12, dairy.yard.cy));
  cows.forEach((a) => (a.stress = a.peakStress = 0));
  const coinsD = g.coins;
  step(4);
  check('cows walked into the yard are milked: calm ones for half again', cows.every((a) => a.milkedDay === g.day.day) && g.coins - coinsD === 2 * Math.round(F.MILK_PAY * 1.5), { paid: g.coins - coinsD });
  step(3);
  check('then let back out of the gate, to be walked home', cows.every((a) => !a.pen) && dairy.yard.animals.length === 0);
  cows.forEach((a) => { a.x = dairy.yard.cx; a.y = dairy.yard.cy; });
  step(0.5);
  check('once a day: a milked cow is not taken in again', cows.every((a) => !a.pen));
  cows.forEach((a) => { a.x = dairy.x1 + 40; a.y = dairy.y1 + 20; });
  g.day.t = O.hourToT(13);
  step(1);
  check('the yard shuts after noon', !dairy.yard.open || dairy.yard.swing < 0.5);

  // ---- The agility yard ----
  morning(13 + 16);
  clearStock();
  const ag = add('agility', 74, 106);
  const at = (p) => ag.at(p);
  const post = at({ x: 16, y: 52 });
  const route = [post, at({ x: 24, y: 47 }), at({ x: 36, y: 47 }), at({ x: 83, y: 47 }), at({ x: 83, y: 28 }), at({ x: 86, y: 16 }), at({ x: 50, y: 16 }), at({ x: 24, y: 16 }), at({ x: 14, y: 30 }), post];
  const runCourse = (speed, wobble = 0) => {
    g.dog.x = post.x; g.dog.y = post.y + 4;
    F.startAgility(g);
    let i = 1;
    for (let k = 0; k < 60 * 30 && g.farmwork.run && i < route.length; k++) {
      const to = route[i];
      const dx = to.x - g.dog.x, dy = to.y + (i === route.length - 1 ? 4 : 0) - g.dog.y, d = Math.hypot(dx, dy);
      if (d < 2) { i++; continue; }
      const s = Math.min(d, speed / 60);
      g.dog.x += (dx / d) * s;
      g.dog.y += (dy / d) * s + (wobble ? Math.sin(k / 3) * wobble : 0);
      g.dog.vx = g.dog.vy = 0;
      g.input.override = { x: 0, y: 0, sprint: false, lie: false };
      g.update(1 / 60);
    }
    g.input.override = null;
    return g.farmwork.result;
  };
  const sp0 = g.upgrades.speed, st0 = g.upgrades.stamina;
  const r1 = runCourse(70);
  check('a quick clean run round the course', r1 && r1.clean && r1.faults === 0, r1);
  const marks1 = { ...g.farmwork.marks };
  const r2 = runCourse(70);
  check('one clean run a day counts for training', r2?.clean && JSON.stringify(g.farmwork.marks) === JSON.stringify(marks1), { marks: g.farmwork.marks });
  const slow = runCourse(18);
  check('too slow is not clean', slow && !slow.clean && slow.faults === 0, slow);
  morning(14 + 16);
  runCourse(70);
  morning(15 + 16);
  runCourse(70);
  check('three clean days: a free level of training', g.upgrades.speed + g.upgrades.stamina === sp0 + st0 + 1, { speed: g.upgrades.speed, stamina: g.upgrades.stamina });
  // Brushing a pole on the way round is a fault.
  g.dog.x = post.x; g.dog.y = post.y + 4;
  F.startAgility(g);
  const pole = ag.poles()[0];
  g.dog.x = pole.x - 3.5; g.dog.y = pole.y;
  step(0.05);
  const faults = g.farmwork.run?.faults ?? -1;
  g.farmwork.run = null;
  check('brushing a pole is a fault', faults === 1, faults);

  // ---- Save and load ----
  se.scrub.fill(0.5);
  v.logs = V.BRIDGE_LOGS;
  SV.saveGame(g);
  const raw = localStorage.getItem('comeby-save-v1');
  const before = { built: [...vil.built].sort().join(','), se: v.left(se), sw: sw.cleared, bridge: v.bridge, marks: JSON.stringify(g.farmwork.marks), clean: g.farmwork.cleanRuns };
  vil.built.clear();
  se.scrub.fill(1);
  v.bridge = false;
  g.map.setBridge(false);
  SV.loadInto(g);
  const after = { built: [...vil.built].sort().join(','), se: v.left(se), sw: sw.cleared, bridge: v.bridge, marks: JSON.stringify(g.farmwork.marks), clean: g.farmwork.cleanRuns };
  check('the valley comes back from a save', JSON.stringify(before) === JSON.stringify(after) && !shallow(), { before, after });
  const old = JSON.parse(raw);
  delete old.valley;
  delete old.farmwork;
  old.buildings = old.buildings.filter((b) => !['shed', 'dairy', 'agility'].includes(b.kind));
  localStorage.setItem('comeby-save-v1', JSON.stringify(old));
  SV.loadInto(g);
  check('an old save loads: no village yet, paddocks overgrown, the bridge broken', vil.built.size === 0 && v.fields.every((p) => !p.cleared && p.scrub[0] === 1) && !v.bridge && shallow(), { built: vil.built.size });
  // Co-op: what a guest is sent puts the valley back the same way.
  vil.built.add('cottage1');
  v.logs = 2;
  const sent = JSON.parse(JSON.stringify(V.valleyShared(g)));
  vil.built.clear();
  v.logs = 0;
  V.valleyApply(g, sent);
  check('a guest is sent the village, the paddocks and the bridge', vil.has('cottage1') && v.logs === 2);
  void ST;
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
