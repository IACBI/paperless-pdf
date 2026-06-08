import { useRef, useState } from 'react';
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
import { loadPdf, renderPageToDataUrl } from '../../lib/pdfjs';
import { downloadBlob } from '../../lib/download';
import SortablePage, { type MergePage } from './SortablePage';

interface Source {
  name: string;
  bytes: Uint8Array;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export default function MergeTool() {
  // Sources live in a ref: page items reference them by index, and the index
  // must stay stable across re-renders and async thumbnail rendering.
  const sourcesRef = useRef<Source[]>([]);
  const idCounter = useRef(0);

  const [pages, setPages] = useState<MergePage[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function addFiles(files: File[]) {
    const pdfs = files.filter(isPdf);
    if (pdfs.length === 0) {
      setError('Please choose PDF files.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      for (const file of pdfs) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sourceIndex = sourcesRef.current.length;
        sourcesRef.current.push({ name: file.name, bytes });

        let doc;
        try {
          doc = await loadPdf(bytes);
        } catch {
          sourcesRef.current.pop();
          setError(`Could not open "${file.name}". Is it a valid, unencrypted PDF?`);
          continue;
        }

        const newPages: MergePage[] = Array.from({ length: doc.numPages }, (_, p) => ({
          id: `s${sourceIndex}-p${p}-${idCounter.current++}`,
          sourceIndex,
          pageIndex: p,
          sourceName: file.name,
        }));
        setPages((prev) => [...prev, ...newPages]);

        // Render thumbnails progressively so the grid fills in as we go.
        for (let p = 0; p < doc.numPages; p++) {
          const thumb = await renderPageToDataUrl(doc, p + 1, 0.4);
          const { id } = newPages[p];
          setPages((prev) => prev.map((pg) => (pg.id === id ? { ...pg, thumb } : pg)));
        }
        doc.destroy();
      }
    } finally {
      setLoading(false);
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
    sourcesRef.current = [];
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
      const bytes = await mergePdfs(
        sourcesRef.current.map((s) => s.bytes),
        order,
      );
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
                  <Spinner className="h-3.5 w-3.5" /> rendering…
                </span>
              )}
              . Drag to reorder; use the trash icon to delete.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reset} disabled={merging}>
                Clear all
              </Button>
              <Button onClick={handleMerge} disabled={merging || pages.length === 0}>
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
