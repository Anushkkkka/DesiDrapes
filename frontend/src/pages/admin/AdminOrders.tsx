import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime, formatPrice, STATUS_LABELS, STATUS_STYLES } from '../../lib/format';
import type { Order, OrderStatus } from '../../lib/types';
import { Badge, EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { useAdminMutation, useAdminOrders } from './adminApi';

/** Mirrors the server's allowed transitions so admins only see valid choices. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function StatusControl({ order }: { order: Order }) {
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const update = useAdminMutation((status: OrderStatus) =>
    api(`/admin/orders/${order.id}/status`, { method: 'PATCH', body: { status } }),
  );
  const options = NEXT[order.status];
  if (!options.length) return <span className="text-xs text-gray-400">Final</span>;

  const apply = (status: OrderStatus) =>
    update.mutate(status, {
      onSuccess: () => {
        toast.success(`Order #${order.number} → ${STATUS_LABELS[status]}`);
        setConfirming(null);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-red-700">{order.status === 'PENDING' ? 'Cancel?' : 'Cancel & refund?'}</span>
        <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={() => apply(confirming)} disabled={update.isPending}>
          Yes
        </button>
        <button className="underline" onClick={() => setConfirming(null)}>
          No
        </button>
      </span>
    );
  }

  return (
    <select
      value=""
      disabled={update.isPending}
      onChange={(e) => {
        const status = e.target.value as OrderStatus;
        if (status === 'CANCELLED') setConfirming(status);
        else if (status) apply(status);
      }}
      className="rounded border border-gray-300 px-2 py-1 text-xs"
      aria-label={`Update status for order ${order.number}`}
    >
      <option value="">Move to…</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, refetch } = useAdminOrders({ status: status || undefined, search: query || undefined, page });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="prata-regular text-2xl">Orders</h1>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
          className="flex"
        >
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, name or email" className="input w-64 rounded-r-none" aria-label="Search orders" />
          <button className="bg-black px-4 text-sm text-white">Search</button>
        </form>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load orders." onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <EmptyState title="No orders found" />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((o) => (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="font-medium hover:underline" aria-expanded={expanded === o.id}>
                          #{o.number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p>{o.customer.name}</p>
                        <p className="text-xs text-gray-500">{o.customer.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">{formatPrice(o.total)}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLES[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusControl order={o} />
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3 text-xs text-gray-600">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <ul>
                              {o.items.map((i) => (
                                <li key={i.id}>
                                  <Link to={`/product/${i.productId}`} className="hover:underline">
                                    {i.name}
                                  </Link>{' '}
                                  ({i.size}) × {i.quantity}: {formatPrice(i.lineTotal)}
                                </li>
                              ))}
                            </ul>
                            <p>
                              {o.shippingAddress.fullName}, {o.shippingAddress.line1}, {o.shippingAddress.city} {o.shippingAddress.state}{' '}
                              {o.shippingAddress.postcode} · {o.shippingAddress.phone}
                              {o.couponCode && <><br />Coupon: {o.couponCode} (−{formatPrice(o.discount)})</>}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => setParams({ ...(status && { status }), page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
