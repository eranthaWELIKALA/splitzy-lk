const MIN_MS = 900; // long enough not to flash
const MAX_MS = 3000; // a slow network never holds the app back longer than this
const FADE_MS = 350;

/**
 * Fade out the static launch splash from index.html once `ready` settles — after at least
 * MIN_MS from page start, at most MAX_MS. A tap skips it.
 */
export function dismissSplashWhenReady(ready: Promise<unknown>) {
  const splash = document.getElementById('splash');
  if (!splash) return;
  let gone = false;
  const hide = () => {
    if (gone) return;
    gone = true;
    splash.classList.add('out');
    setTimeout(() => splash.remove(), FADE_MS);
  };
  splash.addEventListener('click', hide);
  const minWait = new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - performance.now())));
  void Promise.all([minWait, ready.catch(() => {})]).then(hide);
  setTimeout(hide, MAX_MS);
}
