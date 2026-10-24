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
});
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
await step('paused', () => ({ mode: window.game.mode }));
for (const k of ['ArrowDown', 'ArrowDown', 'Enter']) {
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
  return { mode: g.mode, demo: g.demo, coins: g.coins, tier: g.tier, speed: g.upgrades.speed, walk: g.dog.stats.walk, kennel: g.ranch.buildings.some((b) => b.kind === 'kennel'), penned: g.ranch.pens[0].animals.length, helpers: g.helpers.map((h) => h.name), gatesOpen: g.ranch.regionGates.filter((x) => x.unlocked).length, farmLevel: g.ranch.farmhouse.level };
});
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
