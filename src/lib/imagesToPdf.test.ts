import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { imagesToPdf, detectFormat, pngDimensions, type ImageInput } from './imagesToPdf';
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, ResourceLimitError } from './limits';

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

/**
 * A JPEG that is only a SOI plus a SOF0 header declaring the given size. pdf-lib reads
 * the dimensions from this header without decoding pixels, so no large buffer is needed.
 */
function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xd9,
  ]);
}

describe('imagesToPdf resource limits', () => {
  it('rejects more images than the count limit', async () => {
    const img: ImageInput = { bytes: pngBytes(), format: 'png' };
    const many = Array.from({ length: MAX_IMAGE_COUNT + 1 }, () => img);
    await expect(imagesToPdf(many)).rejects.toBeInstanceOf(ResourceLimitError);
  });

  it('rejects an image over the byte limit before embedding it', async () => {
    const bytes = pngBytes();
    Object.defineProperty(bytes, 'byteLength', { value: MAX_IMAGE_BYTES + 1 });
    await expect(imagesToPdf([{ bytes, format: 'png' }])).rejects.toBeInstanceOf(
      ResourceLimitError,
    );
  });

  it('rejects an image whose declared pixel count is too large', async () => {
    const img: ImageInput = { bytes: jpegHeader(20000, 5000), format: 'jpg', name: 'huge.jpg' };
    await expect(imagesToPdf([img])).rejects.toBeInstanceOf(ResourceLimitError);
  });

  it('accepts an image within the pixel limit', async () => {
    const img: ImageInput = { bytes: jpegHeader(4000, 3000), format: 'jpg' };
    const out = await imagesToPdf([img]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });
});

describe('pngDimensions', () => {
  it('reads width and height from the IHDR chunk', () => {
    expect(pngDimensions(pngBytes())).toEqual({ width: 1, height: 1 });
  });

  it('returns null for a truncated header', () => {
    expect(pngDimensions(pngBytes().slice(0, 20))).toBeNull();
  });

  it('rejects a PNG that declares too many pixels before decoding it', async () => {
    const bytes = pngBytes();
    // Rewrite IHDR to 20000x5000; the CRC is now wrong, so reaching the
    // decoder would fail with a different error than the limit.
    new DataView(bytes.buffer).setUint32(16, 20000);
    new DataView(bytes.buffer).setUint32(20, 5000);
    await expect(imagesToPdf([{ bytes, format: 'png' }])).rejects.toBeInstanceOf(
      ResourceLimitError,
    );
  });
});
