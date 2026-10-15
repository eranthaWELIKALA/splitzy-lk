import type { Cents, CurrencyCode, Debt, Expense, ID, Settlement } from './types';

/** Net position per person, per currency. Positive = is owed money, negative = owes money. */
export type NetBalances = Map<CurrencyCode, Map<ID, Cents>>;

function bump(map: Map<ID, Cents>, id: ID, delta: Cents) {
  map.set(id, (map.get(id) ?? 0) + delta);
}

function ensure<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
  }
  return v;
}

export function expenseNets(e: Expense): Map<ID, Cents> {
  const nets = new Map<ID, Cents>();
  for (const p of e.paidBy) bump(nets, p.personId, p.amount);
  for (const s of e.splits) bump(nets, s.personId, -s.amount);
  return nets;
}

export function netBalances(expenses: Expense[], settlements: Settlement[]): NetBalances {
  const result: NetBalances = new Map();
  for (const e of expenses) {
    const m = ensure(result, e.currency, () => new Map());
    for (const [id, v] of expenseNets(e)) bump(m, id, v);
  }
  for (const s of settlements) {
    const m = ensure(result, s.currency, () => new Map());
    bump(m, s.fromId, s.amount);
    bump(m, s.toId, -s.amount);
  }
  return result;
}

/**
 * Turn net positions into a list of debts by greedily matching the largest debtor with the
 * largest creditor. Produces at most n-1 transfers — the "simplify debts" behaviour.
 */
export function simplifyDebts(nets: Map<ID, Cents>, currency: CurrencyCode): Debt[] {
  const creditors = [...nets].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = [...nets].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const debts: Debt[] = [];
  const byAmount = (a: { id: ID; v: number }, b: { id: ID; v: number }) =>
    b.v - a.v || a.id.localeCompare(b.id);
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0]!;
    const d = debtors[0]!;
    const amount = Math.min(c.v, d.v);
    debts.push({ from: d.id, to: c.id, amount, currency });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return debts;
}

/** Pairwise ledger: ledger.get(currency).get(from).get(to) = gross amount `from` owes `to`. */
type Ledger = Map<CurrencyCode, Map<ID, Map<ID, Cents>>>;

function addToLedger(ledger: Ledger, currency: CurrencyCode, from: ID, to: ID, amount: Cents) {
  if (from === to || amount === 0) return;
  const byFrom = ensure(
    ensure(ledger, currency, () => new Map()),
    from,
    () => new Map<ID, Cents>(),
  );
  bump(byFrom, to, amount);
}

/**
 * Exact pairwise debts without cross-person simplification: within each expense, debtors are
 * matched to that expense's payers; settlements reduce what one person owes another.
 */
export function pairwiseDebts(expenses: Expense[], settlements: Settlement[]): Debt[] {
  const ledger: Ledger = new Map();
  for (const e of expenses) {
    for (const d of simplifyDebts(expenseNets(e), e.currency))
      addToLedger(ledger, e.currency, d.from, d.to, d.amount);
  }
  // A settlement from A to B is equivalent to B owing A that amount.
  for (const s of settlements) addToLedger(ledger, s.currency, s.toId, s.fromId, s.amount);

  const debts: Debt[] = [];
  for (const [currency, byFrom] of ledger) {
    const seen = new Set<string>();
    for (const [a, byTo] of byFrom) {
      for (const b of byTo.keys()) {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const net = (byTo.get(b) ?? 0) - (byFrom.get(b)?.get(a) ?? 0);
        if (net > 0) debts.push({ from: a, to: b, amount: net, currency });
        else if (net < 0) debts.push({ from: b, to: a, amount: -net, currency });
      }
    }
  }
  return debts;
}

/** Debts for a group, honouring its simplify-debts setting. */
export function groupDebts(
  expenses: Expense[],
  settlements: Settlement[],
  simplify: boolean,
): Debt[] {
  if (!simplify) return pairwiseDebts(expenses, settlements);
  const debts: Debt[] = [];
  for (const [currency, nets] of netBalances(expenses, settlements))
    debts.push(...simplifyDebts(nets, currency));
  return debts;
}

/** Balance between `me` and each other person, per currency. Positive = they owe me. */
export function balancesWith(me: ID, debts: Debt[]): Map<ID, Map<CurrencyCode, Cents>> {
  const out = new Map<ID, Map<CurrencyCode, Cents>>();
  for (const d of debts) {
    if (d.to === me)
      bump(
        ensure(out, d.from, () => new Map()),
        d.currency,
        d.amount,
      );
    else if (d.from === me)
      bump(
        ensure(out, d.to, () => new Map()),
        d.currency,
        -d.amount,
      );
  }
  for (const [id, m] of out) {
    for (const [c, v] of m) if (v === 0) m.delete(c);
    if (m.size === 0) out.delete(id);
  }
  return out;
}

export function sumByCurrency(
  entries: Iterable<Map<CurrencyCode, Cents>>,
  sign: 1 | -1,
): Map<CurrencyCode, Cents> {
  const out = new Map<CurrencyCode, Cents>();
  for (const m of entries)
    for (const [c, v] of m) if (v * sign > 0) bump(out as Map<ID, Cents>, c, v * sign);
  return out;
}
