import {
  Expense,
  ExpenseDetail,
  ExpensePhoto,
  ExchangeRate,
  Workspace,
  WorkspaceUser,
  HistoryEntry,
} from '@/types';
import { uid, slugifyTitle, uniqueSlug } from '@/lib/utils';
import { MOCK_EXPENSES, MOCK_WORKSPACES } from './mockData';

export interface IApi {
  // auth
  verifyAccessCode(code: string): Promise<{ exists: boolean; isMaster?: boolean }>;
  createWorkspace(code: string): Promise<{ created: boolean; reason?: string }>;
  // users
  listUsers(accessCode: string): Promise<WorkspaceUser[]>;
  createUser(
    accessCode: string,
    name: string
  ): Promise<{ user?: WorkspaceUser; users?: WorkspaceUser[]; error?: string }>;
  deleteUser(accessCode: string, userId: string): Promise<WorkspaceUser[]>;
  // expenses
  listExpenses(accessCode: string): Promise<Expense[]>;
  getExpense(accessCode: string, id: string): Promise<Expense | null>;
  createExpense(accessCode: string, userId: string, data: Partial<Expense>): Promise<Expense>;
  updateExpense(accessCode: string, userId: string, id: string, patch: Partial<Expense>): Promise<Expense>;
  deleteExpense(accessCode: string, userId: string, id: string): Promise<void>;
  reorderExpenses(accessCode: string, ordered: { id: string; order: number }[]): Promise<void>;
  // details
  addDetail(
    accessCode: string,
    userId: string,
    expenseId: string,
    detail: Omit<ExpenseDetail, 'id'>
  ): Promise<Expense>;
  updateDetail(
    accessCode: string,
    userId: string,
    expenseId: string,
    detailId: string,
    patch: Partial<ExpenseDetail>
  ): Promise<Expense>;
  deleteDetail(accessCode: string, userId: string, expenseId: string, detailId: string): Promise<Expense>;
  // photos
  addPhoto(accessCode: string, userId: string, expenseId: string, file: File): Promise<Expense>;
  deletePhoto(accessCode: string, userId: string, expenseId: string, photoId: string): Promise<Expense>;
  // exchange rate
  getExchangeRate(): Promise<ExchangeRate>;
  refreshExchangeRate(): Promise<ExchangeRate>;
  // history
  listHistory(
    accessCode: string,
    before?: string | null,
    limit?: number
  ): Promise<{ entries: HistoryEntry[]; nextBefore: string | null }>;
}

// ----------------------- MOCK IMPLEMENTATION -----------------------

const STORAGE_KEY = 'reno-mock-data-v1';

interface MockDb {
  workspaces: Workspace[];
  expenses: Expense[];
  rate: ExchangeRate;
  history: HistoryEntry[];
}

