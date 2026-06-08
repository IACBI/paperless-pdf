import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { imagesToPdf, detectFormat, type ImageInput } from './imagesToPdf';

// A real 1x1 transparent PNG, decoded from base64.
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function pngBytes(): Uint8Array {
  const bin = atob(PNG_1x1_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

describe('detectFormat', () => {
  it('detects PNG from magic bytes', () => {
    expect(detectFormat(pngBytes())).toBe('png');
  });
  it('detects JPG from magic bytes', () => {
    expect(detectFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
  });
  it('returns null for unsupported data', () => {
    expect(detectFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});

describe('imagesToPdf', () => {
  it('creates one page per image (fit layout)', async () => {
    const img: ImageInput = { bytes: pngBytes(), format: 'png', name: 'dot.png' };
    const out = await imagesToPdf([img, img]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it('uses a fixed A4 page when requested', async () => {
    const img: ImageInput = { bytes: pngBytes(), format: 'png' };
    const out = await imagesToPdf([img], { layout: 'a4' });
    const doc = await PDFDocument.load(out);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(595); // A4 width in points
  });

  it('throws when given no images', async () => {
    await expect(imagesToPdf([])).rejects.toThrow(/no images/i);
  });
});
