import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { cache } from './lib/cache.js';
import { expireStaleOrders } from './modules/orders/orders.service.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, payments: env.stripeEnabled ? 'stripe' : 'mock', ai: env.aiEnabled ? env.AI_MODEL : 'fallback' },
    `DesiDrapes API listening on http://localhost:${env.PORT} (docs at /api/docs)`,
  );
});

// Release stock held by checkouts that were abandoned without Stripe telling us.
const sweeper = setInterval(
  () => {
    expireStaleOrders()
      .then((n) => n && logger.info({ expired: n }, 'Expired stale pending orders'))
      .catch((err) => logger.error({ err }, 'Stale order sweep failed'));
  },
  10 * 60 * 1000,
);

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  clearInterval(sweeper);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), cache.quit()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
