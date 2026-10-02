import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api, ApiError, errorMessage } from '../lib/api';
import { formatDate, formatPrice } from '../lib/format';
import { useProduct } from '../hooks/useCatalog';
import { useMe } from '../hooks/useAuth';
import { MAX_PER_ITEM, useCart } from '../store/cart';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState, Spinner, Stars, Title } from '../components/ui';
import { NotFound } from './StaticPages';

function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submit = useMutation({
    mutationFn: () => api(`/products/${productId}/reviews`, { method: 'POST', body: { rating, comment: comment || undefined } }),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      setComment('');
      qc.invalidateQueries({ queryKey: ['products', 'detail', slug] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
      className="mt-6 space-y-3 rounded border border-gray-200 p-4"
    >
      <p className="text-sm font-medium">Write a review</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-gray-300'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="How was the fit, fabric and colour?"
        className="input"
        aria-label="Review comment"
      />
      <button disabled={submit.isPending} className="btn-secondary">
        {submit.isPending ? 'Submitting…' : 'Submit review'}
      </button>
      <p className="text-xs text-gray-400">Only verified buyers can review.</p>
    </form>
  );
}

/** Keyed by slug so size/image selection resets when navigating to a related product. */
export default function ProductPage() {
  const { slug } = useParams();
  return <ProductDetail key={slug} slug={slug} />;
}

function ProductDetail({ slug }: { slug: string | undefined }) {
  const { data, isLoading, isError, error, refetch } = useProduct(slug);
  const { data: user } = useMe();
  const add = useCart((s) => s.add);
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<'description' | 'reviews'>('description');

  if (isLoading) return <Spinner label="Loading product" />;
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (isError || !data) return <ErrorState message="We couldn't load this product." onRetry={() => refetch()} />;

  const { product, reviews, related } = data;
  const variant = product.variants.find((v) => v.id === variantId);
  const maxQty = Math.min(variant?.stock ?? 1, MAX_PER_ITEM);

  const addToCart = () => {
    if (!variant) return toast.error('Please select a size');
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0] ?? null,
        size: variant.size,
        price: product.price,
        maxQuantity: variant.stock,
      },
      quantity,
    );
    toast.success(`Added ${product.name} (${variant.size}) to your cart`);
  };

  return (
    <div className="border-t-2 pt-10">
      <nav className="mb-6 text-xs text-gray-500" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/collection?category=${product.category.slug}`}>{product.category.name}</Link>
        {product.subcategory && (
          <>
            {' / '}
            <Link to={`/collection?category=${product.category.slug}&subcategory=${encodeURIComponent(product.subcategory)}`}>
              {product.subcategory}
            </Link>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-12 sm:flex-row">
        {/* Gallery */}
        <div className="flex flex-1 flex-col-reverse gap-3 sm:flex-row">
          {product.images.length > 1 && (
            <div className="flex justify-between gap-2 sm:w-[18%] sm:flex-col sm:justify-normal">
              {product.images.map((src, i) => (
                <button key={src} onClick={() => setImageIndex(i)} className={`w-[24%] sm:w-full ${i === imageIndex ? 'ring-1 ring-black' : ''}`}>
                  <img src={src} alt={`${product.name} view ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
          <div className="w-full sm:flex-1">
            <img src={product.images[imageIndex]} alt={product.name} className="h-auto w-full rounded" />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl font-medium">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <Stars value={product.rating.average} />
            <span>({product.rating.count} review{product.rating.count === 1 ? '' : 's'})</span>
          </div>
          <p className="mt-5 text-3xl font-medium">{formatPrice(product.price)}</p>
          <p className="mt-5 text-gray-600 md:w-4/5">{product.description}</p>

          <div className="my-8 flex flex-col gap-3">
            <p>Select size</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  disabled={v.stock === 0}
                  onClick={() => {
                    setVariantId(v.id);
                    setQuantity(1);
                  }}
                  aria-pressed={v.id === variantId}
                  className={`min-w-12 border px-4 py-2 text-sm transition ${
                    v.id === variantId ? 'border-black bg-gray-100' : 'border-gray-200 bg-gray-50'
                  } disabled:cursor-not-allowed disabled:text-gray-300 disabled:line-through`}
                >
                  {v.size}
                </button>
              ))}
            </div>
            {variant?.lowStock && <p className="text-sm text-amber-700">Hurry, only {variant.stock} left in this size!</p>}
            {!product.inStock && <p className="text-sm text-red-600">This product is currently sold out.</p>}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gray-300">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2" aria-label="Decrease quantity">
                −
              </button>
              <span className="w-8 text-center text-sm" aria-live="polite">
                {quantity}
              </span>
              <button onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} className="px-3 py-2" aria-label="Increase quantity">
                +
              </button>
            </div>
            <button onClick={addToCart} disabled={!product.inStock} className="btn-primary">
              ADD TO CART
            </button>
          </div>

          <hr className="mt-8 sm:w-4/5" />
          <ul className="mt-5 flex flex-col gap-1 text-sm text-gray-500">
            <li>100% authentic ethnic wear</li>
            <li>Free shipping on orders over $150</li>
            <li>Easy size exchanges within 7 days</li>
          </ul>
        </div>
      </div>

      {/* Description & reviews */}
      <section className="mt-20">
        <div className="flex" role="tablist">
          {(['description', 'reviews'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`border px-5 py-3 text-sm capitalize ${tab === t ? 'font-semibold' : 'text-gray-500'}`}
            >
              {t === 'reviews' ? `Reviews (${reviews.length})` : t}
            </button>
          ))}
        </div>
        <div className="border px-6 py-6 text-sm text-gray-600" role="tabpanel">
          {tab === 'description' ? (
            <div className="space-y-3">
              <p>{product.description}</p>
              <p>
                Category: {product.category.name}
                {product.subcategory ? ` · ${product.subcategory}` : ''}. Available sizes:{' '}
                {product.variants.map((v) => v.size).join(', ')}.
              </p>
            </div>
          ) : (
            <>
              {reviews.length === 0 ? (
                <p>No reviews yet.</p>
              ) : (
                <ul className="divide-y">
                  {reviews.map((r) => (
                    <li key={r.id} className="py-4">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} />
                        <span className="font-medium text-gray-800">{r.author}</span>
                        <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                      </div>
                      {r.comment && <p className="mt-1">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {user ? (
                <ReviewForm productId={product.id} slug={product.slug} />
              ) : (
                <p className="mt-4">
                  <Link to={`/login?next=/product/${product.slug}`} className="underline">
                    Log in
                  </Link>{' '}
                  to write a review.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="my-24">
        <Title first="RELATED" second="PRODUCTS" />
        {related.length ? (
          <div className="grid grid-cols-2 gap-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <EmptyState title="Nothing related yet" />
        )}
      </section>
    </div>
  );
}
