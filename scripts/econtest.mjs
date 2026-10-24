// Pen a flock, let the day run, and check goods + the end-of-day summary.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5194, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5194/?debug');
await page.waitForFunction(() => window.sim);
const r = await page.evaluate(() => {
  const g = window.game;
  const pen = g.ranch.pens[0];
  const gp = pen.gatePoint(0);
  window.resetFlock('duck', gp.x + 10, gp.y + 60, 7, gp.x + 30, gp.y + 120);
  const res = window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true }, 90);
  const coinsAfterDelivery = g.coins;
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  let steps = 0;
  while (g.mode === 'play' && steps < 60 * 400) { g.update(1 / 60); steps++; }
  g.input.override = null;
  return { res, coinsAfterDelivery, coins: g.coins, mode: g.mode, summary: { goods: g.summary.stats.goodsValue, delivered: g.summary.stats.delivered, buildable: g.summary.buildable } };
});
console.log(JSON.stringify(r, null, 1));
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/econ-summary.png' });
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
