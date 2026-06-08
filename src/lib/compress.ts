import { PDFDocument } from 'pdf-lib';
import { loadPdf, renderPageToCanvas, canvasToBlob } from './pdfjs';

export interface CompressOptions {
  /** Target raster resolution in DPI (72 = original points, 150 ≈ good screen). */
  dpi: number;
  /** JPEG quality 0..1. Lower = smaller file, more artifacts. */
  quality: number;
}

/**
 * "Compress" a PDF by rasterizing each page and re-encoding it as a JPEG at a
 * lower resolution/quality, then rebuilding the document. This is the only
 * fully client-side way to shrink image-heavy PDFs, because pdf-lib cannot
 * re-encode images in place (see CLAUDE.md). Tradeoff: pages become images, so
 * any selectable text is lost — run OCR afterward to restore a text layer.
 *
 * Each output page keeps the original page's dimensions (in points); only the
 * raster resolution changes. Runs on the main thread, yielding between pages,
 * and reports progress via `onProgress`.
 */
export async function compressPdf(
  bytes: Uint8Array,
  options: CompressOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { dpi, quality } = options;
  if (dpi <= 0) throw new Error('compressPdf: dpi must be positive');
  if (quality <= 0 || quality > 1) throw new Error('compressPdf: quality must be in (0, 1]');

  const scale = dpi / 72;
  const src = await loadPdf(bytes);
  try {
    const out = await PDFDocument.create();
    const total = src.numPages;

    for (let i = 0; i < total; i++) {
      const canvas = await renderPageToCanvas(src, i + 1, scale);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      const jpg = new Uint8Array(await blob.arrayBuffer());
      const image = await out.embedJpg(jpg);

      // Convert raster pixels back to PDF points so the page keeps its size.
      const widthPt = canvas.width / scale;
      const heightPt = canvas.height / scale;
      const page = out.addPage([widthPt, heightPt]);
      page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });

      onProgress?.(i + 1, total);
    }

    return out.save();
  } finally {
    src.destroy();
  }
}
