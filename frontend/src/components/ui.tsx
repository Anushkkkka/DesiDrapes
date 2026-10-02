import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Title({ first, second, subtitle }: { first: string; second: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="inline-flex items-center gap-2 text-2xl sm:text-3xl">
        <h2 className="text-gray-500">
          {first} <span className="font-medium text-gray-800">{second}</span>
        </h2>
        <span className="h-[2px] w-8 bg-gray-700 sm:w-12" aria-hidden />
      </div>
      {subtitle && <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">{subtitle}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" aria-hidden />
      {label}…
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] rounded bg-gray-200" />
          <div className="mt-3 h-3 w-3/4 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-1/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="prata-regular text-2xl text-gray-800">{title}</p>
      {message && <p className="max-w-md text-sm text-gray-500">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="my-10 rounded border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Stars({ value, size = 'text-sm' }: { value: number; size?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`${size} tracking-tight text-amber-500`} aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(rounded)}
      <span className="text-gray-300">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  return (
    <nav className="mt-10 flex items-center justify-center gap-1 text-sm" aria-label="Pagination">
      <button className="btn-page" disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹ Prev
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
          <button
            className={`btn-page ${p === page ? 'border-black bg-black text-white' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        </span>
      ))}
      <button className="btn-page" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        Next ›
      </button>
    </nav>
  );
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-4 inline-block text-sm text-gray-500 hover:text-black">
      ← {children}
    </Link>
  );
}
