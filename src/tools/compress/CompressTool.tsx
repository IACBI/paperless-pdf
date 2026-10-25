import { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { readPdfFile, userMessage } from '../../lib/limits';
import { compressPdf } from '../../lib/compress';
import { downloadBlob, addSuffix } from '../../lib/download';

interface Loaded {
  name: string;
  bytes: Uint8Array;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

interface Result {
  bytes: Uint8Array;
  filename: string;
  originalSize: number;
}

export default function CompressTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: File[]) {
    const file = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!file) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setResult(null);
    try {
      setDoc({ name: file.name, bytes: await readPdfFile(file) });
    } catch (e) {
      setError(userMessage(e, 'Could not read that PDF.'));
    }
  }

  async function handleCompress() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 1 });
    try {
      const bytes = await compressPdf(doc.bytes, { dpi, quality }, (done, total) =>
        setProgress({ done, total }),
      );
      setResult({
        bytes,
        filename: addSuffix(doc.name, '-compressed'),
        originalSize: doc.bytes.byteLength,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compression failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell toolId="compress">
      {!doc && (
        <FileDropzone
          accept="application/pdf"
          multiple={false}
          onFiles={onFiles}
          label="Drop a PDF to compress"
          hint="or click to browse"
        />
      )}

      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Heads up:</strong> compression re-renders each page as an image, so existing
        selectable text becomes part of the picture. To keep it searchable, run the{' '}
        <strong>OCR</strong> tool on the result.
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {doc && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{doc.name}</span> ·{' '}
              {formatBytes(doc.bytes.byteLength)}
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setDoc(null);
                setResult(null);
              }}
            >
              Choose another file
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="dpi" className="flex justify-between text-sm font-medium text-slate-700">
                <span>Resolution</span>
                <span className="text-slate-500">{dpi} DPI</span>
              </label>
              <input
                id="dpi"
                type="range"
                min={72}
                max={300}
                step={6}
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600"
              />
              <p className="mt-1 text-xs text-slate-500">Lower DPI = smaller file, softer pages.</p>
            </div>
            <div>
              <label
                htmlFor="quality"
                className="flex justify-between text-sm font-medium text-slate-700"
              >
                <span>JPEG quality</span>
                <span className="text-slate-500">{Math.round(quality * 100)}%</span>
              </label>
              <input
                id="quality"
                type="range"
                min={0.3}
                max={0.95}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600"
              />
              <p className="mt-1 text-xs text-slate-500">Lower quality = smaller file, more artifacts.</p>
            </div>
          </div>

          <Button onClick={handleCompress} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Compress
          </Button>

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

          {result && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-700">
                {formatBytes(result.originalSize)} →{' '}
                <span className="font-semibold text-slate-900">
                  {formatBytes(result.bytes.byteLength)}
                </span>{' '}
                {result.bytes.byteLength < result.originalSize ? (
                  <span className="text-green-700">
                    (−{Math.round((1 - result.bytes.byteLength / result.originalSize) * 100)}%)
                  </span>
                ) : (
                  <span className="text-amber-700">
                    (no reduction — try a lower DPI or quality)
                  </span>
                )}
              </p>
              <div className="mt-3">
                <Button onClick={() => downloadBlob(result.bytes, result.filename)}>
                  Download compressed PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
