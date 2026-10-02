import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { User } from '../lib/types';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api<{ user: User | null }>('/auth/me').then((r) => r.user),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api<{ user: User }>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ user }) => {
      qc.setQueryData(meKey, user);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      api<{ user: User }>('/auth/register', { method: 'POST', body }),
    onSuccess: ({ user }) => qc.setQueryData(meKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(meKey, null);
      // Drop every per-user cache (orders, notifications, admin data).
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'products' });
    },
  });
}
