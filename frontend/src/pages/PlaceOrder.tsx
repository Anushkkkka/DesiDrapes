import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-toastify';
import { errorMessage } from '../lib/api';
import { addressSchema, type AddressInput } from '../lib/schemas';
import { formatPrice } from '../lib/format';
import { useCart } from '../store/cart';
import { useMe } from '../hooks/useAuth';
import { useCreateOrder, usePaymentProvider, useQuote } from '../hooks/useOrders';
import OrderSummary from '../components/OrderSummary';
import { Title } from '../components/ui';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

export default function PlaceOrder() {
  const { items, couponCode, clear } = useCart();
  const { data: user } = useMe();
  const { data: quote } = useQuote(items, couponCode);
  const { data: provider } = usePaymentProvider();
  const createOrder = useCreateOrder();

  const form = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { fullName: user?.name ?? '', phone: '', line1: '', line2: '', city: '', state: 'NSW', postcode: '', country: 'Australia' },
  });
  const { errors } = form.formState;

  if (!items.length && !createOrder.isSuccess) return <Navigate to="/cart" replace />;

  const onSubmit = form.handleSubmit(async (shippingAddress) => {
    try {
      const { checkoutUrl } = await createOrder.mutateAsync({ items, couponCode, shippingAddress });
      window.location.assign(checkoutUrl);
      // Stock is now reserved server-side, so the local cart can go.
      clear();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  const field = (name: keyof AddressInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="w-full">
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} {...form.register(name)} className="input" aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] && <p className="field-error">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-[80vh] flex-col justify-between gap-8 border-t pt-5 sm:flex-row sm:pt-14">
      <section className="flex w-full flex-col gap-4 sm:max-w-[480px]">
        <div className="my-3 [&>div]:text-left">
          <Title first="DELIVERY" second="INFORMATION" />
        </div>
        {field('fullName', 'Full name', { autoComplete: 'name' })}
        {field('phone', 'Phone', { autoComplete: 'tel', type: 'tel', placeholder: '+61 4xx xxx xxx' })}
        {field('line1', 'Street address', { autoComplete: 'address-line1' })}
        {field('line2', 'Apartment, unit (optional)', { autoComplete: 'address-line2' })}
        <div className="flex gap-3">
          {field('city', 'City / suburb', { autoComplete: 'address-level2' })}
          <div className="w-full">
            <label className="label" htmlFor="state">
              State
            </label>
            <select id="state" {...form.register('state')} className="input">
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          {field('postcode', 'Postcode', { autoComplete: 'postal-code', inputMode: 'numeric' })}
          {field('country', 'Country', { readOnly: true, className: 'input bg-gray-50' })}
        </div>
      </section>

      <section className="mt-8 w-full sm:max-w-[420px]">
        <div className="[&>div]:text-left">
          <Title first="ORDER" second="SUMMARY" />
        </div>
        <ul className="mb-4 divide-y text-sm">
          {items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 py-2">
              {i.image && <img src={i.image} alt="" className="w-10" />}
              <span className="flex-1">
                {i.name} <span className="text-gray-500">({i.size}) × {i.quantity}</span>
              </span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        {quote && <OrderSummary totals={quote.totals} couponCode={quote.coupon?.code} />}
        {quote?.issues.length ? (
          <p className="field-error mt-2">
            {quote.issues[0].message}.{' '}
            <Link to="/cart" className="underline">
              Update cart
            </Link>
          </p>
        ) : null}

        <div className="mt-8 rounded border border-gray-200 p-4 text-sm">
          <p className="font-medium">Payment</p>
          {provider === 'stripe' ? (
            <p className="mt-1 text-gray-600">You'll be redirected to Stripe's secure checkout. In test mode, use card 4242 4242 4242 4242.</p>
          ) : (
            <p className="mt-1 text-gray-600">Demo mode: payments are simulated and no card details are collected.</p>
          )}
        </div>

        <button disabled={form.formState.isSubmitting || !quote || quote.issues.length > 0} className="btn-primary mt-6 w-full">
          {form.formState.isSubmitting ? 'Placing order…' : `PLACE ORDER${quote ? ` · ${formatPrice(quote.totals.total)}` : ''}`}
        </button>
      </section>
    </form>
  );
}
