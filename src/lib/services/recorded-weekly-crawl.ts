/**
 * Recorded weekly crawl (#6 S2): runs the Perplexity weekly pipeline
 * (`crawlWeeklyRecipes`) for one or more weeks as ONE discovery run, so the
 * local and pm2 scrapers report into `recipe_discovery_runs`,
 * `recipe_discovery_run_items` and `crawl_cost_events` like the cron does.
 *
 * The budget is checked before each week and, through `shouldContinue`,
 * before each paid URL inside a week, so a run overshoots by at most one URL.
 */

import {
  currentRunSpend,
  formatBudgetExceeded,
  isBudgetExhausted,
  resolveRunBudget,
  setCostRunId,
  withCostRun,
} from '@/lib/costs';
// #16: the ungated pipeline; the '@/app/actions' wrapper requires a Clerk admin session.
import { crawlWeeklyRecipes } from '@/lib/recipe-crawl';
import {
  createDiscoveryRun,
  type DiscoveryRunStatus,
  type DiscoveryRunType,
  finalizeDiscoveryRun,
  isTrackedRunId,
  type RunItemInput,
  type RunItemOutcome,
  recordRunItem,
} from './discovery-run-store';

type WeeklyCrawlResult = Awaited<ReturnType<typeof crawlWeeklyRecipes>>;

export interface RecordedWeeklyCrawlOptions {
  weeks: number[];
  maxResultsPerWeek: number;
  autoApprove: boolean;
  /** Picks a cuisine filter per week; undefined = no filter. */
  pickCuisine?: () => string | undefined;
  runType?: DiscoveryRunType;
  budgetUsd?: number;
  /** Pause between weeks (rate limiting). Default 10s. */
  delayBetweenWeeksMs?: number;
}

export interface RecordedWeeklyCrawlResult {
  runId: string | null;
  /** False when the run row could not be created; the crawl still ran. */
  tracked: boolean;
  status: DiscoveryRunStatus;
  weeks: WeeklyCrawlResult[];
  errors: string[];
  costUsd: number;
}

const ITEM_OUTCOME: Record<'stored' | 'rejected' | 'failed', RunItemOutcome> = {
  stored: 'stored',
  rejected: 'skipped_quality',
  failed: 'failed',
};

/**
 * Why: Architect Q2 — local and pm2 crawls must be visible and budgeted like
 * the cron run.
 * What: Inside `withCostRun()`, creates a run row (`run_type` default 'local'),
 * crawls each week, stopping before the next paid URL once the in-memory spend
 * reaches the budget, writes one item per URL (including `budget_stopped`
 * ones), and finalizes counters, status and cost. Failed item writes add one
 * `item writes failed: N` error. A run row that cannot be created is logged and
 * the crawl still runs, budgeted but untracked (`tracked: false`).
 * Test: `stops mid-week once a single week's URLs exceed the budget`,
 * `maps crawl results to item outcomes, tiers and recipe ids`,
 * `runs untracked when the run row cannot be created`
 */
export function runRecordedWeeklyCrawl(
  options: RecordedWeeklyCrawlOptions
): Promise<RecordedWeeklyCrawlResult> {
  return withCostRun(() => executeWeeklyRun(options));
}

