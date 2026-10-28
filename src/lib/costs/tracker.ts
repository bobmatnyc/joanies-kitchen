/**
 * Cost ledger writer (#6): one `crawl_cost_events` row per paid external call.
 *
 * Writes are awaited, so a row is committed before the serverless request that
 * made the call returns; no flush step is needed. A failed or timed-out write is
 * caught and logged and never aborts the crawl (fail-open by design, see #6).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { type CostProvider, lookupRate, providerFallbackRate } from './rates';

/**
 * Upper bound on one ledger insert. The write sits on user-facing paths (search,
 * completions), so a stalled Neon request must not stall the paid call.
 */
export const COST_LEDGER_WRITE_TIMEOUT_MS = 2000;

/** Thrown outside production when a cost has no measured value, estimate, or rate. */
export class UnknownCostOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownCostOperationError';
  }
}

export interface TrackCostInput {
  provider: CostProvider;
  /** Rate-table operation name, e.g. `search.basic`, `scrape`, `chat:<model>`. */
  operation: string;
  /** Billable units (requests, credits, tokens). Defaults to 1. */
  units?: number;
  /** USD reported by the provider for this call. Overrides every estimate. */
  measuredUsd?: number | null;
  /** USD computed by the call site (e.g. tokens x model price). Used when no measured cost. */
  estimateUsd?: number | null;
  /** Discovery run id. Defaults to the run in scope via `withCostRun()`. */
  runId?: string | null;
}

export interface CostEventRow {
  runId: string | null;
  provider: CostProvider;
  operation: string;
  units: number;
  usd: number;
  estimated: boolean;
}

interface CostContext {
  runId: string | null;
  /** #6 S2: USD of every cost event booked in this scope, whether or not its ledger row landed. */
  spentUsd: number;
  /** #6 S2: ledger inserts in this scope that failed or timed out. */
  writeFailures: number;
}

/** In-memory spend of the enclosing `withCostRun()` scope. */
export interface RunSpend {
  spentUsd: number;
  writeFailures: number;
}

