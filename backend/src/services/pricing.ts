/**
 * Pure order-pricing rules, kept free of I/O so they are easy to unit test.
 * All money is handled in integer cents to avoid floating-point drift.
 */

export interface PricingLine {
  unitPrice: number; // dollars
  quantity: number;
}

export interface CouponRule {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotal: number;
  active: boolean;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
}

export interface ShippingRule {
  flatFee: number;
  freeThreshold: number;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => cents / 100;

/** Returns null when the coupon is usable, otherwise a customer-facing reason. */
export function couponRejection(coupon: CouponRule, subtotal: number, now = new Date()): string | null {
  if (!coupon.active) return 'This coupon is no longer active';
  if (coupon.expiresAt && coupon.expiresAt <= now) return 'This coupon has expired';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'This coupon has reached its usage limit';
  if (subtotal < coupon.minSubtotal) return `Spend at least $${coupon.minSubtotal.toFixed(2)} to use this coupon`;
  return null;
}

export function calculateTotals(lines: PricingLine[], shipping: ShippingRule, coupon?: CouponRule | null): PriceBreakdown {
  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.quantity, 0);

  let discountCents = 0;
  if (coupon) {
    discountCents =
      coupon.type === 'PERCENT'
        ? Math.round((subtotalCents * Math.min(coupon.value, 100)) / 100)
        : toCents(coupon.value);
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const discounted = subtotalCents - discountCents;
  // Free shipping is judged on what the customer actually pays for goods.
  const shippingCents = subtotalCents === 0 || discounted >= toCents(shipping.freeThreshold) ? 0 : toCents(shipping.flatFee);

  return {
    subtotal: toDollars(subtotalCents),
    discount: toDollars(discountCents),
    shippingFee: toDollars(shippingCents),
    total: toDollars(discounted + shippingCents),
  };
}
