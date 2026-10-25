// Pacing: a decent-player bot (src/pacebot.ts) plays from day one until the
// valley thrives, and we log each tier: days, minutes at the controls,
// coins in and out, and every open goal that could not move on a day.
//   node scripts/pacetest.mjs [--seeds=1,2,3] [--days=45] [--verbose] [--out=shots/pace.json]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const maxDays = Number(arg('days', '45'));
const verbose = process.argv.includes('--verbose');
const outFile = arg('out', '');
const port = Number(process.env.PACE_PORT || 5216);
// No file watching: editing code while a long run goes must not reload it.
const server = await createServer({ server: { port, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const runs = [];
for (const seed of seeds) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // No live frame loop (the bot steps the game), and a seeded Math.random.
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
    try { localStorage.clear(); } catch { /* ignore */ }
  }, seed);
  await page.goto(`http://localhost:${port}/?debug`);
  await page.waitForFunction(() => window.game);
  await page.evaluate(async () => {
    const { Pacer } = await import('/src/pacebot.ts');
    window.__pace = new Pacer(window.game);
    window.game.tut = 99; // the bot needs no tutorial
  });
  const days = [];
  for (let d = 0; d < maxDays; d++) {
    const log = await page.evaluate(() => window.__pace.playDay());
    days.push(log);
    if (verbose) console.log(`seed ${seed} day ${log.day} T${log.tier} ${log.sky} ${log.real}s (rest ${log.rested}s) +${log.earned}$ -${log.spent}$ =${log.coins}$ choice ${log.choice}\n    did: ${log.did.join('; ')}${log.stuck.length ? `\n    stuck: ${log.stuck.join('; ')}` : ''}`);
    const won = await page.evaluate(() => window.game.won);
    if (won) break;
  }
  const end = await page.evaluate(() => ({ tier: window.game.tier, won: window.game.won, day: window.game.day.day, buildings: window.game.ranch.buildings.filter((b) => b.kind !== 'regiongate').map((b) => `${b.kind}@${b.tx},${b.ty}`).join(' ') }));
  if (process.argv.includes('--map')) {
    // ASCII ranch: buildings by letter, ':' buildable land, '-' road, ' ' other.
    console.log(await page.evaluate(() => {
      const g = window.game, b = g.build, rows = [];
      const letter = { pen: 'P', kennel: 'K', market: 'M', barn: 'B', windmill: 'W', farmhouse: 'H', gate: 'G', fence: 'F', trough: 'T' };
      for (let y = 84; y < 124; y++) {
        let row = '';
        for (let x = 70; x < 124; x++) {
          const bd = g.ranch.buildings.find((q) => q.kind !== 'regiongate' && x >= q.tx && x < q.tx + q.w && y >= q.ty && y < q.ty + q.h);
          row += bd ? letter[bd.kind] ?? '?' : g.map.path[y * 192 + x] ? '-' : b.buildable(g, x, y) ? ':' : ' ';
        }
        rows.push(row);
      }
      return rows.join('\n');
    }));
  }
  if (process.argv.includes('--shot')) {
    // The ranch as the bot left it, in build mode (shows the buildable land).
    await page.evaluate(() => {
      const g = window.game;
      g.input.override = null;
      for (let i = 0; i < 60; i++) g.update(1 / 60); // let any fade finish
      g.enterBuild();
      for (let i = 0; i < 30; i++) g.update(1 / 60);
      g.cam.x = 96 * 8; g.cam.y = 104 * 8;
      g.render();
      g.screen.present();
    });
    mkdirSync('shots', { recursive: true });
    await page.screenshot({ path: `shots/pace-ranch-${seed}.png` });
  }
  runs.push({ seed, days, end, errors });
  await page.close();
}
await browser.close();
await server.close();

// Per tier, averaged over the seeds.
const rows = [];
for (let tier = 1; tier <= 5; tier++) {
  const per = runs.map((r) => r.days.filter((d) => d.tier === tier));
  const have = per.filter((p) => p.length);
  if (!have.length) continue;
  const avg = (f) => (have.reduce((s, p) => s + f(p), 0) / have.length);
  const stuckDays = avg((p) => p.filter((d) => d.stuck.length && d.did.length === 0).length);
  const notes = new Map();
  for (const p of have) for (const d of p) for (const s of d.stuck) {
    const k = s.replace(/\d+\/\d+\$/, 'n$').replace(/ONLY \d+/, 'ONLY n').replace(/\d+S\b/, 'nS');
    notes.set(k, (notes.get(k) || 0) + 1);
  }
  rows.push({
    tier,
    days: avg((p) => p.length).toFixed(1),
    minutes: avg((p) => p.reduce((s, d) => s + d.real, 0) / 60).toFixed(1),
    rested: avg((p) => p.reduce((s, d) => s + d.rested, 0) / 60).toFixed(1),
    earned: Math.round(avg((p) => p.reduce((s, d) => s + d.earned, 0))),
    spent: Math.round(avg((p) => p.reduce((s, d) => s + d.spent, 0))),
    choice: avg((p) => p.reduce((s, d) => s + d.choice, 0) / p.length).toFixed(1),
    income: ['stock', 'goods', 'orders', 'trials'].map((k) => `${k} ${Math.round(avg((p) => p.reduce((s, d) => s + (d.income?.[k] ?? 0), 0)))}`).join(', '),
    perDay: Math.round(avg((p) => p.reduce((s, d) => s + d.earned, 0) / p.length)),
    coinsEnd: Math.round(avg((p) => p[p.length - 1].coins)),
    penned: Math.round(avg((p) => p[p.length - 1].penned ?? 0)),
    idleDays: stuckDays.toFixed(1),
    notes: [...notes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} x${n}`).join('; '),
  });
}
console.log('| tier | days | play min | resting min | earned $ | spent $ | choices at day end | days nothing moved | stuck on (count over all seeds) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.tier} | ${r.days} | ${r.minutes} | ${r.rested} | ${r.earned} | ${r.spent} | ${r.choice} | ${r.idleDays} | ${r.notes} |`);
console.log('\n| tier | earned per day $ | where it came from | stock penned at tier end | purse at tier end $ |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.tier} | ${r.perDay} | ${r.income} | ${r.penned} | ${r.coinsEnd} |`);
for (const r of runs) console.log(`seed ${r.seed}: ${r.end.won ? 'valley thrives' : `tier ${r.end.tier}`} on day ${r.end.day}${r.errors.length ? `  ERRORS ${r.errors.slice(0, 3).join(' | ')}` : ''}`);
if (outFile) {
  mkdirSync('shots', { recursive: true });
  writeFileSync(outFile, JSON.stringify(runs, null, 1));
}
