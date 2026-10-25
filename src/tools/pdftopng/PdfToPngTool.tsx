import { useMemo, useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { loadPdf } from '../../lib/pdfjs';
import { readPdfFile, userMessage } from '../../lib/limits';
import { parseRanges, rangesToIndices, type PageRange } from '../../lib/split';
import { pdfPagesToPng } from '../../lib/pdfToPng';
import { downloadBlob, swapExt } from '../../lib/download';
import { zipFiles } from '../../lib/zip';

interface Loaded {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

const SCALES = [
  { label: 'Screen (1×)', value: 1 },
  { label: 'High (2×)', value: 2 },
  { label: 'Print (3×)', value: 3 },
];

export default function PdfToPngTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangeText, setRangeText] = useState('');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo<
    { ok: true; ranges: PageRange[]; indices: number[] } | { ok: false; message: string } | null
  >(() => {
    if (!doc || rangeText.trim() === '') return null;
    try {
      const ranges = parseRanges(rangeText, doc.pageCount);
      return { ok: true, ranges, indices: rangesToIndices(ranges) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Invalid range.' };
    }
  }, [doc, rangeText]);

  async function onFiles(files: File[]) {
    const file = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!file) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setLoading(true);
    setDoc(null);
    try {
      const bytes = await readPdfFile(file);
      const pdf = await loadPdf(bytes);
      setDoc({ name: file.name, bytes, pageCount: pdf.numPages });
      setRangeText(`1-${pdf.numPages}`);
      pdf.destroy();
    } catch (e) {
      setError(userMessage(e, 'Could not open that PDF. Is it valid and unencrypted?'));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!doc || !parsed?.ok) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: parsed.indices.length });
    try {
      const rendered = await pdfPagesToPng(doc.bytes, parsed.indices, scale, (done, total) =>
        setProgress({ done, total }),
      );
      const base = doc.name.replace(/\.pdf$/i, '');
      if (rendered.length === 1) {
        downloadBlob(rendered[0].blob, swapExt(`${base}-p${rendered[0].index + 1}.pdf`, 'png'));
      } else {
        const entries = rendered.map((r) => ({
          name: `${base}-p${String(r.index + 1).padStart(3, '0')}.png`,
          data: r.blob,
        }));
        downloadBlob(await zipFiles(entries), `${base}-png.zip`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell toolId="pdf-to-png">
      {!doc && (
        <FileDropzone
          accept="application/pdf"
          multiple={false}
          onFiles={onFiles}
          label="Drop a PDF to export as PNG"
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
              <span className="font-medium text-slate-800">{doc.name}</span> · {doc.pageCount} pages
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setDoc(null);
                setRangeText('');
              }}
            >
              Choose another file
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="png-ranges" className="block text-sm font-medium text-slate-700">
                Pages
              </label>
              <input
                id="png-ranges"
                type="text"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="e.g. 1-3, 5"
                className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="png-scale" className="block text-sm font-medium text-slate-700">
                Resolution
              </label>
              <select
                id="png-scale"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="mt-1 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleExport} disabled={busy || !parsed?.ok}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Export PNG
            </Button>
          </div>

          {parsed && !parsed.ok && (
            <p role="alert" className="text-sm text-red-600">
              {parsed.message}
            </p>
          )}
          {parsed?.ok && !busy && (
            <p className="text-sm text-slate-600">
              {parsed.indices.length} page{parsed.indices.length === 1 ? '' : 's'} →{' '}
              {parsed.indices.length === 1 ? 'one PNG' : 'a .zip of PNGs'}.
            </p>
          )}

          {progress && (
            <div aria-live="polite">
              <div className="mb-1 text-sm text-slate-600">
                Rendering page {progress.done} of {progress.total}…
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
