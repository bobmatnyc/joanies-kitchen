/**
 * Autonomous Recipe Ingestion Service
 *
 * Main orchestrator for the daily zero-waste recipe discovery pipeline:
 *   1. Create run record
 *   2. Search → discover recipe URLs via Tavily
 *   3. Deduplicate URLs (recipes.source + chefRecipes.original_url)
 *   4. Extract recipe data (Firecrawl → Jina → Tavily Extract → Claude),
 *      checking the run budget before each URL
 *   5. Quality gate: title + ingredients + instructions required
 *   6. Find/create chef profile
 *   7. Store recipe + link to chef
 *   8. Update run record with final metrics and cost
 *
 * A run given `deadlineAt` stops starting work at that time, abandons any
 * in-flight call, and finalizes `partial` before the platform kills it (#6).
 *
 * Every URL attempted gets one `recipe_discovery_run_items` row (#6 S2).
 *
 * Adapted from aipowerranking AutomatedIngestionService.
 *
 * #142: the DB writes and result building live in `autonomous-ingestion-store.ts`.
 */

import {
  currentRunSpend,
  formatBudgetExceeded,
  isBudgetExhausted,
  resolveRunBudget,
  setCostRunId,
  withCostRun,
} from '@/lib/costs';
import {
  type DuplicateCandidate,
  duplicateSkipReason,
  findDuplicateRecipe,
} from '@/lib/recipes/dedup';
import { describeDbError } from '@/lib/utils/error-handling';
import {
  buildRunResult,
  checkUrlDuplicates,
  determineRunStatus,
  type IngestionRunResult,
  type RunMetrics,
  recordRecipeOfTheDay,
  SYSTEM_USER_ID,
  storeIngestedRecipe,
} from './autonomous-ingestion-store';
import { type ChefDiscoveryService, getChefDiscoveryService } from './chef-discovery.service';
import { DEADLINE_HIT, raceDeadline } from './crawl-run-deadline';
import {
  createDiscoveryRun,
  type DiscoveryRunStatus,
  type DiscoveryRunType,
  finalizeDiscoveryRun,
  isTrackedRunId,
  type RunItemInput,
  type RunItemOutcome,
  recordRunItem,
  sourceDomainOf,
  sumRunLedgerUsd,
} from './discovery-run-store';
import {
  type DiscoveredRecipeUrl,
  getRecipeDiscoveryService,
  type RecipeDiscoveryService,
} from './recipe-discovery.service';
import type { ScrapedRecipe } from './recipe-extraction.service';
import {
  getRecipeExtractionService,
  type RecipeExtractionService,
} from './recipe-extraction.service';

const ZERO_WASTE_TAGS = ['zero-waste', 'scraped'];
const EXTRACTION_DELAY_MS = 2000; // 2 seconds between URL extractions

export type { IngestionRunResult } from './autonomous-ingestion-store'; // #142: moved
/** #6: item error for the URL in flight when the deadline hit. */
export const ABANDONED_IN_FLIGHT_ERROR = 'deadline: abandoned in flight; may have stored late';

/** `ScrapedRecipe.extraction_method` -> `recipe_discovery_run_items.extraction_tier`. */
const EXTRACTION_TIERS: Record<ScrapedRecipe['extraction_method'], string> = {
  firecrawl: 'firecrawl',
  jina: 'jina',
  tavily_extract: 'tavily-extract',
  claude_structured: 'claude-structured',
};

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

export class AutonomousRecipeIngestionService {
  // Lazy-initialized services
  private _discoveryService: RecipeDiscoveryService | null = null;
  private _extractionService: RecipeExtractionService | null = null;
  private _chefDiscoveryService: ChefDiscoveryService | null = null;

  private get discoveryService(): RecipeDiscoveryService {
    if (!this._discoveryService) {
      this._discoveryService = getRecipeDiscoveryService();
    }
    return this._discoveryService;
  }

  private get extractionService(): RecipeExtractionService {
    if (!this._extractionService) {
      this._extractionService = getRecipeExtractionService();
    }
    return this._extractionService;
  }

