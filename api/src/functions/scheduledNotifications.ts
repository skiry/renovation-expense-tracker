import { app, InvocationContext, Timer, HttpRequest } from '@azure/functions';
import { scheduledNotificationsContainer } from '../services/cosmos';
import { sendPushToUsers } from '../services/push';
import { ok, badRequest, unauthorized, serverError } from '../shared/responses';
import { ScheduledNotification } from '../shared/types';
import { uuid } from '../shared/slug';

// Timer: every minute on the minute.
// Cron format for Azure Functions: {sec} {min} {hr} {day} {month} {dow}.
app.timer('scheduledNotificationsRunner', {
  schedule: '0 */1 * * * *',
  handler: async (_timer: Timer, context: InvocationContext) => {
    try {
      const container = await scheduledNotificationsContainer();
      const now = new Date().toISOString();

      const { resources: due } = await container.items
        .query<ScheduledNotification>({
          query:
            "SELECT * FROM c WHERE c.scheduledFor <= @now AND (c.status = 'pending' OR NOT IS_DEFINED(c.status))",
          parameters: [{ name: '@now', value: now }],
        })
        .fetchAll();

      if (due.length === 0) {
        context.log('scheduledNotificationsRunner: nothing due');
        return;
      }

      for (const n of due) {
        try {
          // Claim with optimistic concurrency via _etag to avoid duplicate sends
          n.status = 'sending';
          try {
            await container.item(n.id, n.workspaceId).replace(n, {
              accessCondition: (n as any)._etag
                ? { type: 'IfMatch', condition: (n as any)._etag }
                : undefined,
            });
          } catch (err: any) {
            if (err?.code === 412) {
              context.log(`Skipping ${n.id}: claimed by another run`);
              continue;
            }
            throw err;
          }

          const result = await sendPushToUsers(n.workspaceId, n.targetUserIds, {
            title: n.title,
            body: n.body,
            url: n.url ?? '/',
            tag: `scheduled-${n.id}`,
          });

          n.status = 'sent';
          n.sentAt = new Date().toISOString();
          await container.item(n.id, n.workspaceId).replace(n);
          context.log(
            `Scheduled notification ${n.id} sent to ${result.delivered}/${result.total} subscribers.`
          );
        } catch (err) {
          context.error(`Failed scheduled notification ${n.id}:`, err);
          try {
            n.status = 'failed';
            await container.item(n.id, n.workspaceId).replace(n);
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      context.error('scheduledNotificationsRunner top-level error:', err);
    }
  },
});

// Admin endpoint to create a scheduled notification.
// Auth: requires header x-master-code matching MASTER_ACCESS_CODE env var.
// Body:
//   {
//     "workspaceId": "1234",
//     "scheduledFor": "2026-05-31T17:00:00.000Z",  // ISO UTC
//     "targetUserIds": ["u-abc"],                  // or "all"
//     "title": "...", "body": "...", "url": "/surprise",
//     "timezone": "Europe/Bucharest",              // optional, informational
//     "createdByName": "Ionut"                     // optional
//   }
app.http('scheduledNotificationsAdmin', {
  methods: ['POST', 'GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'admin/scheduled-notifications',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const master = (process.env.MASTER_ACCESS_CODE || '').trim();
      const provided = (request.headers.get('x-master-code') || '').trim();
      if (!master || provided !== master) return unauthorized('Bad master code');

      const container = await scheduledNotificationsContainer();

      if (request.method === 'GET') {
        const { resources } = await container.items
          .query<ScheduledNotification>('SELECT * FROM c ORDER BY c.scheduledFor ASC')
          .fetchAll();
        return ok(resources);
      }

      const body = (await request.json()) as Partial<ScheduledNotification>;
      if (!body.workspaceId || !body.scheduledFor || !body.title || !body.body || !body.targetUserIds) {
        return badRequest('Missing required fields: workspaceId, scheduledFor, targetUserIds, title, body');
      }
      if (Number.isNaN(Date.parse(body.scheduledFor))) {
        return badRequest('scheduledFor must be a valid ISO date string');
      }

      const rec: ScheduledNotification = {
        id: body.id ?? uuid(),
        workspaceId: body.workspaceId,
        scheduledFor: new Date(body.scheduledFor).toISOString(),
        timezone: body.timezone,
        targetUserIds: body.targetUserIds,
        title: body.title,
        body: body.body,
        url: body.url,
        status: 'pending',
        createdBy: body.createdBy ?? 'admin',
        createdByName: body.createdByName,
        createdAt: new Date().toISOString(),
      };

      await container.items.upsert(rec);
      return ok(rec);
    } catch (err) {
      return serverError(err);
    }
  },
});
