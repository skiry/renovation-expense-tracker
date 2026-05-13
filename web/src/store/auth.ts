import { create } from 'zustand';

const CODE_KEY = 'reno-auth-code';
const USER_ID_KEY = 'reno-auth-user-id';
const USER_NAME_KEY = 'reno-auth-user-name';

function load<T extends string | null>(key: string): T {
  try {
    return (localStorage.getItem(key) as T) ?? (null as T);
  } catch {
    return null as T;
  }
}

function save(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore (private mode etc.)
  }
}

interface AuthState {
  accessCode: string | null;
  userId: string | null;
  userName: string | null;
  setAccessCode: (code: string) => void;
  setUser: (id: string, name: string) => void;
  clearUser: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessCode: load(CODE_KEY),
  userId: load(USER_ID_KEY),
  userName: load(USER_NAME_KEY),
  setAccessCode: (code) => {
    save(CODE_KEY, code);
    set({ accessCode: code });
  },
  setUser: (id, name) => {
    save(USER_ID_KEY, id);
    save(USER_NAME_KEY, name);
    set({ userId: id, userName: name });
  },
  clearUser: () => {
    save(USER_ID_KEY, null);
    save(USER_NAME_KEY, null);
    set({ userId: null, userName: null });
  },
  logout: () => {
    save(CODE_KEY, null);
    save(USER_ID_KEY, null);
    save(USER_NAME_KEY, null);
    set({ accessCode: null, userId: null, userName: null });
  },
}));
