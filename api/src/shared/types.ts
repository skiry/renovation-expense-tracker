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
  blobName: string;
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
  /** Cosmos DB system-generated etag. Exposed in API responses for optimistic concurrency. */
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

export interface PushSubscriptionRecord {
  id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel?: string;
  createdAt: string;
}

export type ScheduledTargetUserIds = string[] | 'all';

export interface ScheduledNotification {
  id: string;
  workspaceId: string;
  scheduledFor: string;
  timezone?: string;
  targetUserIds: ScheduledTargetUserIds;
  title: string;
  body: string;
  url?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  sentAt?: string;
}

// ---------------------- Audit / History ----------------------

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
  /** Per-field deltas for expense.update */
  changes?: Record<string, FieldDelta>;
  /** Name snapshot for detail.* actions */
  detailName?: string;
  /** Per-field deltas for detail.update */
  detailChanges?: Record<string, FieldDelta>;
  /** Count for photo.add / photo.delete (always 1 in current implementation but reserved for batching) */
  photoCount?: number;
  /** Price snapshot at time of create/delete (for expense or detail). */
  price?: number;
  currency?: 'RON' | 'EUR';
  /** Snapshot of the parent expense's priceMode at audit time. Used by UI to decide if a price change is "significant". */
  expensePriceMode?: PriceMode;
}

