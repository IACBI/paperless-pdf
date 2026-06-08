import { PDFDocument } from 'pdf-lib';

/** A single page selected from a source document, used to build the merge order. */
export interface PageRef {
  /** Index into the `sources` array passed to {@link mergePdfs}. */
  sourceIndex: number;
  /** 0-based page index within that source document. */
  pageIndex: number;
}

/**
 * Merge pages from one or more source PDFs into a single document, in the
 * exact order given by `order`. Omitting a page from `order` deletes it;
 * repeating a page duplicates it; reordering entries reorders pages.
 *
 * Pure and runs entirely in-browser (pdf-lib). Returns the new PDF as bytes.
 *
 * @param sources Raw bytes of each input PDF.
 * @param order   The pages to include, in output order. Defaults to every
 *                page of every source, in source order.
 */
export async function mergePdfs(
  sources: Uint8Array[],
  order?: PageRef[],
): Promise<Uint8Array> {
  if (sources.length === 0) {
    throw new Error('mergePdfs: at least one source PDF is required');
  }

  const loaded = await Promise.all(
    sources.map((bytes) => PDFDocument.load(bytes)),
  );

  const pages: PageRef[] =
    order ??
    loaded.flatMap((doc, sourceIndex) =>
      doc.getPageIndices().map((pageIndex) => ({ sourceIndex, pageIndex })),
    );

  const out = await PDFDocument.create();

  // Group consecutive refs by source so we can batch copyPages calls, but still
  // honor arbitrary cross-document ordering and duplication.
  for (const { sourceIndex, pageIndex } of pages) {
    const src = loaded[sourceIndex];
    if (!src) {
      throw new Error(`mergePdfs: invalid sourceIndex ${sourceIndex}`);
    }
    if (pageIndex < 0 || pageIndex >= src.getPageCount()) {
      throw new Error(
        `mergePdfs: page ${pageIndex} out of range for source ${sourceIndex} ` +
          `(has ${src.getPageCount()} pages)`,
      );
    }
    const [copied] = await out.copyPages(src, [pageIndex]);
    out.addPage(copied);
  }

  if (out.getPageCount() === 0) {
    throw new Error('mergePdfs: resulting document has no pages');
  }

  return out.save();
}
