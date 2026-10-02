import type { Totals } from '../lib/types';
import { formatPrice } from '../lib/format';

export default function OrderSummary({ totals, couponCode, freeShippingThreshold }: { totals: Totals; couponCode?: string | null; freeShippingThreshold?: number }) {
  const toFree = freeShippingThreshold ? freeShippingThreshold - (totals.subtotal - totals.discount) : 0;
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{formatPrice(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <dt>Discount{couponCode ? ` (${couponCode})` : ''}</dt>
          <dd>−{formatPrice(totals.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt>Shipping</dt>
        <dd>{totals.shippingFee === 0 ? 'Free' : formatPrice(totals.shippingFee)}</dd>
      </div>
      {toFree > 0 && totals.shippingFee > 0 && (
        <p className="text-xs text-gray-500">Add {formatPrice(toFree)} more for free shipping.</p>
      )}
      <hr />
      <div className="flex justify-between text-base font-semibold">
        <dt>Total</dt>
        <dd>{formatPrice(totals.total)}</dd>
      </div>
    </dl>
  );
}
