import { useEffect, useRef, useState } from 'react';
import { HandCoins, Plus, Receipt, UserPlus, Users } from 'lucide-react';
import { useMatch } from 'react-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/uiStore';

/**
 * Speed-dial floating action button. Actions follow the current page: inside a group they target
 * that group; on a friend's page they target that friend.
 */
export function FloatingActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ws = useWorkspace();
  const { openExpense, openSettle, openCreateGroup, openAddFriend } = useUiStore();
  const groupMatch = useMatch('/groups/:groupId');
  const friendMatch = useMatch('/friends/:friendId');
  const onSettings = useMatch('/settings');
  const groupId = groupMatch?.params.groupId;
  const friendId = friendMatch?.params.friendId;
  const hasGroups = Object.keys(ws.groups).length > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('[data-action]')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (onSettings) return null;

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const actions = [
    {
      key: 'expense',
      label:
        groupId && ws.groups[groupId] ? `Add expense to ${ws.groups[groupId].name}` : 'Add expense',
      icon: Receipt,
      onClick: run(() => openExpense(groupId ? { groupId } : friendId ? { friendId } : {})),
    },
    {
      key: 'settle',
      label: 'Settle up',
      icon: HandCoins,
      onClick: run(() =>
        openSettle(groupId ? { groupId } : friendId ? { personId: friendId } : {}),
      ),
    },
    { key: 'group', label: 'New group', icon: Users, onClick: run(() => openCreateGroup()) },
    { key: 'friend', label: 'Add friend', icon: UserPlus, onClick: run(() => openAddFriend()) },
  ];
  // Until there's a group, creating one is the natural first step.
  if (!hasGroups) actions.unshift(...actions.splice(2, 1));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-bg/60 backdrop-blur-[2px]"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
      <div
        ref={ref}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 md:right-8 md:bottom-8"
      >
        {open && (
          <ul
            id="quick-actions"
            // Logical order in the DOM (for focus and screen readers); first item sits nearest the button.
            className="flex flex-col-reverse items-end gap-2.5"
            aria-label="Quick actions"
          >
            {actions.map(({ key, label, icon: Icon, onClick }, i) => (
              <li
                key={key}
                className="animate-[fab-in_160ms_ease-out_both]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <button
                  type="button"
                  data-action
                  onClick={onClick}
                  className="group flex items-center gap-3 focus-visible:outline-none"
                >
                  <span className="max-w-60 truncate rounded-lg bg-surface px-3 py-1.5 text-sm font-medium shadow-md ring-1 ring-border group-focus-visible:ring-2 group-focus-visible:ring-primary">
                    {label}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-primary shadow-md ring-1 ring-border transition group-hover:bg-primary-soft">
                    <Icon size={20} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-label={open ? 'Close quick actions' : 'Quick actions'}
          aria-expanded={open}
          aria-controls="quick-actions"
          onClick={() => setOpen((o) => !o)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-lg shadow-primary/30 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
        >
          <Plus
            size={26}
            className={cn('transition-transform duration-200', open && 'rotate-45')}
          />
        </button>
      </div>
    </>
  );
}
