// Phone performance: the work in each frame (update + render) under CPU
// throttling, at a phone size.
//
//   node scripts/perftest.mjs [--throttle=4,6] [--size=390x844@3]
//        [--only=title,day,worst] [--frames=60] [--batches=7]
//        [--profile] [--calls] [--live] [--quality=auto|high|medium|low]
//        [--nopics] (picture cache off, src/gfx/picture.ts)
//        [--noflush] (the main thread's part only: no raster read-back)
//        [--idle] (frames drawn a second: playing, and left alone in the
//        pause menu and build mode)
//        [--animals=N] (wild flocks added round the valley until the world
//        holds N animals: a herd-heavy year two; the fixture has about 170)
//
// Scenarios (the ranch is scripts/fixtures/tier5.json, a real tier-5 ranch
// the pace bot built; remake it with scripts/makefixture.mjs):
//   title  the title screen's attract mode
//   day    the built-up ranch on a clear summer day, the dog trotting about
//   worst  the same ranch at night in a winter storm, coyotes and wolves
//          about, two helpers out, the dog trotting about
//   fognight  (only with --only) the ranch on a fog night: the mist's path
//
// The frame loop is stopped and frames are stepped by hand with a seeded
// Math.random, so every run sees the same frames. Each batch times
// `frames` frames; the table gives the best batch (the least disturbed by
// whatever else the machine is doing) and the median. Each frame ends with
// a one-pixel read of the screen, so its drawing is all done (not left for
// a paint that a stepped frame never has). --live instead lets
// the page run its own loop for a few seconds and reports the frame rate it
// got (noisy when other work shares the machine). Headless Chromium draws
// canvas in software and has no GPU compositor, so it is a harsh stand-in
// for a phone, where the scale-up to the screen is done by the GPU.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const throttles = opt('throttle', '4,6').split(',').map(Number);
const only = opt('only', 'title,day,worst').split(',');
const quality = opt('quality', '');
const animals = Number(opt('animals', '0'));
const FRAMES = Number(opt('frames', '60'));
const BATCHES = Number(opt('batches', '7'));
const live = flag('live');
const [wh, dprS] = opt('size', '390x844@3').split('@');
const [width, height] = wh.split('x').map(Number);
const dpr = Number(dprS || 1);
const fixture = readFileSync(new URL('./fixtures/tier5.json', import.meta.url), 'utf8');

const PORT = Number(process.env.PERF_PORT || 5351);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();

const SCENES = {
  title: { query: 'title&debug' },
  day: { query: 'debug&weather=clear&season=summer', ranch: true },
  worst: { query: 'debug&weather=storm&season=winter', ranch: true, night: true },
  fognight: { query: 'debug&weather=fog&season=autumn', ranch: true, night: true }, // --only=fognight
};

async function run(scene, rate) {
  const s = SCENES[scene];
  const phone = height > width;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(({ quality, calls, live }) => {
    let a = 7;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.__frames = [];
    // Live: time every frame callback. Bench: no loop at all.
    window.requestAnimationFrame = live
      ? (cb) => raf((t) => {
          const t0 = performance.now();
          cb(t);
          window.__frames.push([t0, performance.now() - t0]);
        })
      : () => 0;
    if (calls) {
      window.__calls = {};
      const P = CanvasRenderingContext2D.prototype;
      for (const k of ['drawImage', 'fillRect', 'putImageData', 'getImageData']) {
        const f = P[k];
        P[k] = function (...args) {
          window.__calls[k] = (window.__calls[k] ?? 0) + 1;
          return f.apply(this, args);
        };
      }
    }
    try {
      localStorage.clear();
      if (quality) localStorage.setItem('comeby-settings', JSON.stringify({ quality }));
    } catch { /* ignore */ }
  }, { quality, calls: flag('calls'), live });
  await page.goto(`http://localhost:${PORT}/?${s.query}`);
  await page.waitForFunction(() => window.game);
  await page.evaluate(async ({ save, ranch, night, nopics, quality, noflush, animals }) => {
    const g = window.game;
    if (nopics) (await import('/src/gfx/picture.ts')).setPictures(false);
    // The stepped frames skip main.ts, where the setting is applied.
    if (quality && quality !== 'auto') (await import('/src/gfx/quality.ts')).setLevel(quality);
    if (ranch) {
      localStorage.setItem('comeby-save-v1', save);
      const { loadInto } = await import('/src/systems/save.ts');
      loadInto(g);
      g.tut = 99;
      if (g.helpers.length < 2) { g.coins += 1000; g.hireHelper(); }
      g.day.t = 120;
      if (night) {
        g.startNight();
        g.quietT = -1e9;
        for (const p of g.predators) p.waitT = Math.min(p.waitT, 1);
      }
      g.banner = null;
      g.tip = null;
      // Year two's crowd: more wild flocks out in the open regions.
      if (animals > g.animals.length) {
        const { REGIONS } = await import('/src/world/map.ts');
        const regs = REGIONS.filter((r) => r.species && r.tier <= g.tier);
        for (let i = 0; g.animals.length < animals && i < 400; i++) {
          const r = regs[i % regs.length], pts = g.map.spawns[r.id] ?? [];
          const p = pts[Math.floor(i / regs.length) % pts.length];
          if (p) g.spawnFlock(r.species, p.x, p.y, Math.min(10, animals - g.animals.length));
        }
      }
      const f = g.ranch.farmhouse;
      g.dog.x = f.cx + 30;
      g.dog.y = f.y1 + 30;
    }
    // One frame as main.ts runs it; the dog trots a loop round the yard.
    let n = 0;
    window.__step = () => {
      n++;
      if (ranch) {
        const a = n * 0.02;
        g.input.override = { x: Math.cos(a), y: Math.sin(a) * 0.7, sprint: false, lie: false };
      }
      g.update(1 / 60);
      g.input.clearQueue();
      g.render();
      g.screen.present();
      g.input.endFrame();
      // With no paint, Chrome would leave the frame's raster for later:
      // reading a pixel back makes every frame pay for all of it. (On a
      // phone the raster runs on the GPU, off the main thread: --noflush
      // measures the main thread's part alone.)
      if (!noflush) g.screen.vctx.getImageData(0, 0, 1, 1);
    };
  }, { save: fixture, ranch: !!s.ranch, night: !!s.night, nopics: flag('nopics'), quality, noflush: flag('noflush'), animals });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  let per = [], fps = 0;
  if (live) {
    await page.evaluate((ranch) => {
      const g = window.game;
      let a = 0;
      if (ranch) setInterval(() => {
        a += 0.35;
        g.input.override = { x: Math.cos(a), y: Math.sin(a) * 0.7, sprint: false, lie: false };
      }, 250);
    }, !!s.ranch);
    await page.waitForTimeout(2000);
    await page.evaluate(() => (window.__frames.length = 0));
    await page.waitForTimeout(6000);
    const frames = await page.evaluate(() => window.__frames.slice());
    per = frames.map((f) => f[1]);
    fps = ((frames.length - 1) / (frames[frames.length - 1][0] - frames[0][0])) * 1000;
  } else {
    await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(); }, FRAMES * 2); // warm up
    if (flag('calls')) await page.evaluate(() => (window.__calls = {}));
    if (flag('profile')) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
    }
    for (let b = 0; b < BATCHES; b++) {
      per.push(await page.evaluate((n) => {
        const t0 = performance.now();
        for (let i = 0; i < n; i++) window.__step();
        return (performance.now() - t0) / n;
      }, FRAMES));
    }
  }
  let prof = null;
  if (flag('profile') && !live) prof = (await cdp.send('Profiler.stop')).profile;
  const info = await page.evaluate(async () => ({ W: window.game.screen.W, H: window.game.screen.H, q: (await import('/src/gfx/quality.ts')).quality.level, calls: window.__calls }));
  await ctx.close();
  const sorted = per.slice().sort((a, b) => a - b);
  const row = {
    scene, rate, best: sorted[0], median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    fps, size: `${info.W}x${info.H}`, q: info.q, errors, notes: [],
  };
  if (prof) row.notes.push(...topFunctions(prof));
  const steps = live ? per.length : FRAMES * BATCHES;
  if (info.calls) row.notes.push(Object.entries(info.calls).map(([k, v]) => `${k} ${Math.round(v / steps)}/frame`).join(', '));
  return row;
}

