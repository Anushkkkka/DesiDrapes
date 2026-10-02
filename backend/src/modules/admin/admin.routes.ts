import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cache } from '../../lib/cache.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/auth.js';
import { audit } from '../../services/events.js';
import { orderInclude, serializeOrder, updateOrderStatus } from '../orders/orders.service.js';
import { PRODUCT_CACHE_PREFIX, productInclude, ratingsFor, serializeProduct, sortSizes, uniqueSlug } from '../products/products.service.js';
import { dashboardStats } from './stats.service.js';

export const UPLOAD_DIR = path.resolve('uploads');

const router = Router();
router.use(requireAdmin);

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type Pagination = z.infer<typeof pagination>;
const paged = (p: Pagination) => ({ skip: (p.page - 1) * p.limit, take: p.limit });
const pageMeta = (p: Pagination, total: number) => ({ page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) });

// ---- Dashboard ------------------------------------------------------------

router.get(
  '/stats',
  asyncHandler(async (_req, res) => res.json(await dashboardStats())),
);

// ---- Orders ---------------------------------------------------------------

const orderStatus = z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

router.get(
  '/orders',
  validate({ query: pagination.extend({ status: orderStatus.optional(), search: z.string().trim().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as Pagination & { status?: z.infer<typeof orderStatus>; search?: string };
    const where: Prisma.OrderWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [
          { id: { endsWith: q.search.toLowerCase() } },
          { user: { email: { contains: q.search, mode: 'insensitive' } } },
          { user: { name: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...paged(q) }),
    ]);
    res.json({ items: orders.map(serializeOrder), ...pageMeta(q, total) });
  }),
);

router.patch(
  '/orders/:id/status',
  validate({ body: z.object({ status: orderStatus }) }),
  asyncHandler(async (req, res) => {
    const order = await updateOrderStatus(req.params.id, req.body.status, req.user!.id);
    res.json({ order: serializeOrder(order) });
  }),
);

// ---- Products -------------------------------------------------------------

const variantInput = z.object({
  size: z.string().trim().min(1).max(20),
  stock: z.number().int().min(0).max(100_000),
  lowStockThreshold: z.number().int().min(0).max(1000).default(3),
});

const productInput = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  price: z.number().min(0.5, 'Price must be at least $0.50').max(100_000),
  categoryId: z.string().min(1),
  subcategory: z.string().trim().max(60).optional().nullable(),
  bestseller: z.boolean().default(false),
  isActive: z.boolean().default(true),
  images: z.array(z.string().min(1).max(500)).min(1, 'Add at least one image').max(8),
  variants: z
    .array(variantInput)
    .min(1, 'Add at least one size')
    .refine((v) => new Set(v.map((x) => x.size)).size === v.length, 'Sizes must be unique'),
});

router.get(
  '/products',
  validate({ query: pagination.extend({ search: z.string().trim().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as Pagination & { search?: string };
    const where: Prisma.ProductWhereInput = q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {};
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({ where, include: productInclude, orderBy: { updatedAt: 'desc' }, ...paged(q) }),
    ]);
    const ratings = await ratingsFor(products.map((p) => p.id));
    res.json({ items: products.map((p) => serializeProduct(p, ratings.get(p.id))), ...pageMeta(q, total) });
  }),
);

/** Includes archived products and per-size alert thresholds, unlike the public endpoint. */
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: productInclude });
    if (!product) throw notFound('Product');
    res.json({
      product: {
        ...serializeProduct(product),
        variants: sortSizes(product.variants).map((v) => ({ id: v.id, size: v.size, stock: v.stock, lowStockThreshold: v.lowStockThreshold })),
      },
    });
  }),
);

router.post(
  '/products',
  validate({ body: productInput }),
  asyncHandler(async (req, res) => {
    const { variants, ...data } = req.body as z.infer<typeof productInput>;
    const product = await prisma.product.create({
      data: { ...data, slug: await uniqueSlug(data.name), variants: { create: variants } },
      include: productInclude,
    });
    await cache.invalidate(PRODUCT_CACHE_PREFIX);
    await audit('product.created', { userId: req.user!.id, entity: 'Product', entityId: product.id });
    res.status(201).json({ product: serializeProduct(product) });
  }),
);

