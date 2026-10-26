// The picture cache (src/gfx/picture.ts) draws exactly what the art asks
// for: the built-up ranch (scripts/fixtures/tier5.json) by day and at night
// in a storm, at three spots, rendered with the cache (filled, then a hit)
// and without it, compared pixel by pixel.
//   node scripts/picturetest.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const fixture = readFileSync(new URL('./fixtures/tier5.json', import.meta.url), 'utf8');
let bad = 0;
const PORT = Number(process.env.PICTURE_PORT || 5362);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 640, height: 400 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
for (const night of [false, true]) {
await page.goto(`http://localhost:${PORT}/?debug&weather=${night ? 'storm' : 'clear'}`);
await page.waitForFunction(() => window.game);
const diffs = await page.evaluate(async ({ save, night }) => {
  const g = window.game;
  localStorage.setItem('comeby-save-v1', save);
  const { loadInto } = await import('/src/systems/save.ts');
  const pic = await import('/src/gfx/picture.ts');
  loadInto(g); g.tut = 99; g.day.t = 120;
  if (night) { g.startNight(); g.quietT = -1e9; }
  const out = [];
  let shot;
  for (const spot of [[96, 104], [90, 100], [106, 110]]) {
    g.dog.x = spot[0] * 8; g.dog.y = spot[1] * 8;
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    g.feel.offset = () => ({ x: 0, y: 0 });
    shot = () => { g.render(); return g.screen.g.getImageData(0, 0, g.screen.W, g.screen.H).data; };
    // Same state three times: pictures on (fill the cache, then a hit), then off.
    const t = g.t;
    pic.setPictures(true); shot(); g.t = t; const a = shot();
    pic.setPictures(false); g.t = t; const c = shot();
    let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
    pic.setPictures(true);
    out.push(diff);
  }
  // A run of frames with things moving: gates swinging, sails turning, the
  // trough shimmering. Pictures are redrawn, or (changing every frame)
  // played straight to the screen; each frame must match the art.
  let moving = 0;
  g.dog.x = 96 * 8; g.dog.y = 104 * 8;
  Object.assign(pic.pictureStats, { hit: 0, miss: 0, direct: 0 });
  for (let f = 0; f < 60; f++) {
    if (f % 20 === 5) for (const p of g.ranch.pens) p.open = !p.open;
    g.update(1 / 60);
    const t = g.t;
    pic.setPictures(true); const a = shot();
    pic.setPictures(false); g.t = t; const c = shot();
    pic.setPictures(true);
    for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) moving++;
  }
  out.push(moving, JSON.stringify(pic.pictureStats));
  return out;
}, { save: fixture, night });
bad += diffs.slice(0, 4).filter(Boolean).length;
console.log(`${diffs.slice(0, 4).every((d) => !d) ? 'ok  ' : 'FAIL'} ${night ? 'night, storm' : 'day'}: pixels that differ at three spots: ${diffs.slice(0, 3).join(', ')}; over 60 moving frames: ${diffs[3]} (pictures ${diffs[4]})`);
}
// The chunked fine layer (src/gfx/chunks.ts) draws what a plain layer does:
// the baked ground through a FineLayer, moving about, against drawImage.
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
const layer = await page.evaluate(async () => {
  const g = window.game;
  const { FineLayer } = await import('/src/gfx/chunks.ts');
  const { WORLD_W, WORLD_H } = await import('/src/world/map.ts');
  const src = g.baked.ground;
  const L = new FineLayer(WORLD_W, WORLD_H, (cg, x0, y0, w, h) => cg.drawImage(src, x0, y0, w, h, x0, y0, w, h), { keep: 12 });
  const sg = g.screen.g, { W, H } = g.screen;
  let diff = 0;
  for (const [ox, oy] of [[700, 760], [710, 765], [300, 200], [1000, 900], [0, 0], [WORLD_W - W, WORLD_H - H]]) {
    L.draw(sg, ox, oy, W, H);
    const a = sg.getImageData(0, 0, g.screen.FW, g.screen.FH).data;
    sg.drawImage(src, ox, oy, W, H, 0, 0, W, H);
    const b = sg.getImageData(0, 0, g.screen.FW, g.screen.FH).data;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  }
  return diff;
});
if (layer) bad++;
console.log(`${layer ? 'FAIL' : 'ok  '} chunked fine layer: pixels that differ from the plain layer at six spots: ${layer}`);
if (errs.length) console.log('ERRORS', errs);
await b.close();
await server.close();
process.exit(bad || errs.length ? 1 : 0);
