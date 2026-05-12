import { create } from 'zustand';

const STORAGE_KEY = 'reno-auth-code';

function loadCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveCode(code: string | null) {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore (private mode etc.)
  }
}

interface AuthState {
  accessCode: string | null;
  setAccessCode: (code: string) => void;
  logout: () => void;
}

// We read localStorage synchronously at store creation so the very first React render
// already has the accessCode populated. Zustand's persist middleware hydrates after the
// first render, which made ProtectedRoute redirect to /login briefly on every reload.
export const useAuthStore = create<AuthState>((set) => ({
  accessCode: loadCode(),
  setAccessCode: (code) => {
    saveCode(code);
    set({ accessCode: code });
  },
  logout: () => {
    saveCode(null);
    set({ accessCode: null });
  },
}));
