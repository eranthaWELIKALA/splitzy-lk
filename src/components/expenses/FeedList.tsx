import { HandCoins, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { categoryMeta } from '@/domain/categories';
import type { Expense, ID, Settlement } from '@/domain/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useMe, useWorkspace, type FeedItem } from '@/hooks/useWorkspace';
import { formatMonth } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useDataStore } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';

function DateBadge({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <span className="flex w-10 shrink-0 flex-col items-center text-muted">
      <span className="text-[10px] uppercase">
        {d.toLocaleString(undefined, { month: 'short' })}
      </span>
      <span className="text-lg leading-none font-semibold text-fg">{d.getDate()}</span>
    </span>
  );
}

export function ExpenseRow({ expense, showGroup }: { expense: Expense; showGroup?: boolean }) {
  const ws = useWorkspace();
  const me = useMe();
  const paid = expense.paidBy.find((p) => p.personId === me)?.amount ?? 0;
  const owed = expense.splits.find((s) => s.personId === me)?.amount ?? 0;
  const net = paid - owed;
  const payerLabel =
    expense.paidBy.length > 1
      ? `${expense.paidBy.length} people paid`
      : `${expense.paidBy[0]?.personId === me ? 'You' : (ws.people[expense.paidBy[0]?.personId ?? '']?.name ?? 'Someone')} paid`;
  const cat = categoryMeta(expense.category);
  const groupName = expense.groupId ? ws.groups[expense.groupId]?.name : undefined;

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
    >
      <DateBadge date={expense.date} />
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg"
        aria-label={cat.label}
      >
        {cat.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{expense.description}</span>
        <span className="block truncate text-xs text-muted">
          {payerLabel} {formatMoney(expense.amount, expense.currency)}
          {showGroup && groupName && ` · ${groupName}`}
        </span>
      </span>
      <span className="text-right">
        {net === 0 ? (
          <span className="text-xs text-muted">not involved</span>
        ) : (
          <>
            <span className={`block text-[11px] ${net > 0 ? 'text-positive' : 'text-negative'}`}>
              {net > 0 ? 'you lent' : 'you borrowed'}
            </span>
            <span
              className={`block text-sm font-semibold tabular-nums ${net > 0 ? 'text-positive' : 'text-negative'}`}
            >
              {formatMoney(Math.abs(net), expense.currency)}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

export function SettlementRow({
  settlement,
  onDelete,
}: {
  settlement: Settlement;
  onDelete: (id: ID) => void;
}) {
  const ws = useWorkspace();
  const me = useMe();
  const name = (id: ID) => (id === me ? 'You' : (ws.people[id]?.name ?? 'Someone'));
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <DateBadge date={settlement.date} />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <HandCoins size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          <strong>{name(settlement.fromId)}</strong> paid{' '}
          <strong>{settlement.toId === me ? 'you' : name(settlement.toId)}</strong>{' '}
          {formatMoney(settlement.amount, settlement.currency)}
        </span>
        {settlement.note && (
          <span className="block truncate text-xs text-muted">{settlement.note}</span>
        )}
      </span>
      <button
        onClick={() => onDelete(settlement.id)}
        aria-label="Delete payment"
        className="rounded-md p-1.5 text-muted opacity-100 hover:bg-surface-2 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/** Expenses and payments, grouped under month headings. */
export function FeedList({ items, showGroup }: { items: FeedItem[]; showGroup?: boolean }) {
  const deleteSettlement = useDataStore((s) => s.deleteSettlement);
  const [pending, setPending] = useState<ID | null>(null);

  let lastMonth = '';
  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((f) => {
          const month = formatMonth(f.item.date);
          const heading = month !== lastMonth ? month : null;
          lastMonth = month;
          return (
            <li key={f.item.id}>
              {heading && (
                <h3 className="bg-surface-2/60 px-4 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {heading}
                </h3>
              )}
              {f.type === 'expense' ? (
                <ExpenseRow expense={f.item} showGroup={showGroup} />
              ) : (
                <SettlementRow settlement={f.item} onDelete={setPending} />
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        title="Delete payment?"
        message="This will restore the balance that this payment settled."
        confirmLabel="Delete"
        danger
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) void attempt(() => deleteSettlement(pending), 'Payment deleted');
        }}
      />
    </>
  );
}
