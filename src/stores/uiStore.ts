import { create } from 'zustand';
import type { ID } from '@/domain/types';

export interface ExpenseModalState {
  expenseId?: ID;
  groupId?: ID | null;
  friendId?: ID;
}

export interface SettleModalState {
  groupId?: ID | null;
  personId?: ID;
}

export interface GroupModalState {
  /** Return to "Add expense" in the new group once it's created. */
  thenAddExpense?: boolean;
}

interface UiState {
  expenseModal: ExpenseModalState | null;
  settleModal: SettleModalState | null;
  groupModal: GroupModalState | null;
  friendModal: boolean;
  openExpense: (s?: ExpenseModalState) => void;
  openSettle: (s?: SettleModalState) => void;
  openCreateGroup: (s?: GroupModalState) => void;
  openAddFriend: () => void;
  closeModals: () => void;
}

const closed = { expenseModal: null, settleModal: null, groupModal: null, friendModal: false };

// Only one app-wide dialog is open at a time.
export const useUiStore = create<UiState>()((set) => ({
  ...closed,
  openExpense: (s = {}) => set({ ...closed, expenseModal: s }),
  openSettle: (s = {}) => set({ ...closed, settleModal: s }),
  openCreateGroup: (s = {}) => set({ ...closed, groupModal: s }),
  openAddFriend: () => set({ ...closed, friendModal: true }),
  closeModals: () => set(closed),
}));
