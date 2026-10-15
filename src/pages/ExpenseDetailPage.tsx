import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { categoryMeta } from '@/domain/categories';
import { SPLIT_METHODS } from '@/domain/split';
import { useMe, useWorkspace } from '@/hooks/useWorkspace';
import { formatDate, timeAgo } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useDataStore } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';
import { useUiStore } from '@/stores/uiStore';
import NotFoundPage from './NotFoundPage';

export default function ExpenseDetailPage() {
  const { expenseId = '' } = useParams();
  const ws = useWorkspace();
  const me = useMe();
  const navigate = useNavigate();
  const deleteExpense = useDataStore((s) => s.deleteExpense);
  const openExpense = useUiStore((s) => s.openExpense);
  const [confirming, setConfirming] = useState(false);
  const expense = ws.expenses[expenseId];
  if (!expense) return <NotFoundPage />;

  const group = expense.groupId ? ws.groups[expense.groupId] : undefined;
  const cat = categoryMeta(expense.category);
  const name = (id: string) => (id === me ? 'You' : (ws.people[id]?.name ?? 'Unknown'));
  const people = Array.from(
    new Set([...expense.paidBy.map((p) => p.personId), ...expense.splits.map((s) => s.personId)]),
  );
  const methodLabel = SPLIT_METHODS.find((m) => m.id === expense.splitMethod)?.label;

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <article className="card overflow-hidden">
        <header className="flex flex-wrap items-start gap-4 border-b border-border p-5">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-3xl"
            aria-label={cat.label}
          >
            {cat.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{expense.description}</h1>
            <p className="text-3xl font-bold tabular-nums">
              {formatMoney(expense.amount, expense.currency)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatDate(expense.date)} · {cat.label}
              {group && (
                <>
                  {' · '}
                  <Link to={`/groups/${group.id}`} className="text-primary hover:underline">
                    {group.name}
                  </Link>
                </>
              )}
            </p>
            <p className="text-xs text-muted">
              Added by{' '}
              {name(expense.createdBy).toLowerCase() === 'you' ? 'you' : name(expense.createdBy)}{' '}
              {timeAgo(expense.createdAt)}
              {expense.updatedAt !== expense.createdAt && ` · edited ${timeAgo(expense.updatedAt)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openExpense({ expenseId: expense.id })}>
              <Pencil size={16} /> Edit
            </Button>
            <Button variant="ghost" aria-label="Delete expense" onClick={() => setConfirming(true)}>
              <Trash2 size={16} className="text-danger" />
            </Button>
          </div>
        </header>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold">
            Split {methodLabel?.toLowerCase()} between {expense.splits.length}{' '}
            {expense.splits.length === 1 ? 'person' : 'people'}
          </h2>
          <ul className="space-y-3">
            {people.map((id) => {
              const paid = expense.paidBy.find((p) => p.personId === id)?.amount ?? 0;
              const share = expense.splits.find((s) => s.personId === id);
              const p = ws.people[id];
              return (
                <li key={id} className="flex items-center gap-3">
                  <Avatar name={p?.name ?? '?'} color={p?.avatarColor} size="sm" />
                  <p className="flex-1 text-sm">
                    <strong>{name(id)}</strong>
                    {paid > 0 && <> paid {formatMoney(paid, expense.currency)}</>}
                    {paid > 0 && share && ' and'}
                    {share && (
                      <>
                        {' '}
                        {id === me ? 'owe' : 'owes'} {formatMoney(share.amount, expense.currency)}
                        {expense.splitMethod === 'percent' && (
                          <span className="text-muted"> ({share.input}%)</span>
                        )}
                        {expense.splitMethod === 'shares' && (
                          <span className="text-muted"> ({share.input} shares)</span>
                        )}
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
          {expense.notes && (
            <div className="mt-5 rounded-xl bg-surface-2 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted">Notes</p>
              <p className="whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}
        </div>
      </article>
      <ConfirmDialog
        open={confirming}
        title="Delete this expense?"
        message="Balances will be recalculated without it."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const target = group ? `/groups/${group.id}` : '/';
          const res = await attempt(() => deleteExpense(expense.id), 'Expense deleted');
          if (res.ok) navigate(target);
        }}
      />
    </>
  );
}
