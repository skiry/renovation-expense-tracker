import { create } from 'zustand';
import { toast } from 'sonner';
import { EXPENSE_SORT_OPTIONS, type ExpenseSort } from '@/utils/sorting';

const STORAGE_KEY = 'reno-ui-hide-paid';
const SORT_STORAGE_KEY = 'reno-ui-expense-sort';

function loadSort(): ExpenseSort {
  try {
    const value = localStorage.getItem(SORT_STORAGE_KEY);
    if (value === null) return 'manual';
    const option = EXPENSE_SORT_OPTIONS.find((option) => option.value === value);
    if (option) return option.value;
    console.warn('Sortare salvată necunoscută:', value);
  } catch (error) {
    console.warn('Nu s-a putut citi sortarea salvată:', error);
  }
  return 'manual';
}

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
  hideTotals: boolean;
  toggleHideTotals: () => void;
  expenseSort: ExpenseSort;
  setExpenseSort: (sort: ExpenseSort) => void;
}

export const useUiStore = create<UiState>((set) => ({
  expenseSort: loadSort(),
  setExpenseSort: (sort) => {
    set({ expenseSort: sort });
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sort);
    } catch (error) {
      console.warn('Nu s-a putut salva sortarea:', error);
      toast.warning('Sortarea este aplicată, dar nu poate fi salvată pe acest dispozitiv.');
    }
  },
  hideTotals: false,
  toggleHideTotals: () => set((state) => ({ hideTotals: !state.hideTotals })),
  hidePaid: load(),
  setHidePaid: (v) => {
    save(v);
    set({ hidePaid: v });
  },
}));
