/**
 * Discovery run persistence (#6 S2): the `recipe_discovery_runs` row and its
 * per-URL `recipe_discovery_run_items` rows. Shared by the cron ingestion
 * service and the local/pm2 weekly-crawl scripts so every paid crawl reports
 * into the same tables.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  crawlCostEvents,
  recipeDiscoveryRunItems,
  recipeDiscoveryRuns,
} from '@/lib/db/autonomous-scraper-schema';
import { withTimeout } from '@/lib/utils/timeout';

/** 'daily' = Vercel cron, 'manual' = admin/API trigger, 'local' = tsx/pm2 script. */
export type DiscoveryRunType = 'daily' | 'manual' | 'local';
export type DiscoveryRunStatus = 'completed' | 'failed' | 'partial';
export type RunItemOutcome =
  | 'stored'
  | 'skipped_duplicate'
  | 'skipped_quality'
  | 'failed'
  | 'budget_stopped';

/** Upper bound on one item insert; an item row must never stall a crawl. */
export const RUN_ITEM_WRITE_TIMEOUT_MS = 2000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for ids of real run rows (not `dry-run-*` / `untracked-*` placeholders). */
export function isTrackedRunId(runId: string | null | undefined): runId is string {
  return typeof runId === 'string' && UUID_RE.test(runId);
}

export interface RunItemInput {
  runId: string;
  url: string;
  /** e.g. firecrawl, jina, tavily-extract, claude-structured, fallback, none. */
  extractionTier: string;
  outcome: RunItemOutcome;
  error?: string | null;
  recipeId?: string | null;
}

export interface RunFinalFields {
  status: DiscoveryRunStatus;
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
  durationMs: number;
  costUsd: number;
  costWriteFailures: number;
}

/** Hostname without a leading `www.`, or null for an unparseable URL. */
export function sourceDomainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Inserts a `running` run row carrying its budget and returns its id. Throws on failure. */
export async function createDiscoveryRun(input: {
  runType: DiscoveryRunType;
  dryRun: boolean;
  budgetUsd: number;
}): Promise<string> {
  const [run] = await db
    .insert(recipeDiscoveryRuns)
    .values({
      run_type: input.runType,
      status: 'running',
      dry_run: input.dryRun,
      urls_discovered: 0,
      recipes_extracted: 0,
      recipes_stored: 0,
      recipes_skipped: 0,
      chefs_created: 0,
      errors: [],
      budget_usd: input.budgetUsd.toFixed(6),
      cost_write_failures: 0,
      started_at: new Date(),
    })
    .returning({ id: recipeDiscoveryRuns.id });

  if (!run?.id) throw new Error('Failed to create recipe discovery run record');
  return run.id;
}

/**
 * Writes the terminal status, counters and in-memory cost onto a run row.
 * `partial` is stored as `partial` (before #6 S2 it was folded into `completed`).
 */
export async function finalizeDiscoveryRun(runId: string, result: RunFinalFields): Promise<void> {
  await db
    .update(recipeDiscoveryRuns)
    .set({
      status: result.status,
      urls_discovered: result.urlsDiscovered,
      recipes_extracted: result.recipesExtracted,
      recipes_stored: result.recipesStored,
      recipes_skipped: result.recipesSkipped,
      chefs_created: result.chefsCreated,
      errors: result.errors,
      completed_at: new Date(),
      duration_ms: result.durationMs,
      cost_usd: result.costUsd.toFixed(6),
      cost_write_failures: result.costWriteFailures,
    })
    .where(eq(recipeDiscoveryRuns.id, runId));
}

/** Upper bound on the finalize-time ledger SUM; it runs inside the safety margin. */
export const LEDGER_SUM_TIMEOUT_MS = 3000;

/**
 * #6: SUM(usd) of `crawl_cost_events` booked to `runId`, or null when the
 * query fails or times out (logged). Finalize takes the larger of this and the
 * in-memory spend, so a failed ledger write never lowers the recorded cost.
 */
export async function sumRunLedgerUsd(runId: string): Promise<number | null> {
  try {
    const rows = await withTimeout(
      Promise.resolve(
        db
          .select({ total: sql<string>`coalesce(sum(${crawlCostEvents.usd}), 0)` })
          .from(crawlCostEvents)
          .where(eq(crawlCostEvents.run_id, runId))
      ),
      LEDGER_SUM_TIMEOUT_MS,
      `ledger sum timed out after ${LEDGER_SUM_TIMEOUT_MS}ms`
    );
    const total = Number(rows[0]?.total ?? 0);
    return Number.isFinite(total) ? total : null;
  } catch (error) {
    console.error(`[RunStore] Ledger sum failed for run ${runId}; using in-memory spend:`, error);
    return null;
  }
}

/**
 * Why: the admin view needs to know what happened to each URL, and a lost
 * item row must never cost a crawl its recipes.
 * What: Inserts one `recipe_discovery_run_items` row, bounded by
 * `RUN_ITEM_WRITE_TIMEOUT_MS`. Returns true when written; a failed or timed-out
 * insert is logged and swallowed (fail-open, like the cost ledger). Untracked
 * run ids are skipped.
 * Test: `a run completes with correct counters when every item insert throws`
 */
export async function recordRunItem(item: RunItemInput): Promise<boolean> {
  if (!isTrackedRunId(item.runId)) return false;
  try {
    await withTimeout(
      Promise.resolve(
        db.insert(recipeDiscoveryRunItems).values({
          run_id: item.runId,
          url: item.url,
          source_domain: sourceDomainOf(item.url),
          extraction_tier: item.extractionTier,
          outcome: item.outcome,
          error: item.error ?? null,
          recipe_id: item.recipeId ?? null,
        })
      ),
      RUN_ITEM_WRITE_TIMEOUT_MS,
      `item insert timed out after ${RUN_ITEM_WRITE_TIMEOUT_MS}ms`
    );
    return true;
  } catch (error) {
    // #6 S2: fail-open on purpose — losing an item row must never abort a run.
    console.error(
      `[RunItems] Failed to record ${item.outcome} item for ${item.url}; continuing:`,
      error
    );
    return false;
  }
}
