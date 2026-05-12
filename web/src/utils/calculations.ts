import { Expense, Currency, ExpenseDetail } from '@/types';

export function convertToRon(amount: number, currency: Currency, eurToRon: number): number {
  if (currency === 'RON') return amount;
  return amount * eurToRon;
}

export function detailedTotalRon(details: ExpenseDetail[], eurToRon: number): number {
  return details.reduce((sum, d) => sum + convertToRon(d.price, d.currency, eurToRon), 0);
}

/** Pretul "afisat" pentru un element, in RON, in functie de modul ales (estimated vs detailed). */
export function displayPriceRon(expense: Expense, eurToRon: number): number {
  if (expense.priceMode === 'estimated') {
    return convertToRon(expense.estimatedPrice, expense.estimatedCurrency, eurToRon);
  }
  return detailedTotalRon(expense.details, eurToRon);
}

/**
 * Cheltuit pentru un element (in RON):
 * - daca elementul e marcat platit integral: pretul afisat (estimated sau detailed, dupa switch)
 * - altfel: suma sub-intrarilor bifate ca platite (indiferent de mode)
 */
export function spentForExpense(expense: Expense, eurToRon: number): number {
  if (expense.isPaid) return displayPriceRon(expense, eurToRon);
  return expense.details
    .filter((d) => d.isPaid)
    .reduce((sum, d) => sum + convertToRon(d.price, d.currency, eurToRon), 0);
}

export interface DashboardTotals {
  priorityTotal: number;
  nonPriorityTotal: number;
  grandTotal: number;
  spentTotal: number;
  priorityCount: number;
  nonPriorityCount: number;
  paidCount: number;
}

export function computeTotals(expenses: Expense[], eurToRon: number): DashboardTotals {
  let priorityTotal = 0;
  let nonPriorityTotal = 0;
  let spentTotal = 0;
  let priorityCount = 0;
  let nonPriorityCount = 0;
  let paidCount = 0;

  for (const e of expenses) {
    const display = displayPriceRon(e, eurToRon);
    if (e.isPriority) {
      priorityTotal += display;
      priorityCount++;
    } else {
      nonPriorityTotal += display;
      nonPriorityCount++;
    }
    spentTotal += spentForExpense(e, eurToRon);
    if (e.isPaid) paidCount++;
  }

  return {
    priorityTotal,
    nonPriorityTotal,
    grandTotal: priorityTotal + nonPriorityTotal,
    spentTotal,
    priorityCount,
    nonPriorityCount,
    paidCount,
  };
}
