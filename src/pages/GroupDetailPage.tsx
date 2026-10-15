import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Download,
  HandCoins,
  Plus,
  Receipt,
  Search,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { FeedList } from '@/components/expenses/FeedList';
import { AddFriendModal } from '@/components/friends/AddFriendModal';
import { GroupForm } from '@/components/groups/GroupForm';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { netBalances } from '@/domain/balances';
import { CATEGORIES, categoryMeta, groupTypeMeta } from '@/domain/categories';
import type { ExpenseCategory, ID } from '@/domain/types';
import { mergeFeed, useGroup, useMe, useWorkspace } from '@/hooks/useWorkspace';
import { downloadFile, toCsv } from '@/lib/download';
import { formatMoney, fromCents } from '@/lib/money';
import { useDataStore } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';
import { useUiStore } from '@/stores/uiStore';
import NotFoundPage from './NotFoundPage';

type Tab = 'expenses' | 'balances' | 'members' | 'stats' | 'settings';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const data = useGroup(groupId);
  const [tab, setTab] = useState<Tab>('expenses');
  const openExpense = useUiStore((s) => s.openExpense);
  const openSettle = useUiStore((s) => s.openSettle);
  const ws = useWorkspace();

  if (!data) return <NotFoundPage />;
  const { group, expenses } = data;

  const exportCsv = () => {
    const names = (id: ID) => ws.people[id]?.name ?? 'Unknown';
    const rows: (string | number)[][] = [
      [
        'Date',
        'Description',
        'Category',
        'Amount',
        'Currency',
        'Paid by',
        ...group.memberIds.map(names),
      ],
      ...expenses.map((e) => [
        e.date,
        e.description,
        categoryMeta(e.category).label,
        fromCents(e.amount),
        e.currency,
        e.paidBy.map((p) => `${names(p.personId)} (${fromCents(p.amount)})`).join('; '),
        ...group.memberIds.map((m) =>
          fromCents(e.splits.find((s) => s.personId === m)?.amount ?? 0),
        ),
      ]),
    ];
    downloadFile(
      `${group.name.replace(/\W+/g, '-').toLowerCase()}-expenses.csv`,
      toCsv(rows),
      'text/csv',
    );
  };

  return (
    <>
      <PageHeader
        leading={
          <>
            <Link
              to="/groups"
              aria-label="Back to groups"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden"
            >
              <ArrowLeft size={18} />
            </Link>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-2xl">
              {groupTypeMeta(group.type).emoji}
            </span>
          </>
        }
        title={group.name}
        subtitle={`${group.memberIds.length} members · ${group.currency}${group.simplifyDebts ? ' · simplified debts' : ''}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={exportCsv}
              aria-label="Export as CSV"
              title="Export as CSV"
              disabled={expenses.length === 0}
            >
              <Download size={16} />
            </Button>
            <Button variant="outline" onClick={() => openSettle({ groupId: group.id })}>
              <HandCoins size={16} /> Settle up
            </Button>
            <Button onClick={() => openExpense({ groupId: group.id })}>
              <Plus size={16} /> Add expense
            </Button>
          </>
        }
      />
      <Segmented
        ariaLabel="Group sections"
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'expenses', label: 'Expenses' },
          { value: 'balances', label: 'Balances' },
          { value: 'members', label: 'Members' },
          { value: 'stats', label: 'Totals' },
          { value: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'expenses' && <ExpensesTab data={data} />}
      {tab === 'balances' && <BalancesTab data={data} />}
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'stats' && <StatsTab data={data} />}
      {tab === 'settings' && <SettingsTab data={data} />}
    </>
  );
}

type GroupData = NonNullable<ReturnType<typeof useGroup>>;

function ExpensesTab({ data }: { data: GroupData }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const openExpense = useUiStore((s) => s.openExpense);

  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const expenses = data.expenses.filter(
      (e) =>
        (!q || e.description.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q)) &&
        (!category || e.category === category),
    );
    return mergeFeed(expenses, q || category ? [] : data.settlements);
  }, [data, query, category]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search expenses</span>
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Search expenses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="input w-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory | '')}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>
      {feed.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title={data.expenses.length ? 'No matching expenses' : 'No expenses yet'}
          description={
            data.expenses.length
              ? 'Try a different search or filter.'
              : 'Add the first expense for this group.'
          }
          action={
            !data.expenses.length && (
              <Button onClick={() => openExpense({ groupId: data.group.id })}>Add expense</Button>
            )
          }
        />
      ) : (
        <FeedList items={feed} />
      )}
    </section>
  );
}

function BalancesTab({ data }: { data: GroupData }) {
  const ws = useWorkspace();
  const me = useMe();
  const openSettle = useUiStore((s) => s.openSettle);
  const sendReminder = useDataStore((s) => s.sendReminder);
  const { group, debts } = data;
  const nets =
    netBalances(data.expenses, data.settlements).get(group.currency) ?? new Map<ID, number>();
  const name = (id: ID) => (id === me ? 'You' : (ws.people[id]?.name ?? 'Unknown'));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Member balances</h2>
        <ul className="divide-y divide-border">
          {group.memberIds.map((id) => {
            const p = ws.people[id];
            const v = nets.get(id) ?? 0;
            if (!p) return null;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                <span className="flex-1 truncate text-sm">{name(id)}</span>
                {v === 0 ? (
                  <span className="text-xs text-muted">settled up</span>
                ) : (
                  <span className="text-right text-xs">
                    <span className="text-muted">{v > 0 ? 'gets back ' : 'owes '}</span>
                    <Money
                      cents={v}
                      currency={group.currency}
                      signed
                      className="text-sm font-semibold"
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card">
        <h2 className="border-b border-border px-4 py-3 font-semibold">
          {group.simplifyDebts ? 'Simplified payments' : 'Who owes whom'}
        </h2>
        {debts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Everyone is settled up 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {debts.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{name(d.from)}</span>
                <ArrowRight size={14} className="text-muted" />
                <span className="font-medium">{name(d.to)}</span>
                <span className="ml-auto font-semibold tabular-nums">
                  {formatMoney(d.amount, d.currency)}
                </span>
                <div className="flex w-full justify-end gap-1 sm:w-auto">
                  {d.to === me && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void attempt(() => sendReminder(d.from), `Reminder sent to ${name(d.from)}`)
                      }
                    >
                      <BellRing size={14} /> Remind
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      openSettle({ groupId: group.id, personId: d.from === me ? d.to : d.from })
                    }
                  >
                    Settle
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MembersTab({ data }: { data: GroupData }) {
  const ws = useWorkspace();
  const me = useMe();
  const addGroupMember = useDataStore((s) => s.addGroupMember);
  const removeGroupMember = useDataStore((s) => s.removeGroupMember);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ID | null>(null);
  const { group } = data;
  const candidates = ws.friendIds
    .filter((id) => !group.memberIds.includes(id))
    .map((id) => ws.people[id])
    .filter((p) => p !== undefined);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="flex-1 font-semibold">Members</h2>
        {candidates.length > 0 && (
          <select
            className="input w-auto py-1.5"
            value=""
            aria-label="Add an existing friend"
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              void attempt(
                () => addGroupMember(group.id, id),
                `${ws.people[id]?.name} added to the group`,
              );
            }}
          >
            <option value="">Add a friend…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <UserPlus size={14} /> New person
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {group.memberIds.map((id) => {
          const p = ws.people[id];
          if (!p) return null;
          return (
            <li key={id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} color={p.avatarColor} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {id === me ? `${p.name} (you)` : p.name}
                </span>
                {p.email && <span className="block truncate text-xs text-muted">{p.email}</span>}
              </span>
              {id !== me && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setRemoving(id)}
                >
                  <UserMinus size={14} />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <AddFriendModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(id) => void attempt(() => addGroupMember(group.id, id))}
      />
      <ConfirmDialog
        open={removing !== null}
        title="Remove member?"
        message={`${ws.people[removing ?? '']?.name ?? 'This person'} will be removed from “${group.name}”. Their balance must be settled first.`}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) void attempt(() => removeGroupMember(group.id, removing), 'Member removed');
        }}
      />
    </section>
  );
}

function StatsTab({ data }: { data: GroupData }) {
  const me = useMe();
  const { group, expenses } = data;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const myShare = expenses.reduce(
    (s, e) => s + (e.splits.find((x) => x.personId === me)?.amount ?? 0),
    0,
  );
  const myPaid = expenses.reduce(
    (s, e) => s + (e.paidBy.find((x) => x.personId === me)?.amount ?? 0),
    0,
  );
  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    amount: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0),
  }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Total group spending</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(total, group.currency)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Your share</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(myShare, group.currency)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">You paid</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(myPaid, group.currency)}
          </p>
        </div>
      </div>
      <section className="card p-4">
        <h2 className="mb-4 font-semibold">Spending by category</h2>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted">No spending yet.</p>
        ) : (
          <ul className="space-y-3">
            {byCategory.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {c.emoji} {c.label}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(c.amount, group.currency)}{' '}
                    <span className="text-muted">· {Math.round((c.amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(c.amount / total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SettingsTab({ data }: { data: GroupData }) {
  const updateGroup = useDataStore((s) => s.updateGroup);
  const deleteGroup = useDataStore((s) => s.deleteGroup);
  const addGroupMember = useDataStore((s) => s.addGroupMember);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { group } = data;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Group settings</h2>
        <GroupForm
          key={group.id}
          group={group}
          currencyLocked={data.expenses.length > 0 || data.settlements.length > 0}
          onCancel={() => navigate(`/groups/${group.id}`)}
          onSubmit={(draft) =>
            attempt(async () => {
              await updateGroup(group.id, draft);
              // Members picked in the form who aren't in the group yet.
              for (const id of draft.memberIds.filter((m) => !group.memberIds.includes(m)))
                await addGroupMember(group.id, id);
            }, 'Group updated')
          }
        />
      </section>
      <section className="card border-danger/40 p-5">
        <h2 className="font-semibold text-danger">Delete group</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          This permanently deletes the group and all of its expenses and payments.
        </p>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete group
        </Button>
      </section>
      <ConfirmDialog
        open={confirming}
        title={`Delete “${group.name}”?`}
        message="All expenses and payments in this group will be deleted. This can't be undone."
        confirmLabel="Delete group"
        danger
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const res = await attempt(() => deleteGroup(group.id), 'Group deleted');
          if (res.ok) navigate('/groups');
        }}
      />
    </div>
  );
}
