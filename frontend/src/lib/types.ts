/** Mirrors the backend DTOs (see backend/src/modules/*). */

export type Role = 'CUSTOMER' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Variant {
  id: string;
  size: string;
  stock: number;
  lowStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  category: { id: string; name: string; slug: string };
  subcategory: string | null;
  bestseller: boolean;
  isActive: boolean;
  inStock: boolean;
  variants: Variant[];
  rating: { average: number; count: number };
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  subcategories: { name: string; productCount: number }[];
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  createdAt: string;
}

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  image: string | null;
  size: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: string;
  couponCode: string | null;
  shippingAddress: Address;
  customer: { id: string; name: string; email: string };
  items: OrderItem[];
  payments: { id: string; provider: string; status: string; amount: number; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Totals {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

export interface Quote {
  lines: {
    variantId: string;
    productId: string;
    name: string;
    slug: string;
    image: string | null;
    size: string;
    unitPrice: number;
    quantity: number;
    available: number;
  }[];
  issues: { variantId: string; message: string }[];
  coupon: { code: string; type: 'PERCENT' | 'FIXED'; value: number } | null;
  couponError: string | null;
  totals: Totals;
  freeShippingThreshold: number;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AssistantResponse {
  reply: string;
  products: Product[];
  source: 'ai' | 'fallback';
}
