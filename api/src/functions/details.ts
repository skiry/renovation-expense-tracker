import { app, HttpRequest } from '@azure/functions';
import { authenticate } from '../middleware/auth';
import { expensesContainer } from '../services/cosmos';
import { ok, badRequest, notFound, conflict, serverError } from '../shared/responses';
import { uuid } from '../shared/slug';
import { Expense, ExpenseDetail } from '../shared/types';
import { withPhotoUrls } from '../shared/transformers';

async function readExpense(id: string, workspaceId: string) {
  try {
    const r = await expensesContainer().item(id, workspaceId).read<Expense>();
    if (!r.resource) return { error: notFound() };
    return { resource: r.resource, etag: r.etag };
  } catch (err: any) {
    if (err?.code === 404) return { error: notFound() };
    throw err;
  }
}

async function writeBackWithEtag(workspaceId: string, expense: Expense, etag?: string) {
  expense.updatedAt = new Date().toISOString();
  try {
    const { resource, etag: newEtag } = await expensesContainer().item(expense.id, workspaceId).replace(expense, {
      accessCondition: etag ? { type: 'IfMatch', condition: etag } : undefined,
    });
    return ok(withPhotoUrls({ ...(resource as Expense), _etag: newEtag }));
  } catch (err: any) {
    if (err?.code === 412) return conflict();
    throw err;
  }
}

// /expenses/{id}/details — POST add
app.http('detailsCollection', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}/details',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const id = request.params.id;
      if (!id) return badRequest('Missing id');
      const body = ((await request.json()) ?? {}) as Partial<ExpenseDetail>;
      const detail: ExpenseDetail = {
        id: uuid(),
        name: (body.name ?? '').trim() || 'Item',
        price: typeof body.price === 'number' ? body.price : 0,
        currency: body.currency === 'EUR' ? 'EUR' : 'RON',
        isPaid: !!body.isPaid,
      };
      const { resource, etag, error } = await readExpense(id, auth.accessCode);
      if (error) return error;
      resource!.details.push(detail);
      return writeBackWithEtag(auth.accessCode, resource!, etag);
    } catch (err) {
      return serverError(err);
    }
  },
});

// /expenses/{id}/details/{detailId} — PATCH and DELETE
app.http('detailsItem', {
  methods: ['PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}/details/{detailId}',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const id = request.params.id;
      const detailId = request.params.detailId;
      if (!id || !detailId) return badRequest('Missing id');

      if (request.method === 'DELETE') {
        const { resource, etag, error } = await readExpense(id, auth.accessCode);
        if (error) return error;
        resource!.details = resource!.details.filter((d) => d.id !== detailId);
        return writeBackWithEtag(auth.accessCode, resource!, etag);
      }

      // PATCH
      const patch = ((await request.json()) ?? {}) as Partial<ExpenseDetail>;
      const { resource, etag, error } = await readExpense(id, auth.accessCode);
      if (error) return error;
      const detail = resource!.details.find((d) => d.id === detailId);
      if (!detail) return notFound('Sub-expense not found');
      if (typeof patch.name === 'string') detail.name = patch.name.trim() || detail.name;
      if (typeof patch.price === 'number') detail.price = patch.price;
      if (patch.currency === 'RON' || patch.currency === 'EUR') detail.currency = patch.currency;
      if (typeof patch.isPaid === 'boolean') detail.isPaid = patch.isPaid;
      return writeBackWithEtag(auth.accessCode, resource!, etag);
    } catch (err) {
      return serverError(err);
    }
  },
});

