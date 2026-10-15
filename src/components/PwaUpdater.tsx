import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';

const HOUR = 60 * 60 * 1000;

/** Registers the service worker and offers to reload when a new version has been deployed. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Installed apps can stay open for days; check for new deploys periodically.
      if (registration) setInterval(() => void registration.update(), HOUR);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast('Splitzy can now open without a connection', 'info');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg md:bottom-6"
    >
      <RefreshCw size={18} className="shrink-0 text-primary" />
      <span className="flex-1">A new version of Splitzy is available.</span>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}
