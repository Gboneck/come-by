// Visual trace of a bot-driven herding run: screenshots every few seconds.
//   node scripts/trace.mjs [species] [count] [bark] [frames] [step]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const [species = 'sheep', count = '12', bark = '0', frames = '8', step = '4'] = process.argv.slice(2);
const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.goto('http://localhost:5196/?debug');
await page.waitForFunction(() => window.sim);
mkdirSync('shots/trace', { recursive: true });
const start = { x: 768, y: 740 }, goal = { x: 880, y: 900 }, dog = { x: 700, y: 700 };
await page.evaluate(({ species, count, start, dog }) => {
  window.resetFlock(species, start.x, start.y, Number(count), dog.x, dog.y);
  window.game.showZones = true;
}, { species, count, start, dog });
for (let i = 0; i < Number(frames); i++) {
  const r = await page.evaluate(({ goal, bark, step }) => {
    const res = window.sim({ goalX: goal.x, goalY: goal.y, bark: Number(bark) }, Number(step));
    const g = window.game;
    g.cam.x = g.dog.x; g.cam.y = g.dog.y;
    return { ...res, dog: [Math.round(g.dog.x), Math.round(g.dog.y)], groups: g.groups.map((x) => x.members.length) };
  }, { goal, bark, step });
  await page.waitForTimeout(50);
  await page.screenshot({ path: `shots/trace/${i}.png` });
  console.log(i, JSON.stringify(r));
}
await browser.close();
await server.close();
