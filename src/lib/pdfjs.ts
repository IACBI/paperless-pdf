import * as pdfjsLib from 'pdfjs-dist';
// Vite bundles the worker from our own node_modules and serves it same-origin.
// This keeps rendering fully local — no CDN, honoring the privacy invariant.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { assertInputSize, assertPageCount, assertRenderSize } from './limits';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

export type { PDFDocumentProxy };

/**
 * Load a PDF for rendering with pdf.js. We pass a copy of the bytes because
 * pdf.js transfers/detaches the underlying buffer. Size and page-count limits
 * are enforced here because every rendering path goes through this function.
 */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  assertInputSize(bytes.byteLength);
  // isEvalSupported:false keeps pdf.js from using `new Function` for PDF
  // functions, so the app's CSP does not need 'unsafe-eval'.
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    assertPageCount(doc.numPages);
  } catch (err) {
    doc.destroy();
    throw err;
  }
  return doc;
}

/**
 * Render one page of a loaded document to a canvas and return it. `scale`
 * controls resolution (1 ≈ 72dpi). Used for thumbnails and rasterization.
 * On failure the canvas bitmap is released before the error propagates.
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  let canvas: HTMLCanvasElement | null = null;
  let done = false;
  try {
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    // Checked before allocation: a hostile page box times the scale can request
    // a canvas large enough to exhaust memory.
    assertRenderSize(width, height);

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('renderPageToCanvas: 2D canvas context unavailable');

    await page.render({ canvasContext: context, viewport }).promise;
    done = true;
    return canvas;
  } finally {
    // Runs on success and failure alike; a page left unreleased keeps its
    // internal resources until the whole document is destroyed.
    page.cleanup();
    if (!done) releaseCanvas(canvas);
  }
}

/** Zeroing the size frees the bitmap now instead of at garbage collection. */
function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

/** Promise wrapper around canvas.toBlob (rejects if the browser returns null). */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      type,
      quality,
    );
  });
}

/**
 * Render a page straight to an encoded blob and release the canvas bitmap.
 * Thumbnail grids use this so rendered pixels do not pile up in memory; the
 * caller turns the blob into an object URL and revokes it when done.
 */
export async function renderPageToBlob(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  type = 'image/png',
): Promise<Blob> {
  const canvas = await renderPageToCanvas(doc, pageNumber, scale);
  try {
    return await canvasToBlob(canvas, type);
  } finally {
    releaseCanvas(canvas);
  }
}

/**
 * Render a page to a data URL (PNG by default) — convenient for <img> thumbnails.
 */
export async function renderPageToDataUrl(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale = 0.4,
  type = 'image/png',
): Promise<string> {
  const canvas = await renderPageToCanvas(doc, pageNumber, scale);
  try {
    return canvas.toDataURL(type);
  } finally {
    releaseCanvas(canvas);
  }
}
