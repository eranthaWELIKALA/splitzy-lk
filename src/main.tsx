import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PwaUpdater } from './components/PwaUpdater';
import { SetupNotice } from './components/SetupNotice';
import { dismissSplashWhenReady } from './lib/splash';
import { isSupabaseConfigured } from './lib/supabase';
import { useAuthStore } from './stores/authStore';
import { useDataStore } from './stores/dataStore';
import { listenForInstallPrompt } from './stores/installStore';
import './index.css';

// Subscribe to auth before rendering so the PKCE code exchange and recovery events are observed.
if (isSupabaseConfigured) useAuthStore.getState().init();
listenForInstallPrompt();

/** Resolves once the first screen has what it needs: the sign-in restored and, if signed in, data loaded. */
function appReady(): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();
  const isReady = () => {
    const { status } = useAuthStore.getState();
    if (status === 'loading') return false;
    if (status === 'signedOut') return true;
    const data = useDataStore.getState().status;
    return data === 'ready' || data === 'error';
  };
  return new Promise((resolve) => {
    if (isReady()) return resolve();
    const check = () => {
      if (!isReady()) return;
      unsubAuth();
      unsubData();
      resolve();
    };
    const unsubAuth = useAuthStore.subscribe(check);
    const unsubData = useDataStore.subscribe(check);
  });
}

dismissSplashWhenReady(appReady());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isSupabaseConfigured ? <App /> : <SetupNotice />}</Suspense>
    <PwaUpdater />
  </StrictMode>,
);
