// Achievements end to end: the list and its badges (palette-pure, every
// state drawn), badges read from the game and caught as they happen (a day
// with no bark, a perfect calm drive, a coyote made to drop its prey, the
// cattle class won without a nip...), the card that slides in and waits its
// turn, an older save credited with what it had already done, badges
// earned visiting a friend carried home, the Ledger's BADGES page and its
// keys, the postcard, the board by the farmhouse door. Screenshots go to
// shots/achieve/. Exits 1 on any failed check or console error.
//   node scripts/achievetest.mjs        (PORT=5377 by default)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT || 5377);
mkdirSync('shots/achieve', { recursive: true });
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
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.game);
  await page.evaluate(async () => {
    const g = window.game;
    window.T = {
      ach: await import('/src/systems/achievements.ts'),
      ui: await import('/src/ui/achievements.ts'),
      badges: await import('/src/art/badges.ts'),
      step(n) { for (let i = 0; i < n; i++) g.update(1 / 60); },
      shot() {
        for (const p of g.folk.people) p.bubble = null;
        g.render();
        g.screen.present();
      },
      clear() {
        g.achievements.card = null;
        g.achievements.queue = [];
      },
    };
    g.setTier(3, false);
    g.tut = 99;
    g.tip = null;
    g.banner = null;
    g.feel.cover = 0;
    g.day.t = 20;
  });
  return { ctx, page };
}

