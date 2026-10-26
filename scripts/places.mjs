// Screenshot every hidden place at real scale, and the way in to it from its
// region (where the waymarker cairn stands):
//   node scripts/places.mjs [--out=shots/places] [--only=circle,hut] [--found] [--night] [--half] [--done]
// Writes <out>/<place>.png and <out>/<place>-way.png at 1280x720.
// --found discovers every place first (flowers on the waymarkers, the hurdle
// open, keepsakes taken); without it they are as a new player finds them.
// --half sets every valley project halfway; --done finishes them all (and
// celebrates them today), to see the places before, during and after.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const out = opt('out', 'shots/places');
const only = opt('only', '') ? opt('only', '').split(',') : null;

const PORT = Number(process.env.SHOT_PORT || 5222);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
const spots = await page.evaluate(async ({ found, night, half, done }) => {
  const { PLACES } = await import('/src/world/places.ts');
  const { PROJECTS } = await import('/src/systems/projects.ts');
  const g = window.game;
  g.setTier(5);
  g.tut = 99;
  g.tipsSeen = new Set(['hills', 'rocky', 'ford', 'high', 'show', 'night', 'waymark', 'rest']);
  g.day.phase = 'day';
  g.day.t = 60;
  if (night) { g.day.startNight(); g.quietT = -1e9; }
  g.discovery.morning(g); // strays and wild flocks in their places
  if (found) {
    for (const p of PLACES) g.discovery.found.add(p.id);
    for (const k of ['bell', 'crook', 'horn', 'whistle', 'rosette']) g.discovery.keepsakes.add(k);
    g.map.setHurdle(true);
    g.discovery.hurdleSwing = 1;
  }
  if (half || done) {
    for (const p of PROJECTS) {
      if (p.place) g.discovery.found.add(p.place);
      if (done) {
        g.projects.done.add(p.id);
        g.projects.celebrated[p.id] = g.day.day;
      } else if (p.kind === 'graze') g.projects.grazed[p.id] = p.need / 2;
      else g.projects.deliveredFrom[p.id] = p.piles.map((q, i) => (i < p.piles.length / 2 || p.piles.length === 1 ? Math.floor(q.n / 2) || (p.piles.length > 1 ? 1 : 0) : 0));
    }
    g.map.setProjects(g.projects);
  }
  return PLACES.map((p) => {
    const mid = p.rx ? [p.cx, p.cy] : p.way[p.way.length - 2];
    return { id: p.id, x: mid[0] * 8 + 4, y: mid[1] * 8 + 4, wx: p.mark[0] * 8 + 4, wy: p.mark[1] * 8 + 4, way: p.way.map(([x, y]) => [x * 8 + 4, y * 8 + 4]) };
  });
}, { found: flag('found'), night: flag('night'), half: flag('half'), done: flag('done') });

async function shoot(file, camX, camY, dogX, dogY) {
  await page.evaluate(({ camX, camY, dogX, dogY }) => {
    const g = window.game;
    g.dog.x = dogX;
    g.dog.y = dogY;
    g.dog.vx = g.dog.vy = 0;
    g.cam.x = camX;
    g.cam.y = camY;
  }, { camX, camY, dogX, dogY });
  await page.waitForTimeout(500);
  await page.evaluate(({ camX, camY }) => {
    const g = window.game;
    g.cam.x = camX;
    g.cam.y = camY;
    g.banner = null;
    g.tip = null;
    g.place = null;
  }, { camX, camY });
  await page.waitForTimeout(80);
  await page.screenshot({ path: file });
  console.log(file);
}

for (const s of spots) {
  if (only && !only.includes(s.id)) continue;
  // The way in: from the waymarker, looking along the gap.
  const [ax, ay] = s.way[0], [bx, by] = s.way[Math.min(1, s.way.length - 1)];
  await shoot(`${out}/${s.id}-way.png`, (s.wx + bx) / 2, (s.wy + by) / 2, ax - (bx - ax) * 0.3, ay - (by - ay) * 0.3);
  // The place itself, with the dog standing by its way in.
  const [ex, ey] = s.way[s.way.length - 1];
  await shoot(`${out}/${s.id}.png`, s.x, s.y, ex, ey);
}
if (errors.length) console.log('errors:\n  ' + errors.join('\n  '));
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
