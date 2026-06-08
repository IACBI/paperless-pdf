import { test, expect, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageCount, extractText } from './pdf-utils';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => path.join(FIXTURES, name);

/** Read a Playwright download into a byte array. */
async function downloadBytes(download: Download): Promise<Uint8Array> {
  const file = await download.path();
  return new Uint8Array(await readFile(file));
}

test('home shows the privacy promise and the toolkit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/your files never leave this device/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Merge PDFs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OCR (make searchable)' })).toBeVisible();
});

test('merge: combines two PDFs into one (2 + 3 = 5 pages)', async ({ page }) => {
  await page.goto('/#/merge');
  await page.locator('input[type=file]').setInputFiles([fixture('a.pdf'), fixture('b.pdf')]);

  const mergeButton = page.getByRole('button', { name: /merge & download/i });
  await expect(mergeButton).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent('download'), mergeButton.click()]);
  expect(download.suggestedFilename()).toBe('merged.pdf');
  expect(await pageCount(await downloadBytes(download))).toBe(5);
});

test('ocr: turns a scanned PDF into a searchable one', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/ocr');
  await page.locator('input[type=file]').setInputFiles(fixture('scan.pdf'));

  const ocrButton = page.getByRole('button', { name: /make searchable/i });
  await expect(ocrButton).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 110_000 }),
    ocrButton.click(),
  ]);

  const text = await extractText(await downloadBytes(download));
  // tessdata_fast should read this large, clear text; allow for minor OCR noise.
  expect(text.toLowerCase()).toMatch(/paperless|ocr|12345/);
});
