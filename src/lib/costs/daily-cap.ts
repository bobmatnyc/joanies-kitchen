/**
 * #57: daily dollar ceiling across every paid AI, search and crawl call.
 *
 * Why: public traffic can drive unbounded paid calls; owner ruling D7c sets a
 * $10/day hard stop with an alert to the operator.
 * What: `assertWithinDailyCap()` sums today's (UTC) `crawl_cost_events` spend
 * — the single ledger every `trackCost`/`withChatCostTracking` writer books
 * into — and throws `PaidCallBlockedError` at or above the cap, or when the
 * spend query fails (fail closed). Crossing 80% and 100% logs one
 * `[ALERT:cost-ceiling]` error per threshold per UTC day, deduped through
 * `usage_counters`; if that dedupe write fails the alert is still logged.
 *
 * Known limits (#57): spend can undercount, because `trackCost` fails open and
 * a lost ledger write is invisible to this sum. Concurrent callers can also
 * overshoot the cap slightly: the check runs before the spend is booked
 * (check-then-spend race), so calls in flight at the crossing all proceed.
 * Test: `src/lib/costs/__tests__/daily-cap.test.ts`
 */

import { gte, sql } from 'drizzle-orm';
import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';
import {
  defaultUsageDb,
  incrementCounter,
  type UsageDb,
  utcDayStart,
} from '@/lib/rate-limit/counter';

/** #57: owner ruling D7c. */
export const DAILY_COST_CAP_USD = 10;

/** #57: fractions of the cap that raise an alert, once each per UTC day. */
export const COST_ALERT_THRESHOLDS = [0.8, 1] as const;

/** #57: stable log tag for #55 monitoring. */
export const COST_ALERT_TAG = '[ALERT:cost-ceiling]';

export type PaidCallBlockedCode = 'COST_CAP_REACHED' | 'COST_GUARD_UNAVAILABLE';

/** Thrown before a paid call that the daily ceiling forbids. */
export class PaidCallBlockedError extends Error {
  readonly code: PaidCallBlockedCode;
  constructor(code: PaidCallBlockedCode, message: string) {
    super(message);
    this.name = 'PaidCallBlockedError';
    this.code = code;
  }
}

export function isPaidCallBlocked(error: unknown): error is PaidCallBlockedError {
  return error instanceof PaidCallBlockedError;
}

export interface DailyCapOptions {
  db?: UsageDb;
  now?: Date;
}

/** Sum of ledger USD booked since midnight UTC of `now`. */
export async function todaysSpendUsd(db: UsageDb, now: Date): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${crawlCostEvents.usd}), 0)` })
    .from(crawlCostEvents)
    .where(gte(crawlCostEvents.created_at, utcDayStart(now)));
  const total = Number(rows[0]?.total);
  if (!Number.isFinite(total)) throw new Error(`spend query returned ${rows[0]?.total}`);
  return total;
}

// Per-instance memo of thresholds already alerted, so a busy day skips the dedupe write.
const alerted = new Set<string>();

/** Test hook: forget the per-instance memo. */
export function resetCostAlertMemo(): void {
  alerted.clear();
}

/**
 * Why: the operator must hear about a crossing exactly once per threshold per day.
 * What: for each threshold at or below `spend`, increments the day's
 * `cost-alert` counter; only the caller that gets count 1 logs the alert.
 * Alert failures are logged and never change the guard's verdict.
 * Test: `the alert fires once per threshold per day`
 */
export async function maybeAlertCostThresholds(
  db: UsageDb,
  spendUsd: number,
  now: Date
): Promise<void> {
  const day = utcDayStart(now);
  const dayKey = day.toISOString().slice(0, 10);
  for (const fraction of COST_ALERT_THRESHOLDS) {
    if (spendUsd < DAILY_COST_CAP_USD * fraction) continue;
    const pct = Math.round(fraction * 100);
    const memoKey = `${dayKey}:${pct}`;
    if (alerted.has(memoKey)) continue;
    const line = `${COST_ALERT_TAG} threshold=${pct}% spend_usd=${spendUsd.toFixed(4)} cap_usd=${DAILY_COST_CAP_USD} day=${dayKey}`;
    let count: number;
    try {
      count = await incrementCounter(db, 'cost-alert', `pct:${pct}`, day);
    } catch (error) {
      // #57: a duplicate alert beats a lost one — emit undeduped when the counter fails.
      console.error(`[CostCap] alert dedupe failed for ${pct}% on ${dayKey}:`, error);
      console.error(`${line} dedupe=failed`);
      continue;
    }
    alerted.add(memoKey);
    // #57: no mail provider or admin-notification store exists; the tagged log is the channel.
    if (count === 1) console.error(line);
  }
}

/**
 * Why: a hard stop must run before the paid call, not after it is billed.
 * What: throws `PaidCallBlockedError('COST_CAP_REACHED')` when today's spend is
 * at or above `DAILY_COST_CAP_USD`, and `('COST_GUARD_UNAVAILABLE')` when the
 * spend cannot be read. Returns today's spend otherwise.
 * Test: `the guard blocks at $10`, `the guard blocks when the spend query errors`
 */
export async function assertWithinDailyCap(options: DailyCapOptions = {}): Promise<number> {
  const now = options.now ?? new Date();
  let db: UsageDb;
  let spend: number;
  try {
    db = options.db ?? (await defaultUsageDb());
    spend = await todaysSpendUsd(db, now);
  } catch (error) {
    // #57: fail closed — unknown spend blocks the paid call.
    console.error('[CostCap] spend query failed; blocking paid call:', error);
    throw new PaidCallBlockedError(
      'COST_GUARD_UNAVAILABLE',
      'Paid call blocked: daily spend could not be verified'
    );
  }
  await maybeAlertCostThresholds(db, spend, now);
  if (spend >= DAILY_COST_CAP_USD) {
    throw new PaidCallBlockedError(
      'COST_CAP_REACHED',
      `Paid call blocked: daily cost ceiling of $${DAILY_COST_CAP_USD} reached`
    );
  }
  return spend;
}
