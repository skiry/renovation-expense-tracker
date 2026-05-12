import { Expense, ExpenseDetail, ExpensePhoto, ExchangeRate, Workspace } from '@/types';
import { uid, slugifyTitle, uniqueSlug } from '@/lib/utils';
import { MOCK_EXPENSES, MOCK_WORKSPACES } from './mockData';

/**
 * API abstraction. In POC mode (VITE_USE_MOCK !== 'false') uses in-memory mock storage.
 * To switch to real backend: set VITE_USE_MOCK=false and call the Azure Functions API.
 */
export interface IApi {
  // auth
  verifyAccessCode(code: string): Promise<{ exists: boolean; isMaster?: boolean }>;
  createWorkspace(code: string): Promise<{ created: boolean; reason?: string }>;
  // expenses
  listExpenses(accessCode: string): Promise<Expense[]>;
  getExpense(accessCode: string, id: string): Promise<Expense | null>;
  createExpense(accessCode: string, data: Partial<Expense>): Promise<Expense>;
  updateExpense(accessCode: string, id: string, patch: Partial<Expense>): Promise<Expense>;
  deleteExpense(accessCode: string, id: string): Promise<void>;
  reorderExpenses(accessCode: string, ordered: { id: string; order: number }[]): Promise<void>;
  // details
  addDetail(accessCode: string, expenseId: string, detail: Omit<ExpenseDetail, 'id'>): Promise<Expense>;
  updateDetail(accessCode: string, expenseId: string, detailId: string, patch: Partial<ExpenseDetail>): Promise<Expense>;
  deleteDetail(accessCode: string, expenseId: string, detailId: string): Promise<Expense>;
  // photos
  addPhoto(accessCode: string, expenseId: string, file: File): Promise<Expense>;
  deletePhoto(accessCode: string, expenseId: string, photoId: string): Promise<Expense>;
  // exchange rate
  getExchangeRate(): Promise<ExchangeRate>;
  refreshExchangeRate(): Promise<ExchangeRate>;
}

// ----------------------- MOCK IMPLEMENTATION -----------------------

const STORAGE_KEY = 'reno-mock-data-v1';

interface MockDb {
  workspaces: Workspace[];
  expenses: Expense[];
  rate: ExchangeRate;
}

function loadDb(): MockDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallthrough
    }
  }
  const initial: MockDb = {
    workspaces: structuredClone(MOCK_WORKSPACES),
    expenses: structuredClone(MOCK_EXPENSES),
    rate: { eurToRon: 5.2364, updatedAt: new Date().toISOString(), source: 'BNR' },
  };
  saveDb(initial);
  return initial;
}

