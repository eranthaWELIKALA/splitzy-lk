import { Suspense } from 'react';
import { Activity, LayoutDashboard, Plus, Settings, Users, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import { useWorkspace } from '@/hooks/useWorkspace';
import { groupTypeMeta } from '@/domain/categories';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/uiStore';
import { FloatingActions } from './FloatingActions';
import { GlobalModals } from './GlobalModals';
import { NotificationBell } from './NotificationBell';
import { OfflineBanner, SyncStatus, ThemeToggle } from './StatusIcons';
import { UserMenu } from './UserMenu';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/friends', label: 'Friends', icon: UserRound },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
  );

export function AppShell() {
  const ws = useWorkspace();
  const openCreateGroup = useUiStore((s) => s.openCreateGroup);
  const groups = Object.values(ws.groups).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav aria-label="Main" className="space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
          <div className="flex items-center justify-between pr-1 pb-2 pl-3">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
              Your groups
            </p>
            <button
              type="button"
              onClick={() => openCreateGroup()}
              aria-label="New group"
              title="New group"
              className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-primary"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-0.5">
            {groups.map((g) => (
              <NavLink key={g.id} to={`/groups/${g.id}`} className={linkClass}>
                <span aria-hidden>{groupTypeMeta(g.type).emoji}</span>
                <span className="truncate">{g.name}</span>
              </NavLink>
            ))}
            {groups.length === 0 && (
              <button
                type="button"
                onClick={() => openCreateGroup()}
                className="mx-3 w-[calc(100%-1.5rem)] rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted hover:border-primary hover:text-primary"
              >
                Create your first group →
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center pt-[env(safe-area-inset-top)] gap-2 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-8">
          <div className="md:hidden">
            <Logo compact />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <SyncStatus />
            <ThemeToggle />
            <NotificationBell />
            <span className="ml-1">
              <UserMenu />
            </span>
          </div>
        </header>
        <OfflineBanner />

        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-40 md:px-8 md:pb-28"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] border-t border-border bg-surface/95 backdrop-blur md:hidden"
      >
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                isActive ? 'text-primary' : 'text-muted',
              )
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      <FloatingActions />
      <GlobalModals />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy>
      <div className="h-8 w-48 rounded bg-surface-2" />
      <div className="h-32 rounded-2xl bg-surface-2" />
      <div className="h-64 rounded-2xl bg-surface-2" />
    </div>
  );
}
