import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { formatPrice } from '../lib/format';
import { useOrder } from '../hooks/useOrders';
import { ErrorState, Spinner } from '../components/ui';

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId') ?? undefined;
  const { data: order, isLoading, isError } = useOrder(orderId, { pollWhilePending: true });

  if (!orderId) return <Navigate to="/orders" replace />;
  if (isLoading) return <Spinner label="Confirming your payment" />;
  if (isError || !order) return <ErrorState message="We couldn't load your order." />;

  const confirmed = order.status !== 'PENDING' && order.status !== 'CANCELLED';

  return (
    <div className="mx-auto my-20 max-w-lg text-center">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} aria-hidden>
        {confirmed ? '✓' : '…'}
      </div>
      <h1 className="prata-regular mt-6 text-3xl">{confirmed ? 'Thank you for your order!' : 'Confirming payment…'}</h1>
      <p className="mt-3 text-gray-600">
        {confirmed
          ? `Order #${order.number} is confirmed. We've emailed a receipt to ${order.customer.email}.`
          : 'This usually takes a few seconds. You can safely leave this page.'}
      </p>
      <div className="mt-8 rounded border border-gray-200 p-5 text-left text-sm">
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between py-1">
            <span>
              {i.name} ({i.size}) × {i.quantity}
            </span>
            <span>{formatPrice(i.lineTotal)}</span>
          </div>
        ))}
        <hr className="my-2" />
        <div className="flex justify-between font-semibold">
          <span>Total paid</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <Link to={`/orders/${order.id}`} className="btn-primary">
          View order
        </Link>
        <Link to="/collection" className="btn-secondary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
