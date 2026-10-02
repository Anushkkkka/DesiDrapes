import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { generateProductDescription, shoppingAssistant } from './ai.service.js';

const router = Router();
router.use(aiLimiter);

router.get('/status', (_req, res) => {
  res.json({ enabled: env.aiEnabled, model: env.aiEnabled ? env.AI_MODEL : null });
});

const assistantBody = z.object({
  message: z.string().trim().min(2).max(500),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1500) }))
    .max(10)
    .default([]),
});

router.post(
  '/assistant',
  validate({ body: assistantBody }),
  asyncHandler(async (req, res) => {
    res.json(await shoppingAssistant(req.body.message, req.body.history));
  }),
);

const descriptionBody = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(60),
  subcategory: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(300).optional(),
});

router.post(
  '/product-description',
  requireAdmin,
  validate({ body: descriptionBody }),
  asyncHandler(async (req, res) => {
    res.json(await generateProductDescription(req.body));
  }),
);

export default router;
