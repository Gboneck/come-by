// Moving a save between devices (src/ui/transfer.ts): copy a code and save
// a file from the pause menu, then on a fresh "device" load each from the
// title's MOVE A RANCH; the confirm before a ranch is replaced (NO by
// default); and codes that are cut short, garbled, from a newer game or
// damaged are turned away without touching the save.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.TRANSFER_PORT || 5358);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const errors = [];
let failed = 0;
function check(name, ok, info = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info !== '' ? `  (${typeof info === 'string' ? info : JSON.stringify(info)})` : ''}`);
}

// A device: its own storage; the clipboard and the browser's prompt box
// are stand-ins the test can read and fill.
async function device(query) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    window.__clip = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (s) => { window.__clip = s; return Promise.resolve(); }, readText: () => Promise.resolve(window.__clip) } });
    window.prompt = () => null;
  });
  await page.goto(`http://localhost:${PORT}/?${query}`);
  await page.waitForFunction(() => window.game);
  return { ctx, page };
}
const key = async (page, k, n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(k);
    await page.waitForTimeout(70);
  }
};
const note = (page) => page.evaluate(async () => (await import('/src/ui/transfer.ts')).transferState.note);
const stored = (page) => page.evaluate(() => localStorage.getItem('comeby-save-v1'));

// ---- Device one: a ranch to move ----
const one = await device('debug');
await one.page.evaluate(async () => {
  const g = window.game;
  g.tut = 99;
  g.coins = 77;
  g.setTier(3, false);
  g.look = { ...g.look, name: 'ZIGGY', ranch: 'TWO OAKS' };
  const m = await import('/src/ui/build.ts');
  const c = await import('/src/ranch/catalog.ts');
  g.ranch.add(m.makeBuilding(c.defOf('kennel'), 90, 108, 0));
  g.mode = 'pause';
});
await one.page.waitForTimeout(100);
// The pause menu's MOVE THIS RANCH is the row above SAVE AND QUIT.
await key(one.page, 'ArrowUp', 2);
await key(one.page, 'Enter');
check('pause: MOVE THIS RANCH opens the screen', (await one.page.evaluate(() => window.game.mode)) === 'transfer');
await key(one.page, 'Enter'); // COPY A SAVE CODE
await one.page.waitForFunction(() => window.__clip.length > 0);
const code = await one.page.evaluate(() => window.__clip);
check('copy: a COMEBY1 code on the clipboard', /^COMEBY1\.[A-Za-z0-9_-]+$/.test(code), `${code.length} letters`);
const back = await one.page.evaluate(async (code) => {
  const t = await import('/src/ui/transfer.ts');
  const s = await import('/src/systems/save.ts');
  const d = await t.decodeSave(code);
  return { same: JSON.stringify(d) === JSON.stringify(s.saveData(window.game)), json: JSON.stringify(s.saveData(window.game)).length };
}, code);
check('copy: the code is the whole ranch', back.same, `${back.json} bytes of save in ${code.length} letters`);
const [download] = await Promise.all([one.page.waitForEvent('download'), (async () => { await key(one.page, 'ArrowDown'); await key(one.page, 'Enter'); })()]);
const filePath = await download.path();
const fileText = readFileSync(filePath, 'utf8').trim();
check('file: saved as a text file holding the code', download.suggestedFilename() === 'come-by-day-1.txt' && (await one.page.evaluate(async (s) => (await import('/src/ui/transfer.ts')).decodeSave(s).then((d) => typeof d === 'object'), fileText)), download.suggestedFilename());

