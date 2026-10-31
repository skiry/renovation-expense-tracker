import { app, HttpRequest } from '@azure/functions';
import { authenticate, requireUser } from '../middleware/auth';
import { expensesContainer } from '../services/cosmos';
import {
  auditExpenseCreate,
  auditExpenseDelete,
  auditExpenseUpdate,
  diffExpense,
} from '../services/audit';
import { ok, noContent, badRequest, notFound, conflict, serverError } from '../shared/responses';
import { slugifyTitle, uniqueSlug } from '../shared/slug';
import { Expense } from '../shared/types';
import { withPhotoUrls, sanitizeForStorage } from '../shared/transformers';

async function listAllExpenses(workspaceId: string): Promise<Expense[]> {
  const { resources } = await expensesContainer()
    .items.query<Expense>({
      query: 'SELECT * FROM c WHERE c.workspaceId = @ws',
      parameters: [{ name: '@ws', value: workspaceId }],
    })
    .fetchAll();
  return resources;
}

// /expenses — list (GET) and create (POST)
app.http('expensesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;

      if (request.method === 'GET') {
        const items = await listAllExpenses(auth.accessCode);
        items.sort((a, b) => a.order - b.order);
        return ok(items.map(withPhotoUrls));
      }

      // POST
      const userErr = requireUser(auth);
      if (userErr) return userErr;

      const data = ((await request.json()) ?? {}) as Partial<Expense>;
      const title = (data.title ?? 'Cheltuială nouă').trim() || 'Cheltuială nouă';
      const isPriority = data.isPriority ?? false;

      const existing = await listAllExpenses(auth.accessCode);
      const existingIds = new Set(existing.map((e) => e.id));
      const id = uniqueSlug(slugifyTitle(title), existingIds);
      const maxOrder = existing
        .filter((e) => e.isPriority === isPriority)
        .reduce((m, e) => Math.max(m, e.order), -1);

      const expense: Expense = {
        id,
        workspaceId: auth.accessCode,
        title,
        estimatedPrice: typeof data.estimatedPrice === 'number' ? data.estimatedPrice : 0,
        estimatedCurrency: data.estimatedCurrency === 'EUR' ? 'EUR' : 'RON',
        description: data.description?.trim() || undefined,
        isPriority,
        isPaid: false,
        priceMode: 'estimated',
        order: maxOrder + 1,
        details: [],
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { resource, etag } = await expensesContainer().items.create(expense);
      const created = resource as Expense;

      await auditExpenseCreate({
        workspaceId: auth.accessCode,
        userId: auth.user!.id,
        userName: auth.user!.name,
        expenseId: created.id,
        expenseTitle: created.title,
        price: created.estimatedPrice,
        currency: created.estimatedCurrency,
      });

      return ok(withPhotoUrls({ ...created, _etag: etag }));
    } catch (err) {
      return serverError(err);
    }
  },
});

// /expenses/reorder — POST (must come before {id} catch-all)
app.http('reorderExpenses', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/reorder',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      // reorder is intentionally NOT audited (user decision)
      const ordered = ((await request.json()) ?? []) as { id: string; order: number }[];
      if (!Array.isArray(ordered)) return badRequest('Expected array of { id, order }');

      for (const { id, order } of ordered) {
        if (typeof id !== 'string' || typeof order !== 'number') continue;
        try {
          const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!r.resource) continue;
          await expensesContainer().item(id, auth.accessCode).replace(
            { ...r.resource, order },
            { accessCondition: r.etag ? { type: 'IfMatch', condition: r.etag } : undefined }
          );
        } catch (err: any) {
          if (err?.code === 412 || err?.code === 404) continue;
          throw err;
        }
      }
      return noContent();
    } catch (err) {
      return serverError(err);
    }
  },
});

// /expenses/{id} — get (GET), update (PATCH), delete (DELETE)
app.http('expensesItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const id = request.params.id;
      if (!id) return badRequest('Missing id');

      if (request.method === 'GET') {
        try {
          const { resource, etag } = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!resource) return notFound();
          const out = withPhotoUrls({ ...resource, _etag: etag });
          return ok(out, etag ? { ETag: etag } : undefined);
        } catch (err: any) {
          if (err?.code === 404) return notFound();
          throw err;
        }
      }

      if (request.method === 'DELETE') {
        const userErr = requireUser(auth);
        if (userErr) return userErr;

        let deletedSnapshot: { title: string; price: number; currency: 'RON' | 'EUR' } | null = null;
        try {
          const { resource } = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (resource) {
            deletedSnapshot = {
              title: resource.title,
              price: resource.estimatedPrice,
              currency: resource.estimatedCurrency,
            };
            if (resource.photos?.length) {
              const { deletePhoto: delBlob } = await import('../services/blob');
              await Promise.allSettled(resource.photos.map((p) => delBlob(p.blobName)));
            }
          }
        } catch (err: any) {
          if (err?.code !== 404) throw err;
        }

        try {
          await expensesContainer().item(id, auth.accessCode).delete();
        } catch (err: any) {
          if (err?.code !== 404) throw err;
        }

        if (deletedSnapshot) {
          await auditExpenseDelete({
            workspaceId: auth.accessCode,
            userId: auth.user!.id,
            userName: auth.user!.name,
            expenseId: id,
            expenseTitle: deletedSnapshot.title,
            price: deletedSnapshot.price,
            currency: deletedSnapshot.currency,
          });
        }
        return noContent();
      }

      // PATCH
      const userErr = requireUser(auth);
      if (userErr) return userErr;

      const patch = sanitizeForStorage(((await request.json()) ?? {}) as Partial<Expense>);
      const ifMatch = request.headers.get('if-match') || undefined;

      let current: Expense;
      let currentEtag: string | undefined;
      try {
        const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
        if (!r.resource) return notFound();
        current = r.resource;
        currentEtag = r.etag;
      } catch (err: any) {
        if (err?.code === 404) return notFound();
        throw err;
      }

      if (ifMatch && currentEtag && ifMatch !== currentEtag) return conflict();

      const wasPriority = current.isPriority;
      const merged: Expense = { ...current, ...patch, id, workspaceId: auth.accessCode, updatedAt: new Date().toISOString() };

      if (patch.isPriority !== undefined && patch.isPriority !== wasPriority) {
        const all = await listAllExpenses(auth.accessCode);
        const maxOrder = all
          .filter((e) => e.id !== id && e.isPriority === merged.isPriority)
          .reduce((m, e) => Math.max(m, e.order), -1);
        merged.order = maxOrder + 1;
      }

      try {
        const { resource, etag } = await expensesContainer().item(id, auth.accessCode).replace(merged, {
          accessCondition: currentEtag ? { type: 'IfMatch', condition: currentEtag } : undefined,
        });
        const after = resource as Expense;

        await auditExpenseUpdate({
          workspaceId: auth.accessCode,
          userId: auth.user!.id,
          userName: auth.user!.name,
          expenseId: id,
          expenseTitle: after.title,
          changes: diffExpense(current, after),
          priceMode: after.priceMode,
        });

        return ok(withPhotoUrls({ ...after, _etag: etag }));
      } catch (err: any) {
        if (err?.code === 412) return conflict();
        throw err;
      }
    } catch (err) {
      return serverError(err);
    }
  },
});
