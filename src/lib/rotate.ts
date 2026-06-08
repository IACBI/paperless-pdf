import { PDFDocument, degrees } from 'pdf-lib';

/** Normalize any degree value to one of 0/90/180/270. */
export function normalizeAngle(deg: number): number {
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
}

/**
 * Rotate pages by adding a delta (in degrees, multiples of 90) to each page's
 * existing rotation. `deltaByIndex` maps a 0-based page index to the delta to
 * apply; pages not present are left unchanged. Pure; runs via pdf-lib.
 */
export async function rotatePages(
  bytes: Uint8Array,
  deltaByIndex: Map<number, number>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();

  for (const [index, delta] of deltaByIndex) {
    const page = pages[index];
    if (!page) throw new Error(`rotatePages: page index ${index} out of range`);
    const current = page.getRotation().angle;
    page.setRotation(degrees(normalizeAngle(current + delta)));
  }

  return doc.save();
}

/** Rotate every page by the same delta. Convenience wrapper. */
export async function rotateAll(bytes: Uint8Array, delta: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  for (const page of doc.getPages()) {
    page.setRotation(degrees(normalizeAngle(page.getRotation().angle + delta)));
  }
  return doc.save();
}
