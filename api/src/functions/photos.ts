import { app, HttpRequest } from '@azure/functions';
import { authenticate, requireUser } from '../middleware/auth';
import { expensesContainer } from '../services/cosmos';
import { deletePhoto as deleteBlob, uploadPhoto } from '../services/blob';
import { auditPhotoAdd, auditPhotoDelete } from '../services/audit';
import { ok, badRequest, notFound, serverError } from '../shared/responses';
import { Expense } from '../shared/types';
import { newExpensePhoto, withPhotoUrls } from '../shared/transformers';

const MAX_ATTACHMENTS = 30;

app.http('addPhoto', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}/photos',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const userErr = requireUser(auth);
      if (userErr) return userErr;
      const id = request.params.id;
      if (!id) return badRequest('Missing id');

      const form = await request.formData();
      const file = form.get('photo');
      if (!file || typeof file === 'string') return badRequest('Missing photo file');

      const buffer = Buffer.from(await (file as File).arrayBuffer());
      const mime = (file as File).type || 'application/octet-stream';
      const fileName = (file as File).name || undefined;

      const blobName = await uploadPhoto(buffer, mime, auth.accessCode, id, fileName);
      const photo = newExpensePhoto(blobName, mime, fileName);

      try {
        const { resource, etag } = await expensesContainer().item(id, auth.accessCode).read<Expense>();
        if (!resource) {
          await deleteBlob(blobName);
          return notFound();
        }
        if ((resource.photos?.length ?? 0) >= MAX_ATTACHMENTS) {
          await deleteBlob(blobName);
          return badRequest(`Maximum ${MAX_ATTACHMENTS} attachments per expense`);
        }
        resource.photos.push(photo);
        resource.updatedAt = new Date().toISOString();
        const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(resource, {
          accessCondition: etag ? { type: 'IfMatch', condition: etag } : undefined,
        });
        const after = updated as Expense;
        await auditPhotoAdd({
          workspaceId: auth.accessCode,
          userId: auth.user!.id,
          userName: auth.user!.name,
          expenseId: id,
          expenseTitle: after.title,
        });
        return ok(withPhotoUrls(after));
      } catch (err: any) {
        if (err?.code === 412) {
          const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!r.resource) {
            await deleteBlob(blobName);
            return notFound();
          }
          if ((r.resource.photos?.length ?? 0) >= MAX_ATTACHMENTS) {
            await deleteBlob(blobName);
            return badRequest(`Maximum ${MAX_ATTACHMENTS} attachments per expense`);
          }
          r.resource.photos.push(photo);
          r.resource.updatedAt = new Date().toISOString();
          const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(r.resource);
          const after = updated as Expense;
          await auditPhotoAdd({
            workspaceId: auth.accessCode,
            userId: auth.user!.id,
            userName: auth.user!.name,
            expenseId: id,
            expenseTitle: after.title,
          });
          return ok(withPhotoUrls(after));
        }
        if (err?.code === 404) {
          await deleteBlob(blobName);
          return notFound();
        }
        throw err;
      }
    } catch (err) {
      return serverError(err);
    }
  },
});

app.http('deletePhoto', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}/photos/{photoId}',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const userErr = requireUser(auth);
      if (userErr) return userErr;
      const id = request.params.id;
      const photoId = request.params.photoId;
      if (!id || !photoId) return badRequest('Missing id');

      try {
        const { resource, etag } = await expensesContainer().item(id, auth.accessCode).read<Expense>();
        if (!resource) return notFound();
        const target = resource.photos.find((p) => p.id === photoId);
        if (target) {
          await deleteBlob(target.blobName);
        }
        resource.photos = resource.photos.filter((p) => p.id !== photoId);
        resource.updatedAt = new Date().toISOString();
        const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(resource, {
          accessCondition: etag ? { type: 'IfMatch', condition: etag } : undefined,
        });
        const after = updated as Expense;
        await auditPhotoDelete({
          workspaceId: auth.accessCode,
          userId: auth.user!.id,
          userName: auth.user!.name,
          expenseId: id,
          expenseTitle: after.title,
        });
        return ok(withPhotoUrls(after));
      } catch (err: any) {
        if (err?.code === 404) return notFound();
        if (err?.code === 412) {
          const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!r.resource) return notFound();
          const target = r.resource.photos.find((p) => p.id === photoId);
          if (target) await deleteBlob(target.blobName);
          r.resource.photos = r.resource.photos.filter((p) => p.id !== photoId);
          const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(r.resource);
          const after = updated as Expense;
          await auditPhotoDelete({
            workspaceId: auth.accessCode,
            userId: auth.user!.id,
            userName: auth.user!.name,
            expenseId: id,
            expenseTitle: after.title,
          });
          return ok(withPhotoUrls(after));
        }
        throw err;
      }
    } catch (err) {
      return serverError(err);
    }
  },
});

