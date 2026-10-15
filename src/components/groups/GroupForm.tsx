import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { AddFriendModal } from '@/components/friends/AddFriendModal';
import { GROUP_TYPES } from '@/domain/categories';
import type { Group, GroupType, ID } from '@/domain/types';
import { useCurrentAccount, useMe, useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { CURRENCIES } from '@/lib/money';
import type { GroupDraft } from '@/stores/dataStore';

interface Props {
  group?: Group;
  /** Whether the currency can still change (it's locked once a group has expenses). */
  currencyLocked?: boolean;
  onSubmit: (draft: GroupDraft) => unknown;
  onCancel: () => void;
}

export function GroupForm({ group, currencyLocked, onSubmit, onCancel }: Props) {
  const ws = useWorkspace();
  const me = useMe();
  const account = useCurrentAccount();
  const [name, setName] = useState(group?.name ?? '');
  const [type, setType] = useState<GroupType>(group?.type ?? 'trip');
  const [currency, setCurrency] = useState(group?.currency ?? account?.defaultCurrency ?? 'LKR');
  const [memberIds, setMemberIds] = useState<ID[]>(group?.memberIds.filter((m) => m !== me) ?? []);
  const [simplify, setSimplify] = useState(group?.simplifyDebts ?? true);
  const [addingFriend, setAddingFriend] = useState(false);

  const friends = ws.friendIds.map((id) => ws.people[id]).filter((p) => p !== undefined);
  const toggle = (id: ID) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onSubmit({
      name: name.trim(),
      type,
      currency,
      memberIds: [me, ...memberIds],
      simplifyDebts: simplify,
    });
    setBusy(false);
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextInput
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Galle Fort trip"
          autoFocus
          maxLength={60}
        />
        <fieldset>
          <legend className="label">Type</legend>
          <div className="flex flex-wrap gap-2">
            {GROUP_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => setType(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm',
                  type === t.id ? 'border-primary bg-primary-soft' : 'border-border text-muted',
                )}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <SelectInput
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={currencyLocked}
          hint={currencyLocked ? 'Currency can’t change once the group has expenses.' : undefined}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </SelectInput>
        <fieldset>
          <legend className="label">Members</legend>
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const active = memberIds.includes(f.id);
              const locked = !!group && group.memberIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  disabled={locked}
                  title={locked ? 'Remove existing members from the Members tab' : undefined}
                  onClick={() => toggle(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm',
                    active ? 'border-primary bg-primary-soft' : 'border-border text-muted',
                    locked && 'cursor-default',
                  )}
                >
                  <Avatar name={f.name} color={f.avatarColor} size="xs" />
                  {f.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAddingFriend(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-primary"
            >
              <UserPlus size={14} /> New person
            </button>
          </div>
        </fieldset>
        <Switch
          checked={simplify}
          onChange={setSimplify}
          label="Simplify group debts"
          description="Combine debts to reduce the number of payments needed (e.g. if A owes B and B owes C, A pays C directly)."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : group ? 'Save' : 'Create group'}
          </Button>
        </div>
      </form>
      <AddFriendModal
        open={addingFriend}
        onClose={() => setAddingFriend(false)}
        onAdded={(id) => setMemberIds((ids) => [...ids, id])}
      />
    </>
  );
}
