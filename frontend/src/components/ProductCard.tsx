import { Link } from 'react-router-dom';
import type { Product } from '../lib/types';
import { formatPrice } from '../lib/format';
import { Stars } from './ui';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block text-gray-700" aria-label={product.name}>
      <div className="relative aspect-[3/4] overflow-hidden rounded bg-gray-100">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-105"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.bestseller && (
            <span className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-amber-700">Bestseller</span>
          )}
          {!product.inStock && <span className="rounded bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white">Sold out</span>}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm">{product.name}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">{formatPrice(product.price)}</p>
        {product.rating.count > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Stars value={product.rating.average} size="text-xs" /> ({product.rating.count})
          </span>
        )}
      </div>
    </Link>
  );
}
