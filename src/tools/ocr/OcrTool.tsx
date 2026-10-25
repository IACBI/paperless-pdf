import { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import ToolShell from '../../components/ToolShell';
import { loadPdf } from '../../lib/pdfjs';
import { readPdfFile, userMessage } from '../../lib/limits';
import { ocrToSearchablePdf, type OcrProgress } from '../../lib/ocr';
import { OCR_LANGUAGES } from '../../lib/ocrLanguages';
import { downloadBlob, addSuffix } from '../../lib/download';

interface Loaded {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export default function OcrTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [lang, setLang] = useState(OCR_LANGUAGES[0].code);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
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
    try {
      const bytes = await readPdfFile(file);
      const pdf = await loadPdf(bytes);
      setDoc({ name: file.name, bytes, pageCount: pdf.numPages });
      pdf.destroy();
    } catch (e) {
      setError(userMessage(e, 'Could not open that PDF. Is it valid and unencrypted?'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOcr() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    setProgress({ page: 1, total: doc.pageCount, fraction: 0, stage: 'rendering' });
    try {
      const bytes = await ocrToSearchablePdf(doc.bytes, { lang }, setProgress);
      downloadBlob(bytes, addSuffix(doc.name, '-searchable'));
    } catch (e) {
      setError(
        e instanceof Error
          ? `OCR failed: ${e.message}. If you just deployed, ensure the OCR assets in public/tessdata and public/tesseract are present (run "npm run vendor:ocr").`
          : 'OCR failed.',
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <ToolShell toolId="ocr">
      {!doc && (
        <FileDropzone
          accept="application/pdf"
          multiple={false}
          onFiles={onFiles}
          label="Drop a scanned PDF to make searchable"
          hint="or click to browse"
        />
      )}

      <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
        OCR runs entirely on your device. The first run loads the recognition engine and language
        data from this site (a few MB), then works fully offline.
      </div>

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
                setError(null);
              }}
              disabled={busy}
            >
              Choose another file
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="ocr-lang" className="block text-sm font-medium text-slate-700">
                Document language
              </label>
              <select
                id="ocr-lang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={busy}
                className="mt-1 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {OCR_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleOcr} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Make searchable
            </Button>
          </div>

          {progress && (
            <div aria-live="polite">
              <div className="mb-1 text-sm text-slate-600">
                {progress.stage === 'rendering' ? 'Rendering' : 'Recognizing'} page {progress.page}{' '}
                of {progress.total}… ({pct}%)
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
