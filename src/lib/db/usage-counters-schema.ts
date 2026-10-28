// DEPLOY ORDER (#17/#57): 1) #9 baseline migration lands; 2) the usage_counters
// migration is generated and applied in prod; 3) only then deploy this code.
// Without the table the limiter and alert dedupe fail closed: every cache-miss
// search returns LIMITER_UNAVAILABLE (503).

/**
 * #17/#57: fixed-window counters for rate limits and alert dedupe.
 *
 * Why: neon-http has no interactive transactions, so a counter must be one
 * atomic statement. A row per (bucket, key, window_start) lets
 * `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`
 * serve both the per-IP limiter and the once-per-day cost alerts.
 * What: `usage_counters` table. Migration: generate after the #9 baseline.
 * Test: `src/lib/rate-limit/__tests__/rate-limit.test.ts`
 */

import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const usageCounters = pgTable(
  'usage_counters',
  {
    bucket: text('bucket').notNull(),
    key: text('key').notNull(),
    window_start: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    windowUnique: unique('usage_counters_bucket_key_window_unique').on(
      table.bucket,
      table.key,
      table.window_start
    ),
    // #17: lets a cleanup job drop expired windows cheaply.
    windowStartIdx: index('idx_usage_counters_window_start').on(table.window_start),
  })
);

export type UsageCounter = typeof usageCounters.$inferSelect;
