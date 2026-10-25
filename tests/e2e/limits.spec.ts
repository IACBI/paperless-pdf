import { test, expect, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/**
 * Regression tests for the resource limits in src/lib/limits.ts. Each PDF is
 * built in memory with pdf-lib, so nothing is fetched and no fixture is stored.
 * The app must reject the input with a readable message and keep the tab alive.
 */

/** One page whose MediaBox is the largest size the PDF spec allows (14400 pt). */
async function hugePagePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([14400, 14400]);
  return Buffer.from(await doc.save());
}

/** A PDF with more pages than MAX_PAGE_COUNT (1000). */
async function tooManyPagesPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 1001; i++) doc.addPage([72, 72]);
  return Buffer.from(await doc.save());
}

/** Fail the test if the page throws an uncaught error while the test runs. */
function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
}

test('pdf-to-png: a 14400×14400 pt page is refused with a limit message, not a crash', async ({
  page,
}) => {
  const pageErrors = trackPageErrors(page);
  await page.goto('/#/pdf-to-png');

  await page.locator('input[type=file]').setInputFiles({
    name: 'huge-page.pdf',
    mimeType: 'application/pdf',
    buffer: await hugePagePdf(),
  });

  // Opening the file is cheap (no rendering), so the export button appears.
  const exportButton = page.getByRole('button', { name: /export png/i });
  await expect(exportButton).toBeEnabled();

  await exportButton.click();

  // The default resolution is 2×, so the canvas is 28800 × 28800 px: far above
  // MAX_RENDER_PIXELS (40M). Even at 1× (14400 × 14400 = 207M px) it would fail.
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(/too large to render/i);
  await expect(alert).toContainText('28800×28800');

  // The tool is still usable after the refusal.
  await expect(exportButton).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('compress: the same huge page is refused with a limit message', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto('/#/compress');

  await page.locator('input[type=file]').setInputFiles({
    name: 'huge-page.pdf',
    mimeType: 'application/pdf',
    buffer: await hugePagePdf(),
  });

  const compressButton = page.getByRole('button', { name: /compress/i }).last();
  await expect(compressButton).toBeEnabled();
  await compressButton.click();

  await expect(page.getByRole('alert')).toContainText(/too large to render/i);
  expect(pageErrors).toEqual([]);
});

test('pdf-to-png: a PDF over the page-count limit is rejected on open', async ({ page }) => {
  await page.goto('/#/pdf-to-png');

  await page.locator('input[type=file]').setInputFiles({
    name: 'many-pages.pdf',
    mimeType: 'application/pdf',
    buffer: await tooManyPagesPdf(),
  });

  await expect(page.getByRole('alert')).toContainText(/has 1001 pages; the limit is 1000/i);
  // The file never loaded, so the drop zone is still offered.
  await expect(page.getByRole('button', { name: /export png/i })).toHaveCount(0);
});

test('pdf-to-png: a non-PDF file is rejected without being opened', async ({ page }) => {
  await page.goto('/#/pdf-to-png');

  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a pdf'),
  });

  await expect(page.getByRole('alert')).toHaveText(/please choose a pdf file/i);
});