router.put(
  '/products/:id',
  validate({ body: productInput }),
  asyncHandler(async (req, res) => {
    const { variants, ...data } = req.body as z.infer<typeof productInput>;
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
    if (!existing) throw notFound('Product');

    const keep = new Set(variants.map((v) => v.size));
    const removed = existing.variants.filter((v) => !keep.has(v.size));

    const product = await prisma.$transaction(async (tx) => {
      for (const v of variants) {
        await tx.productVariant.upsert({
          where: { productId_size: { productId: existing.id, size: v.size } },
          create: { productId: existing.id, ...v },
          update: { stock: v.stock, lowStockThreshold: v.lowStockThreshold },
        });
      }
      // Sizes that appear on past orders can't be deleted; they're zeroed out instead.
      for (const v of removed) {
        const used = await tx.orderItem.count({ where: { variantId: v.id } });
        if (used) await tx.productVariant.update({ where: { id: v.id }, data: { stock: 0 } });
        else await tx.productVariant.delete({ where: { id: v.id } });
      }
      return tx.product.update({
        where: { id: existing.id },
        data: { ...data, slug: data.name !== existing.name ? await uniqueSlug(data.name, existing.id) : undefined },
        include: productInclude,
      });
    });

    await cache.invalidate(PRODUCT_CACHE_PREFIX);
    await audit('product.updated', { userId: req.user!.id, entity: 'Product', entityId: product.id });
    res.json({ product: serializeProduct(product) });
  }),
);

/** Soft delete: products referenced by past orders must keep existing. */
router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    await cache.invalidate(PRODUCT_CACHE_PREFIX);
    await audit('product.archived', { userId: req.user!.id, entity: 'Product', entityId: req.params.id });
    res.status(204).end();
  }),
);

router.patch(
  '/variants/:id',
  validate({ body: variantInput.omit({ size: true }).partial() }),
  asyncHandler(async (req, res) => {
    const variant = await prisma.productVariant.update({ where: { id: req.params.id }, data: req.body });
    await cache.invalidate(PRODUCT_CACHE_PREFIX);
    await audit('inventory.adjusted', { userId: req.user!.id, entity: 'ProductVariant', entityId: variant.id, metadata: req.body });
    res.json({ variant });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ categories: await prisma.category.findMany({ orderBy: { name: 'asc' } }) });
  }),
);

// ---- Image uploads --------------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Only JPEG, PNG or WebP images are allowed'));
  },
});

router.post(
  '/uploads',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No image uploaded (field name: image)');
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }),
);

// ---- Users ----------------------------------------------------------------

router.get(
  '/users',
  validate({ query: pagination.extend({ search: z.string().trim().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as Pagination & { search?: string };
    const where: Prisma.UserWhereInput = q.search
      ? { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { name: { contains: q.search, mode: 'insensitive' } }] }
      : {};
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        ...paged(q),
      }),
    ]);
    res.json({
      items: users.map(({ _count, ...u }) => ({ ...u, orderCount: _count.orders })),
      ...pageMeta(q, total),
    });
  }),
);

router.patch(
  '/users/:id/role',
  validate({ body: z.object({ role: z.enum(['CUSTOMER', 'ADMIN']) }) }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw badRequest('You cannot change your own role');
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: { id: true, name: true, email: true, role: true },
    });
    await audit('user.role_changed', { userId: req.user!.id, entity: 'User', entityId: user.id, metadata: { role: user.role } });
    res.json({ user });
  }),
);

// ---- Coupons --------------------------------------------------------------

const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, 'Use 3-40 letters, numbers, - or _'),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().positive(),
    minSubtotal: z.number().min(0).default(0),
    usageLimit: z.number().int().positive().nullable().optional(),
    active: z.boolean().default(true),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((c) => c.type !== 'PERCENT' || c.value <= 100, { message: 'Percent discounts cannot exceed 100', path: ['value'] });

const serializeCoupon = (c: Prisma.CouponGetPayload<object>) => ({
  ...c,
  value: Number(c.value),
  minSubtotal: Number(c.minSubtotal),
});

router.get(
  '/coupons',
  asyncHandler(async (_req, res) => {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ coupons: coupons.map(serializeCoupon) });
  }),
);

router.post(
  '/coupons',
  validate({ body: couponInput }),
  asyncHandler(async (req, res) => {
    const coupon = await prisma.coupon.create({ data: req.body });
    await audit('coupon.created', { userId: req.user!.id, entity: 'Coupon', entityId: coupon.id });
    res.status(201).json({ coupon: serializeCoupon(coupon) });
  }),
);

router.patch(
  '/coupons/:id',
  validate({ body: z.object({ active: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: { active: req.body.active } });
    await audit('coupon.updated', { userId: req.user!.id, entity: 'Coupon', entityId: coupon.id, metadata: req.body });
    res.json({ coupon: serializeCoupon(coupon) });
  }),
);

// ---- Audit log ------------------------------------------------------------

router.get(
  '/audit-logs',
  validate({ query: pagination }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as Pagination;
    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        ...paged(q),
      }),
    ]);
    res.json({ items: logs, ...pageMeta(q, total) });
  }),
);

export default router;
