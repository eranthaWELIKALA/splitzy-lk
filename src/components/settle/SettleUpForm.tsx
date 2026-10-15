import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Debt, ID } from '@/domain/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { useCurrentAccount, useMe, useWorkspace, workspaceDebts } from '@/hooks/useWorkspace';
import { groupDebts } from '@/domain/balances';
import { todayIso } from '@/lib/id';
import { CURRENCIES, formatMoney, fromCents, toCents } from '@/lib/money';
import { useDataStore } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';
import { cn } from '@/lib/cn';

interface Props {
  groupId?: ID | null;
  personId?: ID;
  onDone: () => void;
  onCancel: () => void;
}

export function SettleUpForm({ groupId, personId, onDone, onCancel }: Props) {
  const ws = useWorkspace();
  const me = useMe();
  const account = useCurrentAccount();
  const addSettlement = useDataStore((s) => s.addSettlement);
  const group = groupId ? ws.groups[groupId] : undefined;

  /** Outstanding debts that involve me, scoped to the group if one is given. */
  const suggestions = useMemo<(Debt & { groupId: ID | null })[]>(() => {
    if (group) {
      const debts = groupDebts(
        Object.values(ws.expenses).filter((e) => e.groupId === group.id),
        Object.values(ws.settlements).filter((s) => s.groupId === group.id),
        group.simplifyDebts,
      );
      return debts.map((d) => ({ ...d, groupId: group.id }));
    }
    // Non-group view: list per-group debts with me so each payment lands in the right ledger.
    const out: (Debt & { groupId: ID | null })[] = [];
    for (const g of Object.values(ws.groups)) {
      const debts = groupDebts(
        Object.values(ws.expenses).filter((e) => e.groupId === g.id),
        Object.values(ws.settlements).filter((s) => s.groupId === g.id),
        g.simplifyDebts,
      );
      out.push(
        ...debts.filter((d) => d.from === me || d.to === me).map((d) => ({ ...d, groupId: g.id })),
      );
    }
    const nonGroup = workspaceDebts({ ...ws, groups: {} }).filter(
      (d) => d.from === me || d.to === me,
    );
    out.push(...nonGroup.map((d) => ({ ...d, groupId: null })));
    return personId ? out.filter((d) => d.from === personId || d.to === personId) : out;
  }, [ws, group, me, personId]);

  const first = suggestions.find((d) => d.from === me || d.to === me) ?? suggestions[0];
  const memberIds = group ? group.memberIds : [me, ...ws.friendIds];
  const people = memberIds.map((id) => ws.people[id]).filter((p) => p !== undefined);

  const [fromId, setFromId] = useState<ID>(first?.from ?? me);
  const [toId, setToId] = useState<ID>(
    first?.to ?? personId ?? people.find((p) => p.id !== me)?.id ?? '',
  );
  const [amountStr, setAmountStr] = useState(first ? fromCents(first.amount) : '');
  const [currencyState, setCurrency] = useState(
    first?.currency ?? group?.currency ?? account?.defaultCurrency ?? 'LKR',
  );
  const [targetGroup, setTargetGroup] = useState<ID | null>(first?.groupId ?? groupId ?? null);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currency = group?.currency ?? currencyState;
  const nameOf = (id: ID) => (id === me ? 'You' : (ws.people[id]?.name ?? 'Unknown'));

  const pick = (d: (typeof suggestions)[number]) => {
    setFromId(d.from);
    setToId(d.to);
    setAmountStr(fromCents(d.amount));
    setCurrency(d.currency);
    setTargetGroup(d.groupId);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const amount = toCents(amountStr);
    if (!fromId || !toId || fromId === toId) return setError('Choose two different people.');
    if (!Number.isFinite(amount) || amount <= 0)
      return setError('Enter an amount greater than zero.');
    setBusy(true);
    const res = await attempt(
      () =>
        addSettlement({
          groupId: targetGroup,
          fromId,
          toId,
          amount,
          currency,
          date,
          note: note.trim() || undefined,
        }),
      `Payment of ${formatMoney(amount, currency)} recorded`,
    );
    setBusy(false);
    if (res.ok) onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {suggestions.length > 0 && (
        <section>
          <h3 className="label">Suggested payments</h3>
          <ul className="space-y-1.5">
            {suggestions.map((d, i) => {
              const active =
                d.from === fromId &&
                d.to === toId &&
                d.groupId === targetGroup &&
                d.currency === currency;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pick(d)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                      active
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-surface-2',
                    )}
                  >
                    <span className="font-medium">{nameOf(d.from)}</span>
                    <ArrowRight size={14} className="text-muted" />
                    <span className="font-medium">{nameOf(d.to)}</span>
                    {!group && d.groupId && (
                      <span className="truncate text-xs text-muted">
                        · {ws.groups[d.groupId]?.name}
                      </span>
                    )}
                    <span className="ml-auto tabular-nums">
                      {formatMoney(d.amount, d.currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex items-end gap-2">
        <SelectInput
          label="Payer"
          className="flex-1"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {nameOf(p.id)}
            </option>
          ))}
        </SelectInput>
        <ArrowRight className="mb-2.5 shrink-0 text-muted" size={18} />
        <SelectInput
          label="Recipient"
          className="flex-1"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {nameOf(p.id)}
            </option>
          ))}
        </SelectInput>
      </div>

      <div className="flex items-center justify-center gap-3 py-1">
        {ws.people[fromId] && (
          <Avatar name={ws.people[fromId].name} color={ws.people[fromId].avatarColor} />
        )}
        <span className="text-sm text-muted">pays</span>
        {ws.people[toId] && (
          <Avatar name={ws.people[toId].name} color={ws.people[toId].avatarColor} />
        )}
      </div>

      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <TextInput
          label="Amount"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.00"
        />
        <SelectInput
          label="Currency"
          value={currency}
          disabled={!!group}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </SelectInput>
      </div>

      {!group && (
        <SelectInput
          label="Record in"
          value={targetGroup ?? ''}
          onChange={(e) => setTargetGroup(e.target.value || null)}
        >
          <option value="">Non-group expenses</option>
          {Object.values(ws.groups).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectInput>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <TextInput
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Cash, bank transfer…"
          maxLength={120}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
