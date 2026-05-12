import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  hidePaid: boolean;
  setHidePaid: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      hidePaid: false,
      setHidePaid: (v) => set({ hidePaid: v }),
    }),
    { name: 'reno-ui' }
  )
);
