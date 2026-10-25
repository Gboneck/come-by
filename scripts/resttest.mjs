// Resting: pen some ducks, lie down on the ranch with the real key, and
// check the day (and the eggs) speed up, that getting up or a loose animal
// close by stops it, and that day one ends with a kennel's worth of coin.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5215, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5215/?debug');
await page.waitForFunction(() => window.sim);

const out = {};
out.penned = await page.evaluate(() => {
  const g = window.game;
  const pen = g.ranch.pens[0];
  const gp = pen.gatePoint(0);
  window.resetFlock('duck', gp.x + 10, gp.y + 60, 6, gp.x + 30, gp.y + 120);
  window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true }, 90);
  g.input.override = { x: 0, y: 1, sprint: false, lie: false };
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  g.input.override = null;
  // Home to the farmhouse yard to rest.
  g.dog.x = g.ranch.farmhouse.cx - 20;
  g.dog.y = g.ranch.farmhouse.cy + 30;
  return { ducks: pen.animals.length, coins: g.coins, dayT: Math.round(g.day.t) };
});

const snap = () => page.evaluate(() => {
  const g = window.game;
  return { mode: g.mode, dayT: +g.day.t.toFixed(1), rest: +g.rest.toFixed(1), goods: g.ranch.pens[0].goods, coins: g.coins, lying: g.dog.lying };
});

out.before = await snap();
await page.keyboard.down('KeyQ');
await page.waitForTimeout(6000);
out.after6s = await snap();
out.loose = await page.evaluate(() => {
  const g = window.game;
  // Lift a penned duck out for a moment and set it down by the dog.
  const a = g.animals.find((x) => !x.gone);
  const [x, y, pen] = [a.x, a.y, a.pen];
  a.pen = null; a.x = g.dog.x + 30; a.y = g.dog.y;
  const blocked = !g.canRest();
  a.pen = pen; a.x = x; a.y = y;
  return { blocked, canRestAgain: g.canRest() };
});
await page.keyboard.up('KeyQ');
await page.keyboard.down('KeyD');
await page.waitForTimeout(400);
await page.keyboard.up('KeyD');
out.gotUp = await snap();

// Rest through to the end of the day.
await page.keyboard.down('KeyQ');
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  await page.waitForTimeout(500);
  if ((await snap()).mode !== 'play') break;
}
await page.keyboard.up('KeyQ');
out.restToEnd = { realSeconds: Math.round((Date.now() - t0) / 1000), ...(await snap()) };
await page.waitForTimeout(800);
out.summary = await page.evaluate(() => ({ mode: window.game.mode, coins: window.game.coins }));
await page.screenshot({ path: 'shots/resttest.png' });

console.log(JSON.stringify(out, null, 1));
const ok = out.after6s.dayT - out.before.dayT > 30 && out.gotUp.rest === 1 && out.loose.blocked && out.restToEnd.mode !== 'play' && out.summary.coins >= 20 && !errors.length;
if (errors.length) console.log('ERRORS', errors);
console.log(ok ? 'PASS' : 'FAIL');
await browser.close();
await server.close();
process.exit(ok ? 0 : 1);
