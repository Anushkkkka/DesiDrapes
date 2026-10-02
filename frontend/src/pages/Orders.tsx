import { Link } from 'react-router-dom';
import { formatDate, formatPrice, STATUS_LABELS, STATUS_STYLES } from '../lib/format';
import { useOrders } from '../hooks/useOrders';
import { Badge, EmptyState, ErrorState, Spinner, Title } from '../components/ui';

export default function Orders() {
  const { data: orders, isLoading, isError, refetch } = useOrders();

  return (
    <div className="border-t pt-16">
      <div className="[&>div]:text-left">
        <Title first="MY" second="ORDERS" />
      </div>
      {isLoading ? (
        <Spinner label="Loading orders" />
      ) : isError ? (
        <ErrorState message="We couldn't load your orders." onRetry={() => refetch()} />
      ) : !orders?.length ? (
        <EmptyState
          title="No orders yet"
          message="When you place an order it will show up here."
          action={
            <Link to="/collection" className="btn-primary">
              Shop the collection
            </Link>
          }
        />
      ) : (
        <ul className="divide-y border-y">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex flex-col gap-4 py-4 text-gray-700 hover:bg-gray-50 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((i) => i.image && <img key={i.id} src={i.image} alt="" className="w-12 rounded border-2 border-white sm:w-14" />)}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Order #{o.number}</p>
                    <p className="text-gray-500">
                      {formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <Badge className={STATUS_STYLES[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  <span className="w-20 text-right font-medium">{formatPrice(o.total)}</span>
                  <span className="hidden text-gray-400 md:inline">›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
