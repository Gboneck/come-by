// A new player's first days, played by the herding bot from a fresh save,
// with a timeline of everything the screen says (hints, tips, banners, the
// tier card, the jobs card) and screenshots of the key moments. For finding
// where the early game drags or talks over itself.
//
//   node scripts/playthrough.mjs [--size=390x844@3] [--days=4]
//   -> timeline on stdout, shots/play/<n>-<moment>.png
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const [wh, dprS] = opt('size', '390x844@3').split('@');
const [width, height] = wh.split('x').map(Number);
const touch = height > width || args.includes('--touch');
const days = Number(opt('days', '4'));
const PORT = Number(process.env.SHOT_PORT || 5341);

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: Number(dprS || 1), hasTouch: touch, isMobile: touch });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// The script drives the clock itself: no live loop between steps.
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  try { localStorage.clear(); } catch { /* fine */ }
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
mkdirSync('shots/play', { recursive: true });

await page.evaluate(async () => {
  const bot = await import('/src/bot.ts');
  const coach = await import('/src/ui/coach.ts');
  const jobs = await import('/src/ui/jobs.ts');
  const build = await import('/src/ui/build.ts');
  const cat = await import('/src/ranch/catalog.ts');
  const g0 = () => window.game;
  const last = {};
  const log = [];
  const stamp = (g) => `D${g.day.day} ${g.day.phase === 'night' ? 'N' : ''}${g.day.clock().padStart(5)} t${g.t.toFixed(0).padStart(4)}`;
  // Everything the player reads, logged when it changes.
  const watch = (g) => {
    const say = (k, v) => {
      if (last[k] === v) return;
      last[k] = v;
      if (v) log.push(`${stamp(g)} ${k.padEnd(6)} ${v}`);
    };
    say('mode', g.mode);
    say('hint', g.mode === 'play' ? (coach.coachHint(g) ?? g.hint()) : null);
    say('banner', g.banner ? `${g.banner.big}${g.banner.small ? ' / ' + g.banner.small : ''}` : null);
    say('tier', g.feel.tierCard ? `TIER CARD ${g.feel.tierCard.name}` : null);
    say('jobs', g.orders.open.map((o) => `${o.yard} ${o.got}/${o.n} ${o.species}`).join(', ') + (g.trials.run ? ` RUN ${g.trials.run.step}` : ''));
    say('tut', `${g.tut}`);
    say('rest', g.rest > 1.5 ? 'RESTING' : null);
    say('tier#', `${g.tier}`);
  };
  const render = () => { const g = g0(); g.render(); g.screen.present(); g.input.endFrame(); };
  // Advance the game; `ctl` steers (return true to stop early).
  const run = (seconds, ctl) => {
    let t = 0;
    while (t < seconds) {
      const g = g0();
      if (ctl && ctl(g, t)) break;
      g.update(1 / 60);
      g.input.clearQueue();
      watch(g);
      t += 1 / 60;
    }
    g0().input.override = null;
    return +t.toFixed(1);
  };
  // The bot herds the nearest flock to (x, y). It steers straight, so when
  // it is stuck on a fence it sidesteps for a moment, as a player would.
  let stuckT = 0, side = 0, sign = -1, lastX = 0, lastY = 0;
  const herd = (x, y, untilPenned, seconds) => run(seconds, (g, t) => {
    const c = bot.botStep(g, { goalX: x, goalY: y }, t);
    const moved = Math.hypot(g.dog.x - lastX, g.dog.y - lastY);
    lastX = g.dog.x; lastY = g.dog.y;
    stuckT = Math.hypot(c.x, c.y) > 0.5 && moved < 0.2 ? stuckT + 1 / 60 : Math.max(0, stuckT - 1 / 60);
    if (stuckT > 0.3 && side <= 0) { side = 0.6; sign = -sign; stuckT = 0; }
    if (side > 0) {
      side -= 1 / 60;
      g.input.override = { x: -c.y * sign, y: c.x * sign, sprint: false, lie: false };
    } else g.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    if (untilPenned && !g.animals.some((a) => !a.pen && !a.gone && a.sp.id === untilPenned)) return true;
    return false;
  });
  // Lie down as a player would (resting ignores the bot's override): the
  // DOWN button on a phone, Q on a keyboard.
  const lie = (down) => {
    const g = g0();
    if (g.input.touchMode) down ? g.input.uiHeld.add('lie') : g.input.uiHeld.delete('lie');
    else window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyQ' }));
  };
  const place = (id) => {
    const g = g0();
    const b = g.build;
    b.item = cat.CATALOG.findIndex((d) => d.id === id);
    for (let r = 0; r < 20; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          b.cx = 96 + dx; b.cy = 108 + dy;
          if (b.ghost(g).ok) { g.input.push('confirm'); g.update(1 / 60); return `${id} at ${b.cx},${b.cy}`; }
        }
    return `no room for ${id}`;
  };
  // A trial run under the bot, logged like the rest.
  const trial = () => run(260, (g, t) => {
    if (!g.trials.run || g.trials.result) return true;
    const goal = bot.trialGoal(g) ?? g.ranch.course.post;
    const c = bot.botStep(g, { goalX: goal.x, goalY: goal.y }, t);
    g.input.override = { x: c.x, y: c.y, sprint: c.sprint, lie: c.lie };
    return false;
  });
  window.__pt = { log, run, herd, lie, place, trial, render, jobs, coach, stamp: () => stamp(g0()) };
});

