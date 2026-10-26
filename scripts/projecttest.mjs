// Valley projects, end to end (src/systems/projects.ts): they open by tier,
// place and season; a flock held calmly on a patch grazes it clear (a
// rattled one does not), driven there by the herding bot; loads are picked
// up at a pile, dropped by an animal that panics and counted at the site;
// each project, done, changes its place (props, walls, the fold's gate,
// ring stones) and brings what it says: hay in the loft, an orchard flock,
// daily wild goats, a waystation and fold, the mill's share of the goods,
// midsummer's double pay. It all survives a save, an old save starts with
// nothing, and a guest's copy matches the host's.
//   node scripts/projecttest.mjs   (exits 1 on a failed check)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PROJECT_PORT || 5217);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  let s = 7;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  window.requestAnimationFrame = () => 0; // no live loop: every frame here is stepped by hand
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.evaluate(() => localStorage.clear());
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};

// Shared helpers inside the page.
await page.evaluate(() => {
  window.T = {
    step(n) { for (let i = 0; i < n; i++) window.game.update(1 / 60); },
    solidAt(x, y) { return (window.game.map.cell(Math.floor(x / 4), Math.floor(y / 4)) & 1) !== 0; },
    clear() {
      const g = window.game;
      g.animals.length = 0;
      g.predators.length = 0;
      g.mode = 'play';
      g.day.phase = 'day';
      g.day.t = 30;
      g.tip = null;
    },
    async flock(sp, x, y, n, coat = 0) {
      const { Animal } = await import('/src/entities/animal.ts');
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = new Animal(sp, x + ((i % 3) - 1) * 9, y + (Math.floor(i / 3) - 1) * 9, coat);
        a.wanderer = false;
        window.game.animals.push(a);
        out.push(a);
      }
      return out;
    },
    park(x = 760, y = 860) { const d = window.game.dog; d.x = x; d.y = y; d.vx = d.vy = 0; },
  };
});

// ---- A new game, and opening by tier, place and season ----
const opening = await page.evaluate(async () => {
  const g = window.game;
  const P = g.projects;
  const { PROJECTS } = await import('/src/systems/projects.ts');
  const why = () => Object.fromEntries(PROJECTS.map((p) => [p.id, P.open(g, p).why || 'open']));
  const t1 = why();
  g.setTier(2, false);
  const t2 = why();
  g.discovery.found.add('willow');
  g.discovery.found.add('orchard');
  const t2found = why();
  g.season.set('winter');
  const winter = why();
  g.season.set('spring');
  return { t1, t2, t2found, winter, done: P.done.size };
});
check('new game: nothing done', opening.done === 0);
check('tier 1: every project waits on its tier', Object.values(opening.t1).every((w) => w.startsWith('AT TIER')), JSON.stringify(opening.t1));
check('tier 2: the reed bed and orchard want finding first', opening.t2.reeds === 'FIND WILLOW POOL' && opening.t2.orchard === 'FIND THE OLD ORCHARD', JSON.stringify(opening.t2));
check('found: both open in spring; winter shuts them', opening.t2found.reeds === 'open' && opening.t2found.orchard === 'open' && opening.winter.reeds.startsWith('IN ') && opening.winter.orchard.startsWith('IN '), `${JSON.stringify(opening.t2found)} winter ${JSON.stringify(opening.winter)}`);

// ---- Grazing: ducks driven into Willow Pool by the bot, then held ----
const reeds = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  T.clear();
  g.tut = 99;
  // A rattled flock does no work.
  // (The pool is sweet grass too, so they settle there: keep them rattled.)
  const rattled = await T.flock('duck', 1468, 840, 6);
  T.park(1300, 900);
  for (let i = 0; i < 120; i++) {
    for (const a of rattled) a.stress = 0.7;
    T.step(1);
  }
  const rattledWork = P.grazed.reeds ?? 0;
  T.clear();
  // Drive six ducks from the meadow's east edge through the gap into the pool.
  await T.flock('duck', 1330, 840, 6);
  T.park(1290, 830);
  const drive = window.sim({ goalX: 1462, goalY: 836 }, 90, 20);
  const afterDrive = P.frac('reeds');
  // Hold them: lie down at the mouth of the gap.
  T.park(1420, 836);
  let t = 0;
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  while (!P.isDone('reeds') && t < 150) { T.step(30); t += 0.5; }
  g.input.override = null;
  return { rattledWork, drive, afterDrive, held: t, done: P.isDone('reeds'), hay: T.solidAt(1458, 863), banner: g.banner?.big, justDone: !!P.justDone };
});
check('rattled ducks do no work on the reed bed', reeds.rattledWork === 0, `${reeds.rattledWork}`);
check('the bot drives six ducks into Willow Pool', reeds.drive.reached, JSON.stringify(reeds.drive));
check('held there calmly, the reed bed is cleared', reeds.done && reeds.held > 20 && reeds.held < 120, `held ${reeds.held}s`);
check('done: banner, the hayrick stands (solid)', reeds.banner === 'THE REED BED IS CLEAR' && reeds.hay && reeds.justDone, `banner=${reeds.banner}`);

