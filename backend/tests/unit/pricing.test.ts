import { describe, expect, it } from 'vitest';
import { calculateTotals, couponRejection, type CouponRule } from '../../src/services/pricing.js';

const shipping = { flatFee: 10, freeThreshold: 150 };

const coupon = (overrides: Partial<CouponRule> = {}): CouponRule => ({
  code: 'TEST',
  type: 'PERCENT',
  value: 10,
  minSubtotal: 0,
  active: true,
  expiresAt: null,
  usageLimit: null,
  usedCount: 0,
  ...overrides,
});

describe('calculateTotals', () => {
  it('adds flat shipping below the free-shipping threshold', () => {
    expect(calculateTotals([{ unitPrice: 60, quantity: 1 }], shipping)).toEqual({
      subtotal: 60,
      discount: 0,
      shippingFee: 10,
      total: 70,
    });
  });

  it('ships free at or above the threshold', () => {
    const t = calculateTotals([{ unitPrice: 75, quantity: 2 }], shipping);
    expect(t.shippingFee).toBe(0);
    expect(t.total).toBe(150);
  });

  it('applies percentage coupons', () => {
    const t = calculateTotals([{ unitPrice: 120, quantity: 2 }], shipping, coupon({ value: 20 }));
    expect(t).toEqual({ subtotal: 240, discount: 48, shippingFee: 0, total: 192 });
  });

  it('judges free shipping on the discounted amount', () => {
    // $160 - 10% = $144, below $150, so shipping applies.
    const t = calculateTotals([{ unitPrice: 160, quantity: 1 }], shipping, coupon());
    expect(t.discount).toBe(16);
    expect(t.shippingFee).toBe(10);
    expect(t.total).toBe(154);
  });

  it('never discounts more than the subtotal for fixed coupons', () => {
    const t = calculateTotals([{ unitPrice: 20, quantity: 1 }], shipping, coupon({ type: 'FIXED', value: 50 }));
    expect(t.discount).toBe(20);
    expect(t.total).toBe(10); // goods free, shipping still charged
  });

  it('caps percentage coupons at 100%', () => {
    const t = calculateTotals([{ unitPrice: 40, quantity: 1 }], shipping, coupon({ value: 150 }));
    expect(t.discount).toBe(40);
  });

  it('avoids floating-point drift by working in cents', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; totals must still be exact.
    const t = calculateTotals(
      [
        { unitPrice: 0.1, quantity: 1 },
        { unitPrice: 0.2, quantity: 1 },
      ],
      { flatFee: 0, freeThreshold: 0 },
    );
    expect(t.subtotal).toBe(0.3);
    expect(t.total).toBe(0.3);
  });

  it('charges nothing for an empty cart', () => {
    expect(calculateTotals([], shipping)).toEqual({ subtotal: 0, discount: 0, shippingFee: 0, total: 0 });
  });
});

describe('couponRejection', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('accepts a valid coupon', () => {
    expect(couponRejection(coupon(), 100, now)).toBeNull();
  });

  it.each([
    ['inactive', coupon({ active: false }), 100, /no longer active/],
    ['expired', coupon({ expiresAt: new Date('2026-01-01') }), 100, /expired/],
    ['used up', coupon({ usageLimit: 5, usedCount: 5 }), 100, /usage limit/],
    ['below minimum spend', coupon({ minSubtotal: 150 }), 100, /Spend at least \$150\.00/],
  ])('rejects a coupon that is %s', (_label, c, subtotal, message) => {
    expect(couponRejection(c, subtotal, now)).toMatch(message);
  });
});
