import { z } from 'zod';

/** Client-side mirrors of the API's Zod schemas for instant form feedback. */

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email'),
  password: passwordSchema,
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().trim().regex(/^[+\d][\d\s()-]{7,19}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(3, 'Street address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  postcode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid postcode'),
  country: z.string().trim().min(2),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
