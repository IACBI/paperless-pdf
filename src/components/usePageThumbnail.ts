import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PDFDocumentProxy } from '../lib/pdfjs';
import { renderPageToBlob } from '../lib/pdfjs';
import { createTaskQueue } from '../lib/taskQueue';

/**
 * Shared by every thumbnail on the page. Two renders at a time is enough to
 * keep the UI responsive without queuing a full document's worth of work.
 */
const renderQueue = createTaskQueue(2);

/** Render when the tile is this close to the viewport. */
const RENDER_MARGIN = '200px';
/**
 * Release the image only this far away. Scrolling back and forth around the
 * render edge keeps the image, and only tiles well out of sight free memory.
 */
const UNLOAD_MARGIN = '1500px';

interface Rendered {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  href: string;
}

/**
 * Renders a page thumbnail while its element is near the viewport, and
 * releases it again once the element is far away. Returns a ref to attach to
 * the element and an object URL (null until ready).
 *
 * Falls back to rendering immediately where IntersectionObserver is missing,
 * such as jsdom and very old browsers; the concurrency limit still applies.
 */
export function usePageThumbnail(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): { ref: RefObject<HTMLDivElement>; url: string | null } {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [far, setFar] = useState(false);
  const [rendered, setRendered] = useState<Rendered | null>(null);

  // A render from earlier inputs must not be shown for the new ones.
  const url =
    rendered &&
    rendered.doc === doc &&
    rendered.pageNumber === pageNumber &&
    rendered.scale === scale
      ? rendered.href
      : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      setFar(true);
      return;
    }
    const nearObserver = new IntersectionObserver(
      (entries) => setNear(entries.some((entry) => entry.isIntersecting)),
      // Start a little early so the image is usually ready when it scrolls in.
      { rootMargin: RENDER_MARGIN },
    );
    const farObserver = new IntersectionObserver(
      (entries) => setFar(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: UNLOAD_MARGIN },
    );
    nearObserver.observe(el);
    farObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      farObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!near || url) return;
    const task = renderQueue.schedule(() => renderPageToBlob(doc, pageNumber, scale));
    // A tile that just came into view should not wait behind renders queued
    // earlier, which are often for tiles that have since scrolled away.
    task.bump();
    let stale = false;
    task.promise.then(
      (blob) => {
        // The tile left the viewport or the inputs changed while this render
        // ran. No object URL is created, so the blob is simply dropped.
        if (stale) return;
        setRendered({ doc, pageNumber, scale, href: URL.createObjectURL(blob) });
      },
      () => {
        // Failed or cancelled: the tile keeps its placeholder.
      },
    );
    return () => {
      stale = true;
      // Cancels only if still queued; a running render finishes and is discarded above.
      task.cancel();
    };
  }, [near, url, doc, pageNumber, scale]);

  useEffect(() => {
    if (!far) setRendered(null);
  }, [far]);

  // Revoke when replaced, released, or unmounted so the blob can be collected.
  useEffect(() => {
    if (!rendered) return;
    return () => URL.revokeObjectURL(rendered.href);
  }, [rendered]);

  return { ref, url };
}
