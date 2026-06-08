// Vendors all Tesseract OCR assets into public/ so the app runs OCR fully
// offline with zero third-party requests (the privacy invariant). Run via
// `npm run vendor:ocr` (also wired to postinstall).
//
// Copies:
//   - tesseract.js worker  -> public/tesseract/worker.min.js
//   - tesseract WASM core  -> public/tesseract/*
// Downloads:
//   - language traineddata -> public/tessdata/<lang>.traineddata.gz
//
// Add languages by extending LANGS below (see CLAUDE.md → "add an OCR language").

import { mkdir, copyFile, access, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TESS_DIR = join(root, 'public', 'tesseract');
const DATA_DIR = join(root, 'public', 'tessdata');

// tessdata_fast (LSTM) keeps the download small (~1–2 MB/lang) while staying
// accurate. gzip:true is the tesseract.js default, so we keep the .gz files.
const TESSDATA_BASE = 'https://tessdata.projectnaptha.com/4.0.0_fast';
const LANGS = ['eng'];

// We run LSTM only (tessdata_fast is LSTM), so we ship just the LSTM cores:
// the SIMD build for modern browsers and the non-SIMD build as a fallback.
// The legacy/full cores are only needed with legacyCore:true, which we don't use.
const CORE_FILES = [
  'tesseract-core-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
];

const exists = (p) =>
  access(p)
    .then(() => true)
    .catch(() => false);

async function copyWorkerAndCore() {
  await mkdir(TESS_DIR, { recursive: true });

  const worker = join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
  await copyFile(worker, join(TESS_DIR, 'worker.min.js'));
  console.log('✓ worker.min.js');

  const coreDir = join(root, 'node_modules', 'tesseract.js-core');
  for (const f of CORE_FILES) {
    const src = join(coreDir, f);
    if (await exists(src)) {
      await copyFile(src, join(TESS_DIR, f));
    }
  }
  console.log(`✓ tesseract WASM core (${CORE_FILES.length} candidate files)`);
}

async function downloadLangs() {
  await mkdir(DATA_DIR, { recursive: true });
  for (const lang of LANGS) {
    const dest = join(DATA_DIR, `${lang}.traineddata.gz`);
    if ((await exists(dest)) && (await stat(dest)).size > 0) {
      console.log(`• ${lang}.traineddata.gz already present, skipping`);
      continue;
    }
    const url = `${TESSDATA_BASE}/${lang}.traineddata.gz`;
    process.stdout.write(`↓ downloading ${lang}.traineddata.gz … `);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`failed (${res.status}) from ${url}`);
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    console.log('done');
  }
}

try {
  await copyWorkerAndCore();
  await downloadLangs();
  console.log('\nTesseract assets vendored into public/. OCR will run fully offline.');
} catch (err) {
  console.error('\n⚠  Could not vendor all Tesseract assets:', err.message);
  console.error(
    'The app still builds; OCR will show a setup notice until the language\n' +
      'data is present. Re-run `npm run vendor:ocr` once you have network access,\n' +
      'or manually place <lang>.traineddata.gz files in public/tessdata/.',
  );
  // Don't fail installs/builds over an optional asset download.
  process.exit(0);
}
