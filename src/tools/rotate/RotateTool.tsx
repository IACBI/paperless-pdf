import { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { loadPdf, renderPageToDataUrl } from '../../lib/pdfjs';
import { rotatePages, normalizeAngle } from '../../lib/rotate';
import { downloadBlob, addSuffix } from '../../lib/download';

interface Loaded {
  name: string;
  bytes: Uint8Array;
  thumbs: (string | undefined)[];
}

export default function RotateTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [deltas, setDeltas] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: File[]) {
    const file = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!file) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setLoading(true);
    setDoc(null);
    setDeltas({});
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await loadPdf(bytes);
      const next: Loaded = {
        name: file.name,
        bytes,
        thumbs: Array.from({ length: pdf.numPages }, () => undefined),
      };
      setDoc(next);
      for (let p = 0; p < pdf.numPages; p++) {
        const thumb = await renderPageToDataUrl(pdf, p + 1, 0.4);
        setDoc((cur) => {
          if (!cur || cur.bytes !== bytes) return cur;
          const thumbs = cur.thumbs.slice();
          thumbs[p] = thumb;
          return { ...cur, thumbs };
        });
      }
      pdf.destroy();
    } catch {
      setError('Could not open that PDF. Is it valid and unencrypted?');
    } finally {
      setLoading(false);
    }
  }

  function rotateOne(index: number, delta: number) {
    setDeltas((prev) => ({ ...prev, [index]: normalizeAngle((prev[index] ?? 0) + delta) }));
  }

  function rotateAllBy(delta: number) {
    if (!doc) return;
    setDeltas((prev) => {
      const next = { ...prev };
      for (let i = 0; i < doc.thumbs.length; i++) {
        next[i] = normalizeAngle((prev[i] ?? 0) + delta);
      }
      return next;
    });
  }

  const hasChanges = doc ? Object.values(deltas).some((d) => d % 360 !== 0) : false;

  async function handleApply() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const map = new Map<number, number>();
      for (const [k, v] of Object.entries(deltas)) {
        if (v % 360 !== 0) map.set(Number(k), v);
      }
      const bytes = await rotatePages(doc.bytes, map);
      downloadBlob(bytes, addSuffix(doc.name, '-rotated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rotate failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell toolId="rotate">
      {!doc && (
        <FileDropzone
          accept="application/pdf"
          multiple={false}
          onFiles={onFiles}
          label="Drop a PDF to rotate"
          hint="or click to browse"
        />
      )}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-brand-700">
          <Spinner className="h-4 w-4" /> Opening PDF…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {doc && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{doc.name}</span> · {doc.thumbs.length}{' '}
              pages
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => rotateAllBy(-90)}>
                ⟲ Rotate all left
              </Button>
              <Button variant="secondary" onClick={() => rotateAllBy(90)}>
                ⟳ Rotate all right
              </Button>
              <Button onClick={handleApply} disabled={busy || !hasChanges}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                Apply & download
              </Button>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {doc.thumbs.map((thumb, i) => {
              const delta = deltas[i] ?? 0;
              return (
                <li
                  key={i}
                  className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-slate-50">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={`Page ${i + 1}`}
                        className="max-h-full max-w-full object-contain transition-transform"
                        style={{ transform: `rotate(${delta}deg)` }}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">…</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1">
                    <span className="text-xs text-slate-500">
                      {i + 1}
                      {delta % 360 !== 0 && <span className="ml-1 text-brand-600">{delta}°</span>}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => rotateOne(i, -90)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label={`Rotate page ${i + 1} left`}
                      >
                        ⟲
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateOne(i, 90)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label={`Rotate page ${i + 1} right`}
                      >
                        ⟳
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ToolShell>
  );
}
