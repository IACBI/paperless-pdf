import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { normalizeAngle, rotatePages, rotateAll } from './rotate';

async function makePdf(n: number, initialRotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const page = doc.addPage([100, 200]);
    if (initialRotation) page.setRotation(degrees(initialRotation));
  }
  return doc.save();
}

async function anglesOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getRotation().angle);
}

describe('normalizeAngle', () => {
  it('snaps to 0/90/180/270 and wraps negatives', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(89)).toBe(90); // snaps to nearest 90
  });
});

describe('rotatePages', () => {
  it('adds the delta to the chosen pages only', async () => {
    const pdf = await makePdf(3);
    const out = await rotatePages(pdf, new Map([[1, 90]]));
    expect(await anglesOf(out)).toEqual([0, 90, 0]);
  });

  it('accumulates onto existing rotation and wraps at 360', async () => {
    const pdf = await makePdf(1, 270);
    const out = await rotatePages(pdf, new Map([[0, 180]]));
    expect(await anglesOf(out)).toEqual([90]); // 270 + 180 = 450 → 90
  });

  it('throws on an out-of-range page', async () => {
    const pdf = await makePdf(1);
    await expect(rotatePages(pdf, new Map([[5, 90]]))).rejects.toThrow(/out of range/i);
  });
});

describe('rotateAll', () => {
  it('rotates every page by the same delta', async () => {
    const pdf = await makePdf(3);
    const out = await rotateAll(pdf, 90);
    expect(await anglesOf(out)).toEqual([90, 90, 90]);
  });
});
