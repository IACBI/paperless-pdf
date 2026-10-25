import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { mergePdfs, type PageRef } from '../../lib/merge';
import { loadPdf, type PDFDocumentProxy } from '../../lib/pdfjs';
import { downloadBlob } from '../../lib/download';
import {
  assertCumulativeInputSize,
  assertCumulativePageCount,
  readPdfFile,
  userMessage,
} from '../../lib/limits';
import SortablePage, { type MergePage } from './SortablePage';

interface Source {
  name: string;
  /**
   * The File, not its bytes. pdf.js keeps its own copy of each document for the
   * session; the raw bytes are re-read only when the user merges.
   */
  file: File;
}

// Totals across every source currently loaded. Pages removed from the grid do
// not free budget: each loaded source keeps its pdf.js copy until reset.
function totals(sources: Source[], docs: Map<number, PDFDocumentProxy>) {
  let bytes = 0;
  let pages = 0;
  sources.forEach((s, i) => {
    bytes += s.file.size;
    pages += docs.get(i)?.numPages ?? 0;
  });
  return { bytes, pages };
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function readSource(source: Source): Promise<Uint8Array> {
  try {
    return await readPdfFile(source.file);
  } catch (e) {
    throw new Error(
      userMessage(e, `Could not re-read "${source.name}". It may have been moved or deleted.`),
    );
  }
}

export default function MergeTool() {
  // Sources live in a ref: page items reference them by index, and the index
  // must stay stable across re-renders and async thumbnail rendering.
  const sourcesRef = useRef<Source[]>([]);
  // pdf.js documents stay open so thumbnails can render on demand as tiles
  // scroll into view. Keyed by source index, destroyed on reset and unmount.
  const docsRef = useRef(new Map<number, PDFDocumentProxy>());
  const idCounter = useRef(0);
  // Bumped by reset and unmount. A load that resumes after either one has been
  // superseded and must release what it loaded instead of adding it.
  const disposed = useRef(false);
  const generation = useRef(0);

  const [pages, setPages] = useState<MergePage[]>([]);
  // Counts in-flight addFiles calls: a second drop while the first is still
  // loading must not clear the loading state the first one is holding.
  const [pendingLoads, setPendingLoads] = useState(0);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = pendingLoads > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const docs = docsRef.current;
    // StrictMode runs effects twice in development, so the flag is re-armed here.
    disposed.current = false;
    return () => {
      disposed.current = true;
      docs.forEach((doc) => doc.destroy());
      docs.clear();
    };
  }, []);

  async function addFiles(files: File[]) {
    const pdfs = files.filter(isPdf);
    if (pdfs.length === 0) {
      setError('Please choose PDF files.');
      return;
    }
    const current = generation.current;
    const isCurrent = () => !disposed.current && generation.current === current;
    setError(null);
    setPendingLoads((n) => n + 1);
    try {
      for (const file of pdfs) {
        let bytes: Uint8Array;
        let doc: PDFDocumentProxy;
        try {
          // Checked before reading, so a file that would blow the budget is never loaded.
          assertCumulativeInputSize(totals(sourcesRef.current, docsRef.current).bytes, file.size);
          bytes = await readPdfFile(file);
          if (!isCurrent()) return;
          doc = await loadPdf(bytes);
        } catch (e) {
          if (!isCurrent()) return;
          setError(userMessage(e, `Could not open "${file.name}". Is it a valid, unencrypted PDF?`));
          continue;
        }

        // Superseded while loading: this document was never registered, so release it here.
        if (!isCurrent()) {
          doc.destroy();
          return;
        }

        // Re-check against the totals now: other async work may have added files meanwhile.
        const totalNow = totals(sourcesRef.current, docsRef.current);
        try {
          assertCumulativeInputSize(totalNow.bytes, file.size);
          assertCumulativePageCount(totalNow.pages, doc.numPages);
        } catch (e) {
          doc.destroy();
          setError(userMessage(e, `Could not add "${file.name}".`));
          continue;
        }

        const sourceIndex = sourcesRef.current.length;
        sourcesRef.current.push({ name: file.name, file });
        docsRef.current.set(sourceIndex, doc);

        const newPages: MergePage[] = Array.from({ length: doc.numPages }, (_, p) => ({
          id: `s${sourceIndex}-p${p}-${idCounter.current++}`,
          sourceIndex,
          pageIndex: p,
          sourceName: file.name,
        }));
        setPages((prev) => [...prev, ...newPages]);
      }
    } catch (e) {
      if (isCurrent()) setError(userMessage(e, 'Could not open that PDF.'));
    } finally {
      // After reset the count was already zeroed, so a superseded call must not decrement it.
      if (isCurrent()) setPendingLoads((n) => n - 1);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((prev) => {
      const from = prev.findIndex((p) => p.id === active.id);
      const to = prev.findIndex((p) => p.id === over.id);
      return from === -1 || to === -1 ? prev : arrayMove(prev, from, to);
    });
  }

  function deletePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  function reset() {
    generation.current++;
    docsRef.current.forEach((doc) => doc.destroy());
    docsRef.current.clear();
    sourcesRef.current = [];
    setPendingLoads(0);
    setPages([]);
    setError(null);
  }

  async function handleMerge() {
    if (pages.length === 0) return;
    setMerging(true);
    setError(null);
    try {
      const order: PageRef[] = pages.map((p) => ({
        sourceIndex: p.sourceIndex,
        pageIndex: p.pageIndex,
      }));
      // Read at merge time: holding raw bytes for the whole session would double the memory budget.
      const inputs: Uint8Array[] = [];
      for (const source of sourcesRef.current) {
        inputs.push(await readSource(source));
      }
      const bytes = await mergePdfs(inputs, order);
      downloadBlob(bytes, 'merged.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed.');
    } finally {
      setMerging(false);
    }
  }

  const sourceCount = sourcesRef.current.length;

  return (
    <ToolShell toolId="merge">
      <FileDropzone
        accept="application/pdf"
        onFiles={addFiles}
        label="Drop PDFs here to merge"
        hint="or click to browse — add as many as you like"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {(pages.length > 0 || loading) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600" aria-live="polite">
              {pages.length} page{pages.length === 1 ? '' : 's'} from {sourceCount} file
              {sourceCount === 1 ? '' : 's'}
              {loading && (
                <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                  <Spinner className="h-3.5 w-3.5" /> loading…
                </span>
              )}
              . Drag to reorder; use the trash icon to delete.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reset} disabled={merging || loading}>
                Clear all
              </Button>
              <Button onClick={handleMerge} disabled={merging || loading || pages.length === 0}>
                {merging ? (
                  <>
                    <Spinner className="h-4 w-4" /> Merging…
                  </>
                ) : (
                  'Merge & download'
                )}
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pages.map((page, i) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    doc={docsRef.current.get(page.sourceIndex) as PDFDocumentProxy}
                    position={i + 1}
                    onDelete={deletePage}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </ToolShell>
  );
}
