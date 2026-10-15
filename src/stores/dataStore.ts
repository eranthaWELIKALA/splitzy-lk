import { create } from 'zustand';
import { describeActivity, isMuted } from '@/domain/activity';
import { groupDebts } from '@/domain/balances';
import type { ID, NotificationPrefs, Workspace } from '@/domain/types';
import {
  api,
  DEFAULT_PREFS,
  fetchSnapshot,
  subscribeToActivity,
  type ExpenseDraft,
  type GroupDraft,
  type Profile,
  type SettlementDraft,
  type LiveStatus,
} from '@/lib/api';
import { pickColor } from '@/lib/colors';
import { errorMessage } from '@/lib/errors';

export type { ExpenseDraft, GroupDraft, SettlementDraft } from '@/lib/api';

export const EMPTY_WORKSPACE: Workspace = {
  people: {},
  friendIds: [],
  groups: {},
  expenses: {},
  settlements: {},
  activity: [],
  prefs: DEFAULT_PREFS,
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface DataState {
  status: Status;
  error: string | null;
  userId: ID | null;
  /** The signed-in user's person id. */
  me: ID;
  profile: Profile | null;
  ws: Workspace;
  /** A load is in flight (initial or background refresh). */
  syncing: boolean;
  /** Realtime connection used for live notifications. */
  live: LiveStatus;

  load: () => Promise<void>;
  /** Start syncing for a user: initial load, realtime updates and refresh on focus. */
  connect: (userId: ID) => () => void;

  addFriend: (input: { name: string; email?: string }) => Promise<ID>;
  updatePerson: (id: ID, patch: { name?: string; email?: string }) => Promise<void>;
  removeFriend: (id: ID) => Promise<void>;
  createGroup: (draft: GroupDraft) => Promise<ID>;
  updateGroup: (id: ID, patch: Partial<GroupDraft>) => Promise<void>;
  deleteGroup: (id: ID) => Promise<void>;
  addGroupMember: (groupId: ID, personId: ID) => Promise<void>;
  removeGroupMember: (groupId: ID, personId: ID) => Promise<void>;
  addExpense: (draft: ExpenseDraft) => Promise<ID>;
  updateExpense: (id: ID, draft: ExpenseDraft) => Promise<void>;
  deleteExpense: (id: ID) => Promise<void>;
  addSettlement: (draft: SettlementDraft) => Promise<void>;
  deleteSettlement: (id: ID) => Promise<void>;
  sendReminder: (personId: ID) => Promise<void>;
  markRead: (id: ID) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearActivity: () => Promise<void>;
  setPrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    avatarColor?: string;
    phone?: string;
    defaultCurrency?: string;
  }) => Promise<void>;
}

function showBrowserNotification(title: string, body?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
      tag: 'splitzy',
    });
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

