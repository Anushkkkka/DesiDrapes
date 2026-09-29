import type { Coupon, OrderStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { cache } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { stripe } from '../../lib/stripe.js';
import { AppError, badRequest, conflict } from '../../lib/errors.js';
import { audit, notify, publishEvent } from '../../services/events.js';
import { calculateTotals, couponRejection, type CouponRule } from '../../services/pricing.js';
import { PRODUCT_CACHE_PREFIX } from '../products/products.service.js';
import type { AddressInput, CartItemInput } from './orders.schemas.js';

export const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: OrderWithRelations) {
  return {
    id: o.id,
    number: o.id.slice(-8).toUpperCase(),
    status: o.status,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shippingFee: Number(o.shippingFee),
    total: Number(o.total),
    currency: o.currency,
    couponCode: o.couponCode,
    shippingAddress: o.shippingAddress as AddressInput,
    customer: o.user,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      image: i.image,
      size: i.size,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      lineTotal: Number(i.unitPrice) * i.quantity,
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amount: Number(p.amount),
      createdAt: p.createdAt,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export type OrderDTO = ReturnType<typeof serializeOrder>;

const toCouponRule = (c: Coupon): CouponRule => ({
  code: c.code,
  type: c.type,
  value: Number(c.value),
  minSubtotal: Number(c.minSubtotal),
  active: c.active,
  expiresAt: c.expiresAt,
  usageLimit: c.usageLimit,
  usedCount: c.usedCount,
});

const shippingRule = () => ({ flatFee: env.SHIPPING_FLAT_FEE, freeThreshold: env.FREE_SHIPPING_THRESHOLD });

/** Merges duplicate variant lines so stock checks see the real total per size. */
function mergeItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Prices a cart from database prices (never trusting client prices) and
 * reports per-line problems such as out-of-stock sizes.
 */
export async function quoteCart(rawItems: CartItemInput[], couponCode?: string) {
  const items = mergeItems(rawItems);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const issues: { variantId: string; message: string }[] = [];
  const lines = items.flatMap((item) => {
    const v = byId.get(item.variantId);
    if (!v || !v.product.isActive) {
      issues.push({ variantId: item.variantId, message: 'This item is no longer available' });
      return [];
    }
    if (v.stock < item.quantity) {
      issues.push({
        variantId: v.id,
        message: v.stock === 0 ? `${v.product.name} (${v.size}) is sold out` : `Only ${v.stock} left of ${v.product.name} (${v.size})`,
      });
    }
    return [
      {
        variantId: v.id,
        productId: v.productId,
        name: v.product.name,
        slug: v.product.slug,
        image: v.product.images[0] ?? null,
        size: v.size,
        unitPrice: Number(v.product.price),
        quantity: item.quantity,
        available: v.stock,
      },
    ];
  });

  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    couponError = coupon ? couponRejection(toCouponRule(coupon), subtotal) : 'Coupon code not found';
    if (couponError) coupon = null;
  }

  const totals = calculateTotals(lines, shippingRule(), coupon ? toCouponRule(coupon) : null);
  return { lines, issues, coupon, couponError, totals, freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD };
}

export async function createOrder(user: { id: string; email: string }, items: CartItemInput[], address: AddressInput, couponCode?: string) {
  const quote = await quoteCart(items, couponCode);
  if (quote.issues.length) throw new AppError(409, 'STOCK_CONFLICT', quote.issues[0].message, quote.issues);
  if (couponCode && quote.couponError) throw badRequest(quote.couponError);

  const lowStock: { variantId: string; stock: number; threshold: number; name: string; size: string }[] = [];

  const order = await prisma.$transaction(async (tx) => {
    // Conditional decrement: succeeds only if enough stock remains, so two
    // concurrent checkouts can never oversell the last unit.
    for (const line of quote.lines) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (count === 0) throw conflict(`${line.name} (${line.size}) just sold out`);
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: line.variantId } });
      if (v.stock <= v.lowStockThreshold) {
        lowStock.push({ variantId: v.id, stock: v.stock, threshold: v.lowStockThreshold, name: line.name, size: line.size });
      }
    }

    if (quote.coupon) {
      const { count } = await tx.coupon.updateMany({
        where: {
          id: quote.coupon.id,
          ...(quote.coupon.usageLimit !== null && { usedCount: { lt: quote.coupon.usageLimit } }),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (count === 0) throw badRequest('This coupon has reached its usage limit');
    }

    return tx.order.create({
      data: {
        userId: user.id,
        subtotal: quote.totals.subtotal,
        discount: quote.totals.discount,
        shippingFee: quote.totals.shippingFee,
        total: quote.totals.total,
        couponCode: quote.coupon?.code,
        shippingAddress: address,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            image: l.image,
            size: l.size,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
          })),
        },
      },
      include: orderInclude,
    });
  });

  await cache.invalidate(PRODUCT_CACHE_PREFIX);
  await Promise.all([
    notify(user.id, 'ORDER_PLACED', `Order #${order.id.slice(-8).toUpperCase()} placed. Complete payment to confirm it.`),
    audit('order.created', { userId: user.id, entity: 'Order', entityId: order.id, metadata: { total: quote.totals.total } }),
  ]);
  publishEvent('order.created', { orderId: order.id, email: user.email, total: quote.totals.total });
  for (const item of lowStock) publishEvent('inventory.low', { ...item, adminEmail: env.ADMIN_ALERT_EMAIL });

  return order;
}

