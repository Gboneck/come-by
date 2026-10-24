// Screenshot every region at tier 5 with its animals.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const server = await createServer({ server: { port: 5193, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5193/?debug');
await page.waitForFunction(() => window.game);
mkdirSync('shots/tour', { recursive: true });
await page.evaluate(() => { window.game.setTier(5, false); window.game.tut = 9; window.game.startDay(); });
await page.waitForTimeout(600);
for (const id of ['meadow', 'hills', 'rocky', 'ford', 'high']) {
  await page.evaluate((id) => {
    const g = window.game;
    const grp = g.groups.find((gr) => g.map.regionAt(gr.x, gr.y)?.id === id) || null;
    const reg = (window.REGIONS || []).find((r) => r.id === id);
    const x = grp ? grp.x - 50 : 0, y = grp ? grp.y + 30 : 0;
    g.dog.x = x; g.dog.y = y; g.cam.x = x; g.cam.y = y;
  }, id);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/tour/${id}.png` });
  console.log(id);
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
