// Screenshot each region at real scale (tier 5, its herd grazing nearby):
//   node scripts/regions.mjs [--out=shots/regions] [--only=ford,ranch] [--night] [--dusk] [--t=seconds] [--tier=5] [--day=1]
//   [--weather=rain|fog|wind|storm] [--rest] (the dog lies down and rests)
// Writes <out>/<spot>.png at 1280x720 (3x pixels) for every spot.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const out = opt('out', 'shots/regions');
const only = opt('only', '') ? opt('only', '').split(',') : null;

// World pixel spots: camera centre, plus a herd to drop in.
const SPOTS = [
  { name: 'ranch', x: 768, y: 800, herd: ['sheep', 800, 880, 8] },
  { name: 'meadow', x: 1220, y: 870, herd: ['duck', 1180, 860, 7] },
  { name: 'hills', x: 1150, y: 420, herd: ['sheep', 1140, 430, 9] },
  { name: 'rocky', x: 330, y: 400, herd: ['goat', 330, 420, 7] },
  { name: 'ford', x: 440, y: 840, herd: ['cow', 380, 860, 5] },
  { name: 'high', x: 560, y: 120, herd: ['pony', 600, 130, 5] },
  // The ranch built up: barn (upgraded), kennel, market, mill, a sturdy pen.
  { name: 'yard', x: 800, y: 860, herd: ['sheep', 900, 850, 6], yard: true },
  // The Show Ground with a trial under way, and two buyers' yards.
  { name: 'show', x: 860, y: 1205, herd: ['duck', 2000, 2000, 1], trial: true },
  { name: 'sale', x: 1215, y: 1140, herd: ['sheep', 1150, 1170, 5] },
  { name: 'drover', x: 870, y: 615, herd: ['cow', 800, 640, 3] },
  // The dog napping by the farmhouse (use with --rest).
  { name: 'nap', x: 740, y: 820, herd: ['duck', 1300, 870, 1] },
];

const PORT = Number(process.env.SHOT_PORT || 5189);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
for (const s of SPOTS) {
  if (only && !only.includes(s.name)) continue;
  await page.evaluate(({ s, night, dusk, t, tier, day, weather, rest }) => {
    const g = window.game;
    g.setTier(tier);
    g.tut = 99;
    g.tipsSeen = new Set(['hills', 'rocky', 'ford', 'high', 'night']);
    g.banner = null;
    g.place = null;
    g.tip = null;
    g.animals.length = 0;
    g.predators.length = 0;
    g.day.phase = 'day';
    g.day.t = t;
    g.day.day = Number(day);
    if (dusk) { g.day.t = 290; g.day.phase = 'dusk'; }
    if (night) { g.day.startNight(); g.quietT = -1e9; g.banner = null; }
    if (weather) { g.weather.force(weather); g.life.wx.wet = weather === 'rain' || weather === 'storm' ? 1 : 0; }
    g.spawnFlock(...s.herd);
    if (s.trial) {
      g.animals.length = 0;
      return import('/src/systems/trials.ts').then((tr) => {
        g.trials.won = [];
        const p = g.ranch.course.post;
        g.dog.x = p.x; g.dog.y = p.y + 6;
        tr.startRun(g);
        g.dog.x = p.x - 40; g.dog.y = p.y - 60;
      });
    }
    if (s.yard && !g.yardBuilt) {
      g.yardBuilt = true;
      const R = g.ranch, b0 = R.buildings[0];
      const P = b0.constructor; // any Building subclass shares the module graph
      void P;
      return import('/src/ranch/structures.ts').then((st) => import('/src/ranch/buildings.ts').then((bd) => {
        const barn = new st.Barn(98, 106); barn.level = 2; R.add(barn);
        R.add(new st.Kennel(90, 107));
        R.add(new st.Market(106, 107));
        R.add(new st.Windmill(80, 107));
        const pen = new bd.Pen(113, 104, 0); pen.level = 2; pen.hasTrough = true; R.add(pen);
        for (let i = 0; i < 4; i++) R.add(new st.Fence(113 + i, 113, 0));
        R.add(new st.FieldGate(117, 113, 0));
        for (const a of g.animals) if (a.sp.id === 'sheep') { a.x = pen.cx + (Math.random() - 0.5) * 30; a.y = pen.cy + (Math.random() - 0.5) * 20; }
        R.restamp();
      }));
    }
    g.dog.x = s.x - 30;
    g.dog.y = s.y + 20;
    g.cam.x = s.x;
    g.cam.y = s.y;
  }, { s, night: flag('night'), dusk: flag('dusk'), t: Number(opt('t', '60')), tier: Number(opt('tier', '5')), day: opt('day', '1'), weather: opt('weather', ''), rest: flag('rest') });
  if (flag('rest')) await page.keyboard.down('KeyQ');
  await page.waitForTimeout(Number(opt('wait', '700')));
  await page.evaluate(({ x, y }) => { const g = window.game; g.cam.x = x; g.cam.y = y; g.banner = null; }, s);
  await page.waitForTimeout(60);
  const file = `${out}/${s.name}.png`;
  await page.screenshot({ path: file });
  if (flag('rest')) await page.keyboard.up('KeyQ');
  console.log(file);
}
if (errors.length) console.log('errors:\n  ' + errors.join('\n  '));
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
