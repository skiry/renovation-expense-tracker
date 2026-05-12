import { app, HttpRequest } from '@azure/functions';
import { authenticate } from '../middleware/auth';
import { expensesContainer } from '../services/cosmos';
import { deletePhoto as deleteBlob, uploadPhoto } from '../services/blob';
import { ok, badRequest, notFound, serverError } from '../shared/responses';
import { Expense } from '../shared/types';
import { newExpensePhoto, withPhotoUrls } from '../shared/transformers';

app.http('addPhoto', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'expenses/{id}/photos',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const id = request.params.id;
      if (!id) return badRequest('Missing id');

      const form = await request.formData();
      const file = form.get('photo');
      if (!file || typeof file === 'string') return badRequest('Missing photo file');

      const buffer = Buffer.from(await (file as File).arrayBuffer());
      const mime = (file as File).type || 'image/jpeg';

      const blobName = await uploadPhoto(buffer, mime, auth.accessCode, id);
      const photo = newExpensePhoto(blobName);

      try {
        const { resource, etag } = await expensesContainer().item(id, auth.accessCode).read<Expense>();
        if (!resource) {
          // If the expense vanished between auth and upload, delete the just-uploaded blob
          await deleteBlob(blobName);
          return notFound();
        }
        resource.photos.push(photo);
        resource.updatedAt = new Date().toISOString();
        const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(resource, {
          accessCondition: etag ? { type: 'IfMatch', condition: etag } : undefined,
        });
        return ok(withPhotoUrls(updated as Expense));
      } catch (err: any) {
        if (err?.code === 412) {
          // Conflict: retry once with fresh read
          const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!r.resource) {
            await deleteBlob(blobName);
            return notFound();
          }
          r.resource.photos.push(photo);
          r.resource.updatedAt = new Date().toISOString();
          const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(r.resource);
          return ok(withPhotoUrls(updated as Expense));
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
        return ok(withPhotoUrls(updated as Expense));
      } catch (err: any) {
        if (err?.code === 404) return notFound();
        if (err?.code === 412) {
          // Conflict: retry with fresh read
          const r = await expensesContainer().item(id, auth.accessCode).read<Expense>();
          if (!r.resource) return notFound();
          const target = r.resource.photos.find((p) => p.id === photoId);
          if (target) await deleteBlob(target.blobName);
          r.resource.photos = r.resource.photos.filter((p) => p.id !== photoId);
          const { resource: updated } = await expensesContainer().item(id, auth.accessCode).replace(r.resource);
          return ok(withPhotoUrls(updated as Expense));
        }
        throw err;
      }
    } catch (err) {
      return serverError(err);
    }
  },
});
