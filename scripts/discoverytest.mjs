// Exploring, end to end: every hidden place can be reached once its region
// opens (and none sooner), walking in finds it, keepsakes are picked up,
// the Drove Trail's hurdle only opens from the trail side, sweet grass
// settles a rattled sheep, strays and wild flocks pay their bonus, and it
// all survives a save; an old save loads with its open regions mapped.
//   node scripts/discoverytest.mjs   (exits 1 on a failed check)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const PORT = 5216;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.game);
let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};

// ---- Reachability by tier, with the region gates shut until they open ----
const reach = await page.evaluate(async () => {
  const { PLACES, inPlace } = await import('/src/world/places.ts');
  const { REGIONS, CW, CH, CS, BLOCK_DOG } = await import('/src/world/map.ts');
  const g = window.game;
  const res = [];
  for (let tier = 1; tier <= 5; tier++) {
    g.setTier(tier, false);
    for (const rg of g.ranch.regionGates) rg.swing = rg.unlocked ? 1 : 0;
    g.ranch.restamp();
    const m = g.map;
    const seen = new Uint8Array(CW * CH);
    const d = g.doorPoint();
    const q = [Math.floor(d.y / CS) * CW + Math.floor(d.x / CS)];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop();
      const x = i % CW, y = (i / CW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        const j = ny * CW + nx;
        if (seen[j] || (m.cell(nx, ny) & BLOCK_DOG)) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    const at = (px, py) => seen[Math.floor(py / CS) * CW + Math.floor(px / CS)] === 1;
    const reachPlace = (p) => {
      if (!p.rx) return at(p.way[0][0] * 8 + 4, p.way[0][1] * 8 + 4);
      for (let y = (p.cy - p.ry) * 8; y < (p.cy + p.ry) * 8; y += 4)
        for (let x = (p.cx - p.rx) * 8; x < (p.cx + p.rx) * 8; x += 4) if (inPlace(p, x, y, 0.6) && at(x, y)) return true;
      return false;
    };
    const open = PLACES.filter((p) => REGIONS.find((r) => r.id === p.region).tier <= tier).map((p) => p.id);
    const got = PLACES.filter(reachPlace).map((p) => p.id);
    res.push({ tier, missing: open.filter((id) => !got.includes(id)), leak: got.filter((id) => !open.includes(id)) });
  }
  g.setTier(1, false);
  return res;
});
for (const r of reach) check(`tier ${r.tier}: places open = places reachable`, !r.missing.length && !r.leak.length, `missing=[${r.missing}] leak=[${r.leak}]`);

// ---- A new game ----
const fresh = await page.evaluate(() => {
  const d = window.game.discovery;
  const n = [0, 0, 0];
  for (const v of d.fog) n[v]++;
  return { fog: n, found: d.count().found, total: d.count().total, hurdle: window.game.map.hurdleOpen, tracked: d.tracked.size };
});
check('new game: fog only round the ranch', fresh.fog[2] > 300 && fresh.fog[2] < 1500, JSON.stringify(fresh.fog));
check('new game: nothing found, hurdle latched, no strays at tier 1', fresh.found === 0 && fresh.total === 12 && !fresh.hurdle && fresh.tracked === 0);

// ---- Walk into every place at tier 5 ----
const walk = await page.evaluate(async () => {
  const { PLACES, inPlace, FINDS } = await import('/src/world/places.ts');
  const { BLOCK_DOG } = await import('/src/world/map.ts');
  const g = window.game;
  g.setTier(5, false);
  g.tut = 99;
  g.tipsSeen = new Set(['hills', 'rocky', 'ford', 'high', 'show', 'night', 'rest']);
  g.day.phase = 'day';
  g.day.t = 30;
  g.discovery.morning(g);
  const tracked = {};
  for (const id of g.discovery.tracked.values()) tracked[id] = (tracked[id] ?? 0) + 1;
  const coatOk = [...g.discovery.tracked].every(([a, id]) => a.coat === FINDS.find((f) => f.place === id).coat);
  const step = (n) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
  const put = (x, y) => { g.dog.x = x; g.dog.y = y; g.dog.vx = g.dog.vy = 0; };
  const spot = (p) => {
    for (let k = 0.1; k < 0.8; k += 0.1)
      for (let a = 0; a < 6.28; a += 0.4) {
        const x = (p.cx + Math.cos(a) * p.rx * k) * 8, y = (p.cy + Math.sin(a) * p.ry * k) * 8;
        if (inPlace(p, x, y, 0.8) && !g.map.blockedPx(x, y, BLOCK_DOG) && !g.map.blockedPx(x + 4, y, BLOCK_DOG) && !g.map.blockedPx(x - 4, y, BLOCK_DOG)) return [x, y];
      }
    return null;
  };
  const out = [];
  let glimpsed = 0;
  for (const p of PLACES) {
    if (!p.rx) continue;
    put(p.way[0][0] * 8 + 4, p.way[0][1] * 8 + 4);
    step(2);
    const coins = g.coins;
    const kc = g.discovery.keepsakes.size;
    const s = spot(p);
    if (!s) { out.push({ id: p.id, err: 'no open spot' }); continue; }
    put(s[0], s[1]);
    step(3);
    const r = { id: p.id, found: g.discovery.found.has(p.id), paid: g.coins - coins, banner: g.banner?.big };
    if (p.kind === 'lookout') glimpsed = [...g.discovery.fog].filter((v) => v === 1).length;
    if (p.keepsake) {
      put(p.item[0] + 3, p.item[1] + 5);
      step(3);
      r.kept = g.discovery.keepsakes.size === kc + 1;
    }
    out.push(r);
  }
  return { out, tracked, coatOk, glimpsed, found: g.discovery.count().found, keeps: g.discovery.keepsakes.size };
});
check('morning at tier 5: black sheep, heifer, wild goats, wild ponies', walk.tracked.circle === 1 && walk.tracked.falls === 1 && walk.tracked.valley === 5 && walk.tracked.hanging === 4 && walk.coatOk, JSON.stringify(walk.tracked));
for (const r of walk.out) check(`found ${r.id}`, r.found && r.paid > 0 && (r.kept ?? true), JSON.stringify(r));
check('lookout glimpses the valley', walk.glimpsed > 1500, `${walk.glimpsed} cells`);
check('all keepsakes kept', walk.keeps === 5);

// ---- The Drove Trail's hurdle ----
const hurdle = await page.evaluate(async () => {
  const { CS, CW, SOLID, BLOCK_DOG } = await import('/src/world/map.ts');
  const g = window.game;
  const step = (n) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
  const [x0, x1] = g.map.hurdleSpan();
  const mid = Math.round((x0 + x1) / 2), hy = g.map.hurdleY - 4;
  const solid = () => (g.map.cell(Math.floor(mid / CS), Math.floor(hy / CS)) & SOLID) !== 0;
  g.tip = null;
  g.dog.x = mid; g.dog.y = hy + 8; g.dog.vx = g.dog.vy = 0;
  step(5);
  const ranchSide = { open: g.map.hurdleOpen, solid: solid(), tip: g.tip?.text ?? '' };
  // Try to walk north through it.
  g.input.override = { x: 0, y: -1, sprint: false, lie: false };
  step(60);
  g.input.override = null;
  const pushedY = g.dog.y;
  const coins = g.coins;
  g.dog.x = mid; g.dog.y = hy - 10;
  step(5);
  return { span: [x0, x1], hy, ranchSide, pushedY, open: g.map.hurdleOpen, solid: solid(), found: g.discovery.found.has('trail'), paid: g.coins - coins, banner: g.banner?.big };
});
check('hurdle spans the trail', hurdle.span[1] - hurdle.span[0] >= 16 && hurdle.span[1] - hurdle.span[0] <= 48, JSON.stringify(hurdle.span));
check('hurdle latched from the ranch side', !hurdle.ranchSide.open && hurdle.ranchSide.solid && hurdle.ranchSide.tip.includes('LATCHED') && hurdle.pushedY > hurdle.hy, JSON.stringify(hurdle.ranchSide) + ` y=${hurdle.pushedY.toFixed(1)} hurdle=${hurdle.hy}`);
check('hurdle opens from the trail side', hurdle.open && !hurdle.solid && hurdle.found && hurdle.paid > 0, `banner=${hurdle.banner}`);

// ---- Sweet grass in the stone circle ----
const calm = await page.evaluate(async () => {
  const { Animal } = await import('/src/entities/animal.ts');
  const g = window.game;
  const step = (n) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
  const ring = new Animal('sheep', 1480, 350);
  const out = new Animal('sheep', 1160, 420);
  for (const a of [ring, out]) { a.stress = 0.7; a.peakStress = 0.7; a.wanderer = false; g.animals.push(a); }
  // A companion for the control so neither is alone (the black sheep keeps the other company).
  const pal = new Animal('sheep', 1166, 424);
  pal.wanderer = false;
  g.animals.push(pal);
  g.dog.x = 1300; g.dog.y = 250;
  step(8 * 60);
  const r = { ring: +ring.peakStress.toFixed(2), out: +out.peakStress.toFixed(2) };
  g.animals = g.animals.filter((a) => a !== ring && a !== out && a !== pal);
  return r;
});
check('sweet grass: a rattled sheep in the ring calms (pay recovers)', calm.ring < 0.3 && calm.out > 0.45, JSON.stringify(calm));

// ---- Bonuses: a wild goat, then the black sheep ----
const pay = await page.evaluate(async () => {
  const { Pen } = await import('/src/ranch/buildings.ts');
  const g = window.game;
  const step = (n) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
  g.dog.x = 760; g.dog.y = 860;
  const d = g.discovery;
  const goat = [...d.tracked].find(([, id]) => id === 'valley')[0];
  const pen = g.ranch.pens[0];
  let coins = g.coins;
  goat.x = pen.cx; goat.y = pen.cy; goat.peakStress = 0; goat.stress = 0;
  step(3);
  const goatPaid = g.coins - coins, goatValue = goat.deliveryValue;
  const pen2 = new Pen(112, 108, 0);
  g.ranch.add(pen2);
  const sheep = [...d.tracked].find(([, id]) => id === 'circle')[0];
  coins = g.coins;
  sheep.x = pen2.cx; sheep.y = pen2.cy; sheep.peakStress = 0; sheep.stress = 0;
  step(3);
  const sheepPaid = g.coins - coins;
  const home = d.home.has('circle');
  g.discovery.morning(g);
  const again = [...d.tracked.values()].filter((id) => id === 'circle').length;
  return { goatPaid, goatValue, sheepPaid, sheepValue: sheep.deliveryValue, home, again, goatsLeft: [...d.tracked.values()].filter((id) => id === 'valley').length };
});
check('wild-bred goat pays double', pay.goatPaid === pay.goatValue * 2 && pay.goatValue > 0, JSON.stringify(pay));
check('black sheep home: value + 30$ calm bonus, never comes back', pay.sheepPaid === pay.sheepValue + 30 && pay.home && pay.again === 0);

// ---- Save, then continue ----
const saved = await page.evaluate(async () => {
  const S = await import('/src/systems/save.ts');
  const { Game } = await import('/src/game.ts');
  const g = window.game;
  const fogSum = (d) => d.fog.reduce((s, v) => s + v, 0);
  const before = { found: [...g.discovery.found].sort(), keeps: [...g.discovery.keepsakes].sort(), home: [...g.discovery.home], fog: fogSum(g.discovery), hurdle: g.map.hurdleOpen, out: g.discovery.tracked.size, flock: JSON.stringify(g.discovery.flockDay) };
  S.saveGame(g);
  const size = localStorage.getItem('comeby-save-v1').length;
  const n = new Game(g.screen, g.input, {});
  S.loadInto(n);
  const after = { found: [...n.discovery.found].sort(), keeps: [...n.discovery.keepsakes].sort(), home: [...n.discovery.home], fog: fogSum(n.discovery), hurdle: n.map.hurdleOpen, out: n.discovery.tracked.size, flock: JSON.stringify(n.discovery.flockDay) };
  const blackPenned = n.ranch.pens.some((p) => p.animals.some((a) => a.sp.id === 'sheep' && a.coat === 1));
  const wildInWild = n.animals.filter((a) => !a.pen && n.discovery.tracked.has(a)).length;
  const [hx0, hx1] = n.map.hurdleSpan();
  return { before, after, size, blackPenned, wildInWild, solid: (n.map.cell(Math.floor((hx0 + hx1) / 8), Math.floor((n.map.hurdleY - 4) / 4)) & 1) !== 0 };
});
check('save keeps exploring', JSON.stringify(saved.before) === JSON.stringify(saved.after) && !saved.solid, `${JSON.stringify(saved.after)} save=${saved.size}B`);
check('black sheep stays penned; strays and flocks come back as they were', saved.blackPenned && saved.wildInWild === saved.after.out);

// ---- A save from before exploring ----
const old = await page.evaluate(async () => {
  const S = await import('/src/systems/save.ts');
  const { Game } = await import('/src/game.ts');
  const { PLACES } = await import('/src/world/places.ts');
  const { FW } = await import('/src/systems/discovery.ts');
  const g = window.game;
  const k = 'comeby-save-v1';
  const d = JSON.parse(localStorage.getItem(k));
  delete d.discovery;
  localStorage.setItem(k, JSON.stringify(d));
  const n = new Game(g.screen, g.input, {});
  const ok = S.loadInto(n);
  const fog = (tx, ty) => n.discovery.fog[Math.floor(ty / 2) * FW + Math.floor(tx / 2)];
  const hidden = PLACES.filter((p) => p.rx && fog(p.cx, p.cy) !== 0).map((p) => p.id);
  return { ok, found: n.discovery.found.size, hurdle: n.map.hurdleOpen, hills: fog(144, 52), ford: fog(38, 124), high: fog(96, 15), crossroads: fog(96, 70), hidden, tier: n.tier };
});
check('old save loads, its open regions and roads mapped', old.ok && old.found === 0 && !old.hurdle && old.hills === 2 && old.ford === 2 && old.high === 2 && old.crossroads === 2, JSON.stringify(old));
check('old save: hidden places still hidden', old.hidden.length === 0, `[${old.hidden}]`);

// ---- The Ledger, with fog, stars and counts ----
mkdirSync('shots', { recursive: true });
await page.evaluate(() => {
  const g = window.game;
  // Back to a part-explored map for the picture.
  g.discovery.fog.fill(0);
  for (const id of ['willow', 'circle', 'knoll']) g.discovery.found.add(id);
  g.discovery.found.delete('hut');
  g.discovery.reveal(48, 52, 15, 2);
  g.discovery.reveal(74, 30, 10, 2);
  g.discovery.reveal(83, 14, 48, 1);
  g.discovery.reveal(83, 14, 6, 2);
  g.discovery.fogVer++;
  g.mode = 'ledger';
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/discovery-ledger.png' });
console.log('shots/discovery-ledger.png');

if (errors.length) { console.log('ERRORS', errors); failed++; }
await browser.close();
await server.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