// Self time per function from a CPU profile.
function topFunctions(profile, n = 16) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  const dt = profile.timeDeltas;
  let total = 0;
  profile.samples.forEach((id, i) => {
    const cf = byId.get(id).callFrame;
    if (cf.functionName === '(idle)') return;
    const file = cf.url.split('/').slice(-2).join('/').replace(/\?.*$/, '');
    const key = `${cf.functionName || '(anon)'} ${file}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
    total += dt[i] ?? 0;
  });
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

// --idle: how many frames the page draws a second in play, then in the
// pause menu and build mode left alone (main.ts slows to 30 there).
if (flag('idle')) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.game);
  const fps = async (setup) => {
    await page.evaluate(setup);
    await page.waitForTimeout(2200); // past the 1.5s it waits for quiet
    return page.evaluate(() => new Promise((res) => {
      const s = window.game.screen, p = s.present.bind(s);
      let n = 0;
      s.present = () => { n++; p(); };
      setTimeout(() => { s.present = p; res(n); }, 2000);
    })).then((n) => n / 2);
  };
  const out = {
    play: await fps(() => { window.game.mode = 'play'; }),
    pause: await fps(() => { window.game.mode = 'pause'; }),
    build: await fps(() => { const g = window.game; g.mode = 'play'; g.enterBuild(); }),
  };
  console.log('frames drawn a second:', JSON.stringify(out));
  await browser.close();
  await server.close();
  process.exit(0);
}

const rows = [];
for (const rate of throttles)
  for (const scene of only) {
    const r = await run(scene, rate);
    rows.push(r);
    const what = live ? `${r.median.toFixed(1)}ms median, ${r.p95.toFixed(1)}ms p95, ${r.fps.toFixed(0)} fps` : `${r.best.toFixed(1)}ms best, ${r.median.toFixed(1)}ms median`;
    console.log(`${scene} ${rate}x: ${what} (${r.size}, quality ${r.q})${r.errors.length ? `  ERRORS: ${r.errors.slice(0, 3).join(' | ')}` : ''}`);
    for (const n of r.notes) console.log('  ' + n);
  }
console.log(`\n${width}x${height}@${dpr}${quality ? `, quality ${quality}` : ''}${flag('nopics') ? ', no picture cache' : ''}${flag('noflush') ? ', main thread only' : ''}`);
if (live) {
  console.log('| scene | CPU | work per frame (median) | p95 | fps |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.scene} | ${r.rate}x | ${r.median.toFixed(1)} ms | ${r.p95.toFixed(1)} ms | ${r.fps.toFixed(0)} |`);
} else {
  console.log('| scene | CPU | work per frame (best batch) | median batch |');
  console.log('|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.scene} | ${r.rate}x | ${r.best.toFixed(1)} ms | ${r.median.toFixed(1)} ms |`);
}
await browser.close();
await server.close();
process.exit(rows.some((r) => r.errors.length) ? 1 : 0);
