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
 *   8. Update run record with final metrics and in-memory cost
 *
 * Every URL attempted gets one `recipe_discovery_run_items` row (#6 S2).
 *
 * Adapted from aipowerranking AutomatedIngestionService.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import {
  currentRunSpend,
  formatBudgetExceeded,
  isBudgetExhausted,
  resolveRunBudget,
  setCostRunId,
  withCostRun,
} from '@/lib/costs';
import { db } from '@/lib/db';
import { recipeOfTheDay } from '@/lib/db/autonomous-scraper-schema';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { type ChefDiscoveryService, getChefDiscoveryService } from './chef-discovery.service';
import {
  createDiscoveryRun,
  type DiscoveryRunStatus,
  type DiscoveryRunType,
  finalizeDiscoveryRun,
  isTrackedRunId,
  type RunItemOutcome,
  recordRunItem,
  sourceDomainOf,
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
const SYSTEM_USER_ID = 'system';

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
}

interface RunMetrics {
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
}

export interface IngestionRunResult {
  runId: string;
  status: DiscoveryRunStatus;
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
  durationMs: number;
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
    };
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

    try {
      // Step 2: Discover recipe URLs
      if (!this.discoveryService.isConfigured()) {
        throw new Error('TAVILY_API_KEY not configured — cannot discover recipes');
      }
      if (budgetExhausted()) {
        status = 'partial';
        return this.buildResult(runId, status, m, startTime);
      }

      const discoveredUrls = await this.discoveryService.discoverRecipeUrls({
        maxResults: maxRecipes * 4, // Fetch extra to account for deduplication and failures
        searchQuery,
      });

      m.urlsDiscovered = discoveredUrls.length;
      console.log(`[AutonomousIngestion] Discovered ${m.urlsDiscovered} URLs`);

      if (m.urlsDiscovered === 0) {
        status = 'completed';
        return this.buildResult(runId, status, m, startTime);
      }

      // Step 3: Deduplicate against existing recipes.source + chefRecipes.original_url
      const existingUrls = await this.checkUrlDuplicates(discoveredUrls.map((d) => d.url));
      const newUrls = discoveredUrls.filter((d) => !existingUrls.has(d.url));

      for (const dup of discoveredUrls.filter((d) => existingUrls.has(d.url))) {
        m.recipesSkipped++;
        await recordRunItem({
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
        return this.buildResult(runId, status, m, startTime);
      }

      // Step 4: Extract recipes (up to maxRecipes)
      const urlsToProcess = newUrls.slice(0, maxRecipes * 2); // Process extra in case some fail quality gate

      for (let i = 0; i < urlsToProcess.length; i++) {
        if (m.recipesStored >= maxRecipes) break;
        if (budgetExhausted()) {
          // #6 S2: record every queued URL the budget cut, then stop paid calls.
          for (const cut of urlsToProcess.slice(i)) {
            await recordRunItem({
              runId,
              url: cut.url,
              extractionTier: 'none',
              outcome: 'budget_stopped',
              error: m.errors.find((e) => e.startsWith('budget exceeded')) ?? null,
            });
          }
          break;
        }

        await this.processUrl(urlsToProcess[i], runId, isDryRun, m);

        // Rate limit between extractions
        if (i < urlsToProcess.length - 1) {
          await this.sleep(EXTRACTION_DELAY_MS);
        }
      }

      status = budgetStopped ? 'partial' : this.determineStatus(m.recipesStored, m.errors);

      console.log(
        `[AutonomousIngestion] Completed — stored=${m.recipesStored}, extracted=${m.recipesExtracted}, ` +
          `skipped=${m.recipesSkipped}, errors=${m.errors.length}, status=${status}`
      );

      return this.buildResult(runId, status, m, startTime);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutonomousIngestion] Pipeline error: ${msg}`);
      m.errors.push(`Pipeline error: ${msg}`);
      status = 'failed';

      return this.buildResult(runId, status, m, startTime);
    } finally {
      // ALWAYS update the run record with terminal status — eliminates "stuck in running" ghost state.
      // This fires on: normal completion, early return (0 URLs), exception, or timeout.
      if (!isDryRun && runCreated && isTrackedRunId(runId)) {
        const finalResult = this.buildResult(runId, status, m, startTime);
        const spend = currentRunSpend() ?? { spentUsd: 0, writeFailures: 0 };
        try {
          await finalizeDiscoveryRun(runId, {
            ...finalResult,
            costUsd: spend.spentUsd,
            costWriteFailures: spend.writeFailures,
          });
          console.log(
            `[AutonomousIngestion] Run ${runId} finalized: status=${status}, ` +
              `cost=$${spend.spentUsd.toFixed(6)}, duration=${finalResult.durationMs}ms`
          );
        } catch (updateErr) {
          // Last-resort: log but do not re-throw (we're in finally)
          console.error(
            `[AutonomousIngestion] CRITICAL: failed to finalize run ${runId}:`,
            updateErr
          );
        }
      }
    }
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
      recordRunItem({ runId, url, extractionTier: tier, outcome, error, recipeId });

    try {
      console.log(`[AutonomousIngestion] Extracting: ${url}`);
      const recipe = await this.extractionService.extractRecipe(url);

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

      // Inject zero-waste tags
      recipe.tags = [...new Set([...ZERO_WASTE_TAGS, ...recipe.tags])];

      // Step 6: Find/create chef (non-fatal — store recipe without chef link on failure)
      const chefId = await this.resolveChefId(recipe, url, m);

      if (isDryRun) {
        m.recipesStored++;
        console.log(`[AutonomousIngestion] [DRY RUN] Would store: "${recipe.title}"`);
        return;
      }

      // Step 7: Store recipe
      let recipeId: string | null = null;
      try {
        recipeId = await this.storeRecipe(recipe, chefId, url, discovered.searchQuery);
      } catch (storeErr) {
        // storeRecipe already logs internally; surface into errors[] so it's visible in run metrics
        const msg = storeErr instanceof Error ? storeErr.message : String(storeErr);
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

      m.recipesStored++;
      console.log(`[AutonomousIngestion] Stored recipe: "${recipe.title}" (${recipeId})`);
      // Record first stored recipe as today's Recipe of the Day
      if (m.recipesStored === 1) {
        await this.recordRecipeOfTheDay(recipeId, url);
      }
      await record('stored', null, recipeId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutonomousIngestion] Error processing ${url}: ${msg}`);
      m.errors.push(`${url}: ${msg}`);
      await record('failed', msg);
    }
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
      if (chefProfile.isNew) m.chefsCreated++;
      return chefProfile.id;
    } catch (chefErr) {
      const msg = chefErr instanceof Error ? chefErr.message : String(chefErr);
      console.warn(
        `[AutonomousIngestion] Chef lookup failed for "${recipe.chef_name}", continuing without chef link: ${msg}`
      );
      return null;
    }
  }
  /**
   * Record the featured recipe of the day.
   * Uses ON CONFLICT DO NOTHING so re-runs on the same day are idempotent.
   */
  private async recordRecipeOfTheDay(recipeId: string, sourceUrl: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      await db
        .insert(recipeOfTheDay)
        .values({
          recipe_id: recipeId,
          date: today,
          source_url: sourceUrl,
          theme: 'no-waste',
        })
        .onConflictDoNothing();
      console.log(`[AutonomousIngestion] Recorded recipe-of-the-day for ${today}: ${recipeId}`);
    } catch (error) {
      // Non-fatal — log but don't fail the pipeline
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutonomousIngestion] Failed to record recipe-of-the-day: ${msg}`);
    }
  }

  /**
   * Store a recipe and link it to a chef.
   *
   * Throws on DB errors so the caller (runDailyDiscovery) can surface the real
   * error message into errors[] and distinguish "extracted but not stored" cases.
   * The caller is responsible for catching and continuing to the next URL.
   */
  private async storeRecipe(
    recipe: ScrapedRecipe,
    chefId: string | null,
    sourceUrl: string,
    searchQuery: string
  ): Promise<string | null> {
    let newRecipeId: string | null = null;

    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: SYSTEM_USER_ID,
        chef_id: chefId ?? undefined,
        name: recipe.title,
        description: recipe.description ?? '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        cuisine: recipe.cuisine,
        tags: JSON.stringify(recipe.tags),
        images: recipe.image_url ? JSON.stringify([recipe.image_url]) : JSON.stringify([]),
        image_url: recipe.image_url ?? null,
        is_public: true,
        is_system_recipe: true,
        source: sourceUrl,
        search_query: searchQuery,
        discovery_date: new Date(),
        discovery_week: this.getISOWeek(new Date()),
        discovery_year: new Date().getFullYear(),
        license: 'ALL_RIGHTS_RESERVED',
        // Auto-approve system-scraped recipes (high-confidence path)
        moderation_status: 'approved',
        qa_status: 'validated',
        // Zero-waste enrichment — all scraped recipes get baseline score/tags
        resourcefulness_score: 3, // Default mid-range; enrichment job can refine later
        waste_reduction_tags: JSON.stringify(['zero-waste', 'scraped', 'no-waste']),
      })
      .returning({ id: recipes.id });

    if (!newRecipe?.id) {
      throw new Error('DB insert returned no ID — possible schema constraint violation');
    }

    newRecipeId = newRecipe.id;

    // Link to chef (non-fatal if this fails)
    if (chefId) {
      try {
        await db
          .insert(chefRecipes)
          .values({
            chef_id: chefId,
            recipe_id: newRecipeId,
            original_url: sourceUrl,
            scraped_at: new Date(),
          })
          .onConflictDoNothing();

        // Increment chef's recipe count
        await db
          .update(chefs)
          .set({
            recipe_count: sql`${chefs.recipe_count} + 1`,
            updated_at: new Date(),
          })
          .where(eq(chefs.id, chefId));
      } catch (chefLinkErr) {
        const msg = chefLinkErr instanceof Error ? chefLinkErr.message : String(chefLinkErr);
        console.warn(
          `[AutonomousIngestion] Chef link failed for recipe ${newRecipeId} (non-fatal): ${msg}`
        );
        // Do not re-throw — recipe is already stored; chef link is supplemental
      }
    }

    return newRecipeId;
  }

  /**
   * Check which URLs already exist — dual check:
   *   1. recipes.source (catches all scraped recipes, with or without chef)
   *   2. chefRecipes.original_url (catches chef-linked recipes)
   */
  private async checkUrlDuplicates(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) return new Set();

    const validUrls = urls.filter((u): u is string => !!u);
    const seen = new Set<string>();

    try {
      // Check recipes.source (primary — catches all autonomous scrapes)
      const bySource = await db
        .select({ source: recipes.source })
        .from(recipes)
        .where(inArray(recipes.source, validUrls));
      for (const r of bySource) {
        if (r.source) seen.add(r.source);
      }

      // Check chefRecipes.original_url (secondary — catches chef-linked scrapes)
      const byChefUrl = await db
        .select({ original_url: chefRecipes.original_url })
        .from(chefRecipes)
        .where(inArray(chefRecipes.original_url, validUrls));
      for (const r of byChefUrl) {
        if (r.original_url) seen.add(r.original_url);
      }

      return seen;
    } catch (dupCheckErr) {
      const msg = dupCheckErr instanceof Error ? dupCheckErr.message : String(dupCheckErr);
      console.error(
        `[AutonomousIngestion] Duplicate check failed (assuming no duplicates): ${msg}`
      );
      return new Set();
    }
  }

  private determineStatus(recipesStored: number, errors: string[]): DiscoveryRunStatus {
    if (errors.length > 0 && recipesStored > 0) return 'partial';
    if (errors.length > 0 && recipesStored === 0) return 'failed';
    return 'completed';
  }

  private buildResult(
    runId: string,
    status: DiscoveryRunStatus,
    metrics: RunMetrics,
    startTime: number
  ): IngestionRunResult {
    return {
      runId,
      status,
      urlsDiscovered: metrics.urlsDiscovered,
      recipesExtracted: metrics.recipesExtracted,
      recipesStored: metrics.recipesStored,
      recipesSkipped: metrics.recipesSkipped,
      chefsCreated: metrics.chefsCreated,
      errors: metrics.errors,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get ISO week number for a date (1-52)
   */
  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
