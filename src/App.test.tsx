import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from './domain/types';

// The API layer is mocked: these tests cover UI wiring, the SQL is covered by supabase/schema.test.ts.
const { snapshot, api } = vi.hoisted(() => {
  const ts = '2026-10-01T00:00:00Z';
  const person = (id: string, name: string, userId: string | null) => ({
    id,
    userId,
    name,
    email: `${id}@example.com`,
    avatarColor: '#10b981',
    createdBy: null,
    createdAt: ts,
  });
  const ws: Workspace = {
    people: { me: person('me', 'Test User', 'u1'), amal: person('amal', 'Amal', 'u2') },
    friendIds: ['amal'],
    groups: {},
    expenses: {},
    settlements: {},
    activity: [
      {
        id: 'a1',
        kind: 'expense_added',
        actorId: 'amal',
        groupId: null,
        read: false,
        createdAt: ts,
        data: {
          actor_name: 'Amal',
          description: 'Coffee',
          amount: 1000,
          currency: 'LKR',
          net: -500,
          expense_id: 'x',
        },
      },
    ],
    prefs: { expenses: true, settlements: true, groups: true, friends: true, browser: false },
  };
  return {
    snapshot: { profile: { userId: 'u1', personId: 'me', defaultCurrency: 'LKR' }, ws },
    api: { addExpense: vi.fn(async () => 'new-expense'), markAllRead: vi.fn(async () => {}) },
  };
});

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  fetchSnapshot: vi.fn(async () => snapshot),
  subscribeToActivity: vi.fn(() => () => {}),
  api,
}));

const { default: App } = await import('./App');
const { useAuthStore } = await import('./stores/authStore');

describe('signed-in app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshot.ws.groups = {};
    localStorage.clear();
    useAuthStore.setState({
      status: 'signedIn',
      session: { user: { id: 'u1', email: 'me@example.com' } } as Session,
    });
  });

  it('loads the workspace and shows notifications from activity data', async () => {
    render(<App />);
    expect(await screen.findByText(/Hi, Test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Notifications, 1 unread/ }));
    expect(screen.getAllByText(/Amal added “Coffee”/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/You owe/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    await waitFor(() => expect(api.markAllRead).toHaveBeenCalledWith('u1'));
  });

  it('sends a shares split to the API', async () => {
    render(<App />);
    await screen.findByText(/Hi, Test/);
    fireEvent.click(screen.getAllByRole('button', { name: /Add expense/ })[0]!);
    const d = within(await screen.findByRole('dialog'));
    fireEvent.click(d.getByRole('button', { name: /Amal/ }));
    fireEvent.change(d.getByLabelText('Description'), { target: { value: 'Lunch' } });
    fireEvent.change(d.getByLabelText('Amount'), { target: { value: '900' } });
    fireEvent.click(d.getByRole('radio', { name: 'Shares' }));
    fireEvent.change(d.getByLabelText('Amal shares'), { target: { value: '2' } });
    fireEvent.click(d.getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(api.addExpense).toHaveBeenCalledTimes(1));
    expect(api.addExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: null,
        description: 'Lunch',
        amount: 90000,
        splitMethod: 'shares',
        paidBy: [{ personId: 'me', amount: 90000 }],
        splits: [
          { personId: 'me', amount: 30000, input: 1 },
          { personId: 'amal', amount: 60000, input: 2 },
        ],
      }),
    );
  });

  it('offers creating a group first from the floating button when there are no groups', async () => {
    render(<App />);
    await screen.findByText(/Hi, Test/);
    fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    const actions = within(screen.getByRole('list', { name: 'Quick actions' })).getAllByRole(
      'button',
    );
    expect(actions.map((b) => b.textContent)).toEqual([
      'New group',
      'Add expense',
      'Settle up',
      'Add friend',
    ]);
    fireEvent.click(actions[0]!);
    expect(await screen.findByRole('dialog', { name: /Create a group/ })).toBeInTheDocument();
  });

  it('adds an expense to the preselected group with its members', async () => {
    snapshot.ws.groups = {
      g1: {
        id: 'g1',
        name: 'Flat',
        type: 'home',
        currency: 'USD',
        memberIds: ['me', 'amal'],
        simplifyDebts: true,
        createdBy: 'me',
        createdAt: '2026-10-01T00:00:00Z',
      },
    };
    render(<App />);
    await screen.findByText(/Hi, Test/);
    fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    const quick = within(screen.getByRole('list', { name: 'Quick actions' }));
    fireEvent.click(quick.getByRole('button', { name: 'Add expense' }));
    const d = within(await screen.findByRole('dialog', { name: /Add an expense/ }));
    expect(d.getByRole('radio', { name: /Flat/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(d.getByLabelText('Description'), { target: { value: 'Groceries' } });
    fireEvent.change(d.getByLabelText('Amount (USD)'), { target: { value: '10' } });
    fireEvent.click(d.getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(api.addExpense).toHaveBeenCalledTimes(1));
    expect(api.addExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'g1',
        currency: 'USD',
        amount: 1000,
        splits: [
          { personId: 'me', amount: 500 },
          { personId: 'amal', amount: 500 },
        ],
      }),
    );
  });
});
