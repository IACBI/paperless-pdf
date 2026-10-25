import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceLimitError } from './limits';

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?worker', () => ({ default: class {} }));

const { loadPdf, renderPageToCanvas, renderPageToBlob, renderPageToDataUrl } = await import(
  './pdfjs'
);

interface FakePage {
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
}

function fakePage(width = 100, height = 200): FakePage {
  return {
    getViewport: vi.fn(() => ({ width, height })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
  };
}

function fakeDocument(page: FakePage) {
  return { numPages: 1, getPage: vi.fn(async () => page), destroy: vi.fn() };
}

// jsdom has no 2D canvas, so the context and encoder are stubbed. The last
// canvas handed out is recorded to check whether its bitmap was released.
const canvases: HTMLCanvasElement[] = [];
const lastCanvas = () => canvases[canvases.length - 1] as HTMLCanvasElement | undefined;

beforeEach(() => {
  canvases.length = 0;
  getDocument.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    canvases.push(this);
    return {} as CanvasRenderingContext2D;
  });
});

describe('loadPdf', () => {
  it('destroys the document when it has too many pages', async () => {
    const doc = { numPages: 5000, destroy: vi.fn() };
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    await expect(loadPdf(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(ResourceLimitError);
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('renderPageToCanvas', () => {
  it('cleans up the page after a successful render', async () => {
    const page = fakePage();
    const canvas = await renderPageToCanvas(fakeDocument(page) as never, 1, 1);
    expect(canvas.width).toBe(100);
    expect(page.cleanup).toHaveBeenCalledTimes(1);
  });

  it('cleans up the page and releases the canvas when render throws', async () => {
    const page = fakePage();
    page.render.mockImplementation(() => ({ promise: Promise.reject(new Error('boom')) }));

    await expect(renderPageToCanvas(fakeDocument(page) as never, 1, 1)).rejects.toThrow('boom');
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(lastCanvas()?.width).toBe(0);
    expect(lastCanvas()?.height).toBe(0);
  });

  it('rejects an invalid page size before allocating a canvas', async () => {
    const page = fakePage(0, 200);
    await expect(renderPageToCanvas(fakeDocument(page) as never, 1, 1)).rejects.toBeInstanceOf(
      ResourceLimitError,
    );
    expect(canvases).toHaveLength(0);
    expect(page.render).not.toHaveBeenCalled();
    expect(page.cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('canvas release on encoder failure', () => {
  it('renderPageToBlob releases the canvas when toBlob yields null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      callback: BlobCallback,
    ) {
      callback(null);
    });
    const page = fakePage();

    await expect(renderPageToBlob(fakeDocument(page) as never, 1, 1)).rejects.toThrow(
      'canvas.toBlob returned null',
    );
    expect(lastCanvas()?.width).toBe(0);
    expect(lastCanvas()?.height).toBe(0);
  });

  it('renderPageToDataUrl releases the canvas when toDataURL throws', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      throw new Error('encode failed');
    });
    const page = fakePage();

    await expect(renderPageToDataUrl(fakeDocument(page) as never, 1, 1)).rejects.toThrow(
      'encode failed',
    );
    expect(lastCanvas()?.width).toBe(0);
    expect(lastCanvas()?.height).toBe(0);
  });
});
