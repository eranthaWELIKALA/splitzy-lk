/** All monetary amounts are integers in minor units (cents) to avoid floating-point errors. */
export type Cents = number;
export type ID = string;
export type CurrencyCode = string;

export interface Person {
  id: ID;
  /** Auth user id once this person has a Splitzy account; null for invited friends. */
  userId: ID | null;
  name: string;
  email?: string;
  avatarColor: string;
  createdBy: ID | null;
  createdAt: string;
}

export type GroupType = 'home' | 'trip' | 'couple' | 'work' | 'other';

export interface Group {
  id: ID;
  name: string;
  type: GroupType;
  currency: CurrencyCode;
  memberIds: ID[];
  simplifyDebts: boolean;
  createdBy: ID;
  createdAt: string;
}

export type SplitMethod = 'equal' | 'exact' | 'percent' | 'shares' | 'adjustment';

export interface Payment {
  personId: ID;
  amount: Cents;
}

export interface SplitShare {
  personId: ID;
  /** Final amount this person owes for the expense. */
  amount: Cents;
  /** Raw input for the chosen method (percentage, share count, adjustment cents, exact cents). */
  input?: number;
}

export type ExpenseCategory =
  | 'general'
  | 'food'
  | 'groceries'
  | 'transport'
  | 'rent'
  | 'utilities'
  | 'entertainment'
  | 'travel'
  | 'shopping'
  | 'health';

export interface Expense {
  id: ID;
  groupId: ID | null;
  description: string;
  amount: Cents;
  currency: CurrencyCode;
  category: ExpenseCategory;
  date: string;
  paidBy: Payment[];
  splitMethod: SplitMethod;
  splits: SplitShare[];
  notes?: string;
  createdBy: ID;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: ID;
  groupId: ID | null;
  fromId: ID;
  toId: ID;
  amount: Cents;
  currency: CurrencyCode;
  date: string;
  note?: string;
  createdBy: ID;
  createdAt: string;
}

export type ActivityKind =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_added'
  | 'settlement_deleted'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'member_added'
  | 'member_removed'
  | 'friend_added'
  | 'reminder_sent';

/** Snapshot written by the database when the activity happened (see the activity triggers). */
export interface ActivityData {
  actor_name?: string;
  expense_id?: ID;
  description?: string;
  amount?: Cents;
  currency?: CurrencyCode;
  group_name?: string | null;
  /** For expenses: what the recipient gets back (positive) or owes (negative). */
  net?: Cents;
  target_id?: ID;
  target_name?: string;
  from_id?: ID;
  from_name?: string;
  to_id?: ID;
  to_name?: string;
  note?: string | null;
}

export interface Activity {
  id: ID;
  kind: ActivityKind;
  actorId: ID | null;
  groupId: ID | null;
  data: ActivityData;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  expenses: boolean;
  settlements: boolean;
  groups: boolean;
  friends: boolean;
  browser: boolean;
}

/** Everything the signed-in user can see, as returned by the API. */
export interface Workspace {
  people: Record<ID, Person>;
  friendIds: ID[];
  groups: Record<ID, Group>;
  expenses: Record<ID, Expense>;
  settlements: Record<ID, Settlement>;
  activity: Activity[];
  prefs: NotificationPrefs;
}

/** A directed debt: `from` owes `to`. */
export interface Debt {
  from: ID;
  to: ID;
  amount: Cents;
  currency: CurrencyCode;
}
