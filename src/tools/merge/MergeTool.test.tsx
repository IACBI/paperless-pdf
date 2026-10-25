import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MergeTool from './MergeTool';

const { loadPdf, mergePdfs, downloadBlob } = vi.hoisted(() => ({
  loadPdf: vi.fn<(bytes: Uint8Array) => Promise<unknown>>(),
  mergePdfs: vi.fn<(sources: Uint8Array[], order?: unknown) => Promise<Uint8Array>>(),
  downloadBlob: vi.fn(),
}));

vi.mock('../../lib/pdfjs', () => ({ loadPdf }));
vi.mock('../../lib/merge', () => ({ mergePdfs }));
vi.mock('../../lib/download', () => ({ downloadBlob }));
vi.mock('../../components/PageThumbnail', () => ({ default: () => null }));

beforeEach(() => {
  loadPdf.mockReset();
  mergePdfs.mockReset();
  downloadBlob.mockReset();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

function fakeDoc(numPages: number) {
  return { numPages, destroy: vi.fn() };
}

// Counts reads so a test can tell when the bytes are fetched from the File.
function pdfFile(name: string) {
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
  Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer });
  return { file, arrayBuffer };
}

function drop(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('MergeTool document lifecycle', () => {
  it('releases a document that finishes loading after unmount', async () => {
    const load = deferred<unknown>();
    loadPdf.mockReturnValue(load.promise);
    const doc = fakeDoc(2);

    const { container, unmount } = render(<MergeTool />);
    drop(container, [pdfFile('a.pdf').file]);
    await waitFor(() => expect(loadPdf).toHaveBeenCalled());

    unmount();
    await act(async () => load.resolve(doc));

    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps both overlapping loads, then releases everything on unmount', async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    loadPdf.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);
    const docA = fakeDoc(1);
    const docB = fakeDoc(2);

    const { container, unmount } = render(<MergeTool />);
    drop(container, [pdfFile('a.pdf').file]);
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(1));
    drop(container, [pdfFile('b.pdf').file]);
    await waitFor(() => expect(loadPdf).toHaveBeenCalledTimes(2));

    await act(async () => b.resolve(docB));
    await act(async () => a.resolve(docA));

    expect(screen.getByText(/3 pages from 2 files/)).toBeInTheDocument();
    expect(docA.destroy).not.toHaveBeenCalled();
    expect(docB.destroy).not.toHaveBeenCalled();

    unmount();
    expect(docA.destroy).toHaveBeenCalledTimes(1);
    expect(docB.destroy).toHaveBeenCalledTimes(1);
  });

  it('disables Clear all while a file is loading', async () => {
    const load = deferred<unknown>();
    loadPdf.mockReturnValue(load.promise);

    const { container } = render(<MergeTool />);
    drop(container, [pdfFile('a.pdf').file]);
    await waitFor(() => expect(loadPdf).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();

    await act(async () => load.resolve(fakeDoc(1)));
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeEnabled();
  });

  it('destroys loaded documents on Clear all', async () => {
    const doc = fakeDoc(1);
    loadPdf.mockResolvedValue(doc);

    const { container } = render(<MergeTool />);
    drop(container, [pdfFile('a.pdf').file]);
    await screen.findByText(/1 page from 1 file/);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(doc.destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/from 1 file/)).toBeNull();
  });

  it('re-reads the File bytes only when the user merges', async () => {
    loadPdf.mockResolvedValue(fakeDoc(1));
    mergePdfs.mockResolvedValue(new Uint8Array([1]));
    const { file, arrayBuffer } = pdfFile('a.pdf');

    const { container } = render(<MergeTool />);
    drop(container, [file]);
    await screen.findByText(/1 page from 1 file/);
    expect(arrayBuffer).toHaveBeenCalledTimes(1);
    expect(mergePdfs).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Merge & download' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());

    expect(arrayBuffer).toHaveBeenCalledTimes(2);
    const [sources] = mergePdfs.mock.calls[0];
    expect(sources).toHaveLength(1);
    expect(sources[0]).toBeInstanceOf(Uint8Array);
  });
});
