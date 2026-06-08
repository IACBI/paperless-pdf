import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Count pages of a PDF given as bytes. */
export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

/** Extract and concatenate all visible/searchable text from a PDF. */
export async function extractText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
  }
  await doc.destroy();
  return out;
}
