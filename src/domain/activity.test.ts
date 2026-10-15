import { describe, expect, it } from 'vitest';
import { describeActivity, isMuted } from './activity';
import type { Activity } from './types';

const base = { id: 'a', read: false, createdAt: '', groupId: 'g1' };
const prefs = { expenses: true, settlements: false, groups: true, friends: true, browser: false };

describe('describeActivity', () => {
  it('describes expenses from the recipient’s perspective', () => {
    const a: Activity = {
      ...base,
      kind: 'expense_added',
      actorId: 'kasun',
      data: {
        actor_name: 'Kasun',
        description: 'Dinner',
        amount: 1000,
        currency: 'USD',
        group_name: 'Trip',
        net: -500,
        expense_id: 'e1',
      },
    };
    const view = describeActivity(a, 'me');
    expect(view.title).toMatch(/^Kasun added “Dinner” \(.*10\.00\) in “Trip”$/);
    expect(view.body).toMatch(/^You owe .*5\.00$/);
    expect(view.link).toBe('/expenses/e1');
    expect(describeActivity({ ...a, actorId: 'me' }, 'me').title).toMatch(/^You added/);
  });

  it('describes payments with you/name substitution', () => {
    const a: Activity = {
      ...base,
      groupId: null,
      kind: 'settlement_added',
      actorId: 'me',
      data: {
        amount: 500,
        currency: 'USD',
        from_id: 'me',
        from_name: 'Me',
        to_id: 'bob',
        to_name: 'Bob',
      },
    };
    expect(describeActivity(a, 'me')).toMatchObject({
      title: expect.stringMatching(/^You paid Bob /),
      link: '/friends/bob',
    });
    expect(describeActivity(a, 'bob').title).toMatch(/^Me paid you /);
  });

  it('describes friend additions differently for each side', () => {
    const a: Activity = {
      ...base,
      kind: 'friend_added',
      actorId: 'kasun',
      data: { actor_name: 'Kasun', target_id: 'me', target_name: 'Me' },
    };
    expect(describeActivity(a, 'me').title).toBe('Kasun added you as a friend');
    expect(describeActivity(a, 'kasun').title).toBe('You added Me as a friend');
  });

  it('respects muted categories', () => {
    const a: Activity = { ...base, kind: 'settlement_added', actorId: 'x', data: {} };
    expect(isMuted(a, prefs)).toBe(true);
    expect(isMuted({ ...a, kind: 'expense_added' }, prefs)).toBe(false);
  });
});
