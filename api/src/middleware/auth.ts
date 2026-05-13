import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { workspacesContainer } from '../services/cosmos';
import { unauthorized } from '../shared/responses';
import { Workspace, WorkspaceUser } from '../shared/types';

export interface AuthContext {
  accessCode: string;
  workspace: Workspace;
  /** Set when the request carries a valid x-user-id header matching a user in this workspace. */
  user?: WorkspaceUser;
}

/**
 * Validate the x-access-code header against Cosmos workspaces.
 * If the code equals MASTER_ACCESS_CODE env var and the master workspace doesn't exist yet,
 * it's created on the fly (bootstrap).
 *
 * If the request also carries x-user-id, the matching user is attached to the context.
 *
 * Returns either an AuthContext (success) or an HttpResponseInit (401 to short-circuit).
 */
export async function authenticate(request: HttpRequest): Promise<AuthContext | HttpResponseInit> {
  const code = (request.headers.get('x-access-code') || '').trim();
  if (!code) return unauthorized('Missing x-access-code header');

  const wsContainer = workspacesContainer();

  let workspace: Workspace | undefined;

  try {
    const { resource } = await wsContainer.item(code, code).read<Workspace>();
    if (resource) workspace = resource;
  } catch (err: any) {
    if (err?.code !== 404) throw err;
  }

  if (!workspace) {
    const master = (process.env.MASTER_ACCESS_CODE || '').trim();
    if (master && code === master) {
      workspace = {
        id: code,
        createdAt: new Date().toISOString(),
        isMaster: true,
        users: [],
      };
      await wsContainer.items.upsert(workspace);
    } else {
      return unauthorized('Invalid access code');
    }
  }

  // Backfill users array if older workspace docs lack it
  if (!workspace.users) workspace.users = [];

  const userId = (request.headers.get('x-user-id') || '').trim();
  const user = userId ? workspace.users.find((u) => u.id === userId) : undefined;

  return { accessCode: code, workspace, user };
}

/** Guard for mutation handlers that need a user attribution. */
export function requireUser(auth: AuthContext): HttpResponseInit | null {
  if (!auth.user) return unauthorized('Missing or invalid x-user-id (no user selected)');
  return null;
}

