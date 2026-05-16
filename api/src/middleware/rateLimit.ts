/**
 * In-memory sliding-window rate limiter, intended for brute-force protection on
 * authentication endpoints. On SWA managed Functions the host may run multiple
 * worker instances, so the limit is enforced per-instance — not strict, but
 * sufficient to slow down trivial brute-force attempts. For stronger protection
 * we'd need a shared store (Cosmos/Redis), but that adds latency to every call.
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Returns null if the request is allowed, or a 429 response if throttled.
 *   key: a stable identifier (typically IP or `IP|endpoint`).
 *   limit: max requests per window.
 *   windowMs: window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): HttpResponseInit | null {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      status: 429,
      jsonBody: { error: 'Prea multe încercări. Reîncearcă peste câteva minute.' },
      headers: {
        'Retry-After': String(retryAfter),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-access-code, x-user-id, x-master-code, If-Match',
      },
    };
  }
  return null;
}

/** Best-effort client IP extraction. SWA forwards the real IP in x-forwarded-for. */
export function clientIp(request: HttpRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for: "client, proxy1, proxy2" → take the first
    return xff.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Periodic cleanup to prevent unbounded memory growth in long-running hosts.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();
