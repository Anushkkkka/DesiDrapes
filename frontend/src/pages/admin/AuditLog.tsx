import { useState } from 'react';
import { formatDateTime } from '../../lib/format';
import { ErrorState, Pagination, Spinner } from '../../components/ui';
import { useAuditLog } from './adminApi';

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAuditLog(page);

  return (
    <div className="space-y-4">
      <h1 className="prata-regular text-2xl">Audit log</h1>
      <p className="text-sm text-gray-500">Security-relevant events: logins, order changes, inventory and role updates.</p>
      {isLoading ? (
        <Spinner />
      ) : isError || !data ? (
        <ErrorState message="Couldn't load the audit log." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{formatDateTime(e.createdAt)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-2">{e.user?.email ?? <span className="text-gray-400">system</span>}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{e.entity ? `${e.entity} …${e.entityId?.slice(-6)}` : ''}</td>
                    <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-gray-500">{e.metadata ? JSON.stringify(e.metadata) : ''}</td>
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
