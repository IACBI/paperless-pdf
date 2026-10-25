import { PDFDocument } from 'pdf-lib';
import { assertInputSize, assertPageCount } from './limits';

/** An inclusive 1-based page range. */
export interface PageRange {
  start: number;
  end: number;
}

/**
 * Parse a human range string into normalized, sorted, merged 1-based ranges.
 *
 * Accepts comma/space separated tokens like:
 *   "1-3, 5, 8-"      → [1-3], [5-5], [8-pageCount]
 *   "  2 , 1 - 4 "    → [1-4]   (whitespace tolerant, overlaps merged)
 *   "-3"              → [1-3]   (open start)
 *
 * @param input      The user string.
 * @param pageCount  Total pages, used to clamp/expand open-ended ranges.
 * @throws if a token is malformed or refers to pages outside 1..pageCount.
 */
export function parseRanges(input: string, pageCount: number): PageRange[] {
  if (pageCount < 1) throw new Error('parseRanges: pageCount must be >= 1');

  const tokens = input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) throw new Error('Enter at least one page or range.');

  const ranges: PageRange[] = [];

  for (const token of tokens) {
    const m = token.match(/^(\d+)?\s*-\s*(\d+)?$/) ?? token.match(/^(\d+)$/);
    if (!m) throw new Error(`"${token}" is not a valid page or range.`);

    let start: number;
    let end: number;
    if (m.length === 2) {
      // single page, e.g. "5"
      start = end = Number(m[1]);
    } else {
      // range, e.g. "1-3", "8-", "-3"
      start = m[1] ? Number(m[1]) : 1;
      end = m[2] ? Number(m[2]) : pageCount;
    }

    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`"${token}" is out of range (document has ${pageCount} pages).`);
    }
    if (start > end) throw new Error(`"${token}" has its start after its end.`);

    ranges.push({ start, end });
  }

  return mergeRanges(ranges);
}

/** Sort and coalesce overlapping/adjacent ranges. */
function mergeRanges(ranges: PageRange[]): PageRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: PageRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** Expand ranges to a flat, de-duplicated, sorted list of 0-based page indices. */
export function rangesToIndices(ranges: PageRange[]): number[] {
  const set = new Set<number>();
  for (const { start, end } of ranges) {
    for (let p = start; p <= end; p++) set.add(p - 1);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Split a PDF into one new document per range. Each output contains exactly the
 * pages of that range, in order. Pure; runs in-browser via pdf-lib.
 */
export async function splitByRanges(
  bytes: Uint8Array,
  ranges: PageRange[],
): Promise<Uint8Array[]> {
  if (ranges.length === 0) throw new Error('splitByRanges: no ranges provided');

  assertInputSize(bytes.byteLength);
  const src = await PDFDocument.load(bytes);
  const pageCount = src.getPageCount();
  assertPageCount(pageCount);

  const outputs: Uint8Array[] = [];
  for (const { start, end } of ranges) {
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(`Range ${start}-${end} is invalid for a ${pageCount}-page document.`);
    }
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    outputs.push(await out.save());
  }
  return outputs;
}

/**
 * Convenience: split into a single document containing only the selected pages
 * (useful for "extract these pages" rather than "split into N files").
 */
export async function extractPages(
  bytes: Uint8Array,
  ranges: PageRange[],
): Promise<Uint8Array> {
  assertInputSize(bytes.byteLength);
  const src = await PDFDocument.load(bytes);
  assertPageCount(src.getPageCount());
  const indices = rangesToIndices(ranges).filter((i) => i < src.getPageCount());
  if (indices.length === 0) throw new Error('No pages selected.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}
