/**
 * #17: per-caller fixed-window rate limit backed by `usage_counters`.
 *
 * Why: anonymous semantic search drives paid embedding calls with no ceiling.
 * What: `checkRateLimit` increments the caller's window and allows the call
 * while the count is within the bucket's limit. A counter failure blocks the
 * call (fail closed) and is logged.
 * Test: `src/lib/rate-limit/__tests__/rate-limit.test.ts`
 */

import { clientIpFrom } from './client-ip';
import { defaultUsageDb, incrementCounter, type UsageDb, windowStart } from './counter';
import { RATE_LIMITS, type RateLimitBucket, UNKNOWN_IP_KEY } from './limits';

export { clientIpFrom } from './client-ip';
export { RATE_LIMITS, type RateLimitBucket, UNKNOWN_IP_KEY } from './limits';

export type RateLimitResult =
  | { allowed: true; count: number; limit: number }
  | { allowed: false; reason: 'limited' | 'unavailable'; retryAfterSec: number; limit: number };

export interface RateLimitOptions {
  db?: UsageDb;
  now?: Date;
}

/** Signed-in callers are keyed by user id; anonymous ones by IP, or the shared unknown key. */
export function rateLimitKey(userId: string | null, headers: Pick<Headers, 'get'>): string {
  if (userId) return `user:${userId}`;
  const ip = clientIpFrom(headers);
  return ip ? `ip:${ip}` : UNKNOWN_IP_KEY;
}

export async function checkRateLimit(
  bucket: RateLimitBucket,
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket];
  const now = options.now ?? new Date();
  const start = windowStart(now, rule.windowSec);
  const retryAfterSec = Math.max(
    1,
    Math.ceil((start.getTime() + rule.windowSec * 1000 - now.getTime()) / 1000)
  );
  try {
    const db = options.db ?? (await defaultUsageDb());
    const count = await incrementCounter(db, `rl:${bucket}`, key, start);
    if (count <= rule.limit) return { allowed: true, count, limit: rule.limit };
    return { allowed: false, reason: 'limited', retryAfterSec, limit: rule.limit };
  } catch (error) {
    // #17: fail closed — an unreadable counter must not let paid calls through.
    console.error(`[RateLimit] counter failed for ${bucket}; blocking call:`, error);
    return { allowed: false, reason: 'unavailable', retryAfterSec, limit: rule.limit };
  }
}

/** Reads the request headers (Server Action or Route Handler scope) and checks the limit. */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  userId: string | null,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  let key = UNKNOWN_IP_KEY;
  try {
    const { headers } = await import('next/headers');
    key = rateLimitKey(userId, await headers());
  } catch {
    // #17: outside a request scope there is no IP; share the unknown bucket.
    key = userId ? `user:${userId}` : UNKNOWN_IP_KEY;
  }
  return checkRateLimit(bucket, key, options);
}
