import type { ExpenseCategory, GroupType } from './types';

export const CATEGORIES: { id: ExpenseCategory; label: string; emoji: string }[] = [
  { id: 'general', label: 'General', emoji: '🧾' },
  { id: 'food', label: 'Food & drink', emoji: '🍽️' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'rent', label: 'Rent', emoji: '🏠' },
  { id: 'utilities', label: 'Utilities', emoji: '💡' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'health', label: 'Health', emoji: '💊' },
];

export const categoryMeta = (id: ExpenseCategory) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;

export const GROUP_TYPES: { id: GroupType; label: string; emoji: string }[] = [
  { id: 'home', label: 'Home', emoji: '🏡' },
  { id: 'trip', label: 'Trip', emoji: '🧳' },
  { id: 'couple', label: 'Couple', emoji: '💞' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'other', label: 'Other', emoji: '👥' },
];

export const groupTypeMeta = (id: GroupType) =>
  GROUP_TYPES.find((g) => g.id === id) ?? GROUP_TYPES[4]!;
