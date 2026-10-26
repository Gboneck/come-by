// The paddock editor in build mode, end to end on a phone (touch): drag out
// a field, drag a side handle and the gate, the steppers, build it, reopen
// it to extend (priced at the difference, never smaller than it was), a
// trough inside it, ESC. Uses the ranch's paddock rules, or the stand-in
// (src/ui/paddockdev.ts) while there are none. Shots in shots/paddock/.
//
//   node scripts/paddockuitest.mjs        (PORT moves its server)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const root = process.cwd();
const PORT = Number(process.env.PORT || 5193);
mkdirSync('shots/paddock', { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForTimeout(1500);
let fails = 0;
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`); if (!ok) fails++; };
const spot = await page.evaluate(async () => {
  const p = await import('/src/ui/paddockbuild.ts');
  if (!p.paddockRules()) (await import('/src/ui/paddockdev.ts')).useDevPaddocks();
  const c = await import('/src/ranch/catalog.ts');
  game.coins = 500; game.tier = 4; game.enterBuild(); game.build.item = c.CATALOG.findIndex((d) => d.id === p.paddockRules().tool);
  const R = p.paddockRules(), b = game.build;
  const land = (x, y) => b.buildable(game, x, y);
  // A free 14x10 spot, so there is room to grow a 10x6 paddock.
  for (let ty = 40; ty < 160; ty++) for (let tx = 40; tx < 160; tx++) {
    const r = { tx, ty, w: 14, h: 9 };
    if (!R.problem(game, r, { side: 0, at: 6 }, land)) return { tx: tx + 2, ty: ty + 2 };
  }
  return null;
});
check('found open land', !!spot, spot);
await page.evaluate(([x, y]) => { game.build.cx = x + 5; game.build.cy = y + 3; }, [spot.tx, spot.ty]);
await page.waitForTimeout(1200);
const toScreen = (wx, wy) => page.evaluate(([wx, wy]) => { const v = game.view(); return [wx - v.ox, wy - v.oy]; }, [wx, wy]);
const ptr = (kind, x, y, id = 7) => page.evaluate(([kind, x, y, id]) => {
  const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
  const ev = new PointerEvent('pointer' + kind, { pointerId: id, pointerType: 'touch', clientX: r.left + (x + 0.5) * r.width / game.screen.W, clientY: r.top + (y + 0.5) * r.height / game.screen.H, bubbles: true, isPrimary: true });
  (kind === 'down' ? c : window).dispatchEvent(ev);
}, [kind, x, y, id]);
async function drag(ax, ay, bx, by, steps = 8) {
  await ptr('down', ax, ay); await page.waitForTimeout(50);
  for (let i = 1; i <= steps; i++) { await ptr('move', ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps); await page.waitForTimeout(25); }
  await page.waitForTimeout(50); await ptr('up', bx, by); await page.waitForTimeout(80);
}
const T = 8;
// 1. Drag out a 10x6 band from tile centre to tile centre.
let [ax, ay] = await toScreen(spot.tx * T + 4, spot.ty * T + 4);
let [bx, by] = await toScreen((spot.tx + 9) * T + 4, (spot.ty + 5) * T + 4);
await drag(ax, ay, bx, by);
let d = await page.evaluate(() => game.build.paddock.draft && { ...game.build.paddock.draft.r });
check('a dragged band becomes a 10x6 draft', d && d.w === 10 && d.h === 6 && d.tx === spot.tx && d.ty === spot.ty, d);
await page.screenshot({ path: `${root}/shots/paddock/band.png` });
// 2. Drag the east handle out two tiles.
const knob = (h) => page.evaluate((h) => { const ed = game.build.paddock; const k = ed.knobs(ed.draft, true).find((k) => k.h === h); const v = game.view(); return [k.x - v.ox, k.y - v.oy]; }, h);
[ax, ay] = await knob('e');
await drag(ax, ay, ax + 16, ay);
d = await page.evaluate(() => ({ ...game.build.paddock.draft.r }));
check('dragging the east handle out two tiles widens it to 12', d.w === 12 && d.tx === spot.tx, d);
// 3. The gate dragged onto the east side.
[ax, ay] = await knob('gate');
const [ex, ey] = await toScreen((d.tx + d.w) * T - 2, (d.ty + 3) * T);
await drag(ax, ay, ex, ey);
let gate = await page.evaluate(() => ({ ...game.build.paddock.draft.gate }));
check('the gate drags round onto the east side', gate.side === 3, gate);
// 4. Steppers and the gate walk (as the buttons call them).
await page.evaluate(async () => { const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules(); const ed = game.build.paddock; ed.step(R, 'h', 1); ed.step(R, 'h', -1); ed.step(R, 'h', -1); ed.gateStep(R, -1); });
d = await page.evaluate(() => ({ ...game.build.paddock.draft.r, gate: game.build.paddock.draft.gate }));
check('H- shrinks the south side, the gate walks back along the east side', d.h === 5 && d.gate.side === 3 && d.gate.at === 1, d);
await page.screenshot({ path: `${root}/shots/paddock/draft.png` });
// 5. Build it.
const coins0 = await page.evaluate(() => game.coins);
await page.keyboard.press('Space'); await page.waitForTimeout(150);
const built = await page.evaluate(async () => { const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules(); const b = game.ranch.buildings.filter((b) => R.is(b)); return { n: b.length, r: b[0] && { tx: b[0].tx, ty: b[0].ty, w: b[0].w, h: b[0].h, gate: b[0].gate }, coins: game.coins, draft: !!game.build.paddock.draft, msg: game.build.msg?.text }; });
check('SPACE builds it and pays', built.n === 1 && built.r.w === 12 && built.r.h === 5 && built.coins < coins0 && !built.draft, { ...built, coins0 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${root}/shots/paddock/built.png` });
// 6. Tap the paddock: the inspect card; U opens it to extend.
[ax, ay] = await toScreen((built.r.tx + 6) * T, (built.r.ty + 2) * T);
await ptr('down', ax, ay); await page.waitForTimeout(60); await ptr('up', ax, ay); await page.waitForTimeout(150);
await page.screenshot({ path: `${root}/shots/paddock/inspect.png` });
await page.keyboard.press('KeyU'); await page.waitForTimeout(100);
let ext = await page.evaluate(() => { const d = game.build.paddock.draft; return d && { base: !!d.base, handle: game.build.paddock.handle }; });
check('U on the paddock opens it to extend', ext && ext.base, ext);
// 7. Pull the north side up two tiles: priced at the difference only.
[ax, ay] = await knob('n');
await drag(ax, ay, ax, ay - 16);
const q = await page.evaluate(async () => { const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules(); const ed = game.build.paddock; const land = (x, y) => game.build.buildable(game, x, y); return { r: { ...ed.draft.r }, q: ed.quote(game, R, land), full: R.price(ed.draft.r) }; });
check('dragging the north handle up grows it, priced at the difference', q.r.h === 7 && q.r.ty === built.r.ty - 2 && q.q.cost > 0 && q.q.cost < q.full, q);
// 8. Pulling a side inward stops at the old fence.
[ax, ay] = await knob('e');
await drag(ax, ay, ax - 40, ay);
d = await page.evaluate(() => ({ ...game.build.paddock.draft.r }));
check('a side cannot come in past the old fence', d.w === 12 && d.tx === built.r.tx, d);
await page.screenshot({ path: `${root}/shots/paddock/extend.png` });
const c1 = await page.evaluate(() => game.coins);
await page.keyboard.press('Space'); await page.waitForTimeout(150);
const after = await page.evaluate(async () => { const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules(); const b = game.ranch.buildings.find((b) => R.is(b)); return { r: { tx: b.tx, ty: b.ty, w: b.w, h: b.h }, gate: b.gate, coins: game.coins, msg: game.build.msg?.text }; });
check('SPACE extends it and pays the difference', after.r.h === 7 && c1 - after.coins === q.q.cost, { ...after, paid: c1 - after.coins });
check('the gate stayed on the same fence post after the north side moved', after.gate.side === 3 && after.gate.at === built.r.gate.at + 2, { before: built.r.gate, after: after.gate });
// 8b. A trough dropped inside the paddock.
const fx = await page.evaluate(async () => {
  const c = await import('/src/ranch/catalog.ts'); const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules();
  const b = game.build, pd = game.ranch.buildings.find((x) => R.is(x));
  b.item = c.CATALOG.findIndex((d) => d.id === 'trough');
  b.cx = pd.tx - 3; b.cy = pd.ty + 2;
  const outside = b.ghost(game).reason;
  b.cx = pd.tx + 3; b.cy = pd.ty + 3;
  const g = b.ghost(game);
  return { outside, ok: g.ok, reason: g.reason };
});
check('a trough outside is refused, inside is fine', fx.outside === 'PLACE IT IN A PADDOCK' && fx.ok, fx);
await page.waitForTimeout(200);
await page.screenshot({ path: `${root}/shots/paddock/trough.png` });
await page.keyboard.press('Space'); await page.waitForTimeout(150);
const fx2 = await page.evaluate(async () => { const c = await import('/src/ranch/catalog.ts'); const p = await import('/src/ui/paddockbuild.ts'); const R = p.paddockRules(); const pd = game.ranch.buildings.find((x) => R.is(x)); game.build.item = c.CATALOG.findIndex((d) => d.id === p.paddockRules().tool); game.build.cx = pd.tx + 4; game.build.cy = pd.ty + 3; return R.fixtureNames(pd).length; });
check('SPACE puts the trough in the paddock', fx2 === 1, fx2);
// 9. Esc on a draft cancels the draft, not build mode.
await page.keyboard.press('Space'); await page.waitForTimeout(80); // cursor is on the paddock: opens it again
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
const esc = await page.evaluate(() => ({ mode: game.mode, draft: !!game.build.paddock.draft }));
check('ESC cancels the draft and stays in build mode', esc.mode === 'build' && !esc.draft, esc);
check('no console errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
