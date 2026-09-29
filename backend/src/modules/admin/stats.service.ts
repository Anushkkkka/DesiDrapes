import type { OrderStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const REVENUE_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** YYYY-MM-DD in the server's timezone (toISOString would shift days across UTC). */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function lowStockVariants(limit = 20) {
  // Prisma can't compare two columns in `where`, so this one uses raw SQL.
  const rows = await prisma.$queryRaw<
    { id: string; size: string; stock: number; lowStockThreshold: number; productId: string; name: string; slug: string }[]
  >`
    SELECT v.id, v.size, v.stock, v."lowStockThreshold", p.id AS "productId", p.name, p.slug
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE p."isActive" = true AND v.stock <= v."lowStockThreshold"
    ORDER BY v.stock ASC, p.name ASC
    LIMIT ${limit}
  `;
  return rows;
}

export async function dashboardStats(days = 30) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [revenue, statusCounts, customers, recentPaid, topItems, lowStock] = await Promise.all([
    prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.order.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since } },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: { order: { status: { in: REVENUE_STATUSES } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    lowStockVariants(),
  ]);

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    byDay.set(localDay(d), { revenue: 0, orders: 0 });
  }
  for (const o of recentPaid) {
    const day = byDay.get(localDay(o.createdAt));
    if (day) {
      day.revenue += Number(o.total);
      day.orders += 1;
    }
  }

  const paidOrders = revenue._count._all;
  const totalRevenue = Number(revenue._sum.total ?? 0);
  return {
    totalRevenue,
    paidOrders,
    averageOrderValue: paidOrders ? Math.round((totalRevenue / paidOrders) * 100) / 100 : 0,
    customers,
    ordersByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    revenueByDay: [...byDay].map(([date, v]) => ({ date, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders })),
    topProducts: topItems.map((t) => ({ productId: t.productId, name: t.name, unitsSold: t._sum.quantity ?? 0 })),
    lowStock,
  };
}

/** Summary of a single day, used by the n8n daily report workflow. */
export async function dailyReport(date = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [paid, newCustomers, orders, lowStock] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: start, lt: end } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: start, lt: end } } }),
    prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }),
    lowStockVariants(50),
  ]);

  return {
    date: localDay(start),
    revenue: Number(paid._sum.total ?? 0),
    paidOrders: paid._count._all,
    ordersPlaced: orders,
    newCustomers,
    lowStockCount: lowStock.length,
    lowStock: lowStock.map((v) => ({ name: v.name, size: v.size, stock: v.stock })),
  };
}
