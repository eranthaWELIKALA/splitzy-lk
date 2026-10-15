import { Bell, HandCoins, Receipt, Trash2, UserPlus, Users } from 'lucide-react';
import type { ActivityKind } from '@/domain/types';
import { cn } from '@/lib/cn';

export function ActivityIcon({ kind, className }: { kind: ActivityKind; className?: string }) {
  const Icon = kind.endsWith('deleted')
    ? Trash2
    : kind.startsWith('expense')
      ? Receipt
      : kind.startsWith('settlement')
        ? HandCoins
        : kind.startsWith('group') || kind.startsWith('member')
          ? Users
          : kind === 'friend_added'
            ? UserPlus
            : Bell;
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted',
        className,
      )}
    >
      <Icon size={16} />
    </span>
  );
}
