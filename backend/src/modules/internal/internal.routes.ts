import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireServiceKey } from '../../middleware/auth.js';
import { dailyReport, lowStockVariants } from '../admin/stats.service.js';
import { expireStaleOrders } from '../orders/orders.service.js';

/**
 * Endpoints n8n calls back into, authenticated with the shared N8N_API_KEY
 * rather than a user session.
 */
const router = Router();
router.use(requireServiceKey);

router.get(
  '/reports/daily',
  asyncHandler(async (_req, res) => res.json(await dailyReport())),
);

router.get(
  '/inventory/low-stock',
  asyncHandler(async (_req, res) => res.json({ items: await lowStockVariants(100) })),
);

router.post(
  '/orders/expire-stale',
  asyncHandler(async (_req, res) => res.json({ expired: await expireStaleOrders() })),
);

export default router;