{
  const { ctx, page } = await open({ width: 1280, height: 720 });

  // ---- The list and the badges ----
  const list = await page.evaluate(() => {
    const { ACHIEVEMENTS, GROUPS } = window.T.ach;
    const { ICONS, badgeCanvas } = window.T.badges;
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const pal = new Set(['A3AD6E', '8E9F6C', '6F8F7C', '487282', '42315A', 'D4D0C6', 'E2D27A']);
    const bad = [];
    for (const a of ACHIEVEMENTS)
      for (const st of ['got', 'locked', 'secret']) {
        const c = badgeCanvas(a.group, a.icon, st);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          n++;
          const hex = [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
          if (d[i + 3] !== 255 || !pal.has(hex)) bad.push(`${a.id}/${st}:${hex}`);
        }
        if (n < 100) bad.push(`${a.id}/${st}: only ${n} px`);
      }
    return {
      n: ACHIEVEMENTS.length,
      unique: new Set(ids).size === ids.length,
      groups: GROUPS.map((g) => ACHIEVEMENTS.filter((a) => a.group === g).length),
      icons: ACHIEVEMENTS.filter((a) => !ICONS[a.icon]).map((a) => a.id),
      secrets: ACHIEVEMENTS.filter((a) => a.secret).length,
      bad: bad.slice(0, 8),
      words: ACHIEVEMENTS.filter((a) => !a.name || !a.what).map((a) => a.id),
    };
  });
  check(list.n >= 28 && list.n <= 40 && list.unique, 'about thirty achievements, ids unique', list.n);
  check(list.groups.every((n) => n >= 4), 'every kind has some: herding, trials, ranch, valley, seasons, co-op', list.groups);
  check(!list.icons.length && !list.words.length, 'every one has a badge icon, a name and how it is earned', [list.icons, list.words]);
  check(list.secrets >= 3, 'a few secret ones, with hints', list.secrets);
  check(!list.bad.length, 'badges are drawn in the palette (no bandana red), every state', list.bad);

  // ---- Read from the game: earned, and the card ----
  const card = await page.evaluate(() => {
    const g = window.game, T = window.T, A = g.achievements;
    const out = {};
    T.step(2);
    T.clear();
    g.totals.calmBatches = 10;
    T.step(40);
    out.steady = { has: A.has('steady'), day: A.got.get('steady'), card: A.card };
    // It goes after its time.
    T.step(Math.round(5.2 * 60));
    out.after = A.card;
    // A card waits behind the tier card.
    g.feel.tierCard = { n: 4, name: 'RANCH', blurb: '', brings: [], t: 2, max: 2 };
    g.totals.orders = 1;
    T.step(40);
    out.behind = { card: A.card, queued: A.queue.map((c) => c.id ?? c.kind) };
    g.feel.tierCard = null;
    T.step(5);
    out.then = A.card;
    T.shot();
    return out;
  });
  check(card.steady.has && card.steady.day === 1, 'STEADY HANDS earned from 10 calm drives', card.steady);
  check(card.steady.card && card.steady.card.id === 'steady', 'its card slides in', card.steady.card);
  check(card.after === null, 'and goes after five seconds', card.after);
  check(card.behind.card === null && card.behind.queued.includes('sold'), 'a card waits behind the tier card', card.behind);
  check(card.then && card.then.id === 'sold', 'then comes in', card.then);
  await page.screenshot({ path: 'shots/achieve/card.png' });

  // ---- Caught as they happen ----
  const ev = await page.evaluate(async () => {
    const g = window.game, T = window.T, A = g.achievements;
    const { Predator } = await import('/src/entities/predator.ts');
    const { Animal } = await import('/src/entities/animal.ts');
    const out = {};
    const home = (n) => (g.totals.delivered.duck = (g.totals.delivered.duck ?? 0) + n);
    const nextDay = () => { g.day.day++; A.update(g, 1 / 60); };
    A.update(g, 1 / 60);
    // A day with a bark does not count; a quiet one does.
    home(8);
    A.dogEvent(g, 'bark');
    nextDay();
    out.barked = A.has('quiet');
    home(5);
    nextDay();
    out.few = A.has('quiet');
    home(6);
    nextDay();
    out.quiet = A.has('quiet');
    // A drive of ten, all calm (nine is not enough).
    const calm = (n, s = 0.1) => Array.from({ length: n }, () => ({ peakStress: s }));
    A.drive(g, calm(9), 'CALM');
    out.nine = A.has('perfect');
    A.drive(g, calm(10).concat([{ peakStress: 0.5 }]), 'STEADY');
    out.oneRattled = A.has('perfect');
    A.drive(g, calm(12), 'CALM');
    out.perfect = A.has('perfect');
    // Calm in a storm.
    g.weather.sky = 'clear';
    A.drive(g, calm(3), 'CALM');
    out.clear = A.has('storm');
    g.weather.sky = 'storm';
    A.drive(g, calm(3), 'CALM');
    out.storm = A.has('storm');
    g.weather.sky = 'clear';
    // A coyote made to drop its prey by the dog.
    const p = new Predator('coyote', 0);
    const a = new Animal('sheep', g.dog.x + 6, g.dog.y);
    g.animals.push(a);
    g.predators = [p];
    p.carry = a;
    A.update(g, 1 / 60);
    p.carry = null;
    A.update(g, 1 / 60);
    out.saved = A.has('saved');
    g.predators = [];
    // Resting right through to dusk.
    g.day.phase = 'day';
    A.update(g, 1 / 60);
    g.rest = 12;
    g.day.phase = 'dusk';
    A.update(g, 1 / 60);
    out.nap = A.has('nap');
    g.rest = 1;
    g.day.phase = 'day';
    // The cattle class: won with a nip, then without.
    const run = () => ({ cls: { id: 'cattle', species: 'cow' } });
    g.trials.run = run();
    A.dogEvent(g, 'nip');
    g.trials.result = { cls: { id: 'cattle' }, place: 1 };
    A.update(g, 1 / 60);
    out.nipped = A.has('soft');
    g.trials.run = run();
    g.trials.result = { cls: { id: 'cattle' }, place: 1 };
    A.update(g, 1 / 60);
    out.soft = A.has('soft');
    g.trials.run = { cls: { id: 'brace', species: 'sheep' } };
    g.trials.result = { cls: { id: 'brace' }, place: 2 };
    A.update(g, 1 / 60);
    out.brace = A.has('brace');
    g.trials.run = null;
    g.trials.result = null;
    // A friend's dog on our ranch.
    g.net = { role: 'host', dogs: [{ x: 0, y: 0 }] };
    A.update(g, 1 / 60);
    out.host = A.has('host');
    g.net = null;
    T.clear();
    return out;
  });
  check(!ev.barked && !ev.few && ev.quiet, 'NOT A WORD: a day of 6+ home without a bark', ev);
  check(!ev.nine && !ev.oneRattled && ev.perfect, 'STILL WATERS: ten or more home at once, every one calm', ev);
  check(!ev.clear && ev.storm, 'STORM DOG: a calm drive in a storm', ev);
  check(ev.saved, 'NOT TONIGHT: a coyote made to drop its prey', ev.saved);
  check(ev.nap, 'FORTY WINKS: resting right through to dusk', ev.nap);
  check(!ev.nipped && ev.soft, 'SOFT HANDS: the cattle class won without a nip', ev);
  check(ev.brace, 'A BRACE OF DOGS: a ribbon in the brace class', ev.brace);
  check(ev.host, 'OPEN GATE: a friend on our ranch', ev.host);

  // ---- An older save gets what it had already earned ----
  const old = await page.evaluate(async () => {
    const g = window.game, T = window.T, A = g.achievements;
    const save = await import('/src/systems/save.ts');
    const d = save.saveData(g);
    delete d.achievements;
    delete d.favour;
    d.totals = { ...d.totals, orders: 12, calmBatches: 14, ribbons: [1, 0, 0], bestTrial: 100, lambs: 11, wintersFed: 1 };
    d.trials = { won: ['novice', 'open', 'cattle', 'cup'], cups: 1, last: 0 };
    d.day = 30;
    localStorage.setItem(save.SAVE_KEY, JSON.stringify(d));
    save.loadInto(g);
    const want = ['sold', 'steady', 'ribbon', 'hundred', 'lambs', 'winter', 'cup', 'classes'];
    const out = { got: want.filter((id) => A.has(id)), days: want.map((id) => A.got.get(id)), past: A.queue.find((c) => c.kind === 'past') ?? (A.card?.kind === 'past' ? A.card : null), events: ['quiet', 'perfect', 'soft'].filter((id) => A.has(id)) };
    const again = JSON.parse(localStorage.getItem(save.SAVE_KEY));
    out.saved = Object.keys(again.achievements?.got ?? {}).length;
    out.count = A.got.size;
    return out;
  });
  check(old.got.length === 8 && old.days.every((d) => d === 0), 'an older save is credited from its totals (day 0, quietly)', old);
  check(old.past && old.past.n >= 8, 'with one card to say so', old.past);
  check(old.events.length === 0, 'moments that cannot be worked out are not given away', old.events);
  check(old.saved === old.count, 'and they are saved', [old.saved, old.count]);

  // ---- Badges earned visiting a friend come home ----
  const tr = await page.evaluate(async () => {
    const g = window.game, A = g.achievements;
    const { Travels, mergeTravels } = await import('/src/net/travels.ts');
    localStorage.removeItem('comeby-travels-v1');
    const travels = new Travels();
    travels.stamp('GREEN ACRES', 'MOSS');
    const was = g.net;
    g.net = { role: 'guest', travels, dogs: [] };
    const before = new Set(A.got.keys());
    A.got.delete('visit');
    A.got.delete('steady');
    const visit = A.grant(g, 'visit');
    const steady = A.grant(g, 'steady');
    g.net = was;
    const stored = JSON.parse(localStorage.getItem('comeby-travels-v1')).badges;
    A.got.delete('visit');
    mergeTravels(g);
    const out = { visit, steady, stored, home: A.has('visit') };
    for (const id of before) if (!A.got.has(id)) A.got.set(id, 0);
    return out;
  });
  check(tr.visit && !tr.steady, 'a guest earns only the co-op badges there', tr);
  check(Array.isArray(tr.stored) && tr.stored.includes('visit'), "it goes to the guest's travels", tr.stored);
  check(tr.home, 'and into their own save at home', tr.home);

  // ---- The Ledger's BADGES page and its keys ----
  const led = await page.evaluate(async () => {
    const g = window.game, T = window.T, A = g.achievements;
    const L = await import('/src/ui/ledger.ts');
    T.clear();
    g.mode = 'play';
    L.ledgerView.page = 0;
    const out = {};
    g.input.push('ledger');
    T.step(1);
    g.input.push('next');
    T.step(1);
    g.input.push('next');
    T.step(1);
    out.page = L.LEDGER_PAGES[L.ledgerView.page - 1]?.id;
    A.sel = 0;
    g.input.push('right');
    T.step(1);
    out.right = A.sel;
    g.input.push('down');
    T.step(1);
    out.down = A.sel;
    // Confirm on a badge not won yet keeps the book open (it makes
    // postcards of won ones).
    A.sel = T.ach.ACHIEVEMENTS.findIndex((a) => !A.has(a.id));
    g.input.push('confirm');
    T.step(1);
    out.locked = g.mode;
    A.sel = T.ach.ACHIEVEMENTS.findIndex((a) => a.id === 'hundred');
    T.step(1);
    T.shot();
    return out;
  });
  check(led.page === 'badges', 'Q/E turns to BADGES', led.page);
  check(led.right === 1 && led.down > 1, 'the arrows move along the grid', led);
  check(led.locked === 'ledger', 'confirm on a badge is the page\'s own (the book stays open)', led.locked);
  await page.screenshot({ path: 'shots/achieve/badges.png' });
  const back = await page.evaluate(() => {
    const g = window.game, T = window.T, A = g.achievements;
    // A secret one shows its hint.
    A.sel = T.ach.ACHIEVEMENTS.findIndex((a) => a.secret && !A.has(a.id));
    T.step(1);
    T.shot();
    g.input.push('cancel');
    T.step(1);
    return g.mode;
  });
  await page.screenshot({ path: 'shots/achieve/secret.png' });
  check(back === 'play', 'ESC closes the book', back);

  // ---- The postcard ----
  const pc = await page.evaluate(() => window.T.ui.postcardUrl(window.game, 'hundred'));
  check(typeof pc === 'string' && pc.startsWith('data:image/png'), 'a postcard of a won badge', pc?.slice(0, 22));
  if (pc) writeFileSync('shots/achieve/postcard.png', Buffer.from(pc.split(',')[1], 'base64'));
  const none = await page.evaluate(() => window.T.ui.postcardUrl(window.game, 'everyone'));
  check(none === null, 'no postcard for a badge not won', none);

  // ---- The board by the farmhouse door ----
  const board = await page.evaluate(async () => {
    const g = window.game, T = window.T;
    const { trophyDrawables, boardContents } = await import('/src/art/trophies.ts');
    const d = g.doorPoint();
    g.dog.x = d.x + 26;
    g.dog.y = d.y + 16;
    g.cam.x = d.x - 10;
    g.cam.y = d.y - 16;
    g.totals.ribbons = [2, 1, 1];
    const c = boardContents(g);
    const n = trophyDrawables(g, g.g).length;
    T.clear();
    g.mode = 'play';
    T.step(1);
    g.cam.x = d.x - 10;
    g.cam.y = d.y - 16;
    T.shot();
    return { n, rosettes: c.rosettes.length, cups: c.cups, big: c.bigCup, pins: c.pins.length };
  });
  check(board.n >= 1 && board.rosettes >= 4 && board.cups >= 3 && board.big && board.pins >= 8, 'the board by the door fills with rosettes, cups and badge pins', board);
  await page.screenshot({ path: 'shots/achieve/board.png' });
  await ctx.close();
}

