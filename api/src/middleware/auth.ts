import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { workspacesContainer } from '../services/cosmos';
import { unauthorized } from '../shared/responses';
import { Workspace } from '../shared/types';

export interface AuthContext {
  accessCode: string;
  workspace: Workspace;
}

/**
 * Validate the x-access-code header against Cosmos workspaces.
 * If the code equals MASTER_ACCESS_CODE env var and the master workspace doesn't exist yet,
 * it's created on the fly (bootstrap).
 *
 * Returns either an AuthContext (success) or an HttpResponseInit (401 to short-circuit).
 */
export async function authenticate(request: HttpRequest): Promise<AuthContext | HttpResponseInit> {
  const code = (request.headers.get('x-access-code') || '').trim();
  if (!code) return unauthorized('Missing x-access-code header');

  const wsContainer = workspacesContainer();

  // Try to read the workspace document.
  try {
    const { resource } = await wsContainer.item(code, code).read<Workspace>();
    if (resource) return { accessCode: code, workspace: resource };
  } catch (err: any) {
    if (err?.code !== 404) throw err;
  }

  // Not found. If this is the master code, bootstrap the master workspace.
  const master = (process.env.MASTER_ACCESS_CODE || '').trim();
  if (master && code === master) {
    const ws: Workspace = {
      id: code,
      createdAt: new Date().toISOString(),
      isMaster: true,
    };
    await wsContainer.items.upsert(ws);
    return { accessCode: code, workspace: ws };
  }

  return unauthorized('Invalid access code');
}

export function isHttpResponse(value: unknown): value is HttpResponseInit {
  return typeof value === 'object' && value !== null && 'status' in value && !('workspace' in value);
}
