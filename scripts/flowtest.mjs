// End-to-end: pen ducks with the bot, buy a kennel, and watch tier 2 arrive.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5192, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5192/?debug');
await page.waitForFunction(() => window.sim);
const r = await page.evaluate(() => {
  const g = window.game;
  const pen = g.ranch.pens[0];
  const out = { start: { tier: g.tier, ducks: g.animals.length } };
  // Drive the meadow ducks home for real (no teleporting the flock).
  const res = window.sim({ goalX: pen.gatePoint(30).x, goalY: pen.gatePoint(30).y }, 120);
  out.drive = res;
  const res2 = window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true }, 90);
  out.pen = { res2, penned: pen.animals.length, coins: g.coins, calmBatches: g.totals.calmBatches };
  // Wait for the gate to shut.
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  g.input.override = null;
  out.afterShut = { calmBatches: g.totals.calmBatches, banner: g.banner?.big };
  // Buy a kennel through build mode logic.
  g.coins = Math.max(g.coins, 25);
  g.enterBuild();
  const b = g.build;
  b.item = 3; // kennel
  b.cx = 90; b.cy = 108;
  g.input.push('confirm');
  g.update(1 / 60);
  g.input.push('cancel');
  g.update(1 / 60);
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  out.after = { tier: g.tier, mode: g.mode, banner: g.banner?.big, small: g.banner?.small, hillsGate: g.ranch.regionGates.find((x) => x.region === 'hills').unlocked, sheep: g.animals.filter((a) => a.sp.id === 'sheep').length };
  return out;
});
console.log(JSON.stringify(r, null, 1));
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/flow-tier2.png' });
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
