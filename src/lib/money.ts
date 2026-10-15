import type { Cents, CurrencyCode } from '@/domain/types';

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'LKR', label: 'Sri Lankan Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'JPY', label: 'Japanese Yen' },
];

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, f);
  }
  return f;
}

export function formatMoney(cents: Cents, currency: CurrencyCode): string {
  return formatter(currency).format(cents / 100);
}

/** Parse a user-typed decimal string ("12.5", "1,200.99") into cents. Returns NaN when invalid. */
export function toCents(input: string | number): Cents {
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = input.replace(/,/g, '').trim();
  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

export function fromCents(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/**
 * Split `total` across `weights` using the largest-remainder method so the parts
 * always sum exactly to `total`. Ties go to earlier entries for determinism.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors;
}