const costContext = new AsyncLocalStorage<CostContext>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isUsableUsd(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Why: an unknown price must be loud in development and never a silent $0 in
 * production (the tripbot.tours bug this ledger replaces).
 * What: Throws `UnknownCostOperationError` outside production; in production
 * logs a warning and returns so the caller records an estimated row.
 * Test: `trackCost throws on an unknown operation outside production`,
 * `trackCost records an unknown operation as estimated in production`
 */
export function reportUnknownCost(message: string): void {
  if (!isProduction()) throw new UnknownCostOperationError(message);
  console.warn(`[CostLedger] ${message} — recording a fallback estimate (estimated=true)`);
}

/**
 * Runs `fn` with a mutable cost context so every `trackCost()` beneath it
 * picks up the run id set later via `setCostRunId()` and adds its USD to the
 * scope's in-memory spend (read with `currentRunSpend()`).
 */
export function withCostRun<T>(fn: () => Promise<T>): Promise<T> {
  return costContext.run({ runId: null, spentUsd: 0, writeFailures: 0 }, fn);
}

/** Attaches a discovery run id to the current cost context. Non-UUID ids are ignored. */
export function setCostRunId(runId: string | null): void {
  const store = costContext.getStore();
  if (store) store.runId = runId && UUID_RE.test(runId) ? runId : null;
}

/**
 * Why: a run's budget must trip even when every ledger insert fails, so spend
 * cannot be read back from `crawl_cost_events` (#6 S2).
 * What: Returns a copy of the enclosing scope's in-memory spend and ledger
 * write-failure count, or null outside `withCostRun()`.
 * Test: `currentRunSpend counts spend and write failures when the ledger insert throws`
 */
export function currentRunSpend(): RunSpend | null {
  const store = costContext.getStore();
  return store ? { spentUsd: store.spentUsd, writeFailures: store.writeFailures } : null;
}

/** Run id of the enclosing `withCostRun()` scope, or null. */
export function currentCostRunId(): string | null {
  return costContext.getStore()?.runId ?? null;
}

/**
 * Why: one place decides which USD figure a call is booked at.
 * What: measured USD wins (estimated=false); else the call-site estimate; else
 * units x the rate-table entry; else the unknown-operation path.
 * Test: `resolveCost prefers a measured cost over the rate table`,
 * `resolveCost uses units x rate when nothing is measured`
 */
export function resolveCost(input: TrackCostInput): CostEventRow {
  const units = input.units ?? 1;
  const explicitRunId = input.runId && UUID_RE.test(input.runId) ? input.runId : null;
  const runId = explicitRunId ?? currentCostRunId();
  const base = { runId, provider: input.provider, operation: input.operation, units };

  if (isUsableUsd(input.measuredUsd)) {
    return { ...base, usd: input.measuredUsd, estimated: false };
  }
  if (isUsableUsd(input.estimateUsd)) {
    return { ...base, usd: input.estimateUsd, estimated: true };
  }
  const rate = lookupRate(input.provider, input.operation);
  if (rate) {
    return { ...base, usd: units * rate.usdPerUnit, estimated: true };
  }

  reportUnknownCost(`Unknown cost operation "${input.provider}:${input.operation}"`);
  return { ...base, usd: units * providerFallbackRate(input.provider), estimated: true };
}

async function insertCostEvent(row: CostEventRow): Promise<void> {
  // Lazy import: loading this module must not open a DB connection, and
  // '@/lib/db' throws at import time when DATABASE_URL is unset.
  const { db } = await import('@/lib/db');
  const { crawlCostEvents } = await import('@/lib/db/autonomous-scraper-schema');
  await db.insert(crawlCostEvents).values({
    run_id: row.runId,
    provider: row.provider,
    operation: row.operation,
    units: String(row.units),
    usd: row.usd.toFixed(6),
    estimated: row.estimated,
  });
}

class LedgerWriteTimeoutError extends Error {}

/** Settles with `promise`, or rejects with `LedgerWriteTimeoutError` after `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LedgerWriteTimeoutError()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Why: per-run spend is a SUM over ledger rows, so every paid call needs one.
 * What: Resolves the USD figure, then awaits the insert into `crawl_cost_events`,
 * bounded by `COST_LEDGER_WRITE_TIMEOUT_MS`. A failed or timed-out insert is
 * logged and swallowed (fail-open); an unknown operation throws outside
 * production before any write. Inside `withCostRun()` the USD is added to the
 * scope's in-memory spend before the write, and a failed write is counted.
 * Test: `trackCost logs and swallows a failed insert`,
 * `a failed ledger insert does not abort a Tavily search`,
 * `trackCost resolves within the timeout when the insert never resolves`,
 * `a hung ledger insert does not stall a Tavily search`
 */
export async function trackCost(input: TrackCostInput): Promise<CostEventRow> {
  const row = resolveCost(input);
  const label = `${row.provider}:${row.operation} ($${row.usd.toFixed(6)})`;
  const store = costContext.getStore();
  // #6 S2: count spend before the write, so a failed or hung insert still counts.
  if (store) store.spentUsd += row.usd;
  try {
    await withTimeout(insertCostEvent(row), COST_LEDGER_WRITE_TIMEOUT_MS);
  } catch (error) {
    // #6: fail-open on purpose — losing a ledger row must never abort a crawl.
    if (store) store.writeFailures += 1;
    if (error instanceof LedgerWriteTimeoutError) {
      console.error(
        `[CostLedger] Timed out recording cost event ${label} after ${COST_LEDGER_WRITE_TIMEOUT_MS}ms; continuing`
      );
    } else {
      console.error(`[CostLedger] Failed to record cost event ${label}; continuing:`, error);
    }
  }
  return row;
}
