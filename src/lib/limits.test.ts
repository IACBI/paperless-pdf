import { describe, expect, it, vi } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_PIXELS,
  MAX_INPUT_BYTES,
  MAX_PAGE_COUNT,
  MAX_RENDER_PIXELS,
  MAX_TOTAL_INPUT_BYTES,
  MAX_TOTAL_PAGES,
  ResourceLimitError,
  assertCumulativeInputSize,
  assertCumulativePageCount,
  assertImageCount,
  assertImagePixels,
  assertImageSize,
  assertInputSize,
  assertPageCount,
  assertRenderSize,
  readPdfFile,
  userMessage,
} from './limits';

describe('assertCumulativeInputSize', () => {
  it('accepts a total exactly at the limit', () => {
    expect(() => assertCumulativeInputSize(MAX_TOTAL_INPUT_BYTES - 10, 10)).not.toThrow();
    expect(() => assertCumulativeInputSize(0, 0)).not.toThrow();
  });

  it('rejects a file that pushes the total over the limit', () => {
    expect(() => assertCumulativeInputSize(MAX_TOTAL_INPUT_BYTES - 10, 11)).toThrow(
      ResourceLimitError,
    );
  });

  it('rejects invalid sizes', () => {
    expect(() => assertCumulativeInputSize(-1, 0)).toThrow(ResourceLimitError);
    expect(() => assertCumulativeInputSize(0, NaN)).toThrow(ResourceLimitError);
    expect(() => assertCumulativeInputSize(0, Infinity)).toThrow(ResourceLimitError);
  });

  it('gives a message that names the limit', () => {
    try {
      assertCumulativeInputSize(MAX_TOTAL_INPUT_BYTES, 1);
      expect.unreachable();
    } catch (e) {
      expect(userMessage(e, 'fallback')).toMatch(/500 MB/);
    }
  });
});

describe('assertCumulativePageCount', () => {
  it('accepts a total exactly at the limit', () => {
    expect(() => assertCumulativePageCount(MAX_TOTAL_PAGES - 1, 1)).not.toThrow();
  });

  it('rejects a total over the limit', () => {
    expect(() => assertCumulativePageCount(MAX_TOTAL_PAGES, 1)).toThrow(ResourceLimitError);
    expect(() => assertCumulativePageCount(1, MAX_TOTAL_PAGES)).toThrow(ResourceLimitError);
  });

  it('rejects non-integer, negative, and non-finite counts', () => {
    expect(() => assertCumulativePageCount(1.5, 1)).toThrow(ResourceLimitError);
    expect(() => assertCumulativePageCount(0, -1)).toThrow(ResourceLimitError);
    expect(() => assertCumulativePageCount(NaN, 1)).toThrow(ResourceLimitError);
    expect(() => assertCumulativePageCount(0, Infinity)).toThrow(ResourceLimitError);
  });
});

describe('assertInputSize', () => {
  it('accepts sizes up to and including the limit', () => {
    expect(() => assertInputSize(0)).not.toThrow();
    expect(() => assertInputSize(MAX_INPUT_BYTES)).not.toThrow();
  });

  it('rejects oversized input with a ResourceLimitError', () => {
    expect(() => assertInputSize(MAX_INPUT_BYTES + 1)).toThrow(ResourceLimitError);
  });
});

describe('assertPageCount', () => {
  it('accepts counts up to the limit', () => {
    expect(() => assertPageCount(MAX_PAGE_COUNT)).not.toThrow();
  });

  it('rejects counts above the limit', () => {
    expect(() => assertPageCount(MAX_PAGE_COUNT + 1)).toThrow(ResourceLimitError);
  });

  it('rejects non-integer, negative, and non-finite counts', () => {
    expect(() => assertPageCount(1.5)).toThrow(ResourceLimitError);
    expect(() => assertPageCount(-1)).toThrow(ResourceLimitError);
    expect(() => assertPageCount(NaN)).toThrow(ResourceLimitError);
    expect(() => assertPageCount(Infinity)).toThrow(ResourceLimitError);
  });
});

