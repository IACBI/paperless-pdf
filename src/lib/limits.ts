// Resource limits for untrusted PDFs. Everything runs on the user's device, so a
// hostile or merely huge file can exhaust memory or the canvas budget and freeze
// or crash the tab. These guards run before allocation, not after.

/** Largest PDF we will read into memory. */
export const MAX_INPUT_BYTES = 200 * 1024 * 1024;

/** Largest page count we will load or render. */
export const MAX_PAGE_COUNT = 1000;

/**
 * Combined size of every file loaded into one merge session. Per-file limits
 * alone would let a user stack many 200 MB files and exhaust memory.
 */
export const MAX_TOTAL_INPUT_BYTES = 500 * 1024 * 1024;

/** Combined page count across every file in one merge session. */
export const MAX_TOTAL_PAGES = 2000;

/** Largest single image (JPG or PNG) we will embed into a PDF. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

/** Most images we will combine into one Images-to-PDF job. */
export const MAX_IMAGE_COUNT = 500;

/**
 * Largest embedded image, in pixels. A JPEG header can declare up to 65535 x 65535
 * from a few bytes of file, so the byte limit alone does not bound decode cost.
 */
export const MAX_IMAGE_PIXELS = 40_000_000;

/**
 * Largest canvas, in pixels, we allocate for one rendered page (~160 MB as RGBA).
 * A4 at 300 dpi is about 8.7M pixels, so this leaves ample headroom for real use.
 */
export const MAX_RENDER_PIXELS = 40_000_000;

/** Thrown when input exceeds a limit. Its message is safe to show the user. */
export class ResourceLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceLimitError';
  }
}

export function assertInputSize(byteLength: number): void {
  if (byteLength > MAX_INPUT_BYTES) {
    throw new ResourceLimitError(
      `That file is too large (limit ${MAX_INPUT_BYTES / (1024 * 1024)} MB). Split it into smaller PDFs first.`,
    );
  }
}

export function assertPageCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new ResourceLimitError('The PDF reports an invalid page count.');
  }
  if (count > MAX_PAGE_COUNT) {
    throw new ResourceLimitError(
      `The PDF has ${count} pages; the limit is ${MAX_PAGE_COUNT}. Split it into smaller PDFs first.`,
    );
  }
}

const isCount = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Check a file against the running total of a session. `existingBytes` is what
 * is already loaded; the message names the total the new file would reach.
 */
export function assertCumulativeInputSize(existingBytes: number, additionalBytes: number): void {
  if (!isCount(existingBytes) || !isCount(additionalBytes)) {
    throw new ResourceLimitError('The file reports an invalid size.');
  }
  const total = existingBytes + additionalBytes;
  if (total > MAX_TOTAL_INPUT_BYTES) {
    const mb = (bytes: number) => Math.ceil(bytes / (1024 * 1024));
    throw new ResourceLimitError(
      `Adding this file would bring the total to ${mb(total)} MB; the limit for one job is ${mb(MAX_TOTAL_INPUT_BYTES)} MB. Remove some files first.`,
    );
  }
}

/** Page-count counterpart of {@link assertCumulativeInputSize}. */
export function assertCumulativePageCount(existingPages: number, additionalPages: number): void {
  if (
    !Number.isInteger(existingPages) ||
    !Number.isInteger(additionalPages) ||
    existingPages < 0 ||
    additionalPages < 0
  ) {
    throw new ResourceLimitError('The PDF reports an invalid page count.');
  }
  const total = existingPages + additionalPages;
  if (total > MAX_TOTAL_PAGES) {
    throw new ResourceLimitError(
      `Adding this file would bring the total to ${total} pages; the limit for one job is ${MAX_TOTAL_PAGES}. Remove some files first.`,
    );
  }
}

export function assertImageSize(byteLength: number): void {
  if (!isCount(byteLength)) {
    throw new ResourceLimitError('The image reports an invalid size.');
  }
  if (byteLength > MAX_IMAGE_BYTES) {
    throw new ResourceLimitError(
      `That image is too large (limit ${MAX_IMAGE_BYTES / (1024 * 1024)} MB). Resize or compress it first.`,
    );
  }
}

export function assertImageCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new ResourceLimitError('The image count is invalid.');
  }
  if (count > MAX_IMAGE_COUNT) {
    throw new ResourceLimitError(
      `You can combine at most ${MAX_IMAGE_COUNT} images into one PDF. Remove some images first.`,
    );
  }
}

/** Check an image's declared dimensions, as reported by the embedder, before it is drawn. */
export function assertImagePixels(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ResourceLimitError('An image has an invalid size and cannot be embedded.');
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new ResourceLimitError(
      `An image is too large (${width}×${height} px). Resize it to at most ${MAX_IMAGE_PIXELS.toLocaleString('en-US')} pixels.`,
    );
  }
}

/**
 * Check a canvas size before it is allocated. Non-finite or non-positive sizes
 * come from a malformed page box or an invalid scale, so they are rejected here
 * rather than passed to the canvas API.
 */
export function assertRenderSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ResourceLimitError('This page has an invalid size and cannot be rendered.');
  }
  if (width * height > MAX_RENDER_PIXELS) {
    throw new ResourceLimitError(
      `This page is too large to render at this resolution (${Math.ceil(width)}×${Math.ceil(height)} px). Try a lower scale or resolution.`,
    );
  }
}

/** Read a user-selected PDF, rejecting oversized files before loading them. */
export async function readPdfFile(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<Uint8Array> {
  assertInputSize(file.size);
  return new Uint8Array(await file.arrayBuffer());
}

/** Message to show in the UI: limit errors are explicit, anything else gets the fallback. */
export function userMessage(error: unknown, fallback: string): string {
  return error instanceof ResourceLimitError ? error.message : fallback;
}
