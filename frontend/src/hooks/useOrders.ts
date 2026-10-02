import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Address, Notification, Order, Quote } from '../lib/types';
import type { CartItem } from '../store/cart';
import { useMe } from './useAuth';

const toLines = (items: CartItem[]) => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

/** Server-side price check of the cart: real prices, stock issues and coupon validity. */
export function useQuote(items: CartItem[], couponCode: string) {
  return useQuery({
    queryKey: ['quote', toLines(items), couponCode],
    queryFn: () => api<Quote>('/orders/quote', { method: 'POST', body: { items: toLines(items), couponCode } }),
    enabled: items.length > 0,
    placeholderData: (prev) => prev,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (body: { items: CartItem[]; couponCode: string; shippingAddress: Address }) =>
      api<{ order: Order; checkoutUrl: string }>('/orders', {
        method: 'POST',
        body: { items: toLines(body.items), couponCode: body.couponCode, shippingAddress: body.shippingAddress },
      }),
  });
}

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: () => api<{ orders: Order[] }>('/orders').then((r) => r.orders) });
}

export function useOrder(id: string | undefined, opts: { pollWhilePending?: boolean } = {}) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api<{ order: Order }>(`/orders/${id}`).then((r) => r.order),
    enabled: Boolean(id),
    // After Stripe redirects back, the webhook may land a moment later.
    refetchInterval: (q) => (opts.pollWhilePending && q.state.data?.status === 'PENDING' ? 2000 : false),
  });
}

export function useOrderAction(action: 'pay' | 'cancel') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ checkoutUrl?: string; order?: Order }>(`/orders/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function usePaymentProvider() {
  return useQuery({
    queryKey: ['payments', 'config'],
    queryFn: () => api<{ provider: 'stripe' | 'mock' }>('/payments/config').then((r) => r.provider),
    staleTime: Infinity,
  });
}

export function useNotifications() {
  const { data: user } = useMe();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: Notification[]; unread: number }>('/notifications'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