// ---- What it brings: 8 more bales in the loft each autumn ----
const hay = await page.evaluate(() => {
  const g = window.game, T = window.T;
  T.clear();
  // The morning before autumn's first day, then that morning.
  g.day.day = 8; // summer, day 4
  g.startDay();
  return { season: g.season.season, dayOf: g.season.dayOf, loft: g.seasonal.loft };
});
check('autumn day one: the loft holds 10 + 8 bales', hay.season === 'autumn' && hay.dayOf === 1 && hay.loft === 18, JSON.stringify(hay));

// ---- The orchard (any kind grazes, at the paddocks' rates) and its flock ----
const orchard = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  T.clear();
  g.season.set('spring');
  g.discovery.found.add('orchard');
  await T.flock('sheep', 1414, 1062, 8);
  T.park(1300, 1000);
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  let t = 0;
  while (!P.isDone('orchard') && t < 200) { T.step(30); t += 0.5; }
  g.input.override = null;
  const took = t;
  // Next morning: sheep on the pasture.
  T.clear();
  g.day.day = 9; // autumn
  g.startDay();
  const orch = (await import('/src/world/places.ts')).placeById('orchard');
  const { inPlace } = await import('/src/world/places.ts');
  const there = g.animals.filter((a) => a.sp.id === 'sheep' && inPlace(orch, a.x, a.y, 1.2)).length;
  return { took, done: P.isDone('orchard'), there };
});
check('eight sheep graze the orchard clear in about 90s', orchard.done && orchard.took > 60 && orchard.took < 130, `${orchard.took}s`);
check('the next morning a flock grazes the orchard', orchard.there >= 5, `${orchard.there} sheep`);

// ---- The Hidden Valley's scrub, then its goats every day ----
const scrub = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  T.clear();
  g.setTier(3, false);
  g.season.set('summer');
  g.discovery.found.add('valley');
  await T.flock('goat', 76, 672, 5);
  T.park(160, 640);
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  let t = 0;
  while (!P.isDone('scrub') && t < 200) { T.step(30); t += 0.5; }
  g.input.override = null;
  const took = t;
  // Two mornings running, each with the valley empty: goats both times.
  const goats = [];
  for (const day of [10, 11]) {
    T.clear();
    for (const a of [...g.discovery.tracked.keys()]) g.discovery.tracked.delete(a);
    g.day.day = day - 1;
    g.startDay();
    goats.push([...g.discovery.tracked.values()].filter((id) => id === 'valley').length);
  }
  return { took, done: P.isDone('scrub'), goats };
});
check('five goats browse the scrub back in about a minute', scrub.done && scrub.took > 40 && scrub.took < 110, `${scrub.took}s`);
check('then wild goats come back every day, seven of them', scrub.goats[0] === 7 && scrub.goats[1] === 7, JSON.stringify(scrub.goats));

// ---- Hauling slate to the Shepherd's Hut ----
const hut = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  const { loaded } = await import('/src/systems/projects.ts');
  T.clear();
  g.discovery.found.add('hut');
  g.discovery.keepsakes.delete('crook');
  const before = { wall: T.solidAt(258, 630), hut: T.solidAt(270, 645) };
  // Six goats walk past the quarry's pile: five slates, one goat goes empty.
  const goats = await T.flock('goat', 452, 548, 6);
  T.park(400, 600);
  for (const a of goats) { a.x = 452 + (Math.random() - 0.5) * 12; a.y = 546; }
  T.step(2);
  const carrying = goats.filter((a) => loaded.has(a)).length;
  const pileLeft = P.atPile('hut', 0);
  // One panics on the way and drops its slate: back on the pile.
  const scared = goats.find((a) => loaded.has(a));
  scared.panicT = 1;
  T.step(1);
  const dropped = !loaded.has(scared) && P.atPile('hut', 0) === 1;
  scared.panicT = 0;
  scared.stress = 0;
  // The rest arrive at the hut's door.
  for (const a of goats) if (loaded.has(a)) { a.x = 272; a.y = 680; }
  T.step(2);
  const got = P.delivered('hut');
  // The dropped one: picked up again and brought.
  scared.x = 452; scared.y = 546;
  T.step(2);
  scared.x = 272; scared.y = 680;
  T.step(2);
  return { before, carrying, pileLeft, dropped, got, done: P.isDone('hut'), after: { hut: T.solidAt(270, 645) }, crook: g.discovery.keepsakes.has('crook') };
});
check('five goats take a slate each from the pile, one goes empty', hut.carrying === 5 && hut.pileLeft === 0, JSON.stringify(hut));
check('a goat that panics drops its slate back on the pile', hut.dropped);
check('slates counted at the hut; the fifth mends it', hut.got === 4 && hut.done, `got ${hut.got}`);
check('mended: the hut is a building now, the crook turned up', !hut.before.hut && hut.after.hut && hut.crook);

