// Save the full baked world (ground + canopy) as shots/map.png.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('http://localhost:5198/?debug');
await page.waitForFunction(() => window.game);
const url = await page.evaluate(() => window.game.debugMapImage());
mkdirSync('shots', { recursive: true });
writeFileSync('shots/map.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('shots/map.png');
await browser.close();
await server.close();
