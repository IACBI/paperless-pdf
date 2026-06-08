import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(here, 'fixtures');

/** A blank PDF with `n` pages, for merge/split tests. */
async function blankPdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([300, 400]);
  return doc.save();
}

/**
 * A one-page "scanned" PDF: an image of clear text, with no text layer. We
 * rasterize the text in a real browser canvas so OCR has a genuine image to read.
 */
async function scanPdf(): Promise<Uint8Array> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 320;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 110px Arial, sans-serif';
      ctx.fillText('PAPERLESS OCR 12345', 40, 200);
      return canvas.toDataURL('image/png');
    });
    const pngBytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    const doc = await PDFDocument.create();
    const png = await doc.embedPng(pngBytes);
    const pageDoc = doc.addPage([png.width, png.height]);
    pageDoc.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
    return doc.save();
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  await mkdir(FIXTURES, { recursive: true });
  await writeFile(path.join(FIXTURES, 'a.pdf'), await blankPdf(2));
  await writeFile(path.join(FIXTURES, 'b.pdf'), await blankPdf(3));
  await writeFile(path.join(FIXTURES, 'scan.pdf'), await scanPdf());
}
