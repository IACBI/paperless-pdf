import type { PDFDocumentProxy } from '../lib/pdfjs';
import { usePageThumbnail } from './usePageThumbnail';

interface PageThumbnailProps {
  doc: PDFDocumentProxy;
  /** 1-based page number within `doc`. */
  pageNumber: number;
  /** pdf.js scale; 1 is about 72 dpi. */
  scale: number;
  className?: string;
}

/**
 * A lazily rendered page preview. Decorative: the surrounding control carries
 * the accessible name, so the image has an empty alt.
 */
export default function PageThumbnail({ doc, pageNumber, scale, className }: PageThumbnailProps) {
  const { ref, url } = usePageThumbnail(doc, pageNumber, scale);
  return (
    <div ref={ref} className={className}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full animate-pulse bg-slate-100 motion-reduce:animate-none"
        />
      )}
    </div>
  );
}
