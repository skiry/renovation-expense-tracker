import { app, HttpRequest } from '@azure/functions';
import { authenticate } from '../middleware/auth';
import { workspacesContainer } from '../services/cosmos';
import { ok, badRequest, notFound, serverError } from '../shared/responses';
import { uuid } from '../shared/slug';
import { Workspace, WorkspaceUser } from '../shared/types';

// /users — list (GET) and create (POST)
app.http('usersCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;

      if (request.method === 'GET') {
        return ok(auth.workspace.users ?? []);
      }

      // POST
      const body = ((await request.json()) ?? {}) as { name?: string };
      const name = (body.name ?? '').trim();
      if (!name) return badRequest('Numele este obligatoriu');
      if (name.length > 40) return badRequest('Numele are max 40 caractere');

      // Reload workspace fresh to avoid clobbering concurrent user creations.
      try {
        const r = await workspacesContainer().item(auth.accessCode, auth.accessCode).read<Workspace>();
        const ws: Workspace = r.resource ?? { ...auth.workspace, users: [] as WorkspaceUser[] };
        if (!ws.users) ws.users = [];

        if (ws.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
          return badRequest('Există deja un utilizator cu acest nume');
        }
        const user: WorkspaceUser = { id: uuid(), name, createdAt: new Date().toISOString() };
        ws.users.push(user);
        const { resource } = await workspacesContainer().items.upsert<Workspace>(ws);
        return ok({ user, users: resource?.users ?? [] });
      } catch (err: any) {
        throw err;
      }
    } catch (err) {
      return serverError(err);
    }
  },
});

// /users/{id} — DELETE
app.http('usersItem', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{id}',
  handler: async (request: HttpRequest) => {
    if (request.method === 'OPTIONS') return ok({});
    try {
      const auth = await authenticate(request);
      if (!('accessCode' in auth)) return auth;
      const id = request.params.id;
      if (!id) return badRequest('Missing id');

      const r = await workspacesContainer().item(auth.accessCode, auth.accessCode).read<Workspace>();
      if (!r.resource) return notFound();
      const ws = r.resource;
      if (!ws.users) ws.users = [];
      const before = ws.users.length;
      ws.users = ws.users.filter((u) => u.id !== id);
      if (ws.users.length === before) return notFound('User not found');
      await workspacesContainer().items.upsert(ws);
      return ok({ users: ws.users });
    } catch (err) {
      return serverError(err);
    }
  },
});