/** Creates a Stripe Checkout session, or a simulated one when Stripe isn't configured. */
export async function startCheckout(order: OrderWithRelations): Promise<string> {
  if (!stripe) return `${env.FRONTEND_URL}/checkout/mock?orderId=${order.id}`;

  const toCents = (n: number) => Math.round(n * 100);
  const discount = Number(order.discount);
  const stripeCoupon =
    discount > 0
      ? await stripe.coupons.create(
          { amount_off: toCents(discount), currency: 'aud', duration: 'once', name: order.couponCode ?? 'Discount' },
          { idempotencyKey: `coupon-${order.id}` },
        )
      : null;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: order.user.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
      line_items: order.items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: 'aud',
          unit_amount: toCents(Number(i.unitPrice)),
          product_data: { name: `${i.name} (${i.size})` },
        },
      })),
      ...(stripeCoupon && { discounts: [{ coupon: stripeCoupon.id }] }),
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: Number(order.shippingFee) === 0 ? 'Free shipping' : 'Standard shipping',
            type: 'fixed_amount',
            fixed_amount: { amount: toCents(Number(order.shippingFee)), currency: 'aud' },
          },
        },
      ],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${env.FRONTEND_URL}/order-success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/orders/${order.id}?payment=cancelled`,
    },
    // A retried request returns the same session instead of creating a duplicate.
    { idempotencyKey: `checkout-${order.id}-${order.updatedAt.getTime()}` },
  );

  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  return session.url!;
}

/** Idempotent: Stripe retries webhooks, so a second call for the same order is a no-op. */
export async function markOrderPaid(orderId: string, provider: 'stripe' | 'mock', providerRef: string | null) {
  const { count } = await prisma.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID' } });
  if (count === 0) return;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  await prisma.payment.create({
    data: { orderId, provider, providerRef, amount: order.total, currency: order.currency, status: 'SUCCEEDED' },
  });
  const dto = serializeOrder(order);
  await Promise.all([
    notify(order.userId, 'PAYMENT_SUCCEEDED', `Payment received for order #${dto.number}. We're getting it ready!`),
    audit('order.paid', { userId: order.userId, entity: 'Order', entityId: orderId, metadata: { provider, providerRef } }),
  ]);
  publishEvent('order.paid', {
    orderId,
    orderNumber: dto.number,
    customerName: order.user.name,
    email: order.user.email,
    total: dto.total,
    currency: dto.currency,
    items: dto.items.map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, lineTotal: i.lineTotal })),
    shippingAddress: dto.shippingAddress,
    orderUrl: `${env.FRONTEND_URL}/orders/${orderId}`,
  });
}

