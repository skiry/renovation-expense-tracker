import { historyContainer } from './cosmos';
import { uuid } from '../shared/slug';
import { notifyImportant } from './push';
import {
  Expense,
  ExpenseDetail,
  FieldDelta,
  HistoryAction,
  HistoryEntry,
} from '../shared/types';

interface BaseWriteArgs {
  workspaceId: string;
  userId: string;
  userName: string;
  expenseId: string;
  expenseTitle: string;
}

interface PricedArgs extends BaseWriteArgs {
  price: number;
  currency: 'RON' | 'EUR';
}

async function write(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  const fullEntry: HistoryEntry = {
    ...entry,
    id: uuid(),
    timestamp: new Date().toISOString(),
  };
  const c = await historyContainer();
  try {
    await c.items.create(fullEntry);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Audit write failed:', err);
  }
  // Fire-and-forget push fan-out. Awaiting it keeps it inside the function's
  // execution context (so it actually runs on Azure) but errors are swallowed
  // inside notifyImportant.
  try {
    await notifyImportant(fullEntry);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Push notify failed:', err);
  }
}

const TRACKED_EXPENSE_FIELDS: (keyof Expense)[] = [
  'title',
  'estimatedPrice',
  'estimatedCurrency',
  'description',
  'isPriority',
  'isPaid',
  'priceMode',
];

const TRACKED_DETAIL_FIELDS: (keyof ExpenseDetail)[] = ['name', 'price', 'currency', 'isPaid'];

export function diffExpense(before: Expense, after: Expense): Record<string, FieldDelta> {
  const changes: Record<string, FieldDelta> = {};
  for (const f of TRACKED_EXPENSE_FIELDS) {
    if ((before as any)[f] !== (after as any)[f]) {
      changes[f] = { from: (before as any)[f] ?? null, to: (after as any)[f] ?? null };
    }
  }
  return changes;
}

export function diffDetail(before: ExpenseDetail, after: ExpenseDetail): Record<string, FieldDelta> {
  const changes: Record<string, FieldDelta> = {};
  for (const f of TRACKED_DETAIL_FIELDS) {
    if ((before as any)[f] !== (after as any)[f]) {
      changes[f] = { from: (before as any)[f] ?? null, to: (after as any)[f] ?? null };
    }
  }
  return changes;
}

// ---------- High-level helpers, called from function handlers ----------

export function auditExpenseCreate(args: PricedArgs) {
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'expense.create',
    price: args.price,
    currency: args.currency,
  });
}

export function auditExpenseUpdate(args: BaseWriteArgs & {
  changes: Record<string, FieldDelta>;
  priceMode: 'estimated' | 'detailed';
}) {
  if (Object.keys(args.changes).length === 0) return;
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'expense.update',
    changes: args.changes,
    expensePriceMode: args.priceMode,
  });
}

export function auditExpenseDelete(args: PricedArgs) {
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'expense.delete',
    price: args.price,
    currency: args.currency,
  });
}

export function auditDetailCreate(args: PricedArgs & { detailName: string }) {
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'detail.create',
    detailName: args.detailName,
    price: args.price,
    currency: args.currency,
  });
}

export function auditDetailUpdate(args: BaseWriteArgs & {
  detailName: string;
  detailChanges: Record<string, FieldDelta>;
  priceMode: 'estimated' | 'detailed';
}) {
  if (Object.keys(args.detailChanges).length === 0) return;
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'detail.update',
    detailName: args.detailName,
    detailChanges: args.detailChanges,
    expensePriceMode: args.priceMode,
  });
}

export function auditDetailDelete(args: PricedArgs & { detailName: string }) {
  return write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action: 'detail.delete',
    detailName: args.detailName,
    price: args.price,
    currency: args.currency,
  });
}

const auditPhoto = (action: 'photo.add' | 'photo.delete') => (args: BaseWriteArgs) =>
  write({
    workspaceId: args.workspaceId,
    userId: args.userId,
    userName: args.userName,
    expenseId: args.expenseId,
    expenseTitle: args.expenseTitle,
    action,
    photoCount: 1,
  });

export const auditPhotoAdd = auditPhoto('photo.add');
export const auditPhotoDelete = auditPhoto('photo.delete');
