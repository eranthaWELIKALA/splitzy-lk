import { describe, expect, it } from 'vitest';
import { allocate, toCents } from '@/lib/money';
import { computeSplit, validatePayments, type SplitInput } from './split';

const people = (values: number[], included = true): SplitInput[] =>
  values.map((value, i) => ({ personId: `p${i}`, value, included }));

const amounts = (r: ReturnType<typeof computeSplit>) =>
  r.ok ? r.shares.map((s) => s.amount) : r.error;

describe('allocate', () => {
  it('always sums to the total', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(allocate(999, [2, 1]).reduce((a, b) => a + b)).toBe(999);
  });
});

describe('toCents', () => {
  it('parses user input', () => {
    expect(toCents('12.50')).toBe(1250);
    expect(toCents('1,200.99')).toBe(120099);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('abc')).toBeNaN();
  });
});

describe('computeSplit', () => {
  it('splits equally with remainder cents', () => {
    expect(amounts(computeSplit(1000, 'equal', people([0, 0, 0])))).toEqual([334, 333, 333]);
  });

  it('only includes selected people for equal splits', () => {
    const inputs = people([0, 0, 0]);
    inputs[1]!.included = false;
    const r = computeSplit(1000, 'equal', inputs);
    expect(r.ok && r.shares.map((s) => s.personId)).toEqual(['p0', 'p2']);
  });

  it('validates exact amounts', () => {
    expect(amounts(computeSplit(1000, 'exact', people([600, 400])))).toEqual([600, 400]);
    expect(computeSplit(1000, 'exact', people([600, 300])).ok).toBe(false);
  });

  it('splits by percentages', () => {
    expect(amounts(computeSplit(1000, 'percent', people([50, 25, 25])))).toEqual([500, 250, 250]);
    expect(computeSplit(1000, 'percent', people([50, 20])).ok).toBe(false);
  });

  it('splits by shares', () => {
    expect(amounts(computeSplit(900, 'shares', people([2, 1])))).toEqual([600, 300]);
  });

  it('splits with adjustments', () => {
    // 10.00 total, p0 pays 2.00 extra, remaining 8.00 split equally
    expect(amounts(computeSplit(1000, 'adjustment', people([200, 0])))).toEqual([600, 400]);
    expect(computeSplit(1000, 'adjustment', people([1200, 0])).ok).toBe(false);
  });

  it('rejects non-positive totals', () => {
    expect(computeSplit(0, 'equal', people([0])).ok).toBe(false);
  });
});

describe('validatePayments', () => {
  it('requires payments to match total', () => {
    expect(validatePayments(1000, [{ personId: 'a', amount: 1000 }])).toBeNull();
    expect(validatePayments(1000, [{ personId: 'a', amount: 500 }])).not.toBeNull();
  });
});
