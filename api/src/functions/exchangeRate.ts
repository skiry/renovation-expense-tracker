import { app, HttpRequest } from '@azure/functions';
import { getEurToRon } from '../services/bnr';
import { ok, serverError } from '../shared/responses';

app.http('exchangeRateGet', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'exchange-rate',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const rate = await getEurToRon(false);
      return ok(rate);
    } catch (err) {
      return serverError(err);
    }
  },
});

app.http('exchangeRateRefresh', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'exchange-rate',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const rate = await getEurToRon(true);
      return ok(rate);
    } catch (err) {
      return serverError(err);
    }
  },
});
