import { useMemo, useState } from 'react';
import { ArrowLeft, BellRing, HandCoins, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { FeedList } from '@/components/expenses/FeedList';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MoneyList } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { balancesWith, groupDebts, pairwiseDebts } from '@/domain/balances';
import type { Cents, CurrencyCode } from '@/domain/types';
import { mergeFeed, useMe, useMyBalances, useWorkspace } from '@/hooks/useWorkspace';
import { useDataStore } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';
import { useUiStore } from '@/stores/uiStore';
import NotFoundPage from './NotFoundPage';

export default function FriendDetailPage() {
  const { friendId = '' } = useParams();
  const ws = useWorkspace();
  const me = useMe();
  const navigate = useNavigate();
  const { byPerson } = useMyBalances();
  const openExpense = useUiStore((s) => s.openExpense);
  const openSettle = useUiStore((s) => s.openSettle);
  const sendReminder = useDataStore((s) => s.sendReminder);
  const removeFriend = useDataStore((s) => s.removeFriend);
  const updatePerson = useDataStore((s) => s.updatePerson);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const friend = ws.people[friendId];

  const { breakdown, feed } = useMemo(() => {
    const expenses = Object.values(ws.expenses);
    const settlements = Object.values(ws.settlements);
    const breakdown: { label: string; link?: string; amounts: Map<CurrencyCode, Cents> }[] = [];
    for (const g of Object.values(ws.groups)) {
      if (!g.memberIds.includes(friendId) || !g.memberIds.includes(me)) continue;
      const debts = groupDebts(
        expenses.filter((e) => e.groupId === g.id),
        settlements.filter((s) => s.groupId === g.id),
        g.simplifyDebts,
      );
      const amounts = balancesWith(me, debts).get(friendId);
      if (amounts) breakdown.push({ label: g.name, link: `/groups/${g.id}`, amounts });
    }
    const nonGroup = balancesWith(
      me,
      pairwiseDebts(
        expenses.filter((e) => !e.groupId),
        settlements.filter((s) => !s.groupId),
      ),
    ).get(friendId);
    if (nonGroup) breakdown.push({ label: 'Non-group expenses', amounts: nonGroup });

    const involves = (ids: string[]) => ids.includes(friendId) && ids.includes(me);
    const shared = expenses.filter((e) =>
      involves([...e.paidBy.map((p) => p.personId), ...e.splits.map((s) => s.personId)]),
    );
    const payments = settlements.filter((s) => involves([s.fromId, s.toId]));
    return { breakdown, feed: mergeFeed(shared, payments) };
  }, [ws, me, friendId]);

  if (!friend || friendId === me) return <NotFoundPage />;
  const balance = byPerson.get(friendId);
  // Only invited friends you added can be renamed; registered users manage their own profile.
  const canEdit = !friend.userId && friend.createdBy === me;
  const total = balance ? [...balance.values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHeader
        leading={
          <>
            <Link
              to="/friends"
              aria-label="Back to friends"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden"
            >
              <ArrowLeft size={18} />
            </Link>
            <Avatar name={friend.name} color={friend.avatarColor} size="lg" />
          </>
        }
        title={friend.name}
        subtitle={
          friend.userId
            ? (friend.email ?? 'On Splitzy')
            : `${friend.email ?? 'No email'} · hasn’t joined Splitzy yet`
        }
        actions={
          <>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit friend"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} />
              </Button>
            )}
            <Button variant="outline" onClick={() => openSettle({ personId: friend.id })}>
              <HandCoins size={16} /> Settle up
            </Button>
            <Button onClick={() => openExpense({ groupId: null, friendId: friend.id })}>
              <Plus size={16} /> Add expense
            </Button>
          </>
        }
      />

      <section className="card mb-6 p-5">
        {balance ? (
          <>
            <p className="text-sm text-muted">
              {total >= 0 ? `${friend.name} owes you` : `You owe ${friend.name}`}
            </p>
            <p className="mt-1 text-3xl font-bold">
              <MoneyList amounts={balance} signed />
            </p>
            {breakdown.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                {breakdown.map((b) => (
                  <li key={b.label} className="flex justify-between gap-2">
                    {b.link ? (
                      <Link
                        to={b.link}
                        className="truncate text-muted hover:text-fg hover:underline"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span className="truncate text-muted">{b.label}</span>
                    )}
                    <MoneyList amounts={b.amounts} signed />
                  </li>
                ))}
              </ul>
            )}
            {total > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() =>
                  void attempt(() => sendReminder(friend.id), `Reminder sent to ${friend.name}`)
                }
              >
                <BellRing size={14} /> Send a reminder
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">You and {friend.name} are all settled up 🎉</p>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Shared expenses</h2>
        {feed.length === 0 ? (
          <EmptyState icon={<Receipt size={20} />} title="Nothing shared yet" />
        ) : (
          <FeedList items={feed} showGroup />
        )}
      </section>

      <div className="mt-6">
        <Button variant="ghost" className="text-danger" onClick={() => setConfirmRemove(true)}>
          <Trash2 size={16} /> Remove friend
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${friend.name}?`}
        message="You can only remove friends who aren't in any group and have no shared expenses."
        confirmLabel="Remove"
        danger
        onClose={() => setConfirmRemove(false)}
        onConfirm={async () => {
          const res = await attempt(() => removeFriend(friend.id), `${friend.name} removed`);
          if (res.ok) navigate('/friends');
        }}
      />
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit friend" size="sm">
        {editing && (
          <EditFriendForm
            name={friend.name}
            email={friend.email ?? ''}
            onCancel={() => setEditing(false)}
            onSave={async (patch) => {
              const res = await attempt(() => updatePerson(friend.id, patch), 'Friend updated');
              if (res.ok) setEditing(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function EditFriendForm({
  name: n,
  email: m,
  onSave,
  onCancel,
}: {
  name: string;
  email: string;
  onSave: (p: { name: string; email: string }) => unknown;
  onCancel: () => void;
}) {
  const [name, setName] = useState(n);
  const [email, setEmail] = useState(m);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name, email });
      }}
    >
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <TextInput
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}
