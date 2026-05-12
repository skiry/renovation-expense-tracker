import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessCode: string | null;
  setAccessCode: (code: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessCode: null,
      setAccessCode: (code) => set({ accessCode: code }),
      logout: () => set({ accessCode: null }),
    }),
    { name: 'reno-auth' }
  )
);
