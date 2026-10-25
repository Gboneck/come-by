// Offline audio check. Renders each music piece, the stingers and the
// soundscape with an OfflineAudioContext in headless Chromium, through the
// real mixer, and prints levels, peaks and clipping, plus music-theory checks
// on the notes played (scale, chord tones, leaps, range). Spectrograms go to
// shots/audio-<name>.png.
//
//   node scripts/audiotest.mjs                  all pieces + stingers + ambience
//   node scripts/audiotest.mjs ranch night      just these
//   node scripts/audiotest.mjs --secs=30 --seed=3 --roll   (--roll prints the tunes)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const SECS = Number(opt('secs', '24'));
const SEED = Number(opt('seed', '1'));
const ALL = ['bank', 'tuning', 'sfx', 'hour', 'hourlevels', 'live', 'live2', 'live3', 'sky', 'drive', 'balance', 'title', 'ranch', 'meadow', 'hills', 'rocky', 'ford', 'high', 'dusk', 'night', 'panic', 'prowl', 'stingers', 'ambience', 'mix', 'trial', 'lullaby', 'orders', 'weather', 'spring', 'summer', 'autumn', 'winter', 'lambs', 'fair', 'coop'];
const only = args.filter((a) => !a.startsWith('--'));
const cases = only.length ? only : ALL;

