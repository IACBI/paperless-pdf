export interface OcrLanguage {
  /** Tesseract language code; must match a file in public/tessdata/. */
  code: string;
  name: string;
}

/**
 * Languages whose traineddata is vendored into public/tessdata/. To add one:
 *   1. add its code to LANGS in scripts/vendor-tesseract.mjs and re-run
 *      `npm run vendor:ocr`,
 *   2. add an entry here.
 * See CLAUDE.md → "How to add an OCR language".
 */
export const OCR_LANGUAGES: OcrLanguage[] = [{ code: 'eng', name: 'English' }];