export const useDataStore = create<DataState>()((set, get) => {
  let loadSeq = 0;

  const uid = () => {
    const id = get().userId;
    if (!id) throw new Error('Not signed in.');
    return id;
  };

  /** Run a write, then refresh so derived balances reflect the server's state. */
  const write = async <T>(fn: () => Promise<T>): Promise<T> => {
    const result = await fn();
    await get().load();
    return result;
  };

  const patchWs = (fn: (ws: Workspace) => Workspace) => set((s) => ({ ws: fn(s.ws) }));

  return {
    status: 'idle',
    error: null,
    userId: null,
    me: '',
    profile: null,
    ws: EMPTY_WORKSPACE,
    syncing: false,
    live: 'connecting',

    async load() {
      const userId = get().userId;
      if (!userId) return;
      const seq = ++loadSeq;
      set(
        get().status === 'ready'
          ? { syncing: true }
          : { status: 'loading', error: null, syncing: true },
      );
      try {
        const { profile, ws } = await fetchSnapshot(userId);
        // Ignore stale responses and responses for a user who has since signed out.
        if (seq !== loadSeq || get().userId !== userId) return;
        set({ status: 'ready', error: null, profile, me: profile.personId, ws, syncing: false });
      } catch (e) {
        if (seq !== loadSeq) return;
        set({ syncing: false });
        // Keep showing existing data if a background refresh fails.
        if (get().status === 'ready') return;
        set({ status: 'error', error: errorMessage(e) });
      }
    },

    connect(userId) {
      set({
        userId,
        status: 'loading',
        error: null,
        ws: EMPTY_WORKSPACE,
        profile: null,
        me: '',
        live: 'connecting',
      });
      void get().load();

      let timer: ReturnType<typeof setTimeout> | undefined;
      const refreshSoon = () => {
        clearTimeout(timer);
        timer = setTimeout(() => void get().load(), 250);
      };

      const unsubscribe = subscribeToActivity(
        userId,
        (a) => {
          const { me, ws } = get();
          if (a.actorId !== me && ws.prefs.browser && !isMuted(a, ws.prefs)) {
            const view = describeActivity(a, me);
            showBrowserNotification(view.title, view.body);
          }
          refreshSoon();
        },
        (live) => set({ live }),
      );
      const onVisible = () => document.visibilityState === 'visible' && refreshSoon();
      document.addEventListener('visibilitychange', onVisible);
      // Catch up on anything missed while the device was offline.
      window.addEventListener('online', refreshSoon);

      return () => {
        clearTimeout(timer);
        unsubscribe();
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', refreshSoon);
        loadSeq++;
        set({ userId: null, status: 'idle', ws: EMPTY_WORKSPACE, profile: null, me: '' });
      };
    },

    addFriend: ({ name, email }) =>
      write(() =>
        api.addFriend(
          name.trim(),
          email?.trim().toLowerCase() || undefined,
          pickColor(email || name),
        ),
      ),

    updatePerson: (id, patch) =>
      write(() =>
        api.updatePerson(id, {
          ...(patch.name !== undefined && { name: patch.name.trim() }),
          ...(patch.email !== undefined && { email: patch.email.trim().toLowerCase() || null }),
        }),
      ),

    async removeFriend(id) {
      const { ws } = get();
      const inUse =
        Object.values(ws.groups).some(
          (g) => g.memberIds.includes(id) && g.memberIds.includes(get().me),
        ) ||
        Object.values(ws.expenses).some(
          (e) => e.paidBy.some((p) => p.personId === id) || e.splits.some((s) => s.personId === id),
        ) ||
        Object.values(ws.settlements).some((s) => s.fromId === id || s.toId === id);
      if (inUse)
        throw new Error('You share a group or expenses with this friend. Remove those first.');
      await write(() => api.removeFriend(id));
    },

    createGroup: (draft) => write(() => api.createGroup(draft, get().me)),
    updateGroup: (id, patch) => write(() => api.updateGroup(id, patch)),
    deleteGroup: (id) => write(() => api.deleteGroup(id)),
    addGroupMember: (groupId, personId) => write(() => api.addGroupMember(groupId, personId)),

    async removeGroupMember(groupId, personId) {
      const { ws } = get();
      const g = ws.groups[groupId];
      if (!g) throw new Error('Group not found.');
      const debts = groupDebts(
        Object.values(ws.expenses).filter((e) => e.groupId === groupId),
        Object.values(ws.settlements).filter((s) => s.groupId === groupId),
        g.simplifyDebts,
      );
      if (debts.some((d) => d.from === personId || d.to === personId))
        throw new Error('Settle this member’s balance before removing them.');
      await write(() => api.removeGroupMember(groupId, personId));
    },

    addExpense: (draft) => write(() => api.addExpense(draft)),
    updateExpense: (id, draft) => write(() => api.updateExpense(id, draft)),
    deleteExpense: (id) => write(() => api.deleteExpense(id)),
    addSettlement: (draft) => write(() => api.addSettlement(draft)),
    deleteSettlement: (id) => write(() => api.deleteSettlement(id)),
    sendReminder: (personId) => write(() => api.sendReminder(personId)),

    // Read-state changes are applied optimistically; nothing else depends on them.
    async markRead(id) {
      if (get().ws.activity.find((a) => a.id === id)?.read) return;
      patchWs((ws) => ({
        ...ws,
        activity: ws.activity.map((a) => (a.id === id ? { ...a, read: true } : a)),
      }));
      await api.markRead(id);
    },
    async markAllRead() {
      patchWs((ws) => ({
        ...ws,
        activity: ws.activity.map((a) => (a.read ? a : { ...a, read: true })),
      }));
      await api.markAllRead(uid());
    },
    async clearActivity() {
      patchWs((ws) => ({ ...ws, activity: [] }));
      await api.clearActivity(uid());
    },
    async setPrefs(patch) {
      const prefs = { ...get().ws.prefs, ...patch };
      patchWs((ws) => ({ ...ws, prefs }));
      await api.updateProfile(uid(), { notification_prefs: prefs });
    },

    updateProfile: ({ name, avatarColor, phone, defaultCurrency }) =>
      write(async () => {
        const { me } = get();
        if (name !== undefined && !name.trim()) throw new Error('Name is required.');
        if (name !== undefined || avatarColor !== undefined)
          await api.updatePerson(me, {
            ...(name !== undefined && { name: name.trim() }),
            ...(avatarColor && { avatar_color: avatarColor }),
          });
        if (phone !== undefined || defaultCurrency !== undefined)
          await api.updateProfile(uid(), {
            ...(phone !== undefined && { phone: phone.trim() || null }),
            ...(defaultCurrency && { default_currency: defaultCurrency }),
          });
      }),
  };
});