  private get chefDiscoveryService(): ChefDiscoveryService {
    if (!this._chefDiscoveryService) {
      this._chefDiscoveryService = getChefDiscoveryService();
    }
    return this._chefDiscoveryService;
  }

  /**
   * Run the full discovery pipeline.
   *
   * Run lifecycle guarantee (try/finally):
   *   - The run row ALWAYS gets a terminal status (completed/failed/partial),
   *     even on early return, exception, or partial completion.
   *   - A run killed before its finally is reaped by `reapStaleDiscoveryRuns()`.
   *
   * maxRecipes resolution order:
   *   1. options.maxRecipes (explicit caller override)
   *   2. CRON_MAX_RECIPES env var
   *   3. Hard default (5)
   *
   * Budget (#6 S2): `resolveRunBudget(options.budgetUsd)`. Spend is the
   * in-memory total of every cost event in this run's `withCostRun()` scope,
   * so it trips even when every ledger insert fails. It is checked before
   * discovery and before each URL; once spent >= budget the run makes no more
   * paid calls and ends `partial` with `budget exceeded: $X of $Y`.
   */
  async runDailyDiscovery(options: IngestionRunOptions = {}): Promise<IngestionRunResult> {
    // #6: scope a cost context so every paid call below books against this run.
    return withCostRun(() => this.executeRun(options));
  }

  private async executeRun(options: IngestionRunOptions): Promise<IngestionRunResult> {
    const startTime = Date.now();
    const isDryRun = options.dryRun ?? false;
    const runType = options.runType ?? 'daily';
    const budgetUsd = resolveRunBudget(options.budgetUsd);

    // Resolve maxRecipes: caller > env var > default
    const envMax = process.env.CRON_MAX_RECIPES ? parseInt(process.env.CRON_MAX_RECIPES, 10) : NaN;
    const maxRecipes = options.maxRecipes ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : 5);

    // Resolve searchQuery: caller > env var
    const searchQuery = options.searchQuery ?? process.env.CRON_SEARCH_QUERY;

    console.log(
      `[AutonomousIngestion] Starting ${runType} discovery — dryRun=${isDryRun}, maxRecipes=${maxRecipes}, ` +
        `budget=$${budgetUsd.toFixed(2)}, searchQuery=${searchQuery ?? 'rotating'}`
    );

    const m: RunMetrics = {
      urlsDiscovered: 0,
      recipesExtracted: 0,
      recipesStored: 0,
      recipesSkipped: 0,
      chefsCreated: 0,
      errors: [],
      itemWriteFailures: 0,
      tracked: false,
      closed: false,
      itemUrls: new Set(),
    };
    const deadlineAt = options.deadlineAt;
    // #6: records the deadline stop once and closes the metrics to late writes.
    const stopAtDeadline = (): void => {
      if (m.closed) return;
      m.closed = true;
      const msg = `deadline: stopped after ${Math.round((Date.now() - startTime) / 1000)}s to finalize before the function limit`;
      m.errors.push(msg);
      console.warn(`[AutonomousIngestion] ${msg}`);
    };
    const pastDeadline = (): boolean => deadlineAt !== undefined && Date.now() >= deadlineAt;
    let runId = '';
    let runCreated = false;
    let status: DiscoveryRunStatus = 'failed'; // Pessimistic default
    let budgetStopped = false;

    // #6 S2: true once spend has reached the budget; records the error once.
    const budgetExhausted = (): boolean => {
      const spent = currentRunSpend()?.spentUsd ?? 0;
      if (!isBudgetExhausted(spent, budgetUsd)) return false;
      if (!budgetStopped) {
        budgetStopped = true;
        m.errors.push(formatBudgetExceeded(spent, budgetUsd));
        console.warn(
          `[AutonomousIngestion] ${m.errors[m.errors.length - 1]} — stopping paid calls`
        );
      }
      return true;
    };

