// Night scenarios: undefended, defended by the dog, and sheltered by a barn.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5191, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const errors = [];
for (const scenario of ['undefended', 'defended', 'barn']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5191/?debug');
  await page.waitForFunction(() => window.sim);
  if (process.env.NOSTRAYS) await page.evaluate(() => { window.__noStrays = true; });
  const r = await page.evaluate(async (scenario) => {
    const g = window.game;
    g.setTier(3, false);
    const pen = g.ranch.pens[0];
    // Six ducks in the pen, a loose flock of sheep left out in the hills.
    for (let i = 0; i < 6; i++) {
      const a = new (g.animals[0].constructor)('duck', pen.cx + (i % 3) * 6 - 6, pen.cy + Math.floor(i / 3) * 6);
      g.animals.push(a);
    }
    g.animals = g.animals.filter((a) => a.sp.id === 'duck' && Math.hypot(a.x - pen.cx, a.y - pen.cy) < 30);
    if (!window.__noStrays) g.spawnFlock('sheep', 1080, 470, 4);
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    if (scenario === 'barn') {
      const m = await import('/src/ui/build.ts');
      const c = await import('/src/ranch/catalog.ts');
      g.ranch.add(m.makeBuilding(c.defOf('barn'), 104, 104, 0));
    }
    g.day.t = 299.95;
    g.dog.x = pen.cx - 40; g.dog.y = pen.y1 + 30;
    const log = [];
    let steps = 0;
    while (g.mode === 'play' && steps < 60 * 70) {
      let ov = { x: 0, y: 0, sprint: false, lie: true };
      if (scenario === 'defended') {
        const act = g.predators.filter((p) => p.active && p.state !== 'flee');
        if (act.length) {
          act.sort((a, b) => Math.hypot(a.x - g.dog.x, a.y - g.dog.y) - Math.hypot(b.x - g.dog.x, b.y - g.dog.y));
          const p = act[0], dx = p.x - g.dog.x, dy = p.y - g.dog.y, d = Math.hypot(dx, dy);
          ov = { x: dx / d, y: dy / d, sprint: d > 60, lie: false };
          if (d < 45 && steps % 50 === 0) g.input.push('bark');
        }
      }
      g.input.override = ov;
      g.update(1 / 60);
      g.input.clearQueue();
      steps++;
      if (steps % 600 === 0) log.push(g.predators.map((p) => `${p.kind[0]}:${p.state}`).join(' '));
    }
    g.input.override = null;
    return { scenario, nightSeconds: +(steps / 60).toFixed(1), mode: g.mode, lost: g.stats.lost, penned: pen.animals.length, noLoss: g.totals.nightsNoLoss, log };
  }, scenario);
  console.log(JSON.stringify(r));
  if (scenario === 'undefended') await page.screenshot({ path: 'shots/night-end.png' });
  await page.close();
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
