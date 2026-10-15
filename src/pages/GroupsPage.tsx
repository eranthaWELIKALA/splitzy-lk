import { useMemo } from 'react';
import { Plus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { balancesWith, groupDebts } from '@/domain/balances';
import { groupTypeMeta } from '@/domain/categories';
import { useMe, useWorkspace } from '@/hooks/useWorkspace';
import { useUiStore } from '@/stores/uiStore';

export default function GroupsPage() {
  const ws = useWorkspace();
  const me = useMe();
  const openCreateGroup = useUiStore((s) => s.openCreateGroup);

  const groups = useMemo(() => {
    const expenses = Object.values(ws.expenses);
    const settlements = Object.values(ws.settlements);
    return Object.values(ws.groups)
      .map((g) => {
        const debts = groupDebts(
          expenses.filter((e) => e.groupId === g.id),
          settlements.filter((s) => s.groupId === g.id),
          g.simplifyDebts,
        );
        let mine = 0;
        for (const m of balancesWith(me, debts).values()) mine += m.get(g.currency) ?? 0;
        return { group: g, mine, count: expenses.filter((e) => e.groupId === g.id).length };
      })
      .sort((a, b) => a.group.name.localeCompare(b.group.name));
  }, [ws, me]);

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Share expenses with flatmates, trips and more."
        actions={
          <Button onClick={() => openCreateGroup()}>
            <Plus size={16} /> New group
          </Button>
        }
      />
      {groups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={20} />}
            title="No groups yet"
            description="Create a group for your house, trip or team and start splitting."
            action={<Button onClick={() => openCreateGroup()}>Create a group</Button>}
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map(({ group, mine, count }) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="card flex h-full flex-col gap-3 p-4 transition hover:border-primary"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-xl">
                    {groupTypeMeta(group.type).emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{group.name}</h2>
                    <p className="text-xs text-muted">
                      {group.memberIds.length} members · {count} expenses
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {group.memberIds.slice(0, 5).map((id) => {
                      const p = ws.people[id];
                      return p ? (
                        <Avatar
                          key={id}
                          name={p.name}
                          color={p.avatarColor}
                          size="xs"
                          className="ring-2 ring-surface"
                        />
                      ) : null;
                    })}
                  </div>
                  <span className="text-right text-sm">
                    {mine === 0 ? (
                      <span className="text-muted">settled up</span>
                    ) : (
                      <>
                        <span className="text-xs text-muted">
                          {mine > 0 ? 'you are owed ' : 'you owe '}
                        </span>
                        <Money
                          cents={mine}
                          currency={group.currency}
                          signed
                          className="font-semibold"
                        />
                      </>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