let shot = 0;
const snap = async (name) => {
  await page.evaluate(() => window.__pt.render());
  await page.screenshot({ path: `shots/play/${String(++shot).padStart(2, '0')}-${name}.png` });
};
const note = (s) => page.evaluate((s) => window.__pt.log.push(`${window.__pt.stamp()} ---    ${s}`), s);
const ev = (fn, a) => page.evaluate(fn, a);

for (let day = 1; day <= days; day++) {
  await note(`day ${day} starts`);
  await ev(() => window.__pt.run(1.5));
  await snap(`d${day}-morning`);
  // Trial day: walk onto the Show Ground, up to the crook, and run.
  if (await ev(async () => { const tr = await import('/src/systems/trials.ts'); return tr.prizeToday(window.game) && !!tr.currentClass(window.game) && window.game.mode === 'play'; })) {
    await ev(() => { const g = window.game, p = g.ranch.course.post; g.dog.x = p.x - 70; g.dog.y = p.y + 24; g.cam.x = g.dog.x; g.cam.y = g.dog.y; window.__pt.run(3); });
    await snap(`d${day}-showground`);
    await ev(() => { const g = window.game, p = g.ranch.course.post; g.dog.x = p.x; g.dog.y = p.y + 6; window.__pt.run(1); });
    await snap(`d${day}-crook`);
    await ev(() => { window.game.input.push('nip'); window.__pt.run(4); });
    await snap(`d${day}-run`);
    const t = await ev(() => window.__pt.trial());
    await note(`trial run took ${t}s`);
    await ev(() => window.__pt.run(0.3));
    await snap(`d${day}-judge`);
    await ev(() => window.__pt.run(1.5));
    await snap(`d${day}-judge-late`);
    await ev(() => { window.game.input.push('confirm'); window.__pt.run(1); });
  }
  // Herd whatever the bot can reach to the first pen with room; at tier 2+
  // fill an order first if one is open.
  const plan = await ev(() => {
    const g = window.game;
    const out = [];
    for (let k = 0; k < 3; k++) {
      const wild = g.animals.filter((a) => !a.pen && !a.gone && !a.trial);
      if (!wild.length) break;
      const sp = wild[0].sp.id;
      const pen = g.ranch.pens.find((p) => p.hasRoomFor(wild[0]));
      if (!pen) { out.push(`no pen with room for ${sp}`); break; }
      const gp = pen.gatePoint(30);
      const t1 = window.__pt.herd(gp.x, gp.y, null, 90);
      let t2 = window.__pt.herd(pen.cx, pen.cy, sp, 40);
      let help = '';
      if (g.mode === 'play' && g.animals.some((a) => !a.pen && !a.gone && a.sp.id === sp)) {
        // The bot is a poor shepherd round fences: bring the flock to the
        // gate for it, as a player would get them there, and pen from there.
        const out2 = pen.gatePoint(16);
        for (const a of g.animals) if (!a.pen && !a.gone && a.sp.id === sp) { a.x = out2.x + (Math.random() - 0.5) * 14; a.y = out2.y + 6 + Math.random() * 8; a.stress = 0; }
        g.dog.x = out2.x; g.dog.y = out2.y + 40;
        t2 += window.__pt.herd(pen.cx, pen.cy, sp, 40);
        help = ' (bot helped to the gate)';
      }
      out.push(`herded ${sp}: drive ${t1}s, pen ${t2}s, penned ${pen.animals.length}${help}`);
      window.__pt.run(1.5);
      if (g.mode !== 'play') break;
    }
    return out;
  });
  for (const p of plan) await note(p);
  await snap(`d${day}-penned`);
  // A new player reads the hints for a bit, then rests till the day ends.
  await ev(() => window.__pt.run(15));
  await snap(`d${day}-after`);
  const rested = await ev(() => {
    const g = window.game;
    const door = g.doorPoint();
    g.dog.x = door.x + 20; g.dog.y = door.y + 30;
    window.__pt.lie(true);
    const t = window.__pt.run(400, (g) => g.mode !== 'play' || g.day.phase === 'night');
    window.__pt.lie(false);
    return t;
  });
  await note(`rested ${rested}s of real time`);
  if (await ev(() => window.game.day.phase === 'night')) {
    await snap(`d${day}-night`);
    await ev(() => window.__pt.run(70, (g) => g.mode !== 'play'));
  }
  await ev(() => window.__pt.run(1, (g) => g.mode === 'summary' && g.summaryT > 0.9));
  await snap(`d${day}-summary`);
  // Build what the end of the day suggests, then the next day.
  const built = await ev(() => {
    const g = window.game;
    const out = [];
    g.input.push('build');
    window.__pt.run(0.8);
    if (g.mode !== 'build') return ['no build mode'];
    const want = ['kennel', 'pen', 'market', 'barn'].filter((id) => !g.ranch.buildings.some((b) => b.kind === id) || id === 'pen');
    for (const id of want) {
      out.push(window.__pt.place(id));
    }
    g.input.push('cancel');
    window.__pt.run(1.2);
    return out.filter((s) => !s.startsWith('no room'));
  });
  for (const b of built) await note(`built ${b}`);
}
await snap('end');
const log = await ev(() => window.__pt.log);
console.log(log.join('\n'));
if (errors.length) console.log('ERRORS', errors);
await browser.close();
await server.close();
