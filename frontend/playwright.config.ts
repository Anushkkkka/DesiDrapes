import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack.
 *   Local dev:  npm run dev:backend & npm run dev:frontend, then `npm run e2e`
 *   Docker:     E2E_BASE_URL=http://localhost:3000 npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  // Tests share one seeded database, so run strictly one at a time. fullyParallel:false
  // alone still runs different files in parallel workers (and multiplies browser memory).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /storefront/ },
  ],
});