function loadDb(): MockDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.history) parsed.history = [];
      return parsed;
    } catch {
      // fallthrough
    }
  }
  const initial: MockDb = {
    workspaces: structuredClone(MOCK_WORKSPACES),
    expenses: structuredClone(MOCK_EXPENSES),
    rate: { eurToRon: 5.2364, updatedAt: new Date().toISOString(), source: 'BNR' },
    history: [],
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

async function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

function findExpense(db: MockDb, accessCode: string, id: string) {
  return db.expenses.find((e) => e.workspaceId === accessCode && e.id === id);
}

function getUser(db: MockDb, accessCode: string, userId: string): WorkspaceUser | undefined {
  const ws = db.workspaces.find((w) => w.id === accessCode);
  return ws?.users?.find((u) => u.id === userId);
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
    if (db.workspaces.some((w) => w.id === code))
      return delay({ created: false, reason: 'Codul există deja. Alege altul.' });
    db.workspaces.push({ id: code, createdAt: new Date().toISOString(), isMaster: false, users: [] });
    saveDb(db);
    return delay({ created: true });
  }

  async listUsers(accessCode: string) {
    const db = getDb();
    const ws = db.workspaces.find((w) => w.id === accessCode);
    return delay(ws?.users ?? []);
  }

  async createUser(accessCode: string, name: string) {
    const db = getDb();
    const ws = db.workspaces.find((w) => w.id === accessCode);
    if (!ws) return delay({ error: 'Workspace not found' });
    if (!ws.users) ws.users = [];
    const n = name.trim();
    if (!n) return delay({ error: 'Numele este obligatoriu' });
    if (n.length > 40) return delay({ error: 'Numele are max 40 caractere' });
    if (ws.users.some((u) => u.name.toLowerCase() === n.toLowerCase()))
      return delay({ error: 'Există deja un utilizator cu acest nume' });
    const user: WorkspaceUser = { id: uid(), name: n, createdAt: new Date().toISOString() };
    ws.users.push(user);
    saveDb(db);
    return delay({ user, users: ws.users });
  }

  async deleteUser(accessCode: string, userId: string) {
    const db = getDb();
    const ws = db.workspaces.find((w) => w.id === accessCode);
    if (!ws || !ws.users) throw new Error('Not found');
    ws.users = ws.users.filter((u) => u.id !== userId);
    saveDb(db);
    return delay(ws.users);
  }

  async listExpenses(accessCode: string) {
    const db = getDb();
    return delay(db.expenses.filter((e) => e.workspaceId === accessCode).sort((a, b) => a.order - b.order));
  }

  async getExpense(accessCode: string, id: string) {
    const db = getDb();
    return delay(findExpense(db, accessCode, id) ?? null);
  }

  private pushHistory(db: MockDb, entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    db.history.unshift({ ...entry, id: uid(), timestamp: new Date().toISOString() });
  }

  async createExpense(accessCode: string, userId: string, data: Partial<Expense>) {
    const db = getDb();
    const u = getUser(db, accessCode, userId);
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
    if (u) {
      this.pushHistory(db, {
        workspaceId: accessCode,
        userId: u.id,
        userName: u.name,
        action: 'expense.create',
        expenseId: id,
        expenseTitle: title,
        price: expense.estimatedPrice,
        currency: expense.estimatedCurrency,
      });
    }
    saveDb(db);
    return delay(expense);
  }

  async updateExpense(accessCode: string, userId: string, id: string, patch: Partial<Expense>) {
    const db = getDb();
    const exp = findExpense(db, accessCode, id);
    if (!exp) throw new Error('Not found');
    const u = getUser(db, accessCode, userId);
    const before: Expense = JSON.parse(JSON.stringify(exp));

    const wasPriority = exp.isPriority;
    Object.assign(exp, patch, { updatedAt: new Date().toISOString() });
    if (patch.isPriority !== undefined && patch.isPriority !== wasPriority) {
      const maxOrder = db.expenses
        .filter((e) => e.workspaceId === accessCode && e.isPriority === exp.isPriority && e.id !== exp.id)
        .reduce((max, e) => Math.max(max, e.order), -1);
      exp.order = maxOrder + 1;
    }

    if (u) {
      const fields: (keyof Expense)[] = [
        'title',
        'estimatedPrice',
        'estimatedCurrency',
        'description',
        'isPriority',
        'isPaid',
        'priceMode',
      ];
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const f of fields) {
        if ((before as any)[f] !== (exp as any)[f])
          changes[f] = { from: (before as any)[f] ?? null, to: (exp as any)[f] ?? null };
      }
      if (Object.keys(changes).length > 0) {
        this.pushHistory(db, {
          workspaceId: accessCode,
          userId: u.id,
          userName: u.name,
          action: 'expense.update',
          expenseId: id,
          expenseTitle: exp.title,
          changes,
          expensePriceMode: exp.priceMode,
        });
      }
    }
    saveDb(db);
    return delay(exp);
  }

  async deleteExpense(accessCode: string, userId: string, id: string) {
    const db = getDb();
    const exp = findExpense(db, accessCode, id);
    if (exp) {
      const u = getUser(db, accessCode, userId);
      if (u) {
        this.pushHistory(db, {
          workspaceId: accessCode,
          userId: u.id,
          userName: u.name,
          action: 'expense.delete',
          expenseId: id,
          expenseTitle: exp.title,
          price: exp.estimatedPrice,
          currency: exp.estimatedCurrency,
        });
      }
    }
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

  async addDetail(accessCode: string, userId: string, expenseId: string, detail: Omit<ExpenseDetail, 'id'>) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    const u = getUser(db, accessCode, userId);
    const newDetail = { id: uid(), ...detail };
    exp.details.push(newDetail);
    exp.updatedAt = new Date().toISOString();
    if (u) {
      this.pushHistory(db, {
        workspaceId: accessCode,
        userId: u.id,
        userName: u.name,
        action: 'detail.create',
        expenseId,
        expenseTitle: exp.title,
        detailName: newDetail.name,
        price: newDetail.price,
        currency: newDetail.currency,
      });
    }
    saveDb(db);
    return delay(exp);
  }

  async updateDetail(
    accessCode: string,
    userId: string,
    expenseId: string,
    detailId: string,
    patch: Partial<ExpenseDetail>
  ) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    const detail = exp.details.find((d) => d.id === detailId);
    if (!detail) throw new Error('Detail not found');
    const u = getUser(db, accessCode, userId);
    const before: ExpenseDetail = { ...detail };
    Object.assign(detail, patch);
    exp.updatedAt = new Date().toISOString();
    if (u) {
      const fields: (keyof ExpenseDetail)[] = ['name', 'price', 'currency', 'isPaid'];
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const f of fields) {
        if ((before as any)[f] !== (detail as any)[f])
          changes[f] = { from: (before as any)[f] ?? null, to: (detail as any)[f] ?? null };
      }
      if (Object.keys(changes).length > 0) {
        this.pushHistory(db, {
          workspaceId: accessCode,
          userId: u.id,
          userName: u.name,
          action: 'detail.update',
          expenseId,
          expenseTitle: exp.title,
          detailName: detail.name,
          detailChanges: changes,
          expensePriceMode: exp.priceMode,
        });
      }
    }
    saveDb(db);
    return delay(exp);
  }

  async deleteDetail(accessCode: string, userId: string, expenseId: string, detailId: string) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    const removed = exp.details.find((d) => d.id === detailId);
    exp.details = exp.details.filter((d) => d.id !== detailId);
    exp.updatedAt = new Date().toISOString();
    const u = getUser(db, accessCode, userId);
    if (u && removed) {
      this.pushHistory(db, {
        workspaceId: accessCode,
        userId: u.id,
        userName: u.name,
        action: 'detail.delete',
        expenseId,
        expenseTitle: exp.title,
        detailName: removed.name,
        price: removed.price,
        currency: removed.currency,
      });
    }
    saveDb(db);
    return delay(exp);
  }

  async addPhoto(accessCode: string, userId: string, expenseId: string, file: File) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
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
    const u = getUser(db, accessCode, userId);
    if (u) {
      this.pushHistory(db, {
        workspaceId: accessCode,
        userId: u.id,
        userName: u.name,
        action: 'photo.add',
        expenseId,
        expenseTitle: exp.title,
        photoCount: 1,
      });
    }
    try {
      saveDb(db);
    } catch (err) {
      exp.photos = exp.photos.filter((p) => p.id !== photo.id);
      throw new Error('Spațiu insuficient în localStorage. Reduce dimensiunea pozei sau șterge altele.');
    }
    return delay(exp);
  }

  async deletePhoto(accessCode: string, userId: string, expenseId: string, photoId: string) {
    const db = getDb();
    const exp = findExpense(db, accessCode, expenseId);
    if (!exp) throw new Error('Not found');
    exp.photos = exp.photos.filter((p) => p.id !== photoId);
    exp.updatedAt = new Date().toISOString();
    const u = getUser(db, accessCode, userId);
    if (u) {
      this.pushHistory(db, {
        workspaceId: accessCode,
        userId: u.id,
        userName: u.name,
        action: 'photo.delete',
        expenseId,
        expenseTitle: exp.title,
        photoCount: 1,
      });
    }
    saveDb(db);
    return delay(exp);
  }

  async getExchangeRate() {
    const db = getDb();
    return delay(db.rate);
  }

  async refreshExchangeRate() {
    const db = getDb();
    db.rate = { eurToRon: 5.2364, updatedAt: new Date().toISOString(), source: 'BNR' };
    saveDb(db);
    return delay(db.rate);
  }

  async listHistory(accessCode: string, before?: string | null, limit = 100) {
    const db = getDb();
    let entries = db.history.filter((h) => h.workspaceId === accessCode);
    if (before) entries = entries.filter((h) => h.timestamp < before);
    entries = entries.slice(0, limit);
    return delay({ entries, nextBefore: entries.length === limit ? entries[entries.length - 1].timestamp : null });
  }
}

