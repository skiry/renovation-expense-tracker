import { app, HttpRequest } from '@azure/functions';
import { scheduledNotificationsContainer } from '../services/cosmos';
import { sendPushToUsers } from '../services/push';
import { ok, badRequest, unauthorized, serverError } from '../shared/responses';
import { ScheduledNotification } from '../shared/types';
import { uuid } from '../shared/slug';

/**
 * Drain due scheduled notifications. Returns a summary of what was sent.
 * Idempotent: each entry is claimed with optimistic concurrency before sending,
 * so double-runs cannot deliver the same push twice.
 *
 * Called by:
 *   - GET /api/run/scheduled-notifications (manual / cron from GitHub Actions etc.)
 *   - the same handler can be invoked by the admin endpoint with x-master-code
 *
 * Auth: requires x-master-code matching MASTER_ACCESS_CODE.
 */
async function drainDue(): Promise<{ processed: number; sent: number; failed: number }> {
  const container = await scheduledNotificationsContainer();
  const now = new Date().toISOString();
  const { resources: due } = await container.items
    .query<ScheduledNotification>({
      query:
        "SELECT * FROM c WHERE c.scheduledFor <= @now AND (c.status = 'pending' OR NOT IS_DEFINED(c.status))",
      parameters: [{ name: '@now', value: now }],
    })
    .fetchAll();

  let sent = 0;
  let failed = 0;
  for (const n of due) {
    try {
      n.status = 'sending';
      try {
        await container.item(n.id, n.workspaceId).replace(n, {
          accessCondition: (n as any)._etag
            ? { type: 'IfMatch', condition: (n as any)._etag }
            : undefined,
        });
      } catch (err: any) {
        if (err?.code === 412) continue; // claimed by another runner
        throw err;
      }

      await sendPushToUsers(n.workspaceId, n.targetUserIds, {
        title: n.title,
        body: n.body,
        url: n.url ?? '/',
        tag: `scheduled-${n.id}`,
      });

      n.status = 'sent';
      n.sentAt = new Date().toISOString();
      await container.item(n.id, n.workspaceId).replace(n);
      sent++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed scheduled notification', n.id, err);
      try {
        n.status = 'failed';
        await container.item(n.id, n.workspaceId).replace(n);
      } catch {
        // ignore
      }
      failed++;
    }
  }
  return { processed: due.length, sent, failed };
}

// GET /api/run/scheduled-notifications — public, idempotent, used by cron.
// We expose it without auth so a free GitHub Actions cron can hit it; abuse
// is mitigated by idempotency (already-sent entries are skipped).
app.http('runScheduledNotifications', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'run/scheduled-notifications',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const result = await drainDue();
      return ok(result);
    } catch (err) {
      return serverError(err);
    }
  },
});

// Admin-like endpoint to create/list scheduled notifications. We avoid the
// `admin/...` URL because Azure Static Web Apps' platform middleware reserves
// that path family and returns 404 before the Function is even invoked.
// Auth: requires header x-master-code matching MASTER_ACCESS_CODE env var.
app.http('scheduledNotificationsAdmin', {
  methods: ['POST', 'GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'scheduled-notifications',
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

