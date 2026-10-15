import { formatMoney } from '@/lib/money';
import type { Activity, ActivityKind, ID, NotificationPrefs } from './types';

export interface ActivityView {
  title: string;
  body?: string;
  link?: string;
}

export function prefKey(kind: ActivityKind): keyof NotificationPrefs {
  if (kind.startsWith('expense')) return 'expenses';
  if (kind.startsWith('settlement')) return 'settlements';
  if (kind.startsWith('group') || kind.startsWith('member')) return 'groups';
  return 'friends';
}

export const isMuted = (a: Activity, prefs: NotificationPrefs) => !prefs[prefKey(a.kind)];

/** Turn a stored activity row into text from the recipient's point of view. */
export function describeActivity(a: Activity, me: ID): ActivityView {
  const d = a.data;
  const byMe = a.actorId === me;
  const actor = byMe ? 'You' : (d.actor_name ?? 'Someone');
  const money = d.amount !== undefined && d.currency ? formatMoney(d.amount, d.currency) : '';
  const inGroup = d.group_name ? ` in “${d.group_name}”` : '';
  const who = (id: ID | undefined, name: string | undefined, subject = false) =>
    id === me ? (subject ? 'You' : 'you') : (name ?? 'someone');
  const groupLink = a.groupId ? `/groups/${a.groupId}` : undefined;

  switch (a.kind) {
    case 'expense_added':
    case 'expense_updated':
    case 'expense_deleted': {
      const verb = {
        expense_added: 'added',
        expense_updated: 'updated',
        expense_deleted: 'deleted',
      }[a.kind];
      const net = d.net ?? 0;
      const body =
        a.kind === 'expense_deleted' || net === 0 || !d.currency
          ? undefined
          : net > 0
            ? `You get back ${formatMoney(net, d.currency)}`
            : `You owe ${formatMoney(-net, d.currency)}`;
      return {
        title: `${actor} ${verb} “${d.description ?? 'an expense'}”${money ? ` (${money})` : ''}${inGroup}`,
        body,
        link: a.kind === 'expense_deleted' ? groupLink : `/expenses/${d.expense_id}`,
      };
    }
    case 'settlement_added':
    case 'settlement_deleted': {
      const from = who(d.from_id, d.from_name, true);
      const to = who(d.to_id, d.to_name);
      const other = d.from_id === me ? d.to_id : d.from_id;
      return a.kind === 'settlement_added'
        ? {
            title: `${from} paid ${to} ${money}`,
            body: d.note || (inGroup ? `Recorded${inGroup}` : undefined),
            link: groupLink ?? `/friends/${other}`,
          }
        : {
            title: `${actor} deleted a payment of ${money} from ${who(d.from_id, d.from_name)}`,
            link: groupLink,
          };
    }
    case 'group_created':
      return {
        title: byMe ? `You created “${d.group_name}”` : `${actor} added you to “${d.group_name}”`,
        link: groupLink,
      };
    case 'group_updated':
      return { title: `${actor} updated “${d.group_name}”`, link: groupLink };
    case 'group_deleted':
      return { title: `${actor} deleted “${d.group_name}”` };
    case 'member_added':
      return {
        title: `${actor} added ${who(d.target_id, d.target_name)} to “${d.group_name}”`,
        link: groupLink,
      };
    case 'member_removed':
      return {
        title: `${actor} removed ${who(d.target_id, d.target_name)} from “${d.group_name}”`,
        link: d.target_id === me ? undefined : groupLink,
      };
    case 'friend_added':
      return byMe
        ? { title: `You added ${d.target_name} as a friend`, link: `/friends/${d.target_id}` }
        : {
            title: `${actor} added you as a friend`,
            link: a.actorId ? `/friends/${a.actorId}` : undefined,
          };
    case 'reminder_sent':
      return byMe
        ? { title: `You reminded ${d.target_name} to settle up`, link: `/friends/${d.target_id}` }
        : {
            title: `${actor} reminded you to settle up`,
            body: 'Open your balance to pay them back.',
            link: a.actorId ? `/friends/${a.actorId}` : undefined,
          };
  }
}
