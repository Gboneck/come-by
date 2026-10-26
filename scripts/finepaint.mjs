// Paints a rect of the world with the fine (2x) ground and canopy painters
// and saves it at fine resolution, for looking at the art on its own.
//
//   node scripts/finepaint.mjs --at=820,880 --size=240x160 [--name=ranch]
//        [--season=winter|autumn|spring] [--look=snow:2,wet:1] [--layer=ground|canopy|both]
//        [--zoom=3]
//
// --at and --size are in world px; the PNG is 2x that (one fine pixel each),
// enlarged by --zoom with nearest-neighbour. Written to shots/fine/.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const [ax, ay] = opt('at', '820,880').split(',').map(Number);
const [sw, sh] = opt('size', '240x160').split('x').map(Number);
const name = opt('name', `fine-${ax}-${ay}`);
const zoom = Number(opt('zoom', '3'));
const layer = opt('layer', 'both');
const look = Object.fromEntries(opt('look', '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split(':'); return [k, Number(v)]; }));
const season = opt('season', '');

const PORT = Number(process.env.SHOT_PORT || 5199);
let server = null;
try {
  const r = await fetch(`http://localhost:${PORT}/`);
  if (!r.ok) throw 0;
} catch {
  server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/?debug${season ? `&season=${season}` : ''}`);
await page.waitForFunction(() => window.game && window.game.baked, null, { timeout: 30000 });
const res = await page.evaluate(async ({ ax, ay, sw, sh, zoom, layer, look }) => {
  const g = await import('/src/world/fineground.ts');
  for (const k in g.paintTime) g.paintTime[k] = 0;
  const t0 = performance.now();
  const W = sw * 2, H = sh * 2;
  const lk = { snow: 0, leaves: 0, bloom: 0, wet: 0, golden: 0, ...look };
  const ground = layer === 'canopy' ? null : g.paintGround(window.game.baked, ax * 2, ay * 2, W, H, lk);
  const t1 = performance.now();
  const canopy = layer === 'ground' ? null : g.paintCanopy(window.game.baked, ax * 2, ay * 2, W, H, lk);
  const t2 = performance.now();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cg = c.getContext('2d');
  const put = (px) => {
    const img = cg.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(px);
    const t = document.createElement('canvas');
    t.width = W; t.height = H;
    t.getContext('2d').putImageData(img, 0, 0);
    cg.drawImage(t, 0, 0);
  };
  if (ground) put(ground);
  if (canopy) put(canopy);
  const z = document.createElement('canvas');
  z.width = W * zoom; z.height = H * zoom;
  const zg = z.getContext('2d');
  zg.imageSmoothingEnabled = false;
  zg.drawImage(c, 0, 0, W * zoom, H * zoom);
  return { url: z.toDataURL('image/png'), ground: t1 - t0, canopy: t2 - t1, px: W * H, parts: JSON.stringify(g.paintTime) };
}, { ax, ay, sw, sh, zoom, layer, look });
mkdirSync('shots/fine', { recursive: true });
writeFileSync(`shots/fine/${name}.png`, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`parts ${res.parts}`);
console.log(`shots/fine/${name}.png  ground ${res.ground.toFixed(1)}ms  canopy ${res.canopy.toFixed(1)}ms  (${res.px} fine px, ${((res.ground * 1000) / res.px).toFixed(2)} us/px ground)  errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log('  ', e);
await browser.close();
if (server) await server.close();
process.exit(errors.length ? 1 : 0);
