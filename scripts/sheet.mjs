// A contact sheet of screenshots, to look at many at once:
//   node scripts/sheet.mjs out.png cols scale a.png b.png ...
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [out, cols, scale, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
const imgs = files.map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
const url = await p.evaluate(async ({ imgs, cols, scale }) => {
  const els = await Promise.all(imgs.map((s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
  const w = Math.round(els[0].width * scale), h = Math.round(els[0].height * scale);
  const rows = Math.ceil(els.length / cols);
  const c = document.createElement('canvas'); c.width = w * cols; c.height = h * rows;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
  els.forEach((e, k) => g.drawImage(e, (k % cols) * w, Math.floor(k / cols) * h, w, h));
  return c.toDataURL('image/png');
}, { imgs, cols: Number(cols), scale: Number(scale) });
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await b.close();
