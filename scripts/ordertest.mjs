// Orders end to end: a buyer wants sheep; let them out of the pen with E at
// the gate, drive them up the north road to the drover's yard, get paid.
//   node scripts/ordertest.mjs [--style=calm|bark]
import { chromium } from 'playwright';
import { createServer } from 'vite';

const style = (process.argv.find((a) => a.startsWith('--style=')) || '--style=calm').slice(8);
const server = await createServer({ server: { port: 5214, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
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
await page.goto('http://localhost:5214/?debug');
await page.waitForFunction(() => window.game);
const r = await page.evaluate(async ({ style, trace }) => {
  const g = window.game;
  const bot = await import('/src/bot.ts');
  const orders = await import('/src/systems/orders.ts');
  const { Animal } = await import('/src/entities/animal.ts');
  g.setTier(3, false);
  g.tut = 99;
  g.tip = null;
  g.animals.length = 0;
  g.day.t = 20;
  const pen = g.ranch.pens[0];
  for (let i = 0; i < 6; i++) {
    const a = new Animal('sheep', pen.ix0 + 8 + (i % 3) * 12, pen.iy0 + 10 + Math.floor(i / 3) * 12);
    a.pen = pen; pen.animals.push(a); pen.species = 'sheep'; g.animals.push(a);
  }
  g.orders.list = [{ id: 1, yard: 'drover', species: 'sheep', n: 4, due: orders.hourToT(17), got: 0, paid: 0, state: 'open' }];
  const coins0 = g.coins;
  const log = {};
  const step = (n, ov) => { for (let i = 0; i < n; i++) { g.input.override = ov; g.update(1 / 60); g.input.clearQueue(); } };
  // Walk to the gate (south side) and press E.
  const gp = pen.gatePoint(9);
  g.dog.x = gp.x; g.dog.y = gp.y; g.dog.hx = 0; g.dog.hy = -1;
  step(5, { x: 0, y: -0.2, sprint: false, lie: false });
  log.hint = g.hint();
  g.input.push('nip');
  step(1, { x: 0, y: 0, sprint: false, lie: false });
  log.letOut = pen.letOut;
  log.hint2 = g.hint();
  // Walk in round the back of them and push them out.
  const route = [pen.gatePoint(-6), { x: pen.ix1 - 6, y: pen.cy }, { x: pen.cx, y: pen.iy0 + 5 }];
  let t = 0, wp = 0;
  while (t < 30 && pen.animals.length > 0) {
    const tgt = route[wp];
    if (wp < route.length - 1 && Math.hypot(tgt.x - g.dog.x, tgt.y - g.dog.y) < 3) wp++;
    const dx = tgt.x - g.dog.x, dy = tgt.y - g.dog.y, d = Math.hypot(dx, dy);
    step(1, { x: d > 2 ? dx / d * Math.min(1, d / 8) : 0, y: d > 2 ? dy / d * Math.min(1, d / 8) : 0, sprint: false, lie: false });
    t += 1 / 60;
    if (trace && Math.round(t * 60) % 60 === 0) (log.trace ??= []).push(`t${t.toFixed(0)} dog ${g.dog.x.toFixed(0)},${g.dog.y.toFixed(0)} wp${wp} swing ${pen.swing.toFixed(2)} let ${pen.letOut} sheep ${pen.animals.map((a) => `${a.x.toFixed(0)},${a.y.toFixed(0)},${a.pressure.toFixed(2)}`).join(' ')}`);
  }
  // And back out through the gate after them.
  for (const to of [pen.gatePoint(-6), pen.gatePoint(14)]) {
    for (let k = 0; k < 180 && Math.hypot(to.x - g.dog.x, to.y - g.dog.y) > 3; k++) {
      const dx = to.x - g.dog.x, dy = to.y - g.dog.y, d = Math.hypot(dx, dy);
      step(1, { x: dx / d * Math.min(1, d / 8), y: dy / d * Math.min(1, d / 8), sprint: false, lie: false });
      t += 1 / 60;
    }
  }
  log.out = { seconds: +t.toFixed(1), left: pen.animals.length, loose: g.animals.filter((a) => !a.pen).length, home: g.animals.filter((a) => a.home).length };
  // Drive them: out of the ranch, up the north road, right into the nook.
  const yard = orders.yardOf(g, 'drover');
  const legs = [{ x: 796, y: 818 }, { x: 770, y: 700 }, { x: 772, y: 640 }, yard.pen.gatePoint(20), yard.pen.gatePoint(-12)];
  let leg = 0; t = 0;
  const o = style === 'bark' ? { bark: 2 } : {};
  let peak = 0;
  while (t < 240 && g.orders.list[0].state === 'open') {
    const flock = g.animals.filter((a) => !a.pen && !a.gone);
    let cx = 0, cy = 0;
    for (const a of flock) { cx += a.x; cy += a.y; peak = Math.max(peak, a.stress); }
    cx /= Math.max(1, flock.length); cy /= Math.max(1, flock.length);
    if (leg < legs.length - 1 && Math.hypot(cx - legs[leg].x, cy - legs[leg].y) < 22) leg++;
    const c = bot.botStep(g, { goalX: legs[leg].x, goalY: legs[leg].y, ...o }, t);
    if (c.bark) g.input.push('bark');
    step(1, { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie });
    t += 1 / 60;
  }
  const ord = g.orders.list[0];
  log.drive = { seconds: +t.toFixed(1), leg, state: ord.state, got: ord.got, paid: ord.paid, peak: +peak.toFixed(2) };
  // The buyer leads them away; leftovers stay loose.
  step(240, { x: 0, y: 0, sprint: false, lie: true });
  log.after = { coins: g.coins - coins0, filled: g.totals.orders, calmOrders: g.totals.calmOrders, yard: yard.pen.animals.length, gone: g.animals.filter((a) => a.gone).length, penLeft: pen.animals.length, banner: g.banner?.big, small: g.banner?.small, gateOpen: yard.pen.open };
  // Bring the spares home: they should pay nothing.
  const coins1 = g.coins;
  g.animals = g.animals.filter((a) => !a.gone);
  const spare = g.animals.filter((a) => !a.pen);
  log.spares = spare.length;
  return log;
}, { style, trace: !!process.env.TRACE });
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: 'shots/ordertest.png' });
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
