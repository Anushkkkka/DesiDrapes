import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../../lib/api';
import type { Product } from '../../lib/types';
import { BackLink, ErrorState, Spinner } from '../../components/ui';
import { useAdminCategories, useAdminMutation } from './adminApi';

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

interface VariantRow {
  size: string;
  stock: number;
  lowStockThreshold: number;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  subcategory: string;
  bestseller: boolean;
  isActive: boolean;
  images: string[];
  variants: VariantRow[];
}

const EMPTY: FormState = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  subcategory: '',
  bestseller: false,
  isActive: true,
  images: [],
  variants: [{ size: 'M', stock: 10, lowStockThreshold: 3 }],
};

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { data: categories } = useAdminCategories();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Admin endpoint: includes archived products and alert thresholds.
  const existing = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () =>
      api<{ product: Omit<Product, 'variants'> & { variants: VariantRow[] } }>(`/admin/products/${id}`).then((r) => r.product),
    enabled: !isNew,
    staleTime: Infinity, // don't clobber in-progress edits with a background refetch
  });

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      categoryId: p.category.id,
      subcategory: p.subcategory ?? '',
      bestseller: p.bestseller,
      isActive: p.isActive,
      images: p.images,
      variants: p.variants.map((v) => ({ size: v.size, stock: v.stock, lowStockThreshold: v.lowStockThreshold })),
    });
  }, [existing.data]);

  useEffect(() => {
    if (isNew && categories?.length && !form.categoryId) setForm((f) => ({ ...f, categoryId: categories[0].id }));
  }, [isNew, categories, form.categoryId]);

  const save = useAdminMutation(() => {
    const body = {
      ...form,
      price: Number(form.price),
      subcategory: form.subcategory || null,
    };
    return isNew
      ? api<{ product: Product }>('/admin/products', { method: 'POST', body })
      : api<{ product: Product }>(`/admin/products/${id}`, { method: 'PUT', body });
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    set('variants', form.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const upload = async (file: File) => {
    const data = new FormData();
    data.append('image', file);
    setUploading(true);
    try {
      const { url } = await api<{ url: string }>('/admin/uploads', { method: 'POST', body: data });
      set('images', [...form.images, url]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const generateDescription = async () => {
    if (form.name.trim().length < 3) return toast.error('Enter a product name first');
    setAiLoading(true);
    try {
      const category = categories?.find((c) => c.id === form.categoryId)?.name ?? 'Ethnic wear';
      const r = await api<{ description: string; source: 'ai' | 'fallback' }>('/ai/product-description', {
        method: 'POST',
        body: { name: form.name, category, subcategory: form.subcategory || undefined, notes: notes || undefined },
      });
      set('description', r.description);
      toast.info(r.source === 'ai' ? 'Description generated with AI. Review before saving.' : 'AI is not configured; used a template.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  if (!isNew && existing.isLoading) return <Spinner label="Loading product" />;
  if (!isNew && existing.isError) return <ErrorState message="Couldn't load this product." />;

  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, {
          onSuccess: () => {
            toast.success(isNew ? 'Product created' : 'Product saved');
            navigate('/admin/products');
          },
          onError: (err) => toast.error(errorMessage(err)),
        });
      }}
    >
      <BackLink to="/admin/products">Products</BackLink>
      <h1 className="prata-regular text-2xl">{isNew ? 'New product' : 'Edit product'}</h1>

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" required minLength={3} value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="price">Price (AUD)</label>
            <input id="price" required type="number" min={0.5} step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="input">
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="subcategory">Type</label>
            <input id="subcategory" value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} placeholder="e.g. Saree, Kurta" className="input" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-gray-700" htmlFor="description">Description</label>
          </div>
          <textarea id="description" required minLength={10} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} className="input" />
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-gray-50 p-3">
            <span className="text-xs text-gray-600" aria-hidden>✨</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key details for AI: fabric, colour, occasion" className="input flex-1 bg-white py-1.5 text-xs" aria-label="Details for AI description" />
            <button type="button" onClick={generateDescription} disabled={aiLoading} className="btn-secondary px-3 py-1.5 text-xs">
              {aiLoading ? 'Writing…' : 'Generate with AI'}
            </button>
          </div>
        </div>

        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-black" checked={form.bestseller} onChange={(e) => set('bestseller', e.target.checked)} /> Bestseller
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-black" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in store
          </label>
        </div>
      </div>

      <div className="card space-y-3">
        <p className="font-medium">Images</p>
        <div className="flex flex-wrap gap-3">
          {form.images.map((src, i) => (
            <div key={src} className="relative">
              <img src={src} alt="" className="h-28 w-20 rounded object-cover" />
              <button type="button" onClick={() => set('images', form.images.filter((_, idx) => idx !== i))} className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-black text-xs text-white" aria-label="Remove image">
                ×
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[10px]">Main</span>}
            </div>
          ))}
          <label className="flex h-28 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-black">
            {uploading ? '…' : '+ Upload'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={uploading} />
          </label>
        </div>
        <p className="text-xs text-gray-500">JPEG, PNG or WebP up to 5 MB. The first image is the main photo.</p>
      </div>

      <div className="card space-y-3">
        <p className="font-medium">Sizes & stock</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="pb-2">Size</th>
              <th className="pb-2">Stock</th>
              <th className="pb-2">Low-stock alert at</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {form.variants.map((v, i) => (
              <tr key={i}>
                <td className="pr-2 py-1">
                  <input value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} list="size-presets" className="input py-1" aria-label="Size" required />
                </td>
                <td className="pr-2 py-1">
                  <input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} className="input py-1" aria-label={`Stock for ${v.size}`} />
                </td>
                <td className="pr-2 py-1">
                  <input type="number" min={0} value={v.lowStockThreshold} onChange={(e) => setVariant(i, { lowStockThreshold: Number(e.target.value) })} className="input py-1" aria-label={`Low stock threshold for ${v.size}`} />
                </td>
                <td className="py-1 text-right">
                  <button type="button" disabled={form.variants.length === 1} onClick={() => set('variants', form.variants.filter((_, idx) => idx !== i))} className="text-xs text-red-600 underline disabled:opacity-30">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="size-presets">
          {SIZE_PRESETS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button
          type="button"
          onClick={() => {
            const nextSize = SIZE_PRESETS.find((s) => !form.variants.some((v) => v.size === s)) ?? '';
            set('variants', [...form.variants, { size: nextSize, stock: 0, lowStockThreshold: 3 }]);
          }}
          className="text-sm underline"
        >
          + Add size
        </button>
      </div>

      <div className="flex gap-3">
        <button disabled={save.isPending || form.images.length === 0} className="btn-primary">
          {save.isPending ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </button>
        {form.images.length === 0 && <p className="self-center text-xs text-gray-500">Upload at least one image.</p>}
      </div>
    </form>
  );
}
