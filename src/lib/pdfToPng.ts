import { loadPdf, renderPageToCanvas, canvasToBlob } from './pdfjs';

export interface RenderedPage {
  /** 0-based page index. */
  index: number;
  blob: Blob;
}

/**
 * Render selected pages of a PDF to PNG blobs at the given scale (1 ≈ 72dpi;
 * 2 ≈ 144dpi). `onProgress` reports completed/total. Requires a DOM canvas,
 * so this runs on the main thread / in a component, not a plain unit test.
 */
export async function pdfPagesToPng(
  bytes: Uint8Array,
  indices: number[],
  scale = 2,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPage[]> {
  const doc = await loadPdf(bytes);
  try {
    const results: RenderedPage[] = [];
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const canvas = await renderPageToCanvas(doc, index + 1, scale);
      results.push({ index, blob: await canvasToBlob(canvas, 'image/png') });
      onProgress?.(i + 1, indices.length);
    }
    return results;
  } finally {
    doc.destroy();
  }
}
