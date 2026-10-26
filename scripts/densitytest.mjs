// The 2x pipeline draws the old art exactly as before, only at two fine
// pixels a world pixel (the fine-pixel sky dithers switched off, as at
// GRAPHICS MEDIUM, and the world layer alone: text is a new face on
// purpose): renders the same seeded frames here and in another
// checkout of the game (BASE=path, e.g. a worktree of main) at a size where
// both show the same world, and checks each old pixel is a solid 2x2 block
// of the same colour in the new frame.
//   BASE=../main-checkout node scripts/densitytest.mjs [--shots]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE;
if (!BASE) { console.log('set BASE to another checkout of the game'); process.exit(2); }
const fixture = (await import('node:fs')).readFileSync(new URL('./fixtures/tier5.json', import.meta.url), 'utf8');
const here = await createServer({ root: resolve('.'), server: { port: 5364, strictPort: true, hmr: false }, logLevel: 'error' });
await here.listen();
const base = await createServer({ root: resolve(BASE), configFile: resolve(BASE, 'vite.config.ts'), server: { port: 5365, strictPort: true, hmr: false }, logLevel: 'error' });
await base.listen();
const browser = await chromium.launch();

const SCENES = [
  { name: 'title', query: 'debug&title' },
  { name: 'day1', query: 'debug' },
  { name: 'ranch', query: 'debug&weather=clear&season=summer', ranch: true },
  { name: 'night', query: 'debug&weather=storm&season=winter', ranch: true, night: true },
];

async function frame(port, s) {
  // 1600x960 at 1x: 400x240 world pixels in both (old: 4x; new: 2 fine x 2).
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    let a = 11;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { localStorage.clear(); } catch {}
  });
  await page.goto(`http://localhost:${port}/?${s.query}`);
  await page.waitForFunction(() => window.game);
  const out = await page.evaluate(async ({ save, s }) => {
    const g = window.game;
    // The fine-pixel dithers are new on purpose: compare without them.
    const q = await import('/src/gfx/quality.ts');
    if ('fineSky' in q.quality) q.quality.fineSky = false;
    if (s.ranch) {
      localStorage.setItem('comeby-save-v1', save);
      const { loadInto } = await import('/src/systems/save.ts');
      loadInto(g);
      g.tut = 99;
      g.day.t = 120;
      if (s.night) { g.startNight(); g.quietT = -1e9; }
      g.banner = null; g.tip = null;
      const f = g.ranch.farmhouse;
      g.dog.x = f.cx + 30; g.dog.y = f.y1 + 30;
    }
    for (let i = 0; i < 90; i++) { g.update(1 / 60); g.input.clearQueue(); }
    // The world layer only, and no text (the HUD, menus and signs use the
    // new font): the font's filter hook blanks every string.
    const { drawWorld } = await import('/src/render/world.ts');
    (await import('/src/gfx/font.ts')).setTextFilter(() => '');
    g.tip = null; g.banner = null;
    drawWorld(g, g.g, g.view());
    g.screen.present();
    const c = g.screen.buf;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, W: g.screen.W, H: g.screen.H, px: Array.from(d) };
  }, { save: fixture, s });
  await page.close();
  return { ...out, errs };
}

let failed = 0;
for (const s of SCENES) {
  const a = await frame(5365, s), b = await frame(5364, s);
  if (a.W !== b.W || a.H !== b.H) { console.log(`FAIL ${s.name}: world size ${a.W}x${a.H} vs ${b.W}x${b.H}`); failed++; continue; }
  const k = b.w / a.w;
  let bad = 0, block = 0;
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * 4;
      for (let j = 0; j < k * k; j++) {
        const bx = x * k + (j % k), by = y * k + Math.floor(j / k), o = (by * b.w + bx) * 4;
        if (b.px[o] !== a.px[i] || b.px[o + 1] !== a.px[i + 1] || b.px[o + 2] !== a.px[i + 2]) { bad++; if (j) block++; break; }
      }
    }
  const pct = ((bad / (a.w * a.h)) * 100).toFixed(2);
  console.log(`${bad ? 'DIFF' : 'ok  '} ${s.name}: ${a.w}x${a.h} -> ${b.w}x${b.h}, ${bad} of ${a.w * a.h} old pixels differ (${pct}%)${[...a.errs, ...b.errs].length ? ' ERRORS ' + [...a.errs, ...b.errs].join(' | ') : ''}`);
  if (process.argv.includes('--shots')) {
    mkdirSync('shots/density', { recursive: true });
    // Raw RGBA dumps are big: just say where the first differences are.
    let shown = 0;
    for (let y = 0; y < a.h && shown < 8; y++)
      for (let x = 0; x < a.w && shown < 8; x++) {
        const i = (y * a.w + x) * 4, o = ((y * k) * b.w + x * k) * 4;
        if (b.px[o] !== a.px[i] || b.px[o + 1] !== a.px[i + 1] || b.px[o + 2] !== a.px[i + 2]) { console.log(`   at ${x},${y}: old ${a.px.slice(i, i + 3)} new ${b.px.slice(o, o + 3)}`); shown++; }
      }
  }
  if (bad) failed++;
}
await browser.close();
await here.close();
await base.close();
process.exit(failed ? 1 : 0);
