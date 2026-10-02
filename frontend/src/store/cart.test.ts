import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PER_ITEM, selectCount, selectSubtotal, useCart, type CartItem } from './cart';

const item = (overrides: Partial<Omit<CartItem, 'quantity'>> = {}): Omit<CartItem, 'quantity'> => ({
  variantId: 'v-m',
  productId: 'p1',
  slug: 'red-silk-saree',
  name: 'Red Silk Saree',
  image: '/images/w1.png',
  size: 'M',
  price: 120,
  maxQuantity: 5,
  ...overrides,
});

const state = () => useCart.getState();

describe('cart store', () => {
  beforeEach(() => {
    localStorage.clear();
    state().clear();
  });

  it('adds an item and computes count and subtotal', () => {
    state().add(item(), 2);
    expect(state().items).toHaveLength(1);
    expect(selectCount(state())).toBe(2);
    expect(selectSubtotal(state())).toBe(240);
  });

  it('merges repeat adds of the same size instead of duplicating lines', () => {
    state().add(item());
    state().add(item(), 2);
    expect(state().items).toHaveLength(1);
    expect(state().items[0].quantity).toBe(3);
  });

  it('keeps different sizes of one product as separate lines', () => {
    state().add(item());
    state().add(item({ variantId: 'v-l', size: 'L' }));
    expect(state().items.map((i) => i.size)).toEqual(['M', 'L']);
  });

  it('never exceeds available stock', () => {
    state().add(item({ maxQuantity: 3 }), 2);
    state().add(item({ maxQuantity: 3 }), 5);
    expect(state().items[0].quantity).toBe(3);
  });

  it(`never exceeds ${MAX_PER_ITEM} per line even with plenty of stock`, () => {
    state().add(item({ maxQuantity: 100 }), 50);
    expect(state().items[0].quantity).toBe(MAX_PER_ITEM);
  });

  it('clamps quantity updates between 1 and the limit', () => {
    state().add(item());
    state().setQuantity('v-m', 0);
    expect(state().items[0].quantity).toBe(1);
    state().setQuantity('v-m', 99);
    expect(state().items[0].quantity).toBe(5);
  });

  it('removes items and normalises coupon codes', () => {
    state().add(item());
    state().setCoupon('  welcome10 ');
    expect(state().couponCode).toBe('WELCOME10');
    state().remove('v-m');
    expect(state().items).toHaveLength(0);
  });

  it('persists to localStorage so the cart survives a refresh', () => {
    state().add(item());
    const saved = JSON.parse(localStorage.getItem('desidrapes-cart') ?? '{}');
    expect(saved.state.items[0].variantId).toBe('v-m');
  });
});
