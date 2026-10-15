import { allocate } from '@/lib/money';
import type { Cents, ID, Payment, SplitMethod, SplitShare } from './types';

export interface SplitInput {
  personId: ID;
  /** Whether this person takes part in the split (used by `equal`). */
  included: boolean;
  /** Method-specific value: exact cents, percent, share count, or adjustment cents. */
  value: number;
}

export type SplitResult = { ok: true; shares: SplitShare[] } | { ok: false; error: string };

export const SPLIT_METHODS: { id: SplitMethod; label: string; hint: string }[] = [
  { id: 'equal', label: 'Equally', hint: 'Split evenly between selected people' },
  { id: 'exact', label: 'Exact amounts', hint: 'Enter how much each person owes' },
  { id: 'percent', label: 'Percentages', hint: 'Enter a percentage for each person' },
  { id: 'shares', label: 'Shares', hint: 'e.g. 2 shares for a couple, 1 for a single' },
  { id: 'adjustment', label: 'Adjustment', hint: 'Add extra to someone, rest split equally' },
];

export function computeSplit(total: Cents, method: SplitMethod, inputs: SplitInput[]): SplitResult {
  if (!Number.isFinite(total) || total <= 0)
    return { ok: false, error: 'Enter an amount greater than zero.' };

  switch (method) {
    case 'equal': {
      const people = inputs.filter((i) => i.included);
      if (people.length === 0) return { ok: false, error: 'Select at least one person.' };
      const parts = allocate(
        total,
        people.map(() => 1),
      );
      return {
        ok: true,
        shares: people.map((p, i) => ({ personId: p.personId, amount: parts[i]! })),
      };
    }
    case 'exact': {
      if (inputs.some((i) => !Number.isFinite(i.value) || i.value < 0))
        return { ok: false, error: 'Amounts must be zero or more.' };
      const sum = inputs.reduce((a, i) => a + i.value, 0);
      if (sum !== total) {
        const diff = total - sum;
        return {
          ok: false,
          error:
            diff > 0
              ? `${(diff / 100).toFixed(2)} left to assign.`
              : `${(-diff / 100).toFixed(2)} over the total.`,
        };
      }
      return {
        ok: true,
        shares: inputs
          .filter((i) => i.value > 0)
          .map((i) => ({ personId: i.personId, amount: i.value, input: i.value })),
      };
    }
    case 'percent': {
      if (inputs.some((i) => !Number.isFinite(i.value) || i.value < 0))
        return { ok: false, error: 'Percentages must be zero or more.' };
      const sum = inputs.reduce((a, i) => a + i.value, 0);
      if (Math.abs(sum - 100) > 0.001)
        return { ok: false, error: `Percentages add up to ${round2(sum)}%, not 100%.` };
      return weighted(total, inputs);
    }
    case 'shares': {
      if (inputs.some((i) => !Number.isFinite(i.value) || i.value < 0))
        return { ok: false, error: 'Shares must be zero or more.' };
      if (inputs.reduce((a, i) => a + i.value, 0) <= 0)
        return { ok: false, error: 'Give at least one share.' };
      return weighted(total, inputs);
    }
    case 'adjustment': {
      if (inputs.length === 0) return { ok: false, error: 'Add at least one person.' };
      if (inputs.some((i) => !Number.isFinite(i.value)))
        return { ok: false, error: 'Adjustments must be numbers.' };
      const adjSum = inputs.reduce((a, i) => a + i.value, 0);
      const rest = total - adjSum;
      if (rest < 0) return { ok: false, error: 'Adjustments exceed the total.' };
      const parts = allocate(
        rest,
        inputs.map(() => 1),
      );
      const shares = inputs.map((i, idx) => ({
        personId: i.personId,
        amount: parts[idx]! + i.value,
        input: i.value,
      }));
      if (shares.some((s) => s.amount < 0))
        return { ok: false, error: 'Nobody can owe less than zero.' };
      return { ok: true, shares: shares.filter((s) => s.amount > 0 || s.input !== 0) };
    }
  }
}

function weighted(total: Cents, inputs: SplitInput[]): SplitResult {
  const parts = allocate(
    total,
    inputs.map((i) => i.value),
  );
  return {
    ok: true,
    shares: inputs
      .map((i, idx) => ({ personId: i.personId, amount: parts[idx]!, input: i.value }))
      .filter((s) => s.input > 0),
  };
}

export function validatePayments(total: Cents, payments: Payment[]): string | null {
  if (payments.length === 0) return 'Choose who paid.';
  if (payments.some((p) => p.amount < 0)) return 'Paid amounts must be zero or more.';
  const sum = payments.reduce((a, p) => a + p.amount, 0);
  if (sum !== total)
    return `Paid amounts add up to ${(sum / 100).toFixed(2)}, expected ${(total / 100).toFixed(2)}.`;
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