const fold = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  const { FOLD_GATE } = await import('/src/systems/projects.ts');
  const { gateAction } = await import('/src/systems/orders.ts');
  T.clear();
  const open0 = T.solidAt(FOLD_GATE.x, FOLD_GATE.y - 1);
  T.park(FOLD_GATE.x, FOLD_GATE.y + 6);
  const acted = gateAction(g);
  const shut = P.foldShut && T.solidAt(FOLD_GATE.x, FOLD_GATE.y - 1);
  gateAction(g);
  const reopened = !P.foldShut && !T.solidAt(FOLD_GATE.x, FOLD_GATE.y - 1);
  // The waystation: lying down by the hut rests the dog.
  T.park(266, 690);
  g.dog.lying = true;
  const rests = g.canRest();
  T.park(200, 600);
  const notHere = g.canRest();
  g.dog.lying = false;
  return { open0, acted, shut, reopened, rests, notHere };
});
check('E at the fold gate shuts it (solid) and opens it again', !fold.open0 && fold.acted && fold.shut && fold.reopened, JSON.stringify(fold));
check('the waystation: lying down by the hut rests the dog', fold.rests && !fold.notHere);

// ---- Puddling the mill pond: cattle standing in the water ----
const mill = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  T.clear();
  g.setTier(4, false);
  g.season.set('summer');
  g.discovery.found.add('falls');
  // On the dry bank inside the zone: no work.
  const dry = await T.flock('cow', 470, 690, 3);
  T.park(470, 760);
  T.step(120);
  const dryWork = P.grazed.mill ?? 0;
  const dryInWater = dry.some((a) => a.inWater);
  T.clear();
  // In the pool's shallows.
  const wet = await T.flock('cow', 420, 664, 4);
  const cells = [[419, 664], [452, 658], [444, 676], [444, 684]];
  wet.forEach((a, i) => { a.x = cells[i][0]; a.y = cells[i][1]; });
  T.park(470, 720);
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  let t = 0, inWater = 0;
  while (!P.isDone('mill') && t < 200) {
    for (const a of wet) if (!a.inWater) { a.x = cells[wet.indexOf(a)][0]; a.y = cells[wet.indexOf(a)][1]; a.commitT = 1; } // keep them nipped in
    T.step(30);
    t += 0.5;
    inWater = wet.filter((a) => a.inWater).length;
  }
  g.input.override = null;
  // The mill's share: goods sell for a quarter more.
  T.clear();
  const pen = g.ranch.pens[0];
  pen.species = 'duck';
  pen.goods = 40;
  const { penGoodsValue } = await import('/src/systems/economy.ts');
  const sale = penGoodsValue(g, pen);
  const c0 = g.coins;
  g.endDay();
  const earned = g.coins - c0;
  return { dryWork, dryInWater, took: t, done: P.isDone('mill'), inWater, earned, sale };
});
check('cattle on the dry bank puddle nothing', mill.dryWork === 0 && !mill.dryInWater, JSON.stringify(mill));
check('four cattle held in the pool puddle it in about a minute', mill.done && mill.took > 40 && mill.took < 110, `${mill.took}s`);
check('the mill: the day\'s goods sell for a quarter more', mill.sale > 0 && mill.earned === mill.sale + Math.round(mill.sale * 0.25), `goods ${mill.sale}, earned ${mill.earned}`);

