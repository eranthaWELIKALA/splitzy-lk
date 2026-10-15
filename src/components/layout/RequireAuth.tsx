import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';

/** Matches the launch splash (styles in index.html), so a slow load continues seamlessly after it. */
export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-2.5"
      role="status"
      aria-live="polite"
    >
      <img
        src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
        alt=""
        className="splash-icon"
        width={88}
        height={88}
      />
      <div className="splash-loader" aria-hidden>
        <span />
      </div>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

/** Gate for signed-in routes: syncs the user's data and handles password-recovery sessions. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const recovery = useAuthStore((s) => s.recovery);
  const userId = useUserId();
  const location = useLocation();
  const connect = useDataStore((s) => s.connect);
  const dataStatus = useDataStore((s) => s.status);
  const dataError = useDataStore((s) => s.error);
  const load = useDataStore((s) => s.load);

  useEffect(() => (userId ? connect(userId) : undefined), [userId, connect]);

  if (status === 'loading') return <FullPageSpinner />;
  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (recovery && location.pathname !== '/reset-password')
    return <Navigate to="/reset-password" replace />;
  if (dataStatus === 'error')
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="font-semibold">Couldn’t load your data</h1>
          <p className="mt-2 text-sm text-muted">{dataError}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => void useAuthStore.getState().logOut()}>
              Log out
            </Button>
            <Button onClick={() => void load()}>Try again</Button>
          </div>
        </div>
      </div>
    );
  if (dataStatus !== 'ready') return <FullPageSpinner label="Loading your balances…" />;
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const status = useAuthStore((s) => s.status);
  const userId = useUserId();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (status === 'loading') return <FullPageSpinner />;
  return userId ? <Navigate to={from} replace /> : <Outlet />;
}
