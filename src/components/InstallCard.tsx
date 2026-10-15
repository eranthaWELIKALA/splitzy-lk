import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { isIos, useInstallStore } from '@/stores/installStore';
import { toast } from '@/stores/toastStore';

/** Explains how to install Splitzy for whichever browser the user is on. */
export function InstallCard() {
  const deferred = useInstallStore((s) => s.deferred);
  const installed = useInstallStore((s) => s.installed);
  const promptInstall = useInstallStore((s) => s.promptInstall);

  if (installed)
    return (
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle2 size={18} className="text-positive" /> Splitzy is installed on this device.
      </p>
    );

  if (deferred)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted">
          Open Splitzy from your home screen or dock, full screen and offline-ready.
        </p>
        <Button onClick={async () => (await promptInstall()) && toast('Splitzy installed')}>
          <Download size={16} /> Install app
        </Button>
      </div>
    );

  if (isIos())
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          1. Tap <Share size={16} aria-label="Share" className="text-primary" />{' '}
          <strong>Share</strong> in Safari’s toolbar.
        </li>
        <li className="flex items-center gap-2">
          2. Choose <SquarePlus size={16} aria-hidden className="text-primary" />{' '}
          <strong>Add to Home Screen</strong>.
        </li>
      </ol>
    );

  return (
    <p className="text-sm text-muted">
      Use your browser’s menu and choose <strong>Install Splitzy</strong> or{' '}
      <strong>Add to Home screen</strong>. If you don’t see it, try Chrome, Edge or Safari.
    </p>
  );
}
