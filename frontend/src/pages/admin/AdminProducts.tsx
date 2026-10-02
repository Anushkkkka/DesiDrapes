import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { Badge, EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { useAdminMutation, useAdminProducts } from './adminApi';

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [archiving, setArchiving] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useAdminProducts({ search: query || undefined, page });
  const archive = useAdminMutation((id: string) => api(`/admin/products/${id}`, { method: 'DELETE' }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="prata-regular text-2xl">Products</h1>
        <Link to="/admin/products/new" className="btn-primary px-5 py-2">
          + New product
        </Link>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
        className="flex max-w-md"
      >
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="input rounded-r-none" aria-label="Search products" />
        <button className="bg-black px-4 text-sm text-white">Search</button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load products." onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <EmptyState title="No products found" />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock by size</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((p) => (
                  <tr key={p.id} className={p.isActive ? '' : 'bg-gray-50 text-gray-400'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.images[0]} alt="" className="h-12 w-9 rounded object-cover" />
                        <span className="max-w-56 truncate">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.category.name}
                      {p.subcategory && <span className="text-gray-400"> · {p.subcategory}</span>}
                    </td>
                    <td className="px-4 py-3">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.variants.map((v) => (
                          <span
                            key={v.id}
                            className={`rounded px-1.5 py-0.5 text-xs ${v.stock === 0 ? 'bg-red-50 text-red-700' : v.lowStock ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'}`}
                          >
                            {v.size}: {v.stock}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? <Badge className="bg-emerald-100 text-emerald-800">Active</Badge> : <Badge className="bg-gray-200 text-gray-600">Archived</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/admin/products/${p.id}`} className="mr-3 underline">
                        Edit
                      </Link>
                      {p.isActive &&
                        (archiving === p.id ? (
                          <span className="text-xs">
                            Archive?{' '}
                            <button
                              className="text-red-600 underline"
                              onClick={() =>
                                archive.mutate(p.id, {
                                  onSuccess: () => {
                                    toast.info(`${p.name} archived`);
                                    setArchiving(null);
                                  },
                                  onError: (err) => toast.error(errorMessage(err)),
                                })
                              }
                            >
                              Yes
                            </button>{' '}
                            <button className="underline" onClick={() => setArchiving(null)}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button className="text-red-600 underline" onClick={() => setArchiving(p.id)}>
                            Archive
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
