import * as pdfjsLib from 'pdfjs-dist';
// Vite bundles the worker from our own node_modules and serves it same-origin.
// This keeps rendering fully local — no CDN, honoring the privacy invariant.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

export type { PDFDocumentProxy };

/**
 * Load a PDF for rendering with pdf.js. We pass a copy of the bytes because
 * pdf.js transfers/detaches the underlying buffer.
 */
export function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: bytes.slice() }).promise;
}

/**
 * Render one page of a loaded document to a canvas and return it. `scale`
 * controls resolution (1 ≈ 72dpi). Used for thumbnails and rasterization.
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('renderPageToCanvas: 2D canvas context unavailable');

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
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
 * Render a page to a data URL (PNG by default) — convenient for <img> thumbnails.
 */
export async function renderPageToDataUrl(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale = 0.4,
  type = 'image/png',
): Promise<string> {
  const canvas = await renderPageToCanvas(doc, pageNumber, scale);
  return canvas.toDataURL(type);
}
