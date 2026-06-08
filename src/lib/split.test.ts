import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  parseRanges,
  rangesToIndices,
  splitByRanges,
  extractPages,
  type PageRange,
} from './split';

async function makePdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([100, 100]);
  return doc.save();
}
async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('parseRanges', () => {
  it('parses single pages and ranges', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual<PageRange[]>([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
    ]);
  });

  it('is whitespace tolerant', () => {
    expect(parseRanges('  2 ,  4 - 6 ', 10)).toEqual<PageRange[]>([
      { start: 2, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it('expands open-ended ranges using pageCount', () => {
    expect(parseRanges('8-', 10)).toEqual<PageRange[]>([{ start: 8, end: 10 }]);
    expect(parseRanges('-3', 10)).toEqual<PageRange[]>([{ start: 1, end: 3 }]);
  });

  it('sorts and merges overlapping/adjacent ranges', () => {
    expect(parseRanges('5, 1-4', 10)).toEqual<PageRange[]>([{ start: 1, end: 5 }]);
    expect(parseRanges('1-2, 2-3', 10)).toEqual<PageRange[]>([{ start: 1, end: 3 }]);
  });

  it('rejects malformed tokens', () => {
    expect(() => parseRanges('1-a', 10)).toThrow(/not a valid/i);
    expect(() => parseRanges('', 10)).toThrow(/at least one/i);
  });

  it('rejects out-of-range and inverted ranges', () => {
    expect(() => parseRanges('11', 10)).toThrow(/out of range/i);
    expect(() => parseRanges('5-2', 10)).toThrow(/start after its end/i);
  });
});

describe('rangesToIndices', () => {
  it('flattens to sorted, de-duplicated 0-based indices', () => {
    expect(rangesToIndices([{ start: 1, end: 3 }, { start: 2, end: 2 }])).toEqual([0, 1, 2]);
  });
});

describe('splitByRanges', () => {
  it('produces one document per range with the right page counts', async () => {
    const pdf = await makePdf(10);
    const outputs = await splitByRanges(pdf, [
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 8, end: 10 },
    ]);
    expect(outputs).toHaveLength(3);
    expect(await pageCount(outputs[0])).toBe(3);
    expect(await pageCount(outputs[1])).toBe(1);
    expect(await pageCount(outputs[2])).toBe(3);
  });

  it('throws on an invalid range for the document', async () => {
    const pdf = await makePdf(3);
    await expect(splitByRanges(pdf, [{ start: 1, end: 9 }])).rejects.toThrow(/invalid/i);
  });

  it('throws when no ranges are given', async () => {
    const pdf = await makePdf(3);
    await expect(splitByRanges(pdf, [])).rejects.toThrow(/no ranges/i);
  });
});

describe('extractPages', () => {
  it('returns a single document with the union of selected pages', async () => {
    const pdf = await makePdf(10);
    const out = await extractPages(pdf, [
      { start: 1, end: 2 },
      { start: 9, end: 10 },
    ]);
    expect(await pageCount(out)).toBe(4);
  });
});
