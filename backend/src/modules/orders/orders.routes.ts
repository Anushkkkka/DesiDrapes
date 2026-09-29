import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { stripe } from '../../lib/stripe.js';
import { logger } from '../../lib/logger.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { createOrderSchema, quoteSchema } from './orders.schemas.js';
import {
  cancelPendingOrder,
  createOrder,
  markOrderPaid,
  orderInclude,
  quoteCart,
  serializeOrder,
  startCheckout,
} from './orders.service.js';

const router = Router();

/** Loads an order the caller may see (their own, or any order for admins). */
async function findVisibleOrder(orderId: string, user: { id: string; role: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order || (order.userId !== user.id && user.role !== 'ADMIN')) throw notFound('Order');
  return order;
}

router.post(
  '/quote',
  validate({ body: quoteSchema }),
  asyncHandler(async (req, res) => {
    const quote = await quoteCart(req.body.items, req.body.couponCode || undefined);
    res.json({
      lines: quote.lines,
      issues: quote.issues,
      coupon: quote.coupon && { code: quote.coupon.code, type: quote.coupon.type, value: Number(quote.coupon.value) },
      couponError: quote.couponError,
      totals: quote.totals,
      freeShippingThreshold: quote.freeShippingThreshold,
    });
  }),
);

router.use(requireAuth);

router.post(
  '/',
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const { items, shippingAddress, couponCode } = req.body;
    const order = await createOrder(req.user!, items, shippingAddress, couponCode || undefined);
    try {
      const checkoutUrl = await startCheckout(order);
      res.status(201).json({ order: serializeOrder(order), checkoutUrl });
    } catch (err) {
      // Don't leave stock reserved for an order that can't be paid.
      logger.error({ err, orderId: order.id }, 'Checkout session creation failed');
      await cancelPendingOrder(order.id, 'payment_failed');
      throw badRequest('Payment could not be started. Please try again.');
    }
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders: orders.map(serializeOrder) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    let order = await findVisibleOrder(req.params.id, req.user!);
    // Fallback for local dev without `stripe listen`: if the webhook never
    // arrived, ask Stripe directly whether the session was paid.
    if (order.status === 'PENDING' && order.stripeSessionId && stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (session.payment_status === 'paid') {
          await markOrderPaid(order.id, 'stripe', (session.payment_intent as string | null) ?? session.id);
          order = await findVisibleOrder(order.id, req.user!);
        }
      } catch (err) {
        logger.warn({ err, orderId: order.id }, 'Could not verify Stripe session');
      }
    }
    res.json({ order: serializeOrder(order) });
  }),
);

/** Retry payment for an order that is still awaiting it. */
router.post(
  '/:id/pay',
  asyncHandler(async (req, res) => {
    const order = await findVisibleOrder(req.params.id, req.user!);
    if (order.userId !== req.user!.id) throw notFound('Order');
    if (order.status !== 'PENDING') throw badRequest('This order is not awaiting payment');
    res.json({ checkoutUrl: await startCheckout(order) });
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await findVisibleOrder(req.params.id, req.user!);
    if (order.userId !== req.user!.id) throw notFound('Order');
    if (order.status !== 'PENDING') {
      throw badRequest('Paid orders can only be cancelled by contacting support');
    }
    await cancelPendingOrder(order.id, 'customer_cancelled');
    res.json({ order: serializeOrder(await findVisibleOrder(order.id, req.user!)) });
  }),
);

export default router;
