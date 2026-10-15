import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Activity,
  ActivityData,
  ActivityKind,
  Expense,
  ExpenseCategory,
  Group,
  GroupType,
  ID,
  NotificationPrefs,
  Payment,
  Person,
  Settlement,
  SplitMethod,
  SplitShare,
  Workspace,
} from '@/domain/types';
import { toError } from './errors';
import { DB_SCHEMA, supabase } from './supabase';

// ───────────── Row shapes (snake_case, as stored in Postgres) ─────────────

export interface PersonRow {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  avatar_color: string;
  created_by: string | null;
  created_at: string;
}
export interface ProfileRow {
  user_id: string;
  person_id: string;
  phone: string | null;
  default_currency: string;
  notification_prefs: Partial<NotificationPrefs> | null;
}
interface FriendshipRow {
  owner_id: string;
  friend_id: string;
}
interface GroupRow {
  id: string;
  name: string;
  type: GroupType;
  currency: string;
  simplify_debts: boolean;
  created_by: string | null;
  created_at: string;
}
interface MemberRow {
  group_id: string;
  person_id: string;
}
export interface ExpenseRow {
  id: string;
  group_id: string | null;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  paid_by: Payment[];
  split_method: SplitMethod;
  splits: SplitShare[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
interface SettlementRow {
  id: string;
  group_id: string | null;
  from_id: string;
  to_id: string;
  amount: number;
  currency: string;
  date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}
export interface ActivityRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: ActivityKind;
  group_id: string | null;
  data: ActivityData | null;
  read: boolean;
  created_at: string;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  expenses: true,
  settlements: true,
  groups: true,
  friends: true,
  browser: false,
};

// ───────────── Mappers ─────────────

export const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  email: r.email ?? undefined,
  avatarColor: r.avatar_color,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

// Postgres bigint can arrive as a string; amounts are always safe integers in practice.
const num = (v: number | string) => Number(v);

export const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  groupId: r.group_id,
  description: r.description,
  amount: num(r.amount),
  currency: r.currency,
  category: r.category,
  date: r.date,
  paidBy: r.paid_by.map((p) => ({ personId: p.personId, amount: num(p.amount) })),
  splitMethod: r.split_method,
  splits: r.splits.map((s) => ({ personId: s.personId, amount: num(s.amount), input: s.input })),
  notes: r.notes ?? undefined,
  createdBy: r.created_by ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toSettlement = (r: SettlementRow): Settlement => ({
  id: r.id,
  groupId: r.group_id,
  fromId: r.from_id,
  toId: r.to_id,
  amount: num(r.amount),
  currency: r.currency,
  date: r.date,
  note: r.note ?? undefined,
  createdBy: r.created_by ?? '',
  createdAt: r.created_at,
});

export const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  kind: r.kind,
  actorId: r.actor_id,
  groupId: r.group_id,
  data: r.data ?? {},
  read: r.read,
  createdAt: r.created_at,
});

export interface Profile {
  userId: ID;
  personId: ID;
  phone?: string;
  defaultCurrency: string;
}

export interface Snapshot {
  profile: Profile;
  ws: Workspace;
}

// ───────────── Reads ─────────────

const PAGE = 1000;

/** Fetch every row the user can see, paging past PostgREST's per-request row limit. */
async function selectAll<T>(table: string, order: string, columns = '*'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw toError(error);
    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

export async function fetchSnapshot(userId: ID): Promise<Snapshot> {
  // Creates the Splitzy profile on first visit (the login may come from another app sharing the
  // project) and keeps the stored email in sync with auth.
  const ensured = await supabase.rpc('ensure_profile');
  if (ensured.error) throw toError(ensured.error);

  const [profileRes, persons, friendships, groups, members, expenses, settlements, activityRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single<ProfileRow>(),
      selectAll<PersonRow>('persons', 'created_at'),
      selectAll<FriendshipRow>('friendships', 'created_at', 'owner_id, friend_id'),
      selectAll<GroupRow>('groups', 'created_at'),
      selectAll<MemberRow>('group_members', 'created_at', 'group_id, person_id'),
      selectAll<ExpenseRow>('expenses', 'created_at'),
      selectAll<SettlementRow>('settlements', 'created_at'),
      supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(300),
    ]);
  if (profileRes.error) throw toError(profileRes.error);
  if (activityRes.error) throw toError(activityRes.error);
  const p = profileRes.data;
  const me = p.person_id;

  const membersByGroup = new Map<ID, ID[]>();
  for (const m of members)
    membersByGroup.set(m.group_id, [...(membersByGroup.get(m.group_id) ?? []), m.person_id]);

  const ws: Workspace = {
    people: Object.fromEntries(persons.map((r) => [r.id, toPerson(r)])),
    friendIds: friendships.filter((f) => f.owner_id === me).map((f) => f.friend_id),
    groups: Object.fromEntries(
      groups.map((g): [ID, Group] => [
        g.id,
        {
          id: g.id,
          name: g.name,
          type: g.type,
          currency: g.currency,
          simplifyDebts: g.simplify_debts,
          memberIds: membersByGroup.get(g.id) ?? [],
          createdBy: g.created_by ?? '',
          createdAt: g.created_at,
        },
      ]),
    ),
    expenses: Object.fromEntries(expenses.map((r) => [r.id, toExpense(r)])),
    settlements: Object.fromEntries(settlements.map((r) => [r.id, toSettlement(r)])),
    activity: (activityRes.data as ActivityRow[]).map(toActivity),
    prefs: { ...DEFAULT_PREFS, ...p.notification_prefs },
  };
  return {
    profile: {
      userId,
      personId: me,
      phone: p.phone ?? undefined,
      defaultCurrency: p.default_currency,
    },
    ws,
  };
}

