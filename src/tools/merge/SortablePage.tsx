import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface MergePage {
  /** Stable unique id for dnd. */
  id: string;
  sourceIndex: number;
  pageIndex: number;
  sourceName: string;
  /** Thumbnail data URL, or undefined while rendering. */
  thumb?: string;
}

interface SortablePageProps {
  page: MergePage;
  /** 1-based position shown to the user. */
  position: number;
  onDelete: (id: string) => void;
}

export default function SortablePage({ page, position, onDelete }: SortablePageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm',
        isDragging ? 'z-10 border-brand-400 ring-2 ring-brand-300' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Drag handle covers the thumbnail; keyboard-operable via dnd-kit. */}
      <button
        type="button"
        className="block aspect-[3/4] w-full cursor-grab touch-none bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing"
        aria-label={`Page ${position} from ${page.sourceName}. Drag to reorder.`}
        {...attributes}
        {...listeners}
      >
        {page.thumb ? (
          <img src={page.thumb} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-slate-400">
            rendering…
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-2 py-1 text-xs text-slate-500">
        <span className="truncate" title={page.sourceName}>
          {position}. {page.sourceName}
        </span>
        <button
          type="button"
          onClick={() => onDelete(page.id)}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label={`Delete page ${position} from ${page.sourceName}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
          </svg>
        </button>
      </div>
    </li>
  );
}
