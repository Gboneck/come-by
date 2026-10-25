// The "add to home screen" card on the title (src/ui/install.ts): on a
// phone with Chrome's install offer it shows INSTALL, which opens Chrome's
// dialog; on an iPhone it says how; X puts it away for good; never on a
// computer or in the installed app.
//   node scripts/installtest.mjs [--shots] (shots/install/)
import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const SHOTS = process.argv.includes('--shots');
const PORT = Number(process.env.INSTALL_PORT || 5361);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
if (SHOTS) mkdirSync('shots/install', { recursive: true });
const errors = [];
let failed = 0;
function check(name, ok, info = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info !== '' ? `  (${JSON.stringify(info)})` : ''}`);
}

async function open(opts, init) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  if (init) await page.addInitScript(init);
  await page.goto(`http://localhost:${PORT}/?debug&title`);
  await page.waitForFunction(() => window.game);
  await page.waitForTimeout(400);
  return { ctx, page };
}
const shown = (page) => page.evaluate(async () => (await import('/src/ui/install.ts')).installHintShown(window.game));
// Internal pixels to a tap on the page.
async function tapAt(page, which) {
  const [x, y] = await page.evaluate(async (which) => {
    const { hintAt } = await import('/src/ui/install.ts');
    const s = window.game.screen, p = hintAt[which];
    return [(p.x * s.scale) / s.dpr, (p.y * s.scale) / s.dpr];
  }, which);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
}
// Chrome's install offer, as a page sees it.
const offer = () => {
  window.__prompted = 0;
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted++; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(e);
};

// ---- Android Chrome ----
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let { ctx, page } = await open(phone);
check('phone, no offer yet: no card', !(await shown(page)));
await page.evaluate(offer);
await page.waitForTimeout(150);
check('phone with the offer: the card', await shown(page));
if (SHOTS) await page.screenshot({ path: 'shots/install/android.png' });
await tapAt(page, 'install');
check('INSTALL opens Chrome\'s dialog', (await page.evaluate(() => window.__prompted)) === 1);
await page.evaluate(offer); // Chrome offers again after a "not now"
await page.waitForTimeout(150);
await tapAt(page, 'close');
check('X puts it away', !(await shown(page)));
check('X did not start a game', (await page.evaluate(() => window.game.mode)) === 'title');
await page.reload();
await page.waitForFunction(() => window.game);
await page.evaluate(offer);
await page.waitForTimeout(200);
check('...and it stays away', !(await shown(page)));
await ctx.close();

// ---- iPhone Safari ----
({ ctx, page } = await open({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }));
check('iPhone: the card, with no offer needed', await shown(page));
if (SHOTS) await page.screenshot({ path: 'shots/install/iphone.png' });
await ctx.close();

// ---- Installed already (standalone), and a computer ----
({ ctx, page } = await open({ ...devices['iPhone 13'] }, () => Object.defineProperty(navigator, 'standalone', { get: () => true })));
check('running as the installed app: no card', !(await shown(page)));
await ctx.close();
({ ctx, page } = await open({ viewport: { width: 1280, height: 720 } }));
await page.evaluate(offer);
await page.waitForTimeout(150);
check('a computer: no card', !(await shown(page)));
await ctx.close();

if (errors.length) console.log('ERRORS', errors);
console.log(failed || errors.length ? `${failed} failed` : 'all passed');
await browser.close();
await server.close();
process.exit(failed || errors.length ? 1 : 0);
