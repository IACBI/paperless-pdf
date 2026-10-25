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

import { mkdir, copyFile, access, readFile, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
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

// The download host is not otherwise authenticated, so these pinned digests are
// the trust anchor. Re-pin only after confirming the new file from the upstream
// tessdata_fast release. Values computed 2026-10-26 from the live file.
const TESSDATA_SHA256 = {
  eng: '18c1ac52b75e35d44735fb6c2a60acfaf23033524653200738e98f0243edb75b',
};

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

const sha256 = async (p) =>
  createHash('sha256')
    .update(await readFile(p))
    .digest('hex');

async function copyWorkerAndCore() {
  await mkdir(TESS_DIR, { recursive: true });

  const worker = join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
  await copyFile(worker, join(TESS_DIR, 'worker.min.js'));
  console.log('✓ worker.min.js');

  // A missing core file fails the same way a bad traineddata digest does: the
  // throw reaches the top-level catch, which exits 1 in CI and warns locally.
  const coreDir = join(root, 'node_modules', 'tesseract.js-core');
  for (const f of CORE_FILES) {
    const src = join(coreDir, f);
    if (!(await exists(src))) {
      throw new Error(`tesseract core file ${f} not found in node_modules/tesseract.js-core`);
    }
    await copyFile(src, join(TESS_DIR, f));
  }
  console.log(`✓ tesseract WASM core (${CORE_FILES.length} files)`);
}

async function downloadLangs() {
  await mkdir(DATA_DIR, { recursive: true });
  for (const lang of LANGS) {
    const expected = TESSDATA_SHA256[lang];
    if (!expected) throw new Error(`no pinned SHA-256 for ${lang}`);

    const dest = join(DATA_DIR, `${lang}.traineddata.gz`);
    if ((await exists(dest)) && (await sha256(dest)) === expected) {
      console.log(`• ${lang}.traineddata.gz already present and verified, skipping`);
      continue;
    }
    const url = `${TESSDATA_BASE}/${lang}.traineddata.gz`;
    process.stdout.write(`↓ downloading ${lang}.traineddata.gz … `);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`failed (${res.status}) from ${url}`);
    }
    // Write to a temp file and rename only after the digest matches, so a bad
    // or partial download never replaces a good file in public/tessdata/.
    const tmp = `${dest}.download`;
    try {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      const actual = await sha256(tmp);
      if (actual !== expected) {
        throw new Error(
          `SHA-256 mismatch for ${lang}.traineddata.gz (expected ${expected}, got ${actual})`,
        );
      }
      await rename(tmp, dest);
    } finally {
      await rm(tmp, { force: true });
    }
    console.log('done, SHA-256 verified');
  }
}

try {
  await copyWorkerAndCore();
  await downloadLangs();
  console.log('\nTesseract assets vendored into public/. OCR will run fully offline.');
} catch (err) {
  console.error('\n⚠  Could not vendor all Tesseract assets:', err.message);
  console.error(
    'The app still builds, but OCR will not work until the assets are present.\n' +
      'Fix the cause above (network access for language data, `npm ci` for\n' +
      'tesseract.js-core), then re-run `npm run vendor:ocr`.',
  );
  // In CI, a missing or unverified asset must fail the job rather than ship
  // a build without OCR data. Locally, OCR is optional, so don't block installs.
  if (process.env.CI) {
    process.exit(1);
  }
  process.exit(0);
}
