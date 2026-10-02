import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack.
 *   Local dev:  npm run dev:backend & npm run dev:frontend, then `npm run e2e`
 *   Docker:     E2E_BASE_URL=http://localhost:3000 npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false, // tests share one seeded database
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
