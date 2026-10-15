import { useMemo, useState } from 'react';
import { Activity as ActivityLucide, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ActivityIcon } from '@/components/ActivityIcon';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { useMe, useUnreadCount, useWorkspace } from '@/hooks/useWorkspace';
import { describeActivity } from '@/domain/activity';
import { attempt } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { formatDate, timeAgo } from '@/lib/date';
import { useDataStore } from '@/stores/dataStore';

type Filter = 'all' | 'unread' | 'expenses' | 'payments' | 'groups';

export default function ActivityPage() {
  const ws = useWorkspace();
  const me = useMe();
  const unread = useUnreadCount();
  const markRead = useDataStore((s) => s.markRead);
  const markAllRead = useDataStore((s) => s.markAllRead);
  const clearActivity = useDataStore((s) => s.clearActivity);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirming, setConfirming] = useState(false);

  const items = useMemo(
    () =>
      ws.activity
        .filter((a) => {
          switch (filter) {
            case 'unread':
              return !a.read;
            case 'expenses':
              return a.kind.startsWith('expense');
            case 'payments':
              return a.kind.startsWith('settlement');
            case 'groups':
              return a.kind.startsWith('group') || a.kind.startsWith('member');
            default:
              return true;
          }
        })
        .map((a) => ({ ...a, ...describeActivity(a, me) })),
    [ws.activity, filter, me],
  );

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={
          unread
            ? `${unread} unread notification${unread === 1 ? '' : 's'}`
            : 'You’re all caught up.'
        }
        actions={
          <>
            <Button variant="outline" onClick={() => void attempt(markAllRead)} disabled={!unread}>
              <CheckCheck size={16} /> Mark all read
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              disabled={!ws.activity.length}
              aria-label="Clear activity"
            >
              <Trash2 size={16} />
            </Button>
          </>
        }
      />
      <Segmented
        ariaLabel="Filter activity"
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'payments', label: 'Payments' },
          { value: 'groups', label: 'Groups' },
        ]}
      />
      <section className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<ActivityLucide size={20} />}
            title="Nothing here"
            description="New activity will show up here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => {
                    void attempt(() => markRead(a.id));
                    if (a.link) navigate(a.link);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2',
                    !a.read && 'bg-primary-soft',
                  )}
                >
                  <ActivityIcon kind={a.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{a.title}</span>
                    {a.body && <span className="block text-xs text-muted">{a.body}</span>}
                    <span className="block text-[11px] text-muted" title={formatDate(a.createdAt)}>
                      {timeAgo(a.createdAt)}
                    </span>
                  </span>
                  {!a.read && (
                    <span
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={confirming}
        title="Clear all activity?"
        message="This removes your activity history and notifications. Expenses and balances are not affected."
        confirmLabel="Clear"
        danger
        onClose={() => setConfirming(false)}
        onConfirm={() => void attempt(clearActivity, 'Activity cleared')}
      />
    </>
  );
}
