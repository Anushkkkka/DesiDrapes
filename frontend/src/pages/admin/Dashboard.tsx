import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, STATUS_LABELS, STATUS_STYLES } from '../../lib/format';
import type { OrderStatus } from '../../lib/types';
import { Badge, ErrorState, Spinner } from '../../components/ui';
import { useStats, type Stats } from './adminApi';

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** Single-series daily revenue bars with a per-bar hover tooltip and a screen-reader table. */
function RevenueChart({ data }: { data: Stats['revenueByDay'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const niceMax = Math.ceil(max / 50) * 50;
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="card">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="font-medium">Revenue, last 30 days</span>
        <span className="text-xs text-gray-500">Paid orders, AUD</span>
      </figcaption>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 flex justify-between text-[10px] text-gray-400" aria-hidden>
          <span>{formatPrice(niceMax)}</span>
        </div>
        <div className="flex h-44 items-end gap-[2px] border-b border-gray-200 pt-4" onMouseLeave={() => setHover(null)} aria-hidden>
          {data.map((d, i) => (
            <div key={d.date} className="flex h-full flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)}>
              <div
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-brand' : 'bg-brand/70'}`}
                style={{ height: `${d.revenue ? Math.max((d.revenue / niceMax) * 100, 2) : 0}%` }}
              />
            </div>
          ))}
        </div>
        {active && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow"
            style={{ left: `${((hover! + 0.5) / data.length) * 100}%` }}
          >
            <p className="text-gray-500">{label(active.date)}</p>
            <p className="font-semibold text-gray-900">{formatPrice(active.revenue)}</p>
            <p className="text-gray-500">
              {active.orders} order{active.orders === 1 ? '' : 's'}
            </p>
          </div>
        )}
        <div className="mt-1 flex justify-between text-[10px] text-gray-400" aria-hidden>
          <span>{label(data[0].date)}</span>
          <span>{label(data[data.length - 1].date)}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>Daily revenue</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatPrice(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, isError, refetch } = useStats();
  if (isLoading) return <Spinner label="Loading dashboard" />;
  if (isError || !stats) return <ErrorState message="Couldn't load stats." onRetry={() => refetch()} />;

  const pending = stats.ordersByStatus.PAID ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="prata-regular text-2xl">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total revenue" value={formatPrice(stats.totalRevenue)} hint={`${stats.paidOrders} paid orders`} />
        <StatTile label="Avg. order value" value={formatPrice(stats.averageOrderValue)} />
        <StatTile label="Customers" value={String(stats.customers)} />
        <StatTile label="To fulfil" value={String(pending)} hint="Paid, not yet processing" />
      </div>

      <RevenueChart data={stats.revenueByDay} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card">
          <h2 className="mb-3 font-medium">Orders by status</h2>
          <ul className="space-y-2 text-sm">
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <li key={s} className="flex items-center justify-between">
                <Badge className={STATUS_STYLES[s]}>{STATUS_LABELS[s]}</Badge>
                <Link to={`/admin/orders?status=${s}`} className="text-gray-700 hover:underline">
                  {stats.ordersByStatus[s] ?? 0}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-medium">Top sellers</h2>
          <ol className="space-y-2 text-sm">
            {stats.topProducts.map((p, i) => (
              <li key={p.productId} className="flex justify-between gap-3">
                <span className="truncate text-gray-700">
                  {i + 1}. {p.name}
                </span>
                <span className="shrink-0 text-gray-500">{p.unitsSold} sold</span>
              </li>
            ))}
            {!stats.topProducts.length && <li className="text-gray-500">No sales yet.</li>}
          </ol>
        </section>

        <section className="card">
          <h2 className="mb-3 font-medium">
            Low stock <span className="text-sm font-normal text-gray-500">({stats.lowStock.length})</span>
          </h2>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {stats.lowStock.map((v) => (
              <li key={v.id} className="flex justify-between gap-3">
                <Link to={`/admin/products/${v.productId}`} className="truncate text-gray-700 hover:underline">
                  {v.name} <span className="text-gray-400">({v.size})</span>
                </Link>
                <span className={`shrink-0 font-medium ${v.stock === 0 ? 'text-red-600' : 'text-amber-700'}`}>
                  {v.stock === 0 ? 'Sold out' : `${v.stock} left`}
                </span>
              </li>
            ))}
            {!stats.lowStock.length && <li className="text-gray-500">All stock levels healthy.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
