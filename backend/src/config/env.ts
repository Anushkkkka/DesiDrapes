import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// Local dev keeps a single .env at the repo root; real env vars (Docker, CI) take precedence.
config({ path: [path.resolve('.env'), path.resolve('../.env')], quiet: true });

/** Treats empty strings and the `.env.example` placeholders as "not configured". */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() && !/placeholder/i.test(v) ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  REDIS_URL: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  N8N_WEBHOOK_BASE_URL: optional,
  /** Shared secret n8n sends in `x-api-key` when it calls back into the API. */
  N8N_API_KEY: optional,
  ADMIN_ALERT_EMAIL: z.string().email().default('admin@desidrapes.local'),
  AI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: optional,
  AI_MODEL: z.string().default('gpt-4o-mini'),
  SHIPPING_FLAT_FEE: z.coerce.number().default(10),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().default(150),
  LOG_LEVEL: z.string().default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).optional(),
  /** Defaults to true in production; set false to run the prod build over plain http://localhost. */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a half-configured server is worse than one that refuses to start.
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  prettyLogs: (parsed.data.LOG_FORMAT ?? (parsed.data.NODE_ENV === 'production' ? 'json' : 'pretty')) === 'pretty',
  cookieSecure: parsed.data.COOKIE_SECURE
    ? parsed.data.COOKIE_SECURE === 'true'
    : parsed.data.NODE_ENV === 'production',
  /** Stripe mode is on only when a real secret key is configured; otherwise checkout is simulated. */
  stripeEnabled: Boolean(parsed.data.STRIPE_SECRET_KEY),
  /** Ollama and other local OpenAI-compatible servers don't need a key. */
  aiEnabled: Boolean(parsed.data.AI_API_KEY) || !parsed.data.AI_BASE_URL.includes('api.openai.com'),
};
