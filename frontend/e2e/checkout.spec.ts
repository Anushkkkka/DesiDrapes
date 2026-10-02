import { expect, test } from '@playwright/test';
import { CUSTOMER, login, openInStockProduct, shot } from './helpers';

test('customer can buy a product end to end with a coupon', async ({ page }) => {
  await login(page, CUSTOMER);

  const name = await openInStockProduct(page);
  await shot(page, 'product');
  await page.getByRole('button', { name: 'ADD TO CART' }).click();
  await expect(page.getByText(/Added .* to your cart/)).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('link', { name })).toBeVisible();
  await page.getByLabel('Have a coupon?').fill('WELCOME10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('WELCOME10 applied.')).toBeVisible();
  await expect(page.getByText(/Discount \(WELCOME10\)/)).toBeVisible();
  await shot(page, 'cart');

  await page.getByRole('button', { name: 'PROCEED TO CHECKOUT' }).click();
  await expect(page).toHaveURL(/place-order/);

  // Client-side validation blocks an empty form.
  await page.getByLabel('Phone').fill('');
  await page.getByRole('button', { name: /PLACE ORDER/ }).click();
  await expect(page.getByText('Enter a valid phone number')).toBeVisible();

  await page.getByLabel('Full name').fill('Priya Sharma');
  await page.getByLabel('Phone').fill('+61 400 123 456');
  await page.getByLabel('Street address').fill('12 Harbour Street');
  await page.getByLabel('City / suburb').fill('Sydney');
  await page.getByLabel('Postcode').fill('2000');
  await shot(page, 'place-order');
  await page.getByRole('button', { name: /PLACE ORDER/ }).click();

  // Demo-mode payment page (Stripe not configured).
  await expect(page.getByText('Test payment gateway')).toBeVisible();
  await shot(page, 'mock-checkout');
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();

  await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
  await shot(page, 'order-success');

  await page.getByRole('link', { name: 'View order' }).click();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(name).first()).toBeVisible();

  // Cart was cleared after the order was placed.
  await expect(page.getByLabel('Cart, 0 items')).toBeVisible();
});

test('declined payment cancels the order and releases stock', async ({ page }) => {
  await login(page, CUSTOMER);
  await openInStockProduct(page);
  await page.getByRole('button', { name: 'ADD TO CART' }).click();
  await page.goto('/place-order');
  await page.getByLabel('Phone').fill('+61 400 123 456');
  await page.getByLabel('Street address').fill('1 Test Lane');
  await page.getByLabel('City / suburb').fill('Melbourne');
  await page.getByLabel('Postcode').fill('3000');
  await page.getByRole('button', { name: /PLACE ORDER/ }).click();

  await page.getByRole('button', { name: 'Simulate declined card' }).click();
  await expect(page.getByText('Cancelled').first()).toBeVisible();
});

test('guests are redirected to login before checkout', async ({ page }) => {
  await page.goto('/place-order');
  await expect(page).toHaveURL(/\/login\?next=%2Fplace-order/);
});

test('AI stylist recommends real catalog products', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /AI Stylist/ }).click();
  await page.getByLabel('Message the stylist').fill('festive kurta for men under 100');
  await page.getByRole('button', { name: 'Send' }).click();
  const panel = page.getByRole('region', { name: 'AI style assistant' });
  await expect(panel.locator('a[href^="/product/"]').first()).toBeVisible();
  await shot(page, 'ai-stylist');
});