// ----------------------- HTTP IMPLEMENTATION -----------------------

/** Thrown when the server returns 412 Precondition Failed. */
export class ConflictError extends Error {
  constructor(message = 'Resource was modified by another user') {
    super(message);
    this.name = 'ConflictError';
  }
}

class HttpApi implements IApi {
  private headers(accessCode?: string, userId?: string | null, ifMatch?: string): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessCode) h['x-access-code'] = accessCode;
    if (userId) h['x-user-id'] = userId;
    if (ifMatch) h['If-Match'] = ifMatch;
    return h;
  }

  private async req<T>(
    path: string,
    init: RequestInit = {},
    accessCode?: string,
    userId?: string | null,
    ifMatch?: string
  ): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...this.headers(accessCode, userId, ifMatch), ...(init.headers ?? {}) },
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
  listUsers(accessCode: string) {
    return this.req<WorkspaceUser[]>('/users', {}, accessCode);
  }
  async createUser(accessCode: string, name: string) {
    try {
      return await this.req<{ user: WorkspaceUser; users: WorkspaceUser[] }>(
        '/users',
        { method: 'POST', body: JSON.stringify({ name }) },
        accessCode
      );
    } catch (err: any) {
      return { error: err?.message ?? 'Eroare necunoscută' };
    }
  }
  async deleteUser(accessCode: string, userId: string) {
    const res = await this.req<{ users: WorkspaceUser[] }>(
      `/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      accessCode
    );
    return res.users;
  }
  listExpenses(accessCode: string) {
    return this.req<Expense[]>('/expenses', {}, accessCode);
  }
  getExpense(accessCode: string, id: string) {
    return this.req<Expense | null>(`/expenses/${id}`, {}, accessCode);
  }
  createExpense(accessCode: string, userId: string, data: Partial<Expense>) {
    return this.req<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }, accessCode, userId);
  }
  updateExpense(accessCode: string, userId: string, id: string, patch: Partial<Expense>) {
    const { _etag, ...rest } = patch as Partial<Expense> & { _etag?: string };
    return this.req<Expense>(
      `/expenses/${id}`,
      { method: 'PATCH', body: JSON.stringify(rest) },
      accessCode,
      userId,
      _etag
    );
  }
  deleteExpense(accessCode: string, userId: string, id: string) {
    return this.req<void>(`/expenses/${id}`, { method: 'DELETE' }, accessCode, userId);
  }
  reorderExpenses(accessCode: string, ordered: { id: string; order: number }[]) {
    return this.req<void>('/expenses/reorder', { method: 'POST', body: JSON.stringify(ordered) }, accessCode);
  }
  addDetail(accessCode: string, userId: string, expenseId: string, detail: Omit<ExpenseDetail, 'id'>) {
    return this.req<Expense>(
      `/expenses/${expenseId}/details`,
      { method: 'POST', body: JSON.stringify(detail) },
      accessCode,
      userId
    );
  }
  updateDetail(
    accessCode: string,
    userId: string,
    expenseId: string,
    detailId: string,
    patch: Partial<ExpenseDetail>
  ) {
    return this.req<Expense>(
      `/expenses/${expenseId}/details/${detailId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      accessCode,
      userId
    );
  }
  deleteDetail(accessCode: string, userId: string, expenseId: string, detailId: string) {
    return this.req<Expense>(
      `/expenses/${expenseId}/details/${detailId}`,
      { method: 'DELETE' },
      accessCode,
      userId
    );
  }
  async addPhoto(accessCode: string, userId: string, expenseId: string, file: File) {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch(`/api/expenses/${expenseId}/photos`, {
      method: 'POST',
      headers: { 'x-access-code': accessCode, 'x-user-id': userId },
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
  deletePhoto(accessCode: string, userId: string, expenseId: string, photoId: string) {
    return this.req<Expense>(
      `/expenses/${expenseId}/photos/${photoId}`,
      { method: 'DELETE' },
      accessCode,
      userId
    );
  }
  getExchangeRate() {
    return this.req<ExchangeRate>('/exchange-rate');
  }
  refreshExchangeRate() {
    return this.req<ExchangeRate>('/exchange-rate', { method: 'POST' });
  }
  listHistory(accessCode: string, before?: string | null, limit = 100) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (before) params.set('before', before);
    return this.req<{ entries: HistoryEntry[]; nextBefore: string | null }>(
      `/history?${params.toString()}`,
      {},
      accessCode
    );
  }
}

// Default: real API in production builds, mock in dev. Override with VITE_USE_MOCK=true|false.
const explicit = import.meta.env.VITE_USE_MOCK;
const useMock = explicit !== undefined ? explicit !== 'false' : import.meta.env.DEV;

export const api: IApi = useMock ? new MockApi() : new HttpApi();
export const IS_MOCK = useMock;
