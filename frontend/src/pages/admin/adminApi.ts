import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../../lib/api';
import type { Order, OrderStatus, Paginated, Product, Role } from '../../lib/types';

export interface Stats {
  totalRevenue: number;
  paidOrders: number;
  averageOrderValue: number;
  customers: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; unitsSold: number }[];
  lowStock: { id: string; size: string; stock: number; lowStockThreshold: number; productId: string; name: string; slug: string }[];
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotal: number;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  orderCount: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export const useStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats') });

export const useAdminOrders = (p: { status?: string; search?: string; page: number }) =>
  useQuery({
    queryKey: ['admin', 'orders', p],
    queryFn: () => api<Paginated<Order>>(`/admin/orders${qs(p)}`),
    placeholderData: keepPreviousData,
  });

export const useAdminProducts = (p: { search?: string; page: number }) =>
  useQuery({
    queryKey: ['admin', 'products', p],
    queryFn: () => api<Paginated<Product>>(`/admin/products${qs(p)}`),
    placeholderData: keepPreviousData,
  });

export const useAdminCategories = () =>
  useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<{ categories: { id: string; name: string; slug: string }[] }>('/admin/categories').then((r) => r.categories),
    staleTime: Infinity,
  });

export const useCoupons = () =>
  useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api<{ coupons: Coupon[] }>('/admin/coupons').then((r) => r.coupons) });

export const useAdminUsers = (p: { search?: string; page: number }) =>
  useQuery({ queryKey: ['admin', 'users', p], queryFn: () => api<Paginated<AdminUser>>(`/admin/users${qs(p)}`), placeholderData: keepPreviousData });

export const useAuditLog = (page: number) =>
  useQuery({ queryKey: ['admin', 'audit', page], queryFn: () => api<Paginated<AuditEntry>>(`/admin/audit-logs${qs({ page, limit: 30 })}`), placeholderData: keepPreviousData });

/** Mutation that refreshes all admin data (and the public catalog) on success. */
export function useAdminMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
