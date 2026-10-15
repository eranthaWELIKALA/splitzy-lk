import type { Cents, CurrencyCode } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

/** Amount coloured by sign: positive (you are owed) green, negative (you owe) orange. */
export function Money({
  cents,
  currency,
  signed = false,
  className,
}: {
  cents: Cents;
  currency: CurrencyCode;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'tabular-nums',
        signed && cents > 0 && 'text-positive',
        signed && cents < 0 && 'text-negative',
        className,
      )}
    >
      {formatMoney(Math.abs(cents), currency)}
    </span>
  );
}

/** Render a per-currency map ("LKR 1,200.00 + $5.00"). */
export function MoneyList({
  amounts,
  signed,
  className,
}: {
  amounts: Map<CurrencyCode, Cents>;
  signed?: boolean;
  className?: string;
}) {
  const entries = [...amounts].filter(([, v]) => v !== 0);
  if (entries.length === 0)
    return <span className={cn('tabular-nums', className)}>{formatMoney(0, 'LKR')}</span>;
  return (
    <span className={className}>
      {entries.map(([c, v], i) => (
        <span key={c}>
          {i > 0 && <span className="text-muted"> + </span>}
          <Money cents={v} currency={c} signed={signed} />
        </span>
      ))}
    </span>
  );
}
