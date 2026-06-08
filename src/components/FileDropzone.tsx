import { useId, useRef, useState, type DragEvent } from 'react';

interface FileDropzoneProps {
  /** Called with the chosen files (already filtered to `accept` when possible). */
  onFiles: (files: File[]) => void;
  /** Accept attribute, e.g. "application/pdf" or "image/*". */
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
}

/** Accessible drag-and-drop + click-to-browse file input. */
export default function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  label = 'Drop files here',
  hint = 'or click to browse',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const id = useId();

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white',
      ].join(' ')}
    >
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center gap-2 text-slate-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-brand-600"
          aria-hidden="true"
        >
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="text-sm">{hint}</span>
      </label>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
