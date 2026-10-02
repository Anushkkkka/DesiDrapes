import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Satisfies config validation in src/config/env.ts. Unit tests never connect to these.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/desidrapes_test',
      JWT_SECRET: 'test-secret-at-least-16-chars',
      REDIS_URL: '',
      N8N_WEBHOOK_BASE_URL: '',
      STRIPE_SECRET_KEY: '',
      AI_API_KEY: '',
    },
  },
});
