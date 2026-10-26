// The light at phone size: dusk, night, fog by day, a fog night and a
// storm night on the built-up ranch (scripts/fixtures/tier5.json), the dog
// by the farmhouse with lamps about. For before/after comparisons.
//   node scripts/skyshots.mjs --tag=before [--size=390x844@3] [--only=night,fog]
// Writes shots/sky/<scene>-<tag>.png (the middle of the screen).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const tag = opt('tag', 'now');
const only = opt('only', '') ? opt('only', '').split(',') : null;
const [wh, dprS] = opt('size', '390x844@3').split('@');
const [width, height] = wh.split('x').map(Number);
const dpr = Number(dprS || 1);
const fixture = readFileSync(new URL('./fixtures/tier5.json', import.meta.url), 'utf8');
const PORT = Number(process.env.SKY_PORT || 5385);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
mkdirSync('shots/sky', { recursive: true });

const SCENES = [
  { name: 'dusk', weather: 'clear', setup: 'dusk' },
  { name: 'night', weather: 'clear', setup: 'night' },
  { name: 'fog', weather: 'fog', setup: 'day' },
  { name: 'fognight', weather: 'fog', setup: 'night' },
  { name: 'storm', weather: 'storm', setup: 'night' },
];

let errors = 0;
for (const s of SCENES) {
  if (only && !only.includes(s.name)) continue;
  const phone = height > width;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: phone, hasTouch: phone });
  page.on('pageerror', (e) => { errors++; console.log('pageerror', e.message); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    let a = 3;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { localStorage.clear(); } catch { /* fine */ }
  });
  await page.goto(`http://localhost:${PORT}/?debug&weather=${s.weather}&season=summer`);
  await page.waitForFunction(() => window.game);
  await page.evaluate(async ({ save, setup }) => {
    const g = window.game;
    localStorage.setItem('comeby-save-v1', save);
    const { loadInto } = await import('/src/systems/save.ts');
    loadInto(g);
    g.tut = 99;
    g.day.t = 150;
    if (setup === 'dusk') { g.day.t = 285; g.day.phase = 'dusk'; }
    if (setup === 'night') { g.startNight(); g.quietT = -1e9; for (const p of g.predators) p.waitT = Math.min(p.waitT, 0.5); }
    const f = g.ranch.farmhouse;
    g.dog.x = f.cx + 20;
    g.dog.y = f.y1 + 34;
    g.dog.face = 'l';
    // A flock by the dog, so we can see how animals read in the dark.
    const near = g.animals.filter((a) => !a.pen).slice(0, 6);
    near.forEach((a, i) => { a.x = g.dog.x - 40 + (i % 3) * 10; a.y = g.dog.y + 14 + Math.floor(i / 3) * 9; a.vx = a.vy = 0; });
    for (let i = 0; i < 240; i++) { g.update(1 / 60); g.input.clearQueue(); }
    g.banner = null; g.tip = null; g.place = null; g.achievements.card = null;
    g.cam.x = g.dog.x; g.cam.y = g.dog.y + 10;
    g.render();
    g.screen.present();
  }, { save: fixture, setup: s.setup });
  const clipH = Math.min(height, Math.round(height * 0.6));
  await page.screenshot({ path: `shots/sky/${s.name}-${tag}.png`, clip: { x: 0, y: Math.round((height - clipH) / 2), width, height: clipH } });
  console.log(`shots/sky/${s.name}-${tag}.png`);
  await page.close();
}
await browser.close();
await server.close();
process.exit(errors ? 1 : 0);
