// Screenshot every screen of the game (title, hints, flock card, that'll
// do, summary, build, ledger, pause, dusk, night, tier-up) at several phone
// and desktop sizes, then put them on contact sheets.
//
//   node scripts/uitour.mjs                  -> shots/ui/<size>-<state>.png + shots/ui/sheet-<size>.png
//   node scripts/uitour.mjs --sizes=phone,desk --states=summary,ledger
// Sizes: desk desk4 phone se android land tablet notch landnotch.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};

const SIZES = {
  desk: { width: 1280, height: 720, dpr: 1 },
  desk4: { width: 800, height: 600, dpr: 1 },
  phone: { width: 390, height: 844, dpr: 3, touch: true },
  se: { width: 375, height: 667, dpr: 2, touch: true },
  android: { width: 412, height: 915, dpr: 2.625, touch: true },
  land: { width: 844, height: 390, dpr: 3, touch: true },
  tablet: { width: 820, height: 1180, dpr: 2, touch: true },
  // Home-screen web app on a notched phone: fake safe-area insets (CSS px).
  notch: { width: 390, height: 844, dpr: 3, touch: true, q: 'safe=59,0,34,0' },
  landnotch: { width: 844, height: 390, dpr: 3, touch: true, q: 'safe=0,59,21,59' },
};

