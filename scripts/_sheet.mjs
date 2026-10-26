import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [out, cols, scale, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 400 } });
await p.setContent(`<style>body{margin:4px;background:#222;display:grid;grid-template-columns:repeat(${cols},auto);gap:6px;font:12px sans-serif;color:#ddd;justify-content:start}img{image-rendering:pixelated}</style>` + files.map((f) => `<figure style="margin:0"><img style="zoom:${scale}" src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${f.split('/').pop()}</figcaption></figure>`).join(''));
await p.screenshot({ path: out, fullPage: true });
await b.close();
