import { expect, test } from '@playwright/test';
import { ADMIN, CUSTOMER, login, shot } from './helpers';

test('admin sees the dashboard, orders and product editor', async ({ page }) => {
  await login(page, ADMIN, '/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total revenue')).toBeVisible();
  await expect(page.getByText('Revenue, last 30 days')).toBeVisible();
  await shot(page, 'admin-dashboard');

  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders' }).click();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await shot(page, 'admin-orders');

  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Products' }).click();
  await page.getByRole('link', { name: 'Edit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate with AI' }).click();
  await expect(page.getByLabel('Description', { exact: true })).not.toBeEmpty();
  await shot(page, 'admin-product-form');
});

test('customers cannot open the admin area', async ({ page }) => {
  await login(page, CUSTOMER);
  await page.goto('/admin');
  await expect(page).toHaveURL('/');
});
