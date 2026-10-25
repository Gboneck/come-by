// Getting an order's flock across a built-up ranch. Builds a dense ranch
// (pens, barn, market, kennel, fences), lets six sheep out of a pen with E
// and drives four of them to each buyer's yard. Prints seconds per yard.
//   node scripts/transittest.mjs [--layout=player|road] [--seeds=1,2,3] [--map]
// `player`: what players build without the drove road (pens and buildings
// on and beside the roads). `road`: the same buildings kept off the road.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const layout = arg('layout', 'player');
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const port = Number(process.env.TRANSIT_PORT || 5218);
const server = await createServer({ server: { port, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();

// [item, tx, ty, rot] in tiles. The sheep pen is the first pen listed.
const LAYOUTS = {
  // Cramped, as players build without the road: the way out is 2-3 tiles
  // between pens, the barn and a fence end.
  player: [
    ['pen', 98, 108, 2], ['pen', 106, 99, 0], ['pen', 88, 108, 2], ['pen', 78, 101, 2],
    ['barn', 115, 101, 0], ['market', 90, 101, 0], ['kennel', 99, 99, 0],
    ['fence', 114, 106, 1], ['fence', 114, 107, 1], ['fence', 96, 107, 1],
  ],
  // The east road walled off almost completely.
  blocked: [
    ['pen', 98, 108, 2], ['pen', 106, 101, 0], ['pen', 88, 108, 2], ['pen', 78, 101, 2],
    ['barn', 114, 99, 0], ['market', 90, 102, 0], ['kennel', 99, 99, 0],
    ['fence', 92, 106, 0], ['fence', 93, 106, 0], ['fence', 116, 105, 1], ['fence', 116, 106, 1],
  ],
  road: [
    ['pen', 98, 109, 2], ['pen', 106, 109, 2], ['pen', 88, 109, 2], ['pen', 77, 107, 1],
    ['barn', 113, 94, 0], ['market', 79, 95, 0], ['kennel', 80, 99, 0],
    ['fence', 96, 109, 1], ['fence', 105, 109, 1],
  ],
};

const rows = [];
for (const seed of seeds) {
  for (const yard of ['mill', 'drover', 'sale']) {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
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
    }, seed);
    await page.goto(`http://localhost:${port}/?debug`);
    if (process.argv.includes('--trace')) await page.evaluate(() => { window.__trace = true; });
    await page.waitForFunction(() => window.game);
    const r = await page.evaluate(async ({ yard, plan, map }) => {
      const g = window.game;
      const { Pacer } = await import('/src/pacebot.ts');
      const { makeBuilding } = await import('/src/ui/build.ts');
      const { defOf } = await import('/src/ranch/catalog.ts');
      const { Animal } = await import('/src/entities/animal.ts');
      const orders = await import('/src/systems/orders.ts');
      g.tut = 99;
      g.tip = null;
      g.setTier(4, false);
      g.animals.length = 0;
      // The dense ranch (placed directly, as an old save would have it).
      g.ranch.buildings = g.ranch.buildings.filter((b) => b.kind === 'regiongate' || b.kind === 'farmhouse');
      const broken = [];
      for (const [id, tx, ty, rot] of plan) {
        const b = makeBuilding(defOf(id), tx, ty, rot);
        const why = g.ranch.placementProblem?.(b.kind, b.tx, b.ty, b.w, b.h, rot);
        if (why) broken.push(`${id}@${tx},${ty}: ${why}`);
        g.ranch.buildings.push(b);
      }
      g.ranch.restamp();
      const pen = g.ranch.pens[0];
      for (let i = 0; i < 6; i++) {
        const a = new Animal('sheep', pen.ix0 + 8 + (i % 3) * 12, pen.iy0 + 10 + Math.floor(i / 3) * 12);
        a.pen = pen; pen.animals.push(a); pen.species = 'sheep'; g.animals.push(a);
      }
      g.day.t = 20;
      g.orders.list = [{ id: 1, yard, species: 'sheep', n: 4, due: orders.hourToT(19), got: 0, paid: 0, state: 'open' }];
      const p = new Pacer(g);
      p.assist = false;
      const y = orders.yardOf(g, yard);
      const t0 = p.real;
      const herd = p.letOut(pen, 6);
      const out = p.real - t0;
      const trace = [];
      if (map !== null && window.__trace) {
        const of = p.frame.bind(p);
        let n = 0;
        p.frame = (cmd, act) => {
          if (n++ % 300 === 0) {
            const l = herd.filter((a) => !a.pen && !a.gone);
            const c = l.reduce((s, a) => ({ x: s.x + a.x / l.length, y: s.y + a.y / l.length }), { x: 0, y: 0 });
            trace.push(`${Math.round(n / 60)}s flock ${Math.round(c.x / 8)},${Math.round(c.y / 8)} (${l.length}) dog ${Math.round(g.dog.x / 8)},${Math.round(g.dog.y / 8)}`);
          }
          of(cmd, act);
        };
      }
      const res = p.drive(herd, y.pen.gatePoint(24), y.pen.gatePoint(-12), {}, 240, () => g.orders.list[0].state !== 'open');
      const o = g.orders.list[0];
      const where = herd.map((a) => (a.pen === y.pen ? 'Y' : a.pen ? 'P' : `${Math.round(a.x / 8)},${Math.round(a.y / 8)}${a.stray ? 's' : ''}`)).join(' ');
      let ascii = '';
      if (map) {
        const rowsA = [];
        for (let ty = 86; ty < 122; ty++) {
          let row = '';
          for (let tx = 70; tx < 124; tx++) {
            const bd = g.ranch.buildings.find((q) => q.kind !== 'regiongate' && tx >= q.tx && tx < q.tx + q.w && ty >= q.ty && ty < q.ty + q.h);
            row += bd ? ({ pen: 'P', kennel: 'K', market: 'M', barn: 'B', farmhouse: 'H', fence: 'F' }[bd.kind] ?? '?') : g.map.path[ty * 192 + tx] ? '-' : g.ranch.onRoad?.(tx, ty) ? '=' : g.build.buildable(g, tx, ty) ? ':' : ' ';
          }
          rowsA.push(row);
        }
        ascii = rowsA.join('\n');
      }
      return { out: Math.round(out), drive: Math.round(res.secs), total: Math.round(p.real - t0), got: o.got, done: o.state === 'done', ascii, broken, trace, where };
    }, { yard, plan: LAYOUTS[layout], map: process.argv.includes('--map') && seed === seeds[0] && yard === 'mill' });
    if (r.ascii) console.log(r.ascii);
    if (r.trace?.length) console.log(`  ${yard}: ${r.trace.join(' | ')}`);
    if (seed === seeds[0] && yard === 'mill') console.log(r.broken?.length ? `layout breaks the placement rules: ${r.broken.join('; ')}` : 'layout follows the placement rules');
    rows.push({ seed, yard, ...r, errors: errors.length });
    console.log(`seed ${seed} ${yard.padEnd(6)} let out ${r.out}s, drive ${r.drive}s, ${r.got}/4 ${r.done ? 'delivered' : 'NOT DELIVERED'} (total ${r.total}s)${r.done ? '' : ` [sheep at ${r.where}]`}${errors.length ? ` ERRORS ${errors[0]}` : ''}`);
    await page.close();
  }
}
for (const yard of ['mill', 'drover', 'sale']) {
  const rs = rows.filter((r) => r.yard === yard);
  const done = rs.filter((r) => r.done);
  console.log(`${layout} ${yard.padEnd(6)} delivered ${done.length}/${rs.length}, mean total ${Math.round(rs.reduce((s, r) => s + r.total, 0) / rs.length)}s${done.length ? `, mean when delivered ${Math.round(done.reduce((s, r) => s + r.total, 0) / done.length)}s` : ''}`);
}
await browser.close();
await server.close();
