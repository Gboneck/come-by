// Herding tuning harness: runs bot-driven scenarios in the real game code,
// fast-forwarded, and prints metrics. Calm driving should beat barking.
//   node scripts/tune.mjs [species] [count] [--weather=wind|rain|fog|storm] [--season=winter] [--seed=N]
// --seed makes a run exact (seeded Math.random, no live frame loop), so a
// before/after comparison shows only what the code change did.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const species = pos[0] || 'sheep';
const count = Number(pos[1] || 12);
const port = Number(process.env.TUNE_PORT || 5197); // set one when several checkouts tune at once
const server = await createServer({ server: { port, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const seedArg = process.argv.find((x) => x.startsWith('--seed='));
if (seedArg) {
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
  }, Number(seedArg.slice(7)));
}
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const skyArg = process.argv.find((x) => x.startsWith('--weather='));
const seasonArg = process.argv.find((x) => x.startsWith('--season='));
await page.goto(`http://localhost:${port}/?debug${skyArg ? `&weather=${skyArg.slice(10)}` : ''}${seasonArg ? `&season=${seasonArg.slice(9)}` : ''}`);
await page.waitForFunction(() => window.sim);
const helpArg = process.argv.find((x) => x.startsWith('--helpers='));
const tierArg = process.argv.find((x) => x.startsWith('--tier='));
if (tierArg) await page.evaluate((n) => window.game.setTier(n, false), Number(tierArg.slice(7)));

// Default: flock in the north of the ranch, goal in its south-east corner.
// Override with --start=x,y --goal=x,y --dog=x,y --only=name1,name2
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  if (!a) return d;
  const [x, y] = a.slice(k.length + 3).split(',').map(Number);
  return { x, y };
};
const start = arg('start', { x: 768, y: 740 }), goal = arg('goal', { x: 880, y: 900 }), dog = arg('dog', { x: 700, y: 700 });
const onlyArg = process.argv.find((x) => x.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',') : null;
const scenarios = [
  { name: 'calm walk', o: {} },
  { name: 'bark every 2s', o: { bark: 2 } },
  { name: 'bark every 0.8s', o: { bark: 0.8 } },
  { name: 'sprint', o: { sprint: true } },
  { name: 'crowd + sprint', o: { sprint: true, crowd: 1 } },
  { name: 'keyboard', o: { keyboard: true } },
  { name: 'keyboard crowd', o: { keyboard: true, crowd: 0.7 } },
  { name: 'kb sprint crowd', o: { keyboard: true, crowd: 0.7, sprint: true } },
  { name: 'nip heels', o: { nip: true } },
  { name: 'chase (walk)', o: { chase: true } },
  { name: 'chase (sprint)', o: { chase: true, sprint: true } },
];
for (const sc of scenarios.filter((s) => !only || only.includes(s.name))) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const r = await page.evaluate(async ({ species, count, start, goal, dog, o, helpers }) => {
      window.resetFlock(species, start.x, start.y, count, dog.x, dog.y);
      if (helpers) {
        const { Helper } = await import('/src/entities/helper.ts');
        window.game.helpers = Array.from({ length: helpers }, (_, i) => new Helper('H' + i, dog.x - 10, dog.y + 10, 'flank', i));
      }
      return window.sim({ goalX: goal.x, goalY: goal.y, ...o }, o.chase ? 20 : 120);
    }, { species, count, start, goal, dog, o: sc.o, helpers: helpArg ? Number(helpArg.slice(10)) : 0 });
    runs.push(r);
  }
  const avg = (k) => (runs.reduce((s, r) => s + Number(r[k]), 0) / runs.length).toFixed(2);
  console.log(`${sc.name.padEnd(16)} reached ${runs.filter((r) => r.reached).length}/3  t=${avg('seconds')}s  meanStress=${avg('meanStress')}  peak=${avg('peakStress')}  groups=${avg('maxGroups')}  panics=${avg('panics')}`);
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
