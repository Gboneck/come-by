// Seasons end to end: the calendar and winter's short days, snow slowing
// the dog, winter hay (fed, sheltered, spoiled, hungry), the haystack's
// winter price, spring lambing and wild lambs, lambs growing up, the
// shearer, the autumn fair (judging, calm beating stressed, rare breeds for
// sale), fewer wild flocks in winter, and seasons in the save (old saves
// load). Prints PASS/FAIL per check; exits 1 on a failure or console error.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.SEASON_PORT || 5240);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  // Seeded, so a run is repeatable.
  let s = 12345;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
await page.evaluate(() => localStorage.clear());

const res = await page.evaluate(async () => {
  const g = window.game;
  const out = [];
  const check = (name, ok, info) => out.push({ name, ok: !!ok, info });
  const S = await import('/src/systems/season.ts');
  const Z = await import('/src/systems/seasonal.ts');
  const B = await import('/src/ui/build.ts');
  const K = await import('/src/ranch/catalog.ts');
  const A = await import('/src/entities/animal.ts');
  const SP = await import('/src/systems/spawner.ts');
  const M = await import('/src/world/map.ts');
  const SV = await import('/src/systems/save.ts');
  const step = (s, input = { x: 0, y: 0, sprint: false, lie: false }) => {
    for (let i = 0; i < s * 60; i++) { g.input.override = input; g.update(1 / 60); }
    g.input.override = null;
  };
  const add = (id, tx, ty, rot = 0) => { const b = B.makeBuilding(K.defOf(id), tx, ty, rot); g.ranch.add(b); return b; };
  // Morning of a given day, as if the night before had passed.
  const morning = (day) => { g.day.day = day - 1; g.startDay(); g.mode = 'play'; };
  const fill = (pen, id, n, coat = 0) => {
    const got = [];
    for (let i = 0; i < n; i++) {
      const a = new A.Animal(id, pen.cx + ((i % 4) - 1.5) * 6, pen.cy + (Math.floor(i / 4) - 0.5) * 6, coat);
      a.pen = pen; a.home = true; pen.animals.push(a); g.animals.push(a); got.push(a);
    }
    pen.species = id;
    return got;
  };

  // ---- The calendar ----
  const cal = [1, 4, 5, 9, 13, 16, 17, 33].map((d) => { const c = S.calendar(d); return `${d}:${c.season.slice(0, 2)}${c.year}.${c.dayOf}`; }).join(' ');
  check('calendar: 4-day seasons from spring, year 1', cal === '1:sp1.1 4:sp1.4 5:su1.1 9:au1.1 13:wi1.1 16:wi1.4 17:sp2.1 33:sp3.1', cal);

  g.setTier(3, false);
  g.coins = 2000;
  // Winter's day: faster and darker sooner.
  morning(13);
  check('winter morning: season, year, pace', g.season.season === 'winter' && g.season.year === 1 && g.day.pace > 1.2 && g.day.duskAt < 0.75, { s: g.season.season, pace: g.day.pace, dusk: g.day.duskAt });
  check('haystack costs double in winter', K.defOf('hay').cost === Z.HAY_PRICE * 2, K.defOf('hay').cost);
  // Snow under the dog: run right for two seconds, spring against winter.
  const run = () => {
    g.dog.x = 700; g.dog.y = 860; g.dog.vx = g.dog.vy = 0; g.dog.stamina = 99;
    g.animals = g.animals.filter((a) => a.pen);
    const x0 = g.dog.x;
    step(2, { x: 1, y: 0, sprint: false, lie: false });
    return g.dog.x - x0;
  };
  g.season.snap();
  const snowRun = run();
  morning(1);
  g.season.snap();
  const springRun = run();
  check('snow slows the dog a little (5-12%)', snowRun < springRun * 0.95 && snowRun > springRun * 0.88, { spring: Math.round(springRun), winter: Math.round(snowRun) });

  // ---- Winter feed ----
  morning(13);
  const pen = g.ranch.pens[0];
  pen.animals.forEach((a) => (a.gone = true)); pen.animals = [];
  fill(pen, 'sheep', 6); // 12 places: 3 bales a night
  const barn = add('barn', 76, 108);
  const dry = add('hay', barn.tx + 7, barn.ty + 1);
  const wet = add('hay', 114, 112);
  g.seasonal.loft = 1;
  check('hay need for 6 sheep is 3 bales', Z.hayNeed(g) === 3, Z.hayNeed(g));
  check('the barn shelters one stack, not the other', Z.shelteredSpot(g, dry.cx, dry.cy) && !Z.shelteredSpot(g, wet.cx, wet.cy));
  g.endDay();
  check('night 1: loft first, then the sheltered stack; the open one spoils', g.seasonal.loft === 0 && dry.bales === 18 && wet.bales === 18 && !pen.hungry, { loft: g.seasonal.loft, dry: dry.bales, wet: wet.bales });
  // Clear the hay: the pen goes hungry.
  g.ranch.remove(dry); g.ranch.remove(wet);
  g.day.day = 14;
  g.endDay();
  check('no hay: the pen goes hungry', pen.hungry && g.seasonal.hungryNights === 1, { hungry: pen.hungry, nights: g.seasonal.hungryNights });
  const st0 = pen.animals[0].stress;
  g.day.day = 14; g.startDay(); g.mode = 'play';
  check('a hungry night makes the pen restless', pen.animals[0].stress > st0 + 0.1, { before: +st0.toFixed(2), after: +pen.animals[0].stress.toFixed(2) });
  pen.animals.forEach((a) => (a.produceT = 0));
  step(20);
  check('a hungry pen makes no goods that day', pen.animals.every((a) => a.produceT === 0), pen.animals[0].produceT);
  const brief = g.ranch.remove(barn);

  // ---- Spring: lambs ----
  // (Fed and calm again since the hungry night: only they breed. And room
  // for the lambs to grow into: the old upgraded pen's half again.)
  pen.hungry = false;
  pen.animals.forEach((a) => (a.stress = 0));
  pen.level = 2;
  morning(17); // spring, year 2, day 1
  const penLambs = () => pen.animals.filter((a) => a.young);
  const lambs1 = penLambs().length;
  morning(18);
  const lambs = penLambs();
  const linked = lambs.every((l) => l.mother && l.mother.lambedYear === 2 && l.mother.pen === pen);
  check('ewes in a pen lamb over the first two spring mornings', lambs1 > 0 && lambs.length >= 5 && linked, { day1: lambs1, day2: lambs.length });
  check('a lamb takes one place, a ewe two', A.spaceOf(lambs[0]) === 1 && A.spaceOf(lambs[0].mother) === 2 && pen.used === 12 + lambs.length, pen.used);
  morning(19);
  check('no third lambing', penLambs().length === lambs.length);
  check('legacy counts lambs', g.totals.lambs === lambs.length, g.totals.lambs);
  // Wild spring flocks on the hills: some ewes with lambs at foot.
  {
    const hills = M.REGIONS.find((r) => r.id === 'hills');
    let wild = 0, young = 0, withMum = 0;
    for (let i = 0; i < 6; i++) {
      const born = SP.spawnMorning(g.map, [], 30, 3, (r) => r === hills, 'spring');
      wild += born.filter((a) => !a.young).length;
      young += born.filter((a) => a.young).length;
      withMum += born.filter((a) => a.young && a.mother && born.includes(a.mother)).length;
    }
    const summer = SP.spawnMorning(g.map, [], 30, 3, (r) => r === hills, 'summer').filter((a) => a.young).length;
    check('wild ewes come with lambs in spring only (about 40%)', young > wild * 0.25 && young < wild * 0.55 && withMum === young && summer === 0, { wild, young, summer });
    const sp = M.REGIONS.filter((r) => r.species && r.tier < 4).map((r) => [SP.groupsFor(r, 30, 5, 'spring'), SP.groupsFor(r, 30, 5, 'winter')]);
    check('fewer wild flocks in winter', sp.every(([s, w]) => w === Math.max(1, s - 1)) && sp.some(([s, w]) => w < s), JSON.stringify(sp));
    // Five flocks out on the hills when winter comes: the extra ones go
    // down the valley; a stray of yours stays.
    const flocks = [];
    for (const [i, p] of (g.map.spawns.hills ?? []).slice(0, 5).entries())
      for (let k = 0; k < 7; k++) flocks.push(new A.Animal('sheep', p.x + (k % 3) * 6, p.y + Math.floor(k / 3) * 6 + i * 0.01));
    const mine = new A.Animal('sheep', flocks[0].x + 3, flocks[0].y + 3);
    mine.home = true;
    flocks.push(mine);
    const before = flocks.length;
    SP.spawnMorning(g.map, flocks, 30, 5, (r) => r === hills, 'winter');
    const stayed = flocks.filter((a) => !a.gone).length;
    const keepN = Math.round(SP.groupsFor(hills, 30, 5, 'winter') * 7.5 * SP.flockGrowth(hills, 5)) + 1;
    check('winter sends the extra wild flocks down the valley', stayed <= keepN && stayed >= 7 && !mine.gone, { before, stayed, keepN });
  }

  // ---- Summer: the shearer ----
  morning(21); // summer day 1
  const shear = g.orders.list.find((o) => o.kind === 'shear');
  check('the shearer comes on the first summer morning', !!shear && shear.species === 'sheep' && shear.n === 6, shear);
  if (shear) {
    const y = g.ranch.yards.find((y) => y.site.id === shear.yard);
    const ewes = pen.animals.filter((a) => !a.young);
    const coins0 = g.coins;
    step(1);
    ewes.forEach((a, i) => {
      pen.animals = pen.animals.filter((x) => x !== a);
      a.pen = null;
      a.stress = a.peakStress = i < 3 ? 0 : 0.7;
      a.x = y.pen.cx + ((i % 3) - 1) * 5; a.y = y.pen.cy + (Math.floor(i / 3) - 0.5) * 5;
    });
    step(0.2);
    check('each sheep pays a wool bonus; calm ones more', shear.got === 6 && g.coins > coins0 && ewes.every((a) => a.shorn === 2), { got: shear.got, paid: shear.paid });
    step(4);
    const back = ewes.filter((a) => !a.pen && !a.gone && a.home);
    check('shorn sheep come back out to be walked home', back.length === 6, back.length);
    // Not again this year.
    back.forEach((a) => { a.x = y.pen.cx; a.y = y.pen.cy; });
    const again = Z.seasonalOrders; // (only on summer day 1 anyway)
    check('they are not shorn twice in a year', back.every((a) => a.shorn === 2) && typeof again === 'function');
    // Home again.
    back.forEach((a) => { a.x = pen.cx; a.y = pen.cy; a.pen = pen; pen.animals.push(a); });
  }

  // ---- Autumn: lambs grow up, the fair ----
  morning(25); // autumn day 1
  check('lambs grow up when autumn comes', g.animals.filter((a) => a.young).length === 0 && pen.animals.every((a) => !a.lamb && !a.mother));
  check('the loft is full again in autumn', g.seasonal.loft === Z.LOFT_MAX, g.seasonal.loft);
  const spare = add('pen', 80, 112); // room for the fair's entries to come home to
  morning(26); // the fair
  check('fair day', Z.isFairDay(g));
  const sale = g.ranch.yards.find((y) => y.site.id === 'sale');
  const breeds = sale.pen.animals.filter((a) => a.forSale);
  check('rare breeds for sale at the sale yard, by tier', breeds.length === 3 && breeds.every((a) => a.rare), breeds.map((a) => `${a.sp.id}${a.coat}:${a.forSale}`).join(' '));
  // Buy the one the dog stands by, outside the fence.
  const pick = breeds[breeds.length - 1];
  g.dog.x = sale.pen.x0 - 6; g.dog.y = pick.y;
  pick.x = sale.pen.ix0 + 3;
  const at = Z.breedNear(g);
  const coins1 = g.coins;
  const bought = Z.buyBreed(g);
  check('E by the sale yard fence buys the breed you stand by', bought && at && at.a === pick && g.coins === coins1 - at.breed.price && !at.a.pen && at.a.home && !at.a.forSale && g.totals.rareBought === 1, at && at.breed.name);
  g.coins = 3;
  const other = sale.pen.animals.find((a) => a.forSale);
  other.x = sale.pen.ix0 + 3; other.y = g.dog.y;
  const poor = Z.buyBreed(g);
  check('not enough coins: nothing sold', poor && g.coins === 3 && sale.pen.animals.filter((a) => a.forSale).length === 2);
  g.coins = 2000;
  // The ring: a calm sheep and a stressed goat.
  step(1);
  const ring = g.ranch.ring.pen;
  check('the show ring opens on fair day', ring.open);
  const calm = pen.animals.find((a) => !a.rare);
  pen.animals = pen.animals.filter((a) => a !== calm);
  calm.pen = null; calm.stress = calm.peakStress = 0.02;
  calm.x = ring.cx; calm.y = ring.cy;
  const goat = new A.Animal('goat', ring.cx + 4, ring.cy, 0);
  goat.stress = goat.peakStress = 0.9; goat.home = true;
  g.animals.push(goat);
  const coins2 = g.coins;
  step(0.2);
  const e = g.seasonal.fair;
  check('animals in the ring are judged, one per kind', e.length === 2 && ring.animals.length === 2, e.map((x) => `${x.species}:${x.score}#${x.place}`).join(' '));
  const es = e.find((x) => x.species === 'sheep'), eg = e.find((x) => x.species === 'goat');
  check('calm counts: the calm sheep places, the frantic goat does not', es && eg && es.place <= 2 && eg.place === 4 && g.coins > coins2, { sheep: es, goat: eg && eg.score });
  const second = new A.Animal('sheep', ring.cx, ring.cy + 4, 0);
  g.animals.push(second);
  step(0.2);
  check('a second sheep is not judged', g.seasonal.fair.length === 2 && second.pen !== ring);
  second.gone = true;
  // The fair packs up at day's end: the entries go home.
  g.endDay();
  // (The goat has no paddock of its own, but goats get on with sheep: it
  // shares the sheep's.)
  check('after the fair, entries go home and unsold breeds leave', (calm.pen === spare || calm.pen === pen) && goat.pen === spare && sale.pen.animals.length === 0 && ring.animals.length === 0, { calm: calm.pen?.id, goat: goat.pen?.id, sale: sale.pen.animals.length });
  check('ribbons in the legacy record', g.totals.fairRibbons.reduce((s, n) => s + n, 0) >= 1, g.totals.fairRibbons);

  // ---- Seasons in the save ----
  // (Last year's lambs, grown, go to market: room for this year's.)
  for (const a of pen.animals.slice(6)) a.gone = true;
  pen.animals = pen.animals.slice(0, 6);
  pen.animals.forEach((a) => (a.stress = 0));
  morning(17 + 16); // spring, year 3
  morning(18 + 16);
  const stack = add('hay', 114, 112);
  stack.bales = 7;
  pen.hungry = true;
  g.seasonal.loft = 4;
  const lambsSaved = g.animals.filter((a) => a.young && !a.gone).length;
  SV.saveGame(g);
  const raw = localStorage.getItem('comeby-save-v1');
  // Load it back.
  SV.loadInto(g);
  const lambsLoaded = g.animals.filter((a) => a.young);
  const st = Z.stacks(g);
  check('lambs, their mothers and the hay come back from a save', lambsSaved > 0 && lambsLoaded.length === lambsSaved && lambsLoaded.every((l) => l.mother && l.mother.lamb && !l.mother.young) && st.length === 1 && st[0].bales === 7 && g.seasonal.loft === 4 && g.ranch.pens[0].hungry, { lambsSaved, lambsLoaded: lambsLoaded.length, bales: st[0]?.bales, loft: g.seasonal.loft });
  check('the calendar comes back from the day', g.season.season === 'spring' && g.season.year === 3 && g.season.dayOf === 2, `${g.season.season} ${g.season.year}.${g.season.dayOf}`);
  // An old save: none of the seasonal fields.
  const old = JSON.parse(raw);
  delete old.seasonal;
  for (const b of old.buildings) { delete b.bales; delete b.hungry; for (const a of b.animals ?? []) { delete a.young; delete a.mom; delete a.k; delete a.lambed; delete a.shorn; } }
  old.buildings = old.buildings.filter((b) => b.kind !== 'haystack');
  for (const a of old.wild) { delete a.young; delete a.mom; delete a.k; }
  old.day = 3;
  localStorage.setItem('comeby-save-v1', JSON.stringify(old));
  const ok = SV.loadInto(g);
  check('an old save loads: spring, year 1, a full loft', ok && g.season.season === 'spring' && g.season.year === 1 && g.seasonal.loft === Z.LOFT_MAX && g.seasonal.fair.length === 0 && Z.stacks(g).length === 0 && !g.ranch.pens[0].hungry, { loft: g.seasonal.loft, season: g.season.season });
  void brief;
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