function saveDb(db: MockDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getDb(): MockDb {
  return loadDb();
}

async function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

function findExpense(db: MockDb, accessCode: string, id: string) {
  return db.expenses.find((e) => e.workspaceId === accessCode && e.id === id);
}

class MockApi implements IApi {
  async verifyAccessCode(code: string) {
    const db = getDb();
    const ws = db.workspaces.find((w) => w.id === code);
    return delay({ exists: !!ws, isMaster: ws?.isMaster });
  }

  async createWorkspace(code: string) {
    const db = getDb();
    if (code.length < 6) return delay({ created: false, reason: 'Codul trebuie să aibă minim 6 caractere.' });
    if (db.workspaces.some((w) => w.id === code)) return delay({ created: false, reason: 'Codul există deja. Alege altul.' });
    db.workspaces.push({ id: code, createdAt: new Date().toISOString(), isMaster: false });
    saveDb(db);
    return delay({ created: true });
  }

  async listExpenses(accessCode: string) {
    const db = getDb();
    return delay(db.expenses.filter((e) => e.workspaceId === accessCode).sort((a, b) => a.order - b.order));
  }

  async getExpense(accessCode: string, id: string) {
    const db = getDb();
    return delay(findExpense(db, accessCode, id) ?? null);
  }

  async createExpense(accessCode: string, data: Partial<Expense>) {
    const db = getDb();
    const isPriority = data.isPriority ?? false;
    const maxOrder = db.expenses
      .filter((e) => e.workspaceId === accessCode && e.isPriority === isPriority)
      .reduce((max, e) => Math.max(max, e.order), -1);
    const title = data.title ?? 'Cheltuială nouă';
    const existingIds = new Set(db.expenses.filter((e) => e.workspaceId === accessCode).map((e) => e.id));
    const id = uniqueSlug(slugifyTitle(title), existingIds);
    const expense: Expense = {
      id,
      workspaceId: accessCode,
      title,
      estimatedPrice: data.estimatedPrice ?? 0,
      estimatedCurrency: data.estimatedCurrency ?? 'RON',
      description: data.description,
      isPriority,
      isPaid: false,
      priceMode: 'estimated',
      order: maxOrder + 1,
      details: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.expenses.push(expense);
    saveDb(db);
    return delay(expense);
  }

  async updateExpense(accessCode: string, id: string, patch: Partial<Expense>) {
    const db = getDb();
    const exp = findExpense(db, accessCode, id);
    if (!exp) throw new Error('Not found');
    const wasPriority = exp.isPriority;
    Object.assign(exp, patch, { updatedAt: new Date().toISOString() });
    // Daca s-a schimbat prioritatea, recalculeaza order ca sa apara la final in lista noua
    if (patch.isPriority !== undefined && patch.isPriority !== wasPriority) {
      const maxOrder = db.expenses
        .filter((e) => e.workspaceId === accessCode && e.isPriority === exp.isPriority && e.id !== exp.id)
        .reduce((max, e) => Math.max(max, e.order), -1);
      exp.order = maxOrder + 1;
    }
    saveDb(db);
    return delay(exp);
  }

  async deleteExpense(accessCode: string, id: string) {
    const db = getDb();
    db.expenses = db.expenses.filter((e) => !(e.workspaceId === accessCode && e.id === id));
    saveDb(db);
    return delay(undefined);
  }

  async reorderExpenses(accessCode: string, ordered: { id: string; order: number }[]) {
    const db = getDb();
    for (const { id, order } of ordered) {
      const exp = findExpense(db, accessCode, id);
      if (exp) exp.order = order;
    }
    saveDb(db);
    return delay(undefined);
  }

  async addDetail(accessCode: string, expenseId: string, detail: Omit<ExpenseDetail, 'id'>) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    exp.details.push({ id: uid(), ...detail });
    exp.updatedAt = new Date().toISOString();
    saveDb(db);
    return delay(exp);
  }

  async updateDetail(accessCode: string, expenseId: string, detailId: string, patch: Partial<ExpenseDetail>) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    const detail = exp.details.find((d) => d.id === detailId);
    if (!detail) throw new Error('Detail not found');
    Object.assign(detail, patch);
    exp.updatedAt = new Date().toISOString();
    saveDb(db);
    return delay(exp);
  }

  async deleteDetail(accessCode: string, expenseId: string, detailId: string) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    exp.details = exp.details.filter((d) => d.id !== detailId);
    exp.updatedAt = new Date().toISOString();
    saveDb(db);
    return delay(exp);
  }

  async addPhoto(accessCode: string, expenseId: string, file: File) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    // In mock mode, store as data URL pentru persistenta in localStorage
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const photo: ExpensePhoto = {
      id: uid(),
      blobUrl: dataUrl,
      uploadedAt: new Date().toISOString(),
    };
    exp.photos.push(photo);
    exp.updatedAt = new Date().toISOString();
    try {
      saveDb(db);
    } catch (err) {
      // localStorage quota exceeded - cleanup the just-added photo
      exp.photos = exp.photos.filter((p) => p.id !== photo.id);
      throw new Error('Spațiu insuficient în localStorage. Reduce dimensiunea pozei sau șterge altele.');
    }
    return delay(exp);
  }

  async deletePhoto(accessCode: string, expenseId: string, photoId: string) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    exp.photos = exp.photos.filter((p) => p.id !== photoId);
    exp.updatedAt = new Date().toISOString();
    saveDb(db);
    return delay(exp);
  }

  async getExchangeRate() {
    const db = getDb();
    return delay(db.rate);
  }

  async refreshExchangeRate() {
    // In POC mode simulam un refresh la cursul BNR
    const db = getDb();
    db.rate = {
      eurToRon: 5.2364,
      updatedAt: new Date().toISOString(),
      source: 'BNR',
    };
    saveDb(db);
    return delay(db.rate);
  }
}

