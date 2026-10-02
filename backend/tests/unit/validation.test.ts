import { describe, expect, it } from 'vitest';
import { passwordSchema, registerSchema } from '../../src/modules/auth/auth.schemas.js';
import { addressSchema, cartItemsSchema } from '../../src/modules/orders/orders.schemas.js';

describe('password policy', () => {
  it.each([
    ['too short', 'Ab1'],
    ['no uppercase', 'lowercase1'],
    ['no lowercase', 'UPPERCASE1'],
    ['no number', 'NoNumbersHere'],
    ['longer than bcrypt can hash', `Aa1${'x'.repeat(80)}`],
  ])('rejects a password that is %s', (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it('accepts a strong password', () => {
    expect(passwordSchema.safeParse('Customer@123').success).toBe(true);
  });
});

describe('registration input', () => {
  it('normalises email to lowercase and trims the name', () => {
    const parsed = registerSchema.parse({ name: '  Priya  ', email: 'Priya@Example.COM', password: 'Secret123' });
    expect(parsed).toMatchObject({ name: 'Priya', email: 'priya@example.com' });
  });
});

describe('order input', () => {
  const address = {
    fullName: 'Priya Sharma',
    phone: '+61 400 123 456',
    line1: '12 Harbour St',
    city: 'Sydney',
    state: 'NSW',
    postcode: '2000',
  };

  it('defaults the country to Australia', () => {
    expect(addressSchema.parse(address).country).toBe('Australia');
  });

  it('rejects an invalid phone number', () => {
    expect(addressSchema.safeParse({ ...address, phone: 'call me' }).success).toBe(false);
  });

  it('rejects zero, negative and excessive quantities', () => {
    for (const quantity of [0, -1, 11, 1.5]) {
      expect(cartItemsSchema.safeParse([{ variantId: 'v1', quantity }]).success).toBe(false);
    }
  });

  it('rejects an empty cart', () => {
    expect(cartItemsSchema.safeParse([]).success).toBe(false);
  });
});
