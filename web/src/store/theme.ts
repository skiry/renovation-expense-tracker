import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'reno-theme';

function load(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}
function save(t: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: load(),
  setTheme: (theme) => {
    save(theme);
    set({ theme });
  },
}));

/** Apply the theme to the <html> root element. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-system');
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'system') root.classList.add('theme-system');
  // 'light' = no classes, default vars
}
