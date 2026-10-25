// Sheepdog trial runs under bot control, per class and handling style.
// Calm handling should beat barking and chasing.
//   node scripts/trialtest.mjs [class ...] [--runs=3] [--prize]
import { chromium } from 'playwright';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const classes = args.filter((a) => !a.startsWith('--'));
const runs = Number((args.find((a) => a.startsWith('--runs=')) || '--runs=3').slice(7));
const prize = args.includes('--prize');
const server = await createServer({ server: { port: 5213, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
const seedArg = process.argv.find((x) => x.startsWith('--seed='));
if (seedArg) {
  // Exact runs: seeded Math.random and no live frame loop.
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
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5213/?debug');
await page.waitForFunction(() => window.game);

const styles = [
  { name: 'calm', o: {} },
  { name: 'bark 2s', o: { bark: 2 } },
  { name: 'crowd+sprint', o: { sprint: true, crowd: 1 } },
  { name: 'nip heels', o: { nip: true } },
];
for (const cls of classes.length ? classes : ['novice', 'open', 'cattle', 'cup']) {
  for (const st of styles) {
    if (st.name === 'nip heels' && cls !== 'cattle') continue;
    const out = [];
    for (let i = 0; i < runs; i++) {
      const r = await page.evaluate(async ({ cls, o, prize }) => {
        const g = window.game;
        const bot = await import('/src/bot.ts');
        const tr = await import('/src/systems/trials.ts');
        g.setTier(5, false);
        g.animals.length = 0;
        g.predators = [];
        g.mode = 'play';
        g.day.t = 30;
        g.day.phase = 'day';
        g.tut = 99;
        g.tip = null;
        // Unlock exactly the classes up to this one.
        const idx = tr.CLASSES.findIndex((c) => c.id === cls);
        g.trials.won = tr.CLASSES.slice(0, idx).map((c) => c.id);
        g.trials.lastPrizeDay = 0;
        g.day.day = prize ? 3 : 4;
        const p = g.ranch.course.post;
        g.dog.x = p.x; g.dog.y = p.y + 6; g.dog.vx = g.dog.vy = 0;
        if (!tr.startRun(g)) return { err: 'no start' };
        const res = bot.runTrial(g, o, 300);
        if (!res) return { err: 'no result', step: g.trials.run?.step, t: g.trials.run?.t };
        const parts = Object.fromEntries(res.parts.map((x) => [x.name.split(' ')[0], x.got]));
        const run = g.trials.run;
        const out = { total: res.total, place: res.place, time: Math.round(run.t), faults: res.faults, bolts: run.bolts, grips: run.grips, ...parts };
        tr.closeResult(g);
        return out;
      }, { cls, o: st.o, prize });
      out.push(r);
    }
    const avg = (k) => (out.reduce((s, r) => s + (Number(r[k]) || 0), 0) / out.length).toFixed(1);
    const keys = ['OUTRUN', 'FETCH', 'ROUND', 'DRIVE', 'CROSS', 'PEN', 'CALM'];
    console.log(`${cls.padEnd(7)} ${st.name.padEnd(13)} total=${avg('total')} [${out.map((r) => r.total ?? r.err).join(',')}]  t=${avg('time')}s  ${keys.map((k) => `${k.toLowerCase()}=${avg(k)}`).join(' ')}  faults=${avg('faults')}`);
  }
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
