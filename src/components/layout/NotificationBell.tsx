import { describeActivity } from '@/domain/activity';
import { useEffect, useMemo, useRef, useState } from 'react';
import { attempt } from '@/lib/errors';
import { Bell, CheckCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useMe, useUnreadCount, useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/date';
import { useDataStore } from '@/stores/dataStore';
import { ActivityIcon } from '@/components/ActivityIcon';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ws = useWorkspace();
  const unread = useUnreadCount();
  const markRead = useDataStore((s) => s.markRead);
  const markAllRead = useDataStore((s) => s.markAllRead);
  const navigate = useNavigate();
  const me = useMe();
  const items = useMemo(
    () => ws.activity.slice(0, 8).map((a) => ({ ...a, ...describeActivity(a, me) })),
    [ws.activity, me],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && (
              <button
                onClick={() => void attempt(markAllRead)}
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</li>
            )}
            {items.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => {
                    void attempt(() => markRead(a.id));
                    setOpen(false);
                    if (a.link) navigate(a.link);
                  }}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2',
                    !a.read && 'bg-primary-soft',
                  )}
                >
                  <ActivityIcon kind={a.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{a.title}</span>
                    {a.body && <span className="block truncate text-xs text-muted">{a.body}</span>}
                    <span className="block text-[11px] text-muted">{timeAgo(a.createdAt)}</span>
                  </span>
                  {!a.read && (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <Link
            to="/activity"
            onClick={() => setOpen(false)}
            className="block border-t border-border py-2.5 text-center text-xs font-medium text-primary hover:bg-surface-2"
          >
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
