import { app, HttpRequest } from '@azure/functions';
import { authenticate } from '../middleware/auth';
import { historyContainer } from '../services/cosmos';
import { ok, serverError } from '../shared/responses';
import { HistoryEntry } from '../shared/types';

// GET /history?limit=50&before=<isoTimestamp>
app.http('history', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'history',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;

      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
      const before = url.searchParams.get('before');

      const c = await historyContainer();
      const where = before
        ? 'WHERE c.workspaceId = @ws AND c.timestamp < @before'
        : 'WHERE c.workspaceId = @ws';
      const parameters: { name: string; value: string }[] = [{ name: '@ws', value: auth.accessCode }];
      if (before) parameters.push({ name: '@before', value: before });

      const { resources } = await c.items
        .query<HistoryEntry>(
          {
            query: `SELECT TOP ${limit} * FROM c ${where} ORDER BY c.timestamp DESC`,
            parameters,
          },
          { partitionKey: auth.accessCode }
        )
        .fetchAll();

      return ok({
        entries: resources,
        nextBefore: resources.length === limit ? resources[resources.length - 1].timestamp : null,
      });
    } catch (err) {
      return serverError(err);
    }
  },
});
