/**
 * Recorded weekly crawl (#6 S2): runs the Perplexity weekly pipeline
 * (`crawlWeeklyRecipes`) for one or more weeks as ONE discovery run, so the
 * local and pm2 scrapers report into `recipe_discovery_runs`,
 * `recipe_discovery_run_items` and `crawl_cost_events` like the cron does.
 *
 * Budget granularity is one week: `crawlWeeklyRecipes` exposes no per-URL
 * hook, so the budget is checked before each week's crawl and a run can
 * overshoot by at most one week's spend.
 */

import { crawlWeeklyRecipes } from '@/app/actions/recipe-crawl';
import {
  currentRunSpend,
  formatBudgetExceeded,
  isBudgetExhausted,
  resolveRunBudget,
  setCostRunId,
  withCostRun,
} from '@/lib/costs';
import {
  createDiscoveryRun,
  type DiscoveryRunStatus,
  type DiscoveryRunType,
  finalizeDiscoveryRun,
  isTrackedRunId,
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
 * crawls each week while the in-memory spend is under budget, writes one item
 * per URL from each week's results, and finalizes counters, status and cost.
 * A run row that cannot be created is logged and the crawl still runs,
 * budgeted but untracked.
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

  try {
    for (const [index, weeksAgo] of o.weeks.entries()) {
      const spent = currentRunSpend()?.spentUsd ?? 0;
      if (isBudgetExhausted(spent, budgetUsd)) {
        budgetStopped = true;
        errors.push(formatBudgetExceeded(spent, budgetUsd));
        console.warn(
          `[RecordedWeeklyCrawl] ${errors[errors.length - 1]} — skipping remaining weeks`
        );
        break;
      }

      const week = await crawlWeeklyRecipes(weeksAgo, {
        maxResults: o.maxResultsPerWeek,
        autoApprove: o.autoApprove,
        cuisine: o.pickCuisine?.(),
      });
      weeks.push(week);
      if (!week.success && week.error) errors.push(`week ${weeksAgo}: ${week.error}`);

      totals.discovered += week.stats.searched;
      totals.extracted += week.stats.converted;
      totals.stored += week.stats.stored;
      for (const r of week.recipes) {
        if (r.status === 'rejected') totals.skipped++;
        if (r.status === 'failed') errors.push(`${r.url}: ${r.reason ?? 'failed'}`);
        if (runId) {
          await recordRunItem({
            runId,
            url: r.url,
            // Weekly crawl extracts with Firecrawl; a failure does not say which step failed.
            extractionTier: r.status === 'failed' ? 'unknown' : 'firecrawl',
            outcome: ITEM_OUTCOME[r.status],
            error: r.status === 'stored' ? null : (r.reason ?? null),
            recipeId: r.id ?? null,
          });
        }
      }

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

  return { runId, status, weeks, errors, costUsd: currentRunSpend()?.spentUsd ?? 0 };
}
