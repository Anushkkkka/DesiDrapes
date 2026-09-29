import express, { Router } from 'express';
import type Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { stripe } from '../../lib/stripe.js';
import { logger } from '../../lib/logger.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { cancelPendingOrder, markOrderPaid } from '../orders/orders.service.js';

const mockConfirmSchema = z.object({ outcome: z.enum(['success', 'failure']) });

/**
 * Stripe webhook. Mounted before express.json() because signature
 * verification needs the exact raw request body.
 */
export const stripeWebhookRouter = Router().post(
  '/',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw notFound('Webhook');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.header('stripe-signature') ?? '', env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Rejected Stripe webhook with bad signature');
      throw badRequest('Invalid signature');
    }

    logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId && session.payment_status === 'paid') {
          await markOrderPaid(orderId, 'stripe', (session.payment_intent as string | null) ?? session.id);
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const orderId = event.data.object.metadata?.orderId;
        if (orderId) await cancelPendingOrder(orderId, 'payment_failed');
        break;
      }
      case 'checkout.session.expired': {
        const orderId = event.data.object.metadata?.orderId;
        if (orderId) await cancelPendingOrder(orderId, 'expired');
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  }),
);

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ provider: stripe ? 'stripe' : 'mock' });
});

/**
 * Simulated payment gateway for local development and demos when no Stripe
 * key is configured. Disabled automatically once Stripe is enabled.
 */
router.post(
  '/mock/:orderId/confirm',
  requireAuth,
  validate({ body: mockConfirmSchema }),
  asyncHandler(async (req, res) => {
    if (stripe) throw notFound('Mock payments');
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order || order.userId !== req.user!.id) throw notFound('Order');
    if (order.status !== 'PENDING') throw badRequest('This order is not awaiting payment');

    if (req.body.outcome === 'success') {
      await markOrderPaid(order.id, 'mock', `mock_${order.id}`);
    } else {
      await cancelPendingOrder(order.id, 'payment_failed');
    }
    res.json({ status: req.body.outcome === 'success' ? 'PAID' : 'CANCELLED' });
  }),
);

export default router;
