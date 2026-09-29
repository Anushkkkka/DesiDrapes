import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import healthRouter from './modules/health/health.routes.js';
import authRouter from './modules/auth/auth.routes.js';
import productsRouter from './modules/products/products.routes.js';
import ordersRouter from './modules/orders/orders.routes.js';
import paymentsRouter, { stripeWebhookRouter } from './modules/payments/payments.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import adminRouter, { UPLOAD_DIR } from './modules/admin/admin.routes.js';
import aiRouter from './modules/ai/ai.routes.js';
import internalRouter from './modules/internal/internal.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind Nginx / a load balancer in production
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // product images are loaded by the frontend origin
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );

  // Must come before express.json(): Stripe signs the raw body.
  app.use('/api/payments/webhook', stripeWebhookRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const staticOpts = { maxAge: '7d', fallthrough: false };
  app.use('/images', express.static(path.resolve('public/images'), staticOpts));
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR, staticOpts));

  app.use('/health', healthRouter);

  const specPath = path.resolve('openapi.yaml');
  if (fs.existsSync(specPath)) {
    const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
    app.get('/api/docs.json', (_req, res) => res.json(spec));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'DesiDrapes API' }));
  }

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/internal', internalRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