// ───────────── Writes ─────────────

export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
export type SettlementDraft = Omit<Settlement, 'id' | 'createdAt' | 'createdBy'>;
export type GroupDraft = Pick<Group, 'name' | 'type' | 'currency' | 'memberIds' | 'simplifyDebts'>;

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toError(error);
  return data;
}

/** For writes whose result we don't need. */
async function exec(p: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await p;
  if (error) throw toError(error);
}

const expenseRow = (d: ExpenseDraft) => ({
  group_id: d.groupId,
  description: d.description,
  amount: d.amount,
  currency: d.currency,
  category: d.category,
  date: d.date,
  paid_by: d.paidBy,
  split_method: d.splitMethod,
  splits: d.splits,
  notes: d.notes ?? null,
});

export const api = {
  addFriend: (name: string, email: string | undefined, color: string) =>
    must(
      supabase.rpc('add_friend', { p_name: name, p_email: email ?? null, p_color: color }),
    ) as Promise<ID>,
  updatePerson: (id: ID, patch: { name?: string; email?: string | null; avatar_color?: string }) =>
    exec(supabase.from('persons').update(patch).eq('id', id)),
  removeFriend: (id: ID) => exec(supabase.rpc('remove_friend', { p_friend: id })),

  createGroup: (d: GroupDraft, me: ID) =>
    must(
      supabase.rpc('create_group', {
        p_name: d.name,
        p_type: d.type,
        p_currency: d.currency,
        p_simplify: d.simplifyDebts,
        p_member_ids: d.memberIds.filter((m) => m !== me),
      }),
    ) as Promise<ID>,
  updateGroup: (id: ID, d: Partial<GroupDraft>) =>
    exec(
      supabase
        .from('groups')
        .update({
          ...(d.name !== undefined && { name: d.name }),
          ...(d.type !== undefined && { type: d.type }),
          ...(d.currency !== undefined && { currency: d.currency }),
          ...(d.simplifyDebts !== undefined && { simplify_debts: d.simplifyDebts }),
        })
        .eq('id', id),
    ),
  deleteGroup: (id: ID) => exec(supabase.from('groups').delete().eq('id', id)),
  addGroupMember: (groupId: ID, personId: ID) =>
    exec(supabase.from('group_members').insert({ group_id: groupId, person_id: personId })),
  removeGroupMember: (groupId: ID, personId: ID) =>
    exec(supabase.from('group_members').delete().eq('group_id', groupId).eq('person_id', personId)),

  addExpense: async (d: ExpenseDraft): Promise<ID> => {
    const row = await must(
      supabase.from('expenses').insert(expenseRow(d)).select('id').single<{ id: string }>(),
    );
    if (!row) throw new Error('The expense was not saved.');
    return row.id;
  },
  updateExpense: (id: ID, d: ExpenseDraft) =>
    exec(supabase.from('expenses').update(expenseRow(d)).eq('id', id)),
  deleteExpense: (id: ID) => exec(supabase.from('expenses').delete().eq('id', id)),

  addSettlement: (d: SettlementDraft) =>
    exec(
      supabase.from('settlements').insert({
        group_id: d.groupId,
        from_id: d.fromId,
        to_id: d.toId,
        amount: d.amount,
        currency: d.currency,
        date: d.date,
        note: d.note ?? null,
      }),
    ),
  deleteSettlement: (id: ID) => exec(supabase.from('settlements').delete().eq('id', id)),

  sendReminder: (personId: ID) => exec(supabase.rpc('send_reminder', { p_person: personId })),

  markRead: (id: ID) => exec(supabase.from('activity').update({ read: true }).eq('id', id)),
  markAllRead: (userId: ID) =>
    exec(
      supabase.from('activity').update({ read: true }).eq('recipient_id', userId).eq('read', false),
    ),
  clearActivity: (userId: ID) =>
    exec(supabase.from('activity').delete().eq('recipient_id', userId)),

  updateProfile: (
    userId: ID,
    patch: {
      phone?: string | null;
      default_currency?: string;
      notification_prefs?: NotificationPrefs;
    },
  ) => exec(supabase.from('profiles').update(patch).eq('user_id', userId)),
  leaveSplitzy: () => exec(supabase.rpc('leave_splitzy')),
};

/** Push new activity rows for this user as they're created (RLS limits rows to the recipient). */
export type LiveStatus = 'connecting' | 'live' | 'down';

export function subscribeToActivity(
  userId: ID,
  onInsert: (a: Activity) => void,
  onStatus: (status: LiveStatus) => void = () => {},
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`activity:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: DB_SCHEMA,
        table: 'activity',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => onInsert(toActivity(payload.new as ActivityRow)),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus('live');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
        onStatus('down');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}
