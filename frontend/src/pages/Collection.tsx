import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCategories, useProducts, type ProductFilters } from '../hooks/useCatalog';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState, Pagination, ProductGridSkeleton, Title } from '../components/ui';

const SORTS: { value: NonNullable<ProductFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

/** All filter state lives in the URL so results are shareable and survive refresh. */
export default function Collection() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const { data: categories } = useCategories();

  const filters: ProductFilters = {
    category: params.get('category') ?? undefined,
    subcategory: params.get('subcategory') ?? undefined,
    search: params.get('search') ?? undefined,
    minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    inStock: params.get('inStock') === 'true' || undefined,
    sort: (params.get('sort') as ProductFilters['sort']) ?? 'newest',
    page: Number(params.get('page') ?? 1),
    limit: 12,
  };
  const { data, isLoading, isError, isFetching, refetch } = useProducts(filters);

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const activeCategory = categories?.find((c) => c.slug === filters.category);
  const hasFilters = [...params.keys()].some((k) => k !== 'sort' && k !== 'page');

  return (
    <div className="flex flex-col gap-6 border-t pt-10 sm:flex-row sm:gap-10">
      {/* Filters */}
      <aside className="min-w-56">
        <button onClick={() => setShowFilters((s) => !s)} className="my-2 flex items-center gap-2 text-xl" aria-expanded={showFilters}>
          FILTERS <span className={`text-sm transition sm:hidden ${showFilters ? 'rotate-90' : ''}`}>›</span>
        </button>

        <div className={`${showFilters ? '' : 'hidden'} space-y-5 sm:block`}>
          <fieldset className="border border-gray-300 py-3 pl-5 pr-3">
            <legend className="px-1 text-sm font-medium">CATEGORIES</legend>
            <div className="flex flex-col gap-2 text-sm text-gray-700">
              {[{ slug: '', name: 'All', productCount: undefined as number | undefined }, ...(categories ?? [])].map((c) => (
                <label key={c.slug || 'all'} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    checked={(filters.category ?? '') === c.slug}
                    onChange={() => update({ category: c.slug || undefined, subcategory: undefined })}
                    className="accent-black"
                  />
                  {c.name}
                  {c.productCount !== undefined && <span className="text-gray-400">({c.productCount})</span>}
                </label>
              ))}
            </div>
          </fieldset>

          {activeCategory && activeCategory.subcategories.length > 0 && (
            <fieldset className="border border-gray-300 py-3 pl-5 pr-3">
              <legend className="px-1 text-sm font-medium">TYPE</legend>
              <div className="flex flex-wrap gap-2">
                {activeCategory.subcategories.map((s) => {
                  const active = filters.subcategory === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => update({ subcategory: active ? undefined : s.name })}
                      className={`rounded-full border px-3 py-1 text-xs ${active ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600 hover:border-black'}`}
                      aria-pressed={active}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <fieldset className="border border-gray-300 py-3 pl-5 pr-3">
            <legend className="px-1 text-sm font-medium">PRICE (AUD)</legend>
            <form
              key={`${filters.minPrice}-${filters.maxPrice}`}
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                update({ minPrice: String(f.get('minPrice') || '') || undefined, maxPrice: String(f.get('maxPrice') || '') || undefined });
              }}
            >
              <input name="minPrice" type="number" min={0} defaultValue={filters.minPrice} placeholder="Min" className="input w-20 px-2 py-1" aria-label="Minimum price" />
              <span className="text-gray-400">–</span>
              <input name="maxPrice" type="number" min={0} defaultValue={filters.maxPrice} placeholder="Max" className="input w-20 px-2 py-1" aria-label="Maximum price" />
              <button className="text-sm underline">Go</button>
            </form>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="accent-black"
                checked={Boolean(filters.inStock)}
                onChange={(e) => update({ inStock: e.target.checked ? 'true' : undefined })}
              />
              In stock only
            </label>
          </fieldset>

          {hasFilters && (
            <button onClick={() => setParams({})} className="text-sm text-gray-500 underline hover:text-black">
              Clear all filters
            </button>
          )}
        </div>
      </aside>

      {/* Results */}
      <section className="flex-1">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="text-left [&>div]:mb-0 [&>div]:text-left">
            <Title
              first={filters.search ? 'RESULTS FOR' : activeCategory ? activeCategory.name.toUpperCase() : 'ALL'}
              second={filters.search ? `“${filters.search}”` : 'COLLECTIONS'}
            />
          </div>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="border-2 border-gray-300 px-2 py-2 text-sm"
            aria-label="Sort products"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort by: {s.label}
              </option>
            ))}
          </select>
        </div>

        {data && <p className="mb-4 text-sm text-gray-500">{data.total} products</p>}

        {isLoading ? (
          <ProductGridSkeleton count={12} />
        ) : isError ? (
          <ErrorState message="We couldn't load the collection." onRetry={() => refetch()} />
        ) : data?.items.length ? (
          <>
            <div className={`grid grid-cols-2 gap-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 ${isFetching ? 'opacity-60' : ''}`}>
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: String(p) })} />
          </>
        ) : (
          <EmptyState
            title="No products found"
            message="Try a different search term or remove some filters."
            action={
              <button onClick={() => setParams({})} className="btn-secondary">
                Clear filters
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
