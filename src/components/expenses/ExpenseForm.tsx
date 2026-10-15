import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Plus, UserPlus } from 'lucide-react';
import { CATEGORIES, groupTypeMeta } from '@/domain/categories';
import { computeSplit, SPLIT_METHODS, validatePayments, type SplitInput } from '@/domain/split';
import type { Expense, ExpenseCategory, ID, SplitMethod } from '@/domain/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { AddFriendModal } from '@/components/friends/AddFriendModal';
import { SelectInput, TextArea, TextInput } from '@/components/ui/Field';
import { useCurrentAccount, useMe, useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/id';
import { CURRENCIES, formatMoney, fromCents, toCents } from '@/lib/money';
import { useDataStore, type ExpenseDraft } from '@/stores/dataStore';
import { attempt } from '@/lib/errors';
import { SplitEditor } from './SplitEditor';

interface Props {
  expense?: Expense;
  defaultGroupId?: ID | null;
  defaultFriendId?: ID;
  onDone: (id: ID) => void;
  onCancel: () => void;
  /** Offered when there are no groups yet. */
  onCreateGroup?: () => void;
}

function initialValues(expense: Expense | undefined): Record<ID, string> {
  if (!expense) return {};
  const out: Record<ID, string> = {};
  for (const s of expense.splits) {
    const v = s.input ?? s.amount;
    out[s.personId] =
      expense.splitMethod === 'exact' || expense.splitMethod === 'adjustment'
        ? v === 0
          ? ''
          : fromCents(v)
        : String(v);
  }
  return out;
}

const LAST_GROUP_KEY = 'splitzy-last-group';

function readLastGroup(): string | null {
  try {
    return localStorage.getItem(LAST_GROUP_KEY);
  } catch {
    return null;
  }
}

function rememberLastGroup(id: ID) {
  try {
    localStorage.setItem(LAST_GROUP_KEY, id);
  } catch {
    // Storage may be unavailable (e.g. private mode); this default is only a convenience.
  }
}

function parseValue(method: SplitMethod, raw: string | undefined): number {
  const str = (raw ?? '').trim();
  if (method === 'exact' || method === 'adjustment') return str === '' ? 0 : toCents(str);
  return str === '' ? 0 : Number(str);
}

export function ExpenseForm({
  expense,
  defaultGroupId,
  defaultFriendId,
  onDone,
  onCancel,
  onCreateGroup,
}: Props) {
  const ws = useWorkspace();
  const me = useMe();
  const account = useCurrentAccount();
  const addExpense = useDataStore((s) => s.addExpense);
  const updateExpense = useDataStore((s) => s.updateExpense);

  const groups = useMemo(
    () => Object.values(ws.groups).sort((a, b) => a.name.localeCompare(b.name)),
    [ws.groups],
  );
  const friends = useMemo(
    () =>
      ws.friendIds
        .map((id) => ws.people[id])
        .filter((p) => p !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ws.friendIds, ws.people],
  );

  // Pick the most likely group (or friends) up front so adding an expense is usually one step.
  const [groupId, setGroupId] = useState<ID | ''>(() => {
    if (expense) return expense.groupId ?? '';
    if (defaultGroupId && ws.groups[defaultGroupId]) return defaultGroupId;
    if (defaultFriendId) return '';
    const last = readLastGroup();
    if (last && ws.groups[last]) return last;
    return groups[0]?.id ?? '';
  });
  const [mode, setMode] = useState<'group' | 'friends'>(() => {
    if (expense) return expense.groupId ? 'group' : 'friends';
    if (defaultGroupId) return 'group';
    if (defaultFriendId) return 'friends';
    return groups.length > 0 || friends.length === 0 ? 'group' : 'friends';
  });
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendIds, setFriendIds] = useState<ID[]>(() => {
    if (expense && !expense.groupId)
      return Array.from(
        new Set([
          ...expense.splits.map((s) => s.personId),
          ...expense.paidBy.map((p) => p.personId),
        ]),
      ).filter((id) => id !== me);
    return defaultFriendId ? [defaultFriendId] : [];
  });
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amountStr, setAmountStr] = useState(expense ? fromCents(expense.amount) : '');
  const [currencyState, setCurrency] = useState(
    expense?.currency ?? account?.defaultCurrency ?? 'LKR',
  );
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'general');
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [multiPayer, setMultiPayer] = useState((expense?.paidBy.length ?? 1) > 1);
  const [payerId, setPayerId] = useState<ID>(expense?.paidBy[0]?.personId ?? me);
  const [payerAmounts, setPayerAmounts] = useState<Record<ID, string>>(() =>
    Object.fromEntries((expense?.paidBy ?? []).map((p) => [p.personId, fromCents(p.amount)])),
  );
  const [method, setMethod] = useState<SplitMethod>(expense?.splitMethod ?? 'equal');
  const [included, setIncluded] = useState<Record<ID, boolean>>(() => {
    if (!expense) return {};
    const inSplit = new Set(expense.splits.map((s) => s.personId));
    return Object.fromEntries(
      [...inSplit, ...expense.paidBy.map((p) => p.personId)].map((id) => [id, inSplit.has(id)]),
    );
  });
  const [values, setValues] = useState<Record<ID, string>>(() => initialValues(expense));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const group = mode === 'group' && groupId ? ws.groups[groupId] : undefined;
  const currency = group?.currency ?? currencyState;
  const participantIds =
    mode === 'group' ? (group?.memberIds ?? []) : [me, ...friendIds.filter((id) => ws.people[id])];
  const participants = participantIds.map((id) => ws.people[id]).filter((p) => p !== undefined);
  const effectivePayer = participantIds.includes(payerId) ? payerId : me;

  const total = toCents(amountStr);
  const totalValid = Number.isFinite(total) && total > 0;

  const inputs: SplitInput[] = participantIds.map((id) => ({
    personId: id,
    included: included[id] ?? true,
    value: parseValue(method, values[id]),
  }));
  const split = computeSplit(
    total,
    method,
    method === 'adjustment' ? inputs.filter((i) => i.included) : inputs,
  );

  const payments = multiPayer
    ? participantIds
        .map((id) => ({ personId: id, amount: parseValue('exact', payerAmounts[id]) }))
        .filter((p) => p.amount > 0)
    : [{ personId: effectivePayer, amount: totalValid ? total : 0 }];
  const paymentError = totalValid ? validatePayments(total, payments) : null;

  const changeMethod = (m: SplitMethod) => {
    setMethod(m);
    const n = participantIds.length;
    if (m === 'shares') setValues(Object.fromEntries(participantIds.map((id) => [id, '1'])));
    else if (m === 'percent') {
      const base = Math.floor((100 / n) * 100) / 100;
      setValues(
        Object.fromEntries(
          participantIds.map((id, i) => [
            id,
            String(i === n - 1 ? +(100 - base * (n - 1)).toFixed(2) : base),
          ]),
        ),
      );
    } else if (m === 'exact' && totalValid) {
      const parts = computeSplit(
        total,
        'equal',
        participantIds.map((id) => ({ personId: id, included: true, value: 0 })),
      );
      if (parts.ok)
        setValues(Object.fromEntries(parts.shares.map((s) => [s.personId, fromCents(s.amount)])));
    } else setValues({});
  };

  const errors = {
    description: !description.trim() ? 'Add a description.' : null,
    amount: !totalValid ? 'Enter an amount greater than zero.' : null,
    people:
      mode === 'group'
        ? !group
          ? 'Choose a group.'
          : group.memberIds.length < 2
            ? 'This group only has you. Add members to it first.'
            : null
        : friendIds.length === 0
          ? 'Pick at least one friend to split with.'
          : null,
  };
  const canSubmit =
    !errors.description && !errors.amount && !errors.people && split.ok && !paymentError;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit || !split.ok || busy) return;
    const draft: ExpenseDraft = {
      groupId: group?.id ?? null,
      description: description.trim(),
      amount: total,
      currency,
      category,
      date,
      paidBy: payments,
      splitMethod: method,
      splits: split.shares,
      notes: notes.trim() || undefined,
    };
    setBusy(true);
    const res = expense
      ? await attempt(
          () => updateExpense(expense.id, draft).then(() => expense.id),
          'Expense updated',
        )
      : await attempt(() => addExpense(draft), 'Expense added');
    setBusy(false);
    if (!res.ok) return;
    if (group) rememberLastGroup(group.id);
    onDone(res.value);
  };

  const show = (msg: string | null) => (submitted ? msg : null);

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <section className="space-y-2">
          <Segmented
            ariaLabel="Split this expense"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'group', label: 'In a group' },
              { value: 'friends', label: 'With friends' },
            ]}
          />

          {mode === 'group' &&
            (groups.length === 0 ? (
              <InlineEmpty
                text="Groups keep trips, homes and teams organised."
                action="Create a group"
                onAction={onCreateGroup}
              />
            ) : (
              <div role="radiogroup" aria-label="Group" className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Chip
                    key={g.id}
                    role="radio"
                    active={groupId === g.id}
                    onClick={() => setGroupId(g.id)}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {groupTypeMeta(g.type).emoji}
                    </span>
                    {g.name}
                  </Chip>
                ))}
              </div>
            ))}

          {mode === 'friends' && (
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => {
                const active = friendIds.includes(f.id);
                return (
                  <Chip
                    key={f.id}
                    active={active}
                    onClick={() =>
                      setFriendIds((ids) =>
                        active ? ids.filter((i) => i !== f.id) : [...ids, f.id],
                      )
                    }
                  >
                    <Avatar name={f.name} color={f.avatarColor} size="xs" />
                    {f.name}
                  </Chip>
                );
              })}
              <button
                type="button"
                onClick={() => setAddingFriend(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
              >
                <UserPlus size={14} /> {friends.length ? 'New friend' : 'Add a friend'}
              </button>
            </div>
          )}

          {participants.length > 1 && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className="flex -space-x-1.5">
                {participants.slice(0, 6).map((p) => (
                  <Avatar
                    key={p.id}
                    name={p.name}
                    color={p.avatarColor}
                    size="xs"
                    className="ring-2 ring-surface"
                  />
                ))}
              </span>
              {participants.length} people · {currency}
            </p>
          )}
          {show(errors.people) && <p className="text-xs text-danger">{errors.people}</p>}
        </section>

        <TextInput
          label="Description"
          placeholder="e.g. Dinner at Ministry of Crab"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={show(errors.description)}
          maxLength={120}
          autoFocus
        />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <TextInput
            label={group ? `Amount (${currency})` : 'Amount'}
            inputMode="decimal"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            error={show(errors.amount)}
          />
          {group ? (
            <TextInput
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <SelectInput
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </SelectInput>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!group && (
            <TextInput
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
          <SelectInput
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={group ? 'sm:col-span-2' : undefined}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label mb-0">Paid by</span>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => setMultiPayer((m) => !m)}
            >
              {multiPayer ? 'Single payer' : 'Multiple people paid'}
            </button>
          </div>
          {multiPayer ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={p.name} color={p.avatarColor} size="sm" />
                  <span className="flex-1 truncate text-sm">{p.id === me ? 'You' : p.name}</span>
                  <input
                    inputMode="decimal"
                    className="input w-28 py-1.5 text-right"
                    placeholder="0.00"
                    value={payerAmounts[p.id] ?? ''}
                    onChange={(e) => setPayerAmounts((s) => ({ ...s, [p.id]: e.target.value }))}
                    aria-label={`Amount paid by ${p.name}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <select
              className="input"
              value={effectivePayer}
              onChange={(e) => setPayerId(e.target.value)}
              aria-label="Paid by"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === me ? 'You' : p.name}
                </option>
              ))}
            </select>
          )}
          {paymentError && multiPayer && <p className="text-xs text-danger">{paymentError}</p>}
        </section>

        <section className="space-y-2">
          <span className="label">Split</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Split method">
            {SPLIT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={method === m.id}
                title={m.hint}
                onClick={() => changeMethod(m.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                  method === m.id
                    ? 'border-primary bg-primary text-primary-fg'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{SPLIT_METHODS.find((m) => m.id === method)?.hint}</p>
          <SplitEditor
            method={method}
            participants={participants}
            me={me}
            currency={currency}
            included={included}
            values={values}
            shares={split.ok ? split.shares : null}
            onToggle={(id) => setIncluded((s) => ({ ...s, [id]: !(s[id] ?? true) }))}
            onValue={(id, v) => setValues((s) => ({ ...s, [id]: v }))}
          />
          {totalValid && (
            <p className={cn('text-xs', split.ok ? 'text-muted' : 'text-danger')}>
              {split.ok ? `Total ${formatMoney(total, currency)} fully assigned ✓` : split.error}
            </p>
          )}
        </section>

        <TextArea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || (submitted && !canSubmit)}>
            {busy ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </form>
      <AddFriendModal
        open={addingFriend}
        onClose={() => setAddingFriend(false)}
        onAdded={(id) => setFriendIds((ids) => [...ids, id])}
      />
    </>
  );
}

function Chip({
  active,
  role,
  onClick,
  children,
}: {
  active: boolean;
  role?: 'radio';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? active : undefined}
      aria-pressed={role ? undefined : active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-sm transition',
        active
          ? 'border-primary bg-primary-soft text-fg'
          : 'border-border text-muted hover:text-fg',
      )}
    >
      {children}
      {active && <Check size={14} className="text-primary" />}
    </button>
  );
}

function InlineEmpty({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3">
      <p className="flex-1 text-sm text-muted">{text}</p>
      {onAction && (
        <Button size="sm" variant="secondary" onClick={onAction}>
          <Plus size={14} /> {action}
        </Button>
      )}
    </div>
  );
}