// ---- On a phone: the grid, a card ----
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3, true);
  await page.evaluate(() => {
    const g = window.game, T = window.T;
    g.banner = null;
    g.totals.calmBatches = 10;
    g.totals.orders = 1;
    T.step(30);
    T.shot();
  });
  await page.screenshot({ path: 'shots/achieve/card-phone.png' });
  const tap = await page.evaluate(async () => {
    const g = window.game, T = window.T;
    const L = await import('/src/ui/ledger.ts');
    T.clear();
    g.banner = null;
    g.achievements.got.delete('steady');
    T.step(30);
    // Tap the card: the Ledger opens at BADGES, the badge picked.
    const c = g.achievements.card;
    g.achievements.cardT = 1;
    g.achievements.sel = 0;
    const { W, H } = g.screen;
    const p = { id: 1, x: W / 2, y: Math.round(H * 0.24), downX: W / 2, downY: Math.round(H * 0.24), justDown: true, justUp: false, isDown: true, owner: null };
    g.input.ptrs.set(1, p);
    T.shot();
    p.justDown = false; p.justUp = true; p.isDown = false;
    T.shot();
    g.input.ptrs.delete(1);
    T.step(1);
    T.shot();
    return { card: c?.id, mode: g.mode, page: L.LEDGER_PAGES[L.ledgerView.page - 1]?.id, sel: T.ach.ACHIEVEMENTS[g.achievements.sel].id };
  });
  check(tap.card === 'steady' && tap.mode === 'ledger' && tap.page === 'badges' && tap.sel === 'steady', 'a tapped card opens the Ledger at its badge', tap);
  await page.screenshot({ path: 'shots/achieve/badges-phone.png' });
  await ctx.close();
}

check(errors.length === 0, 'no console errors', errors.slice(0, 5));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall achievement checks passed');
await browser.close();
await server.close();
process.exit(fails.length ? 1 : 0);
