// Plays a seeded game with the pace bot (src/pacebot.ts) until the valley
// thrives, then writes the save to scripts/fixtures/tier5.json: a real
// built-up ranch for perftest.mjs.
//   node scripts/makefixture.mjs [--seed=1] [--days=60]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const seed = Number(arg('seed', '1'));
const maxDays = Number(arg('days', '60'));
const port = Number(process.env.FIXTURE_PORT || 5352);
const server = await createServer({ server: { port, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript((seed) => {
  window.requestAnimationFrame = () => 0;
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { localStorage.clear(); } catch { /* ignore */ }
}, seed);
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => window.game);
await page.evaluate(async () => {
  const { Pacer } = await import('/src/pacebot.ts');
  window.__pace = new Pacer(window.game);
  window.game.tut = 99;
});
for (let d = 0; d < maxDays; d++) {
  const log = await page.evaluate(() => window.__pace.playDay());
  console.log(`day ${log.day} T${log.tier} =${log.coins}$`);
  if (await page.evaluate(() => window.game.won)) break;
}
const save = await page.evaluate(async () => {
  const { saveData } = await import('/src/systems/save.ts');
  return JSON.stringify(saveData(window.game));
});
mkdirSync('scripts/fixtures', { recursive: true });
writeFileSync('scripts/fixtures/tier5.json', save);
console.log(`wrote scripts/fixtures/tier5.json (${save.length} bytes)`);
await browser.close();
await server.close();
