// Crop a region of a PNG and scale it up with nearest-neighbour, for
// inspecting pixel art:  node scripts/zoom.mjs in.png out.png x y w h scale
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [, , src, out, x, y, w, h, scale = '2'] = process.argv;
const s = Number(scale);
const b64 = readFileSync(src).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.round(w * s), height: Math.round(h * s) } });
await page.setContent(
  `<body style="margin:0;overflow:hidden"><canvas id="c" width="${w * s}" height="${h * s}"></canvas>
   <script>
     const img = new Image();
     img.onload = () => {
       const g = document.getElementById('c').getContext('2d');
       g.imageSmoothingEnabled = false;
       g.drawImage(img, ${x}, ${y}, ${w}, ${h}, 0, 0, ${w * s}, ${h * s});
       document.title = 'done';
     };
     img.src = 'data:image/png;base64,${b64}';
   </script></body>`,
);
await page.waitForFunction(() => document.title === 'done');
await page.screenshot({ path: out });
await browser.close();
