export type Currency = 'RON' | 'EUR';
export type PriceMode = 'estimated' | 'detailed';

export interface ExpenseDetail {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  isPaid: boolean;
}

export interface ExpensePhoto {
  id: string;
  blobUrl: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface Expense {
  id: string;
  workspaceId: string;
  title: string;
  estimatedPrice: number;
  estimatedCurrency: Currency;
  description?: string;
  isPriority: boolean;
  isPaid: boolean;
  priceMode: PriceMode;
  order: number;
  details: ExpenseDetail[];
  photos: ExpensePhoto[];
  createdAt: string;
  updatedAt: string;
  /** Cosmos DB ETag for optimistic concurrency. Sent back on PATCH via If-Match header. */
  _etag?: string;
}

export interface WorkspaceUser {
  id: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  createdAt: string;
  isMaster: boolean;
  users?: WorkspaceUser[];
}

export interface ExchangeRate {
  eurToRon: number;
  updatedAt: string;
  source: 'BNR' | 'cache' | 'fallback';
}

export type HistoryAction =
  | 'expense.create'
  | 'expense.update'
  | 'expense.delete'
  | 'detail.create'
  | 'detail.update'
  | 'detail.delete'
  | 'photo.add'
  | 'photo.delete';

export type FieldDelta = { from: unknown; to: unknown };

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  timestamp: string;
  action: HistoryAction;
  expenseId: string;
  expenseTitle: string;
  changes?: Record<string, FieldDelta>;
  detailName?: string;
  detailChanges?: Record<string, FieldDelta>;
  photoCount?: number;
  price?: number;
  currency?: 'RON' | 'EUR';
  expensePriceMode?: PriceMode;
}
