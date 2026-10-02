import { expect, test } from '@playwright/test';
import { shot } from './helpers';

test('home page shows the hero, latest collection and bestsellers', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Latest Arrivals' })).toBeVisible();
  await expect(page.getByText('COLLECTIONS').first()).toBeVisible();
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  await shot(page, `home-${info.project.name}`);
});

test('collection filters by category and searches', async ({ page }, info) => {
  await page.goto('/collection');
  await expect(page.getByText(/\d+ products/)).toBeVisible();

  // Filters are collapsed behind a toggle on small screens.
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /FILTERS/ }).click();
  // Router updates are deferred (transitions), so click and assert on the URL rather than check().
  await page.getByRole('radio', { name: /Women/ }).click();
  await expect(page).toHaveURL(/category=women/);
  await expect(page.getByRole('radio', { name: /Women/ })).toBeChecked();
  await expect(page.getByText('25 products')).toBeVisible();

  await page.goto('/collection?search=sherwani');
  await expect(page.getByText(/RESULTS FOR/)).toBeVisible();
  // allTextContents() doesn't auto-wait, so wait for results to replace the loading skeleton first.
  const cards = page.locator('main a[href^="/product/"]');
  await expect(cards.first()).toBeVisible();
  const names = await cards.allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /sherwani/i.test(n))).toBe(true);
  await shot(page, `collection-${info.project.name}`);
});

test('unknown routes show a friendly 404', async ({ page }) => {
  await page.goto('/definitely-not-a-page');
  await expect(page.getByText("We couldn't find that page.")).toBeVisible();
});
