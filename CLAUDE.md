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
    limits.ts       Resource limits for untrusted input. See "Resource limits".
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
  tools/        registry.ts (source of truth for features) + per-tool views.
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

Routing uses `HashRouter` (robust under any GitHub Pages base path) from
`react-router` v7 in library (declarative) mode, not framework mode. Vite `base`
is `'./'` (relative) for the same reason. v7 wraps navigations in
`startTransition`, so moving between tools keeps the current screen until the
lazy chunk loads; the Suspense fallback shows only on a cold deep link.

## Resource limits

Input is untrusted and processed on the user's own device, so a hostile or huge
file can exhaust memory or the canvas budget and freeze or crash the tab. All
limits live in `src/lib/limits.ts` (MAX_INPUT_BYTES, MAX_PAGE_COUNT,
MAX_TOTAL_*, MAX_RENDER_PIXELS, MAX_IMAGE_*) and throw `ResourceLimitError`,
whose message is safe to show in the UI.

- **Every rasterizing path must go through `renderPageToCanvas` in
  `src/lib/pdfjs.ts`**, which calls `assertRenderSize` before allocating. Do not
  create a canvas for a PDF page any other way.
- **Thumbnails go through `PageThumbnail` / `usePageThumbnail`**, which render
  lazily when scrolled into view and share one concurrency-limited queue. Do not
  render a page thumbnail directly in a component.
- **Every PDF load is guarded.** `loadPdf` in `pdfjs.ts` checks bytes and pages
  for pdf.js. The `lib/` pdf-lib helpers (`merge.ts`, `rotate.ts`, `split.ts`)
  call `assertInputSize` before `PDFDocument.load` and `assertPageCount` after,
  and merge also enforces the cumulative totals. Use `readPdfFile` in the tool
  views for the file-size check before reading bytes.
- **Images → PDF** (`imagesToPdf.ts`, `ImagesToPdfTool.tsx`) caps per-image bytes,
  image count, cumulative bytes, and embedded pixel dimensions.
- Check limits before allocation, not after. Show `userMessage(err, fallback)`
  in the UI so limit errors read clearly.
- Regression tests: `src/lib/limits.test.ts` and `tests/e2e/limits.spec.ts`.

## Content Security Policy and same-origin assets

`index.html` sets a CSP via a `<meta http-equiv>` tag: `default-src 'self'`,
`connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`,
`worker-src 'self' blob:`, `object-src 'none'`, `form-action 'none'`. The app
must work without `'unsafe-eval'`, which is why `loadPdf` sets
`isEvalSupported: false`.

New asset types (fonts, workers, wasm, language data) must stay same-origin under
`public/` or be bundled by Vite. Do not add a CDN origin to the CSP. If a new asset
truly needs one, that is a privacy-invariant decision to surface, not a quiet
CSP edit.

## Vendored OCR assets and pinned digests

`scripts/vendor-tesseract.mjs` downloads `eng.traineddata.gz` from an external
host and verifies it against a pinned SHA-256 (`TESSDATA_SHA256`) before it is
written into `public/tessdata/`. That digest is the trust anchor, so when you change
the traineddata file, recompute the SHA-256 from the new file and update the pin in
the same change. Never disable the check to make a download pass.

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

1. Add an entry to `src/tools/registry.ts` (id, path, title, blurb, icon, status).
2. Implement the core logic as a pure function in `src/lib/<tool>.ts`. Keep it
   DOM-free where possible and unit-test it.
3. Build the page/view under `src/tools/` (or `src/pages/`) and wire its route in
   `src/App.tsx`.
4. For heavy work, run the logic in a Web Worker under `src/workers/`.

## How to add an OCR language

1. Add its code to `LANGS` in `scripts/vendor-tesseract.mjs`, run
   `npm run vendor:ocr`, and pin the new file's SHA-256 in `TESSDATA_SHA256`.
2. Add an entry to `OCR_LANGUAGES` in `src/lib/ocrLanguages.ts`.

The file is vendored into `public/tessdata/` at build time. Do **not** fetch
traineddata from a remote CDN at runtime — that would break the offline guarantee
and the privacy invariant.

## Testing

- Runner: **Vitest** (`npm test`), jsdom environment.
- Required coverage: **merge** (`src/lib/merge.test.ts`) and **split**
  (`src/lib/split.test.ts`) logic. Tests build synthetic PDFs in-memory with
  `pdf-lib` — no fixtures needed and no network.
- Prefer testing `src/lib/` pure functions over UI.
- End-to-end: `npm run test:e2e` (Playwright, Chromium) runs against a production
  build. Test PDFs are generated in memory with `pdf-lib`.

## Conventions

- TypeScript strict mode. Pure logic in `lib/` returns `Uint8Array`.
- Tailwind v4 (CSS-first config in `src/index.css` via `@theme`).
- Accessibility matters: keyboard-operable, ARIA on progress/dialogs, visible
  focus rings, mobile-first layout.
- Run `npm run lint` and `npm test` before considering a change done.
