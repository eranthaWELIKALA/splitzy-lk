import type { Cents, CurrencyCode, ID, Person, SplitMethod, SplitShare } from '@/domain/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

interface Props {
  method: SplitMethod;
  participants: Person[];
  me: ID;
  currency: CurrencyCode;
  included: Record<ID, boolean>;
  values: Record<ID, string>;
  shares: SplitShare[] | null;
  onToggle: (id: ID) => void;
  onValue: (id: ID, value: string) => void;
}

const suffix: Partial<Record<SplitMethod, string>> = { percent: '%', shares: 'share(s)' };

export function SplitEditor({
  method,
  participants,
  me,
  currency,
  included,
  values,
  shares,
  onToggle,
  onValue,
}: Props) {
  const usesCheckbox = method === 'equal' || method === 'adjustment';
  const usesInput = method !== 'equal';
  const amountOf = (id: ID): Cents | undefined => shares?.find((s) => s.personId === id)?.amount;

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {participants.map((p) => {
        const isIncluded = included[p.id] ?? true;
        const amount = amountOf(p.id);
        return (
          <li
            key={p.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2',
              usesCheckbox && !isIncluded && 'opacity-50',
            )}
          >
            {usesCheckbox && (
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={isIncluded}
                onChange={() => onToggle(p.id)}
                aria-label={`Include ${p.name}`}
              />
            )}
            <Avatar name={p.name} color={p.avatarColor} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.id === me ? `${p.name} (you)` : p.name}
            </span>
            {usesInput && (!usesCheckbox || isIncluded) && (
              <div className="flex items-center gap-1">
                {method === 'adjustment' && <span className="text-xs text-muted">+</span>}
                <input
                  inputMode="decimal"
                  className="input w-24 py-1.5 text-right"
                  placeholder={method === 'shares' ? '0' : '0.00'}
                  value={values[p.id] ?? ''}
                  onChange={(e) => onValue(p.id, e.target.value)}
                  aria-label={`${p.name} ${method}`}
                />
                {suffix[method] && (
                  <span className="w-12 text-xs text-muted">{suffix[method]}</span>
                )}
              </div>
            )}
            <span className="w-28 text-right text-sm tabular-nums text-muted">
              {amount !== undefined ? formatMoney(amount, currency) : '—'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
