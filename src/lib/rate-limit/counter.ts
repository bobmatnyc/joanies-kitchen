/**
 * #17/#57: atomic fixed-window counter over `usage_counters`.
 *
 * Why: neon-http cannot hold a transaction open, so read-then-write would race.
 * What: one `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`.
 * Test: `src/lib/rate-limit/__tests__/rate-limit.test.ts`
 */

import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { usageCounters } from '@/lib/db/usage-counters-schema';

/** Any drizzle Postgres client: neon-http in production, PGlite in tests. */
export type UsageDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/** Lazily resolves the app db; '@/lib/db' throws at import when DATABASE_URL is unset. */
export async function defaultUsageDb(): Promise<UsageDb> {
  const { db } = await import('@/lib/db');
  return db as unknown as UsageDb;
}

/** Start of the fixed window containing `now`, aligned to the epoch. */
export function windowStart(now: Date, windowSec: number): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/** Midnight UTC of `now`'s day. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Why: every limiter and alert dedupe needs one race-free increment.
 * What: increments (bucket, key, window) and returns the new count; the first
 * caller in a window gets 1.
 * Test: `concurrent increments are atomic`
 */
export async function incrementCounter(
  db: UsageDb,
  bucket: string,
  key: string,
  start: Date
): Promise<number> {
  const rows = await db
    .insert(usageCounters)
    .values({ bucket, key, window_start: start, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.bucket, usageCounters.key, usageCounters.window_start],
      set: { count: sql`${usageCounters.count} + 1`, updated_at: sql`now()` },
    })
    .returning({ count: usageCounters.count });
  const count = rows[0]?.count;
  if (typeof count !== 'number') throw new Error('usage_counters upsert returned no row');
  return count;
}
