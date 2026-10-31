import type { Expense } from '@/types';
import { displayPriceRon } from './calculations';

export const EXPENSE_SORT_OPTIONS = [
  { value: 'manual', label: 'Sortare preferențială' },
  { value: 'name-asc', label: 'Nume: A → Z' },
  { value: 'name-desc', label: 'Nume: Z → A' },
  { value: 'amount-asc', label: 'Sumă: crescător' },
  { value: 'amount-desc', label: 'Sumă: descrescător' },
  { value: 'created-desc', label: 'Create: cele mai noi' },
  { value: 'created-asc', label: 'Create: cele mai vechi' },
  { value: 'updated-desc', label: 'Actualizate: cele mai noi' },
  { value: 'updated-asc', label: 'Actualizate: cele mai vechi' },
] as const;

export type ExpenseSort = (typeof EXPENSE_SORT_OPTIONS)[number]['value'];

const nameCollator = new Intl.Collator('ro-RO', { sensitivity: 'base' });

export function sortExpenses(items: Expense[], sort: ExpenseSort, eurToRon: number): Expense[] {
  return items.slice().sort((a, b) => {
    let comparison = 0;
    switch (sort) {
      case 'manual':
        break;
      case 'name-asc':
        comparison = nameCollator.compare(a.title, b.title);
        break;
      case 'name-desc':
        comparison = nameCollator.compare(b.title, a.title);
        break;
      case 'amount-asc':
        comparison = displayPriceRon(a, eurToRon) - displayPriceRon(b, eurToRon);
        break;
      case 'amount-desc':
        comparison = displayPriceRon(b, eurToRon) - displayPriceRon(a, eurToRon);
        break;
      case 'created-desc':
        comparison = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        break;
      case 'created-asc':
        comparison = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        break;
      case 'updated-desc':
        comparison = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        break;
      case 'updated-asc':
        comparison = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        break;
    }
    return comparison || a.order - b.order;
  });
}
