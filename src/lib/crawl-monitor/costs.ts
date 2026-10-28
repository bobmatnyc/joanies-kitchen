// #6: ledger cost aggregation for the crawl-monitor read API (S3). Every SUM
// runs in Postgres; only the per-(provider, operation) group rows reach Node.

import { and, eq, gte, type SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';

export interface CostLine {
  usd: number;
  /** Part of `usd` that came from the rate table rather than a provider-reported cost. */
  estimatedUsd: number;
  events: number;
}

export interface ProviderCost extends CostLine {
  provider: string;
}

export interface OperationCost extends CostLine {
  provider: string;
  operation: string;
}

export interface CostBreakdown extends CostLine {
  /** Sorted by `usd` descending. */
  byProvider: ProviderCost[];
  /** One entry per (provider, operation) pair, sorted by `usd` descending. */
  byOperation: OperationCost[];
}

export interface CostSummary {
  /** UTC midnight of the current day. */
  todayStart: Date;
  /** UTC midnight of the first day of the current month. */
  monthStart: Date;
  today: CostBreakdown;
  month: CostBreakdown;
  allTime: CostBreakdown;
}

const usd = crawlCostEvents.usd;
const estimated = crawlCostEvents.estimated;

function sumUsd(where?: SQL) {
  return where
    ? sql<number>`coalesce(sum(${usd}) filter (where ${where}), 0)`.mapWith(Number)
    : sql<number>`coalesce(sum(${usd}), 0)`.mapWith(Number);
}

function countEvents(where?: SQL) {
  return where
    ? sql<number>`count(*) filter (where ${where})`.mapWith(Number)
    : sql<number>`count(*)`.mapWith(Number);
}

function line(cost: number, estimatedCost: number, events: number): CostLine {
  return { usd: cost, estimatedUsd: estimatedCost, events };
}

/**
 * Why: the per-run detail and the period summary need the same shape, and the
 * group rows are few (one per provider/operation pair), so folding them in JS
 * keeps one SQL query per request.
 * What: sums `OperationCost` rows into a total, a per-provider list and the
 * pair list, dropping pairs with zero events; both lists sorted by `usd` desc.
 * Test: `getCostSummary buckets today, this month and all time in one grouped query`
 */
export function foldCostRows(rows: OperationCost[]): CostBreakdown {
  const kept = rows.filter((r) => r.events > 0);
  const providers = new Map<string, ProviderCost>();
  const total = line(0, 0, 0);
  for (const r of kept) {
    const p = providers.get(r.provider) ?? { provider: r.provider, ...line(0, 0, 0) };
    p.usd += r.usd;
    p.estimatedUsd += r.estimatedUsd;
    p.events += r.events;
    providers.set(r.provider, p);
    total.usd += r.usd;
    total.estimatedUsd += r.estimatedUsd;
    total.events += r.events;
  }
  const byUsd = (a: CostLine, b: CostLine) => b.usd - a.usd;
  return {
    ...total,
    byProvider: [...providers.values()].sort(byUsd),
    byOperation: [...kept].sort(byUsd),
  };
}

/** UTC day and month starts for `now`. */
export function utcPeriodStarts(now: Date): { todayStart: Date; monthStart: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    todayStart: new Date(Date.UTC(y, m, now.getUTCDate())),
    monthStart: new Date(Date.UTC(y, m, 1)),
  };
}

/**
 * Why: S4 shows spend cards for today, this month and all time; a ledger can
 * hold one row per paid call, so it must not be loaded into memory.
 * What: one query grouped by (provider, operation) with `FILTER` sums for the
 * UTC day and month windows and an unfiltered all-time sum, folded into three
 * `CostBreakdown`s. `created_at` is read as UTC (Neon's session time zone).
 * Read-only.
 * Test: `getCostSummary buckets today, this month and all time in one grouped query`
 */
export async function getCostSummary(now: Date = new Date()): Promise<CostSummary> {
  const { todayStart, monthStart } = utcPeriodStarts(now);
  const inToday = gte(crawlCostEvents.created_at, todayStart);
  const inMonth = gte(crawlCostEvents.created_at, monthStart);

  const rows = await db
    .select({
      provider: crawlCostEvents.provider,
      operation: crawlCostEvents.operation,
      todayUsd: sumUsd(inToday),
      todayEstimatedUsd: sumUsd(and(inToday, eq(estimated, true))),
      todayEvents: countEvents(inToday),
      monthUsd: sumUsd(inMonth),
      monthEstimatedUsd: sumUsd(and(inMonth, eq(estimated, true))),
      monthEvents: countEvents(inMonth),
      allUsd: sumUsd(),
      allEstimatedUsd: sumUsd(eq(estimated, true)),
      allEvents: countEvents(),
    })
    .from(crawlCostEvents)
    .groupBy(crawlCostEvents.provider, crawlCostEvents.operation);

  const fold = (toLine: (r: (typeof rows)[number]) => CostLine) =>
    foldCostRows(rows.map((r) => ({ provider: r.provider, operation: r.operation, ...toLine(r) })));

  return {
    todayStart,
    monthStart,
    today: fold((r) => line(r.todayUsd, r.todayEstimatedUsd, r.todayEvents)),
    month: fold((r) => line(r.monthUsd, r.monthEstimatedUsd, r.monthEvents)),
    allTime: fold((r) => line(r.allUsd, r.allEstimatedUsd, r.allEvents)),
  };
}

/**
 * Why: run detail shows what a run spent, per provider and per operation.
 * What: one query over ledger rows with `run_id = runId`, grouped by
 * (provider, operation), folded into a `CostBreakdown`. `runId` must already
 * be validated. Read-only.
 * Test: `getDiscoveryRunDetail returns the run, its items and its ledger cost`
 */
export async function getRunCostBreakdown(runId: string): Promise<CostBreakdown> {
  const rows = await db
    .select({
      provider: crawlCostEvents.provider,
      operation: crawlCostEvents.operation,
      usd: sumUsd(),
      estimatedUsd: sumUsd(eq(estimated, true)),
      events: countEvents(),
    })
    .from(crawlCostEvents)
    .where(eq(crawlCostEvents.run_id, runId))
    .groupBy(crawlCostEvents.provider, crawlCostEvents.operation);
  return foldCostRows(rows);
}
