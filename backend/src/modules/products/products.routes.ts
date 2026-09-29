import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cache } from '../../lib/cache.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { PRODUCT_CACHE_PREFIX, productInclude, ratingsFor, serializeProduct } from './products.service.js';

const router = Router();

const listQuery = z.object({
  category: z.string().trim().optional(),
  subcategory: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  bestseller: z.enum(['true', 'false']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const orderBy: Record<z.infer<typeof listQuery>['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { name: 'asc' }],
  price_asc: [{ price: 'asc' }, { name: 'asc' }],
  price_desc: [{ price: 'desc' }, { name: 'asc' }],
  name: [{ name: 'asc' }],
  popular: [{ orderItems: { _count: 'desc' } }, { bestseller: 'desc' }, { name: 'asc' }],
};

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const cacheKey = `${PRODUCT_CACHE_PREFIX}list:${JSON.stringify(q)}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('x-cache', 'HIT');
      return res.json(cached);
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(q.category && { category: { slug: q.category.toLowerCase() } }),
      ...(q.subcategory && { subcategory: { equals: q.subcategory, mode: 'insensitive' } }),
      ...(q.bestseller === 'true' && { bestseller: true }),
      ...(q.inStock === 'true' && { variants: { some: { stock: { gt: 0 } } } }),
      ...((q.minPrice !== undefined || q.maxPrice !== undefined) && {
        price: { gte: q.minPrice, lte: q.maxPrice },
      }),
      // Every search word must appear somewhere in the name, description or subcategory.
      ...(q.search && {
        AND: q.search
          .split(/\s+/)
          .filter(Boolean)
          .map((term) => ({
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } },
              { subcategory: { contains: term, mode: 'insensitive' as const } },
            ],
          })),
      }),
    };

    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: orderBy[q.sort],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    const ratings = await ratingsFor(products.map((p) => p.id));

    const body = {
      items: products.map((p) => serializeProduct(p, ratings.get(p.id))),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    };
    await cache.set(cacheKey, body, 300);
    res.setHeader('x-cache', 'MISS');
    res.json(body);
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const cacheKey = `${PRODUCT_CACHE_PREFIX}categories`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    const subs = await prisma.product.groupBy({
      by: ['categoryId', 'subcategory'],
      where: { isActive: true },
      _count: { _all: true },
    });
    const body = {
      categories: categories.map((c) => {
        const rows = subs.filter((s) => s.categoryId === c.id);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          productCount: rows.reduce((n, r) => n + r._count._all, 0),
          subcategories: rows
            .filter((r) => r.subcategory)
            .map((r) => ({ name: r.subcategory!, productCount: r._count._all }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
    };
    await cache.set(cacheKey, body, 600);
    res.json(body);
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }], isActive: true },
      include: productInclude,
    });
    if (!product) throw notFound('Product');

    const [ratings, reviews, related] = await Promise.all([
      ratingsFor([product.id]),
      prisma.review.findMany({
        where: { productId: product.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.product.findMany({
        where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
        include: productInclude,
        orderBy: [{ bestseller: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      }),
    ]);
    const relatedRatings = await ratingsFor(related.map((p) => p.id));

    res.json({
      product: serializeProduct(product, ratings.get(product.id)),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.user.name,
        createdAt: r.createdAt,
      })),
      related: related.map((p) => serializeProduct(p, relatedRatings.get(p.id))),
    });
  }),
);

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

router.post(
  '/:id/reviews',
  requireAuth,
  validate({ body: reviewBody }),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw notFound('Product');

    // Verified-purchase reviews only.
    const purchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId: req.user!.id, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      },
      select: { id: true },
    });
    if (!purchased) throw forbidden('You can review products you have purchased');

    const review = await prisma.review.upsert({
      where: { productId_userId: { productId, userId: req.user!.id } },
      create: { productId, userId: req.user!.id, rating: req.body.rating, comment: req.body.comment },
      update: { rating: req.body.rating, comment: req.body.comment },
    });
    await cache.invalidate(PRODUCT_CACHE_PREFIX);
    res.status(201).json({ review });
  }),
);

export default router;
