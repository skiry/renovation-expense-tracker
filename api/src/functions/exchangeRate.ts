import { app, HttpRequest } from '@azure/functions';
import { getEurToRon } from '../services/bnr';
import { ok, serverError } from '../shared/responses';

app.http('exchangeRate', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'exchange-rate',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const forceRefresh = request.method === 'POST';
      const rate = await getEurToRon(forceRefresh);
      return ok(rate);
    } catch (err) {
      return serverError(err);
    }
  },
});

