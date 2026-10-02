/**
 * Idempotent development seed: safe to run repeatedly.
 *   npm run db:seed
 */
import { PrismaClient, type OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: [path.resolve('.env'), path.resolve('../.env')], quiet: true });

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));

interface SeedProduct {
  legacyId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  subcategory: string;
  sizes: string[];
  bestseller: boolean;
}

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@desidrapes.com', password: 'Admin@12345', name: 'Store Admin' },
  customer: { email: 'customer@desidrapes.com', password: 'Customer@123', name: 'Priya Sharma' },
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Deterministic pseudo-random numbers so every seed produces the same stock levels. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function main() {
  const products: SeedProduct[] = JSON.parse(fs.readFileSync(path.join(here, 'seed/products.json'), 'utf8'));
  const random = rng(42);

  // Users
  const [, customer] = await Promise.all(
    (['admin', 'customer'] as const).map(async (key) => {
      const a = DEMO_ACCOUNTS[key];
      return prisma.user.upsert({
        where: { email: a.email },
        update: {},
        create: {
          email: a.email,
          name: a.name,
          passwordHash: await bcrypt.hash(a.password, 12),
          role: key === 'admin' ? 'ADMIN' : 'CUSTOMER',
        },
      });
    }),
  );

  // Categories
  const categories = new Map<string, string>();
  for (const name of [...new Set(products.map((p) => p.category))]) {
    const c = await prisma.category.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
    categories.set(name, c.id);
  }

  // Products + per-size variants
  const now = Date.now();
  const usedSlugs = new Set<string>();
  for (const [index, p] of products.entries()) {
    let slug = slugify(p.name);
    if (usedSlugs.has(slug)) slug = `${slug}-${p.legacyId}`;
    usedSlugs.add(slug);

    const product = await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: p.name,
        description: p.description,
        price: p.price,
        images: p.images,
        categoryId: categories.get(p.category)!,
        subcategory: p.subcategory,
        bestseller: p.bestseller,
        // Stagger creation dates so "newest" sorting is meaningful.
        createdAt: new Date(now - index * 6 * 60 * 60 * 1000),
      },
    });
    for (const size of p.sizes) {
      // Mostly healthy stock with a few low / sold-out sizes to exercise alerts.
      const roll = random();
      const stock = roll < 0.06 ? 0 : roll < 0.15 ? 1 + Math.floor(random() * 2) : 5 + Math.floor(random() * 20);
      await prisma.productVariant.upsert({
        where: { productId_size: { productId: product.id, size } },
        update: {},
        create: { productId: product.id, size, stock, lowStockThreshold: 3 },
      });
    }
  }

  // Coupons
  const coupons = [
    { code: 'WELCOME10', type: 'PERCENT' as const, value: 10, minSubtotal: 0 },
    { code: 'FESTIVE20', type: 'PERCENT' as const, value: 20, minSubtotal: 150 },
    { code: 'FLAT15', type: 'FIXED' as const, value: 15, minSubtotal: 100, usageLimit: 100 },
    { code: 'EXPIRED5', type: 'FIXED' as const, value: 5, minSubtotal: 0, expiresAt: new Date('2024-01-01') },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // Sample order history (only once) so the dashboard and "My orders" have data.
  if ((await prisma.order.count({ where: { userId: customer.id } })) === 0) {
    const variants = await prisma.productVariant.findMany({ where: { stock: { gt: 3 } }, include: { product: true }, take: 40 });
    const statuses: OrderStatus[] = ['DELIVERED', 'DELIVERED', 'SHIPPED', 'PROCESSING', 'PAID', 'DELIVERED', 'PAID', 'CANCELLED'];
    const address = {
      fullName: DEMO_ACCOUNTS.customer.name,
      phone: '+61 400 123 456',
      line1: '12 Harbour Street',
      city: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      country: 'Australia',
    };

    for (let i = 0; i < 14; i++) {
      const picks = [variants[(i * 3) % variants.length], variants[(i * 7 + 1) % variants.length]].slice(0, 1 + (i % 2));
      const lines = picks.map((v) => ({ v, quantity: 1 + (i % 2) }));
      const subtotal = lines.reduce((s, l) => s + Number(l.v.product.price) * l.quantity, 0);
      const shippingFee = subtotal >= 150 ? 0 : 10;
      const status = statuses[i % statuses.length];
      const createdAt = new Date(now - (i * 2 + 1) * 24 * 60 * 60 * 1000);

      await prisma.order.create({
        data: {
          userId: customer.id,
          status,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          shippingAddress: address,
          createdAt,
          items: {
            create: lines.map((l) => ({
              productId: l.v.productId,
              variantId: l.v.id,
              name: l.v.product.name,
              image: l.v.product.images[0],
              size: l.v.size,
              unitPrice: l.v.product.price,
              quantity: l.quantity,
            })),
          },
          payments: {
            create: {
              provider: 'mock',
              providerRef: `seed_${i}`,
              amount: subtotal + shippingFee,
              status: status === 'CANCELLED' ? 'REFUNDED' : 'SUCCEEDED',
              createdAt,
            },
          },
        },
      });

      if (status === 'DELIVERED') {
        await prisma.review.upsert({
          where: { productId_userId: { productId: lines[0].v.productId, userId: customer.id } },
          update: {},
          create: {
            productId: lines[0].v.productId,
            userId: customer.id,
            rating: 4 + (i % 2),
            comment: ['Beautiful fabric and perfect fit!', 'Lovely colour, got so many compliments.', 'Great quality for the price.'][i % 3],
            createdAt,
          },
        });
      }
    }
    await prisma.notification.create({
      data: { userId: customer.id, type: 'WELCOME', message: `Welcome to DesiDrapes, ${DEMO_ACCOUNTS.customer.name}!` },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    orders: await prisma.order.count(),
    coupons: await prisma.coupon.count(),
  };
  console.log('Seed complete:', counts);
  console.log(`Admin:    ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`);
  console.log(`Customer: ${DEMO_ACCOUNTS.customer.email} / ${DEMO_ACCOUNTS.customer.password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
