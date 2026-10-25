import { defineConfig } from 'vite';
import { pwa } from './scripts/pwa.mjs';

// Relative base so the static build works from any GitHub Pages sub-path.
// pwa(): manifest, icons drawn by the game's sprite code, service worker.
export default defineConfig({
  base: './',
  plugins: [pwa()],
  server: { port: 5173, host: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
