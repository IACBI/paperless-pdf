import { createWorker, type LoggerMessage } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { loadPdf, renderPageToCanvas } from './pdfjs';

// All Tesseract assets are self-hosted under public/ (see scripts/vendor-tesseract.mjs)
// and served same-origin. Nothing is fetched from a CDN — this is what keeps OCR
// fully offline and within the privacy invariant (CLAUDE.md).
const BASE = import.meta.env.BASE_URL;
const WORKER_PATH = `${BASE}tesseract/worker.min.js`;
const CORE_PATH = `${BASE}tesseract`;
const LANG_PATH = `${BASE}tessdata`;

export interface OcrProgress {
  /** 1-based page being processed. */
  page: number;
  total: number;
  /** Overall completion 0..1 across all pages. */
  fraction: number;
  stage: 'rendering' | 'recognizing';
}

export interface OcrOptions {
  /** Language code matching a vendored traineddata file, e.g. "eng". */
  lang: string;
  /** Render scale before OCR (2 ≈ 144dpi); higher is more accurate but slower. */
  scale?: number;
}

/**
 * OCR a (typically scanned) PDF and return a new PDF with an invisible,
 * selectable/searchable text layer over each page. Uses tesseract.js's
 * `{ pdf: true }` recognize output per page, then merges the per-page PDFs
 * with pdf-lib. Runs entirely in-browser; tesseract.js does the heavy work in
 * its own Web Worker.
 */
export async function ocrToSearchablePdf(
  bytes: Uint8Array,
  options: OcrOptions,
  onProgress?: (p: OcrProgress) => void,
): Promise<Uint8Array> {
  const { lang, scale = 2 } = options;
  const src = await loadPdf(bytes);
  const total = src.numPages;

  let currentPage = 1;
  const worker = await createWorker(lang, 1, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    logger: (m: LoggerMessage) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          page: currentPage,
          total,
          stage: 'recognizing',
          fraction: (currentPage - 1 + m.progress) / total,
        });
      }
    },
  });

  try {
    const merged = await PDFDocument.create();
    for (let i = 0; i < total; i++) {
      currentPage = i + 1;
      onProgress?.({ page: currentPage, total, stage: 'rendering', fraction: i / total });

      const canvas = await renderPageToCanvas(src, currentPage, scale);
      const { data } = await worker.recognize(canvas, {}, { pdf: true });
      if (!data.pdf) throw new Error('OCR did not return PDF output.');

      const pagePdf = await PDFDocument.load(new Uint8Array(data.pdf));
      const copied = await merged.copyPages(pagePdf, pagePdf.getPageIndices());
      copied.forEach((p) => merged.addPage(p));

      onProgress?.({ page: currentPage, total, stage: 'recognizing', fraction: (i + 1) / total });
    }
    return merged.save();
  } finally {
    await worker.terminate();
    src.destroy();
  }
}
