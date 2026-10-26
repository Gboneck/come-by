// Day one's money: whatever the first drive home is like, the kennel must
// be affordable by the end of the day (and straight away after a calm one).
//   node scripts/daytest.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.DAY_PORT || 5216); // pacetest uses 5216 too
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};

// A fresh day one: five ducks (the fewest that spawn) 60px south of the
// pen gate, driven home calmly or roughly, starting at `startT` seconds.
async function run(label, { bark = 0, sprint = false, startT = 20, frantic = false, penAt = 0 }) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.sim);
  const r = await page.evaluate(async ({ bark, sprint, startT, frantic, penAt }) => {
    const g = window.game;
    const { defOf } = await import('/src/ranch/catalog.ts');
    const kennel = defOf('kennel').cost;
    const start = g.coins;
    const pen = g.ranch.pens[0];
    const gp = pen.gatePoint(0);
    window.resetFlock('duck', gp.x + 10, gp.y + 60, 5, gp.x + 30, gp.y + 120);
    g.day.t = startT;
    // The worst a drive can pay: every duck frantic on the way home.
    if (frantic) for (const a of g.animals) a.peakStress = 0.95;
    window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true, bark, sprint }, 120);
    // Let the gate swing shut.
    g.input.override = { x: 0, y: 1, sprint: false, lie: false };
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    // runSim keeps its runs in daylight, so a late pen is set afterwards:
    // lateness only cuts how long the pen has to lay before the day ends.
    if (penAt) g.day.t = penAt;
    const penned = { ducks: pen.animals.length, coins: g.coins, clock: g.day.clock(), day: g.day.day };
    // Then wait out the day (no resting under the bot: the plain clock).
    for (let i = 0; i < 60 * 400 && g.mode === 'play'; i++) g.update(1 / 60);
    g.input.override = null;
    return { kennel, start, penned, end: { mode: g.mode, coins: g.coins, day: g.day.day } };
  }, { bark, sprint, startT, frantic, penAt });
  await page.close();
  console.log(`${label}: start ${r.start}$, penned ${r.penned.ducks} on day ${r.penned.day} at ${r.penned.clock} with ${r.penned.coins}$, end of day ${r.end.day}: ${r.end.coins}$ (${r.end.mode}); kennel ${r.kennel}$`);
  return r;
}

const calm = await run('calm, morning', {});
check('a calm first drive pays for the kennel at once', calm.penned.ducks === 5 && calm.penned.coins >= calm.kennel);
const rough = await run('barking and sprinting, morning', { bark: 1, sprint: true });
check('a rough first drive still pays for it by the end of the day', rough.end.mode === 'summary' && rough.end.coins >= rough.kennel);
const late = await run('barking and sprinting, late afternoon', { bark: 1, sprint: true, startT: 170 });
check('even a rough drive late in the day pays for it by the end of the day', late.end.mode === 'summary' && late.end.coins >= late.kennel);
const worst = await run('frantic, penned at dusk', { bark: 1, sprint: true, frantic: true, penAt: 238 });
check('the worst drive there is, penned at dusk, still pays for it by the end of the day', worst.penned.ducks === 5 && worst.penned.day === 1 && worst.end.day === 1 && worst.end.mode === 'summary' && worst.end.coins >= worst.kennel);

check('no console errors', !errors.length, errors.join(' | '));
console.log(failed ? `${failed} failed` : 'all passed');
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
