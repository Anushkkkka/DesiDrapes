import { useEffect, useRef, useState } from 'react';
import { useMarkNotificationsRead, useNotifications } from '../hooks/useOrders';
import { formatDateTime } from '../lib/format';

export default function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = data?.unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) markRead.mutate();
        }}
        className="relative flex h-8 w-8 items-center justify-center text-gray-700"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded border border-gray-200 bg-white shadow-lg">
          <p className="border-b px-4 py-2 text-sm font-medium">Notifications</p>
          <ul className="max-h-80 overflow-y-auto">
            {data?.items.length ? (
              data.items.map((n) => (
                <li key={n.id} className={`border-b px-4 py-3 text-sm last:border-0 ${n.read ? 'text-gray-500' : 'text-gray-800'}`}>
                  <p>{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-center text-sm text-gray-500">You're all caught up.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
