import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assets } from '../lib/assets';
import { formatPrice } from '../lib/format';
import { MAX_PER_ITEM, useCart } from '../store/cart';
import { useQuote } from '../hooks/useOrders';
import OrderSummary from '../components/OrderSummary';
import { EmptyState, Title } from '../components/ui';

export default function Cart() {
  const { items, couponCode, setQuantity, remove, setCoupon } = useCart();
  const [couponInput, setCouponInput] = useState(couponCode);
  const { data: quote, isFetching } = useQuote(items, couponCode);
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="border-t pt-14">
        <EmptyState
          title="Your cart is empty"
          message="Discover lehengas, sarees, kurtas and more."
          action={
            <Link to="/collection" className="btn-primary">
              Start shopping
            </Link>
          }
        />
      </div>
    );
  }

  const issueFor = (variantId: string) => quote?.issues.find((i) => i.variantId === variantId)?.message;
  const priceFor = (variantId: string, fallback: number) => quote?.lines.find((l) => l.variantId === variantId)?.unitPrice ?? fallback;

  return (
    <div className="border-t pt-14">
      <div className="[&>div]:text-left">
        <Title first="YOUR" second="CART" />
      </div>

      <ul>
        {items.map((item) => {
          const issue = issueFor(item.variantId);
          const price = priceFor(item.variantId, item.price);
          return (
            <li key={item.variantId} className="grid grid-cols-[4fr_1fr_0.5fr] items-center gap-4 border-y py-4 text-gray-700 sm:grid-cols-[4fr_2fr_0.5fr]">
              <div className="flex items-start gap-4 sm:gap-6">
                <Link to={`/product/${item.slug}`}>
                  {item.image && <img src={item.image} alt="" className="w-16 sm:w-20" />}
                </Link>
                <div>
                  <Link to={`/product/${item.slug}`} className="text-sm font-medium sm:text-lg">
                    {item.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-4">
                    <p>{formatPrice(price)}</p>
                    <p className="border bg-slate-50 px-2 sm:px-3 sm:py-1">{item.size}</p>
                  </div>
                  {issue && <p className="mt-1 text-xs text-red-600">{issue}</p>}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={Math.min(item.maxQuantity, MAX_PER_ITEM)}
                value={item.quantity}
                onChange={(e) => e.target.value && setQuantity(item.variantId, Number(e.target.value))}
                className="max-w-16 border px-1 py-1 sm:px-2"
                aria-label={`Quantity for ${item.name}`}
              />
              <button onClick={() => remove(item.variantId)} aria-label={`Remove ${item.name}`}>
                <img src={assets.bin} alt="" className="mr-4 w-4 sm:w-5" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="my-16 flex flex-col gap-10 sm:flex-row sm:justify-end">
        <form
          className="w-full sm:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            setCoupon(couponInput);
          }}
        >
          <label className="label" htmlFor="coupon">
            Have a coupon?
          </label>
          <div className="flex">
            <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="e.g. WELCOME10" className="input rounded-r-none uppercase" />
            <button className="bg-black px-4 text-sm text-white">Apply</button>
          </div>
          {couponCode && quote?.couponError && <p className="field-error">{quote.couponError}</p>}
          {quote?.coupon && (
            <p className="mt-1 text-xs text-emerald-700">
              {quote.coupon.code} applied.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setCoupon('');
                  setCouponInput('');
                }}
              >
                Remove
              </button>
            </p>
          )}
        </form>

        <div className="w-full sm:w-[400px]">
          <div className="[&>div]:text-left">
            <Title first="CART" second="TOTALS" />
          </div>
          <div className={isFetching ? 'opacity-60' : ''}>
            {quote ? <OrderSummary totals={quote.totals} couponCode={quote.coupon?.code} freeShippingThreshold={quote.freeShippingThreshold} /> : <p className="text-sm text-gray-500">Calculating…</p>}
          </div>
          <div className="mt-8 text-right">
            <button onClick={() => navigate('/place-order')} disabled={!quote || quote.issues.length > 0} className="btn-primary">
              PROCEED TO CHECKOUT
            </button>
            {quote && quote.issues.length > 0 && <p className="field-error">Please fix the items marked above.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
