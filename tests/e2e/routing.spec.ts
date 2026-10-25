import { test, expect } from '@playwright/test';

/**
 * Hash-router navigation: nav links, back/forward, deep links, and the
 * catch-all placeholder route for unknown tools (`:tool` in src/App.tsx).
 */

const toolNav = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Tools' });

test('nav links change the route and mark the active tool', async ({ page }) => {
  await page.goto('/');
  await toolNav(page).getByRole('link', { name: 'Rotate pages' }).click();

  await expect(page).toHaveURL(/#\/rotate$/);
  await expect(toolNav(page).getByRole('link', { name: 'Rotate pages' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(toolNav(page).getByRole('link', { name: 'Merge PDFs' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/(#\/)?$/);
  await expect(
    page.getByRole('heading', { name: 'Private PDF tools that run entirely in your browser' }),
  ).toBeVisible();
});

test('home card links navigate to the tool', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Tools' })
    .getByRole('link', { name: /Split PDF/ })
    .click();
  await expect(page).toHaveURL(/#\/split$/);
  await expect(toolNav(page).getByRole('link', { name: 'Split PDF' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('deep link to a tool renders it directly', async ({ page }) => {
  await page.goto('/#/merge');
  await expect(page.locator('input[type=file]')).toBeAttached();
  await expect(toolNav(page).getByRole('link', { name: 'Merge PDFs' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('unknown tool path shows the not-found placeholder and can return home', async ({ page }) => {
  await page.goto('/#/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

  await page.getByRole('link', { name: '← Back to all tools' }).click();
  await expect(page).toHaveURL(/\/(#\/)?$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Tools' }).getByRole('link', { name: /Merge PDFs/ }),
  ).toBeVisible();
});

test('unknown nested path shows the not-found placeholder', async ({ page }) => {
  await page.goto('/#/tools/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
