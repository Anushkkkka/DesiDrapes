import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
};

export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });

/** Brute-force protection for login, registration and password reset. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20 });

/** AI calls cost money; keep them tight. */
export const aiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 10 });
