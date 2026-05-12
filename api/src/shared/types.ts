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

export interface Workspace {
  id: string;
  createdAt: string;
  isMaster: boolean;
}

export interface ExchangeRate {
  eurToRon: number;
  updatedAt: string;
  source: 'BNR' | 'cache' | 'fallback';
}
