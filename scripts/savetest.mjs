// Title -> new game -> change things -> save & quit -> continue -> check.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5190, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5190/?debug&title');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.game);
const step = async (label, fn) => console.log(label, JSON.stringify(await page.evaluate(fn)));
await step('title', () => ({ mode: window.game.mode, demo: window.game.demo }));
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await step('started', () => ({ mode: window.game.mode, demo: window.game.demo, saved: !!localStorage.getItem('comeby-save-v1') }));
await page.evaluate(async () => {
  const g = window.game;
  const pen = g.ranch.pens[0];
  g.spawnFlock('duck', pen.cx, pen.cy, 5);
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  g.coins = 77;
  g.setTier(4, false);
  g.upgrades.speed = 3;
  g.applyUpgrades();
  const m = await import('/src/ui/build.ts');
  const c = await import('/src/ranch/catalog.ts');
  g.ranch.add(m.makeBuilding(c.defOf('kennel'), 90, 108, 0));
  g.hireHelper();
  // Orders, trials and a sheep let out of a pen.
  g.trials.won = ['novice'];
  g.trials.lastPrizeDay = 3;
  g.totals.orders = 2;
  g.totals.ribbons = [1, 0, 1];
  g.orders.list = [{ id: 7, yard: 'drover', species: 'duck', n: 4, due: 150, got: 1, paid: 7, state: 'open' }];
  g.orders.nextId = 8;
  const loose = new (g.animals[0].constructor)('sheep', 700, 860);
  loose.home = true;
  g.animals.push(loose);
});
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
await step('paused', () => ({ mode: window.game.mode }));
// Up from RESUME wraps to SAVE AND QUIT, the last row of the pause menu.
for (const k of ['ArrowUp', 'Enter']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(300);
await step('quit', () => ({ mode: window.game.mode, demo: window.game.demo }));
await page.screenshot({ path: 'shots/title-continue.png' });
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await step('continued', () => {
  const g = window.game;
  return { mode: g.mode, demo: g.demo, coins: g.coins, tier: g.tier, speed: g.upgrades.speed, walk: g.dog.stats.walk, kennel: g.ranch.buildings.some((b) => b.kind === 'kennel'), penned: g.ranch.pens[0].animals.length, helpers: g.helpers.map((h) => h.name), gatesOpen: g.ranch.regionGates.filter((x) => x.unlocked).length, farmLevel: g.ranch.farmhouse.level,
    won: g.trials.won, lastPrize: g.trials.lastPrizeDay, orders: g.orders.list.map((o) => `${o.id}:${o.yard}:${o.species}:${o.got}/${o.n}`), nextOrder: g.orders.nextId, filled: g.totals.orders, ribbons: g.totals.ribbons, home: g.animals.filter((a) => a.home).length };
});

// A save from before orders and trials: strip the new fields and continue.
await page.evaluate(() => {
  window.game.loading = true; // no save on the way out
  const k = 'comeby-save-v1';
  const d = JSON.parse(localStorage.getItem(k));
  delete d.orders; delete d.nextOrder; delete d.trials;
  for (const f of ['orders', 'calmOrders', 'ribbons', 'bestTrial', 'trialRuns', 'legacy']) delete d.totals[f];
  for (const a of d.wild) delete a.home;
  localStorage.setItem(k, JSON.stringify(d));
});
await page.goto('http://localhost:5190/?debug&title');
await page.waitForFunction(() => window.game);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await step('old save', () => {
  const g = window.game;
  return { mode: g.mode, tier: g.tier, coins: g.coins, won: g.trials.won, orders: g.orders.list.length, ribbons: g.totals.ribbons, filled: g.totals.orders, legacy: g.totals.legacy, showGate: g.ranch.regionGates.find((x) => x.region === 'show').unlocked };
});
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
