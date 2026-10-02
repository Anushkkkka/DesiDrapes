import { useState } from 'react';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatPrice } from '../../lib/format';
import { Badge, ErrorState, Spinner } from '../../components/ui';
import { useAdminMutation, useCoupons, type Coupon } from './adminApi';

const EMPTY = { code: '', type: 'PERCENT' as Coupon['type'], value: '', minSubtotal: '', usageLimit: '', expiresAt: '' };

export default function AdminCoupons() {
  const { data: coupons, isLoading, isError, refetch } = useCoupons();
  const [form, setForm] = useState(EMPTY);

  const create = useAdminMutation(() =>
    api('/admin/coupons', {
      method: 'POST',
      body: {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minSubtotal: Number(form.minSubtotal || 0),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      },
    }),
  );
  const toggle = useAdminMutation((c: Coupon) => api(`/admin/coupons/${c.id}`, { method: 'PATCH', body: { active: !c.active } }));

  const describe = (c: Coupon) => (c.type === 'PERCENT' ? `${c.value}% off` : `${formatPrice(c.value)} off`);
  const expired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <h1 className="prata-regular text-2xl">Coupons</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined, {
            onSuccess: () => {
              toast.success(`Coupon ${form.code.toUpperCase()} created`);
              setForm(EMPTY);
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
        className="card grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CODE" className="input uppercase" aria-label="Coupon code" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Coupon['type'] })} className="input" aria-label="Discount type">
          <option value="PERCENT">% off</option>
          <option value="FIXED">$ off</option>
        </select>
        <input required type="number" min={1} max={form.type === 'PERCENT' ? 100 : undefined} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Value" className="input" aria-label="Discount value" />
        <input type="number" min={0} value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} placeholder="Min spend" className="input" aria-label="Minimum spend" />
        <input type="number" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Usage limit" className="input" aria-label="Usage limit" />
        <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="input" aria-label="Expiry date" />
        <button disabled={create.isPending} className="btn-primary sm:col-span-3 lg:col-span-6">
          Create coupon
        </button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load coupons." onRetry={() => refetch()} />
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min spend</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons?.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono">{c.code}</td>
                  <td className="px-4 py-3">{describe(c)}</td>
                  <td className="px-4 py-3">{c.minSubtotal ? formatPrice(c.minSubtotal) : 'None'}</td>
                  <td className="px-4 py-3">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                  <td className="px-4 py-3">
                    {expired(c) ? (
                      <Badge className="bg-gray-200 text-gray-600">Expired</Badge>
                    ) : c.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-200 text-gray-600">Paused</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="underline" onClick={() => toggle.mutate(c, { onError: (err) => toast.error(errorMessage(err)) })}>
                      {c.active ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
