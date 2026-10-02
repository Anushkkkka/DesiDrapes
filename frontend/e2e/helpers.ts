import { expect, type Page } from '@playwright/test';

export const CUSTOMER = { email: 'customer@desidrapes.com', password: 'Customer@123' };
export const ADMIN = { email: 'admin@desidrapes.com', password: 'Admin@12345' };

export async function login(page: Page, account: { email: string; password: string }, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens the first in-stock product and selects its first available size. */
export async function openInStockProduct(page: Page) {
  await page.goto('/collection?inStock=true&sort=popular');
  await page.locator('main a[href^="/product/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const size = page.locator('button[aria-pressed]:not([disabled])').first();
  await size.click();
  return (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
}

export const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
