import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RotateTool from './RotateTool';
import { ResourceLimitError } from '../../lib/limits';

const { loadPdf, renderPageToDataUrl } = vi.hoisted(() => ({
  loadPdf: vi.fn<(bytes: Uint8Array) => Promise<unknown>>(),
  renderPageToDataUrl: vi.fn<(doc: unknown, page: number, scale?: number) => Promise<string>>(),
}));

vi.mock('../../lib/pdfjs', () => ({ loadPdf, renderPageToDataUrl }));

beforeEach(() => {
  loadPdf.mockReset();
  renderPageToDataUrl.mockReset();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

function fakeDoc(numPages: number) {
  return { numPages, destroy: vi.fn() };
}

function pdfFile(name: string): File {
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
  return file;
}

function drop(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('RotateTool document lifecycle', () => {
  it('destroys the document and resets to the dropzone when a page fails to render', async () => {
    const doc = fakeDoc(2);
    loadPdf.mockResolvedValue(doc);
    renderPageToDataUrl.mockRejectedValue(
      new ResourceLimitError('This page has an invalid size and cannot be rendered.'),
    );

    const { container } = render(<RotateTool />);
    drop(container, pdfFile('broken.pdf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid size');
    expect(doc.destroy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Drop a PDF to rotate')).toBeInTheDocument();
  });

  it('releases a document that finishes loading after unmount', async () => {
    const load = deferred<unknown>();
    loadPdf.mockReturnValue(load.promise);
    const doc = fakeDoc(1);

    const { container, unmount } = render(<RotateTool />);
    drop(container, pdfFile('a.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalled());

    unmount();
    await act(async () => load.resolve(doc));

    expect(doc.destroy).toHaveBeenCalledTimes(1);
    expect(renderPageToDataUrl).not.toHaveBeenCalled();
  });

  it('stops rendering thumbnails and releases the document on unmount mid-loop', async () => {
    const doc = fakeDoc(3);
    loadPdf.mockResolvedValue(doc);
    const thumb = deferred<string>();
    renderPageToDataUrl.mockReturnValue(thumb.promise);

    const { container, unmount } = render(<RotateTool />);
    drop(container, pdfFile('a.pdf'));
    await waitFor(() => expect(renderPageToDataUrl).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => thumb.resolve('data:image/png;base64,AAAA'));
    await act(async () => {});

    expect(renderPageToDataUrl).toHaveBeenCalledTimes(1);
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest of two overlapping loads and releases the stale one', async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    loadPdf.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);
    renderPageToDataUrl.mockResolvedValue('data:image/png;base64,AAAA');
    const docA = fakeDoc(1);
    const docB = fakeDoc(1);

    const { container } = render(<RotateTool />);
    drop(container, pdfFile('a.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(1));
    drop(container, pdfFile('b.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(2));

    await act(async () => b.resolve(docB));
    await screen.findByText('b.pdf');
    expect(docB.destroy).toHaveBeenCalledTimes(1);

    await act(async () => a.resolve(docA));
    expect(docA.destroy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.queryByText('a.pdf')).toBeNull();
    expect(screen.queryByText(/Opening PDF/)).toBeNull();
  });
});
