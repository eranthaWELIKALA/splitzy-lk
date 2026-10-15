import type { ID } from '@/domain/types';
import { useDataStore } from '@/stores/dataStore';
import { api, type ExpenseDraft } from './api';
import { pickColor } from './colors';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const equal = (total: number, ids: ID[]) =>
  ids.map((personId) => ({ personId, amount: total / ids.length }));

/**
 * Create example friends (as invited placeholders, not real accounts), two groups, some
 * expenses and a payment. Writes go straight to the API and the workspace reloads once at the end.
 */
export async function loadSampleData(): Promise<void> {
  const { me } = useDataStore.getState();
  const friend = (name: string) => api.addFriend(name, undefined, pickColor(name));
  const kasun = await friend('Kasun Perera');
  const nimali = await friend('Nimali Silva');
  const tharindu = await friend('Tharindu Fernando');
  const everyone = [me, kasun, nimali, tharindu];

  const trip = await api.createGroup(
    {
      name: 'Ella Weekend Trip',
      type: 'trip',
      currency: 'LKR',
      memberIds: everyone,
      simplifyDebts: true,
    },
    me,
  );
  const home = await api.createGroup(
    {
      name: 'Colombo Apartment',
      type: 'home',
      currency: 'LKR',
      memberIds: [me, nimali],
      simplifyDebts: false,
    },
    me,
  );

  const expenses: ExpenseDraft[] = [
    {
      groupId: trip,
      description: 'Train tickets to Ella',
      amount: 1_200_000,
      currency: 'LKR',
      category: 'transport',
      date: daysAgo(9),
      paidBy: [{ personId: me, amount: 1_200_000 }],
      splitMethod: 'equal',
      splits: equal(1_200_000, everyone),
    },
    {
      groupId: trip,
      description: 'Homestay (2 nights)',
      amount: 3_600_000,
      currency: 'LKR',
      category: 'travel',
      date: daysAgo(8),
      paidBy: [{ personId: kasun, amount: 3_600_000 }],
      splitMethod: 'equal',
      splits: equal(3_600_000, everyone),
    },
    {
      groupId: trip,
      description: 'Dinner at Café Chill',
      amount: 880_000,
      currency: 'LKR',
      category: 'food',
      date: daysAgo(7),
      paidBy: [{ personId: nimali, amount: 880_000 }],
      splitMethod: 'shares',
      splits: [
        { personId: me, amount: 176_000, input: 1 },
        { personId: kasun, amount: 352_000, input: 2 },
        { personId: nimali, amount: 176_000, input: 1 },
        { personId: tharindu, amount: 176_000, input: 1 },
      ],
    },
    {
      groupId: home,
      description: 'October rent',
      amount: 9_000_000,
      currency: 'LKR',
      category: 'rent',
      date: daysAgo(12),
      paidBy: [{ personId: nimali, amount: 9_000_000 }],
      splitMethod: 'percent',
      splits: [
        { personId: me, amount: 5_400_000, input: 60 },
        { personId: nimali, amount: 3_600_000, input: 40 },
      ],
    },
    {
      groupId: home,
      description: 'Electricity bill',
      amount: 1_250_000,
      currency: 'LKR',
      category: 'utilities',
      date: daysAgo(3),
      paidBy: [{ personId: me, amount: 1_250_000 }],
      splitMethod: 'equal',
      splits: equal(1_250_000, [me, nimali]),
    },
    {
      groupId: null,
      description: 'Cricket match tickets',
      amount: 600_000,
      currency: 'LKR',
      category: 'entertainment',
      date: daysAgo(2),
      paidBy: [{ personId: tharindu, amount: 600_000 }],
      splitMethod: 'equal',
      splits: equal(600_000, [me, tharindu]),
    },
  ];
  for (const e of expenses) await api.addExpense(e);
  await api.addSettlement({
    groupId: home,
    fromId: me,
    toId: nimali,
    amount: 2_000_000,
    currency: 'LKR',
    date: daysAgo(1),
    note: 'Bank transfer',
  });
  await useDataStore.getState().load();
}