// Each state runs in a fresh page; `fn` runs in the page with the game.
const STATES = {
  title: { query: 'debug&title', fn: () => 80 },
  start: { fn: () => {} },
  flock: {
    fn: () => {
      const g = window.game;
      const gr = g.groups[0];
      g.dog.x = gr.x - 40; g.dog.y = gr.y + 6; g.cam.x = g.dog.x; g.cam.y = g.dog.y;
      g.tut = 1; g.tutT = 0;
      return 30;
    },
  },
  lie: {
    fn: () => {
      const g = window.game;
      const gr = g.groups[0];
      g.dog.x = gr.x - 46; g.dog.y = gr.y; g.cam.x = g.dog.x; g.cam.y = g.dog.y;
      g.tut = 2; g.tutT = 0;
      g.input.override = { x: 0, y: 0, sprint: false, lie: true };
      return 50;
    },
  },
  thatlldo: {
    fn: () => {
      const g = window.game;
      const pen = g.ranch.pens[0];
      window.sim({ goalX: pen.gatePoint(30).x, goalY: pen.gatePoint(30).y }, 120);
      window.sim({ goalX: pen.cx, goalY: pen.cy, untilPenned: true }, 90);
      g.input.override = { x: 0, y: 0, sprint: false, lie: true };
      for (let i = 0; i < 60; i++) { g.update(1 / 60); if (g.banner?.big === "THAT'LL DO!") break; }
      return 20;
    },
  },
  summary: {
    fn: () => {
      const g = window.game;
      g.stats.delivered = { duck: 6 }; g.stats.deliveredValue = 22; g.stats.calm = 4; g.stats.goodsValue = 9;
      g.coins = 31;
      g.endDay();
      return 120;
    },
  },
  build: {
    fn: () => {
      const g = window.game;
      g.coins = 60;
      g.enterBuild();
      g.build.item = 3;
      return 20;
    },
  },
  paddock: {
    // The paddock editor: a draft south-west of the farmhouse. Uses the
    // stand-in rules (src/ui/paddockdev.ts) until the ranch has its own.
    fn: async () => {
      const g = window.game;
      const pb = await import('/src/ui/paddockbuild.ts');
      if (!pb.paddockRules()) (await import('/src/ui/paddockdev.ts')).useDevPaddocks();
      const cat = await import('/src/ranch/catalog.ts');
      g.coins = 120;
      g.tier = 4;
      g.enterBuild();
      g.build.item = cat.CATALOG.findIndex((d) => d.id === pb.paddockRules().tool);
      g.build.paddock.start(pb.paddockRules(), 0, 0, { tx: 80, ty: 109, w: 10, h: 6 });
      return 60;
    },
  },
  dogtab: {
    fn: () => {
      const g = window.game;
      g.coins = 60;
      g.setTier(4, false);
      g.ranch.add(window.__mk('kennel', 90, 108));
      g.enterBuild();
      g.build.tab = 'dog';
      return 20;
    },
  },
  ledger: {
    fn: () => {
      const g = window.game;
      g.input.push('ledger');
      return 10;
    },
  },
  buyers: {
    fn: async () => {
      const g = window.game;
      g.setTier(4, false);
      g.favour.pts = { mill: 14, drover: 33, sale: 24, shear: 4 };
      g.favour.filled = { mill: 3, drover: 8, sale: 5, shear: 1 };
      g.openLedger('buyers');
      return 10;
    },
  },
  badges: {
    fn: async () => {
      const g = window.game;
      for (const id of ['home', 'steady', 'quiet', 'ribbon', 'cup', 'sold', 'trusted', 'friend', 'lambs', 'visit']) g.achievements.got.set(id, 3);
      g.achievements.sel = 21;
      g.openLedger('badges');
      return 10;
    },
  },
  badgecard: {
    fn: () => {
      const g = window.game;
      g.tut = 99;
      g.banner = null;
      g.achievements.grant(g, 'friend');
      return 25;
    },
  },
  pause: {
    fn: () => {
      const g = window.game;
      g.input.push('pause');
      return 10;
    },
  },
  dusk: {
    fn: () => {
      const g = window.game;
      g.setTier(2, false);
      g.day.t = 270; g.day.phase = 'dusk';
      g.tut = 9;
      return 30;
    },
  },
  night: {
    fn: () => {
      const g = window.game;
      g.setTier(3, false);
      g.tut = 9;
      g.day.t = 299.9;
      for (let i = 0; i < 10; i++) g.update(1 / 60);
      g.day.nightT = 10;
      for (const p of g.predators) p.delay = 0;
      return 240;
    },
  },
  order: {
    fn: async () => {
      const g = window.game;
      const o = await import('/src/systems/orders.ts');
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      g.orders.list = [{ id: 1, yard: 'mill', species: 'sheep', n: 4, due: o.hourToT(12), got: 1, paid: 9, state: 'open' }];
      g.animals = g.animals.filter((a) => a.pen);
      g.spawnFlock('sheep', g.dog.x + 30, g.dog.y + 20, 5);
      g.place = null;
      return 30;
    },
  },
  orderpen: {
    fn: async () => {
      const g = window.game;
      const o = await import('/src/systems/orders.ts');
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      const pen = g.ranch.pens[0];
      g.animals = [];
      g.spawnFlock('sheep', pen.cx, pen.cy, 5);
      for (let i = 0; i < 60; i++) g.update(1 / 60);
      g.orders.list = [{ id: 1, yard: 'drover', species: 'sheep', n: 3, due: o.hourToT(13), got: 0, paid: 0, state: 'open' }];
      const gp = pen.gatePoint(30);
      g.dog.x = gp.x; g.dog.y = gp.y; g.cam.x = gp.x; g.cam.y = gp.y;
      g.place = null; g.banner = null;
      return 30;
    },
  },
  trialday: {
    fn: () => {
      const g = window.game;
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      g.day.day = 3; g.day.t = 30; g.trials.lastPrizeDay = 0; // past the dawn
      g.animals = g.animals.filter((a) => a.pen);
      g.place = null; g.banner = null;
      return 30;
    },
  },
  atpost: {
    fn: () => {
      const g = window.game;
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      g.day.day = 3; g.day.t = 30; g.trials.lastPrizeDay = 0; // past the dawn
      const p = g.ranch.course.post;
      g.dog.x = p.x; g.dog.y = p.y + 6; g.cam.x = p.x; g.cam.y = p.y;
      for (let i = 0; i < 120; i++) g.update(1 / 60);
      return 60;
    },
  },
  trialrun: {
    fn: async () => {
      const g = window.game;
      const tr = await import('/src/systems/trials.ts');
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      g.day.day = 3; g.day.t = 30; g.trials.lastPrizeDay = 0; // past the dawn
      const p = g.ranch.course.post;
      g.dog.x = p.x; g.dog.y = p.y + 6; g.cam.x = p.x; g.cam.y = p.y;
      tr.startRun(g);
      for (let i = 0; i < 90; i++) g.update(1 / 60);
      g.banner = null;
      return 30;
    },
  },
  trialresult: {
    fn: async () => {
      const g = window.game;
      const tr = await import('/src/systems/trials.ts');
      g.setTier(2, false);
      g.tut = 9; g.tip = null;
      g.day.day = 3; g.day.t = 30; g.trials.lastPrizeDay = 0; // past the dawn
      const p = g.ranch.course.post;
      g.dog.x = p.x; g.dog.y = p.y + 6; g.cam.x = p.x; g.cam.y = p.y;
      tr.startRun(g);
      const r = g.trials.run;
      r.scores = [8, 15, 10, 10, 15, 20]; r.penned = true; r.t = 95;
      tr.endRun(g, false);
      return 60;
    },
  },
  rest: {
    fn: () => {
      const g = window.game;
      g.tut = 9; g.tip = null;
      g.animals = g.animals.filter((a) => a.pen);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
      return 200;
    },
  },
  rain: { query: 'debug&weather=rain', fn: () => { window.game.tut = 9; window.game.tip = null; return 30; } },
  fog: { query: 'debug&weather=fog', fn: () => { const g = window.game; g.tut = 9; g.tip = null; g.weather.forecast = 'storm'; g.endDay(); return 120; } },
  look: { fn: () => { const g = window.game; g.openLook('new'); return 30; } },
  lookcustom: {
    fn: async () => {
      const g = window.game;
      const L = await import('/src/ui/look.ts');
      g.look = { ...g.look, name: 'BANJO', dog: { speckle: 'heavy', mask: 'one', saddle: true, tailTip: true, neck: 'neckerchief' } };
      L.applyLook(g.look);
      g.openLook('kennel');
      g.lookSel = 5;
      return 30;
    },
  },
  decortab: {
    fn: async () => {
      const g = window.game;
      g.setTier(3, false);
      g.coins = 80;
      g.totals.ribbons = [1, 0, 1];
      g.ranch.add(window.__mk('kennel', 90, 108));
      window.__decorate(g);
      g.enterBuild();
      g.build.setTab(g, 'decor');
      g.build.piece = 6;
      return 30;
    },
  },
  ranchtab: {
    fn: async () => {
      const g = window.game;
      const L = await import('/src/ui/look.ts');
      g.look.ranch = 'WILLOW CREEK';
      g.look.roof = 'thatch';
      g.look.trim = 'butter';
      L.applyLook(g.look);
      g.enterBuild();
      g.build.setTab(g, 'ranch');
      g.build.row = 1;
      return 60;
    },
  },
  decorworld: {
    fn: async () => {
      const g = window.game;
      const L = await import('/src/ui/look.ts');
      g.setTier(3, false);
      g.totals.ribbons = [1, 0, 1];
      g.trials.won = ['novice'];
      g.coins = 200;
      g.ranch.add(window.__mk('kennel', 90, 108));
      g.look = { ...g.look, name: 'BANJO', ranch: 'WILLOW CREEK', roof: 'moss', trim: 'teal', dog: { speckle: 'heavy', mask: 'none', saddle: true, tailTip: true, neck: 'collar' } };
      L.applyLook(g.look);
      window.__decorate(g);
      g.tut = 9; g.tip = null; g.banner = null; g.place = null;
      const f = g.ranch.farmhouse;
      g.dog.x = f.cx + 20; g.dog.y = f.y1 + 14; g.cam.x = f.cx + 10; g.cam.y = f.cy + 10;
      return 40;
    },
  },
  photo: {
    fn: async () => {
      const g = window.game;
      const L = await import('/src/ui/look.ts');
      const P = await import('/src/ui/photo.ts');
      g.look.ranch = 'WILLOW CREEK';
      L.applyLook(g.look);
      g.tut = 9; g.tip = null; g.banner = null; g.place = null;
      P.openPhoto(g);
      return 30;
    },
  },
  tierup: {
    fn: () => {
      const g = window.game;
      g.tut = 9;
      g.setTier(2, true);
      return 40;
    },
  },
  // Co-op (no relay needed): the guest's JOIN A FRIEND on the title, the
  // host's invite card, and a friend's dog with its name tag in the field.
  join: {
    query: 'debug&title&join=KRB',
    fn: () => 30,
  },
  invite: {
    fn: async () => {
      const g = window.game;
      window.fetch = () => new Promise(() => {}); // no relay here: the room never opens by itself
      const coop = await import('/src/ui/coop.ts');
      coop.openCoop(g, 'invite');
      await new Promise((r) => setTimeout(r, 100));
      const n = g.net;
      n.status = 'open';
      n.code = 'KRBT';
      n.error = '';
      return 20;
    },
  },
  friend: {
    fn: async () => {
      const g = window.game;
      window.fetch = () => new Promise(() => {});
      const { HostNet } = await import('/src/net/host.ts');
      const { Dog } = await import('/src/entities/dog.ts');
      const { friendDogSprites } = await import('/src/art/dogstyle.ts');
      const n = new HostNet(g);
      const mk = (tag, x, y, look) => {
        const d = new Dog(x, y);
        d.skin = friendDogSprites({ speckle: 'heavy', mask: 'one', saddle: true, tailTip: false, neck: 'bandana', ...look });
        d.tag = tag;
        n.dogs.push(d);
        return d;
      };
      const gr = g.groups[0];
      g.dog.x = gr.x - 44; g.dog.y = gr.y + 4; g.cam.x = g.dog.x + 10; g.cam.y = g.dog.y;
      g.tut = 9;
      mk('ZIGGY', gr.x + 2, gr.y - 40, {});
      mk('PIP', gr.x + 900, gr.y + 300, { neck: 'collar', mask: 'none' });
      return 30;
    },
  },
};

