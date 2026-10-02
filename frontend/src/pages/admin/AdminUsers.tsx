import { useState } from 'react';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Role } from '../../lib/types';
import { useMe } from '../../hooks/useAuth';
import { Badge, ErrorState, Pagination, Spinner } from '../../components/ui';
import { useAdminMutation, useAdminUsers } from './adminApi';

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useAdminUsers({ search: query || undefined, page });
  const setRole = useAdminMutation(({ id, role }: { id: string; role: Role }) => api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }));

  return (
    <div className="space-y-4">
      <h1 className="prata-regular text-2xl">Customers</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
        className="flex max-w-md"
      >
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" className="input rounded-r-none" aria-label="Search customers" />
        <button className="bg-black px-4 text-sm text-white">Search</button>
      </form>
      {isLoading ? (
        <Spinner />
      ) : isError || !data ? (
        <ErrorState message="Couldn't load customers." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">{u.orderCount}</td>
                    <td className="px-4 py-3">
                      {u.id === me?.id ? (
                        <Badge className="bg-brand-light text-brand">{u.role} (you)</Badge>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            setRole.mutate(
                              { id: u.id, role: e.target.value as Role },
                              { onSuccess: () => toast.success(`${u.name} is now ${e.target.value}`), onError: (err) => toast.error(errorMessage(err)) },
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                          aria-label={`Role for ${u.name}`}
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
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