const PORT = Number(process.env.AUDIO_PORT || 5197); // AUDIO_PORT when other checkouts run tests too
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/?sprites=999`);

const MODES = {
  title: [7, 'ion'], ranch: [7, 'ion'], meadow: [2, 'ion'], hills: [4, 'dor'], rocky: [9, 'dor'],
  ford: [0, 'ion'], high: [2, 'mix'], dusk: [9, 'aeo'], night: [2, 'aeo'], trial: [9, 'mix'], lullaby: [7, 'ion'],
  spring: [2, 'ion'], summer: [4, 'dor'], autumn: [7, 'ion'], winter: [2, 'aeo'],
};
const SCALES = { ion: [0, 2, 4, 5, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10] };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');

mkdirSync('shots', { recursive: true });
let fail = false;

for (const name of cases) {
  if (name === 'bank') {
    // How long each sample takes to build (the game spreads them over frames).
    const b = await page.evaluate(async () => {
      const { Bank } = await import('/src/systems/synth.ts');
      const bank = new Bank(new OfflineAudioContext(2, 44100, 44100));
      const times = [];
      while (bank.pending) {
        const name = bank.queue[0][0];
        const t0 = performance.now();
        bank.pump(0.0001);
        times.push([name, performance.now() - t0]);
      }
      times.sort((a, b) => b[1] - a[1]);
      return { n: times.length, total: times.reduce((a, [, t]) => a + t, 0), worst: times.slice(0, 5) };
    });
    console.log(`\n== bank  ${b.n} buffers, ${b.total.toFixed(0)} ms in all, slowest: ${b.worst.map(([n, t]) => `${n} ${t.toFixed(1)}ms`).join(', ')}`);
    continue;
  }
  if (name === 'live') {
    // The real game with a live AudioContext: walk through every phase and
    // check which piece the music picks, the mood it reads, and no errors.
    const lp = await browser.newPage();
    lp.on('pageerror', (e) => errors.push(e.message));
    lp.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await lp.goto(`http://localhost:${PORT}/?debug`);
    await lp.waitForFunction(() => window.game);
    await lp.keyboard.press('KeyD');
    const steps = await lp.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = () => window.game;
      const out = [];
      const note = async (what) => {
        await wait(700);
        const m = g().audio.music;
        out.push(`${what}: wants ${m.want}, playing ${m.piece?.id}, energy ${m.energy.toFixed(2)} tension ${m.tension.toFixed(2)}`);
      };
      const run = (secs) => { for (let i = 0; i < secs * 60; i++) g().update(1 / 60); };
      await note('morning at the ranch');
      const reg = (await import('/src/world/map.ts')).REGIONS;
      for (const id of ['meadow', 'hills', 'rocky', 'ford', 'high']) {
        const r = reg.find((x) => x.id === id);
        g().setTier(5, false);
        g().dog.x = r.cx * 8; g().dog.y = r.cy * 8;
        run(0.1);
        await note(id);
      }
      g().dog.x = reg[0].cx * 8; g().dog.y = reg[0].cy * 8;
      g().day.t = 0.8 * 300 - 0.05;
      run(0.2);
      await note('dusk');
      g().day.t = 299.99;
      run(0.2);
      await note('nightfall');
      // A coyote hunting right beside the dog.
      const pr = g().predators[0];
      pr.state = 'hunt';
      pr.x = g().dog.x + 50; pr.y = g().dog.y;
      await note('coyote close by');
      pr.state = 'gone';
      await wait(2500);
      await note('coyote gone');
      g().endDay();
      run(0.05);
      await note('summary');
      g().enterBuild(true);
      run(0.05);
      await note('build');
      g().exitBuild();
      run(0.05);
      g().mode = 'pause';
      run(0.05);
      await note('paused');
      g().mode = 'play';
      g().request = 'title';
      await wait(300);
      await note('back to the title');
      return out;
    });
    console.log('\n== live');
    for (const s of steps) console.log('  ' + s);
    await lp.close();
    continue;
  }
  if (name === 'hour') {
    // An hour of play, scheduled but not rendered (a fake clock): about ten
    // days of regions, dusk, night and the summary, the seasons turning,
    // energy wandering and the odd panic. Then: how much repeats?
    const h = await page.evaluate(async (SEED) => {
      localStorage.clear();
      const { Sound } = await import('/src/systems/audio.ts');
      const { mulberry32 } = await import('/src/rng.ts');
      const ctx = new OfflineAudioContext(1, 128, 8000);
      let now = 0;
      Object.defineProperty(ctx, 'currentTime', { get: () => now });
      const rnd = mulberry32(SEED);
      const s = new Sound({ listen: false });
      s.attach(ctx, rnd);
      s.bank.generateAll();
      const log = (s.music.log = []);
      const DAY = [['ranch', 40], ['meadow', 70], ['ranch', 40], ['hills', 70], ['ranch', 20], ['dusk', 60], ['night', 55], ['ranch', 15]];
      const len = DAY.reduce((a, [, d]) => a + d, 0);
      const SEASONS = [{ bloom: 1 }, {}, { leaves: 1 }, { snow: 1 }];
      let energy = 0.4, tension = 0;
      const stingers = [];
      for (let t = 0; t < 3600; t += 0.1) {
        now = t;
        const day = Math.floor(t / len), dt0 = t % len;
        let piece = 'ranch', acc = 0, rest = false;
        for (const [p, d] of DAY) { if (dt0 < acc + d) { piece = p; rest = acc + d === len; break; } acc += d; }
        energy = Math.max(0.05, Math.min(1, energy + (rnd() - 0.5) * 0.05));
        tension = rnd() < 0.0008 ? 0.9 : Math.max(0, tension - 0.004);
        const season = SEASONS[Math.floor(day / 2.5) % 4];
        s.music.update({ piece, energy, tension, rest, muffle: false, ...season }, 0.1);
        // A pen shut every couple of minutes, the summary each evening.
        if (Math.floor(t * 10) % 1300 === 650) stingers.push(['calm', t, s.music.stingerLog?.length]), s.music.stinger('calm', t + 0.1);
        if (Math.floor(t * 10) % Math.floor(len * 10) === Math.floor((len - 14) * 10)) s.music.stinger('summary', t + 0.1);
      }
      return { log: log.filter((n) => n.inst !== 'chord' || true).map((n) => [n.t, n.inst, n.midi, n.info ?? '']), stingers: stingers.length };
    }, SEED);
    // ---- analysis ----
    const secs = h.log.filter((n) => n[1] === 'section');
    const byLead = {};
    for (const s of secs) { const m = /lead=(\w+)/.exec(s[3]); byLead[m[1]] = (byLead[m[1]] ?? 0) + 1; }
    // Each section's tune as intervals: does any tune come back?
    const tunes = [];
    let cur = null;
    for (const n of h.log) {
      if (n[1] === 'section') { if (cur) tunes.push(cur); cur = { t: n[0], info: n[3], notes: [] }; }
      else if (cur && ['whistle', 'fiddle', 'harp-mel', 'bell-mel'].includes(n[1])) cur.notes.push(n[2]);
    }
    if (cur) tunes.push(cur);
    const withTune = tunes.filter((t) => t.notes.length >= 8);
    const sig = (t) => t.notes.slice(0, 8).map((m, i, a) => (i ? m - a[i - 1] : 0)).join(',');
    const counts = new Map();
    for (const t of withTune) counts.set(sig(t), (counts.get(sig(t)) ?? 0) + 1);
    const repeats = [...counts.values()].filter((c) => c > 1).reduce((a, c) => a + c, 0);
    // Six-note melodic shapes (intervals), and in how many sections each turns up.
    const grams = new Map();
    withTune.forEach((t, k) => {
      const iv = t.notes.map((m, i, a) => (i ? m - a[i - 1] : null)).slice(1);
      const seen = new Set();
      for (let i = 0; i + 5 <= iv.length; i++) seen.add(iv.slice(i, i + 5).join(','));
      for (const g of seen) grams.set(g, (grams.get(g) ?? 0) + 1);
    });
    const top = [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    // Chord progressions back to back.
    const prog = [];
    let chords = [];
    for (const n of h.log) {
      if (n[1] === 'section') { if (chords.length) prog.push(chords.join(' ')); chords = []; }
      else if (n[1] === 'chord') chords.push(n[2]);
    }
    let backToBack = 0;
    for (let i = 1; i < prog.length; i++) if (prog[i] === prog[i - 1]) backToBack++;
    // Time with a tune playing, and the longest stretch without a breath.
    const leadTime = secs.filter((s) => !s[3].includes('lead=null')).length;
    let run = 0, longest = 0;
    for (const s of secs) { run = s[3].includes('lead=null') ? 0 : run + 1; longest = Math.max(longest, run); }
    const theme = withTune.filter((t) => t.notes.slice(0, 4).join() === '74,79,81,83' || t.notes.slice(0, 4).join() === '62,67,69,71').length;
    console.log(`\n== hour (scheduled, not rendered)`);
    console.log(`  ${secs.length} sections; tunes on: ${Object.entries(byLead).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`  ${withTune.length} tunes; ${counts.size} different openings; ${repeats} sections reuse an opening heard before (the main theme ${theme}x)`);
    console.log(`  commonest 6-note shapes turn up in ${top.map(([g, c]) => `${c} sections (${g})`).join(', ')}`);
    console.log(`  same chords twice running: ${backToBack} of ${prog.length - 1}; sections with a tune ${leadTime}/${secs.length}; longest run of sections with a tune: ${longest}`);
    const rests = secs.filter((s) => s[3].includes('silent=true')).map((s) => s[0]);
    console.log(`  rests (the music stops for a section): ${rests.length}, at ${rests.map((t) => (t / 60).toFixed(1)).join(', ')} min`);
    const stv = h.log.filter((n) => n[1] === 'sting-whistle');
    console.log(`  stinger whistle notes: ${stv.length}`);
    continue;
  }
  if (name === 'hourlevels') {
    // The same hour, rendered (at 8 kHz, so it is quick): music and the
    // soundscape together, loudness and peak minute by minute.
    const h = await page.evaluate(async (SEED) => {
      localStorage.clear();
      const { Sound } = await import('/src/systems/audio.ts');
      const { mulberry32 } = await import('/src/rng.ts');
      const sr = 8000, secs = 3600;
      const ctx = new OfflineAudioContext(1, sr * secs, sr);
      const rnd = mulberry32(SEED);
      const s = new Sound({ listen: false });
      s.attach(ctx, rnd);
      s.bank.generateAll();
      const DAY = [['ranch', 40], ['meadow', 70], ['ranch', 40], ['hills', 70], ['ranch', 20], ['dusk', 60], ['night', 55], ['ranch', 15]];
      const len = DAY.reduce((a, [, d]) => a + d, 0);
      const SEASONS = [{ bloom: 1 }, {}, { leaves: 1 }, { snow: 1 }];
      let energy = 0.4, tension = 0;
      const step = 0.25;
      const tick = (t) => {
        const day = Math.floor(t / len), dt0 = t % len;
        let piece = 'ranch', acc = 0, rest = false;
        for (const [p, d] of DAY) { if (dt0 < acc + d) { piece = p; rest = acc + d === len; break; } acc += d; }
        energy = Math.max(0.05, Math.min(1, energy + (rnd() - 0.5) * 0.08));
        tension = rnd() < 0.003 ? 0.9 : Math.max(0, tension - 0.015);
        const season = SEASONS[Math.floor(day / 2.5) % 4];
        const phase = piece === 'night' ? 'night' : piece === 'dusk' ? 'dusk' : 'day';
        s.music.update({ piece, energy, tension, rest, muffle: false, ...season }, step);
        s.ambience.update({ region: piece === 'dusk' || piece === 'night' ? 'ranch' : piece, phase, wind: 0.4, river: 0, riverPan: 0, ford: 0, herd: [{ sp: 'sheep', rate: 3 * energy, pan: 0, vol: 0.7, water: 0 }],
          murmur: 4, murmurStress: tension * 0.5, murmurPan: 0, murmurSp: 'sheep', munch: 1 - energy, rain: 0, storm: 0, speed: 1,
          bloom: 0, leaves: 0, snow: 0, ...season, dawn: piece === 'ranch' && dt0 < 30 ? 1 : 0, fair: 0, fairPan: 0 }, step);
        if (Math.floor(t / step) % 520 === 260) s.stinger('calm');
        if (rnd() < 0.004) s.play('bark');
      };
      tick(0);
      for (let t = step; t < secs - step; t += step) {
        const tt = Math.round(t * 100) / 100;
        ctx.suspend(tt).then(() => { tick(tt); ctx.resume(); });
      }
      const r0 = performance.now();
      const b = await ctx.startRendering();
      const d = b.getChannelData(0);
      const mins = [];
      for (let m = 0; m < 60; m++) {
        let e = 0, pk = 0;
        for (let i = m * 60 * sr; i < (m + 1) * 60 * sr; i++) { e += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); }
        mins.push([Math.sqrt(e / (60 * sr)), pk]);
      }
      return { mins, ms: performance.now() - r0 };
    }, SEED);
    const rms = h.mins.map(([r]) => r), pks = h.mins.map(([, p]) => p);
    console.log(`\n== hourlevels (rendered at 8 kHz in ${(h.ms / 1000).toFixed(0)} s)`);
    console.log(`  per-minute loudness ${db(Math.min(...rms))}..${db(Math.max(...rms))} dBFS, peaks up to ${db(Math.max(...pks))} dBFS; first 10 min ${db(rms.slice(0, 10).reduce((a, v) => a + v, 0) / 10)}, last 10 min ${db(rms.slice(50).reduce((a, v) => a + v, 0) / 10)}`);
    console.log('  minutes: ' + rms.map((v) => db(v).replace('.0', '')).join(' '));
    continue;
  }
  if (name === 'sky') {
    // How the sky shades the ranch tune: phrases that open on a minor
    // chord, and the tempo, over a few minutes of each.
    console.log('\n== sky (ranch tune, 4 minutes each)');
    for (const [label, sky] of [['clear', {}], ['rain', { rain: 1 }], ['fog', { fog: 1 }]]) {
      const r = await page.evaluate(async (sky) => {
        localStorage.clear();
        const { Sound } = await import('/src/systems/audio.ts');
        const { mulberry32 } = await import('/src/rng.ts');
        const sr = 8000, secs = 240;
        const ctx = new OfflineAudioContext(1, sr * secs, sr);
        const s = new Sound({ listen: false });
        s.attach(ctx, mulberry32(5));
        s.bank.generateAll();
        const log = (s.music.log = []);
        const st = { piece: 'ranch', energy: 0.5, tension: 0, rest: false, muffle: false, ...sky };
        for (let i = 0; i < 40; i++) s.music.update(st, 0.5); // settle the sky
        for (let t = 0.5; t < secs - 0.5; t += 0.5) ctx.suspend(t).then(() => { s.music.update(st, 0.5); ctx.resume(); });
        await ctx.startRendering();
        let minor = 0, n = 0, leads = 0;
        log.forEach((e, i) => {
          if (e.inst !== 'section') return;
          n++;
          if (!e.info.includes('lead=null')) leads++;
          const c = log.slice(i).find((x) => x.inst === 'chord');
          if (c && (Number(c.info.split(',')[1]) - c.midi + 12) % 12 === 3) minor++;
        });
        return { n, minor, leads };
      }, sky);
      console.log(`  ${label.padEnd(6)} ${r.n} sections, ${r.minor} open on a minor chord, ${r.leads} with a tune`);
    }
    continue;
  }
  if (name === 'live3') {
    // The seasons in the real game: what the music and the soundscape do.
    const lp = await browser.newPage();
    lp.on('pageerror', (e) => errors.push(e.message));
    lp.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await lp.goto(`http://localhost:${PORT}/?debug`);
    await lp.waitForFunction(() => window.game);
    await lp.keyboard.press('KeyD');
    await lp.evaluate(() => {
      const a = window.game.audio;
      window.__heard = {};
      const f = a.sample.bind(a);
      a.sample = (n, ...rest) => { window.__heard[n] = (window.__heard[n] ?? 0) + 1; return f(n, ...rest); };
    });
    console.log('\n== live3 (seasons in the game)');
    for (const se of ['spring', 'summer', 'autumn', 'winter']) {
      await lp.evaluate((se) => { const g = window.game; g.season.force(se); window.__heard = {}; g.day.t = 10; g.dog.x = 1180; g.dog.y = 860; }, se);
      await lp.waitForTimeout(6000);
      const r = await lp.evaluate(() => {
        const a = window.game.audio, m = a.music;
        const heard = Object.entries(window.__heard).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
        return `music sees bloom ${m.sky.bloom.toFixed(2)} leaves ${m.sky.leaves.toFixed(2)} snow ${m.sky.snow.toFixed(2)}; heard ${heard}`;
      });
      console.log(`  ${se.padEnd(7)} ${r}`);
    }
    await lp.close();
    continue;
  }
  if (name === 'live2') {
    // Round two in the real game: resting, the sky, a trial run, an order.
    const lp = await browser.newPage();
    lp.on('pageerror', (e) => errors.push(e.message));
    lp.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await lp.goto(`http://localhost:${PORT}/?debug`);
    await lp.waitForFunction(() => window.game);
    await lp.keyboard.press('KeyD');
    await lp.evaluate(() => {
      const a = window.game.audio;
      window.__calls = [];
      for (const k of ['play', 'stinger']) {
        const f = a[k].bind(a);
        a[k] = (n, o) => { window.__calls.push(n); return f(n, o); };
      }
    });
    const note = (what) => lp.evaluate((what) => {
      const g = window.game, m = g.audio.music;
      const calls = [...new Set(window.__calls.filter((c) => !/^(ui-|step|creak|click)/.test(c)))].join(' ');
      window.__calls = [];
      return `${what}: wants ${m.want}, rest x${g.rest.toFixed(1)}, sky ${g.weather.sky} (rain ${m.sky.rain.toFixed(2)} fog ${m.sky.fog.toFixed(2)})${calls ? '  sounds: ' + calls : ''}`;
    }, what);
    const out = [];
    await lp.evaluate(() => { const d = window.game.doorPoint(); window.game.dog.x = d.x; window.game.dog.y = d.y + 20; });
    await lp.waitForTimeout(500);
    await lp.keyboard.down('KeyL');
    await lp.waitForTimeout(4000);
    out.push(await note('lying on the ranch'));
    await lp.keyboard.up('KeyL');
    await lp.waitForTimeout(1500);
    out.push(await note('up again'));
    await lp.evaluate(() => window.game.weather.force('storm'));
    await lp.waitForTimeout(7000);
    out.push(await note('storm') + `, lightning ${(await lp.evaluate(() => !!window.game.audio.lightning)) ? 'yes' : 'no'}`);
    await lp.evaluate(() => window.game.weather.force('fog'));
    await lp.waitForTimeout(2500);
    out.push(await note('fog') + `, ambience filter ${await lp.evaluate(() => Math.round(window.game.audio.ambLp.frequency.value))} Hz`);
    await lp.evaluate(() => window.game.weather.force('clear'));
    await lp.evaluate(async () => {
      const g = window.game;
      g.setTier(2, false);
      const p = g.ranch.course.post;
      g.dog.x = p.x; g.dog.y = p.y + 4;
      const { startRun } = await import('/src/systems/trials.ts');
      startRun(g);
    });
    await lp.waitForTimeout(2500);
    out.push(await note('trial run starts'));
    await lp.evaluate(async () => {
      const g = window.game, r = g.trials.run;
      r.step = 2; r.scores[1] = 15; r.bolts = 1;
    });
    await lp.waitForTimeout(1200);
    out.push(await note('fetch gate clean, one bolt'));
    await lp.evaluate(async () => {
      const { endRun } = await import('/src/systems/trials.ts');
      const g = window.game;
      g.trials.run.scores = [9, 15, 10, 15, 15, 20];
      g.trials.run.penned = true;
      endRun(g, false);
    });
    await lp.waitForTimeout(1500);
    out.push(await note('run over') + ` (score ${await lp.evaluate(() => window.game.trials.result.total)})`);
    await lp.evaluate(async () => { const { closeResult } = await import('/src/systems/trials.ts'); closeResult(window.game); });
    await lp.evaluate(() => {
      const g = window.game;
      g.orders.list.push({ id: 99, yard: g.ranch.yards[0].site.id, species: 'duck', n: 2, due: 1e9, got: 0, paid: 0, state: 'open' });
    });
    await lp.waitForTimeout(300);
    await lp.evaluate(() => { window.game.orders.list.at(-1).state = 'done'; });
    await lp.waitForTimeout(1200);
    out.push(await note('order filled'));
    await lp.evaluate(() => {
      const g = window.game;
      g.orders.list.push({ id: 100, yard: g.ranch.yards[0].site.id, species: 'duck', n: 2, due: 1e9, got: 0, paid: 0, state: 'open' });
    });
    await lp.waitForTimeout(300);
    await lp.evaluate(() => { window.game.orders.list.at(-1).state = 'gone'; });
    await lp.waitForTimeout(800);
    out.push(await note('order missed'));
    console.log('\n== live2');
    for (const s of out) console.log('  ' + s);
    await lp.close();
    continue;
  }
  if (name === 'drive') {
    // The herding bot drives sheep home calmly, then rudely: what does the
    // music hear? (energy = working a flock, tension = its stress/panic)
    const lp = await browser.newPage();
    lp.on('pageerror', (e) => errors.push(e.message));
    await lp.goto(`http://localhost:${PORT}/?debug`);
    await lp.waitForFunction(() => window.sim);
    await lp.keyboard.press('KeyD');
    console.log('\n== drive (sheep x10, bot)');
    for (const [label, o] of [['calm walk', {}], ['bark every 0.8s', { bark: 0.8 }], ['chase, sprinting', { chase: true, sprint: true }]]) {
      const r = await lp.evaluate((o) => {
        window.resetFlock('sheep', 768, 740, 10, 700, 700);
        const m = window.game.audio.music;
        const e = [], x = [];
        for (let k = 0; k < 40; k++) {
          const res = window.sim({ goalX: 880, goalY: 900, ...o }, 1);
          e.push(m.energy);
          x.push(m.tension);
          if (res.reached) break;
        }
        const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
        return { secs: e.length, energy: mean(e), tension: mean(x), peak: Math.max(...x), tense: x.filter((v) => v > 0.6).length / x.length };
      }, o);
      console.log(`  ${label.padEnd(18)} ${String(r.secs).padStart(2)}s  energy ${r.energy.toFixed(2)}  tension mean ${r.tension.toFixed(2)} peak ${r.peak.toFixed(2)}  tense ${(100 * r.tense).toFixed(0)}% of the time`);
    }
    await lp.close();
    continue;
  }
  if (name === 'sfx') {
    // Each sound effect alone, 3 s apart: peak and loudness, next to a bark.
    const SFX = ['bark', 'coin', 'gate', 'thatlldo', 'judge', 'judge2', 'cart', 'creak', 'applause:0.15', 'applause:0.5', 'applause:0.95', 'crack', 'thunder:near', 'thunder:far', 'sold', 'missed', 'gate:1', 'sour', 'hammer', 'chop', 'voice', 'footstep', 'baa', 'lamb', 'ewe', 'auction', 'gavel', 'ping-here', 'ping-hold', 'friend-join', 'friend-leave', 'smp:rook:0.07', 'smp:cuckoo:0.08', 'smp:robin:0.08', 'smp:wolves:0.07', 'smp:ice:0.07', 'smp:step-snow:0.15'];
    const rows = await page.evaluate(async (SFX) => {
      localStorage.clear();
      const { Sound } = await import('/src/systems/audio.ts');
      const sr = 44100, gap = 3, secs = SFX.length * gap;
      const ctx = new OfflineAudioContext(2, sr * secs, sr);
      const s = new Sound({ listen: false });
      s.attach(ctx);
      s.bank.generateAll();
      SFX.forEach((name, i) => {
        ctx.suspend(i * gap + 0.05).then(() => {
          const [n, arg] = name.split(':');
          if (n === 'smp') s.sample(arg, Number(name.split(':')[2]), 0);
          else if (n === 'applause') s.applause(Number(arg), Number(arg) > 0.9);
          else if (n === 'thunder') s.sample('thunder', arg === 'near' ? 0.32 : 0.12, 0, 1, undefined, arg === 'near' ? 3450 : 300);
          else if (n === 'gate' && arg) s.stinger('gate', { amt: Number(arg) });
          else if (['sold', 'missed', 'sour'].includes(n)) s.stinger(n);
          else if (n === 'voice') s.voice(330, "THAT'LL DO! LOVELY WORK, THAT.", 40, 0);
          else if (n === 'footstep') for (let k = 0; k < 4; k++) setTimeout(() => s.footstep(30, 0), 0), s.footstep(30, 0);
          else s.play(n, { x: 40, y: 0, force: true });
          ctx.resume();
        });
      });
      const b = await ctx.startRendering();
      const L = b.getChannelData(0), R = b.getChannelData(1);
      return SFX.map((name, i) => {
        let pk = 0, e = 0;
        const a = Math.floor(i * gap * sr), z = Math.floor((i + 1) * gap * sr);
        for (let j = a; j < z; j++) { pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j])); e += L[j] * L[j] + R[j] * R[j]; }
        // Loudness over the busiest half second.
        let best = 0;
        for (let w = a; w + sr / 2 < z; w += sr / 10) {
          let x = 0;
          for (let j = w; j < w + sr / 2; j += 4) x += L[j] * L[j] + R[j] * R[j];
          best = Math.max(best, x);
        }
        return [name, pk, Math.sqrt(best / (sr / 4))];
      });
    }, SFX);
    console.log('\n== sfx (alone, at the default volumes: peak / loudest half-second rms, dBFS)');
    for (const [n, pk, rms] of rows) console.log(`  ${n.padEnd(18)} ${db(pk).padStart(6)}  ${db(rms).padStart(6)}`);
    continue;
  }
  if (name === 'balance') {
    // Each layer of the band soloed over the same seeded passage.
    const LAYERS = ['leadBus', 'harpBus', 'melBus', 'bassBus', 'padEnv', 'droneEnv', 'percBus', 'bellBus', 'tensEnv'];
    const rows = [];
    for (const [piece, energy, tension] of [['ranch', 0.85, 0], ['night', 0.2, 0.7]]) {
      for (const solo of ['all', ...LAYERS]) {
        const rms = await page.evaluate(async ({ piece, energy, tension, solo, LAYERS, SEED }) => {
          localStorage.clear();
          const { Sound } = await import('/src/systems/audio.ts');
          const { mulberry32 } = await import('/src/rng.ts');
          const sr = 44100, secs = 20;
          const ctx = new OfflineAudioContext(2, sr * secs, sr);
          const s = new Sound({ listen: false });
          s.attach(ctx, mulberry32(SEED));
          s.bank.generateAll();
          if (solo !== 'all') for (const l of LAYERS) if (l !== solo) s.music[l].disconnect();
          const st = { piece, energy, tension, rest: false, muffle: false };
          s.music.update(st, 0.1);
          for (let t = 0.1; t < secs - 0.1; t += 0.1) { const tt = Math.round(t * 10) / 10; ctx.suspend(tt).then(() => { s.music.update(st, 0.1); ctx.resume(); }); }
          const b = await ctx.startRendering();
          let e = 0;
          for (let c = 0; c < 2; c++) for (const v of b.getChannelData(c)) e += v * v;
          return Math.sqrt(e / (2 * b.length));
        }, { piece, energy, tension, solo, LAYERS, SEED });
        rows.push([piece, solo, rms]);
      }
    }
    console.log('\n== balance (rms dBFS, layer soloed)');
    for (const piece of ['ranch', 'night']) console.log(`  ${piece}: ` + rows.filter((r) => r[0] === piece && r[2] > 1e-5).map(([, l, v]) => `${l.replace(/Bus|Env/, '')} ${db(v)}`).join('  '));
    continue;
  }
  if (name === 'tuning') {
    // Pitch of the sampled instruments, by autocorrelation: cents off.
    const t = await page.evaluate(async () => {
      const { Bank, mtof } = await import('/src/systems/synth.ts');
      const sr = 44100;
      const bank = new Bank(new OfflineAudioContext(1, sr, sr));
      bank.generateAll();
      const out = [];
      for (const [kind, notes] of [['pluck', [40, 45, 50, 57, 62, 66, 69, 74, 79, 86, 90]], ['bell', [62, 69, 76, 81, 88, 95]]]) {
        for (const m of notes) {
          const s = kind === 'pluck' ? bank.pluck(m) : bank.bell(m);
          const ctx = new OfflineAudioContext(1, sr, sr);
          const src = ctx.createBufferSource();
          src.buffer = s.buf;
          src.playbackRate.value = s.rate;
          src.connect(ctx.destination);
          src.start();
          const d = (await ctx.startRendering()).getChannelData(0);
          const f = mtof(m), w = Math.floor(sr * 0.25), a0 = Math.floor(sr * 0.05);
          let best = 0, bl = 0;
          const lo = Math.floor((sr / f) * 0.8), hi = Math.ceil((sr / f) * 1.25);
          const ac = [];
          for (let lag = lo; lag <= hi; lag++) {
            let c = 0;
            for (let i = a0; i < a0 + w; i++) c += d[i] * d[i + lag];
            ac.push(c);
            if (c > best) { best = c; bl = lag; }
          }
          // Parabolic interpolation around the peak.
          const k = bl - lo, y0 = ac[k - 1] ?? best, y2 = ac[k + 1] ?? best;
          const lag = bl + (y0 - y2) / (2 * (y0 - 2 * best + y2) || 1);
          out.push([kind, m, 1200 * Math.log2(sr / lag / f)]);
        }
      }
      return out;
    });
    const worst = Math.max(...t.map(([, , c]) => Math.abs(c)));
    console.log(`\n== tuning  worst ${worst.toFixed(1)} cents`);
    console.log('  ' + t.map(([k, m, c]) => `${k}${nm(m)} ${c >= 0 ? '+' : ''}${c.toFixed(1)}`).join('  '));
    if (worst > 8) fail = true;
    continue;
  }
  const r = await page.evaluate(async ({ name, SECS, SEED }) => {
    localStorage.clear(); // volumes are remembered; start each case at the defaults
    const { Sound } = await import('/src/systems/audio.ts');
    const { mulberry32 } = await import('/src/rng.ts');
    const sr = 44100;
    const secs = name === 'stingers' ? 18 : name === 'weather' ? 32 : SECS;
    const ctx = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
    const rnd = mulberry32(SEED);
    const s = new Sound({ listen: false });
    s.attach(ctx, rnd);
    s.bank.generateAll();
    const log = [];
    s.music.log = log;
    const base = { piece: 'ranch', energy: 0.5, tension: 0, rest: false, muffle: false };
    const amb = { region: 'ranch', phase: 'day', river: 0, riverPan: 0, ford: 0, herd: [], murmur: 0, murmurStress: 0, murmurPan: 0, murmurSp: 'sheep', munch: 0, rain: 0, wind: 0.3, storm: 0, speed: 1, bloom: 0, leaves: 0, snow: 0, dawn: 0, fair: 0, fairPan: 0 };
    let strikes = 0;
    const heard = {};
    const sample = s.sample.bind(s), play = s.play.bind(s);
    s.sample = (n, ...rest) => { heard[n] = (heard[n] ?? 0) + 1; return sample(n, ...rest); };
    s.play = (n, ...rest) => { heard[n] = (heard[n] ?? 0) + 1; return play(n, ...rest); };
    let musicOn = true, ambOn = false;
    let state = () => base;
    let ambState = () => amb;
    const events = [];
    switch (name) {
      case 'panic':
        // A calm drive, then the flock panics, then settles again.
        state = (t) => ({ ...base, piece: 'hills', energy: 0.8, tension: t < 6 ? 0.05 : t < 14 ? 0.9 : 0.05 });
        break;
      case 'prowl':
        state = (t) => ({ ...base, piece: 'night', energy: 0.2, tension: t < 8 ? 0 : t < 18 ? Math.min(1, (t - 8) / 5) : 0.1 });
        break;
      case 'stingers':
        state = () => ({ ...base, piece: 'ranch', energy: 0.4 });
        events.push([2, 'calm'], [5.5, 'steady'], [8, 'rattled'], [10, 'tierup'], [14, 'summary']);
        break;
      case 'ambience':
        musicOn = false;
        ambOn = true;
        ambState = (t) => ({
          ...amb,
          region: t < 8 ? 'high' : 'ford', wind: t < 8 ? 0.9 : 0.35, river: t < 8 ? 0 : 0.9, riverPan: -0.4, ford: t < 8 ? 0 : 0.8,
          herd: [{ sp: t < 8 ? 'pony' : 'cow', rate: 6, pan: 0.2, vol: 0.8, water: 0 }],
          murmur: 6, murmurStress: t < 16 ? 0.1 : 0.8, murmurPan: 0.1, murmurSp: t < 8 ? 'pony' : 'cow', munch: t < 16 ? 0.7 : 0,
          phase: t < 20 ? 'day' : 'night', rain: t > 12 ? 0.8 : 0,
        });
        break;
      case 'mix':
        // Everything at once: music, ambience, barks and calls.
        ambOn = true;
        state = (t) => ({ ...base, piece: 'meadow', energy: 0.7, tension: t > 12 ? 0.7 : 0.1 });
        ambState = () => ({ ...amb, region: 'meadow', wind: 0.4, herd: [{ sp: 'duck', rate: 8, pan: 0, vol: 1, water: 0 }], murmur: 7, murmurStress: 0.3, munch: 0.5 });
        for (let t = 1; t < secs - 1; t += 1.7) events.push([t, 'sfx:bark']);
        for (let t = 2.2; t < secs - 1; t += 3.1) events.push([t, 'sfx:quack']);
        events.push([6, 'calm'], [9, 'sfx:coin'], [9.05, 'sfx:gate'], [15, 'tierup']);
        break;
      case 'trial':
        // A run: the judge, the handler, two gates (one clean, one ragged), a
        // grip, the pen, the judge again and a warm crowd.
        state = (t) => ({ ...base, piece: 'trial', energy: 0.7, tension: t > 9 && t < 11 ? 0.5 : 0.05 });
        events.push([1, 'sfx:judge'], [1.75, 'sfx:thatlldo'], [6, 'gate:1'], [9, 'sour'], [12, 'gate:0.6'], [17, 'sfx:gate'], [17.2, 'sfx:thatlldo'], [18, 'sfx:judge2']);
        events.push([19.5, (s) => s.applause(0.9, true)]);
        break;
      case 'lullaby':
        // Resting: the music box, and birds hurrying through the day.
        ambOn = true;
        state = () => ({ ...base, piece: 'lullaby', energy: 0.05 });
        ambState = () => ({ ...amb, region: 'ranch', wind: 0.25, speed: 3, munch: 0.5, murmur: 2, murmurSp: 'duck' });
        break;
      case 'orders':
        state = () => ({ ...base, piece: 'ranch', energy: 0.4 });
        events.push([2, 'sfx:gate'], [2.18, 'sfx:thatlldo'], [2.75, 'sold'], [4.4, 'sfx:cart'], [11, 'missed'], [16, 'steady'], [19, (s) => s.applause(0.2, false)]);
        break;
      case 'weather': {
        // Rain, then fog, then a storm with thunder; a bark in each.
        ambOn = true;
        const sky = (t) => (t < 9 ? { rain: 0.6, fog: 0.1, wind: 0.4, storm: 0 } : t < 16 ? { rain: 0, fog: 0.8, wind: 0.05, storm: 0 } : { rain: 1, fog: 0.2, wind: 1, storm: 1 });
        state = (t) => ({ ...base, piece: 'ranch', energy: 0.4, ...sky(t), tension: t >= 16 ? 0.4 : 0 });
        ambState = (t) => ({ ...amb, region: 'hills', ...sky(t), wind: 0.6 * (0.45 + 1.1 * sky(t).wind) });
        s.ambience.thunderT = 1; // do not keep the test waiting for the first strike
        const strike = s.strike.bind(s);
        s.strike = (near) => { strikes++; strike(near); };
        for (const t of [4, 12, 20]) events.push([t, (s) => { s.fog = sky(t).fog; s.lx = 0; s.play('bark', { x: 150, y: 0 }); }]);
        break;
      }
      case 'spring': case 'summer': case 'autumn': case 'winter': {
        // A season: its soundscape (dawn for spring, a winter night by the
        // river) under a region's music shaded for the season.
        ambOn = true;
        const look = { spring: { bloom: 1 }, summer: {}, autumn: { leaves: 1 }, winter: { snow: 1 } }[name];
        const piece = { spring: 'meadow', summer: 'hills', autumn: 'ranch', winter: 'night' }[name];
        state = () => ({ ...base, piece, energy: 0.6, ...look });
        ambState = () => ({ ...amb, bloom: 0, leaves: 0, snow: 0, ...look, region: name === 'winter' ? 'ford' : 'meadow',
          phase: name === 'winter' ? 'night' : 'day', dawn: name === 'spring' ? 1 : 0, wind: name === 'autumn' ? 0.8 : name === 'winter' ? 0.9 : 0.35,
          river: name === 'winter' ? 0.8 : 0, riverPan: -0.3, herd: [{ sp: 'sheep', rate: 5, pan: 0.2, vol: 0.8, water: 0 }] });
        break;
      }
      case 'lambs': {
        // A lamb cut off from its ewe: call and answer, then back together.
        const ewe = { x: -150, y: 0, gone: false, carried: false, pen: null };
        const lamb = { x: 140, y: 30, lamb: true, mother: ewe, gone: false, carried: false, pen: null };
        const g = { animals: [ewe, lamb] };
        state = () => ({ ...base, piece: 'meadow', energy: 0.3, bloom: 1 });
        events.push([0.05, () => {}]);
        for (let t = 0.1; t < secs - 0.1; t += 0.1) events.push([t, (s) => { if (t > 16) { lamb.x = ewe.x + 10; } s.lambCalls(g, 0.1); }]);
        break;
      }
      case 'fair':
        // The fair: the crowd, the auctioneer's chant and the gavel.
        ambOn = true;
        state = () => ({ ...base, piece: 'ranch', energy: 0.3, leaves: 1 });
        ambState = () => ({ ...amb, fair: 0.9, fairPan: 0.2, leaves: 1 });
        events.push([3, 'sfx:auction'], [12, 'sfx:auction'], [20, (s) => { s.play('gavel', { force: true }); s.applause(0.3, false); }]);
        break;
      case 'coop':
        // Co-op: a friend arrives, the barks of four players, pings, a friend leaves.
        state = () => ({ ...base, piece: 'ranch', energy: 0.5 });
        // The roster as the host sees it (an array), then as a guest (a map).
        events.push([0.5, (s) => s.friends({ net: { players: [{ slot: 0 }] } })], [1, (s) => s.friends({ net: { players: [{ slot: 0 }, { slot: 2 }] } })]);
        for (let k = 0; k < 4; k++) events.push([3 + k * 0.8, (s) => s.play('bark', { x: 0, y: 0, who: k, force: true })]);
        events.push([7, (s) => s.play('ping-here', { x: 60, y: 0, who: 1, force: true })], [9, (s) => s.play('ping-hold', { x: -60, y: 0, who: 2, force: true })]);
        events.push([11.5, (s) => s.friends({ net: { players: new Map([[0, {}], [2, {}]]) } })], [12, (s) => s.friends({ net: { players: new Map([[0, {}]]) } })]);
        break;
      default:
        state = (t) => ({ ...base, piece: name, energy: t < secs * 0.4 ? 0.25 : 0.8 });
    }
    events.sort((a, b) => a[0] - b[0]);
    if (!musicOn) s.setMusicLevel(0);
    const dt = 0.05;
    let ei = 0;
    const tick = (t) => {
      s.lx = 0; s.ly = 0;
      if (musicOn) s.music.update(state(t), dt);
      if (ambOn) s.ambience.update(ambState(t), dt, 0, 0);
      while (ei < events.length && events[ei][0] <= t + 1e-6) {
        const ev = events[ei++][1];
        if (typeof ev === 'function') ev(s);
        else if (ev.startsWith('sfx:')) s.play(ev.slice(4), { force: true });
        else if (ev.startsWith('gate:')) s.stinger('gate', { amt: Number(ev.slice(5)) });
        else s.stinger(ev);
      }
    };
    tick(0);
    for (let t = dt; t < secs - dt; t += dt) {
      const tt = Math.round(t * 1000) / 1000;
      ctx.suspend(tt).then(() => { tick(tt); ctx.resume(); });
    }
    const r0 = performance.now();
    const buf = await ctx.startRendering();
    const speed = secs / ((performance.now() - r0) / 1000);

    // Levels.
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0, sum = 0, clips = 0, dc = 0;
    const win = [];
    let ws = 0, wn = 0;
    for (let i = 0; i < L.length; i++) {
      const a = Math.abs(L[i]), b = Math.abs(R[i]);
      peak = Math.max(peak, a, b);
      if (a >= 0.999 || b >= 0.999) clips++;
      const m = (L[i] * L[i] + R[i] * R[i]) / 2;
      sum += m;
      dc += L[i] + R[i];
      ws += m; wn++;
      if (wn === sr) { win.push(Math.sqrt(ws / wn)); ws = 0; wn = 0; }
    }
    const rms = Math.sqrt(sum / L.length);

    // Spectrogram (log frequency, 50 Hz..12 kHz).
    const N = 2048, hop = 1024, H = 160;
    const frames = Math.floor((L.length - N) / hop);
    const cv = document.createElement('canvas');
    cv.width = frames; cv.height = H;
    const g = cv.getContext('2d');
    const img = g.createImageData(frames, H);
    const re = new Float32Array(N), im = new Float32Array(N);
    const hann = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    const fft = () => {
      for (let i = 1, j = 0; i < N; i++) {
        let bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let len = 2; len <= N; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        for (let i = 0; i < N; i += len)
          for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
            const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
            re[i + k] = ur + vr; im[i + k] = ui + vi;
            re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          }
      }
    };
    const EDGES = [20, 120, 350, 1000, 3000, 8000, 20000];
    const bands = new Float64Array(EDGES.length - 1);
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < N; i++) { re[i] = ((L[f * hop + i] + R[f * hop + i]) / 2) * hann[i]; im[i] = 0; }
      fft();
      for (let k = 1; k < N / 2; k++) {
        const fq = (k * sr) / N;
        const b = EDGES.findIndex((e) => e > fq) - 1;
        if (b >= 0 && b < bands.length) bands[b] += re[k] * re[k] + im[k] * im[k];
      }
      for (let y = 0; y < H; y++) {
        const freq = 50 * Math.pow(12000 / 50, 1 - y / (H - 1));
        const bin = Math.round((freq * N) / sr);
        const mag = Math.hypot(re[bin], im[bin]) / (N / 4);
        const d = Math.max(0, Math.min(1, (20 * Math.log10(mag + 1e-9) + 90) / 80));
        const o = (y * frames + f) * 4;
        img.data[o] = 255 * Math.min(1, d * 1.6); img.data[o + 1] = 255 * Math.max(0, d * 1.6 - 0.6); img.data[o + 2] = 80 + 120 * d; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tot = bands.reduce((a, b) => a + b, 0) || 1;
    return { peak, rms, clips, dc: dc / L.length / 2, win, log, png: cv.toDataURL('image/png'), secs, bands: [...bands].map((b) => b / tot), speed, strikes, heard };
  }, { name, SECS, SEED });

  writeFileSync(`shots/audio-${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  const wmin = Math.min(...r.win), wmax = Math.max(...r.win);
  const bad = r.clips > 0 || r.peak > 0.98;
  if (bad) fail = true;
  const bandStr = ['<120', '120-350', '350-1k', '1k-3k', '3k-8k', '8k+'].map((b, i) => `${b} ${(10 * Math.log10(r.bands[i] + 1e-9)).toFixed(0)}`).join('  ');
  console.log(`\n== ${name}  ${r.secs}s  peak ${db(r.peak)} dBFS  rms ${db(r.rms)} dBFS  1s-rms ${db(wmin)}..${db(wmax)}  clips ${r.clips}  dc ${r.dc.toExponential(1)}${bad ? '  << CLIPPING' : ''}`);
  console.log(`  spectrum dB (share of energy): ${bandStr}   rendered at ${r.speed.toFixed(0)}x real time`);
  if (flag("windows") || name === 'weather' || name === 'trial' || name === 'orders') console.log("  1s rms: " + r.win.map(db).join(" "));
  if (name === 'weather') console.log(`  lightning strikes: ${r.strikes}`);
  if (['spring', 'summer', 'autumn', 'winter', 'lambs', 'fair', 'coop'].includes(name)) console.log('  heard: ' + Object.entries(r.heard).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));

  // Music theory checks on the notes.
  const mk = MODES[name] ?? MODES[{ panic: 'hills', prowl: 'night', stingers: 'ranch', mix: 'meadow', orders: 'ranch', weather: 'ranch' }[name]];
  if (!mk || !r.log.length) continue;
  const [key, mode] = mk;
  const scale = SCALES[mode].map((x) => (x + key) % 12);
  const chords = r.log.filter((n) => n.inst === 'chord');
  // Notes are humanised by a few ms, so look just after the onset.
  const chordAt = (t) => { let c = null; for (const x of chords) { if (x.t <= t + 0.012) c = x; else break; } return c; };
  const leads = r.log.filter((n) => ['whistle', 'fiddle', 'harp-mel', 'bell-mel'].includes(n.inst));
  const by = {};
  for (const n of r.log) by[n.inst] = (by[n.inst] ?? 0) + 1;
  console.log('  notes:', Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', '));
  for (const s of r.log.filter((n) => n.inst === 'section')) console.log(`  @${s.t.toFixed(1)}s ${s.info}  (${s.dur.toFixed(1)}s)`);
  if (leads.length) {
    let inScale = 0, ct = 0;
    const ivs = {};
    let maxIv = 0, lo = 999, hi = 0;
    const out = [];
    for (let i = 0; i < leads.length; i++) {
      const n = leads[i];
      const c = chordAt(n.t);
      const tones = c ? c.info.split(',').map(Number) : [];
      if (scale.includes(n.midi % 12) || tones.includes(n.midi % 12)) inScale++;
      else out.push(nm(n.midi));
      if (tones.includes(n.midi % 12)) ct++;
      lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi);
      const p = leads[i - 1];
      if (p && p.inst === n.inst && n.t - p.t < 2.5) {
        const iv = Math.abs(n.midi - p.midi);
        ivs[iv] = (ivs[iv] ?? 0) + 1;
        maxIv = Math.max(maxIv, iv);
      }
    }
    const step = Object.entries(ivs).filter(([k]) => k <= 2).reduce((a, [, v]) => a + v, 0);
    const tot = Object.values(ivs).reduce((a, v) => a + v, 0) || 1;
    console.log(`  tune: ${leads.length} notes, range ${nm(lo)}-${nm(hi)}, in scale/chord ${((100 * inScale) / leads.length).toFixed(0)}%, chord tones ${((100 * ct) / leads.length).toFixed(0)}%, steps ${((100 * step) / tot).toFixed(0)}%, biggest leap ${maxIv}${out.length ? '  outside: ' + out.join(' ') : ''}`);
    if (flag('roll')) {
      // The tune with chord changes inline: [G] G5:3 B5:3 | [C] ...
      const ev = [...chords.map((c) => ({ t: c.t, c })), ...leads.map((n) => ({ t: n.t, n }))].sort((a, b) => a.t - b.t || (a.c ? -1 : 1));
      const tick = r.log.find((n) => n.inst === 'section');
      let line = '  ';
      for (const e of ev) {
        if (e.c) {
          const tones = e.c.info.split(',').map(Number);
          const minor = (tones[1] - tones[0] + 12) % 12 === 3;
          line += `| [${NAMES[e.c.midi]}${minor ? 'm' : ''}] `;
          if (line.length > 110) { console.log(line); line = '  '; }
        } else {
          const ct = chordAt(e.n.t)?.info.split(',').map(Number).includes(e.n.midi % 12);
          line += `${nm(e.n.midi)}${ct ? '' : '*'}:${e.n.dur.toFixed(1)} `;
        }
      }
      console.log(line);
      void tick;
    }
  }
  const acc = r.log.filter((n) => n.inst === 'harp' || n.inst === 'bass' || n.inst === 'bell');
  if (acc.length) {
    let ct = 0;
    for (const n of acc) {
      const c = chordAt(n.t);
      const tones = c ? c.info.split(',').map(Number) : [];
      if (tones.includes(n.midi % 12)) ct++;
    }
    console.log(`  accompaniment: ${acc.length} notes, chord tones ${((100 * ct) / acc.length).toFixed(0)}%`);
  }
  if (flag('chords')) console.log('  chords:', chords.map((c) => NAMES[c.midi] + (c.info.split(',')[1] - c.midi === 3 || c.info.split(',')[1] - c.midi === -9 ? 'm' : '')).join(' '));
}

await browser.close();
await server.close();
if (errors.length) { console.log('\nerrors:\n  ' + errors.join('\n  ')); fail = true; }
process.exit(fail ? 1 : 0);
