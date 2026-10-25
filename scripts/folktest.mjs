// The townsfolk, end to end: the rancher's morning, helping at the pen gate
// while the bot drives sheep home, a kennel going up, dusk on the bench, the
// lantern round at night, and the valley folk as the ranch tiers up.
// Screenshots go to shots/folk-*.png.
//   node scripts/folktest.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.FOLK_PORT || 5343);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.sim);
const shot = (name) => page.screenshot({ path: `shots/folk-${name}.png` });
const state = () => page.evaluate(() => {
  const f = window.game.folk, r = f.rancher;
  const say = f.people.filter((p) => p.bubble).map((p) => `${p.id}: "${p.bubble.text}"`);
  return `rancher ${r.shown ? r.pose : 'indoors'} at (${Math.round(r.x)},${Math.round(r.y)})${r.lantern ? ' with a lantern' : ''}${f.help ? (f.help.there ? ', at the gate' : ', going to the gate') : ''}; folk: ${f.people.map((p) => p.id).join(' ')}${say.length ? '; says ' + say.join(', ') : ''}`;
});
const out = [];

// Morning: out of the door with a word.
await page.waitForTimeout(2500);
out.push(['morning', await state()]);
await shot('morning');

// A drive home: sheep driven to the open pen; the rancher comes to the gate.
const drive = await page.evaluate(() => {
  const g = window.game, pen = g.ranch.pens[0];
  window.resetFlock('sheep', 768, 740, 10, 700, 700);
  const gp = pen.gatePoint(30);
  const r1 = window.sim({ goalX: gp.x, goalY: gp.y }, 60);
  const f = g.folk;
  return { r1, helping: !!f.help, there: !!f.help?.there, src: f.sources().length };
});
out.push(['drive to the gate', `${JSON.stringify(drive)} ${await state()}`]);
await page.evaluate(() => { window.game.cam.x = window.game.ranch.pens[0].cx; window.game.cam.y = window.game.ranch.pens[0].cy + 30; });
await page.waitForTimeout(400);
await shot('gate');
const pen = await page.evaluate(() => {
  const g = window.game, pen = g.ranch.pens[0];
  const r2 = window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true }, 60);
  return { r2, penned: pen.animals.length };
});
await page.waitForTimeout(600);
out.push(['penned', `${JSON.stringify(pen)} ${await state()}`]);

// Build a kennel by the house: the rancher hammers it up.
await page.evaluate(async () => {
  const g = window.game;
  const { makeBuilding } = await import('/src/ui/build.ts');
  const { CATALOG } = await import('/src/ranch/catalog.ts');
  g.ranch.add(makeBuilding(CATALOG.find((d) => d.id === "kennel"), 96, 104, 0));
  g.dog.x = 790; g.dog.y = 820;
});
await page.waitForTimeout(5000);
out.push(['kennel going up', await state()]);
await page.evaluate(() => { window.game.cam.x = 97 * 8; window.game.cam.y = 104 * 8; });
await page.waitForTimeout(300);
await shot('build');
await page.waitForTimeout(6000);
out.push(['kennel done?', `${await page.evaluate(() => window.game.folk.jobs.length)} jobs left; ${await state()}`]);

// Dusk on the bench (tier 4 has one), then the lantern round at night.
await page.evaluate(() => { const g = window.game; g.setTier(4, false); g.day.t = 0.82 * 300; g.day.phase = 'dusk'; });
await page.waitForTimeout(9000);
out.push(['dusk', await state()]);
await shot('dusk');
await page.evaluate(() => { const g = window.game; g.day.t = 299.9; });
await page.waitForTimeout(6000);
out.push(['night', await state()]);
await shot('night');

// The valley at tier 5: buyers, the judge, the shepherd.
await page.evaluate(() => { const g = window.game; g.endDay(); g.startDay(); g.setTier(5, false); });
await page.waitForTimeout(1000);
out.push(['tier 5', await state()]);
for (const [id, name] of [['judge', 'judge'], ['drover', 'drover'], ['shepherd', 'shepherd']]) {
  await page.evaluate((id) => {
    const g = window.game, p = g.folk.people.find((x) => x.id === id);
    if (!p) return;
    g.dog.x = p.x + 30; g.dog.y = p.y + 20; g.cam.x = p.x; g.cam.y = p.y;
  }, id);
  await page.waitForTimeout(1500);
  out.push([name, await state()]);
  await shot(name);
}

for (const [k, v] of out) console.log(`${k.padEnd(18)} ${v}`);
if (errors.length) console.log('ERRORS\n  ' + errors.join('\n  '));
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
