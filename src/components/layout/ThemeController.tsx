import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

/** Keeps <html> classes in sync with the theme store and the OS colour-scheme preference. */
export function ThemeController() {
  const { mode, palette, density } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      root.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0b0f14' : '#f5f6f8');
    };
    apply();
    root.dataset.palette = palette;
    root.dataset.density = density;
    if (mode !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode, palette, density]);

  return null;
}