// ---- The stone circle: ponies bring the fallen stones back ----
const circle = await page.evaluate(async () => {
  const g = window.game, P = g.projects, T = window.T;
  const { loaded } = await import('/src/systems/projects.ts');
  const { WORKS } = await import('/src/world/places.ts');
  g.mode = 'play';
  T.clear();
  g.setTier(5, false);
  g.discovery.found.add('circle');
  const stones = WORKS.filter((p) => p.kind === 'fieldstone');
  const ringBefore = [[1495, 345], [1458, 362]].map(([x, y]) => T.solidAt(x, y));
  const ponies = await T.flock('pony', 1044, 404, 4);
  T.park(900, 300);
  const raised = [];
  stones.forEach((s, i) => { ponies[i].x = s.x; ponies[i].y = s.y; });
  T.step(2);
  const carrying = ponies.filter((a) => loaded.has(a)).length;
  for (const a of ponies) {
    a.x = 1468; a.y = 340;
    T.step(2);
    raised.push(P.delivered('circle'));
    a.x = 1300; a.y = 300; // out of the ring again
  }
  // Midsummer: summer's second day.
  T.clear();
  g.season.set('summer');
  g.season.dayOf = 2;
  const mid = P.isMidsummer(g);
  const sheep = await T.flock('sheep', 1468, 340, 3);
  T.park(1300, 420);
  T.step(10);
  const { blessed } = await import('/src/systems/projects.ts');
  const blessedN = sheep.filter((a) => blessed.has(a)).length;
  const pen = g.ranch.pens[0];
  pen.species = null;
  pen.animals.length = 0;
  const c0 = g.coins;
  sheep[0].x = pen.cx; sheep[0].y = pen.cy; sheep[0].peakStress = 0;
  T.step(3);
  const paid = g.coins - c0, value = sheep[0].deliveryValue;
  return { carrying, raised, done: P.isDone('circle'), ringBefore, mid, blessedN, paid, value };
});
check('four ponies each take a fallen stone', circle.carrying === 4, JSON.stringify(circle));
check('each stone brought raises one in the ring; the fourth finishes it', JSON.stringify(circle.raised) === '[1,2,3,4]' && circle.done);
check('midsummer: flocks in the ring are blessed and pay double', circle.mid && circle.blessedN === 3 && circle.paid === circle.value * 2 && circle.value > 0, `paid ${circle.paid} value ${circle.value}`);

// ---- The Ledger's valley list, and its map ----
mkdirSync('shots', { recursive: true });
const ledger = await page.evaluate(async () => {
  const g = window.game;
  const { projectLines } = await import('/src/ui/discovery.ts');
  // A fresh-ish ranch for the picture: tier 3, two done, one under way.
  for (const id of ['orchard', 'scrub', 'hut', 'mill', 'circle']) g.projects.done.delete(id);
  g.projects.grazed.orchard = 0;
  g.projects.deliveredFrom = {};
  g.setTier(3, false);
  g.projects.grazed.scrub = 5;
  g.season.set('summer');
  g.map.setProjects(g.projects);
  g.mode = 'ledger';
  return projectLines(g, 200).map((l) => l.s);
});
check('the Ledger lists the valley', ledger[0] === 'VALLEY PROJECTS 1/6' && ledger.some((l) => l.startsWith('HIDDEN VALLEY SCRUB: 41% BROWSED')) && ledger.some((l) => l.startsWith('NEXT, THE MILL POND: AT TIER 4')), JSON.stringify(ledger));
await page.evaluate(() => window.game.render());
await page.screenshot({ path: 'shots/projects-ledger.png' });

// ---- Save, continue, an old save, and a guest's copy ----
const saved = await page.evaluate(async () => {
  const S = await import('/src/systems/save.ts');
  const { Game } = await import('/src/game.ts');
  const g = window.game;
  g.mode = 'play';
  g.projects.done.add('hut');
  g.projects.foldShut = true;
  g.map.setProjects(g.projects);
  const before = JSON.stringify(g.projects.save());
  S.saveGame(g);
  const n = new Game(g.screen, g.input, {});
  S.loadInto(n);
  const after = JSON.stringify(n.projects.save());
  const gateSolid = (n.map.cell(Math.floor(313 / 4), Math.floor(675 / 4)) & 1) !== 0;
  // An old save: no projects at all.
  const k = 'comeby-save-v1';
  const d = JSON.parse(localStorage.getItem(k));
  delete d.projects;
  localStorage.setItem(k, JSON.stringify(d));
  const o = new Game(g.screen, g.input, {});
  S.loadInto(o);
  const oldHut = (o.map.cell(Math.floor(270 / 4), Math.floor(645 / 4)) & 1) !== 0;
  // A guest's copy, through the shared state.
  const { sharedIn, sharedOut } = await import('/src/net/shared.ts');
  const guest = new Game(g.screen, g.input, {});
  sharedIn(guest, JSON.parse(JSON.stringify(sharedOut(g))));
  const same = JSON.stringify(guest.projects.save().done.sort()) === JSON.stringify(g.projects.save().done.sort()) && guest.projects.foldShut;
  const guestGate = (guest.map.cell(Math.floor(313 / 4), Math.floor(675 / 4)) & 1) !== 0;
  return { same0: before === after, gateSolid, oldDone: o.projects.done.size, oldHut, same, guestGate };
});
check('a save keeps every project as it was', saved.same0 && saved.gateSolid);
check('an old save starts with no project done (the hut still a ruin)', saved.oldDone === 0 && !saved.oldHut);
check('a guest\'s copy matches, walls and gate included', saved.same && saved.guestGate);

if (errors.length) { console.log('ERRORS', errors); failed++; }
await browser.close();
await server.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
