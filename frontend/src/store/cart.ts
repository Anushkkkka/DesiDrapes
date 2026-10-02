import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: string;
  price: number;
  quantity: number;
  /** Stock when added; the server re-checks at checkout. */
  maxQuantity: number;
}

export const MAX_PER_ITEM = 10;

interface CartState {
  items: CartItem[];
  couponCode: string;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  setCoupon: (code: string) => void;
  clear: () => void;
}

const cap = (item: Pick<CartItem, 'maxQuantity'>, q: number) => Math.max(1, Math.min(q, item.maxQuantity, MAX_PER_ITEM));

/** Guest-friendly cart persisted in localStorage; prices are re-quoted by the API. */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: '',
      add: (item, quantity = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId ? { ...i, ...item, quantity: cap(item, i.quantity + quantity) } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: cap(item, quantity) }] };
        }),
      setQuantity: (variantId, quantity) =>
        set((s) => ({ items: s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: cap(i, quantity) } : i)) })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      setCoupon: (couponCode) => set({ couponCode: couponCode.trim().toUpperCase() }),
      clear: () => set({ items: [], couponCode: '' }),
    }),
    { name: 'desidrapes-cart', version: 1 },
  ),
);

export const selectCount = (s: CartState) => s.items.reduce((n, i) => n + i.quantity, 0);
export const selectSubtotal = (s: CartState) => s.items.reduce((n, i) => n + i.price * i.quantity, 0);
