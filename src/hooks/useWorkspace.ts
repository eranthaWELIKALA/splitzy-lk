import { useMemo } from 'react';
import { balancesWith, groupDebts, pairwiseDebts } from '@/domain/balances';
import { isMuted } from '@/domain/activity';
import type { Cents, CurrencyCode, Debt, Expense, ID, Settlement, Workspace } from '@/domain/types';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';

export function useMe(): ID {
  return useDataStore((s) => s.me);
}

/** The signed-in user's workspace. Returns a stable reference until data changes. */
export function useWorkspace(): Workspace {
  return useDataStore((s) => s.ws);
}

export interface Account {
  userId: ID;
  personId: ID;
  name: string;
  email: string;
  phone?: string;
  avatarColor: string;
  defaultCurrency: string;
}

export function useCurrentAccount(): Account | null {
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const person = useDataStore((s) => s.ws.people[s.me]);
  const profile = useDataStore((s) => s.profile);
  return useMemo(
    () =>
      person && profile
        ? {
            userId: profile.userId,
            personId: person.id,
            name: person.name,
            email,
            phone: profile.phone,
            avatarColor: person.avatarColor,
            defaultCurrency: profile.defaultCurrency,
          }
        : null,
    [person, profile, email],
  );
}

const byDateDesc = <T extends { date: string; createdAt: string }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function sortedByDate<T extends { date: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort(byDateDesc);
}

/** Every debt in the workspace, honouring each group's simplify setting. */
export function workspaceDebts(ws: Workspace): Debt[] {
  const expenses = Object.values(ws.expenses);
  const settlements = Object.values(ws.settlements);
  const debts: Debt[] = [];
  for (const g of Object.values(ws.groups)) {
    debts.push(
      ...groupDebts(
        expenses.filter((e) => e.groupId === g.id),
        settlements.filter((s) => s.groupId === g.id),
        g.simplifyDebts,
      ),
    );
  }
  debts.push(
    ...pairwiseDebts(
      expenses.filter((e) => e.groupId === null),
      settlements.filter((s) => s.groupId === null),
    ),
  );
  return debts;
}

export function useGroup(groupId: ID | undefined) {
  const ws = useWorkspace();
  return useMemo(() => {
    const group = groupId ? ws.groups[groupId] : undefined;
    if (!group) return null;
    const expenses = sortedByDate(Object.values(ws.expenses).filter((e) => e.groupId === group.id));
    const settlements = sortedByDate(
      Object.values(ws.settlements).filter((s) => s.groupId === group.id),
    );
    const debts = groupDebts(expenses, settlements, group.simplifyDebts);
    return { group, expenses, settlements, debts };
  }, [ws, groupId]);
}

/** Balances between me and everyone else, across all groups and non-group expenses. */
export function useMyBalances() {
  const ws = useWorkspace();
  const me = useMe();
  return useMemo(() => {
    const byPerson = balancesWith(me, workspaceDebts(ws));
    const owed = new Map<CurrencyCode, Cents>();
    const owe = new Map<CurrencyCode, Cents>();
    for (const m of byPerson.values()) {
      for (const [c, v] of m) {
        const target = v > 0 ? owed : owe;
        target.set(c, (target.get(c) ?? 0) + Math.abs(v));
      }
    }
    return { byPerson, owed, owe };
  }, [ws, me]);
}

export type FeedItem =
  { type: 'expense'; item: Expense } | { type: 'settlement'; item: Settlement };

export function mergeFeed(expenses: Expense[], settlements: Settlement[]): FeedItem[] {
  return [
    ...expenses.map((item) => ({ type: 'expense' as const, item })),
    ...settlements.map((item) => ({ type: 'settlement' as const, item })),
  ].sort((a, b) => byDateDesc(a.item, b.item));
}

export function useUnreadCount(): number {
  const ws = useWorkspace();
  return useMemo(
    () => ws.activity.filter((a) => !a.read && !isMuted(a, ws.prefs)).length,
    [ws.activity, ws.prefs],
  );
}
