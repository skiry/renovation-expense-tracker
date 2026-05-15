import { app, HttpRequest } from '@azure/functions';
import { authenticate, requireUser } from '../middleware/auth';
import { pushSubscriptionsContainer } from '../services/cosmos';
import { ok, badRequest, notFound, serverError } from '../shared/responses';
import { uuid } from '../shared/slug';
import { PushSubscriptionRecord } from '../shared/types';

// GET /push/config — returns the VAPID public key
app.http('pushConfig', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'push/config',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    return ok({ publicKey, enabled: !!publicKey });
  },
});

// POST /push/subscribe — body: { endpoint, keys: { p256dh, auth }, deviceLabel? }
app.http('pushSubscribe', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'push/subscribe',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const userErr = requireUser(auth);
      if (userErr) return userErr;

      const body = (await request.json()) as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
        deviceLabel?: string;
      };
      const endpoint = body.endpoint?.trim();
      const p256dh = body.keys?.p256dh?.trim();
      const authKey = body.keys?.auth?.trim();
      if (!endpoint || !p256dh || !authKey) return badRequest('Missing endpoint / keys');

      const container = await pushSubscriptionsContainer();

      // De-dupe by endpoint within this workspace
      const { resources: existing } = await container.items
        .query<PushSubscriptionRecord>(
          {
            query: 'SELECT * FROM c WHERE c.workspaceId = @ws AND c.endpoint = @ep',
            parameters: [
              { name: '@ws', value: auth.accessCode },
              { name: '@ep', value: endpoint },
            ],
          },
          { partitionKey: auth.accessCode }
        )
        .fetchAll();

      // If the same endpoint exists, refresh its user binding and keys (device
      // can change owner if multiple users share a phone).
      if (existing.length > 0) {
        const updated: PushSubscriptionRecord = {
          ...existing[0],
          userId: auth.user!.id,
          userName: auth.user!.name,
          keys: { p256dh, auth: authKey },
          deviceLabel: body.deviceLabel ?? existing[0].deviceLabel,
        };
        await container.items.upsert(updated);
        return ok({ subscribed: true, id: updated.id });
      }

      const rec: PushSubscriptionRecord = {
        id: uuid(),
        workspaceId: auth.accessCode,
        userId: auth.user!.id,
        userName: auth.user!.name,
        endpoint,
        keys: { p256dh, auth: authKey },
        deviceLabel: body.deviceLabel,
        createdAt: new Date().toISOString(),
      };
      await container.items.create(rec);
      return ok({ subscribed: true, id: rec.id });
    } catch (err) {
      return serverError(err);
    }
  },
});

// POST /push/unsubscribe — body: { endpoint }
app.http('pushUnsubscribe', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'push/unsubscribe',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;

      const body = (await request.json()) as { endpoint?: string };
      const endpoint = body.endpoint?.trim();
      if (!endpoint) return badRequest('Missing endpoint');

      const container = await pushSubscriptionsContainer();
      const { resources } = await container.items
        .query<PushSubscriptionRecord>(
          {
            query: 'SELECT * FROM c WHERE c.workspaceId = @ws AND c.endpoint = @ep',
            parameters: [
              { name: '@ws', value: auth.accessCode },
              { name: '@ep', value: endpoint },
            ],
          },
          { partitionKey: auth.accessCode }
        )
        .fetchAll();

      if (resources.length === 0) return notFound('Subscription not found');

      await Promise.allSettled(
        resources.map((r) => container.item(r.id, auth.accessCode).delete())
      );
      return ok({ unsubscribed: true });
    } catch (err) {
      return serverError(err);
    }
  },
});
