// Driving ewes with lambs at foot. A lamb keeps to its mother; a ewe cut
// off from her lamb turns back for it and frets. So a flock with lambs has
// to be driven gently, as pairs: the calm drive keeps the pairs together and
// arrives; barking and chasing part them and stress everyone.
//   node scripts/lambtest.mjs [--seed=N]
// Prints the table and PASS/FAIL checks; exits 1 on a failure or console error.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.LAMB_PORT || 5241);
const seedArg = process.argv.find((x) => x.startsWith('--seed='));
const SEED = seedArg ? Number(seedArg.slice(7)) : 1;
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
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
}, SEED);
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.sim);

const res = await page.evaluate(async () => {
  const g = window.game;
  const { botStep } = await import('/src/bot.ts');
  const { lambFor } = await import('/src/systems/seasonal.ts');
  const start = { x: 768, y: 740 }, goal = { x: 880, y: 900 }, dogAt = { x: 700, y: 700 };
  // Eight ewes, five with a lamb at foot (or none, to compare).
  const setup = (withLambs) => {
    window.resetFlock('sheep', start.x, start.y, 8, dogAt.x, dogAt.y);
    const ewes = g.animals.slice();
    if (withLambs) for (const e of ewes.slice(0, 5)) g.animals.push(lambFor(e));
    for (let i = 0; i < 60; i++) { g.input.override = { x: 0, y: 0, sprint: false, lie: true }; g.update(1 / 60); }
    return ewes;
  };
  const apartOf = (l) => Math.hypot(l.x - l.mother.x, l.y - l.mother.y);
  const drive = (o, withLambs, secs = 120) => {
    setup(withLambs);
    const dt = 1 / 60;
    let t = 0, sumS = 0, nS = 0, peak = 0, panics = 0, apartT = 0, maxApart = 0, reached = false;
    const was = new Set();
    while (t < secs) {
      if (g.day.t > 200) g.day.t = 20;
      const c = botStep(g, { goalX: goal.x, goalY: goal.y, ...o }, t);
      g.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
      if (c.bark) g.input.push('bark');
      if (c.nip) g.input.push('nip');
      g.update(dt);
      g.input.clearQueue();
      t += dt;
      const flock = g.animals.filter((a) => !a.pen && !a.gone);
      let cx = 0, cy = 0;
      for (const a of flock) {
        cx += a.x; cy += a.y; sumS += a.stress; nS++;
        peak = Math.max(peak, a.stress);
        if (a.panicT > 0 && !was.has(a)) { panics++; was.add(a); }
        if (a.panicT <= 0) was.delete(a);
      }
      for (const l of flock) if (l.young && l.mother) {
        const d = apartOf(l);
        maxApart = Math.max(maxApart, d);
        if (d > 44) apartT += dt;
      }
      cx /= flock.length; cy /= flock.length;
      if (!o.chase && Math.hypot(cx - goal.x, cy - goal.y) < 24) { reached = true; break; }
    }
    g.input.override = null;
    const lambs = g.animals.filter((a) => a.young && a.mother);
    const kept = lambs.filter((l) => apartOf(l) < 30).length;
    return { reached, t: +t.toFixed(1), meanStress: +(sumS / Math.max(1, nS)).toFixed(3), peak: +peak.toFixed(2), panics, kept: `${kept}/${lambs.length}`, keptN: kept, apartS: +apartT.toFixed(1), maxApart: Math.round(maxApart) };
  };
  const out = { table: [], checks: [] };
  const check = (name, ok, info) => out.checks.push({ name, ok: !!ok, info });
  const scen = [
    ['calm walk', {}],
    ['keyboard crowd', { keyboard: true, crowd: 0.7 }],
    ['bark every 2s', { bark: 2 }],
    ['bark every 0.8s', { bark: 0.8 }],
    ['crowd + sprint', { sprint: true, crowd: 1 }],
    ['chase (sprint)', { chase: true, sprint: true }],
  ];
  const R = {};
  for (const [name, o] of scen) {
    const runs = [0, 1, 2].map(() => drive(o, true, o.chase ? 20 : 120));
    const avg = (k) => +(runs.reduce((s, r) => s + Number(r[k]), 0) / runs.length).toFixed(2);
    R[name] = { reached: runs.filter((r) => r.reached).length, t: avg('t'), meanStress: avg('meanStress'), peak: avg('peak'), panics: avg('panics'), kept: avg('keptN'), apartS: avg('apartS'), maxApart: avg('maxApart') };
    out.table.push(`${name.padEnd(16)} reached ${R[name].reached}/3  t=${R[name].t}s  meanStress=${R[name].meanStress}  peak=${R[name].peak}  panics=${R[name].panics}  pairs kept=${R[name].kept}/5  apart=${R[name].apartS}s  maxApart=${R[name].maxApart}`);
  }
  // The same calm drive without lambs, for what lambs cost in time.
  const plain = [0, 1, 2].map(() => drive({}, false));
  const plainT = +(plain.reduce((s, r) => s + r.t, 0) / 3).toFixed(1);
  out.table.push(`calm, no lambs   reached ${plain.filter((r) => r.reached).length}/3  t=${plainT}s`);

  const calm = R['calm walk'], bark = R['bark every 0.8s'], chase = R['chase (sprint)'];
  check('the calm drive arrives with the pairs together', calm.reached === 3 && calm.kept >= 4, calm);
  check('lambs slow a calm drive a little, not a lot', calm.t < plainT * 1.6, { withLambs: calm.t, without: plainT });
  check('barking parts more pairs and stresses more than calm', bark.meanStress > calm.meanStress * 2 && (bark.apartS > calm.apartS || bark.kept < calm.kept), { calm: [calm.meanStress, calm.apartS], bark: [bark.meanStress, bark.apartS] });
  check('chasing scatters lambs from their mothers', chase.apartS > calm.apartS && chase.panics > 0, { calm: calm.apartS, chase: chase.apartS });

  // A ewe cut off from her lamb turns back for it, even with the dog lying
  // down: and a ewe with no lamb stays put.
  const cut = (withLamb) => {
    window.resetFlock('sheep', 1150, 420, 1, 1000, 300); // open grass on the hills
    const ewe = g.animals[0];
    let lamb = null;
    if (withLamb) {
      lamb = lambFor(ewe);
      g.animals.push(lamb);
      lamb.x = ewe.x - 80; lamb.y = ewe.y;
    }
    const spot = { x: ewe.x - 80, y: ewe.y };
    const d0 = Math.hypot(ewe.x - spot.x, ewe.y - spot.y);
    let st = 0;
    for (let i = 0; i < 10 * 60; i++) { g.input.override = { x: 0, y: 0, sprint: false, lie: true }; g.update(1 / 60); st = Math.max(st, ewe.stress); }
    g.input.override = null;
    return { gap0: Math.round(d0), gap: Math.round(lamb ? Math.hypot(ewe.x - lamb.x, ewe.y - lamb.y) : Math.hypot(ewe.x - spot.x, ewe.y - spot.y)), fret: +st.toFixed(2) };
  };
  const mum = cut(true), lone = cut(false);
  check('a ewe cut off from her lamb turns back for it', mum.gap < 30 && lone.gap > 50, { withLamb: mum, noLamb: lone });
  check('and frets while they are apart', mum.fret > lone.fret + 0.05, { withLamb: mum.fret, noLamb: lone.fret });
  return out;
});

console.log(`seed ${SEED}`);
for (const l of res.table) console.log(l);
let fails = 0;
for (const r of res.checks) {
  if (!r.ok) fails++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  ${JSON.stringify(r.info)}`);
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
await server.close();
process.exit(fails || errors.length ? 1 : 0);
