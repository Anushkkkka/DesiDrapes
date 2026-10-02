import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useOrder } from '../hooks/useOrders';
import { ErrorState, Spinner } from '../components/ui';

/**
 * Stand-in for a hosted payment page when Stripe isn't configured. Lets demo
 * users exercise both the success and failure paths without any card data.
 */
export default function MockCheckout() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId') ?? undefined;
  const { data: order, isLoading, isError } = useOrder(orderId);
  const navigate = useNavigate();

  const confirm = useMutation({
    mutationFn: (outcome: 'success' | 'failure') =>
      api<{ status: string }>(`/payments/mock/${orderId}/confirm`, { method: 'POST', body: { outcome } }),
    onSuccess: (r) => {
      if (r.status === 'PAID') navigate(`/order-success?orderId=${orderId}`, { replace: true });
      else {
        toast.error('Payment failed. Your order was cancelled and items released.');
        navigate(`/orders/${orderId}`, { replace: true });
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!orderId) return <Navigate to="/orders" replace />;
  if (isLoading) return <Spinner label="Loading checkout" />;
  if (isError || !order) return <ErrorState message="We couldn't find this order." />;
  if (order.status !== 'PENDING') return <Navigate to={`/orders/${order.id}`} replace />;

  return (
    <div className="mx-auto my-16 max-w-md rounded-xl border border-gray-200 p-8 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-gray-400">Test payment gateway</p>
      <h1 className="prata-regular mt-2 text-2xl">Pay {formatPrice(order.total)}</h1>
      <p className="mt-1 text-sm text-gray-500">Order #{order.number}</p>

      <div className="mt-6 rounded bg-amber-50 p-4 text-sm text-amber-800">
        This store runs in demo mode. No money is charged and no card details are collected. Choose an outcome to continue.
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button onClick={() => confirm.mutate('success')} disabled={confirm.isPending} className="btn-primary">
          Simulate successful payment
        </button>
        <button onClick={() => confirm.mutate('failure')} disabled={confirm.isPending} className="btn-secondary">
          Simulate declined card
        </button>
      </div>
    </div>
  );
}
