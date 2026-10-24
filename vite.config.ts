import { defineConfig } from 'vite';

// Relative base so the static build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
