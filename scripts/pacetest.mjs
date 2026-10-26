// Pacing: a decent-player bot (src/pacebot.ts) plays from day one until the
// valley thrives, and we log each tier: days, minutes at the controls,
// coins in and out, and every open goal that could not move on a day.
//   node scripts/pacetest.mjs [--seeds=1,2,3] [--days=45] [--verbose] [--out=shots/pace.json]
//   --year: play on after the valley thrives (to --days) and print a table
//   per season: hay bought, hungry nights, lambs, the shearer, the fair.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const maxDays = Number(arg('days', '45'));
const verbose = process.argv.includes('--verbose');
const year = process.argv.includes('--year');
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
    // Every coin the game pays, by the system that paid it (the first frame
    // of the stack that names one).
    const g = window.game, earn = g.earn.bind(g);
    const SRC = [[/onRanchEvent/, 'stock'], [/endDay/, 'goods'], [/systems\/favour\.ts/, 'favour'], [/systems\/orders\.ts/, 'orders'], [/systems\/trials\.ts/, 'trials'], [/systems\/seasonal\.ts/, 'fair'], [/systems\/farmwork\.ts/, 'farmwork'], [/systems\/valley\.ts/, 'valley'], [/systems\/projects\.ts/, 'projects'], [/systems\/loot\.ts/, 'loot'], [/systems\/discovery\.ts/, 'places'], [/systems\/progression\.ts/, 'legacy'], [/systems\/achievements\.ts/, 'badges'], [/net\/travels\.ts/, 'travels']];
    window.__src = {};
    g.earn = (n) => {
      const lines = (new Error().stack || '').split('\n').slice(2);
      let k = 'other';
      for (const l of lines) {
        const hit = SRC.find(([re]) => re.test(l));
        if (hit) { k = hit[1]; break; }
      }
      window.__src[k] = (window.__src[k] || 0) + n;
      return earn(n);
    };
  });
  const days = [];
  let wonDay = 0;
  for (let d = 0; d < maxDays; d++) {
    const log = await page.evaluate(async () => {
      const g = window.game, P = window.__pace;
      const { calendar } = await import('/src/systems/season.ts');
      const Z = await import('/src/systems/seasonal.ts');
      const c = calendar(g.day.day);
      const hay0 = P.hayBought ?? 0, rare0 = P.rareBought ?? 0, lambs0 = g.totals.lambs, born0 = g.totals.born ?? 0, lot0 = P.lotBought ?? 0, hungry0 = g.seasonal.hungryNights, ribbons0 = g.totals.fairRibbons.reduce((s, n) => s + n, 0);
      const wild0 = g.animals.filter((a) => !a.pen && !a.gone && !a.trial).length;
      const src0 = { ...window.__src };
      const out = P.playDay();
      const src = Object.fromEntries(Object.entries(window.__src).map(([k, v]) => [k, v - (src0[k] ?? 0)]).filter(([, v]) => v));
      const nx = calendar(g.day.day); // the morning playDay ended on (lambs arrive in it)
      return {
        ...out,
        season: c.season, year: c.year, dayOf: c.dayOf, wild: wild0, next: `${nx.year} ${nx.season}`,
        hayStacks: (P.hayBought ?? 0) - hay0, rare: (P.rareBought ?? 0) - rare0, lambs: g.totals.lambs - lambs0, born: (g.totals.born ?? 0) - born0, lot: (P.lotBought ?? 0) - lot0,
        herd: g.ranch.pens.reduce((n, p) => n + p.animals.filter((a) => !a.gone).length, 0),
        young: g.animals.filter((a) => a.young && !a.gone).length, animals: g.animals.filter((a) => !a.gone).length,
        worth: await (async () => {
          // What is still worth buying (one-off buildings, training, land) and how much of it the purse covers.
          const { CATALOG } = await import('/src/ranch/catalog.ts');
          const { UPGRADES, MAX_UP } = await import('/src/systems/economy.ts');
          const items = [];
          for (const d of CATALOG) if ((d.max || d.id === 'barn') && d.tier <= g.tier && !g.ranch.buildings.some((b) => b.kind === d.kind)) items.push(d.cost);
          for (const u of UPGRADES) for (let l = g.upgrades[u.key]; l < MAX_UP; l++) items.push(u.costs[l - 1]);
          for (const p of g.valley.fields) if (!p.owned) items.push(p.site.price);
          return { left: items.length, afford: items.filter((c) => c <= g.coins).length, cost: items.reduce((a, b) => a + b, 0) };
        })(),
        src,
        hungry: g.seasonal.hungryNights - (c.season === 'winter' && c.dayOf === 1 ? 0 : hungry0),
        ribbons: g.totals.fairRibbons.reduce((s, n) => s + n, 0) - ribbons0,
        hayLeft: Z.hayHeld(g), hayNeed: Z.hayNeed(g),
        village: g.ranch.village.built.size, cleared: g.valley.fields.filter((p) => p.cleared).length, logs: g.valley.logs, bridge: g.valley.bridge,
      };
    });
    days.push(log);
    if (verbose) console.log(`seed ${seed} day ${log.day} ${log.season} ${log.year}.${log.dayOf} T${log.tier} ${log.sky} ${log.real}s (rest ${log.rested}s) +${log.earned}$ -${log.spent}$ =${log.coins}$ choice ${log.choice}\n    did: ${log.did.join('; ')}${log.stuck.length ? `\n    stuck: ${log.stuck.join('; ')}` : ''}`);
    const won = await page.evaluate(() => window.game.won);
    if (won && !wonDay) wonDay = log.day;
    if (won && !year) break;
  }
  const end = await page.evaluate(() => ({ tier: window.game.tier, won: window.game.won, day: window.game.day.day, buildings: window.game.ranch.buildings.filter((b) => b.kind !== 'regiongate').map((b) => `${b.kind}@${b.tx},${b.ty}`).join(' '), village: { ...window.game.ranch.village.builtDay }, valley: { ...window.__pace.valley }, farm: { shorn: window.game.farmwork.shorn, milked: window.game.farmwork.milked, clean: window.game.farmwork.cleanRuns, best: window.game.farmwork.best }, upgrades: { ...window.game.upgrades } }));
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
  runs.push({ seed, days, end, errors, wonDay });
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
    paddocks: avg((p) => p[p.length - 1].paddocks ?? p[p.length - 1].pens ?? 0).toFixed(1),
    idleDays: stuckDays.toFixed(1),
    notes: [...notes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} x${n}`).join('; '),
  });
}
console.log('| tier | days | play min | resting min | earned $ | spent $ | choices at day end | days nothing moved | stuck on (count over all seeds) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.tier} | ${r.days} | ${r.minutes} | ${r.rested} | ${r.earned} | ${r.spent} | ${r.choice} | ${r.idleDays} | ${r.notes} |`);
// Every coin by the system that paid it, per tier (share of the tier's earnings).
{
  const keys = [...new Set(runs.flatMap((r) => r.days.flatMap((d) => Object.keys(d.src ?? {}))))].sort();
  if (keys.length) {
    console.log(`\n| tier | ${keys.join(' | ')} | per day $ |`);
    console.log(`|---|${keys.map(() => '---|').join('')}---|`);
    for (let tier = 1; tier <= 5; tier++) {
      const ds = runs.flatMap((r) => r.days.filter((d) => d.tier === tier));
      if (!ds.length) continue;
      const tot = ds.reduce((s, d) => s + Object.values(d.src ?? {}).reduce((a, b) => a + b, 0), 0) || 1;
      console.log(`| ${tier} | ${keys.map((k) => `${Math.round((100 * ds.reduce((s, d) => s + (d.src?.[k] ?? 0), 0)) / tot)}%`).join(' | ')} | ${Math.round(tot / ds.length)} |`);
    }
  }
}
// Is there anything worth buying? (One-off buildings, training, land.)
console.log('\n| tier | worth buying left at tier end | of it affordable | its cost $ | purse at tier end $ |');
console.log('|---|---|---|---|---|');
for (let tier = 1; tier <= 5; tier++) {
  const ends = runs.map((r) => r.days.filter((d) => d.tier === tier)).filter((p) => p.length).map((p) => p[p.length - 1]);
  if (!ends.length) continue;
  const a = (f) => (ends.reduce((s, d) => s + f(d), 0) / ends.length);
  console.log(`| ${tier} | ${a((d) => d.worth?.left ?? 0).toFixed(1)} | ${a((d) => d.worth?.afford ?? 0).toFixed(1)} | ${Math.round(a((d) => d.worth?.cost ?? 0))} | ${Math.round(a((d) => d.coins))} |`);
}
console.log('\n| tier | earned per day $ | where it came from | stock penned at tier end | enclosures at tier end | purse at tier end $ |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.tier} | ${r.perDay} | ${r.income} | ${r.penned} | ${r.paddocks} | ${r.coinsEnd} |`);
if (year) {
  // Per season of the calendar, averaged over the seeds.
  console.log('\n| season | earned $ | spent $ | hay stacks bought | hungry pen-nights | hay left at end | lambs born | young born (all kinds) | stock bought | penned at end | shearer | fair | rare bought | wild stock about (morning avg) | village built | paddocks clear | bridge logs |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const keys = [...new Set(runs.flatMap((r) => r.days.map((d) => `${d.year} ${d.season}`)))];
  for (const k of keys) {
    const per = runs.map((r) => r.days.filter((d) => `${d.year} ${d.season}` === k)).filter((p) => p.length);
    const avg = (f) => per.reduce((s, p) => s + f(p), 0) / per.length;
    const sum = (key) => avg((p) => p.reduce((s, d) => s + (d[key] ?? 0), 0));
    // Lambs are born in the morning the day's log ends on.
    const lambs = runs.reduce((s, r) => s + r.days.filter((d) => d.next === k).reduce((t, d) => t + d.lambs, 0), 0) / runs.length;
    const born = runs.reduce((s, r) => s + r.days.filter((d) => d.next === k).reduce((t, d) => t + (d.born ?? 0), 0), 0) / runs.length;
    const said = (re) => per.flatMap((p) => p.flatMap((d) => d.did.filter((x) => re.test(x)))).map((x) => x.replace(/\s+\d+S\b.*$/, '')).join('; ') || '-';
    console.log(`| year ${k} | ${Math.round(sum('earned'))} | ${Math.round(sum('spent'))} | ${sum('hayStacks').toFixed(1)} | ${sum('hungry').toFixed(1)} | ${Math.round(avg((p) => p[p.length - 1].hayLeft))} | ${lambs.toFixed(1)} | ${born.toFixed(1)} | ${sum('lot').toFixed(1)} | ${Math.round(avg((p) => p[p.length - 1].herd ?? 0))} | ${said(/^SHEARER/)} | ${per.flatMap((p) => p.flatMap((d) => d.did.filter((x) => /^FAIR/.test(x)))).length ? said(/^FAIR/) : '-'} | ${sum('rare').toFixed(1)} | ${Math.round(avg((p) => p.reduce((s, d) => s + d.wild, 0) / p.length))} | ${avg((p) => p[p.length - 1].village).toFixed(1)} | ${avg((p) => p[p.length - 1].cleared).toFixed(1)} | ${avg((p) => p[p.length - 1].bridge ? 6 : p[p.length - 1].logs).toFixed(1)} |`);
  }
}
if (year) {
  // Per season: every coin by source, and how many animals the world holds.
  const keys = [...new Set(runs.flatMap((r) => r.days.flatMap((d) => Object.keys(d.src ?? {}))))].sort();
  console.log(`\n| season | ${keys.join(' | ')} | earned per day $ | purse at end $ | worth buying left | animals at end | young at end | penned at end |`);
  console.log(`|---|${keys.map(() => '---|').join('')}---|---|---|---|---|---|`);
  const seasons = [...new Set(runs.flatMap((r) => r.days.map((d) => `${d.year} ${d.season}`)))];
  for (const k of seasons) {
    const per = runs.map((r) => r.days.filter((d) => `${d.year} ${d.season}` === k)).filter((p) => p.length);
    const ds = per.flat();
    const tot = ds.reduce((s, d) => s + Object.values(d.src ?? {}).reduce((a, b) => a + b, 0), 0) || 1;
    const end = (f) => Math.round(per.reduce((s, p) => s + f(p[p.length - 1]), 0) / per.length);
    console.log(`| year ${k} | ${keys.map((x) => `${Math.round((100 * ds.reduce((s, d) => s + (d.src?.[x] ?? 0), 0)) / tot)}%`).join(' | ')} | ${Math.round(tot / ds.length)} | ${end((d) => d.coins)} | ${end((d) => d.worth?.left ?? 0)} | ${end((d) => d.animals ?? 0)} | ${end((d) => d.young ?? 0)} | ${end((d) => d.herd ?? 0)} |`);
  }
}
if (year) for (const r of runs) console.log(`seed ${r.seed} valley: village ${JSON.stringify(r.end.village)}; ${JSON.stringify(r.end.valley)}; farm ${JSON.stringify(r.end.farm)}; dog ${JSON.stringify(r.end.upgrades)}`);
for (const r of runs) console.log(`seed ${r.seed}: ${r.wonDay ? `valley thrives on day ${r.wonDay}` : `tier ${r.end.tier}`}${year ? `, played to day ${r.end.day}` : ''}${r.errors.length ? `  ERRORS ${r.errors.slice(0, 3).join(' | ')}` : ''}`);
if (outFile) {
  mkdirSync('shots', { recursive: true });
  writeFileSync(outFile, JSON.stringify(runs, null, 1));
}