async function executeWeeklyRun(o: RecordedWeeklyCrawlOptions): Promise<RecordedWeeklyCrawlResult> {
  const startTime = Date.now();
  const budgetUsd = resolveRunBudget(o.budgetUsd);
  const delayMs = o.delayBetweenWeeksMs ?? 10_000;
  const weeks: WeeklyCrawlResult[] = [];
  const errors: string[] = [];
  const totals = { discovered: 0, extracted: 0, stored: 0, skipped: 0 };
  let status: DiscoveryRunStatus = 'failed';
  let budgetStopped = false;
  let itemWriteFailures = 0;

  // True while spend is under budget; records the budget error once when it trips.
  const underBudget = (): boolean => {
    const spent = currentRunSpend()?.spentUsd ?? 0;
    if (!isBudgetExhausted(spent, budgetUsd)) return true;
    if (!budgetStopped) {
      budgetStopped = true;
      errors.push(formatBudgetExceeded(spent, budgetUsd));
      console.warn(`[RecordedWeeklyCrawl] ${errors[errors.length - 1]} — stopping paid calls`);
    }
    return false;
  };

  let runId: string | null = null;
  try {
    runId = await createDiscoveryRun({
      runType: o.runType ?? 'local',
      dryRun: false,
      budgetUsd,
    });
    setCostRunId(runId);
  } catch (error) {
    console.error(
      '[RecordedWeeklyCrawl] Failed to create run record; continuing untracked:',
      error
    );
  }

  const record = async (item: Omit<RunItemInput, 'runId'>): Promise<void> => {
    if (!isTrackedRunId(runId)) return;
    if (!(await recordRunItem({ ...item, runId }))) itemWriteFailures++;
  };

  try {
    for (const [index, weeksAgo] of o.weeks.entries()) {
      if (!underBudget()) break;

      const week = await crawlWeeklyRecipes(weeksAgo, {
        maxResults: o.maxResultsPerWeek,
        autoApprove: o.autoApprove,
        cuisine: o.pickCuisine?.(),
        shouldContinue: underBudget,
      });
      weeks.push(week);
      if (!week.success && week.error) errors.push(`week ${weeksAgo}: ${week.error}`);

      totals.discovered += week.stats.searched;
      totals.extracted += week.stats.converted;
      totals.stored += week.stats.stored;
      for (const r of week.recipes) {
        if (r.status === 'rejected') totals.skipped++;
        if (r.status === 'failed') errors.push(`${r.url}: ${r.reason ?? 'failed'}`);
        await record({
          url: r.url,
          // Weekly crawl extracts with Firecrawl; a failure does not say which step failed.
          extractionTier: r.status === 'failed' ? 'unknown' : 'firecrawl',
          outcome: ITEM_OUTCOME[r.status],
          error: r.status === 'stored' ? null : (r.reason ?? null),
          recipeId: r.id ?? null,
        });
      }
      const budgetError = errors.find((e) => e.startsWith('budget exceeded')) ?? null;
      for (const url of week.stoppedUrls ?? []) {
        await record({
          url,
          extractionTier: 'none',
          outcome: 'budget_stopped',
          error: budgetError,
        });
      }
      if (budgetStopped) break;

      if (index < o.weeks.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (budgetStopped) status = 'partial';
    else if (errors.length === 0) status = 'completed';
    else status = totals.stored > 0 ? 'partial' : 'failed';
  } catch (error) {
    errors.push(`Pipeline error: ${error instanceof Error ? error.message : String(error)}`);
    status = 'failed';
  } finally {
    // Added after the status is decided, so it never changes the status.
    if (itemWriteFailures > 0) errors.push(`item writes failed: ${itemWriteFailures}`);
    const spend = currentRunSpend() ?? { spentUsd: 0, writeFailures: 0 };
    if (isTrackedRunId(runId)) {
      try {
        await finalizeDiscoveryRun(runId, {
          status,
          urlsDiscovered: totals.discovered,
          recipesExtracted: totals.extracted,
          recipesStored: totals.stored,
          recipesSkipped: totals.skipped,
          chefsCreated: 0,
          errors,
          durationMs: Date.now() - startTime,
          costUsd: spend.spentUsd,
          costWriteFailures: spend.writeFailures,
        });
      } catch (error) {
        console.error(`[RecordedWeeklyCrawl] CRITICAL: failed to finalize run ${runId}:`, error);
      }
    }
  }

  return {
    runId,
    tracked: isTrackedRunId(runId),
    status,
    weeks,
    errors,
    costUsd: currentRunSpend()?.spentUsd ?? 0,
  };
}