    // Step 1: Create run record upfront (before any work)
    if (!isDryRun) {
      try {
        runId = await createDiscoveryRun({ runType, dryRun: isDryRun, budgetUsd });
        runCreated = true;
        m.tracked = true;
        setCostRunId(runId);
        console.log(`[AutonomousIngestion] Run record created: ${runId}`);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        console.error(`[AutonomousIngestion] Failed to create run record: ${msg}`);
        // Non-fatal: continue without DB tracking
        runId = `untracked-${Date.now()}`;
      }
    } else {
      runId = `dry-run-${Date.now()}`;
      console.log('[AutonomousIngestion] Dry run — no DB record created');
    }

    const pipeline = async (): Promise<IngestionRunResult> => {
      try {
        // Step 2: Discover recipe URLs
        if (!this.discoveryService.isConfigured()) {
          throw new Error('TAVILY_API_KEY not configured — cannot discover recipes');
        }
        if (budgetExhausted()) {
          status = 'partial';
          return buildRunResult(runId, status, m, startTime);
        }

        const discovered = await raceDeadline(
          this.discoveryService.discoverRecipeUrls({
            maxResults: maxRecipes * 4, // Fetch extra to account for deduplication and failures
            searchQuery,
          }),
          deadlineAt
        );
        if (discovered === DEADLINE_HIT) {
          stopAtDeadline();
          status = 'partial';
          return buildRunResult(runId, status, m, startTime);
        }
        const discoveredUrls = discovered;

        m.urlsDiscovered = discoveredUrls.length;
        console.log(`[AutonomousIngestion] Discovered ${m.urlsDiscovered} URLs`);

        if (m.urlsDiscovered === 0) {
          status = 'completed';
          return buildRunResult(runId, status, m, startTime);
        }

        // Step 3: Deduplicate against existing recipes.source + chefRecipes.original_url
        const existingUrls = await checkUrlDuplicates(discoveredUrls.map((d) => d.url));
        const newUrls = discoveredUrls.filter((d) => !existingUrls.has(d.url));

        for (const dup of discoveredUrls.filter((d) => existingUrls.has(d.url))) {
          m.recipesSkipped++;
          await this.recordItem(m, {
            runId,
            url: dup.url,
            extractionTier: 'none',
            outcome: 'skipped_duplicate',
          });
        }
        if (newUrls.length < m.urlsDiscovered) {
          console.log(
            `[AutonomousIngestion] Skipped ${m.urlsDiscovered - newUrls.length} duplicate URLs`
          );
        }

        if (newUrls.length === 0) {
          console.log('[AutonomousIngestion] All URLs already ingested');
          status = 'completed';
          return buildRunResult(runId, status, m, startTime);
        }

        // Step 4: Extract recipes (up to maxRecipes)
        const urlsToProcess = newUrls.slice(0, maxRecipes * 2); // Process extra in case some fail quality gate

        for (let i = 0; i < urlsToProcess.length; i++) {
          if (m.recipesStored >= maxRecipes) break;
          // #6: start no new URL past the deadline; abandon one still in flight.
          if (pastDeadline()) {
            stopAtDeadline();
            break;
          }
          if (budgetExhausted()) {
            // #6 S2: record every queued URL the budget cut, then stop paid calls.
            for (const cut of urlsToProcess.slice(i)) {
              await this.recordItem(m, {
                runId,
                url: cut.url,
                extractionTier: 'none',
                outcome: 'budget_stopped',
                error: m.errors.find((e) => e.startsWith('budget exceeded')) ?? null,
              });
            }
            break;
          }

          const processed = await raceDeadline(
            this.processUrl(urlsToProcess[i], runId, isDryRun, m),
            deadlineAt
          );
          if (processed === DEADLINE_HIT) {
            // #6: the abandoned URL still gets its one item row before close.
            // recordItem claims the URL synchronously, so a late resume of
            // its processUrl can neither write a second row nor move a counter.
            await this.recordItem(m, {
              runId,
              url: urlsToProcess[i].url,
              extractionTier: 'none',
              outcome: 'failed',
              error: ABANDONED_IN_FLIGHT_ERROR,
            });
            stopAtDeadline();
            break;
          }

          // Rate limit between extractions
          if (i < urlsToProcess.length - 1) {
            await this.sleep(EXTRACTION_DELAY_MS);
          }
        }

        status =
          budgetStopped || m.closed ? 'partial' : determineRunStatus(m.recipesStored, m.errors);

        console.log(
          `[AutonomousIngestion] Completed — stored=${m.recipesStored}, extracted=${m.recipesExtracted}, ` +
            `skipped=${m.recipesSkipped}, errors=${m.errors.length}, status=${status}`
        );

        return buildRunResult(runId, status, m, startTime);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[AutonomousIngestion] Pipeline error: ${msg}`);
        m.errors.push(`Pipeline error: ${msg}`);
        status = 'failed';

        return buildRunResult(runId, status, m, startTime);
      }
    };

    const result = await pipeline();
    // #6: close the metrics so abandoned in-flight work cannot move counters or
    // write items after the counters are read below.
    m.closed = true;
    // Every return path above (completion, early return, exception, deadline)
    // reaches this finalize, so the run row never stays `running`.
    if (!isDryRun && runCreated && isTrackedRunId(runId)) {
      await this.finalizeRun(runId, result);
    }
    return result;
  }

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
  private async finalizeRun(runId: string, result: IngestionRunResult): Promise<void> {
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
   * Extract, gate, and store one URL, updating `m` and writing exactly one
   * run item for it. Never throws: a single bad URL must not fail the batch.
   */
  private async processUrl(
    discovered: DiscoveredRecipeUrl,
    runId: string,
    isDryRun: boolean,
    m: RunMetrics
  ): Promise<void> {
    const url = discovered.url;
    let tier = 'none';
    const record = (outcome: RunItemOutcome, error?: string | null, recipeId?: string | null) =>
      this.recordItem(m, { runId, url, extractionTier: tier, outcome, error, recipeId });

    try {
      // #135: a URL variant of a stored source is skipped before the paid extraction.
      if (await this.skippedAsDuplicate(m, record, { sourceUrl: url })) return;

      console.log(`[AutonomousIngestion] Extracting: ${url}`);
      const recipe = await this.extractionService.extractRecipe(url);
      // #6: the deadline abandoned this URL; its row is claimed, counters are final.
      if (this.released(m, url)) return;

      if (!recipe) {
        const err = `Extraction failed (all tiers): ${url}`;
        m.errors.push(err);
        await record('failed', err);
        return;
      }

      tier = EXTRACTION_TIERS[recipe.extraction_method] ?? recipe.extraction_method;
      m.recipesExtracted++;

      // Step 5: Quality gate
      if (!this.extractionService.isViableRecipe(recipe)) {
        const detail =
          `quality gate: ingredients=${recipe.ingredients?.length ?? 0}, ` +
          `instructions=${recipe.instructions?.length ?? 0}`;
        console.log(`[AutonomousIngestion] Quality gate failed for: "${recipe.title}" (${detail})`);
        m.recipesSkipped++;
        await record('skipped_quality', detail);
        return;
      }

      // #135: same canonical URL, or same title on the same host, is never inserted.
      if (this.released(m, url)) return;
      if (await this.skippedAsDuplicate(m, record, { sourceUrl: url, title: recipe.title })) {
        return;
      }

      // Inject zero-waste tags
      recipe.tags = [...new Set([...ZERO_WASTE_TAGS, ...recipe.tags])];

      // Step 6: Find/create chef (non-fatal — store recipe without chef link on failure)
      const chefId = await this.resolveChefId(recipe, url, m);

      if (isDryRun) {
        m.recipesStored++;
        console.log(`[AutonomousIngestion] [DRY RUN] Would store: "${recipe.title}"`);
        return;
      }

      // Step 7: Store recipe (never after the deadline closed the run)
      if (this.released(m, url)) return;
      let recipeId: string | null = null;
      try {
        recipeId = await storeIngestedRecipe(recipe, chefId, url, discovered.searchQuery);
      } catch (storeErr) {
        // storeRecipe already logs internally; surface into errors[] so it's visible in run metrics
        // #12: record the Postgres error on err.cause, not the Drizzle "Failed query" wrapper.
        const msg = describeDbError(storeErr);
        m.errors.push(`Store failed for "${recipe.title}" (${url}): ${msg}`);
        console.error(`[AutonomousIngestion] Store threw unexpectedly: ${msg}`);
        await record('failed', `store failed: ${msg}`);
        return;
      }

      if (!recipeId) {
        // storeRecipe returned null — means the DB insert failed (already logged)
        const err = `Store returned null for "${recipe.title}" (${url}) — check DB logs for constraint violation`;
        m.errors.push(err);
        console.error(`[AutonomousIngestion] Extracted but NOT stored: "${recipe.title}"`);
        await record('failed', err);
        return;
      }

      // #6: stored after the deadline closed the run; its item row already says so.
      if (this.released(m, url)) return;
      m.recipesStored++;
      console.log(`[AutonomousIngestion] Stored recipe: "${recipe.title}" (${recipeId})`);
      // Record first stored recipe as today's Recipe of the Day
      if (m.recipesStored === 1) {
        await recordRecipeOfTheDay(recipeId, url);
      }
      await record('stored', null, recipeId);
    } catch (error) {
      // #12: surface the underlying DB error (and SQLSTATE) when one is wrapped.
      const msg = describeDbError(error);
      console.error(`[AutonomousIngestion] Error processing ${url}: ${msg}`);
      m.errors.push(`${url}: ${msg}`);
      await record('failed', msg);
    }
  }

  /**
   * #135: when `candidate` duplicates a stored recipe, counts it as skipped and
   * writes its `skipped_duplicate` item row linked to that recipe; returns true.
   * Also returns true, changing nothing, when the run released the URL during
   * the lookup.
   */
  private async skippedAsDuplicate(
    m: RunMetrics,
    record: (
      outcome: RunItemOutcome,
      error?: string | null,
      recipeId?: string | null
    ) => Promise<void>,
    candidate: DuplicateCandidate
  ): Promise<boolean> {
    const match = await findDuplicateRecipe(candidate, {
      ownerId: SYSTEM_USER_ID,
      titleRule: true,
    });
    if (!match) return false;
    // #135: the deadline may have closed the run during the lookup; counters are then final.
    if (candidate.sourceUrl && this.released(m, candidate.sourceUrl)) return true;
    const reason = duplicateSkipReason(match);
    console.log(`[AutonomousIngestion] ${reason} (${match.reason}): ${candidate.sourceUrl}`);
    m.recipesSkipped++;
    await record('skipped_duplicate', reason, match.id);
    return true;
  }

  /** #6: true once the run closed or another row claimed `url`; late work then changes nothing. */
  private released(m: RunMetrics, url: string): boolean {
    return m.closed || m.itemUrls.has(url);
  }

  /** Writes one item row; a failed write on a tracked run is counted, never thrown. */
  private async recordItem(m: RunMetrics, item: RunItemInput): Promise<void> {
    // #6: claim before any await — exactly one row per URL under any interleaving.
    if (m.closed || m.itemUrls.has(item.url)) return;
    m.itemUrls.add(item.url);
    const written = await recordRunItem(item);
    if (!written && isTrackedRunId(item.runId)) m.itemWriteFailures++;
  }

  private async resolveChefId(
    recipe: ScrapedRecipe,
    url: string,
    m: RunMetrics
  ): Promise<string | null> {
    if (!recipe.chef_name) return null;
    try {
      const chefDomain = sourceDomainOf(url);
      const chefWebsite = chefDomain ? `https://${chefDomain}` : undefined;
      const chefProfile = await this.chefDiscoveryService.findOrCreateChef(
        recipe.chef_name,
        chefWebsite
      );
      if (chefProfile.isNew && !this.released(m, url)) m.chefsCreated++;
      return chefProfile.id;
    } catch (chefErr) {
      const msg = chefErr instanceof Error ? chefErr.message : String(chefErr);
      console.warn(
        `[AutonomousIngestion] Chef lookup failed for "${recipe.chef_name}", continuing without chef link: ${msg}`
      );
      return null;
    }
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
let _instance: AutonomousRecipeIngestionService | null = null;

export function getAutonomousRecipeIngestionService(): AutonomousRecipeIngestionService {
  if (!_instance) {
    _instance = new AutonomousRecipeIngestionService();
  }
  return _instance;
}
