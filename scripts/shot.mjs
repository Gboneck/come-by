// Playwright screenshot + console-error check.
//
//   npm run shot                         -> shots/game.png (desktop) and shots/phone.png
//   node scripts/shot.mjs --name=x --query=debug --size=390x844@3 --wait=1500
//        --hold=KeyD:800 --hold=ShiftLeft+KeyW:600 --press=Space --eval="game.x()"
//
// Steps (--hold/--press/--eval/--wait) run in the order given.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const steps = args
  .filter((a) => /^--(hold|press|eval|wait|tap)=/.test(a))
  .map((a) => {
    const i = a.indexOf('=');
    return { kind: a.slice(2, i), val: a.slice(i + 1) };
  });

const PORT = 5199;
let server = null;
async function ensureServer() {
  try {
    const r = await fetch(`http://localhost:${PORT}/`);
    if (r.ok) return;
  } catch { /* start one */ }
  server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
}

const sizes = opt('size', '')
  ? [{ name: opt('name', 'game'), spec: opt('size', '') }]
  : [
      { name: opt('name', 'game'), spec: '1280x720@1' },
      { name: `${opt('name', 'game')}-phone`, spec: '390x844@3' },
    ];

function parseSize(spec) {
  const [wh, dpr] = spec.split('@');
  const [w, h] = wh.split('x').map(Number);
  return { width: w, height: h, dpr: Number(dpr || 1) };
}

await ensureServer();
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
let failed = false;
for (const s of sizes) {
  const { width, height, dpr } = parseSize(s.spec);
  const phone = height > width;
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
    if (m.type() === 'log' && process.env.LOGS) console.log('  log:', m.text());
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const q = opt('query', 'debug');
  await page.goto(`http://localhost:${PORT}/?${q}`);
  await page.waitForTimeout(Number(opt('wait', '1200')));
  for (const st of steps) {
    if (st.kind === 'wait') await page.waitForTimeout(Number(st.val));
    else if (st.kind === 'press') {
      for (const k of st.val.split('+')) await page.keyboard.press(k);
      await page.waitForTimeout(60);
    } else if (st.kind === 'hold') {
      const [keys, ms] = st.val.split(':');
      const ks = keys.split('+');
      for (const k of ks) await page.keyboard.down(k);
      await page.waitForTimeout(Number(ms || 500));
      for (const k of ks.reverse()) await page.keyboard.up(k);
    } else if (st.kind === 'tap') {
      const [x, y] = st.val.split(',').map(Number);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(60);
    } else if (st.kind === 'eval') {
      const r = await page.evaluate(st.val);
      if (r !== undefined) console.log('  eval:', typeof r === 'string' ? r : JSON.stringify(r));
    }
  }
  const out = `shots/${s.name}.png`;
  await page.screenshot({ path: out });
  console.log(`${out}  ${width}x${height}@${dpr}  errors: ${errors.length}`);
  for (const e of errors) console.log('  ' + e);
  if (errors.some((e) => !e.startsWith('[warning]'))) failed = true;
  await ctx.close();
}
await browser.close();
if (server) await server.close();
process.exit(failed ? 1 : 0);
