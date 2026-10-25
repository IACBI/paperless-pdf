import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PDFDocumentProxy } from '../lib/pdfjs';

const renderPageToBlob = vi.fn<(doc: unknown, page: number, scale: number) => Promise<Blob>>();

vi.mock('../lib/pdfjs', () => ({
  renderPageToBlob: (doc: unknown, page: number, scale: number) => renderPageToBlob(doc, page, scale),
}));

// Imported after the mock so the component picks up the stubbed renderer.
const { default: PageThumbnail } = await import('./PageThumbnail');

const fakeDoc = {} as PDFDocumentProxy;

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

interface FakeObserver {
  callback: IOCallback;
  rootMargin: string;
  targets: Element[];
  disconnect: Mock;
}

let observers: FakeObserver[] = [];

function installIntersectionObserver() {
  observers = [];
  class FakeIO {
    readonly record: FakeObserver;
    constructor(callback: IOCallback, options?: IntersectionObserverInit) {
      this.record = {
        callback,
        rootMargin: options?.rootMargin ?? '0px',
        targets: [],
        disconnect: vi.fn(),
      };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.targets.push(el);
    }
    disconnect() {
      this.record.disconnect();
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
}

function observerFor(el: Element, rootMargin: string): FakeObserver {
  const match = observers.find((o) => o.rootMargin === rootMargin && o.targets.includes(el));
  if (!match) throw new Error(`no observer with rootMargin ${rootMargin} for this tile`);
  return match;
}

/** Simulates the browser reporting that a tile crossed one observer's edge. */
async function report(el: Element, rootMargin: string, isIntersecting: boolean) {
  await act(async () => {
    observerFor(el, rootMargin).callback([{ isIntersecting }]);
  });
}

/** A tile scrolling into view crosses both observers' edges, in that order. */
async function enter(el: Element) {
  await report(el, '1500px', true);
  await report(el, '200px', true);
}

function mountTile(pageNumber: number): HTMLElement {
  const { container } = render(
    <PageThumbnail doc={fakeDoc} pageNumber={pageNumber} scale={0.4} />,
  );
  return container.firstElementChild as HTMLElement;
}

describe('PageThumbnail', () => {
  // jsdom does not implement object URLs, so they are stubbed on the real URL class.
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let revoke: Mock;
  let create: Mock;

  beforeEach(() => {
    renderPageToBlob.mockReset();
    renderPageToBlob.mockImplementation(async () => new Blob(['png'], { type: 'image/png' }));
    create = vi.fn(() => 'blob:thumb');
    revoke = vi.fn();
    URL.createObjectURL = create as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revoke;
  });

  afterEach(() => {
    // Unmount before restoring URL, so the cleanup that revokes the URL still sees the stub.
    cleanup();
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('renders eagerly when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<PageThumbnail doc={fakeDoc} pageNumber={3} scale={0.4} />);
    await waitFor(() => expect(renderPageToBlob).toHaveBeenCalledWith(fakeDoc, 3, 0.4));
    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());
    expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:thumb');
  });

  it('does not render until the tile is near the viewport', async () => {
    installIntersectionObserver();
    const el = mountTile(1);
    await act(async () => {});
    expect(renderPageToBlob).not.toHaveBeenCalled();
    expect(el.querySelector('img')).toBeNull();

    await report(el, '200px', false);
    expect(renderPageToBlob).not.toHaveBeenCalled();

    await enter(el);
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull());
    expect(renderPageToBlob).toHaveBeenCalledTimes(1);
    // The tile keeps watching for the rest of its life, so it can react to scrolling.
    expect(observerFor(el, '200px').disconnect).not.toHaveBeenCalled();
  });

  it('cancels a queued render when the tile leaves before its turn', async () => {
    installIntersectionObserver();
    const finishers: Array<() => void> = [];
    renderPageToBlob.mockImplementation(
      () => new Promise<Blob>((resolve) => finishers.push(() => resolve(new Blob(['png'])))),
    );
    // Two tiles occupy both render slots of the shared queue.
    const busyA = mountTile(1);
    const busyB = mountTile(2);
    const queued = mountTile(3);
    await enter(busyA);
    await enter(busyB);
    await enter(queued);
    expect(renderPageToBlob).toHaveBeenCalledTimes(2);

    await report(queued, '200px', false);
    for (const finish of finishers.splice(0)) finish();
    await act(async () => {});

    expect(renderPageToBlob).toHaveBeenCalledTimes(2);
    expect(renderPageToBlob.mock.calls.map((call) => call[1])).not.toContain(3);
    expect(queued.querySelector('img')).toBeNull();
  });

  it('discards a running render that finishes after the tile left', async () => {
    installIntersectionObserver();
    let finish!: (blob: Blob) => void;
    renderPageToBlob.mockImplementation(
      () => new Promise<Blob>((resolve) => (finish = resolve)),
    );
    const el = mountTile(1);
    await enter(el);
    await waitFor(() => expect(renderPageToBlob).toHaveBeenCalledTimes(1));

    await report(el, '200px', false);
    await act(async () => finish(new Blob(['late'])));

    expect(create).not.toHaveBeenCalled();
    expect(el.querySelector('img')).toBeNull();
  });

  it('keeps the image when the tile scrolls just past the render edge', async () => {
    installIntersectionObserver();
    const el = mountTile(1);
    await enter(el);
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull());

    await report(el, '200px', false);
    expect(revoke).not.toHaveBeenCalled();
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('revokes the object URL once the tile is far off-screen', async () => {
    installIntersectionObserver();
    const el = mountTile(1);
    await enter(el);
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull());

    await report(el, '200px', false);
    await report(el, '1500px', false);
    expect(revoke).toHaveBeenCalledWith('blob:thumb');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('re-renders when a released tile comes back into view', async () => {
    installIntersectionObserver();
    const el = mountTile(1);
    await enter(el);
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull());
    await report(el, '200px', false);
    await report(el, '1500px', false);
    expect(el.querySelector('img')).toBeNull();

    await enter(el);
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull());
    expect(renderPageToBlob).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('revokes the object URL on unmount', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { unmount } = render(<PageThumbnail doc={fakeDoc} pageNumber={1} scale={0.4} />);
    await waitFor(() => expect(create).toHaveBeenCalled());
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:thumb');
  });

  it('ignores a render that finishes after unmount', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    let finish!: (blob: Blob) => void;
    renderPageToBlob.mockImplementation(
      () => new Promise<Blob>((resolve) => (finish = resolve)),
    );
    const { unmount } = render(<PageThumbnail doc={fakeDoc} pageNumber={1} scale={0.4} />);
    await waitFor(() => expect(renderPageToBlob).toHaveBeenCalled());
    unmount();
    await act(async () => finish(new Blob(['late'])));
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the placeholder when rendering fails', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderPageToBlob.mockRejectedValue(new Error('render failed'));
    const { container } = render(<PageThumbnail doc={fakeDoc} pageNumber={1} scale={0.4} />);
    await waitFor(() => expect(renderPageToBlob).toHaveBeenCalled());
    await act(async () => {});
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
