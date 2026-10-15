import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Palette = 'emerald' | 'ocean' | 'sunset' | 'grape' | 'rose' | 'slate';
export type Density = 'comfortable' | 'compact';

export const PALETTES: { id: Palette; label: string; swatch: string }[] = [
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'ocean', label: 'Ocean', swatch: '#0ea5e9' },
  { id: 'sunset', label: 'Sunset', swatch: '#f97316' },
  { id: 'grape', label: 'Grape', swatch: '#8b5cf6' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { id: 'slate', label: 'Slate', swatch: '#64748b' },
];

interface ThemeState {
  mode: ThemeMode;
  palette: Palette;
  density: Density;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: Palette) => void;
  setDensity: (density: Density) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      palette: 'emerald',
      density: 'comfortable',
      setMode: (mode) => set({ mode }),
      setPalette: (palette) => set({ palette }),
      setDensity: (density) => set({ density }),
    }),
    { name: 'splitzy-theme', version: 1 },
  ),
);
