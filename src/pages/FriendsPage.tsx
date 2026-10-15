import { useMemo, useState } from 'react';
import { Search, UserPlus, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { AddFriendModal } from '@/components/friends/AddFriendModal';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyList } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMyBalances, useWorkspace } from '@/hooks/useWorkspace';

export default function FriendsPage() {
  const ws = useWorkspace();
  const { byPerson } = useMyBalances();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const friends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ws.friendIds
      .map((id) => ws.people[id])
      .filter((p) => p !== undefined)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email?.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ws, query]);

  return (
    <>
      <PageHeader
        title="Friends"
        subtitle="Everyone you split with."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add friend
          </Button>
        }
      />
      <section className="card overflow-hidden">
        {ws.friendIds.length > 0 && (
          <div className="border-b border-border p-3">
            <label className="relative block">
              <span className="sr-only">Search friends</span>
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9"
                placeholder="Search friends"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        )}
        {friends.length === 0 ? (
          <EmptyState
            icon={<UserRound size={20} />}
            title={ws.friendIds.length ? 'No matches' : 'No friends yet'}
            description={
              ws.friendIds.length ? undefined : 'Add friends to split expenses with them.'
            }
            action={
              !ws.friendIds.length && <Button onClick={() => setAdding(true)}>Add a friend</Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {friends.map((f) => {
              const bal = byPerson.get(f.id);
              const sum = bal ? [...bal.values()].reduce((a, b) => a + b, 0) : 0;
              return (
                <li key={f.id}>
                  <Link
                    to={`/friends/${f.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                  >
                    <Avatar name={f.name} color={f.avatarColor} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      {f.email && (
                        <span className="block truncate text-xs text-muted">{f.email}</span>
                      )}
                    </span>
                    {!bal ? (
                      <span className="text-xs text-muted">settled up</span>
                    ) : (
                      <span className="text-right">
                        <span className="block text-[11px] text-muted">
                          {sum >= 0 ? 'owes you' : 'you owe'}
                        </span>
                        <MoneyList amounts={bal} signed className="text-sm font-semibold" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <AddFriendModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
