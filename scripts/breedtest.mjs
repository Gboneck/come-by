// Herds that grow, end to end: every kind breeds in its season in your
// paddocks (calm, fed, with another of its kind and room for the young to
// grow into), the young at their mothers' sides until autumn; wild flocks
// with young at foot, flocks growing as the valley does, big droves; the
// sale yard's lot of stock to buy; goods by kind sent to co-op guests; all
// of it in the save. Prints PASS/FAIL per check; exits 1 on a failure
// or console error.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.BREED_PORT || 5254);
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
  const A = await import('/src/entities/animal.ts');
  const SPC = await import('/src/entities/species.ts');
  const Z = await import('/src/systems/seasonal.ts');
  const SP = await import('/src/systems/spawner.ts');
  const H = await import('/src/systems/herds.ts');
  const E = await import('/src/systems/economy.ts');
  const P = await import('/src/ranch/paddock.ts');
  const M = await import('/src/world/map.ts');
  const SV = await import('/src/systems/save.ts');
  const Y = await import('/src/art/young.ts');
  const step = (s) => { for (let i = 0; i < s * 60; i++) g.update(1 / 60); };
  const morning = (day) => { g.day.day = day - 1; g.startDay(); g.mode = 'play'; g.day.t = 30; };
  g.tut = 99;
  g.setTier(5, false);
  g.coins = 5000;
  // Paddocks of our own, nothing else penned.
  for (const p of g.ranch.pens) { for (const a of p.animals) a.gone = true; p.animals = []; }
  g.animals = g.animals.filter((a) => !a.gone);
  const paddock = (tx, ty, w, h) => { const p = P.makePaddock({ tx, ty, w, h }, { side: 0, at: 2 }); g.ranch.add(p); return p; };
  const fill = (p, id, n, coat = 0) => {
    const got = [];
    for (let i = 0; i < n; i++) {
      const a = new A.Animal(id, p.ix0 + 6 + (i % 6) * 8, p.iy0 + 6 + Math.floor(i / 6) * 8, coat);
      a.pen = p; a.home = true; a.stress = 0;
      p.animals.push(a); g.animals.push(a); got.push(a);
    }
    return got;
  };
  const young = (p, id) => p.animals.filter((a) => a.young && (!id || a.sp.id === id));
  const kinds = ['duck', 'sheep', 'goat', 'cow', 'pony'];
  const big = Object.fromEntries(kinds.map((id, i) => [id, paddock(74 + (i % 3) * 14, 88 + Math.floor(i / 3) * 12, 13, 11)]));
  for (const id of kinds) fill(big[id], id, 4);
  const lone = paddock(116, 88, 6, 8); fill(lone, 'sheep', 1);
  const fretful = paddock(116, 98, 6, 8); fill(fretful, 'goat', 3).forEach((a) => (a.stress = a.eveStress = 0.8)); // a hard day
  const hungry = paddock(116, 108, 6, 8); fill(hungry, 'sheep', 3); hungry.hungry = true;
  const full = paddock(102, 112, 8, 7); fill(full, 'sheep', 7); // 14 of 16 places: room for one lamb to grow into

  // ---- Spring: young in your paddocks ----
  morning(17); // spring, year 2, day 1
  const day1 = Object.fromEntries(kinds.map((id) => [id, young(big[id]).length]));
  // (Stress builds a little overnight in the sim; keep them calm for day 2.)
  for (const p of g.ranch.pens) if (p !== fretful) p.animals.forEach((a) => (a.stress = 0));
  morning(18);
  const day2 = Object.fromEntries(kinds.map((id) => [id, young(big[id]).length]));
  check('spring: ducks, sheep, goats and cattle breed in a roomy paddock', ['duck', 'sheep', 'goat', 'cow'].every((id) => day2[id] >= 2) && day1.sheep >= 1, { day1, day2 });
  check('ponies do not foal in spring', day2.pony === 0);
  const perMother = (p) => Math.max(...p.animals.filter((m) => !m.young).map((m) => young(p).filter((y) => y.mother === m).length));
  check('ducks hatch clutches, a cow has one calf', day2.duck >= 4 && perMother(big.duck) >= 2 && perMother(big.cow) === 1, { ducks: day2.duck, clutch: perMother(big.duck), calves: perMother(big.cow) });
  const all = kinds.flatMap((id) => young(big[id]));
  check('each young one is at its mother, of its kind and coat', all.every((y) => y.mother && !y.mother.young && y.mother.sp.id === y.sp.id && y.mother.coat === y.coat && y.mother.pen === y.pen && Math.hypot(y.x - y.mother.x, y.y - y.mother.y) < 8));
  check('a lone animal has none to breed with', young(lone).length === 0);
  check('a fretful paddock does not breed', young(fretful).length === 0);
  check('a hungry paddock does not breed', young(hungry).length === 0);
  check('a full paddock breeds only what it has room for', young(full).length <= 1 && full.used + young(full).length * 1 <= full.capacity && g.tipsSeen.has('noRoomYoung'), { lambs: young(full).length, used: full.used, cap: full.capacity });
  morning(19);
  check('no third morning of it', kinds.every((id) => young(big[id]).length === day2[id]));
  check('the ranch counts the young', g.totals.born >= kinds.reduce((s, id) => s + day2[id], 0) && g.totals.lambs >= day2.sheep, { born: g.totals.born, lambs: g.totals.lambs });
  // Young take less room and are worth less.
  const calf = young(big.cow)[0], duckling = young(big.duck)[0];
  check('young take a place (a calf two) and are worth two-fifths', A.spaceOf(calf) === 2 && A.spaceOf(duckling) === 1 && A.valueOf(calf) === Math.round(14 * 0.4) && A.valueOf(duckling) === 1, { calf: [A.spaceOf(calf), A.valueOf(calf)], duckling: [A.spaceOf(duckling), A.valueOf(duckling)] });
  {
    const ys = young(big.sheep), t0 = ys.map((a) => a.produceT);
    E.updateProduce(g, 30);
    check('the young make no goods', ys.every((a, i) => a.produceT === t0[i]));
  }
  // Every kind's young has its sprites (Characters' youngSprites, once merged).
  if (Y.youngSprites) check('every kind of young has sprites in every coat', kinds.every((id) => [0, 1, 2].every((c) => { const s = Y.youngSprites(id, c); return s.side.length && s.down.length && s.up.length && s.lie; })) && !!Y.youngSprites('duck', 0).swim);

  // ---- Summer: foals ----
  for (const p of g.ranch.pens) p.animals.forEach((a) => (a.stress = 0));
  morning(21); // summer day 1
  for (const p of g.ranch.pens) p.animals.forEach((a) => (a.stress = 0));
  morning(22);
  check('summer: the ponies foal', young(big.pony).length >= 1, young(big.pony).length);

  // ---- Seasons in the save ----
  const before = g.animals.filter((a) => a.young && !a.gone).map((a) => a.sp.id).sort().join(',');
  SV.saveGame(g);
  SV.loadInto(g);
  const back = g.animals.filter((a) => a.young);
  check('young of every kind and their mothers come back from a save', back.map((a) => a.sp.id).sort().join(',') === before && back.every((y) => y.mother && y.mother.sp.id === y.sp.id && !y.mother.young), { before: before.length, after: back.length });

  // ---- Autumn: grown up ----
  morning(25);
  check('the young grow up in autumn', g.animals.filter((a) => a.young).length === 0);

  // ---- Wild flocks ----
  {
    const reg = (id) => M.REGIONS.find((r) => r.id === id);
    const wildYoung = (r, season) => { let n = 0; for (let i = 0; i < 4; i++) n += SP.spawnMorning(g.map, [], 30, 5, (x) => x === r, season).filter((a) => a.young && a.sp.id === r.species).length; return n; };
    check('wild ducks, goats and cattle come with young in spring', wildYoung(reg('meadow'), 'spring') > 0 && wildYoung(reg('rocky'), 'spring') > 0 && wildYoung(reg('ford'), 'spring') > 0);
    check('wild ponies with foals in summer, not spring', wildYoung(reg('high'), 'summer') > 0 && wildYoung(reg('high'), 'spring') === 0);
    const meadow = reg('meadow');
    check('flocks grow as the valley does', SP.flockGrowth(meadow, 1) === 1 && SP.flockGrowth(meadow, 5) > 1.5, [SP.flockGrowth(meadow, 1), SP.flockGrowth(meadow, 5)]);
    check('a fourth flock in a long-open region', SP.groupsFor(meadow, 30, 5) === 4 && SP.groupsFor(meadow, 30, 2) === 2 && SP.groupsFor(reg('high'), 30, 5) === 2, [SP.groupsFor(meadow, 30, 5), SP.groupsFor(meadow, 30, 2)]);
    const sizes = [];
    for (let i = 0; i < 20; i++) sizes.push(SP.flockSize(meadow, 5));
    check('a tier-5 meadow flock is bigger than a day-one one', Math.min(...sizes) >= 7 && Math.max(...sizes) <= 12, sizes.join(' '));
  }

  // ---- The sale yard's lot ----
  {
    const sale = g.ranch.yards.find((y) => y.site.id === 'sale');
    morning(27); // autumn day 3: not the fair
    const lot = sale.pen.animals.filter((a) => a.forSale);
    check('a lot of stock for sale at the sale yard, of one kind, at four times the price', lot.length >= 2 && lot.every((a) => !a.rare && a.sp.id === g.herds.lot && a.forSale === H.lotPrice(a.sp.id)), lot.map((a) => `${a.sp.id}:${a.forSale}`).join(' '));
    const pick = lot[0];
    g.dog.x = sale.pen.x0 - 6; g.dog.y = pick.y;
    pick.x = sale.pen.ix0 + 3;
    const coins = g.coins, price = pick.forSale;
    const ok = Z.buyBreed(g);
    check('NIP at the fence buys a head: it comes out of the gate to walk home', ok && g.coins === coins - price && !pick.pen && pick.home && !pick.forSale && g.totals.stockBought === 1, { paid: coins - g.coins, price });
    g.endDay();
    check('the rest of the lot goes at day end', sale.pen.animals.filter((a) => a.forSale).length === 0);
    morning(26 + 16); // next year's fair day
    const fair = sale.pen.animals.filter((a) => a.forSale);
    check('fair day: the rare breeds instead of a lot', fair.length > 0 && fair.every((a) => a.rare));
  }

  // ---- A big drove ----
  {
    let found = null;
    g.herds.drove = null; // (this test runs the calendar back a few days)
    for (let d = 34; d < 34 + 24 && !found; d++) {
      g.animals = g.animals.filter((a) => a.pen); // a clear valley each morning
      morning(d);
      if (g.herds.drove && g.herds.drove.day === d) found = { ...g.herds.drove, banner: g.banner?.big };
    }
    const reg = found && M.REGIONS.find((r) => r.id === found.region);
    const mean = reg ? ((SPC.SPECIES[reg.species].spawnGroup[0] + SPC.SPECIES[reg.species].spawnGroup[1]) / 2) : 0;
    check('now and then a big drove comes into a region', found && found.n >= mean * 2 && reg.tier < g.tier, found);
    check('...with a banner saying where', found && found.banner === 'A BIG DROVE', found?.banner);
  }

  // ---- A big calm drove pays extra ----
  {
    const pen = g.ranch.pens[0];
    const batch = (n, stress) => Array.from({ length: n }, () => { const a = new A.Animal('sheep', pen.cx, pen.cy, 0); a.peakStress = stress; a.deliveryValue = 8; return a; });
    const shut = (b) => { const c0 = g.coins; g['onRanchEvent']({ kind: 'shut', pen, batch: b }); return { got: g.coins - c0, banner: g.banner?.small ?? '' }; };
    const eight = shut(batch(8, 0)), five = shut(batch(5, 0)), fifteen = shut(batch(15, 0)), rattled = shut(batch(10, 0.7));
    check('a calm drove of six or more pays a bonus, growing to half again at fifteen', eight.got === Math.round(64 * 0.15) && /DROVE/.test(eight.banner) && five.got === 0 && fifteen.got === Math.round(120 * 0.5) && rattled.got === 0, { eight, five: five.got, fifteen: fifteen.got, rattled: rattled.got });
  }

  // ---- The valley's wild stock is capped ----
  {
    const reg = M.REGIONS.find((r) => r.id === 'hills');
    const crowd = Array.from({ length: SP.WILD_CAP }, (_, i) => new A.Animal('sheep', 100 + (i % 40) * 4, 100 + Math.floor(i / 40) * 4, 0));
    const more = SP.spawnMorning(g.map, crowd, 30, 5, (r) => r === reg, 'summer');
    check('no new wild flocks once the valley holds its cap', more.length === 0 && SP.spawnMorning(g.map, [], 30, 5, (r) => r === reg, 'summer').length > 0, { more: more.length });
  }

  // ---- A packed paddock makes less ----
  {
    const p = g.ranch.pens.find((q) => q.animals.length);
    const cap = p.capacity, was = p.animals;
    p.animals = []; // empty
    const roomy = E.crowding(p);
    p.animals = Array.from({ length: Math.floor(cap / 2) }, () => new A.Animal('sheep', p.cx, p.cy, 0)); // full of sheep
    const packed = E.crowding(p);
    p.animals = was;
    check('a packed paddock makes half as much a head, a roomy one all of it', roomy === 1 && packed <= 0.56 && packed >= 0.5, { roomy, packed: +packed.toFixed(2) });
  }

  // ---- Goods by kind reach a guest ----
  {
    const NS = await import('/src/net/shared.ts');
    const p = g.ranch.pens.find((q) => q.animals.length);
    p.goods = 5; p.goodsBy = { duck: 3, sheep: 2 };
    const sent = JSON.parse(JSON.stringify(NS.sharedOut(g)));
    p.goodsBy = {};
    NS.sharedIn(g, sent);
    check('a guest is sent each paddock\'s goods by kind', p.goodsBy.duck === 3 && p.goodsBy.sheep === 2 && p.goodsList().length === 5);
  }
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
