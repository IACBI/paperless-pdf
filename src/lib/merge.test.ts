import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, type PageRef } from './merge';

/** Build an in-memory PDF with `n` blank pages (no fixtures, no network). */
async function makePdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([200, 200]);
  return doc.save();
}

/** Count pages in a serialized PDF by re-parsing it. */
async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('mergePdfs', () => {
  it('concatenates all pages of all sources by default', async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const merged = await mergePdfs([a, b]);
    expect(await pageCount(merged)).toBe(5);
  });

  it('handles a single source', async () => {
    const a = await makePdf(4);
    const merged = await mergePdfs([a]);
    expect(await pageCount(merged)).toBe(4);
  });

  it('respects an explicit page order across documents', async () => {
    const a = await makePdf(2); // pages a0, a1
    const b = await makePdf(2); // pages b0, b1
    const order: PageRef[] = [
      { sourceIndex: 1, pageIndex: 0 },
      { sourceIndex: 0, pageIndex: 1 },
      { sourceIndex: 1, pageIndex: 1 },
    ];
    const merged = await mergePdfs([a, b], order);
    expect(await pageCount(merged)).toBe(3);
  });

  it('deletes pages omitted from the order', async () => {
    const a = await makePdf(3);
    const order: PageRef[] = [
      { sourceIndex: 0, pageIndex: 0 },
      { sourceIndex: 0, pageIndex: 2 },
    ];
    const merged = await mergePdfs([a], order);
    expect(await pageCount(merged)).toBe(2);
  });

  it('duplicates a page that appears twice in the order', async () => {
    const a = await makePdf(1);
    const order: PageRef[] = [
      { sourceIndex: 0, pageIndex: 0 },
      { sourceIndex: 0, pageIndex: 0 },
    ];
    const merged = await mergePdfs([a], order);
    expect(await pageCount(merged)).toBe(2);
  });

  it('throws when given no sources', async () => {
    await expect(mergePdfs([])).rejects.toThrow(/at least one source/i);
  });

  it('throws on an out-of-range page index', async () => {
    const a = await makePdf(1);
    await expect(
      mergePdfs([a], [{ sourceIndex: 0, pageIndex: 5 }]),
    ).rejects.toThrow(/out of range/i);
  });

  it('throws on an invalid source index', async () => {
    const a = await makePdf(1);
    await expect(
      mergePdfs([a], [{ sourceIndex: 9, pageIndex: 0 }]),
    ).rejects.toThrow(/invalid sourceIndex/i);
  });
});
