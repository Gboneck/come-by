// Sniffing and digging up loot, end to end (src/systems/loot.ts): the day's
// dig spots are the same on every screen and new each morning (more after
// rain, fewer in winter, none on the ranch); standing still or walking
// slowly near one gives a scent (none at night or lying down); NIP digs only
// on a spot, not lying down and not with an animal at the nose (that gets
// nipped); what comes up is a seeded roll, so a spot holds the same for
// anyone; bones bury on the ranch and come back up aged; the old map's four
// pages lead to two lost animals, a hidden place and the hoard; the whistle
// and the bell do what they say; seeds and the fossil open decor, things to
// wear show on the look screen; it all survives a save (an old save starts
// with nothing), and a co-op guest's finds go to their own travels while the
// hole is everybody's. No Math.random anywhere in the loot code.
//   node scripts/loottest.mjs   (exits 1 on a failed check)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'node:fs';

const PORT = Number(process.env.LOOT_PORT || 5227);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  let s = 7;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  window.requestAnimationFrame = () => 0; // no live loop: every frame here is stepped by hand
});
await page.goto(`http://localhost:${PORT}/?debug`);
await page.evaluate(() => localStorage.clear());
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => window.game);
let failed = 0;
const check = (label, ok, info = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${info ? `  ${info}` : ''}`);
  if (!ok) failed++;
};

// No Math.random in the loot code (seeded runs must match).
for (const f of ['src/systems/loot.ts', 'src/art/loot.ts', 'src/ui/loot.ts']) check(`${f} never calls Math.random`, !/Math\.random\s*\(/.test(readFileSync(f, 'utf8')));

await page.evaluate(() => {
  window.T = {
    step(n) { for (let i = 0; i < n; i++) window.game.update(1 / 60); },
    clear() {
      const g = window.game;
      g.animals.length = 0;
      g.predators.length = 0;
      g.mode = 'play';
      g.day.phase = 'day';
      g.day.t = 30;
      g.tip = null;
      g.banner = null;
    },
    park(x, y) { const d = window.game.dog; d.x = x; d.y = y; d.vx = d.vy = 0; d.lying = false; },
    // Dig where the dog stands and let it finish.
    dig() {
      const g = window.game;
      const before = new Map(g.loot.got);
      if (!g.loot.dig(g)) return null;
      window.T.step(70);
      for (const [k, v] of g.loot.got) if ((before.get(k) ?? 0) < v) return k;
      return '';
    },
  };
});

// ---- Pictures first (before any snow): the scent, the dig ----
mkdirSync('shots', { recursive: true });
await page.evaluate(() => {
  const g = window.game, L = g.loot;
  window.T.clear();
  g.weather.set('clear');
  g.day.t = 120; // late morning
  const s = L.allSpots(g).find((p) => p.kind === 'near');
  window.T.park(s.x - 30, s.y - 4);
  window.T.step(50);
  g.tip = null;
  g.banner = null;
  g.render();
});
await page.screenshot({ path: 'shots/loot-scent.png' });
await page.evaluate(() => {
  const g = window.game, L = g.loot;
  const s = L.allSpots(g).find((p) => p.kind === 'near');
  window.T.park(s.x, s.y);
  L.dig(g);
  window.T.step(30);
  g.render();
});
await page.screenshot({ path: 'shots/loot-dig.png' });
await page.evaluate(() => {
  const g = window.game, L = g.loot;
  L.got.clear();
  L.dug.clear();
  L.bones = 0;
  L.pops = [];
  g.tipsSeen.delete('scent');
});

// ---- The day's spots ----
const spots = await page.evaluate(async () => {
  const g = window.game;
  window.T.clear();
  const { sharedSpots, spotOpen } = await import('/src/systems/loot.ts');
  const { Game } = await import('/src/game.ts');
  const key = (s) => s.map((p) => `${p.kind}@${p.x},${p.y}`).join(' ');
  const a = key(sharedSpots(g));
  const other = new Game(g.screen, g.input, {});
  other.day.day = g.day.day;
  other.season.set(g.season.season);
  other.weather.set(g.weather.sky);
  const b = key(sharedSpots(other));
  const day1 = sharedSpots(g);
  const allOpen = day1.every((s) => spotOpen(g.map, s.x, s.y));
  const noneOnRanch = day1.every((s) => g.map.regionAt(s.x, s.y)?.id !== 'ranch');
  const kinds = day1.map((s) => s.kind);
  g.day.day += 1;
  const c = key(sharedSpots(g));
  g.weather.set('rain');
  const wet = sharedSpots(g).length;
  g.weather.set('clear');
  const dry = sharedSpots(g).length;
  g.season.set('winter');
  const winter = sharedSpots(g).length;
  g.season.set('spring');
  g.day.day -= 1;
  const usable = g.loot.allSpots(g).length;
  return { same: a === b, changes: a !== c, allOpen, noneOnRanch, kinds, wet, dry, winter, usable, n: day1.length };
});
check('the day\'s spots are the same on another screen', spots.same);
check('and new the next morning', spots.changes);
check('every spot is on open grass, none on the ranch', spots.allOpen && spots.noneOnRanch, JSON.stringify(spots.kinds));
check('near, wild and rich spots each day', ['near', 'wild', 'rich'].every((k) => spots.kinds.includes(k)), JSON.stringify(spots.kinds));
check('more after rain, fewer in winter', spots.wet > spots.dry && spots.winter < spots.dry, `rain ${spots.wet} dry ${spots.dry} winter ${spots.winter}`);
check('at tier 1 only the open regions\' spots are offered', spots.usable > 0 && spots.usable < spots.n, `${spots.usable}/${spots.n}`);

// ---- Scent ----
const scent = await page.evaluate(() => {
  const g = window.game, L = g.loot;
  window.T.clear();
  const s = L.allSpots(g).find((p) => p.kind === 'near');
  window.T.park(s.x + 60, s.y);
  window.T.step(60);
  const still = { n: L.scent.length, k: L.scent[0]?.k ?? 0, sniff: L.sniffing, at: L.scent[0] ? Math.hypot(L.scent[0].x - s.x, L.scent[0].y - s.y) : -1 };
  const tip = g.tip?.text ?? '';
  g.dog.lying = true;
  L.update(g, 1 / 60);
  const lying = L.scent.length;
  g.dog.lying = false;
  g.day.phase = 'night';
  L.update(g, 1 / 60);
  const night = L.scent.length;
  g.day.phase = 'day';
  // Far off, running: nothing.
  window.T.park(s.x + 120, s.y);
  g.dog.vx = g.dog.stats.sprint;
  L.update(g, 1 / 60);
  const running = L.scent.filter((p) => p.x === s.x && p.y === s.y).length;
  g.dog.vx = 0;
  return { still, tip, lying, night, running, s };
});
check('standing near a spot, the dog picks up its scent and sniffs', scent.still.n > 0 && scent.still.at === 0 && scent.still.sniff > 0.6, JSON.stringify(scent.still));
check('the first scent says what to do', scent.tip.startsWith('A SCENT!'), scent.tip);
check('no scent lying down, or at night', scent.lying === 0 && scent.night === 0);
check('running past further off, no scent', scent.running === 0);

// ---- Digging ----
const dig = await page.evaluate(async () => {
  const g = window.game, L = g.loot;
  window.T.clear();
  const s = L.allSpots(g).find((p) => p.kind === 'near');
  window.T.park(s.x + 30, s.y);
  const off = { can: L.canDig(g), dug: L.dig(g) };
  window.T.park(s.x, s.y);
  window.T.step(2);
  const can = L.canDig(g);
  g.dog.lying = true;
  const lying = L.canDig(g);
  g.dog.lying = false;
  // An animal at its nose: that gets the nip.
  const { Animal } = await import('/src/entities/animal.ts');
  const a = new Animal('sheep', g.dog.x + g.dog.hx * 4, g.dog.y + g.dog.hy * 4 + 1, 0);
  g.animals.push(a);
  const nose = L.canDig(g);
  g.animals.length = 0;
  const c0 = g.coins;
  // What the spot holds, rolled for a fresh collection: the same twice.
  const { Loot } = await import('/src/systems/loot.ts');
  const p1 = new Loot().pick(g, s), p2 = new Loot().pick(g, s);
  const got = window.T.dig();
  const holes = L.holes(g).some((h) => h.x === s.x && h.y === s.y);
  const again = L.allSpots(g).some((p) => p.i === s.i);
  window.T.park(s.x, s.y);
  const twice = L.canDig(g);
  return { off, can, lying, nose, got, p1, p2, holes, again, twice, paid: g.coins - c0, banner: g.banner?.big, small: g.banner?.small, pops: L.pops.length };
});
check('off a spot, NIP is a nip (no bones to bury)', !dig.off.can && !dig.off.dug);
check('on a spot the dog can dig; not lying down; not with a sheep at its nose', dig.can && !dig.lying && !dig.nose, JSON.stringify(dig));
check('a spot holds the same find for anyone', dig.p1 === dig.p2 && dig.got === dig.p1, `${dig.p1} ${dig.p2} got ${dig.got}`);
check('"FOUND IT!" names the find', dig.banner === 'FOUND IT!' && !!dig.small, dig.small);
check('it leaves a hole, and the spot is gone for the day', dig.holes && !dig.again && !dig.twice);

// Dig every spot open today, for a feel of the haul.
const haul = await page.evaluate(() => {
  const g = window.game, L = g.loot;
  g.setTier(5, false);
  const out = [];
  const c0 = g.coins;
  for (const s of L.allSpots(g, false)) {
    window.T.clear();
    window.T.park(s.x, s.y);
    out.push(`${s.kind}:${window.T.dig()}`);
  }
  return { out, coins: g.coins - c0 };
});
check('a whole day dug turns up a find at every spot', haul.out.every((s) => !s.endsWith(':null') && !s.endsWith(':')), `${haul.out.join(' ')}  +${haul.coins}$`);

// ---- Bones ----
const bones = await page.evaluate(async () => {
  const g = window.game, L = g.loot;
  window.T.clear();
  L.grant(g, 'bone', g.dog.x, g.dog.y);
  const n0 = L.bones;
  const { regionById, TS } = await import('/src/world/map.ts');
  const r = regionById('ranch');
  window.T.park(r.cx * TS + 40, r.cy * TS + 40);
  const inRanch = g.inRanch();
  const buried = L.dig(g);
  window.T.step(50);
  const after = { bones: L.bones, buried: L.buried.length };
  const today = L.allSpots(g).some((s) => s.kind === 'bone');
  const at = { ...L.buried[0] };
  g.startDay();
  window.T.clear();
  window.T.park(at.x, at.y);
  g.dog.stamina = 1;
  const tomorrow = L.allSpots(g).some((s) => s.kind === 'bone');
  const got = window.T.dig();
  return { n0, inRanch, buried, after, today, tomorrow, got, left: L.buried.length, stamina: g.dog.stamina === g.dog.stats.stamina };
});
check('a bone dug up goes in the stash', bones.n0 >= 1);
check('NIP standing still on the ranch buries it', bones.inRanch && bones.buried && bones.after.buried === 1 && bones.after.bones === bones.n0 - 1, JSON.stringify(bones));
check('not ready the same day; dug up the next as a well-aged bone (full wind)', !bones.today && bones.tomorrow && bones.got === 'agedbone' && bones.left === 0 && bones.stamina);

// ---- The old map ----
const map = await page.evaluate(async () => {
  const g = window.game, L = g.loot;
  const { PAGES, HOARD_AT } = await import('/src/systems/loot.ts');
  window.T.clear();
  g.setTier(1, false);
  L.grant(g, 'page1', g.dog.x, g.dog.y);
  const lost1 = [...L.lost.values()];
  const ewe = [...L.lost.keys()][0];
  const p2t1 = L.allSpots(g).some((s) => s.kind === 'page');
  g.setTier(2, false);
  window.T.park(PAGES[1].at[0], PAGES[1].at[1]);
  const fog0 = g.discovery.fog.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  const got2 = window.T.dig();
  const fog1 = g.discovery.fog.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  g.setTier(3, false);
  window.T.clear();
  window.T.park(PAGES[2].at[0], PAGES[2].at[1]);
  const got3 = window.T.dig();
  const goat = [...L.lost.entries()].find(([, p]) => p === 2)?.[0]?.sp.id;
  g.setTier(4, false);
  window.T.clear();
  window.T.park(PAGES[3].at[0], PAGES[3].at[1]);
  const got4 = window.T.dig();
  window.T.clear();
  window.T.park(HOARD_AT[0], HOARD_AT[1]);
  const c0 = g.coins;
  const hoard = window.T.dig();
  return { lost1, ewe: ewe?.sp.id, p2t1, got2, opened: fog1 > fog0, got3, goat, got4, hoard, tag: L.has('tag-gold'), paid: g.coins - c0, pages: L.pages };
});
check('page one: a lost ewe waits in the old orchard', map.lost1.includes(0) && map.ewe === 'sheep');
check('the next page is not offered before its region opens', !map.p2t1);
check('page two, in the standing stones, shows a hidden place on the map', map.got2 === 'page2' && map.opened);
check('page three: a lost billy goat', map.got3 === 'page3' && map.goat === 'goat');
check('page four, then the hoard by the cairn: 100$ and a golden tag', map.got4 === 'page4' && map.hoard === 'hoard' && map.tag && map.paid >= 100, JSON.stringify(map));

// A lost animal brought home pays, and does not come back.
const home = await page.evaluate(() => {
  const g = window.game, L = g.loot;
  L.morning(g); // they wait where the map said each morning
  const [a] = [...L.lost.entries()].find(([, p]) => p === 0);
  const pen = g.ranch.pens[0];
  const c0 = g.coins;
  a.pen = pen;
  pen.animals.push(a);
  a.peakStress = 0.1;
  L.update(g, 1 / 60);
  const paid = g.coins - c0;
  const n = L.home.size;
  L.morning(g);
  const again = [...L.lost.values()].filter((p) => p === 0).length;
  return { paid, n, again };
});
check('a lost animal penned at home pays its bonus, and stays found', home.paid > 0 && home.n === 1 && home.again === 0, JSON.stringify(home));

// ---- Relics ----
const relics = await page.evaluate(async () => {
  const g = window.game, L = g.loot;
  window.T.clear();
  g.applyUpgrades();
  const r0 = g.dog.stats.barkRange;
  L.grant(g, 'whistle', g.dog.x, g.dog.y);
  const r1 = g.dog.stats.barkRange;
  const { Animal } = await import('/src/entities/animal.ts');
  const calm = (bell) => {
    window.T.clear();
    if (bell) L.got.set('bell', 1); else L.got.delete('bell');
    window.T.park(900, 900);
    const a = new Animal('sheep', 930, 900, 0);
    a.wanderer = false;
    a.stress = 0.6;
    g.animals.push(a);
    window.T.step(120);
    return a.stress;
  };
  return { r0, r1, without: calm(false), with: calm(true) };
});
check('the shepherd\'s whistle: the bark carries a tenth further', relics.r1 === Math.round(relics.r0 * 1.1), `${relics.r0} -> ${relics.r1}`);
check('the bellwether\'s bell: a flock near the dog settles quicker', relics.with < relics.without - 0.03, `with ${relics.with.toFixed(3)} without ${relics.without.toFixed(3)}`);

// ---- Decor and things to wear ----
const extras = await page.evaluate(async () => {
  const g = window.game, L = g.loot;
  const { PIECES, pieceIcon } = await import('/src/ui/decorbuild.ts');
  const ids = ['sunflowers', 'herbs', 'roses', 'sapling', 'fossil'];
  const seeds = ['seed-sunflower', 'seed-herbs', 'seed-roses', 'seed-apple', 'fossil'];
  for (const s of seeds) L.got.delete(s);
  const shut = ids.map((id) => PIECES.find((p) => p.id === id)?.open(g));
  for (const s of seeds) L.got.set(s, 1);
  const open = ids.map((id) => PIECES.find((p) => p.id === id)?.open(g));
  const icons = ids.every((id) => { const s = pieceIcon(id); return s.w > 3 && s.h > 3; });
  const { playerDogSprites } = await import('/src/art/dogstyle.ts');
  const plain = playerDogSprites({ speckle: 'classic', mask: 'both', saddle: false, tailTip: false, neck: 'bandana' });
  const dressed = playerDogSprites({ speckle: 'classic', mask: 'both', saddle: false, tailTip: false, neck: 'spotted', tag: 'gold', socks: true, blaze: true });
  const px = (s) => Array.from(s.img.getContext('2d').getImageData(0, 0, s.w, s.h).data).join(',');
  const differs = px(plain.poses.side.stand) !== px(dressed.poses.side.stand) && px(plain.poses.down.stand) !== px(dressed.poses.down.stand);
  const { readLook } = await import('/src/ui/look.ts');
  const back = readLook(JSON.parse(JSON.stringify({ dog: { neck: 'spotted', tag: 'brass', socks: true, blaze: false } }))).dog;
  const old = readLook({ dog: { neck: 'collar' } }).dog;
  return { shut, open, icons, differs, back, old };
});
check('seeds and the fossil open decor pieces, free', extras.shut.every((v) => v === false) && extras.open.every((v) => v === true) && extras.icons);
check('things to wear change the dog (spotted kerchief, tag, socks, blaze)', extras.differs);
check('a saved look keeps them; an old look gets none', extras.back.neck === 'spotted' && extras.back.tag === 'brass' && extras.back.socks && !extras.back.blaze && extras.old.tag === 'none' && !extras.old.socks);

// ---- Save, and an old save ----
const saved = await page.evaluate(async () => {
  const S = await import('/src/systems/save.ts');
  const { Game } = await import('/src/game.ts');
  const g = window.game, L = g.loot;
  window.T.clear();
  L.bones = 2;
  L.buried = [{ x: 700, y: 820, day: g.day.day }];
  const before = JSON.stringify(L.save());
  S.saveGame(g);
  const n = new Game(g.screen, g.input, {});
  S.loadInto(n);
  const after = JSON.stringify(n.loot.save());
  const whistle = n.dog.stats.barkRange === g.dog.stats.barkRange;
  const k = 'comeby-save-v1';
  const d = JSON.parse(localStorage.getItem(k));
  delete d.loot;
  localStorage.setItem(k, JSON.stringify(d));
  const o = new Game(g.screen, g.input, {});
  S.loadInto(o);
  return { same: before === after, whistle, oldGot: o.loot.got.size, oldBones: o.loot.bones, a: before.length, b: after.length };
});
check('a save keeps the collection, bones, buried bones and holes', saved.same && saved.whistle, JSON.stringify(saved));
check('an old save starts with nothing dug up', saved.oldGot === 0 && saved.oldBones === 0);

// ---- Co-op: a guest digs ----
const coop = await page.evaluate(async () => {
  const { Game } = await import('/src/game.ts');
  const { sharedIn, sharedOut } = await import('/src/net/shared.ts');
  const host = window.game;
  window.T.clear();
  host.setTier(1, false);
  const guest = new Game(host.screen, host.input, {});
  guest.day.day = host.day.day;
  guest.season.set(host.season.season);
  guest.weather.set(host.weather.sky);
  guest.setTier(host.tier, false);
  sharedIn(guest, JSON.parse(JSON.stringify(sharedOut(host))));
  guest.net = { role: 'guest' };
  guest.animals.length = 0; // its own starting flock could be at the dog's nose
  const s = guest.loot.allSpots(guest).find((p) => p.kind === 'near' || p.kind === 'wild');
  if (!s) return { none: true };
  guest.dog.x = s.x;
  guest.dog.y = s.y;
  guest.dog.vx = guest.dog.vy = 0;
  guest.mode = 'play';
  const gave = [];
  const started = guest.loot.dig(guest, (id, coins) => gave.push([id, coins]));
  for (let i = 0; i < 70; i++) guest.loot.update(guest, 1 / 60);
  const hostCoins = host.coins;
  // The host hears of the dig and marks the hole for everyone.
  const marked = host.loot.digBy(host, s.x, s.y);
  const again = host.loot.digBy(host, s.x, s.y); // a second nip mid-dig stays a dig
  const nowhere = host.loot.digBy(host, s.x + 300, s.y + 300);
  const hostSees = host.loot.holes(host).some((h) => h.x === s.x && h.y === s.y);
  const other = new Game(host.screen, host.input, {});
  other.day.day = host.day.day;
  other.season.set(host.season.season);
  other.weather.set(host.weather.sky);
  sharedIn(other, JSON.parse(JSON.stringify(sharedOut(host))));
  const otherSees = other.loot.holes(other).some((h) => h.x === s.x && h.y === s.y);
  // No bones buried on the friend's ranch.
  guest.loot.bones = 1;
  guest.dog.x += 200;
  const buries = guest.loot.dig(guest);
  guest.net = null;
  return { started, gave, marked, again, nowhere, hostSees, otherSees, hostCoins: host.coins - hostCoins, buries };
});
check('a guest digs a spot; the find goes to their own save', coop.started && coop.gave.length === 1, JSON.stringify(coop));
check('the host marks the hole, and every screen shows it', coop.marked && coop.again && !coop.nowhere && coop.hostSees && coop.otherSees);
check('nothing paid into the host\'s ranch; no burying on a friend\'s ranch', coop.hostCoins === 0 && !coop.buries);

const wire = await page.evaluate(async () => {
  const { Writer, Reader, writeDog, readDog } = await import('/src/net/protocol.ts');
  const { puppetAct } = await import('/src/systems/loot.ts');
  const { Dog } = await import('/src/entities/dog.ts');
  const send = (sniff, dig) => {
    const w = new Writer();
    writeDog(w, 1, { x: 10, y: 20, vx: 0, vy: 0, hx: 1, hy: 0, face: 0, lying: false, sprint: false, sniff, dig }, []);
    const r = new Reader(w.bytes());
    r.u8();
    r.u8();
    const { dog } = readDog(r);
    return [dog.sniff, dog.dig, dog.lying, dog.sprint];
  };
  const d = new Dog(0, 0);
  puppetAct(d, true, true, 1 / 60);
  const start = [d.sniff, d.dig];
  for (let i = 0; i < 30; i++) puppetAct(d, false, true, 1 / 60);
  const mid = d.dig;
  for (let i = 0; i < 60; i++) puppetAct(d, false, false, 1 / 60);
  return { a: send(true, false), b: send(false, true), start, mid, end: d.dig, sniffEnd: d.sniff };
});
check('a guest\'s dog sends its sniff and dig with its other flags', JSON.stringify(wire.a) === '[true,false,false,false]' && JSON.stringify(wire.b) === '[false,true,false,false]', JSON.stringify(wire));
check('a friend\'s dog digs from 0.9s when its bit comes on, nose down while sniffing', wire.start[0] === 1 && wire.start[1] === 0.9 && wire.mid > 0.35 && wire.mid < 0.45 && wire.end === 0 && wire.sniffEnd === 0);

const travels = await page.evaluate(async () => {
  const { Travels, mergeTravels } = await import('/src/net/travels.ts');
  const g = window.game, L = g.loot;
  localStorage.removeItem('comeby-travels-v1');
  const t = new Travels();
  L.got.delete('thimble');
  t.addLoot('thimble', 0);
  t.addLoot('oldcoin', 8);
  const c0 = g.coins, n0 = L.got.get('oldcoin') ?? 0;
  mergeTravels(g);
  const tip = g.tip?.text ?? '';
  const twice = (mergeTravels(g), g.coins - c0);
  return { thimble: L.has('thimble'), oldcoin: (L.got.get('oldcoin') ?? 0) - n0, paid: g.coins - c0, twice, tip };
});
check('back home, the travels\' finds join the collection and pay', travels.thimble && travels.oldcoin === 1 && travels.paid === 8 && travels.twice === 8, JSON.stringify(travels));
check('and the tip says so', travels.tip.includes('2 FINDS'), travels.tip);

// ---- The FINDS page ----
await page.evaluate(() => {
  const g = window.game;
  window.T.step(30);
  g.loot.sel = 5;
  g.openLedger('finds');
  g.render();
});
await page.screenshot({ path: 'shots/loot-finds.png' });
// And on a phone, held upright.
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => new Promise((ok) => setTimeout(ok, 100)));
await page.evaluate(() => window.game.render());
await page.screenshot({ path: 'shots/loot-finds-phone.png' });

if (errors.length) { console.log('ERRORS', errors); failed++; }
await browser.close();
await server.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
