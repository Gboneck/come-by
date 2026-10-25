// Weather: which skies each tier gets, the forecast coming true, and what
// each sky does to a flock (wind drift, rain cover, downwind barks, fog
// sight, bold storm nights).
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5217, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto('http://localhost:5217/?debug');
await page.waitForFunction(() => window.game);
const out = await page.evaluate(async () => {
  const g = window.game;
  const W = await import('/src/systems/weather.ts');
  const res = {};
  // Skies over 300 mornings at each tier.
  for (const tier of [1, 2, 4]) {
    const w = new W.Weather();
    const count = {};
    let stormRuns = 0, kept = 0, prev = '';
    for (let d = 0; d < 300; d++) {
      const promised = w.forecast;
      w.newDay(tier);
      if (w.sky === promised || tier < 2) kept++;
      count[w.sky] = (count[w.sky] ?? 0) + 1;
      if (prev === 'storm' && w.sky === 'storm') stormRuns++;
      prev = w.sky;
    }
    res[`tier${tier}`] = { ...count, forecastKept: `${kept}/300`, stormTwiceInARow: stormRuns };
  }
  const step = (s) => { for (let i = 0; i < s * 60; i++) { g.input.override = { x: 0, y: 0, sprint: false, lie: false }; g.update(1 / 60); } g.input.override = null; };
  const centre = (list) => list.reduce((c, a) => ({ x: c.x + a.x / list.length, y: c.y + a.y / list.length }), { x: 0, y: 0 });
  // A grazing flock left alone for 60s: drift with and without wind.
  const drift = (sky) => {
    window.resetFlock('sheep', 1150, 420, 8, 1000, 300);
    g.weather.force(sky);
    g.weather.dirX = 1; g.weather.dirY = 0;
    g.dog.x = 900; g.dog.y = 300;
    const c0 = centre(g.animals);
    step(60);
    const c1 = centre(g.animals);
    return Math.round(c1.x - c0.x);
  };
  res.windDrift = { clear: drift('clear'), wind: drift('wind') };
  // Rain: the flock heads for tree cover (distance to the nearest forest tile).
  const cover = (sky) => {
    window.resetFlock('sheep', 1150, 420, 8, 1000, 300);
    g.weather.force(sky);
    g.dog.x = 900; g.dog.y = 300;
    const near = (a) => {
      let best = 1e9;
      for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
        const tx = Math.floor(a.x / 8) + dx, ty = Math.floor(a.y / 8) + dy;
        if (g.map.t(tx, ty) === 1) best = Math.min(best, Math.hypot(dx, dy) * 8);
      }
      return best;
    };
    const d0 = g.animals.reduce((s, a) => s + near(a), 0) / g.animals.length;
    step(60);
    const d1 = g.animals.reduce((s, a) => s + near(a), 0) / g.animals.length;
    return { before: Math.round(d0), after: Math.round(d1), stress: +(g.animals.reduce((s, a) => s + a.stress, 0) / g.animals.length).toFixed(2) };
  };
  res.rainCover = { clear: cover('clear'), rain: cover('rain') };
  // A bark reaches further downwind than upwind.
  {
    const { Animal, barkAt } = await import('/src/entities/animal.ts');
    g.weather.force('wind');
    g.weather.dirX = 1; g.weather.dirY = 0;
    const r = g.dog.stats.barkRange;
    const down = new Animal('sheep', 1000 + r * 1.2, 500), up = new Animal('sheep', 1000 - r * 0.85, 500);
    barkAt([down, up], 1000, 500, r, g.weather);
    res.bark = { range: r, downwindAt120pct: down.hop > 0, upwindAt85pct: up.hop > 0 };
  }
  // Fog: how far you can make out a flock.
  for (const sky of ['clear', 'fog', 'storm']) { g.weather.force(sky); res[`sight_${sky}`] = Math.round(Math.min(9999, g.weather.sight)); }
  // Storm night: an extra coyote, and bolder.
  {
    const { jobsNight } = await import('/src/systems/jobs.ts');
    g.setTier(3, false);
    g.weather.force('clear');
    g.startNight();
    const clear = { n: g.predators.length, bold: g.predators[0]?.bold };
    g.weather.force('storm');
    g.startNight();
    res.night = { clear, storm: { n: g.predators.length, bold: g.predators[0]?.bold } };
    void jobsNight;
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
