import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Expense } from '../types';
import { sortExpenses, type ExpenseSort } from './sorting';

function expense(id: string, patch: Partial<Expense>): Expense {
  return {
    id,
    workspaceId: 'test',
    title: id,
    estimatedPrice: 0,
    estimatedCurrency: 'RON',
    isPriority: true,
    isPaid: false,
    priceMode: 'estimated',
    order: 0,
    details: [],
    photos: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...patch,
  };
}

test('sorts names, displayed RON amounts, dates, and manual order without mutating the input', () => {
  const items = [
    expense('a', {
      title: 'Șapă', order: 2, estimatedPrice: 20, estimatedCurrency: 'EUR',
      createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    }),
    expense('b', {
      title: 'Zugrăvit', order: 0, priceMode: 'detailed', estimatedPrice: 999,
      details: [{ id: 'detail', name: 'Materiale', price: 15, currency: 'EUR', isPaid: false }],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z',
    }),
    expense('c', {
      title: 'Alte lucrări', order: 1, estimatedPrice: 80,
      createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    }),
  ];
  const expected: Record<ExpenseSort, string[]> = {
    manual: ['b', 'c', 'a'],
    'name-asc': ['c', 'a', 'b'],
    'name-desc': ['b', 'a', 'c'],
    'amount-asc': ['b', 'c', 'a'],
    'amount-desc': ['a', 'c', 'b'],
    'created-desc': ['a', 'c', 'b'],
    'created-asc': ['b', 'c', 'a'],
    'updated-desc': ['b', 'c', 'a'],
    'updated-asc': ['a', 'c', 'b'],
  };
  const original = structuredClone(items);
  for (const sort of Object.keys(expected) as ExpenseSort[]) {
    assert.deepEqual(sortExpenses(items, sort, 5).map((item) => item.id), expected[sort], sort);
  }
  assert.deepEqual(items, original);
  assert.deepEqual(sortExpenses(items, 'amount-asc', 3).map((item) => item.id), ['b', 'a', 'c']);
});

test('keeps manual order for equal values in either direction, including equivalent timestamps', () => {
  const items = [
    expense('later', { title: 'Vopsea', order: 8, createdAt: '2026-01-01T02:00:00+02:00' }),
    expense('earlier', { title: 'vopsea', order: 3 }),
  ];
  const sorts: ExpenseSort[] = [
    'name-asc', 'name-desc', 'amount-asc', 'amount-desc',
    'created-asc', 'created-desc', 'updated-asc', 'updated-desc',
  ];
  for (const sort of sorts) {
    assert.deepEqual(sortExpenses(items, sort, 5).map((item) => item.id), ['earlier', 'later'], sort);
  }
});
