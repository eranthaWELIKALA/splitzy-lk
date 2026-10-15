import { useMemo, useState } from 'react';
import { attempt } from '@/lib/errors';
import { loadSampleData } from '@/lib/sampleData';
import { Check, HandCoins, Plus, Receipt, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ActivityIcon } from '@/components/ActivityIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyList } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Cents, CurrencyCode, Person } from '@/domain/types';
import { useCurrentAccount, useMe, useMyBalances, useWorkspace } from '@/hooks/useWorkspace';
import { describeActivity } from '@/domain/activity';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/date';
import { useUiStore } from '@/stores/uiStore';

export default function DashboardPage() {
  const account = useCurrentAccount();
  const ws = useWorkspace();
  const { byPerson, owed, owe } = useMyBalances();
  const openExpense = useUiStore((s) => s.openExpense);
  const openSettle = useUiStore((s) => s.openSettle);

  const net = useMemo(() => {
    const m = new Map<CurrencyCode, Cents>(owed);
    for (const [c, v] of owe) m.set(c, (m.get(c) ?? 0) - v);
    return m;
  }, [owed, owe]);

  const people = [...byPerson]
    .map(([id, amounts]) => ({ person: ws.people[id], amounts }))
    .filter((x): x is { person: Person; amounts: Map<CurrencyCode, Cents> } => !!x.person);
  const owesMe = people.filter((p) => [...p.amounts.values()].some((v) => v > 0));
  const iOwe = people.filter((p) => [...p.amounts.values()].some((v) => v < 0));
  const me = useMe();
  const recent = useMemo(
    () => ws.activity.slice(0, 6).map((a) => ({ ...a, ...describeActivity(a, me) })),
    [ws.activity, me],
  );
  const firstName = account?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hi, ${firstName} 👋`}
        subtitle="Here's where you stand."
        actions={
          <>
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => openSettle()}
            >
              <HandCoins size={16} /> Settle up
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => openExpense()}>
              <Plus size={16} /> Add expense
            </Button>
          </>
        }
      />

      {(Object.keys(ws.groups).length === 0 || Object.keys(ws.expenses).length === 0) && (
        <GetStarted />
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Summary">
        <Stat label="Total balance" value={<MoneyList amounts={net} signed />} />
        <Stat label="You owe" value={<MoneyList amounts={owe} className="text-negative" />} />
        <Stat label="You are owed" value={<MoneyList amounts={owed} className="text-positive" />} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BalanceCard title="You owe" empty="You don't owe anyone. Nice!" people={iOwe} sign={-1} />
        <BalanceCard
          title="You are owed"
          empty="Nobody owes you right now."
          people={owesMe}
          sign={1}
        />
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/activity" className="text-xs font-medium text-primary">
            See all
          </Link>
        </div>
        {ws.activity.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />}
            title="No activity yet"
            description="Add an expense to get started."
          />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <ActivityIcon kind={a.kind} />
                <div className="min-w-0 flex-1">
                  {a.link ? (
                    <Link to={a.link} className="block truncate text-sm hover:underline">
                      {a.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm">{a.title}</p>
                  )}
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** First-run checklist: a group first, then friends, then the first expense. */
function GetStarted() {
  const ws = useWorkspace();
  const { openCreateGroup, openAddFriend, openExpense } = useUiStore();
  const [busy, setBusy] = useState(false);
  const firstGroup = Object.values(ws.groups)[0];
  const steps = [
    {
      done: !!firstGroup,
      title: 'Create a group',
      text: 'A trip, your home, a team — anything you share costs in.',
      action: 'New group',
      icon: Users,
      onClick: () => openCreateGroup(),
    },
    {
      done: ws.friendIds.length > 0,
      title: 'Add the people you split with',
      text: 'Add them by email so they can join and see shared expenses.',
      action: 'Add friend',
      icon: UserPlus,
      onClick: () => openAddFriend(),
    },
    {
      done: Object.keys(ws.expenses).length > 0,
      title: 'Add your first expense',
      text: 'Split it equally, by shares, percentages or exact amounts.',
      action: 'Add expense',
      icon: Receipt,
      onClick: () => openExpense(firstGroup ? { groupId: firstGroup.id } : {}),
    },
  ];
  const next = steps.findIndex((st) => !st.done);

  return (
    <section className="card mb-6 overflow-hidden" aria-labelledby="get-started">
      <div className="bg-primary-soft px-5 py-4">
        <h2 id="get-started" className="font-semibold">
          Get started with Splitzy
        </h2>
        <p className="text-sm text-muted">Three quick steps and you’re splitting.</p>
      </div>
      <ol className="divide-y divide-border">
        {steps.map((st, i) => {
          const Icon = st.icon;
          return (
            <li
              key={st.title}
              className={cn('flex items-center gap-4 px-5 py-4', st.done && 'opacity-60')}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  st.done
                    ? 'bg-positive/15 text-positive'
                    : i === next
                      ? 'bg-primary text-primary-fg'
                      : 'bg-surface-2 text-muted',
                )}
              >
                {st.done ? <Check size={18} aria-label="Done" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium', st.done && 'line-through')}>{st.title}</p>
                <p className="text-sm text-muted">{st.text}</p>
              </div>
              {!st.done && (
                <Button size="sm" variant={i === next ? 'primary' : 'outline'} onClick={st.onClick}>
                  <Icon size={14} /> {st.action}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {Object.keys(ws.groups).length === 0 && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Just looking around?{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-60"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await attempt(loadSampleData, 'Sample data loaded');
              setBusy(false);
            }}
          >
            {busy ? 'Loading sample data…' : 'Load sample data'}
          </button>
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function BalanceCard({
  title,
  empty,
  people,
  sign,
}: {
  title: string;
  empty: string;
  people: {
    person: Person;
    amounts: Map<CurrencyCode, Cents>;
  }[];
  sign: 1 | -1;
}) {
  return (
    <section className="card">
      <h2 className="border-b border-border px-4 py-3 font-semibold">{title}</h2>
      {people.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {people.map(({ person, amounts }) => {
            const relevant = new Map([...amounts].filter(([, v]) => v * sign > 0));
            return (
              <li key={person.id}>
                <Link
                  to={`/friends/${person.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <Avatar name={person.name} color={person.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{person.name}</span>
                    <span className="block text-xs text-muted">
                      {sign > 0 ? 'owes you' : 'you owe'}
                    </span>
                  </span>
                  <MoneyList amounts={relevant} signed className="text-sm font-semibold" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
