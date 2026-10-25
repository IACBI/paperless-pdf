import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SplitTool from './SplitTool';
import { ResourceLimitError } from '../../lib/limits';

const { loadPdf } = vi.hoisted(() => ({
  loadPdf: vi.fn<(bytes: Uint8Array) => Promise<unknown>>(),
}));

vi.mock('../../lib/pdfjs', () => ({ loadPdf }));
vi.mock('../../components/PageThumbnail', () => ({ default: () => null }));

beforeEach(() => {
  loadPdf.mockReset();
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

describe('SplitTool document lifecycle', () => {
  it('shows the error and keeps no document when loading fails', async () => {
    loadPdf.mockRejectedValue(new ResourceLimitError('The PDF has 5000 pages; the limit is 1000.'));

    const { container } = render(<SplitTool />);
    drop(container, pdfFile('big.pdf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('5000 pages');
    expect(screen.getByText('Drop a PDF to split')).toBeInTheDocument();
  });

  it('releases a document that finishes loading after unmount', async () => {
    const load = deferred<unknown>();
    loadPdf.mockReturnValue(load.promise);
    const doc = fakeDoc(2);

    const { container, unmount } = render(<SplitTool />);
    drop(container, pdfFile('a.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalled());

    unmount();
    await act(async () => load.resolve(doc));

    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it('adopts the latest of two overlapping loads and releases the stale one', async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    loadPdf.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);
    const docA = fakeDoc(2);
    const docB = fakeDoc(3);

    const { container, unmount } = render(<SplitTool />);
    drop(container, pdfFile('a.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(1));
    drop(container, pdfFile('b.pdf'));
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(2));

    await act(async () => b.resolve(docB));
    await screen.findByText('b.pdf');

    await act(async () => a.resolve(docA));
    expect(docA.destroy).toHaveBeenCalledTimes(1);
    expect(docB.destroy).not.toHaveBeenCalled();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();

    unmount();
    expect(docB.destroy).toHaveBeenCalledTimes(1);
  });
});
