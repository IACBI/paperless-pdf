import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the app works both at a domain root and under a
// GitHub Pages project subpath (e.g. /paperless-pdf/). Routing uses
// HashRouter, which keeps deep links working under any base.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'paperless-pdf — private PDF toolkit',
        short_name: 'paperless-pdf',
        description:
          'A fully client-side, privacy-first PDF toolkit. No file ever leaves your browser.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell AND the OCR engine/data so everything —
        // including OCR — works offline after the first load.
        globPatterns: ['**/*.{js,css,html,svg,wasm,gz}'],
        // The largest tesseract core is ~4MB; raise the per-file cache limit.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Unit tests live in src/; Playwright owns tests/e2e (which use *.spec.ts too).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
