import { useEffect, useMemo, useRef, useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import PageThumbnail from '../../components/PageThumbnail';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { loadPdf, type PDFDocumentProxy } from '../../lib/pdfjs';
import { readPdfFile, userMessage } from '../../lib/limits';
import {
  parseRanges,
  rangesToIndices,
  splitByRanges,
  extractPages,
  type PageRange,
} from '../../lib/split';
import { downloadBlob, addSuffix } from '../../lib/download';
import { zipFiles } from '../../lib/zip';

interface Loaded {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Kept open so thumbnails render on demand; destroyed when the file is dropped. */
  pdf: PDFDocumentProxy;
}

export default function SplitTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  // Bumped on unmount and on every new load: a load that finishes after either
  // must destroy its own document instead of adopting it.
  const disposed = useRef(false);
  const generation = useRef(0);

  function releasePdf() {
    pdfRef.current?.destroy();
    pdfRef.current = null;
  }

  useEffect(() => {
    // StrictMode runs effects twice in development, so the flag is re-armed here.
    disposed.current = false;
    return () => {
      disposed.current = true;
      releasePdf();
    };
  }, []);

  // Live-parse the range input against the loaded page count.
  const parsed = useMemo<
    { ok: true; ranges: PageRange[]; selected: Set<number> } | { ok: false; message: string } | null
  >(() => {
    if (!doc || rangeText.trim() === '') return null;
    try {
      const ranges = parseRanges(rangeText, doc.pageCount);
      return { ok: true, ranges, selected: new Set(rangesToIndices(ranges)) };
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
    const current = ++generation.current;
    const isCurrent = () => !disposed.current && generation.current === current;
    setError(null);
    setLoading(true);
    releasePdf();
    setDoc(null);
    try {
      const bytes = await readPdfFile(file);
      if (!isCurrent()) return;
      const pdf = await loadPdf(bytes);
      if (!isCurrent()) {
        pdf.destroy();
        return;
      }
      pdfRef.current = pdf;
      setDoc({ name: file.name, bytes, pageCount: pdf.numPages, pdf });
      setRangeText(`1-${pdf.numPages}`);
    } catch (e) {
      if (isCurrent()) setError(userMessage(e, 'Could not open that PDF. Is it valid and unencrypted?'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  async function handleExtract() {
    if (!doc || !parsed?.ok) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await extractPages(doc.bytes, parsed.ranges);
      downloadBlob(bytes, addSuffix(doc.name, '-extract'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extract failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSplitZip() {
    if (!doc || !parsed?.ok) return;
    setBusy(true);
    setError(null);
    try {
      const outputs = await splitByRanges(doc.bytes, parsed.ranges);
      const base = doc.name.replace(/\.pdf$/i, '');
      const entries = outputs.map((data, i) => {
        const r = parsed.ranges[i];
        const label = r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`;
        return { name: `${base}-pages-${label}.pdf`, data };
      });
      const zip = await zipFiles(entries);
      downloadBlob(zip, `${base}-split.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed.');
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = parsed?.ok ? parsed.selected.size : 0;

  return (
    <ToolShell toolId="split">
      {!doc && (
        <FileDropzone
          accept="application/pdf"
          multiple={false}
          onFiles={onFiles}
          label="Drop a PDF to split"
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
                generation.current++;
                releasePdf();
                setDoc(null);
                setRangeText('');
                setError(null);
              }}
            >
              Choose another file
            </Button>
          </div>

          <div>
            <label htmlFor="ranges" className="block text-sm font-medium text-slate-700">
              Pages to keep
            </label>
            <input
              id="ranges"
              type="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              aria-describedby="ranges-help"
            />
            <p id="ranges-help" className="mt-1 text-xs text-slate-500">
              Comma-separated pages and ranges. Use <code>8-</code> for “8 to end”.
            </p>
            {parsed && !parsed.ok && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {parsed.message}
              </p>
            )}
            {parsed?.ok && (
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {selectedCount} page{selectedCount === 1 ? '' : 's'} selected ·{' '}
                {parsed.ranges.length} output file{parsed.ranges.length === 1 ? '' : 's'} when split.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExtract} disabled={busy || !parsed?.ok}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Extract to one PDF
            </Button>
            <Button variant="secondary" onClick={handleSplitZip} disabled={busy || !parsed?.ok}>
              Split into separate PDFs (.zip)
            </Button>
          </div>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: doc.pageCount }, (_, i) => {
              const selected = parsed?.ok ? parsed.selected.has(i) : false;
              return (
                <li
                  key={i}
                  className={[
                    'overflow-hidden rounded-md border bg-white text-center',
                    selected ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 opacity-50',
                  ].join(' ')}
                >
                  <PageThumbnail
                    doc={doc.pdf}
                    pageNumber={i + 1}
                    scale={0.35}
                    className="aspect-[3/4] bg-slate-50"
                  />
                  <span className="block py-0.5 text-[11px] text-slate-500">{i + 1}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ToolShell>
  );
}
