// The camera on a phone held upright (CLOSE and WIDE): a flock on its way to
// an open pen, the dog behind it, from four sides and three distances. Counts
// how often the whole flock, and the pen's gate too, are on screen in the
// field above the thumbs, with the camera as it is and with the old lean
// (dog + 30% towards the flock) for comparison.
//   node scripts/cameratest.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.CAMERA_PORT || 5387);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
let failed = 0;
for (const view of ['close', 'wide']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.game);
  const r = await page.evaluate(async (view) => {
    const g = window.game;
    g.screen.setView(view);
    g.input.touchMode = true;
    g.tut = 99;
    const pen = g.ranch.pens[0];
    pen.open = true;
    const gate = pen.gatePoint(0);
    const old = function (dt) {
      const d = this.dog;
      let tx = d.x + d.vx * 0.35, ty = d.y + d.vy * 0.35;
      const gr = this.nearestGroup(110);
      if (gr) { tx += (gr.x - d.x) * 0.3; ty += (gr.y - d.y) * 0.3; }
      const { W, H } = this.screen, band = this.thumbBand();
      if (H > W) ty += band / 2;
      this.cam.x = tx; this.cam.y = ty; // settled
      this.cam.x = Math.max(W / 2, Math.min(this.cam.x, 9999));
    };
    const score = { flock: [0, 0], both: [0, 0], n: 0 };
    for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      for (const dist of [70, 120, 170]) {
        for (const [k, cam] of [['new', null], ['old', old]]) {
          g.animals.length = 0;
          const cx = gate.x + ux * dist, cy = gate.y + uy * dist;
          g.spawnFlock('duck', cx, cy, 6);
          g.dog.x = cx + ux * 36; g.dog.y = cy + uy * 36; g.dog.vx = g.dog.vy = 0;
          g.groups = (await import('/src/entities/animal.ts')).findGroups(g.animals);
          g.cam.x = g.dog.x; g.cam.y = g.dog.y;
          for (let i = 0; i < 240; i++) (cam ?? g.updateCamera).call(g, 1 / 60);
          const v = g.view(), band = g.thumbBand();
          const inside = (x, y, m) => x > v.ox + m && x < v.ox + v.W - m && y > v.oy + 24 && y < v.oy + v.H - band - m;
          const flock = g.animals.every((a) => inside(a.x, a.y, 4));
          const both = flock && inside(gate.x, gate.y, 4);
          const j = k === 'new' ? 0 : 1;
          if (flock) score.flock[j]++;
          if (both) score.both[j]++;
        }
        score.n++;
      }
    return { ...score, W: g.screen.W, H: g.screen.H };
  }, view);
  console.log(`${view} (${r.W}x${r.H}): whole flock on screen ${r.flock[0]}/${r.n} (old lean ${r.flock[1]}/${r.n}); flock and its gate ${r.both[0]}/${r.n} (old ${r.both[1]}/${r.n})`);
  if (r.flock[0] < r.n || r.both[0] < r.both[1]) failed++;
  await page.close();
}
await browser.close();
await server.close();
console.log(failed ? 'FAIL' : 'all passed');
process.exit(failed ? 1 : 0);
