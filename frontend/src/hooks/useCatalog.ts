import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import type { Category, Paginated, Product, Review } from '../lib/types';

export interface ProductFilters {
  category?: string;
  subcategory?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  bestseller?: boolean;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name' | 'popular';
  page?: number;
  limit?: number;
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', 'list', filters],
    queryFn: ({ signal }) => api<Paginated<Product>>(`/products${qs({ ...filters })}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['products', 'categories'],
    queryFn: () => api<{ categories: Category[] }>('/products/categories').then((r) => r.categories),
    staleTime: 10 * 60_000,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['products', 'detail', slug],
    queryFn: () => api<{ product: Product; reviews: Review[]; related: Product[] }>(`/products/${slug}`),
    enabled: Boolean(slug),
  });
}
