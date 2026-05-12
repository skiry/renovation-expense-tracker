import { app, HttpRequest } from '@azure/functions';
import { workspacesContainer } from '../services/cosmos';
import { ok, badRequest, serverError } from '../shared/responses';
import { Workspace } from '../shared/types';

app.http('verifyAccessCode', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/verify',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const body = (await request.json()) as { code?: string };
      const code = (body.code || '').trim();
      if (!code) return badRequest('Missing code');

      try {
        const { resource } = await workspacesContainer().item(code, code).read<Workspace>();
        if (resource) return ok({ exists: true, isMaster: !!resource.isMaster });
      } catch (err: any) {
        if (err?.code !== 404) throw err;
      }

      // Bootstrap: treat master code as existing even if not yet stored
      const master = (process.env.MASTER_ACCESS_CODE || '').trim();
      if (master && code === master) return ok({ exists: true, isMaster: true });

      return ok({ exists: false });
    } catch (err) {
      return serverError(err);
    }
  },
});

app.http('createWorkspace', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/create',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const body = (await request.json()) as { code?: string };
      const code = (body.code || '').trim();
      if (code.length < 6) return ok({ created: false, reason: 'Codul trebuie să aibă minim 6 caractere.' });

      const wsContainer = workspacesContainer();

      try {
        const { resource } = await wsContainer.item(code, code).read<Workspace>();
        if (resource) return ok({ created: false, reason: 'Codul există deja. Alege altul.' });
      } catch (err: any) {
        if (err?.code !== 404) throw err;
      }

      // Also reject if it's the master code reserved for bootstrap
      const master = (process.env.MASTER_ACCESS_CODE || '').trim();
      if (master && code === master) {
        return ok({ created: false, reason: 'Acest cod este rezervat.' });
      }

      const ws: Workspace = {
        id: code,
        createdAt: new Date().toISOString(),
        isMaster: false,
      };
      await wsContainer.items.create(ws);
      return ok({ created: true });
    } catch (err) {
      return serverError(err);
    }
  },
});
