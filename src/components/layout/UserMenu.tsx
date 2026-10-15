import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount } from '@/hooks/useWorkspace';
import { Download, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { useInstallStore } from '@/stores/installStore';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';

const modes: { id: ThemeMode; icon: typeof Sun; label: string }[] = [
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'system', icon: Monitor, label: 'System' },
];

export function UserMenu() {
  const account = useCurrentAccount();
  const logOut = useAuthStore((s) => s.logOut);
  const { mode, setMode } = useThemeStore();
  const [open, setOpen] = useState(false);
  const canInstall = useInstallStore((s) => s.deferred !== null);
  const promptInstall = useInstallStore((s) => s.promptInstall);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!account) return null;
  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Avatar name={account.name} color={account.avatarColor} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-border bg-surface p-2 shadow-xl">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold">{account.name}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
          <div
            className="my-1 flex gap-1 rounded-lg bg-surface-2 p-1"
            role="radiogroup"
            aria-label="Theme"
          >
            {modes.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                role="radio"
                aria-checked={mode === id}
                aria-label={label}
                title={label}
                onClick={() => setMode(id)}
                className={cn(
                  'flex flex-1 justify-center rounded-md py-1.5',
                  mode === id ? 'bg-surface text-fg shadow-sm' : 'text-muted',
                )}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
          >
            <Settings size={16} /> Settings
          </Link>
          {canInstall && (
            <button
              onClick={() => {
                setOpen(false);
                void promptInstall();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
            >
              <Download size={16} /> Install app
            </button>
          )}
          <button
            onClick={logOut}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-danger hover:bg-surface-2"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
