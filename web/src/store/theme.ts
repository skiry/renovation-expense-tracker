import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Default = light per cerinta
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'reno-theme' }
  )
);

/** Apply the theme to the <html> root element. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-system');
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'system') root.classList.add('theme-system');
  // 'light' = no classes, default vars
}
