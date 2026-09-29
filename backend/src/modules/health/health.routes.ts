import { Router } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { cache } from '../../lib/cache.js';

const router = Router();

/** Liveness: the process is up. */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'desidrapes-backend', uptime: Math.round(process.uptime()) });
});

/** Readiness: dependencies are reachable. Used by Docker health checks and deploy smoke tests. */
router.get('/ready', async (_req, res) => {
  const database = await prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down');
  const body = {
    status: database === 'up' ? 'ok' : 'degraded',
    checks: {
      database,
      redis: env.REDIS_URL ? (cache.isReady() ? 'up' : 'down') : 'disabled',
      payments: env.stripeEnabled ? 'stripe' : 'mock',
      ai: env.aiEnabled ? 'enabled' : 'fallback',
      automation: env.N8N_WEBHOOK_BASE_URL ? 'n8n' : 'disabled',
    },
  };
  res.status(database === 'up' ? 200 : 503).json(body);
});

export default router;