// ---- Device two: fresh, nothing saved ----
const two = await device('debug&title');
check('fresh device: no save', !(await stored(two.page)));
// START, JOIN A FRIEND, MOVE A RANCH
await key(two.page, 'ArrowDown', 2);
await key(two.page, 'Enter');
check('title: MOVE A RANCH opens the screen', (await two.page.evaluate(() => window.game.mode)) === 'transfer');
const rows = await two.page.evaluate(() => window.game.mode);
// No ranch here: PASTE A SAVE CODE is the first row.
for (const [label, bad] of [
  ['cut short', code.slice(0, Math.floor(code.length / 2))],
  ['garbled', 'COMEBY1.not*a*code'],
  ['not a code at all', 'hello there'],
  ['from a newer game', JSON.stringify({ v: 2, day: 3 })],
  ['damaged', JSON.stringify({ v: 1, day: 3, tier: 2, coins: 1, won: false, tut: 0, tips: [], totals: {}, upgrades: {}, owned: [], buildings: 'nope', wild: [], helpers: [] })],
  ['an animal that does not exist', JSON.stringify({ v: 1, day: 3, tier: 2, coins: 1, won: false, tut: 0, tips: [], totals: {}, upgrades: {}, owned: [], buildings: [], wild: [{ id: 'dragon', coat: 0, stress: 0 }], helpers: [] })],
]) {
  await two.page.evaluate((s) => (window.__clip = s), bad);
  await key(two.page, 'Enter');
  await two.page.waitForTimeout(150);
  const n = await note(two.page);
  const confirm = await two.page.evaluate(async () => !!(await import('/src/ui/transfer.ts')).transferState.incoming);
  check(`refused: ${label}`, !!n && !confirm && !(await stored(two.page)), n);
}
await two.page.evaluate((s) => (window.__clip = s), code);
await key(two.page, 'Enter');
await two.page.waitForFunction(async () => !!(await import('/src/ui/transfer.ts')).transferState.incoming);
check('paste: asks first, NO picked', (await two.page.evaluate(async () => (await import('/src/ui/transfer.ts')).transferState.sel)) === 1);
await key(two.page, 'ArrowUp');
await key(two.page, 'Enter'); // YES, LOAD IT
await two.page.waitForFunction(() => !window.game.demo && window.game.mode === 'play', null, { timeout: 5000 });
const got = await two.page.evaluate(() => ({ coins: window.game.coins, tier: window.game.tier, name: window.game.look.name, ranch: window.game.look.ranch, kennel: window.game.ranch.buildings.some((b) => b.kind === 'kennel') }));
check('paste: the ranch arrives', got.coins === 77 && got.tier === 3 && got.name === 'ZIGGY' && got.ranch === 'TWO OAKS' && got.kennel, got);

// ---- Device two again: a ranch here now; replacing asks, NO keeps it ----
await two.page.evaluate(async () => {
  const g = window.game;
  g.coins = 5;
  (await import('/src/systems/save.ts')).saveGame(g);
  (await import('/src/ui/transfer.ts')).openTransfer(Object.assign(g, { mode: 'pause' }));
});
const before = await stored(two.page);
await key(two.page, 'ArrowDown', 2); // COPY, SAVE FILE, PASTE
await key(two.page, 'Enter');
await two.page.waitForFunction(async () => !!(await import('/src/ui/transfer.ts')).transferState.incoming);
await key(two.page, 'Enter'); // NO (the default)
check('replace: NO keeps the ranch here', (await stored(two.page)) === before && (await two.page.evaluate(() => window.game.mode)) === 'transfer');
await key(two.page, 'Escape');
check('back: Esc returns to the pause menu', (await two.page.evaluate(() => window.game.mode)) === 'pause');

// ---- Device three: the file ----
const three = await device('debug&title');
await key(three.page, 'ArrowDown', 2);
await key(three.page, 'Enter');
await key(three.page, 'ArrowDown'); // LOAD A SAVE FILE
const [chooser] = await Promise.all([three.page.waitForEvent('filechooser'), key(three.page, 'Enter')]);
await chooser.setFiles(filePath);
await three.page.waitForFunction(async () => !!(await import('/src/ui/transfer.ts')).transferState.incoming);
await key(three.page, 'ArrowUp');
await key(three.page, 'Enter');
await three.page.waitForFunction(() => !window.game.demo && window.game.mode === 'play', null, { timeout: 5000 });
check('file: the ranch arrives', (await three.page.evaluate(() => window.game.look.name)) === 'ZIGGY');

// ---- The codec on its own ----
const codec = await three.page.evaluate(async () => {
  const t = await import('/src/ui/transfer.ts');
  const json = localStorage.getItem('comeby-save-v1');
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const plain = await t.decodeSave('COMEBY0.' + b64);
  const raw = await t.decodeSave(json);
  const spaced = await t.decodeSave((await t.encodeSave(json)).replace(/(.{40})/g, '$1\n  '));
  return [typeof plain === 'object', typeof raw === 'object', typeof spaced === 'object'];
});
check('codec: uncompressed codes, plain JSON and codes broken over lines all load', codec.every(Boolean), codec);

if (errors.length) console.log('ERRORS', errors);
console.log(failed || errors.length ? `${failed} failed` : 'all passed');
await browser.close();
await server.close();
process.exit(failed || errors.length ? 1 : 0);
