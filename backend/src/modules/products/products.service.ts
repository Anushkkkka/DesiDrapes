import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const PRODUCT_CACHE_PREFIX = 'products:';

export const SIZE_ORDER = ['Free Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const sortSizes = <T extends { size: string }>(variants: T[]) =>
  [...variants].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));

export const productInclude = {
  category: true,
  variants: true,
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface RatingSummary {
  average: number;
  count: number;
}

/** API shape for a product: Decimal to number, stock summarised per size. */
export function serializeProduct(p: ProductWithRelations, rating: RatingSummary = { average: 0, count: 0 }) {
  const variants = sortSizes(p.variants).map((v) => ({
    id: v.id,
    size: v.size,
    stock: v.stock,
    lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
  }));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: Number(p.price),
    images: p.images,
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
    subcategory: p.subcategory,
    bestseller: p.bestseller,
    isActive: p.isActive,
    inStock: variants.some((v) => v.stock > 0),
    variants,
    rating,
    createdAt: p.createdAt,
  };
}

export type ProductDTO = ReturnType<typeof serializeProduct>;

export async function ratingsFor(productIds: string[]): Promise<Map<string, RatingSummary>> {
  if (!productIds.length) return new Map();
  const rows = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [r.productId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]),
  );
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Appends -2, -3, ... until the slug is free (ignoring the product being edited). */
export async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}
