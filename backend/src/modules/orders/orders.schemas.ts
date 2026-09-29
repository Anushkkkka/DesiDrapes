import { z } from 'zod';

export const cartItemsSchema = z
  .array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(10, 'Maximum 10 per item'),
    }),
  )
  .min(1, 'Your cart is empty')
  .max(50);

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{7,19}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(3, 'Street address is required').max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().min(2, 'State is required').max(100),
  postcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid postcode'),
  country: z.string().trim().min(2).max(60).default('Australia'),
});

export const quoteSchema = z.object({
  items: cartItemsSchema,
  couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal('')),
});

export const createOrderSchema = quoteSchema.extend({ shippingAddress: addressSchema });

export type CartItemInput = z.infer<typeof cartItemsSchema>[number];
export type AddressInput = z.infer<typeof addressSchema>;