describe('assertRenderSize', () => {
  it('accepts a normal page and the exact pixel limit', () => {
    expect(() => assertRenderSize(612, 792)).not.toThrow();
    expect(() => assertRenderSize(MAX_RENDER_PIXELS, 1)).not.toThrow();
  });

  it('rejects canvases over the pixel limit', () => {
    expect(() => assertRenderSize(MAX_RENDER_PIXELS + 1, 1)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(20000, 20000)).toThrow(ResourceLimitError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => assertRenderSize(NaN, 100)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(100, NaN)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(Infinity, 100)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(100, -Infinity)).toThrow(ResourceLimitError);
  });

  it('rejects zero and negative sizes', () => {
    expect(() => assertRenderSize(0, 100)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(100, 0)).toThrow(ResourceLimitError);
    expect(() => assertRenderSize(-1, 100)).toThrow(ResourceLimitError);
  });
});

describe('readPdfFile', () => {
  it('rejects oversized files without reading them', async () => {
    const arrayBuffer = vi.fn();
    await expect(readPdfFile({ size: MAX_INPUT_BYTES + 1, arrayBuffer })).rejects.toBeInstanceOf(
      ResourceLimitError,
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('returns the file bytes when within the limit', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const bytes = await readPdfFile({
      size: data.byteLength,
      arrayBuffer: async () => data.buffer,
    });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});

describe('userMessage', () => {
  it('surfaces limit messages and falls back for other errors', () => {
    expect(userMessage(new ResourceLimitError('too big'), 'fallback')).toBe('too big');
    expect(userMessage(new Error('pdf.js internal'), 'fallback')).toBe('fallback');
    expect(userMessage('not an error', 'fallback')).toBe('fallback');
  });
});

describe('assertImageSize', () => {
  it('accepts sizes up to and including the limit', () => {
    expect(() => assertImageSize(MAX_IMAGE_BYTES)).not.toThrow();
  });

  it('rejects oversized and invalid sizes', () => {
    expect(() => assertImageSize(MAX_IMAGE_BYTES + 1)).toThrow(ResourceLimitError);
    expect(() => assertImageSize(-1)).toThrow(ResourceLimitError);
    expect(() => assertImageSize(NaN)).toThrow(ResourceLimitError);
  });
});

describe('assertImageCount', () => {
  it('accepts counts up to the limit and rejects above it', () => {
    expect(() => assertImageCount(MAX_IMAGE_COUNT)).not.toThrow();
    expect(() => assertImageCount(MAX_IMAGE_COUNT + 1)).toThrow(ResourceLimitError);
  });

  it('rejects non-integer and negative counts', () => {
    expect(() => assertImageCount(1.5)).toThrow(ResourceLimitError);
    expect(() => assertImageCount(-1)).toThrow(ResourceLimitError);
  });
});

describe('assertImagePixels', () => {
  it('accepts an image at the pixel limit', () => {
    expect(() => assertImagePixels(MAX_IMAGE_PIXELS, 1)).not.toThrow();
    expect(() => assertImagePixels(6000, 6000)).not.toThrow();
  });

  it('rejects images over the pixel limit', () => {
    expect(() => assertImagePixels(65535, 65535)).toThrow(ResourceLimitError);
    expect(() => assertImagePixels(MAX_IMAGE_PIXELS + 1, 1)).toThrow(ResourceLimitError);
  });

  it('rejects zero, negative, and non-finite dimensions', () => {
    expect(() => assertImagePixels(0, 10)).toThrow(ResourceLimitError);
    expect(() => assertImagePixels(10, -1)).toThrow(ResourceLimitError);
    expect(() => assertImagePixels(NaN, 10)).toThrow(ResourceLimitError);
  });
});
