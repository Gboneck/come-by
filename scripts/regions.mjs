// Screenshot each region at real scale (tier 5, its herd grazing nearby):
//   node scripts/regions.mjs [--out=shots/regions] [--only=ford,ranch] [--night] [--dusk] [--t=seconds]
// Writes <out>/<spot>.png at 1280x720 (3x pixels) for every spot.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const out = opt('out', 'shots/regions');
const only = opt('only', '') ? opt('only', '').split(',') : null;

// World pixel spots: camera centre, plus a herd to drop in.
const SPOTS = [
  { name: 'ranch', x: 768, y: 800, herd: ['sheep', 800, 880, 8] },
  { name: 'meadow', x: 1220, y: 870, herd: ['duck', 1180, 860, 7] },
  { name: 'hills', x: 1150, y: 420, herd: ['sheep', 1140, 430, 9] },
  { name: 'rocky', x: 330, y: 400, herd: ['goat', 330, 420, 7] },
  { name: 'ford', x: 440, y: 840, herd: ['cow', 380, 860, 5] },
  { name: 'high', x: 560, y: 120, herd: ['pony', 600, 130, 5] },
];

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5197/?debug');
await page.waitForFunction(() => window.game);
for (const s of SPOTS) {
  if (only && !only.includes(s.name)) continue;
  await page.evaluate(({ s, night, dusk, t }) => {
    const g = window.game;
    g.setTier(5);
    g.tut = 99;
    g.tipsSeen = new Set(['hills', 'rocky', 'ford', 'high', 'night']);
    g.banner = null;
    g.place = null;
    g.tip = null;
    g.animals.length = 0;
    g.predators.length = 0;
    g.day.phase = 'day';
    g.day.t = t;
    if (dusk) { g.day.t = 290; g.day.phase = 'dusk'; }
    if (night) g.day.startNight();
    g.spawnFlock(...s.herd);
    g.dog.x = s.x - 30;
    g.dog.y = s.y + 20;
    g.cam.x = s.x;
    g.cam.y = s.y;
  }, { s, night: flag('night'), dusk: flag('dusk'), t: Number(opt('t', '60')) });
  await page.waitForTimeout(Number(opt('wait', '700')));
  await page.evaluate(({ x, y }) => { window.game.cam.x = x; window.game.cam.y = y; }, s);
  await page.waitForTimeout(60);
  const file = `${out}/${s.name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}
if (errors.length) console.log('errors:\n  ' + errors.join('\n  '));
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