const sizeNames = opt('sizes', 'desk,phone,land,se').split(',');
const stateNames = opt('states', Object.keys(STATES).join(',')).split(',');
const PORT = Number(process.env.PORT || 5187);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
mkdirSync('shots/ui', { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const sn of sizeNames) {
  const s = SIZES[sn];
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr, hasTouch: !!s.touch, isMobile: !!s.touch });
  for (const st of stateNames) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${sn}/${st}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${sn}/${st}: ${m.text()}`));
    await page.goto(`http://localhost:${PORT}/?${STATES[st].query ?? 'debug'}${s.q ? `&${s.q}` : ''}`);
    await page.waitForFunction(() => window.game);
    await page.evaluate(async () => {
      const m = await import('/src/ui/build.ts');
      const c = await import('/src/ranch/catalog.ts');
      window.__mk = (id, tx, ty) => m.makeBuilding(c.CATALOG.find((d) => d.id === id), tx, ty, 0);
      const db = await import('/src/ui/decorbuild.ts');
      // Put one of each piece the ranch has opened near the farmhouse.
      window.__decorate = (g) => {
        for (const p of db.PIECES) {
          if (!p.open(g)) continue;
          let done = false;
          for (let r = 2; r < 12 && !done; r++)
            for (let dy = -r; dy <= r && !done; dy++)
              for (let dx = -r; dx <= r && !done; dx++) {
                const tx = 92 + dx, ty = 103 + dy;
                if (!db.decorBlocked(g, p, tx, ty, (x, y) => g.build.buildable(g, x, y))) { g.decor.push({ id: p.id, tx, ty }); done = true; }
              }
        }
      };
    });
    await page.waitForTimeout(300);
    const frames = (await page.evaluate(STATES[st].fn)) ?? 0;
    // Let the real loop run a little so animations settle.
    await page.waitForTimeout(Math.max(200, frames * 16));
    await page.screenshot({ path: `shots/ui/${sn}-${st}.png` });
    await page.close();
  }
  await ctx.close();
  // Contact sheet for this size.
  const imgs = stateNames.map((st) => `<figure><img src="data:image/png;base64,${readFileSync(`shots/ui/${sn}-${st}.png`).toString('base64')}"><figcaption>${st}</figcaption></figure>`).join('');
  const portrait = s.height > s.width;
  const cols = portrait ? 6 : 3;
  const cw = portrait ? 260 : 520;
  const sheet = await browser.newPage({ viewport: { width: cols * (cw + 8) + 8, height: 400 } });
  await sheet.setContent(`<style>body{margin:4px;background:#222;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:8px;font:12px sans-serif;color:#ddd}figure{margin:0}img{width:${cw}px;image-rendering:pixelated}</style>${imgs}`);
  await sheet.screenshot({ path: `shots/ui/sheet-${sn}.png`, fullPage: true });
  await sheet.close();
  console.log(`shots/ui/sheet-${sn}.png`);
}
await browser.close();
await server.close();
if (errors.length) {
  console.log('ERRORS');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
