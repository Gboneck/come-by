// Co-op end to end: a relay (wrangler dev), Vite, and two browsers, a host
// and a guest, each its own Chromium like two phones. The guest's dog walks
// round behind a flock on the host's ranch and drives it into the pen.
// Checks: the host's herd reacts to the guest's dog, the pen fills, the
// guest sees it, the pay lands on the host and the guest's own save is
// left alone; then a bark and a nip from the guest, a dropped line and a
// reconnect, the guest leaving, the host closing the ranch, snapshot size
// and rate, and the drive again with lag on the guest's line.
//   node scripts/cooptest.mjs [--lag=150] [--shots] [--relay=https://...]
// --relay plays through a deployed relay instead of starting wrangler dev.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const LAG = Number(arg('lag', 150));
const SHOTS = process.argv.includes('--shots');
const VITE_PORT = Number(process.env.COOP_VITE_PORT ?? 5232);
const RELAY_PORT = Number(process.env.COOP_RELAY_PORT ?? 8790);
const REMOTE = arg('relay', '');
const RELAY = REMOTE || `http://127.0.0.1:${RELAY_PORT}`;
const root = fileURLToPath(new URL('..', import.meta.url));
mkdirSync(`${root}shots/coop`, { recursive: true });

let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The relay ----
if (!REMOTE && !existsSync(`${root}server/node_modules/.bin/wrangler`)) {
  console.log('FAIL the relay\'s packages are not installed: run (cd server && npm install) first');
  process.exit(1);
}
const relay = REMOTE ? null : spawn('npx', ['wrangler', 'dev', '--port', String(RELAY_PORT), '--ip', '127.0.0.1', '--log-level', 'warn'], { cwd: `${root}server`, stdio: ['ignore', 'pipe', 'pipe'] });
let relayLog = '';
relay?.stdout.on('data', (d) => (relayLog += d));
relay?.stderr.on('data', (d) => (relayLog += d));
const stopRelay = () => { try { relay?.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', stopRelay);
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await wait(500);
  try { up = (await fetch(`${RELAY}/health`)).ok; } catch { /* not yet */ }
}
if (!up) {
  console.log(relayLog);
  console.log('FAIL relay did not start');
  process.exit(1);
}

const server = await createServer({ root, server: { port: VITE_PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const site = `http://localhost:${VITE_PORT}`;

// Two browsers, not two tabs: nothing shared, and neither is a background tab.
const launch = () => chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'] });
const hostB = await launch(), guestB = await launch();
// One context per player, as one phone each: a guest's later visit sees
// what the earlier one stored (their travels).
const hostCtx = await hostB.newContext({ viewport: { width: 960, height: 600 } });
const guestCtx = await guestB.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
async function open(browser, url, viewport, who) {
  const page = await (browser === hostB ? hostCtx : guestCtx).newPage();
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket|ERR_CONNECTION|Failed to load resource/.test(m.text()) && errors.push(`${who}: ${m.text()}`));
  await page.goto(url);
  return page;
}

// ---- The host: a tier-2 ranch with a flock of sheep in the Home Meadow ----
const host = await open(hostB, `${site}/?debug&relay=${RELAY}`, { width: 960, height: 600 }, 'host');
await host.waitForFunction(() => window.game && window.game.mode === 'play');
const setup = await host.evaluate(async () => {
  const g = window.game;
  const { Animal } = await import('/src/entities/animal.ts');
  g.setTier(2, false);
  g.tut = 99;
  g.tip = null;
  g.animals.length = 0;
  g.day.t = 20;
  g.weather.force('clear');
  const pen = g.ranch.pens[0];
  const gp = pen.gatePoint(10);
  // A flock 100px south-west of the gate, grazing in the open.
  const fx = gp.x - 60, fy = gp.y + 80;
  for (let i = 0; i < 6; i++) g.animals.push(new Animal('sheep', fx + (i % 3) * 9 - 9, fy + Math.floor(i / 3) * 9 - 4));
  // The host's own dog lies down out of the way, by the house.
  g.dog.x = g.doorPoint().x - 40;
  g.dog.y = g.doorPoint().y + 4;
  g.input.override = { x: 0, y: 0, sprint: false, lie: true };
  g.look.name = 'BLUE';
  const coop = await import('/src/ui/coop.ts');
  coop.openCoop(g, 'invite');
  return { pen: { x: gp.x, y: gp.y, inX: pen.gatePoint(-14).x, inY: pen.gatePoint(-14).y }, flock: { x: fx, y: fy }, coins: g.coins };
});
await host.waitForFunction(() => window.game.net && window.game.net.code && window.game.net.status === 'open', null, { timeout: 15000 });
const code = await host.evaluate(() => window.game.net.code);
check('host opens a room', /^[A-Z]{4}$/.test(code), code);
if (SHOTS) await host.screenshot({ path: `${root}shots/coop/host-invite.png` });
// Back to the field; the room stays open.
await host.keyboard.press('Escape');
await host.waitForFunction(() => window.game.mode === 'pause');
await host.keyboard.press('Escape');
await host.waitForFunction(() => window.game.mode === 'play');

// ---- The guest: their own save (ZIGGY, a saddle and a collar) follows the link ----
const guestSave = JSON.stringify({ v: 1, day: 9, tier: 3, coins: 123, won: false, tut: 99, tips: [], totals: {}, upgrades: { stamina: 1, speed: 1, bark: 1, nip: 1 }, owned: [], buildings: [], wild: [], helpers: [], look: { name: 'ZIGGY', dog: { speckle: 'heavy', mask: 'one', saddle: true, tailTip: true, neck: 'collar' } } });
async function joinGuest(extra = '') {
  const page = await open(guestB, `${site}/?debug&title&relay=${RELAY}&join=${code}${extra}`, { width: 390, height: 844 }, 'guest');
  await page.evaluate((s) => localStorage.setItem('comeby-save-v1', s), guestSave);
  await page.reload();
  await page.waitForFunction(() => window.game?.net?.role === 'guest' && window.game.net.ready, null, { timeout: 20000 });
  await page.waitForFunction(() => window.game.animals.length > 0, null, { timeout: 5000 }).catch(() => {});
  return page;
}
let guest = await joinGuest();
const joined = await guest.evaluate(() => {
  const g = window.game, n = g.net;
  return { slot: n.slot, host: n.hostName, tier: g.tier, mode: g.mode, animals: g.animals.length, name: g.look.name, saddle: g.look.dog.saddle, puppets: g.coop.map((d) => d.tag) };
});
check('guest joins by the link', joined.slot === 1 && joined.mode === 'play', JSON.stringify(joined));
check('guest sees the host ranch: tier, herd, the host dog', joined.tier === 2 && joined.animals === 6 && joined.puppets.includes('BLUE'));
check('guest keeps their own dog (name and look)', joined.name === 'ZIGGY' && joined.saddle);
await host.waitForFunction(() => window.game.net.dogs.length === 1);
const hostSees = await host.evaluate(() => ({ tag: window.game.coop[0].tag, banner: window.game.banner?.big }));
check('host gets a buttercup dog with a name tag', hostSees.tag === 'ZIGGY', JSON.stringify(hostSees));
if (SHOTS) {
  await wait(400);
  await guest.screenshot({ path: `${root}shots/coop/guest-joined.png` });
  await host.screenshot({ path: `${root}shots/coop/host-friend-here.png` });
}

// ---- Drive: the guest's bot works the flock into the pen ----
// The bot runs in the guest's page against what the guest sees (the host's
// world, a little behind), steering the guest's own dog.
async function drive(page, goal, seconds) {
  return page.evaluate(async ({ goal, seconds }) => {
    const g = window.game;
    const bot = await import('/src/bot.ts');
    const t0 = performance.now();
    let t = 0;
    return await new Promise((done) => {
      const iv = setInterval(() => {
        t = (performance.now() - t0) / 1000;
        const loose = g.animals.filter((a) => !a.pen && !a.gone);
        if (!loose.length || t > seconds) {
          clearInterval(iv);
          g.input.override = { x: 0, y: 0, sprint: false, lie: false };
          done({ t: +t.toFixed(1), left: loose.length });
          return;
        }
        let cx = 0, cy = 0;
        for (const a of loose) { cx += a.x; cy += a.y; }
        cx /= loose.length; cy /= loose.length;
        // Up to the gate, then in.
        const near = Math.hypot(cx - goal.x, cy - goal.y) < 26;
        const c = bot.botStep(g, { goalX: near ? goal.inX : goal.x, goalY: near ? goal.inY : goal.y }, t);
        g.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
      }, 16);
    });
  }, { goal, seconds });
}
// Walk the guest's dog round behind the flock first.
await guest.evaluate(({ f }) => {
  const g = window.game;
  g.dog.x = f.x - 20;
  g.dog.y = f.y + 60;
}, { f: setup.flock });
const sample = () => host.evaluate(() => ({ x: window.game.animals.reduce((s, a) => s + a.x, 0) / window.game.animals.length, y: window.game.animals.reduce((s, a) => s + a.y, 0) / window.game.animals.length, guest: { x: window.game.coop[0]?.x, y: window.game.coop[0]?.y }, src: window.game.coop.length }));
// What the guest hears (the host's sounds come across with the snapshots).
await guest.evaluate(() => {
  const a = window.game.audio, play = a.play.bind(a);
  window.__heard = [];
  a.play = (n, o) => { window.__heard.push(n); return play(n, o); };
});
const before = await sample();
const driving = drive(guest, setup.pen, 90);
await wait(4000);
const mid = await sample();
const gdog = await guest.evaluate(() => ({ x: window.game.dog.x, y: window.game.dog.y }));
check('host has the guest dog where the guest has it', Math.hypot(mid.guest.x - gdog.x, mid.guest.y - gdog.y) < 30, `${Math.round(Math.hypot(mid.guest.x - gdog.x, mid.guest.y - gdog.y))}px apart`);
check("host's herd moves for the guest's dog", Math.hypot(mid.x - before.x, mid.y - before.y) > 8, `${Math.round(Math.hypot(mid.x - before.x, mid.y - before.y))}px in 4s`);
if (SHOTS) await guest.screenshot({ path: `${root}shots/coop/guest-driving.png` });
const res = await driving;
await wait(1200);
const after = await host.evaluate(() => ({ penned: window.game.ranch.pens[0].animals.length, coins: window.game.coins, loose: window.game.animals.filter((a) => !a.pen).length }));
check('the guest drives the flock into the pen (host)', after.penned === 6, `${after.penned}/6 in ${res.t}s`);
check('the pay lands on the host', after.coins > setup.coins, `${setup.coins}$ -> ${after.coins}$`);
const guestAfter = await guest.evaluate(() => ({ penned: window.game.animals.filter((a) => a.pen).length, coins: window.game.coins, save: localStorage.getItem('comeby-save-v1') }));
check('the guest sees them penned and the purse', guestAfter.penned === 6 && guestAfter.coins === after.coins, JSON.stringify({ penned: guestAfter.penned, coins: guestAfter.coins }));
check("the guest's own save is untouched", guestAfter.save === guestSave);
const heard = await guest.evaluate(() => [...new Set(window.__heard)]);
check("the guest hears the pen fill (coins, the whistle)", heard.includes('coin') && heard.includes('thatlldo'), heard.join(','));
if (SHOTS) {
  await guest.keyboard.press('KeyG');
  await wait(400);
  await guest.screenshot({ path: `${root}shots/coop/guest-ledger.png` });
  await guest.keyboard.press('KeyG');
  await wait(200);
  await guest.keyboard.press('Escape');
  await wait(400);
  await guest.screenshot({ path: `${root}shots/coop/guest-pause.png` });
  await guest.keyboard.press('Escape');
  await wait(200);
  check('the guest can open and close the Ledger and pause', await guest.evaluate(() => window.game.mode === 'play'));
}
if (SHOTS) await guest.screenshot({ path: `${root}shots/coop/guest-penned.png` });
const credit = await host.evaluate(() => window.game.banner?.big ?? '');
check("the that'll do goes to the dog that drove them", credit === "THAT'LL DO, ZIGGY!", credit);

// ---- The host ends the day: the guest waits on the card, then a new morning ----
await host.evaluate(() => window.game.endDay());
await guest.waitForFunction(() => window.game.net.hostMode === 'summary' && window.game.summary, null, { timeout: 5000 }).catch(() => {});
const sum = await guest.evaluate(() => ({ mode: window.game.net.hostMode, day: window.game.summary?.day, free: window.game.net.waiting }));
check('host at the summary: the guest sees the card and waits', sum.mode === 'summary' && sum.day === 1 && sum.free, JSON.stringify(sum));
if (SHOTS) {
  await wait(500);
  await guest.screenshot({ path: `${root}shots/coop/guest-summary.png` });
}
await host.evaluate(() => window.game.startDay());
await guest.waitForFunction(() => window.game.day.day === 2 && window.game.net.hostMode === 'play', null, { timeout: 5000 }).catch(() => {});
const morning = await guest.evaluate(() => { const g = window.game, d = g.doorPoint(); return { day: g.day.day, fromDoor: Math.round(Math.hypot(g.dog.x - d.x, g.dog.y - d.y)) }; });
check('a new morning: day 2, and the guest dog is back at the door', morning.day === 2 && morning.fromDoor < 40, JSON.stringify(morning));
await host.evaluate(() => window.game.enterBuild());
await guest.waitForFunction(() => window.game.net.hostMode === 'build', null, { timeout: 5000 }).catch(() => {});
check('host building: the guest is told to wait', await guest.evaluate(() => window.game.net.hostMode === 'build' && window.game.net.waiting));
if (SHOTS) {
  await wait(400);
  await guest.screenshot({ path: `${root}shots/coop/guest-host-building.png` });
}
await host.evaluate(() => window.game.exitBuild());
await host.evaluate(() => { window.game.day.t = 20; });

// ---- Snapshot size and rate ----
const rate = await host.evaluate(async () => {
  const n = window.game.net;
  const a = { ...n.stats };
  await new Promise((r) => setTimeout(r, 3000));
  const b = n.stats;
  return { hz: +((b.snaps - a.snaps) / 3).toFixed(1), kbs: +((b.bytes - a.bytes) / 3 / 1024).toFixed(2), max: b.maxSnap };
});
check('snapshots about 15 a second', rate.hz >= 12 && rate.hz <= 17, `${rate.hz}/s`);
check('snapshots stay small', rate.max < 4000 && rate.kbs < 30, `${rate.kbs} KB/s, largest ${rate.max} B`);

// ---- A bark and a nip from the guest ----
const barkRes = await (async () => {
  await host.evaluate(async () => {
    const g = window.game;
    const { Animal } = await import('/src/entities/animal.ts');
    const d = g.doorPoint();
    for (let i = 0; i < 4; i++) {
      const a = new Animal('sheep', d.x + 60 + i * 8, d.y + 60);
      a.stress = 0;
      g.animals.push(a);
    }
  });
  await wait(600);
  await guest.evaluate(() => {
    const g = window.game, d = g.doorPoint();
    g.dog.x = d.x + 72;
    g.dog.y = d.y + 85;
  });
  await wait(700);
  const s0 = await host.evaluate(() => Math.max(...window.game.animals.filter((a) => !a.pen).map((a) => a.stress)));
  await guest.evaluate(() => window.game.input.push('bark'));
  await wait(700);
  const s1 = await host.evaluate(() => Math.max(...window.game.animals.filter((a) => !a.pen).map((a) => a.stress)));
  return { s0, s1 };
})();
check("a guest's bark rattles the host's flock", barkRes.s1 > barkRes.s0 + 0.08, `stress ${barkRes.s0.toFixed(2)} -> ${barkRes.s1.toFixed(2)}`);
const nipRes = await (async () => {
  const id = await host.evaluate(async () => {
    const g = window.game;
    const { Animal } = await import('/src/entities/animal.ts');
    g.animals = g.animals.filter((a) => a.pen);
    const d = g.doorPoint();
    const cow = new Animal('cow', d.x + 120, d.y + 120);
    cow.stress = 0;
    g.animals.push(cow);
    return cow.id;
  });
  await wait(700);
  await guest.evaluate(() => {
    const g = window.game, d = g.doorPoint();
    g.input.override = null;
    const cow = g.animals.find((a) => a.sp.id === 'cow');
    g.dog.x = cow.x - 9;
    g.dog.y = cow.y;
    g.dog.vx = g.dog.vy = 0;
    g.dog.hx = 1;
    g.dog.hy = 0;
    g.dog.face = 'r';
    g.input.override = { x: 0, y: 0, sprint: false, lie: false };
  });
  await wait(400);
  const before = await host.evaluate((id) => { const a = window.game.animals.find((x) => x.id === id); return { x: a.x, stress: a.stress, commit: a.commitT }; }, id);
  await guest.evaluate(() => window.game.input.push('nip'));
  await wait(500);
  const after = await host.evaluate((id) => { const a = window.game.animals.find((x) => x.id === id); return { x: a.x, stress: a.stress, commit: a.commitT }; }, id);
  return { before, after };
})();
check("a guest's nip moves the host's cow", nipRes.after.commit > 0.5 && nipRes.after.stress > nipRes.before.stress, JSON.stringify(nipRes.after));

// ---- Seasons and round three's shared ranch state reach the guest ----
await guest.evaluate(async () => {
  const sh = await import('/src/net/shared.ts');
  sh.SHARED.push({ key: 'cooptest', get: (g) => g.__cooptest ?? null, set: (g, v) => (g.__cooptest = v) });
});
await host.evaluate(async () => {
  const sh = await import('/src/net/shared.ts');
  sh.SHARED.push({ key: 'cooptest', get: (g) => g.__cooptest ?? null, set: (g, v) => (g.__cooptest = v) });
  window.game.__cooptest = { hay: 3 };
  window.game.season.force('winter');
});
await guest.waitForFunction(() => window.game.season.season === 'winter' && window.game.season.snow > 0.9 && window.game.__cooptest?.hay === 3, null, { timeout: 5000 }).catch(() => {});
const seas = await guest.evaluate(() => ({ season: window.game.season.season, snow: +window.game.season.snow.toFixed(2), shared: window.game.__cooptest }));
check('the season (and shared ranch state) reaches the guest', seas.season === 'winter' && seas.snow > 0.9 && seas.shared?.hay === 3, JSON.stringify(seas));
// Buyers' favour (the yards dress up) and the board's badge pins reach the guest.
await host.evaluate(() => { window.game.favour.pts.drover = 33; });
await guest.waitForFunction(() => window.game.favour.level('drover') === 4 && Array.isArray(window.game.achievements.hostPins), null, { timeout: 5000 }).catch(() => {});
const fav = await guest.evaluate(() => ({ drover: window.game.favour.level('drover'), pins: window.game.achievements.hostPins?.length, visit: window.game.achievements.has('visit'), kept: JSON.parse(localStorage.getItem('comeby-travels-v1') || '{}').badges ?? [] }));
check("the host's buyers' favour and badge pins reach the guest", fav.drover === 4 && fav.pins >= 1, JSON.stringify(fav));
check('the guest earns GOOD NEIGHBOUR for their own save', fav.visit && fav.kept.includes('visit'), JSON.stringify(fav));
// Lambs, winter hay and the fair (gameplay's shared fields) reach the guest.
const r3 = await host.evaluate(async () => {
  const g = window.game;
  const Z = await import('/src/systems/seasonal.ts');
  const A = await import('/src/entities/animal.ts');
  const B = await import('/src/ui/build.ts');
  const K = await import('/src/ranch/catalog.ts');
  const ewe = new A.Animal('sheep', g.dog.x + 30, g.dog.y + 20);
  const lamb = Z.lambFor(ewe);
  g.animals.push(ewe, lamb);
  const h = B.makeBuilding(K.defOf('hay'), 81, 104, 0);
  g.ranch.add(h);
  h.bales = 13;
  g.seasonal.loft = 4;
  g.seasonal.fair = [{ species: 'sheep', score: 70, place: 2, prize: 20, rivals: [], rare: false }];
  return { lamb: lamb.id, ewe: ewe.id };
});
await guest.waitForFunction((ids) => {
  const g = window.game;
  const l = g.animals.find((a) => a.id === ids.lamb), e = g.animals.find((a) => a.id === ids.ewe);
  return l?.young && e && !e.young && g.seasonal.loft === 4 && g.ranch.buildings.some((b) => b.kind === 'haystack' && b.bales === 13);
}, r3, { timeout: 6000 }).catch(() => {});
const r3g = await guest.evaluate((ids) => {
  const g = window.game;
  const l = g.animals.find((a) => a.id === ids.lamb), e = g.animals.find((a) => a.id === ids.ewe);
  return { lamb: !!l?.young, ewe: !!e && !e.young, loft: g.seasonal.loft, bales: g.ranch.buildings.filter((b) => b.kind === 'haystack').map((b) => b.bales), fair: g.seasonal.fair.length, dusk: g.day.duskAt, year: g.season.year, drag: +g.dog.drag.toFixed(2) };
}, r3);
check('lambs, hay, the fair and the winter day reach the guest', r3g.lamb && r3g.ewe && r3g.loft === 4 && r3g.bales.includes(13) && r3g.fair === 1 && r3g.dusk < 0.75 && r3g.year >= 1 && r3g.drag > 0.05, JSON.stringify(r3g));
await host.evaluate(() => { window.game.season.forced = false; window.game.season.set('summer'); window.game.season.snap(); });

// ---- Pings, both ways ----
await guest.evaluate(() => { window.__heard = []; });
await host.evaluate(() => window.game.net.sendPing(window.game, 'here'));
await guest.waitForFunction(() => window.game.net.pings.list.some((p) => p.slot === 0 && p.kind === 'here'), null, { timeout: 3000 }).catch(() => {});
const gotPing = await guest.evaluate(() => ({ pings: window.game.net.pings.list.map((p) => `${p.name}:${p.kind}`), heard: window.__heard.filter((n) => n.startsWith('ping')) }));
check("the host's ping shows (and sounds) on the guest's screen", gotPing.pings.includes('BLUE:here') && gotPing.heard.includes('ping-here'), JSON.stringify(gotPing));
// The guest holds F and presses up: HOLD.
await guest.keyboard.down('KeyF');
await wait(450);
await guest.keyboard.down('ArrowUp');
await wait(120);
await guest.keyboard.up('ArrowUp');
await guest.keyboard.up('KeyF');
await host.waitForFunction(() => window.game.net.pings.list.some((p) => p.slot === 1 && p.kind === 'hold'), null, { timeout: 3000 }).catch(() => {});
const hostPing = await host.evaluate(() => window.game.net.pings.list.map((p) => `${p.name}:${p.kind}`));
check("the guest's held F + up says HOLD on the host's screen", hostPing.includes('ZIGGY:hold'), JSON.stringify(hostPing));
await wait(700);
// A tap of F: over here.
await guest.keyboard.down('KeyF');
await wait(80);
await guest.keyboard.up('KeyF');
await host.waitForFunction(() => window.game.net.pings.list.some((p) => p.slot === 1 && p.kind === 'here'), null, { timeout: 3000 }).catch(() => {});
check("a tap of F says OVER HERE", await host.evaluate(() => window.game.net.pings.list.some((p) => p.slot === 1 && p.kind === 'here')));
if (SHOTS) {
  await wait(200);
  await host.screenshot({ path: `${root}shots/coop/host-pings.png` });
  await guest.screenshot({ path: `${root}shots/coop/guest-pings.png` });
}

// ---- The guest finds a hidden place and a keepsake: theirs to keep ----
const place = await guest.evaluate(async () => {
  const { placeById } = await import('/src/world/places.ts');
  const g = window.game, p = placeById('orchard');
  g.dog.x = p.cx * 8;
  g.dog.y = p.cy * 8;
  return { item: p.item };
});
await guest.waitForFunction(() => window.game.net.travels.found.has('orchard'), null, { timeout: 3000 }).catch(() => {});
await guest.evaluate(({ item }) => { window.game.dog.x = item[0]; window.game.dog.y = item[1] + 4; }, place);
await guest.waitForFunction(() => window.game.net.travels.keep.has('bell'), null, { timeout: 3000 }).catch(() => {});
const trav = await guest.evaluate(() => {
  const t = JSON.parse(localStorage.getItem('comeby-travels-v1') || '{}');
  return { found: t.found, keep: t.keep, coins: t.coins, stamps: (t.stamps || []).map((s) => s.ranch), fog: (t.fog || '').length > 10, save: localStorage.getItem('comeby-save-v1') };
});
check('the guest finds the Old Orchard and its bell for their own travels', trav.found?.includes('orchard') && trav.keep?.includes('bell') && trav.coins >= 5 && trav.fog, JSON.stringify({ ...trav, save: undefined }));
check('the visit is stamped', trav.stamps?.includes("BLUE'S RANCH"), JSON.stringify(trav.stamps));
check("the host's ranch did not find it (their exploring, not the host's)", !(await host.evaluate(() => window.game.discovery.found.has('orchard'))));
check("the guest's save is still not written while visiting", trav.save === guestSave);

// ---- A brace: both dogs at the post, ten sheep, scored together ----
// A trial day, so the brace runs for prizes (a new day number sends every
// dog home to the door first, so wait for that).
await host.evaluate(() => { window.game.day.day = 3; window.game.day.t = 30; });
await wait(600);
await host.evaluate(() => {
  const g = window.game, p = g.ranch.course.post;
  g.input.override = { x: 0, y: 0, sprint: false, lie: false };
  g.dog.x = p.x - 8;
  g.dog.y = p.y + 4;
});
await guest.evaluate(() => {
  const g = window.game, p = g.ranch.course.post;
  g.input.override = { x: 0, y: 0, sprint: false, lie: false };
  g.dog.x = p.x + 8;
  g.dog.y = p.y + 4;
});
await host.evaluate(async () => { window.__trials = await import('/src/systems/trials.ts'); });
await host.waitForFunction(() => window.__trials.braceReady(window.game), null, { timeout: 4000 }).catch(() => {});
await wait(200);
const braceHint = await guest.evaluate(() => window.game.hint());
if (process.env.COOP_DEBUG) {
  console.log('host', JSON.stringify(await host.evaluate(() => { const g = window.game, p = g.ranch.course.post; return { post: [p.x, p.y], dog: [g.dog.x, g.dog.y], coop: g.coop.map((d) => [Math.round(d.x), Math.round(d.y)]), ready: window.__trials.braceReady(g), role: g.net?.role, tier: g.tier }; })));
  console.log('guest', JSON.stringify(await guest.evaluate(() => { const g = window.game, p = g.ranch.course.post; return { post: [p.x, p.y], dog: [g.dog.x, g.dog.y], st: g.net.status, waiting: g.net.waiting, mode: g.mode }; })));
}
await host.evaluate(() => window.game.input.push('nip'));
await guest.waitForFunction(() => window.game.trials.run?.cls.id === 'brace', null, { timeout: 4000 }).catch(() => {});
const brace = await guest.evaluate(() => ({ cls: window.game.trials.run?.cls.id, flock: window.game.animals.filter((a) => a.trial).length }));
const hostBrace = await host.evaluate(() => ({ cls: window.game.trials.run?.cls.id, n: window.game.trials.run?.flock.length }));
check('both dogs at the post start a BRACE (host and guest see it)', hostBrace.cls === 'brace' && hostBrace.n === 10 && brace.cls === 'brace' && brace.flock === 10, JSON.stringify({ hostBrace, brace, braceHint }));
if (SHOTS) {
  await wait(300);
  await guest.screenshot({ path: `${root}shots/coop/guest-brace.png` });
}
// The judge scores it; a placing is a ribbon for the guest's own shelf too.
await host.evaluate(async () => {
  const tr = await import('/src/systems/trials.ts');
  const r = window.game.trials.run;
  r.scores = [10, 15, 10, 15, 15, 20];
  r.penned = true;
  tr.endRun(window.game, false);
});
await guest.waitForFunction(() => window.game.trials.result?.cls.id === 'brace', null, { timeout: 4000 }).catch(() => {});
await wait(300);
const judged = await guest.evaluate(() => ({ place: window.game.trials.result?.place, ribbons: JSON.parse(localStorage.getItem('comeby-travels-v1') || '{}').ribbons }));
check('the brace placing is a ribbon for the guest too', judged.place >= 1 && judged.place <= 3 && judged.ribbons === 1, JSON.stringify(judged));
const braceBadge = await guest.evaluate(() => JSON.parse(localStorage.getItem('comeby-travels-v1') || '{}').badges ?? []);
check('...and the A BRACE OF DOGS badge, kept with their travels', braceBadge.includes('brace') && braceBadge.includes('visit'), JSON.stringify(braceBadge));
if (SHOTS) await guest.screenshot({ path: `${root}shots/coop/guest-brace-result.png` });
await host.evaluate(async () => {
  const tr = await import('/src/systems/trials.ts');
  tr.closeResult(window.game);
  window.game.input.override = { x: 0, y: 0, sprint: false, lie: true };
  window.game.dog.x = window.game.doorPoint().x - 40;
  window.game.dog.y = window.game.doorPoint().y + 4;
});
await guest.evaluate(() => {
  const g = window.game, d = g.doorPoint();
  g.input.override = null;
  g.dog.x = d.x + 20;
  g.dog.y = d.y + 20;
});
await wait(500);

// ---- Screens going off: each side is told ----
const hide = (page, on) => page.evaluate((on) => {
  if (on) {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  } else {
    delete document.hidden;
    delete document.visibilityState;
  }
  document.dispatchEvent(new Event('visibilitychange'));
}, on);
await hide(guest, true);
await host.waitForFunction(() => window.game.net.isAway(window.game.net.dogs[0]) && window.game.net.dogs[0].lying, null, { timeout: 3000 }).catch(() => {});
const nap = await host.evaluate(() => ({ away: window.game.net.isAway(window.game.net.dogs[0]), lying: window.game.net.dogs[0].lying, banner: window.game.banner?.big }));
check("the guest's screen goes off: the host sees their dog nap", nap.away && nap.lying, JSON.stringify(nap));
await hide(guest, false);
await host.waitForFunction(() => !window.game.net.isAway(window.game.net.dogs[0]), null, { timeout: 3000 }).catch(() => {});
check('...and wake when they are back', await host.evaluate(() => !window.game.net.isAway(window.game.net.dogs[0])));
await hide(host, true);
await guest.waitForFunction(() => window.game.net.hostBg, null, { timeout: 3000 }).catch(() => {});
const hb = await guest.evaluate(() => window.game.net.hostBg);
if (SHOTS) await guest.screenshot({ path: `${root}shots/coop/guest-host-away.png` });
await hide(host, false);
await guest.waitForFunction(() => !window.game.net.hostBg, null, { timeout: 3000 }).catch(() => {});
check("the host's screen goes off: the guest is told, then it goes on", hb && (await guest.evaluate(() => !window.game.net.hostBg)));

// ---- A line that dies without a word (Wi-Fi to mobile data) ----
const fulls0 = await guest.evaluate(() => window.game.net.fulls);
await guest.evaluate(() => {
  window.game.net.link.silence();
  window.dispatchEvent(new Event('online'));
});
await guest.waitForFunction((n) => window.game.net.status === 'playing' && window.game.net.fulls > n && !window.game.net.stale, fulls0, { timeout: 15000 }).catch(() => {});
const redial = await guest.evaluate(() => ({ status: window.game.net.status, fulls: window.game.net.fulls }));
check('a dead line after a network change: the guest notices and dials again', redial.status === 'playing' && redial.fulls > fulls0, JSON.stringify(redial));

// ---- The guest's line drops for a moment, then comes back ----
await guest.evaluate(() => window.game.net.dropLine());
await host.waitForFunction(() => [...window.game.net.seats.values()][0]?.away > 0, null, { timeout: 5000 }).catch(() => {});
const away = await host.evaluate(() => ({ away: [...window.game.net.seats.values()][0]?.away > 0, dogs: window.game.net.dogs.length }));
check('host sees the guest drop (dog waits)', away.away && away.dogs === 1, JSON.stringify(away));
await guest.waitForFunction(() => window.game.net.status === 'playing' && window.game.net.ready, null, { timeout: 15000 }).catch(() => {});
await wait(300);
const back = await guest.evaluate(() => ({ status: window.game.net.status, slot: window.game.net.slot, animals: window.game.animals.length }));
const hostBack = await host.evaluate(() => ({ dogs: window.game.net.dogs.length, away: [...window.game.net.seats.values()][0]?.away }));
check('guest reconnects into the same slot', back.status === 'playing' && back.slot === 1 && hostBack.dogs === 1 && !hostBack.away, JSON.stringify({ ...back, ...hostBack }));

// ---- The host's line drops: the guest waits (unless the host is back
// before the relay even notices), then carries on with a fresh world ----
const fullsBefore = await guest.evaluate(() => window.game.net.fulls);
await guest.evaluate(() => { window.__sawAway = false; const n = window.game.net; const f = () => { if (n.status === 'away') window.__sawAway = true; requestAnimationFrame(f); }; f(); });
await host.evaluate(() => window.game.net.dropLine());
await host.waitForFunction(() => window.game.net.status === 'open' && window.game.net.dogs.length === 1, null, { timeout: 15000 }).catch(() => {});
await guest.waitForFunction((n) => window.game.net.status === 'playing' && window.game.net.fulls > n && !window.game.net.stale, fullsBefore, { timeout: 15000 }).catch(() => {});
const hBack = await guest.evaluate(() => ({ status: window.game.net.status, fresh: window.game.net.fulls, sawAway: window.__sawAway, stale: window.game.net.stale }));
check('host drops and comes back: the guest plays on with a fresh world', hBack.status === 'playing' && hBack.fresh > fullsBefore && !hBack.stale, JSON.stringify(hBack));

// ---- The guest leaves: their dog trots off ----
await guest.evaluate(() => window.game.net.leave(window.game));
await host.waitForFunction(() => window.game.net.dogs.length === 0, null, { timeout: 8000 }).catch(() => {});
const gone = await host.evaluate(() => window.game.net.dogs.length);
check("guest leaves: their dog trots off the host's ranch", gone === 0);
await guest.waitForFunction(() => window.game?.mode === 'title' && window.game.demo, null, { timeout: 5000 }).catch(() => {});
check('the guest is back at their own title', await guest.evaluate(() => window.game.mode === 'title' && window.game.demo));
await guest.close();

// ---- With lag on the guest's line: the drive still works at walking pace ----
await host.evaluate(async () => {
  const g = window.game;
  const { Animal } = await import('/src/entities/animal.ts');
  for (const p of g.ranch.pens) { p.animals = []; p.species = null; p.batch = []; p.open = true; }
  g.animals.length = 0;
  g.day.t = 20;
  const gp = g.ranch.pens[0].gatePoint(10);
  for (let i = 0; i < 6; i++) g.animals.push(new Animal('sheep', gp.x - 60 + (i % 3) * 9 - 9, gp.y + 80 + Math.floor(i / 3) * 9 - 4));
});
guest = await joinGuest(`&lag=${LAG}&jitter=40&loss=0.05`);
// The host pauses: with a friend here, the world goes on.
await host.keyboard.press('Escape');
await host.waitForFunction(() => window.game.mode === 'pause');
await guest.evaluate(({ f }) => {
  const g = window.game;
  g.dog.x = f.x - 20;
  g.dog.y = f.y + 60;
}, { f: setup.flock });
const lagRes = await drive(guest, setup.pen, 120);
await wait(1500);
const lagPenned = await host.evaluate(() => window.game.ranch.pens[0].animals.length);
check(`with ${LAG}ms each way, jitter and 5% packet loss on the guest's line (host paused), the drive still pens them`, lagPenned === 6, `${lagPenned}/6 in ${lagRes.t}s`);

// ---- The host's game stops (a phone asleep): the guest is told to wait ----
await host.evaluate(() => { window.requestAnimationFrame = () => 0; });
await guest.waitForFunction(() => window.game.net.stale, null, { timeout: 5000 }).catch(() => {});
check("the host's game stops: the guest waits for it", await guest.evaluate(() => window.game.net.stale));

// ---- The host closes the ranch: the guest is told, and goes home ----
await host.evaluate(() => window.game.net.close());
await guest.waitForFunction(() => window.game.net?.ended, null, { timeout: 8000 }).catch(() => {});
const ended = await guest.evaluate(() => window.game.net?.ended?.title ?? null);
check('host closes: the guest hears "the ranch closed"', ended === 'THE RANCH CLOSED', String(ended));
if (SHOTS) await guest.screenshot({ path: `${root}shots/coop/guest-ranch-closed.png` });
await guest.keyboard.press('Enter');
await guest.waitForFunction(() => window.game?.mode === 'title', null, { timeout: 5000 }).catch(() => {});
check('...and goes back to their title', await guest.evaluate(() => window.game.mode === 'title'));
check("the guest's own save is still untouched", (await guest.evaluate(() => localStorage.getItem('comeby-save-v1'))) === guestSave);

// ---- Home again: the guest's own ranch gets what they found ----
await guest.keyboard.press('Enter'); // CONTINUE
await guest.waitForFunction(() => window.game && !window.game.demo && window.game.mode === 'play', null, { timeout: 8000 }).catch(() => {});
const home = await guest.evaluate(() => {
  const g = window.game, d = JSON.parse(localStorage.getItem('comeby-save-v1'));
  return { orchard: g.discovery.found.has('orchard'), bell: g.discovery.keepsakes.has('bell'), coins: g.coins, saved: d.discovery?.found?.includes('orchard'), tip: g.tip?.text, travels: localStorage.getItem('comeby-travels-v1')?.slice(0, 200) };
});
check("their own ranch now has the Old Orchard, the bell and the reward", home.orchard && home.bell && home.coins === 128 && home.saved, JSON.stringify(home));
const homeBadges = await guest.evaluate(() => ({ visit: window.game.achievements.has('visit'), brace: window.game.achievements.has('brace'), saved: Object.keys(JSON.parse(localStorage.getItem('comeby-save-v1')).achievements?.got ?? {}) }));
check('...and the badges earned visiting', homeBadges.visit && homeBadges.brace && homeBadges.saved.includes('brace'), JSON.stringify(homeBadges));

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await hostB.close();
await guestB.close();
await server.close();
stopRelay();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
