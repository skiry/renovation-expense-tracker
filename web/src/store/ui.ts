import { create } from 'zustand';

const STORAGE_KEY = 'reno-ui-hide-paid';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function save(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    // ignore
  }
}

interface UiState {
  hidePaid: boolean;
  setHidePaid: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  hidePaid: load(),
  setHidePaid: (v) => {
    save(v);
    set({ hidePaid: v });
  },
}));
