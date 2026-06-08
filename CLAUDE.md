# CLAUDE.md — paperless-pdf

Guidance for working in this repository. Read this before adding features.

## What this is

A **fully client-side, privacy-first PDF toolkit** web app. Users merge, split,
compress, convert, rotate, and OCR PDFs. Everything runs in the browser with
JavaScript/WebAssembly. There is no backend.

## The privacy invariant (non-negotiable)

> **No file ever leaves the browser.** All processing is local. No backend, no
> uploads, no analytics, no third-party requests carrying user data.

This is the product. Every change must preserve it. Concretely:

- **No network calls with user data.** Never `fetch`/`XHR`/`WebSocket`/`sendBeacon`
  a user's file, file bytes, derived images, or extracted text anywhere. The only
  network requests allowed are for the app's own static assets, served from the
  same origin.
- **No analytics or telemetry.** No Google Analytics, Sentry, PostHog, ads, or any
  SDK that phones home. Do not add one "just for errors".
- **All engines run in-browser.** `pdf-lib`, `pdf.js`, and `tesseract.js` all run
  locally. OCR's WebAssembly core, worker, and language data are **self-hosted**
  under `public/` — never loaded from a CDN — so OCR works fully offline and makes
  zero third-party requests. See `src/lib/ocr.ts`.
- **Output stays local.** Results are returned to the user only via local blob
  downloads (`src/lib/download.ts`). Nothing is persisted server-side because there
  is no server.
- **PWA caching is same-origin only.** The service worker precaches our own assets
  for offline use; it must not proxy or upload anything.

If a feature seems to require a server, it does not belong here. Surface the
conflict instead of weakening the invariant.

## Architecture

```
src/
  lib/          Pure, framework-free PDF logic. No React imports. Unit-tested.
    pdfjs.ts        Configured pdf.js instance (local worker), render helpers.
    download.ts     Uint8Array/Blob -> browser download. The only "output" path.
    merge.ts        mergePdfs() via pdf-lib copyPages.
    split.ts        splitByRanges() + the page-range string parser.
    rotate.ts       rotatePages() via page.setRotation(degrees()).
    imagesToPdf.ts  embedJpg/embedPng + drawImage.
    pdfToPng.ts     pdf.js render page -> canvas -> PNG blob.
    compress.ts     Rasterize pipeline (see "Compress" below).
    ocr.ts          Per-page OCR -> searchable PDF, self-hosted assets.
  workers/      Web Workers for heavy ops (compress, OCR) with progress messages.
  components/   Reusable UI (dropzone, page grid w/ dnd, progress, privacy banner…).
  tools/        registry.tsx (source of truth for features) + per-tool views.
  pages/        Home and the routed tool pages.
public/
  tesseract/    Self-hosted tesseract worker.min.js + tesseract-core wasm.
  tessdata/     eng.traineddata (bundled) + any on-demand languages.
```

**Separation of concerns:** all PDF manipulation lives in `src/lib/` as pure
functions that take/return bytes (`Uint8Array`) and are unit-testable without a
DOM. UI components call into `lib/`. Long operations report progress via an
`onProgress(done, total)` callback so the UI can show a progress bar.

**Threading:** rasterizing operations (compress, PDF→PNG) run on the main thread
and `await` between pages, which yields to the event loop and keeps the UI
responsive while progress updates. They are *not* in a Web Worker because pdf.js
rendering there needs `OffscreenCanvas` plus a nested pdf.js worker, which is
fragile across browsers. OCR is the exception: `tesseract.js` manages its own
worker, so that heavy work is already off the main thread.

Routing uses `HashRouter` (robust under any GitHub Pages base path). Vite `base`
is `'./'` (relative) for the same reason.

## Library responsibilities & verified APIs

Use **only real, maintained APIs**. If you are unsure an API exists, add a
`// TODO:` with a link to the official docs rather than guessing.

| Concern              | Library        | Key API (verified)                                              |
| -------------------- | -------------- | --------------------------------------------------------------- |
| Create/modify PDFs   | `pdf-lib`      | `PDFDocument.load/create`, `copyPages`, `addPage`, `save`       |
| Merge / split        | `pdf-lib`      | `copyPages(src, indices)` → `addPage`                           |
| Rotate               | `pdf-lib`      | `page.setRotation(degrees(n))`                                  |
| Images → PDF         | `pdf-lib`      | `embedJpg` / `embedPng` → `page.drawImage`                      |
| Thumbnails / render  | `pdf.js`       | `getDocument`, `page.render({ canvasContext, viewport })`       |
| PDF page → PNG       | `pdf.js`       | render to `<canvas>` → `canvas.toBlob('image/png')`             |
| OCR → searchable PDF | `tesseract.js` | `createWorker(langs, oem, { workerPath, corePath, langPath })`; `worker.recognize(img, opts, { pdf: true })` → `res.data.pdf` |

**`pdf-lib` cannot downsample/re-encode images** — there is no compression API.
This is why **Compress** rasterizes each page with `pdf.js` to a canvas, re-encodes
it as a lower-DPI/quality JPEG, and rebuilds the PDF with `pdf-lib` `embedJpg`. The
tradeoff: page text becomes an image (no longer selectable). The UI states this and
suggests running OCR afterward to restore a text layer.

**`tesseract.js` searchable PDF**: the old `getPDF` helper was removed in v4; use
the `{ pdf: true }` recognize option, which returns PDF bytes in `res.data.pdf`.
Per-page PDFs are merged into one document with `pdf-lib`.

## PWA / offline

Configured via `vite-plugin-pwa` in `vite.config.ts` (`registerType: 'autoUpdate'`).
Workbox precaches the app shell plus the OCR engine and language data
(`globPatterns` includes `wasm` and `gz`; `maximumFileSizeToCacheInBytes` is raised
for the ~4MB core) so every tool, including OCR, works offline after first load. The
service worker is same-origin only — it must never proxy or upload anything. Icons and
manifest live in `public/` (`icon.svg`, `favicon.svg`).

## How to add a new tool

1. Add an entry to `src/tools/registry.tsx` (id, path, title, blurb, icon, status).
2. Implement the core logic as a pure function in `src/lib/<tool>.ts`. Keep it
   DOM-free where possible and unit-test it.
3. Build the page/view under `src/tools/` (or `src/pages/`) and wire its route in
   `src/App.tsx`.
4. For heavy work, run the logic in a Web Worker under `src/workers/`.

## How to add an OCR language

Drop the `<lang>.traineddata` file into `public/tessdata/` and register it in the
language picker. Do **not** fetch traineddata from a remote CDN — that would break
the offline guarantee and the privacy invariant.

## Testing

- Runner: **Vitest** (`npm test`), jsdom environment.
- Required coverage: **merge** (`src/lib/merge.test.ts`) and **split**
  (`src/lib/split.test.ts`) logic. Tests build synthetic PDFs in-memory with
  `pdf-lib` — no fixtures needed and no network.
- Prefer testing `src/lib/` pure functions over UI.

## Conventions

- TypeScript strict mode. Pure logic in `lib/` returns `Uint8Array`.
- Tailwind v4 (CSS-first config in `src/index.css` via `@theme`).
- Accessibility matters: keyboard-operable, ARIA on progress/dialogs, visible
  focus rings, mobile-first layout.
- Run `npm run lint` and `npm test` before considering a change done.
