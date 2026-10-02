import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ApiError, errorMessage } from '../lib/api';
import { formatDateTime, formatPrice, STATUS_LABELS, STATUS_STYLES } from '../lib/format';
import type { OrderStatus } from '../lib/types';
import { useOrder, useOrderAction } from '../hooks/useOrders';
import OrderSummary from '../components/OrderSummary';
import { BackLink, Badge, ErrorState, Spinner } from '../components/ui';
import { NotFound } from './StaticPages';

const STEPS: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function Timeline({ status }: { status: OrderStatus }) {
  if (status === 'PENDING' || status === 'CANCELLED') return null;
  const current = STEPS.indexOf(status);
  return (
    <ol className="my-8 grid grid-cols-4 gap-2 text-center text-xs" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col items-center gap-2">
          <span className={`h-1.5 w-full rounded ${i <= current ? 'bg-black' : 'bg-gray-200'}`} />
          <span className={i <= current ? 'font-medium text-gray-900' : 'text-gray-400'}>{STATUS_LABELS[s]}</span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data: order, isLoading, isError, error } = useOrder(id);
  const pay = useOrderAction('pay');
  const cancel = useOrderAction('cancel');

  if (isLoading) return <Spinner label="Loading order" />;
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (isError || !order) return <ErrorState message="We couldn't load this order." />;

  const a = order.shippingAddress;

  return (
    <div className="border-t pt-10">
      <BackLink to="/orders">All orders</BackLink>
      {params.get('payment') === 'cancelled' && order.status === 'PENDING' && (
        <div className="mb-6 rounded bg-amber-50 p-4 text-sm text-amber-800">Payment was cancelled. Your items are held for a short time, so you can try again below.</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="prata-regular text-2xl">Order #{order.number}</h1>
          <p className="text-sm text-gray-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <Badge className={STATUS_STYLES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <Timeline status={order.status} />

      {order.status === 'PENDING' && (
        <div className="my-6 flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={pay.isPending}
            onClick={() =>
              pay.mutate(order.id, {
                onSuccess: (r) => r.checkoutUrl && window.location.assign(r.checkoutUrl),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Complete payment
          </button>
          <button
            className="btn-secondary"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(order.id, {
                onSuccess: () => toast.info('Order cancelled'),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Cancel order
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[2fr_1fr]">
        <section className="card">
          <h2 className="mb-3 font-medium">Items</h2>
          <ul className="divide-y">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-3 text-sm">
                {i.image && <img src={i.image} alt="" className="w-14 rounded" />}
                <div className="flex-1">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-gray-500">
                    Size {i.size} · Qty {i.quantity} · {formatPrice(i.unitPrice)} each
                  </p>
                </div>
                <p>{formatPrice(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          {order.status === 'DELIVERED' && (
            <p className="mt-3 text-xs text-gray-500">
              Loved your purchase?{' '}
              <Link to={`/product/${order.items[0]?.productId}`} className="underline">
                Leave a review
              </Link>
              .
            </p>
          )}
        </section>

        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-medium">Summary</h2>
            <OrderSummary totals={order} couponCode={order.couponCode} />
          </section>
          <section className="card text-sm">
            <h2 className="mb-2 font-medium">Shipping to</h2>
            <address className="not-italic text-gray-600">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city} {a.state} {a.postcode}
              <br />
              {a.country}
              <br />
              {a.phone}
            </address>
          </section>
        </div>
      </div>
    </div>
  );
}