/** Returns reserved stock and coupon usage. Must run inside the same transaction as the status change. */
async function releaseReservation(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const item of order.items) {
    await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
  }
  if (order.couponCode) {
    await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
}

/** Cancels an unpaid order (payment failed, checkout expired, customer cancelled). Idempotent. */
export async function cancelPendingOrder(orderId: string, reason: 'payment_failed' | 'expired' | 'customer_cancelled') {
  const cancelled = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (count === 0) return false;
    await releaseReservation(tx, orderId);
    return true;
  });
  if (!cancelled) return false;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  await cache.invalidate(PRODUCT_CACHE_PREFIX);
  if (reason === 'payment_failed') {
    await prisma.payment.create({
      data: { orderId, provider: stripe ? 'stripe' : 'mock', amount: order.total, currency: order.currency, status: 'FAILED' },
    });
    await notify(order.userId, 'PAYMENT_FAILED', `Payment for order #${orderId.slice(-8).toUpperCase()} failed. Your items were released.`);
    publishEvent('payment.failed', { orderId, email: order.user.email, name: order.user.name, total: Number(order.total) });
  }
  await audit(`order.cancelled.${reason}`, { userId: order.userId, entity: 'Order', entityId: orderId });
  return true;
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Admin status changes. Cancelling a paid order restocks items and refunds via Stripe. */
export async function updateOrderStatus(orderId: string, next: OrderStatus, adminId: string) {
  const current = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  if (current.status === next) return current;
  if (!allowedTransitions[current.status].includes(next)) {
    throw badRequest(`Cannot change an order from ${current.status} to ${next}`);
  }

  if (next === 'CANCELLED' && current.status === 'PENDING') {
    await cancelPendingOrder(orderId, 'customer_cancelled');
  } else if (next === 'CANCELLED') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      await releaseReservation(tx, orderId);
    });
    const paid = await prisma.payment.findFirst({ where: { orderId, status: 'SUCCEEDED' } });
    if (paid) {
      if (stripe && paid.providerRef) {
        try {
          await stripe.refunds.create({ payment_intent: paid.providerRef }, { idempotencyKey: `refund-${orderId}` });
        } catch (err) {
          logger.error({ err, orderId }, 'Stripe refund failed; refund manually from the Stripe dashboard');
        }
      }
      await prisma.payment.update({ where: { id: paid.id }, data: { status: 'REFUNDED' } });
    }
    await cache.invalidate(PRODUCT_CACHE_PREFIX);
  } else {
    await prisma.order.update({ where: { id: orderId }, data: { status: next } });
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  const number = orderId.slice(-8).toUpperCase();
  await Promise.all([
    notify(order.userId, 'ORDER_STATUS', `Order #${number} is now ${next.toLowerCase()}.`),
    audit('order.status_changed', { userId: adminId, entity: 'Order', entityId: orderId, metadata: { from: current.status, to: next } }),
  ]);
  publishEvent('order.status_changed', {
    orderId,
    orderNumber: number,
    email: order.user.email,
    customerName: order.user.name,
    from: current.status,
    to: next,
    orderUrl: `${env.FRONTEND_URL}/orders/${orderId}`,
  });
  return order;
}

/** Background sweep for unpaid orders whose checkout was abandoned. */
export async function expireStaleOrders(maxAgeMinutes = 60): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - maxAgeMinutes * 60_000) } },
    select: { id: true },
  });
  let expired = 0;
  for (const o of stale) if (await cancelPendingOrder(o.id, 'expired')) expired++;
  return expired;
}
