// The installable app, as a Vite plugin (vite.config.ts):
//
// - icons: drawn by the game's own sprite code (src/pwa/icon.ts) at build
//   time and written as PNGs into the build. The sprite code only fills
//   1x1 rects and copies canvases, so a tiny stand-in for a canvas lets it
//   run under Node; no image files live in the repository.
// - manifest.webmanifest: name, palette colours, full screen, any rotation.
// - sw.js: a service worker that keeps every file of this build for offline
//   play, under a cache named for the build. index.html is fetched from the
//   network first, so the next launch after a deploy gets the new build;
//   anything on another origin (the co-op relay) is left to the network.
// - the <link> tags for the manifest and icons, added to index.html.
//
// In dev the manifest and icons are served too (no service worker there:
// it would fight the dev server's module reloading).
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const ICONS = [
  { file: 'icons/icon-192.png', size: 192, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, purpose: 'any' },
  // Maskable: launchers crop to a circle or squircle, so keep a margin.
  { file: 'icons/maskable-512.png', size: 512, purpose: 'maskable', inset: 64 },
  { file: 'icons/apple-touch-icon.png', size: 180, apple: true },
  { file: 'icons/favicon-32.png', size: 32, favicon: true },
];

// ---- A canvas, as far as the sprite code needs one ----

class Ctx {
  constructor(c) {
    this.canvas = c;
    this.fill = [0, 0, 0, 255];
    this.imageSmoothingEnabled = false;
  }
  set fillStyle(v) {
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) throw new Error(`pwa icons: unsupported colour ${v}`);
    const n = parseInt(m[1], 16);
    this.fill = [n >> 16, (n >> 8) & 255, n & 255, 255];
  }
  get fillStyle() {
    return '#' + this.fill.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  fillRect(x, y, w, h) {
    const c = this.canvas;
    for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) c.data.set(this.fill, (yy * c.width + xx) * 4);
  }
  clearRect(x, y, w, h) {
    const c = this.canvas;
    for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) c.data.fill(0, (yy * c.width + xx) * 4, (yy * c.width + xx) * 4 + 4);
  }
  // drawImage(img, dx, dy) or (img, dx, dy, dw, dh): whole-number scaling,
  // nearest neighbour, transparent source pixels skipped.
  drawImage(img, dx, dy, dw = img.width, dh = img.height) {
    if (arguments.length > 5) throw new Error('pwa icons: drawImage with a source rect');
    const c = this.canvas;
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const tx = dx + x, ty = dy + y;
        if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) continue;
        const sx = Math.floor((x * img.width) / dw), sy = Math.floor((y * img.height) / dh);
        const si = (sy * img.width + sx) * 4;
        if (img.data[si + 3] === 0) continue;
        c.data.set(img.data.subarray(si, si + 4), (ty * c.width + tx) * 4);
      }
  }
  save() {}
  restore() {}
}

class Canvas {
  constructor() {
    this._w = 300;
    this._h = 150;
    this.data = new Uint8ClampedArray(this._w * this._h * 4);
  }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(v * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * v * 4); }
  getContext() {
    return (this.ctx ??= new Ctx(this));
  }
}

// ---- PNG ----

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
export function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Drawing the icons with the game's code ----

async function renderIcons() {
  const { runnerImport } = await import('vite');
  const had = globalThis.document;
  globalThis.document = { createElement: () => new Canvas() };
  try {
    const { module: icon } = await runnerImport(`${ROOT}src/pwa/icon.ts`, { configFile: false, logLevel: 'error', root: ROOT });
    const { module: pal } = await runnerImport(`${ROOT}src/palette.ts`, { configFile: false, logLevel: 'error', root: ROOT });
    const files = new Map();
    for (const ic of ICONS) {
      const c = new Canvas();
      c.width = ic.size;
      c.height = ic.size;
      icon.drawIcon(c.getContext('2d'), ic.size, ic.inset ?? 0);
      files.set(ic.file, png(ic.size, ic.size, c.data));
    }
    return { files, colors: pal.C };
  } finally {
    if (had === undefined) delete globalThis.document;
    else globalThis.document = had;
  }
}

function manifest(C) {
  return JSON.stringify(
    {
      name: 'Come By',
      short_name: 'Come By',
      description: 'A cozy pixel-art herding game: a blue heeler brings the animals home and the ranch grows into a valley.',
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'any',
      background_color: C.plum,
      theme_color: C.plum,
      categories: ['games'],
      icons: ICONS.filter((i) => i.purpose).map((i) => ({ src: i.file, sizes: `${i.size}x${i.size}`, type: 'image/png', purpose: i.purpose })),
    },
    null,
    2,
  );
}

function serviceWorker(version, files) {
  return `// Come By's service worker (generated by scripts/pwa.mjs for this build).
const CACHE = 'come-by-${version}';
const FILES = ${JSON.stringify(['./', ...files])};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('come-by-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only this site's own files; the co-op relay and anything else go
  // straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    // The page: network first (a new deploy shows on the next launch), the
    // kept copy when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./', { cacheName: CACHE, ignoreVary: true }).then((r) => r || caches.match(req, { ignoreSearch: true, ignoreVary: true }))),
    );
    return;
  }
  // Everything else is named for its contents: the kept copy first. (Vary
  // is ignored: a module script asks with an Origin header the kept copy
  // was not fetched with.)
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
`;
}

const linkTags = [
  { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'icons/favicon-32.png' }, injectTo: 'head' },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: 'icons/apple-touch-icon.png' }, injectTo: 'head' },
];

export function pwa() {
  let icons = null;
  const getIcons = () => (icons ??= renderIcons());
  return {
    name: 'come-by-pwa',
    enforce: 'post',
    transformIndexHtml: () => linkTags,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (path !== 'manifest.webmanifest' && !ICONS.some((i) => i.file === path)) return next();
        try {
          const { files, colors } = await getIcons();
          if (path === 'manifest.webmanifest') {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.end(manifest(colors));
          } else {
            res.setHeader('Content-Type', 'image/png');
            res.end(files.get(path));
          }
        } catch (err) {
          next(err);
        }
      });
    },
    generateBundle: {
      order: 'post', // after index.html is written
      async handler(_opts, bundle) {
        const { files, colors } = await getIcons();
        const extra = new Map(files);
        extra.set('manifest.webmanifest', manifest(colors));
        for (const [fileName, source] of extra) this.emitFile({ type: 'asset', fileName, source });
        // Every file of the build (bar the worker itself), and a version
        // that changes whenever any of them does.
        const names = [...new Set([...Object.keys(bundle), ...extra.keys()])].filter((f) => f !== 'sw.js').sort();
        const h = createHash('sha256');
        for (const f of names) {
          const b = bundle[f];
          const src = extra.get(f) ?? (b.type === 'chunk' ? b.code : b.source);
          h.update(f);
          h.update(typeof src === 'string' ? src : Buffer.from(src));
        }
        const version = h.digest('hex').slice(0, 12);
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(version, names) });
      },
    },
  };
}
