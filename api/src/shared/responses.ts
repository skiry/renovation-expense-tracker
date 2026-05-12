import { HttpResponseInit } from '@azure/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-access-code, If-Match',
  'Access-Control-Expose-Headers': 'ETag',
};

export function ok(body: unknown, extraHeaders?: Record<string, string>): HttpResponseInit {
  return {
    status: 200,
    jsonBody: body,
    headers: { ...CORS_HEADERS, ...(extraHeaders ?? {}) },
  };
}

export function noContent(): HttpResponseInit {
  return { status: 204, headers: CORS_HEADERS };
}

export function badRequest(message: string): HttpResponseInit {
  return { status: 400, jsonBody: { error: message }, headers: CORS_HEADERS };
}

export function unauthorized(message = 'Invalid or missing access code'): HttpResponseInit {
  return { status: 401, jsonBody: { error: message }, headers: CORS_HEADERS };
}

export function notFound(message = 'Not found'): HttpResponseInit {
  return { status: 404, jsonBody: { error: message }, headers: CORS_HEADERS };
}

export function conflict(message = 'Resource was modified by another user'): HttpResponseInit {
  return { status: 412, jsonBody: { error: message }, headers: CORS_HEADERS };
}

export function serverError(err: unknown): HttpResponseInit {
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, jsonBody: { error: message }, headers: CORS_HEADERS };
}
