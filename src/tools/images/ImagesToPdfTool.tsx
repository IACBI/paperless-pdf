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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { imagesToPdf, detectFormat, type ImageInput, type PageLayout } from '../../lib/imagesToPdf';
import { downloadBlob } from '../../lib/download';

interface ImageItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  format: 'jpg' | 'png';
  url: string; // object URL for preview
}

function SortableThumb({ item, onDelete }: { item: ImageItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'group relative overflow-hidden rounded-lg border bg-white shadow-sm',
        isDragging ? 'z-10 border-brand-400 ring-2 ring-brand-300' : 'border-slate-200',
      ].join(' ')}
    >
      <button
        type="button"
        className="block aspect-square w-full cursor-grab touch-none bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing"
        aria-label={`${item.name}. Drag to reorder.`}
        {...attributes}
        {...listeners}
      >
        <img src={item.url} alt="" className="h-full w-full object-contain" draggable={false} />
      </button>
      <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-2 py-1 text-xs text-slate-500">
        <span className="truncate" title={item.name}>
          {item.name}
        </span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label={`Remove ${item.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

export default function ImagesToPdfTool() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [layout, setLayout] = useState<PageLayout>('fit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCounter = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onFiles(files: File[]) {
    setError(null);
    const next: ImageItem[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = detectFormat(bytes);
      if (!format) {
        setError(`"${file.name}" is not a supported image (use JPG or PNG).`);
        continue;
      }
      next.push({
        id: `img-${idCounter.current++}`,
        name: file.name,
        bytes,
        format,
        url: URL.createObjectURL(new Blob([bytes as BlobPart])),
      });
    }
    setItems((prev) => [...prev, ...next]);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return from === -1 || to === -1 ? prev : arrayMove(prev, from, to);
    });
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  function reset() {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setError(null);
  }

  async function handleConvert() {
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const inputs: ImageInput[] = items.map((i) => ({
        bytes: i.bytes,
        format: i.format,
        name: i.name,
      }));
      const bytes = await imagesToPdf(inputs, { layout });
      downloadBlob(bytes, 'images.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell toolId="images-to-pdf">
      <FileDropzone
        accept="image/jpeg,image/png"
        onFiles={onFiles}
        label="Drop JPG or PNG images"
        hint="or click to browse — drag thumbnails to set page order"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Page size
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as PageLayout)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="fit">Fit to each image</option>
                <option value="a4">A4 (centered)</option>
                <option value="letter">Letter (centered)</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Clear all
              </Button>
              <Button onClick={handleConvert} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                Create PDF
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((item) => (
                  <SortableThumb key={item.id} item={item} onDelete={removeItem} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </ToolShell>
  );
}
