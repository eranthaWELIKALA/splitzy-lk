import { Cloud, CloudOff, Monitor, Moon, RefreshCw, Sun, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { cn } from '@/lib/cn';
import { useDataStore } from '@/stores/dataStore';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';

/** Connection / sync indicator. Tapping it refreshes data. */
export function SyncStatus() {
  const online = useOnline();
  const syncing = useDataStore((s) => s.syncing);
  const live = useDataStore((s) => s.live);
  const load = useDataStore((s) => s.load);

  const state = !online
    ? {
        icon: WifiOff,
        label: 'Offline',
        hint: 'You’re offline. Showing the last loaded data.',
        tone: 'text-danger',
        dot: 'bg-danger',
      }
    : syncing
      ? {
          icon: RefreshCw,
          label: 'Syncing',
          hint: 'Syncing with the server…',
          tone: 'text-primary',
          dot: 'bg-primary',
          spin: true,
        }
      : live === 'live'
        ? {
            icon: Cloud,
            label: 'Live',
            hint: 'Up to date. Changes from friends appear instantly.',
            tone: 'text-positive',
            dot: 'bg-positive',
          }
        : live === 'connecting'
          ? {
              icon: Cloud,
              label: 'Connecting',
              hint: 'Connecting for live updates…',
              tone: 'text-muted',
              dot: 'bg-muted',
            }
          : {
              icon: CloudOff,
              label: 'Paused',
              hint: 'Live updates paused. Tap to refresh.',
              tone: 'text-negative',
              dot: 'bg-negative',
            };
  const Icon = state.icon;

  return (
    <button
      type="button"
      onClick={() => online && void load()}
      title={state.hint}
      aria-label={`${state.label}. ${state.hint}`}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition hover:bg-surface-2',
        state.tone,
      )}
    >
      <span className="relative">
        <Icon size={18} className={cn(state.spin && 'animate-spin')} />
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ring-2 ring-surface',
            state.dot,
          )}
        />
      </span>
      <span className="hidden sm:inline">{state.label}</span>
    </button>
  );
}

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
const ICON = { light: Sun, dark: Moon, system: Monitor };

/** One-tap theme switch: light → dark → system. */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const Icon = ICON[mode];
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      title={`Theme: ${mode}. Switch to ${NEXT[mode]}.`}
      aria-label={`Theme: ${mode}. Switch to ${NEXT[mode]}.`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
    >
      <Icon size={18} />
    </button>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-danger/10 px-4 py-1.5 text-xs font-medium text-danger"
    >
      <WifiOff size={14} /> You’re offline — showing your last loaded balances. Changes will save
      once you reconnect.
    </div>
  );
}
