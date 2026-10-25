// The installable app (scripts/pwa.mjs), against real static builds:
// - the manifest and icons are served and Chrome finds it installable;
// - after one visit the game starts with the server switched off;
// - a new deploy is picked up on the next launch, and the old build's
//   cache is cleared away;
// - requests to other origins (the co-op relay) are not answered from the
//   cache.
//   node scripts/pwatest.mjs [--shots] (shots/pwa/)
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHOTS = process.argv.includes('--shots');
const PORT = Number(process.env.PWA_PORT || 5359);
const OTHER = PORT + 1; // another origin, standing in for the relay
const outDir = mkdtempSync(join(tmpdir(), 'comeby-pwa-'));
let failed = 0;
function check(name, ok, info = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info !== '' ? `  (${typeof info === 'string' ? info : JSON.stringify(info)})` : ''}`);
}

async function deploy(relay) {
  process.env.VITE_RELAY_URL = relay; // baked into the bundle, so each build differs
  await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
}
let server = null;
const up = async () => (server = await preview({ logLevel: 'error', build: { outDir }, preview: { port: PORT, strictPort: true } }));
const down = async () => {
  await new Promise((r) => server.httpServer.close(r));
  server.httpServer.closeAllConnections?.();
};

let hits = 0;
const other = createServer((req, res) => {
  hits++;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(`hit ${hits}`);
});
await new Promise((r) => other.listen(OTHER, r));

await deploy('https://relay-a.example');
await up();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const url = `http://localhost:${PORT}/?debug`;
await page.goto(url);
await page.waitForFunction(() => window.game);
if (SHOTS) mkdirSync('shots/pwa', { recursive: true });

// ---- The manifest, the icons, installable ----
const m = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
  const man = await (await fetch(href)).json();
  const size = async (src) => {
    const b = new Uint8Array(await (await fetch(src)).arrayBuffer());
    const v = new DataView(b.buffer);
    return [b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, v.getUint32(16), v.getUint32(20)];
  };
  const icons = [];
  for (const ic of man.icons) icons.push({ ...ic, real: await size(ic.src) });
  const apple = document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href');
  return {
    man, icons, apple: apple ? await size(apple) : null,
    metas: ['apple-mobile-web-app-capable', 'apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style', 'theme-color'].map((n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content')),
  };
});
check('manifest: name, colours, full screen, any rotation', m.man.name === 'Come By' && m.man.theme_color === '#42315A' && m.man.background_color === '#42315A' && m.man.display === 'standalone' && m.man.display_override?.[0] === 'fullscreen' && m.man.orientation === 'any', { name: m.man.name, display: m.man.display, orientation: m.man.orientation });
check('icons: real PNGs at their sizes (192, 512, maskable 512)', m.icons.length === 3 && m.icons.every((ic) => ic.real[0] && `${ic.real[1]}x${ic.real[2]}` === ic.sizes) && m.icons.some((ic) => ic.purpose === 'maskable'), m.icons.map((ic) => `${ic.sizes} ${ic.purpose}`));
check('iOS: apple-touch-icon 180x180 and the meta tags', m.apple?.[0] && m.apple[1] === 180 && m.metas.every(Boolean), m.metas);
const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
check('Chrome: installable', inst.installabilityErrors.length === 0, inst.installabilityErrors.map((e) => e.errorId));

// ---- The worker takes charge and keeps the build ----
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => window.game && navigator.serviceWorker.controller);
const cache1 = await page.evaluate(async () => {
  const keys = await caches.keys();
  const c = await caches.open(keys[0]);
  return { keys, files: (await c.keys()).map((r) => new URL(r.url).pathname) };
});
check('worker: in charge, one cache named for the build', cache1.keys.length === 1 && /^come-by-[0-9a-f]{12}$/.test(cache1.keys[0]), cache1.keys);
check('worker: every file of the build kept', ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'].every((f) => cache1.files.includes(f)) && cache1.files.some((f) => /^\/assets\/index-.*\.js$/.test(f)), cache1.files);

// ---- Other origins go to the network ----
const r1 = await page.evaluate((u) => fetch(u).then((r) => r.text()), `http://localhost:${OTHER}/relay`);
const r2 = await page.evaluate((u) => fetch(u).then((r) => r.text()), `http://localhost:${OTHER}/relay`);
check('relay: other origins are never answered from the cache', r1 === 'hit 1' && r2 === 'hit 2', [r1, r2]);

// ---- Offline: the server is switched off ----
await down();
other.close();
await page.reload();
await page.waitForFunction(() => window.game, null, { timeout: 10000 });
await page.waitForTimeout(500);
const off = await page.evaluate(() => ({ mode: window.game.mode, t: window.game.t }));
check('offline: the game starts from the kept build', off.mode === 'play' && off.t > 0, off);
const relayDown = await page.evaluate((u) => fetch(u).then(() => 'answered', () => 'failed'), `http://localhost:${OTHER}/relay`);
check('offline: the relay is not faked from the cache', relayDown === 'failed', relayDown);
if (SHOTS) await page.screenshot({ path: 'shots/pwa/offline.png' });

// ---- A new deploy ----
const oldScript = await page.evaluate(() => document.querySelector('script[type=module]').getAttribute('src'));
await deploy('https://relay-b.example');
await up();
await page.reload(); // the next launch
await page.waitForFunction(() => window.game);
const newScript = await page.evaluate(() => document.querySelector('script[type=module]').getAttribute('src'));
const bundle = await page.evaluate((s) => fetch(s).then((r) => r.text()), newScript);
check('new deploy: picked up on the next launch', newScript !== oldScript && bundle.includes('relay-b.example'), `${oldScript} -> ${newScript}`);
// The new worker installs the new build, then clears the old one away.
for (let i = 0; i < 50; i++) {
  if ((await page.evaluate(() => caches.keys())).length === 1 && (await page.evaluate(() => caches.keys()))[0] !== cache1.keys[0]) break;
  await page.waitForTimeout(200);
}
const cache2 = await page.evaluate(() => caches.keys());
check('new deploy: the old build\'s cache is cleared', cache2.length === 1 && cache2[0] !== cache1.keys[0], cache2);
// And it plays offline on the new build too.
await down();
await page.reload();
await page.waitForFunction(() => window.game, null, { timeout: 10000 });
const off2 = await page.evaluate(() => document.querySelector('script[type=module]').getAttribute('src'));
check('new deploy: offline from the new build', off2 === newScript, off2);

// With the server off, the worker's look for an update fails: expected.
const realErrors = errors.filter((e) => !/Failed to load resource|ERR_CONNECTION_REFUSED|relay/i.test(e));
if (realErrors.length) console.log('ERRORS', [...new Set(realErrors)].slice(0, 5));
console.log(failed || realErrors.length ? `${failed} failed` : 'all passed');
await browser.close();
process.exit(failed || realErrors.length ? 1 : 0);
