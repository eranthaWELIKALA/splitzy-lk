import { describe, expect, it } from 'vitest';
import { balancesWith, groupDebts, netBalances, pairwiseDebts, simplifyDebts } from './balances';
import type { Expense, Settlement } from './types';

const expense = (paidBy: string, splits: Record<string, number>, currency = 'LKR'): Expense => {
  const amount = Object.values(splits).reduce((a, b) => a + b, 0);
  return {
    id: Math.random().toString(),
    groupId: 'g',
    description: 'x',
    amount,
    currency,
    category: 'general',
    date: '2026-01-01',
    paidBy: [{ personId: paidBy, amount }],
    splitMethod: 'exact',
    splits: Object.entries(splits).map(([personId, a]) => ({ personId, amount: a })),
    createdBy: paidBy,
    createdAt: '',
    updatedAt: '',
  };
};

const settle = (fromId: string, toId: string, amount: number): Settlement => ({
  id: 's',
  groupId: 'g',
  fromId,
  toId,
  amount,
  currency: 'LKR',
  date: '',
  createdBy: fromId,
  createdAt: '',
});

describe('balances', () => {
  it('computes net balances', () => {
    const nets = netBalances([expense('a', { a: 100, b: 100, c: 100 })], []).get('LKR')!;
    expect(Object.fromEntries(nets)).toEqual({ a: 200, b: -100, c: -100 });
  });

  it('simplifies a chain of debts', () => {
    // b owes a 100, c owes b 100 => c owes a 100
    const exps = [expense('a', { b: 100 }), expense('b', { c: 100 })];
    expect(pairwiseDebts(exps, [])).toHaveLength(2);
    const simplified = groupDebts(exps, [], true);
    expect(simplified).toEqual([{ from: 'c', to: 'a', amount: 100, currency: 'LKR' }]);
  });

  it('nets out opposing debts pairwise', () => {
    const debts = pairwiseDebts([expense('a', { b: 300 }), expense('b', { a: 100 })], []);
    expect(debts).toEqual([{ from: 'b', to: 'a', amount: 200, currency: 'LKR' }]);
  });

  it('settlements reduce debts', () => {
    const exps = [expense('a', { b: 300 })];
    expect(pairwiseDebts(exps, [settle('b', 'a', 300)])).toEqual([]);
    expect(pairwiseDebts(exps, [settle('b', 'a', 100)])[0]!.amount).toBe(200);
  });

  it('keeps currencies separate', () => {
    const debts = pairwiseDebts([expense('a', { b: 100 }), expense('a', { b: 50 }, 'USD')], []);
    expect(debts).toHaveLength(2);
  });

  it('reports balances from my perspective', () => {
    const debts = pairwiseDebts([expense('me', { x: 100 }), expense('y', { me: 40 })], []);
    const bal = balancesWith('me', debts);
    expect(bal.get('x')!.get('LKR')).toBe(100);
    expect(bal.get('y')!.get('LKR')).toBe(-40);
  });

  it('simplifyDebts produces at most n-1 transfers that clear all balances', () => {
    const nets = new Map([
      ['a', 500],
      ['b', -200],
      ['c', -200],
      ['d', -100],
    ]);
    const debts = simplifyDebts(nets, 'LKR');
    expect(debts.length).toBeLessThanOrEqual(3);
    expect(debts.reduce((s, d) => s + d.amount, 0)).toBe(500);
  });
});
