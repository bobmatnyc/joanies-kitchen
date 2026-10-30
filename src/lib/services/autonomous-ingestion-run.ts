/**
 * Run-item bookkeeping, chef resolution and finalize for
 * `AutonomousRecipeIngestionService`.
 *
 * Why: the service file stayed over the 500-line cap after the first split
 * (#142). These helpers read only the run metrics they are given, so they
 * moved here unchanged, from private methods to functions.
 * Test: `src/lib/services/__tests__/run-accounting.test.ts`,
 * `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`
 */

import { currentRunSpend } from '@/lib/costs';
import {
  type DuplicateCandidate,
  duplicateSkipReason,
  findDuplicateRecipe,
} from '@/lib/recipes/dedup';
import { describeDbError } from '@/lib/utils/error-handling';
import {
  type IngestionRunResult,
  type RunMetrics,
  SYSTEM_USER_ID,
} from './autonomous-ingestion-store';
import type { ChefDiscoveryService } from './chef-discovery.service';
import {
  type DiscoveryRunType,
  finalizeDiscoveryRun,
  isTrackedRunId,
  type RunItemInput,
  type RunItemOutcome,
  recordRunItem,
  sourceDomainOf,
  sumRunLedgerUsd,
} from './discovery-run-store';
import type { ScrapedRecipe } from './recipe-extraction.service';

export interface IngestionRunOptions {
  dryRun?: boolean;
  maxRecipes?: number;
  searchQuery?: string;
  /** Run row's `run_type`. Defaults to 'daily'. */
  runType?: DiscoveryRunType;
  /** USD budget; falls back to CRON_RUN_BUDGET_USD, then DEFAULT_RUN_BUDGET_USD. */
  budgetUsd?: number;
  /**
   * #6: epoch ms after which the run starts no new work and finalizes. Set by
   * the cron route from its `maxDuration` minus a safety margin.
   */
  deadlineAt?: number;
}

/** `ScrapedRecipe.extraction_method` -> `recipe_discovery_run_items.extraction_tier`. */
export const EXTRACTION_TIERS: Record<ScrapedRecipe['extraction_method'], string> = {
  firecrawl: 'firecrawl',
  jina: 'jina',
  tavily_extract: 'tavily-extract',
  claude_structured: 'claude-structured',
};

/** Writes one run item for the URL being processed. */
export type RecordItemFn = (
  outcome: RunItemOutcome,
  error?: string | null,
  recipeId?: string | null
) => Promise<void>;

/**
 * Why: a run row left `running` with null cost hides what a crawl did and
 * spent (#6, run 596f33c2).
 * What: Writes the terminal status, counters, duration and cost. Cost is the
 * larger of the in-memory spend and the run's `crawl_cost_events` SUM. A
 * failed finalize write is logged as CRITICAL and rethrown, never reported
 * as success; the reaper then closes the row on the next cron.
 * Test: `a run that hits the deadline mid-crawl is finalized partial with item counters and ledger cost`,
 * `a failed finalize write rejects the run instead of reporting success`
 */
export async function finalizeIngestionRun(
  runId: string,
  result: IngestionRunResult
): Promise<void> {
  const spend = currentRunSpend() ?? { spentUsd: 0, writeFailures: 0 };
  const ledgerUsd = await sumRunLedgerUsd(runId);
  const costUsd = Math.max(spend.spentUsd, ledgerUsd ?? 0);
  try {
    await finalizeDiscoveryRun(runId, {
      ...result,
      costUsd,
      costWriteFailures: spend.writeFailures,
    });
  } catch (updateErr) {
    console.error(
      `[AutonomousIngestion] CRITICAL: failed to finalize run ${runId}; it stays running until reaped:`,
      updateErr
    );
    throw new Error(`failed to finalize run ${runId}: ${describeDbError(updateErr)}`, {
      cause: updateErr,
    });
  }
  console.log(
    `[AutonomousIngestion] Run ${runId} finalized: status=${result.status}, ` +
      `cost=$${costUsd.toFixed(6)}, duration=${result.durationMs}ms`
  );
}

/**
 * #135: when `candidate` duplicates a stored recipe, counts it as skipped and
 * writes its `skipped_duplicate` item row linked to that recipe; returns true.
 * Also returns true, changing nothing, when the run released the URL during
 * the lookup.
 */
export async function skippedAsDuplicate(
  m: RunMetrics,
  record: RecordItemFn,
  candidate: DuplicateCandidate
): Promise<boolean> {
  const match = await findDuplicateRecipe(candidate, {
    ownerId: SYSTEM_USER_ID,
    titleRule: true,
  });
  if (!match) return false;
  // #135: the deadline may have closed the run during the lookup; counters are then final.
  if (candidate.sourceUrl && isReleased(m, candidate.sourceUrl)) return true;
  const reason = duplicateSkipReason(match);
  console.log(`[AutonomousIngestion] ${reason} (${match.reason}): ${candidate.sourceUrl}`);
  m.recipesSkipped++;
  await record('skipped_duplicate', reason, match.id);
  return true;
}

/** #6: true once the run closed or another row claimed `url`; late work then changes nothing. */
export function isReleased(m: RunMetrics, url: string): boolean {
  return m.closed || m.itemUrls.has(url);
}

/** Writes one item row; a failed write on a tracked run is counted, never thrown. */
export async function recordItem(m: RunMetrics, item: RunItemInput): Promise<void> {
  // #6: claim before any await — exactly one row per URL under any interleaving.
  if (m.closed || m.itemUrls.has(item.url)) return;
  m.itemUrls.add(item.url);
  const written = await recordRunItem(item);
  if (!written && isTrackedRunId(item.runId)) m.itemWriteFailures++;
}

/**
 * Finds or creates the recipe's chef; null when it names none or the lookup
 * fails (logged, non-fatal). `chefDiscovery` is a thunk so the lazy service is
 * built only when a chef is named, inside the try, as before the move.
 */
export async function resolveChefId(
  chefDiscovery: () => ChefDiscoveryService,
  recipe: ScrapedRecipe,
  url: string,
  m: RunMetrics
): Promise<string | null> {
  if (!recipe.chef_name) return null;
  try {
    const chefDomain = sourceDomainOf(url);
    const chefWebsite = chefDomain ? `https://${chefDomain}` : undefined;
    const chefProfile = await chefDiscovery().findOrCreateChef(recipe.chef_name, chefWebsite);
    if (chefProfile.isNew && !isReleased(m, url)) m.chefsCreated++;
    return chefProfile.id;
  } catch (chefErr) {
    const msg = chefErr instanceof Error ? chefErr.message : String(chefErr);
    console.warn(
      `[AutonomousIngestion] Chef lookup failed for "${recipe.chef_name}", continuing without chef link: ${msg}`
    );
    return null;
  }
}
