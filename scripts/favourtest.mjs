// Buyers' favour end to end: orders filled at the buyers' yards raise each
// buyer's favour (more for calm stock and an early delivery), a missed order
// costs a little but never a level, and each level brings what it says:
// better pay, special orders (the miller's rush, the sale yard's show stock,
// the drover's big drove), gifts (decor, a rare breed, dog training, winter
// meal, a second clip), the yards dressed up. Saved, and shared with co-op
// guests. Screenshots of the yards and the Ledger's BUYERS page go to
// shots/favour/. Exits 1 on any failed check or console error.
//   node scripts/favourtest.mjs        (PORT=5376 by default)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT || 5376);
mkdirSync('shots/favour', { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const errors = [];
const fails = [];
const check = (ok, what, got) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${got !== undefined ? `  (${JSON.stringify(got)})` : ''}`);
  if (!ok) fails.push(what);
};

async function open(viewport, dpr = 1, phone = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  // Exact runs: a seeded Math.random and no live frame loop (we step it).
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    let a = 12345;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.game);
  // Helpers in the page.
  await page.evaluate(async () => {
    const g = window.game;
    const { Animal } = await import('/src/entities/animal.ts');
    const orders = await import('/src/systems/orders.ts');
    window.T = {
      orders,
      fav: await import('/src/systems/favour.ts'),
      yard: (id) => g.ranch.yards.find((y) => y.site.id === id),
      step(n) { for (let i = 0; i < n; i++) g.update(1 / 60); },
      // Calm (or not) stock dropped straight into a yard.
      drop(id, sp, n, stress = 0) {
        const p = window.T.yard(id).pen;
        const out = [];
        for (let i = 0; i < n; i++) {
          const a = new Animal(sp, p.ix0 + 7 + (i % 3) * 9, p.iy0 + 7 + Math.floor(i / 3) * 9);
          a.stress = stress;
          a.peakStress = stress;
          g.animals.push(a);
          out.push(a);
        }
        return out;
      },
      order(yard, species, n, extra = {}) {
        const o = { id: g.orders.nextId++, yard, species, n, due: orders.hourToT(17), got: 0, paid: 0, state: 'open', ...extra };
        g.orders.list.push(o);
        return o;
      },
      shot() {
        for (const p of g.folk.people) p.bubble = null;
        g.render();
        g.screen.present();
      },
    };
    g.setTier(4, false);
    g.tut = 99;
    g.tip = null;
    g.banner = null;
    g.feel.cover = 0;
    g.animals.length = 0;
    g.orders.list = [];
    g.day.t = 20;
    // Keep the dog well away from the yards.
    g.dog.x = 900;
    g.dog.y = 820;
  });
  return { ctx, page };
}

// ---- The rules ----
{
  const { ctx, page } = await open({ width: 1280, height: 720 });
  const r = await page.evaluate(() => {
    const g = window.game, T = window.T, F = g.favour;
    const out = {};
    // A calm order filled early at the mill: 3 + 2 (calm) + 1 (early).
    const o1 = T.order('mill', 'duck', 3);
    T.drop('mill', 'duck', 3);
    const c0 = g.coins;
    T.step(20);
    out.first = { state: o1.state, got: o1.got, pts: F.pts.mill, level: F.level('mill'), paid: o1.paid, coins: g.coins - c0 };
    out.card = g.achievements.card ?? g.achievements.queue.find((c) => c.kind === 'favour');
    out.base = 3 * T.orders.headPrice('duck', 0);
    // Level 1 pays 10% over on every head.
    g.animals = g.animals.filter((a) => !a.gone && !a.pen);
    T.step(200); // the miller leads the first lot away
    const o2 = T.order('mill', 'duck', 2);
    T.drop('mill', 'duck', 2);
    T.step(20);
    const v = T.orders.headPrice('duck', 0);
    out.second = { paid: o2.paid, want: 2 * (v + Math.round(v * 0.1)), pts: F.pts.mill };
    // A missed order costs 2, but never a level.
    F.pts.mill = 6;
    const o3 = T.order('mill', 'duck', 3, { due: g.day.t - 1 });
    T.step(2);
    out.missed = { state: o3.state, pts: F.pts.mill, level: F.level('mill') };
    F.pts.drover = 15;
    const o4 = T.order('drover', 'sheep', 3, { due: g.day.t - 1, got: 1 });
    T.step(2);
    out.short = { state: o4.state, pts: F.pts.drover };
    return out;
  });
  check(r.first.state === 'done' && r.first.got === 3, 'an order filled at the mill', r.first);
  check(r.first.pts === 6 && r.first.level === 1, 'calm and early: 3 + 2 + 1 points, level 1', r.first);
  check(r.first.paid === r.base, 'level 0 pays the plain price', [r.first.paid, r.base]);
  check(r.card && r.card.kind === 'favour' && r.card.buyer === 'mill' && r.card.level === 1, "the miller's level-up card", r.card);
  check(r.second.paid === r.second.want, 'level 1 pays 10% over', r.second);
  check(r.missed.state === 'gone' && r.missed.pts === 5 && r.missed.level === 1, 'a missed order costs 2 points, not the level', r.missed);
  check(r.short.pts === 14, 'a short order costs 1', r.short);

  // ---- Special orders ----
  const s = await page.evaluate(() => {
    const g = window.game, T = window.T, F = g.favour, { orders } = T;
    const out = {};
    // Stock at home for a rush order.
    const pen = g.ranch.pens[0];
    for (const a of g.animals) if (a.pen === pen) a.gone = true;
    pen.animals = [];
    F.pts = { mill: 12, drover: 12, sale: 12, shear: 0 };
    const seen = {};
    for (let k = 0; k < 120 && Object.keys(seen).length < 3; k++) {
      // Penned ducks and sheep so rush orders can be made.
      g.ranch.pens[0].animals = Array.from({ length: 4 }, () => ({ sp: { id: 'duck' }, young: false }));
      g.ranch.pens[0].species = 'duck';
      orders.morningOrders(g);
      for (const o of g.orders.list) if (o.special) seen[o.special] ??= { yard: o.yard, n: o.n, due: o.due, specials: g.orders.list.filter((x) => x.special).length };
    }
    g.ranch.pens[0].animals = [];
    out.seen = seen;
    out.rushBy = orders.hourToT(10.5);
    out.droveBy = orders.hourToT(17);
    // A rush order pays double, plus the level's 15%.
    g.orders.list = [];
    const o = T.order('mill', 'duck', 2, { special: 'rush', due: orders.hourToT(10) });
    T.drop('mill', 'duck', 2);
    T.step(20);
    const v = orders.headPrice('duck', 0);
    out.rush = { state: o.state, paid: o.paid, want: 2 * (v + Math.round(v * 1.15)), pts: F.pts.mill };
    // A show order turns rattled stock away until it settles.
    g.orders.list = [];
    T.step(200);
    g.animals = g.animals.filter((a) => !a.gone);
    const sh = T.order('sale', 'sheep', 2, { special: 'show' });
    const rattled = T.drop('sale', 'sheep', 2, 0.7);
    T.step(60);
    out.showEarly = { got: sh.got, said: g.fx.list.some((p) => p.text === 'TOO RATTLED: LET IT SETTLE') };
    let t = 0;
    while (sh.state === 'open' && t < 6000) { T.step(30); t += 30; }
    out.showLater = { state: sh.state, got: sh.got, seconds: Math.round(t / 60), calm: rattled.every((a) => a.peakStress < 0.3), specials: [...F.specials] };
    return out;
  });
  check(s.seen.rush && s.seen.rush.yard === 'mill' && s.seen.rush.due <= s.rushBy, 'the trusted miller sends a rush order, due early', s.seen.rush);
  check(s.seen.show && s.seen.show.yard === 'sale', 'the trusted sale yard asks for show stock', s.seen.show);
  check(s.seen.drove && s.seen.drove.yard === 'drover' && s.seen.drove.due >= s.droveBy && s.seen.drove.n >= 5, 'the trusted drover asks for a big drove', s.seen.drove);
  check(Object.values(s.seen).every((x) => x.specials === 1), 'one special order a day at most', s.seen);
  check(s.rush.state === 'done' && s.rush.paid === s.rush.want, 'a rush order pays double (and the 15%)', s.rush);
  check(s.rush.pts === 12 + 3 + 2 + 1, 'a special order earns a point more (and no early point for a rush)', s.rush.pts);
  check(s.showEarly.got === 0 && s.showEarly.said, 'show stock: rattled sheep are turned away, with a word', s.showEarly);
  check(s.showLater.state === 'done' && s.showLater.calm, 'show stock: once settled, they are taken', s.showLater);
  check(['rush', 'show'].every((k) => s.showLater.specials.includes(k)), 'special orders filled are remembered (ALL SORTS)', s.showLater.specials);

  // ---- Gifts at the levels ----
  const gft = await page.evaluate(async () => {
    const g = window.game, T = window.T, F = g.favour;
    const { PIECES } = await import('/src/ui/decorbuild.ts');
    const out = {};
    const gift = (id) => PIECES.find((p) => p.id === id);
    out.before = ['millstone', 'bell', 'fleece'].map((id) => gift(id)?.open(g));
    g.orders.list = [];
    g.animals = g.animals.filter((a) => !a.gone);
    const rare0 = g.animals.filter((a) => a.rare).length;
    const up0 = Object.values(g.upgrades).reduce((s, n) => s + n, 0);
    // The drover: 20 points, an order takes him to 3 (a rare breed) ...
    F.pts.drover = 20;
    const p = g.ranch.pens[0];
    p.species = 'sheep';
    T.order('drover', 'duck', 2);
    T.drop('drover', 'duck', 2);
    T.step(20);
    out.l3 = { level: F.level('drover'), rare: g.animals.filter((a) => a.rare && a.home && !a.pen).length - rare0 };
    T.step(200);
    // ... and another to 4: a friend, his dog trains yours.
    F.pts.drover = 31;
    T.order('drover', 'duck', 2);
    T.drop('drover', 'duck', 2);
    T.step(20);
    const cards = [g.achievements.card, ...g.achievements.queue].filter((c) => c && c.kind === 'favour' && c.buyer === 'drover');
    out.l4 = { level: F.level('drover'), title: T.fav.titleOf('drover', F.level('drover')), card: cards.map((c) => c.level), upgrades: Object.values(g.upgrades).reduce((s, n) => s + n, 0) - up0, friends: F.friends() };
    // Gifts open in build mode at level 3.
    F.pts.mill = 21; F.pts.sale = 21; F.pts.shear = 15;
    out.after = ['millstone', 'bell', 'fleece'].map((id) => gift(id)?.open(g));
    out.cost = ['millstone', 'bell', 'fleece'].map((id) => gift(id)?.cost);
    // The miller's meal on the first morning of winter, once a year.
    F.pts.mill = 32;
    g.season.set('winter');
    g.season.dayOf = 1;
    g.season.year = 1;
    const loft = g.seasonal.loft;
    F.update(g, 1 / 60);
    F.update(g, 1 / 60);
    out.meal = g.seasonal.loft - loft;
    // The shearer's second clip on summer's third morning.
    g.season.set('summer');
    g.season.dayOf = 3;
    F.pts.shear = 9;
    const pen = g.ranch.pens[0];
    pen.species = 'sheep';
    pen.animals = Array.from({ length: 5 }, () => ({ sp: { id: 'sheep' }, young: false, shorn: 0 }));
    T.orders.morningOrders(g);
    out.clip = g.orders.list.filter((o) => o.kind === 'shear').map((o) => ({ yard: o.yard, n: o.n }));
    pen.animals = [];
    g.season.set('spring');
    g.season.dayOf = 1;
    return out;
  });
  check(gft.before.every((x) => x === false), 'gift decor is locked before the gifts', gft.before);
  check(gft.l3.level === 3 && gft.l3.rare === 1, "the drover's gift: a rare breed to walk home", gft.l3);
  check(gft.l4.level === 4 && gft.l4.title === 'FRIEND OF THE VALLEY' && gft.l4.card.includes(4), 'level 4: a friend of the valley, with its card', gft.l4);
  check(gft.l4.upgrades === 1, "the drover's old dog trains yours", gft.l4.upgrades);
  check(gft.after.every((x) => x === true) && gft.cost.every((c) => c === 0), 'gift decor opens at level 3, free', gft.after);
  check(gft.meal === 6, "the miller's winter meal: 6 bales, once", gft.meal);
  check(gft.clip.length === 1 && gft.clip[0].n === 5, 'the trusted shearer comes back for a second clip', gft.clip);

  // ---- Saving and co-op ----
  const sv = await page.evaluate(async () => {
    const g = window.game;
    const save = await import('/src/systems/save.ts');
    const { Favour } = await import('/src/systems/favour.ts');
    const { sharedOut, sharedIn } = await import('/src/net/shared.ts');
    const d = JSON.parse(JSON.stringify(save.saveData(g)));
    const f = new Favour();
    f.load(d.favour);
    const old = new Favour();
    old.load(undefined);
    const levels = (x) => ['mill', 'drover', 'sale', 'shear'].map((id) => x.level(id));
    // A guest's game gets the host's favour through the shared state.
    const guest = { favour: new Favour(), achievements: { hostPins: null }, seasonal: {}, ranch: { buildings: [] } };
    const sh = JSON.parse(JSON.stringify(sharedOut(g)));
    try { sharedIn(guest, { favour: sh.favour, pins: sh.pins }); } catch (e) { return { err: String(e) }; }
    return { saved: levels(f), live: levels(g.favour), given: [...f.given], specials: [...f.specials], old: levels(old), guest: levels(guest.favour), pins: guest.achievements.hostPins?.length };
  });
  check(!sv.err, 'shared state applies on a guest', sv.err);
  check(JSON.stringify(sv.saved) === JSON.stringify(sv.live), 'favour saves and loads', sv);
  check(sv.given.includes('breed') && sv.given.includes('training'), 'one-off gifts are remembered (never given twice)', sv.given);
  check(sv.old.every((l) => l === 0), 'an older save starts every buyer at nothing', sv.old);
  check(JSON.stringify(sv.guest) === JSON.stringify(sv.live), "a co-op guest sees the host's favour", sv.guest);

  // ---- How the yards look ----
  await page.evaluate(() => {
    const g = window.game;
    g.favour.pts = { mill: 32, drover: 12, sale: 32, shear: 15 };
    g.look.ranch = 'BLUEGUM FARM';
    g.orders.list = [{ id: 99, yard: 'mill', species: 'duck', n: 3, due: 400, got: 0, paid: 0, state: 'open', special: 'rush' }];
    g.achievements.card = null;
    g.achievements.queue = [];
  });
  for (const id of ['mill', 'drover', 'sale']) {
    await page.evaluate((id) => {
      const g = window.game, y = window.T.yard(id);
      g.dog.x = y.pen.cx;
      g.dog.y = y.pen.y1 + 30;
      window.T.step(2);
      g.cam.x = (y.pen.x0 + y.site.cart.tx * 8 + 16) / 2;
      g.cam.y = y.pen.cy;
      window.T.shot();
    }, id);
    await page.screenshot({ path: `shots/favour/yard-${id}.png` });
  }
  const n = await page.evaluate(async () => {
    const { favourDrawables } = await import('/src/art/favour.ts');
    const g = window.game, y = window.T.yard('mill');
    g.cam.x = y.pen.cx;
    g.cam.y = y.pen.cy;
    return favourDrawables(g, g.g).length;
  });
  check(n >= 6, 'a friend\'s yard: bunting, a stall, flower tubs, the name board, the rush word', n);
  // The Ledger's BUYERS page.
  await page.evaluate(() => {
    const g = window.game;
    g.mode = 'play';
    g.input.push('ledger');
    window.T.step(1);
    g.input.push('next');
    window.T.step(1);
    window.T.shot();
  });
  check(await page.evaluate(async () => (await import('/src/ui/achievements.ts')).ledgerPage()) === 1, 'Q/E turns the Ledger to BUYERS');
  await page.screenshot({ path: 'shots/favour/ledger-buyers.png' });
  await ctx.close();
}

// ---- The BUYERS page on a phone ----
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3, true);
  await page.evaluate(async () => {
    const g = window.game;
    g.favour.pts = { mill: 8, drover: 32, sale: 20, shear: 4 };
    g.favour.filled = { mill: 2, drover: 9, sale: 5, shear: 1 };
    const ui = await import('/src/ui/achievements.ts');
    ui.openLedgerAt(g, 1);
    window.T.step(1);
    window.T.shot();
  });
  await page.screenshot({ path: 'shots/favour/ledger-buyers-phone.png' });
  await ctx.close();
}

check(errors.length === 0, 'no console errors', errors.slice(0, 5));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall favour checks passed');
await browser.close();
await server.close();
process.exit(fails.length ? 1 : 0);
