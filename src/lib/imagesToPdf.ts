import { PDFDocument, type PDFImage } from 'pdf-lib';
import {
  assertCumulativeInputSize,
  assertImageCount,
  assertImagePixels,
  assertImageSize,
} from './limits';

export type ImageFormat = 'jpg' | 'png';

export interface ImageInput {
  bytes: Uint8Array;
  format: ImageFormat;
  /** Original filename, used only for error messages. */
  name?: string;
}

export type PageLayout = 'fit' | 'a4' | 'letter';

/** Page sizes in PDF points (1/72"). */
const PAGE_SIZES: Record<Exclude<PageLayout, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export interface ImagesToPdfOptions {
  /** "fit": each page matches its image. Otherwise images fit within a fixed page. */
  layout?: PageLayout;
  /** Margin in points for fixed page sizes. */
  margin?: number;
}

/** Detect jpg/png from the file's magic bytes; returns null if unsupported. */
export function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  return null;
}

/**
 * Width/height from a PNG's IHDR chunk, or null if the header is malformed.
 * Read before embedding because pdf-lib's embedPng decodes the full bitmap.
 */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 24) return null;
  const isIhdr =
    bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
  if (!isIhdr) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * Build a PDF from a list of JPG/PNG images, one image per page. Pure; runs
 * entirely in-browser via pdf-lib.
 */
export async function imagesToPdf(
  images: ImageInput[],
  options: ImagesToPdfOptions = {},
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('imagesToPdf: no images provided');
  assertImageCount(images.length);
  const { layout = 'fit', margin = 36 } = options;

  const doc = await PDFDocument.create();
  let totalBytes = 0;

  for (const img of images) {
    assertImageSize(img.bytes.byteLength);
    assertCumulativeInputSize(totalBytes, img.bytes.byteLength);
    totalBytes += img.bytes.byteLength;

    if (img.format === 'png') {
      const dims = pngDimensions(img.bytes);
      if (!dims) throw new Error(`Could not embed image${img.name ? ` "${img.name}"` : ''}.`);
      assertImagePixels(dims.width, dims.height);
    }

    let embedded: PDFImage;
    try {
      embedded =
        img.format === 'jpg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
    } catch {
      throw new Error(`Could not embed image${img.name ? ` "${img.name}"` : ''}.`);
    }
    // embedJpg only parses the header, so JPEG dimensions are checked here; PNG
    // was checked above, before decoding.
    assertImagePixels(embedded.width, embedded.height);

    if (layout === 'fit') {
      const page = doc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    } else {
      const [pw, ph] = PAGE_SIZES[layout];
      const page = doc.addPage([pw, ph]);
      const maxW = pw - margin * 2;
      const maxH = ph - margin * 2;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }

  return doc.save();
}