// ----------------------- REAL IMPLEMENTATION (stub for Phase 2) -----------------------

/** Thrown when the server returns 412 Precondition Failed (someone else modified the resource). */
export class ConflictError extends Error {
  constructor(message = 'Resource was modified by another user') {
    super(message);
    this.name = 'ConflictError';
  }
}

class HttpApi implements IApi {
  private headers(accessCode?: string, ifMatch?: string): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessCode) h['x-access-code'] = accessCode;
    if (ifMatch) h['If-Match'] = ifMatch;
    return h;
  }

  private async req<T>(path: string, init: RequestInit = {}, accessCode?: string, ifMatch?: string): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...this.headers(accessCode, ifMatch), ...(init.headers ?? {}) },
    });
    if (res.status === 412) throw new ConflictError();
    if (!res.ok) {
      let msg = `API ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  verifyAccessCode(code: string) {
    return this.req<{ exists: boolean; isMaster?: boolean }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }
  createWorkspace(code: string) {
    return this.req<{ created: boolean; reason?: string }>('/auth/create', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }
  listExpenses(accessCode: string) {
    return this.req<Expense[]>('/expenses', {}, accessCode);
  }
  getExpense(accessCode: string, id: string) {
    return this.req<Expense | null>(`/expenses/${id}`, {}, accessCode);
  }
  createExpense(accessCode: string, data: Partial<Expense>) {
    return this.req<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }, accessCode);
  }
  updateExpense(accessCode: string, id: string, patch: Partial<Expense>) {
    const { _etag, ...rest } = patch as Partial<Expense> & { _etag?: string };
    return this.req<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(rest) }, accessCode, _etag);
  }
  deleteExpense(accessCode: string, id: string) {
    return this.req<void>(`/expenses/${id}`, { method: 'DELETE' }, accessCode);
  }
  reorderExpenses(accessCode: string, ordered: { id: string; order: number }[]) {
    return this.req<void>('/expenses/reorder', { method: 'POST', body: JSON.stringify(ordered) }, accessCode);
  }
  addDetail(accessCode: string, expenseId: string, detail: Omit<ExpenseDetail, 'id'>) {
    return this.req<Expense>(`/expenses/${expenseId}/details`, { method: 'POST', body: JSON.stringify(detail) }, accessCode);
  }
  updateDetail(accessCode: string, expenseId: string, detailId: string, patch: Partial<ExpenseDetail>) {
    return this.req<Expense>(
      `/expenses/${expenseId}/details/${detailId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      accessCode
    );
  }
  deleteDetail(accessCode: string, expenseId: string, detailId: string) {
    return this.req<Expense>(`/expenses/${expenseId}/details/${detailId}`, { method: 'DELETE' }, accessCode);
  }
  async addPhoto(accessCode: string, expenseId: string, file: File) {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch(`/api/expenses/${expenseId}/photos`, {
      method: 'POST',
      headers: { 'x-access-code': accessCode },
      body: fd,
    });
    if (!res.ok) {
      let msg = `Upload failed: ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return res.json();
  }
  deletePhoto(accessCode: string, expenseId: string, photoId: string) {
    return this.req<Expense>(`/expenses/${expenseId}/photos/${photoId}`, { method: 'DELETE' }, accessCode);
  }
  getExchangeRate() {
    return this.req<ExchangeRate>('/exchange-rate');
  }
  refreshExchangeRate() {
    return this.req<ExchangeRate>('/exchange-rate', { method: 'POST' });
  }
}

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const api: IApi = useMock ? new MockApi() : new HttpApi();
export const IS_MOCK = useMock;
