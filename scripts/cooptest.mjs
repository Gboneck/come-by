// Co-op end to end: a relay (wrangler dev), Vite, and two browsers, a host
// and a guest, each its own Chromium like two phones. The guest's dog walks
// round behind a flock on the host's ranch and drives it into the pen.
// Checks: the host's herd reacts to the guest's dog, the pen fills, the
// guest sees it, the pay lands on the host and the guest's own save is
// left alone; then a bark and a nip from the guest, a dropped line and a
// reconnect, the guest leaving, the host closing the ranch, snapshot size
// and rate, and the drive again with lag on the guest's line.
//   node scripts/cooptest.mjs [--lag=150] [--shots] [--keep]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const LAG = Number(arg('lag', 150));
const SHOTS = process.argv.includes('--shots');
const VITE_PORT = Number(process.env.COOP_VITE_PORT ?? 5232);
const RELAY_PORT = Number(process.env.COOP_RELAY_PORT ?? 8790);
const RELAY = `http://127.0.0.1:${RELAY_PORT}`;
const root = fileURLToPath(new URL('..', import.meta.url));
mkdirSync(`${root}shots/coop`, { recursive: true });

let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The relay ----
const relay = spawn('npx', ['wrangler', 'dev', '--port', String(RELAY_PORT), '--ip', '127.0.0.1', '--log-level', 'warn'], { cwd: `${root}server`, stdio: ['ignore', 'pipe', 'pipe'] });
let relayLog = '';
relay.stdout.on('data', (d) => (relayLog += d));
relay.stderr.on('data', (d) => (relayLog += d));
const stopRelay = () => { try { relay.kill('SIGTERM'); } catch { /* gone */ } };
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
const errors = [];
async function open(browser, url, viewport, who) {
  const page = await browser.newPage({ viewport });
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

// ---- The guest's line drops for a moment, then comes back ----
await guest.evaluate(() => window.game.net.dropLine());
await host.waitForFunction(() => [...window.game.net.seats.values()][0]?.away > 0, null, { timeout: 5000 }).catch(() => {});
const away = await host.evaluate(() => ({ away: [...window.game.net.seats.values()][0]?.away > 0, dogs: window.game.net.dogs.length }));
check('host sees the guest drop (dog waits)', away.away && away.dogs === 1, JSON.stringify(away));
await guest.waitForFunction(() => window.game.net.status === 'playing' && window.game.net.ready, null, { timeout: 15000 }).catch(() => {});
const back = await guest.evaluate(() => ({ status: window.game.net.status, slot: window.game.net.slot, animals: window.game.animals.length }));
const hostBack = await host.evaluate(() => ({ dogs: window.game.net.dogs.length, away: [...window.game.net.seats.values()][0]?.away }));
check('guest reconnects into the same slot', back.status === 'playing' && back.slot === 1 && hostBack.dogs === 1 && !hostBack.away, JSON.stringify({ ...back, ...hostBack }));

// ---- The host's line drops: the guest waits, then carries on ----
await host.evaluate(() => window.game.net.dropLine());
await guest.waitForFunction(() => window.game.net.status === 'away', null, { timeout: 5000 }).catch(() => {});
const gAway = await guest.evaluate(() => window.game.net.status);
await guest.waitForFunction(() => window.game.net.status === 'playing' && window.game.net.ready, null, { timeout: 15000 }).catch(() => {});
const gBack = await guest.evaluate(() => window.game.net.status);
check('host drops and comes back: guest waits, then plays on', gAway === 'away' && gBack === 'playing', `${gAway} -> ${gBack}`);

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
guest = await joinGuest(`&lag=${LAG}`);
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
check(`with ${LAG}ms each way on the guest's line (host paused), the drive still pens them`, lagPenned === 6, `${lagPenned}/6 in ${lagRes.t}s`);

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

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await hostB.close();
await guestB.close();
await server.close();
stopRelay();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
