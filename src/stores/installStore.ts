import { create } from 'zustand';

/** Chromium's install prompt event (not in the standard DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Saved prompt; only Chromium browsers (Chrome, Edge, Samsung Internet, Android) provide one. */
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  promptInstall: () => Promise<boolean>;
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad Safari has no install prompt; users add the app from the Share menu. */
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export const useInstallStore = create<InstallState>()((set, get) => ({
  deferred: null,
  installed: false,
  async promptInstall() {
    const event = get().deferred;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt can only be used once.
    set({ deferred: null, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
}));

/** Must run before first render: browsers fire `beforeinstallprompt` early in page load. */
export function listenForInstallPrompt() {
  useInstallStore.setState({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    useInstallStore.setState({ deferred: null, installed: true }),
  );
}
