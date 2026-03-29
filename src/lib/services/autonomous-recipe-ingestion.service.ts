/**
 * Autonomous Recipe Ingestion Service
 *
 * Main orchestrator for the daily zero-waste recipe discovery pipeline:
 *   1. Create run record
 *   2. Search → discover recipe URLs via Tavily
 *   3. Deduplicate URLs (recipes.source + chefRecipes.original_url)
 *   4. Extract recipe data (Firecrawl → Jina → Tavily Extract → Claude)
 *   5. Quality gate: title + ingredients + instructions required
 *   6. Find/create chef profile
 *   7. Store recipe + link to chef
 *   8. Update run record with final metrics
 *
 * Adapted from aipowerranking AutomatedIngestionService.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipeDiscoveryRuns } from '@/lib/db/autonomous-scraper-schema';
import { RecipeDiscoveryService, getRecipeDiscoveryService } from './recipe-discovery.service';
import { RecipeExtractionService, getRecipeExtractionService } from './recipe-extraction.service';
import { ChefDiscoveryService, getChefDiscoveryService } from './chef-discovery.service';
import type { ScrapedRecipe } from './recipe-extraction.service';

const ZERO_WASTE_TAGS = ['zero-waste', 'scraped'];
const EXTRACTION_DELAY_MS = 2000; // 2 seconds between URL extractions
const BATCH_DELAY_MS = 5000; // 5 seconds between discovery batches
const SYSTEM_USER_ID = 'system';

export interface IngestionRunOptions {
  dryRun?: boolean;
  maxRecipes?: number;
  searchQuery?: string;
}

export interface IngestionRunResult {
  runId: string;
  status: 'completed' | 'failed' | 'partial';
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

  // Empty constructor - services are lazily initialized via getters
  constructor() {}

  /**
   * Run the full daily discovery pipeline
   */
  async runDailyDiscovery(options: IngestionRunOptions = {}): Promise<IngestionRunResult> {
    const startTime = Date.now();
    const isDryRun = options.dryRun ?? false;
    const maxRecipes = options.maxRecipes ?? 3;

    console.log(
      `[AutonomousIngestion] Starting daily discovery — dryRun=${isDryRun}, maxRecipes=${maxRecipes}`
    );

    const errors: string[] = [];
    let runId = '';
    let urlsDiscovered = 0;
    let recipesExtracted = 0;
    let recipesStored = 0;
    let recipesSkipped = 0;
    let chefsCreated = 0;

    try {
      // Step 1: Create run record (skip in dry run)
      if (!isDryRun) {
        runId = await this.createRun(isDryRun);
        console.log(`[AutonomousIngestion] Run record created: ${runId}`);
      } else {
        runId = `dry-run-${Date.now()}`;
        console.log('[AutonomousIngestion] Dry run — no DB record created');
      }

      // Step 2: Discover recipe URLs
      if (!this.discoveryService.isConfigured()) {
        throw new Error('TAVILY_API_KEY not configured — cannot discover recipes');
      }

      const discoveredUrls = await this.discoveryService.discoverRecipeUrls({
        maxResults: maxRecipes * 4, // Fetch extra to account for deduplication and failures
        searchQuery: options.searchQuery,
      });

      urlsDiscovered = discoveredUrls.length;
      console.log(`[AutonomousIngestion] Discovered ${urlsDiscovered} URLs`);

      if (urlsDiscovered === 0) {
        return this.buildResult(
          runId, 'completed', { urlsDiscovered, recipesExtracted, recipesStored, recipesSkipped, chefsCreated, errors },
          startTime
        );
      }

      // Step 3: Deduplicate against existing chefRecipes.original_url
      const allUrls = discoveredUrls.map((d) => d.url);
      const existingUrls = await this.checkUrlDuplicates(allUrls);
      const newUrls = discoveredUrls.filter((d) => !existingUrls.has(d.url));

      const urlDuplicates = urlsDiscovered - newUrls.length;
      if (urlDuplicates > 0) {
        console.log(`[AutonomousIngestion] Skipped ${urlDuplicates} duplicate URLs`);
        recipesSkipped += urlDuplicates;
      }

      if (newUrls.length === 0) {
        console.log('[AutonomousIngestion] All URLs already ingested');
        return this.buildResult(
          runId, 'completed', { urlsDiscovered, recipesExtracted, recipesStored, recipesSkipped, chefsCreated, errors },
          startTime
        );
      }

      // Step 4: Extract recipes (up to maxRecipes)
      const urlsToProcess = newUrls.slice(0, maxRecipes * 2); // Process extra in case some fail quality gate

      for (const discovered of urlsToProcess) {
        if (recipesStored >= maxRecipes) break;

        try {
          console.log(`[AutonomousIngestion] Extracting: ${discovered.url}`);

          const recipe = await this.extractionService.extractRecipe(discovered.url);

          if (!recipe) {
            errors.push(`Extraction failed: ${discovered.url}`);
            continue;
          }

          recipesExtracted++;

          // Step 5: Quality gate
          if (!this.extractionService.isViableRecipe(recipe)) {
            console.log(`[AutonomousIngestion] Quality gate failed for: ${recipe.title}`);
            recipesSkipped++;
            continue;
          }

          // Inject zero-waste tags
          recipe.tags = [...new Set([...ZERO_WASTE_TAGS, ...recipe.tags])];

          // Step 6: Find/create chef
          let chefId: string | null = null;
          if (recipe.chef_name) {
            const chefDomain = this.extractRootDomain(discovered.url);
            const chefWebsite = chefDomain ? `https://${chefDomain}` : undefined;

            const chefProfile = await this.chefDiscoveryService.findOrCreateChef(
              recipe.chef_name,
              chefWebsite
            );
            chefId = chefProfile.id;
            if (chefProfile.isNew) chefsCreated++;
          }

          // Step 7: Store recipe
          if (!isDryRun) {
            const recipeId = await this.storeRecipe(recipe, chefId, discovered.url, discovered.searchQuery);
            if (recipeId) {
              recipesStored++;
              console.log(`[AutonomousIngestion] Stored recipe: "${recipe.title}" (${recipeId})`);
            }
          } else {
            recipesStored++;
            console.log(`[AutonomousIngestion] [DRY RUN] Would store: "${recipe.title}"`);
          }

          // Rate limit between extractions
          if (urlsToProcess.indexOf(discovered) < urlsToProcess.length - 1) {
            await this.sleep(EXTRACTION_DELAY_MS);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[AutonomousIngestion] Error processing ${discovered.url}: ${msg}`);
          errors.push(`${discovered.url}: ${msg}`);
        }
      }

      // Pause between discovery batches (if future batch support is needed)
      await this.sleep(BATCH_DELAY_MS);

      const status = this.determineStatus(recipesStored, errors);
      const result = this.buildResult(
        runId,
        status,
        { urlsDiscovered, recipesExtracted, recipesStored, recipesSkipped, chefsCreated, errors },
        startTime
      );

      // Step 8: Update run record
      if (!isDryRun) {
        await this.updateRun(runId, result);
      }

      console.log(
        `[AutonomousIngestion] Completed — stored=${recipesStored}, skipped=${recipesSkipped}, errors=${errors.length}, duration=${result.durationMs}ms`
      );

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutonomousIngestion] Pipeline error: ${msg}`);
      errors.push(`Pipeline error: ${msg}`);

      const result = this.buildResult(
        runId,
        'failed',
        { urlsDiscovered, recipesExtracted, recipesStored, recipesSkipped, chefsCreated, errors },
        startTime
      );

      if (!isDryRun && runId && !runId.startsWith('dry-run')) {
        try {
          await this.updateRun(runId, result);
        } catch (updateErr) {
          console.error('[AutonomousIngestion] Failed to update run record with error status');
        }
      }

      return result;
    }
  }

  /**
   * Store a recipe and link it to a chef
   */
  private async storeRecipe(
    recipe: ScrapedRecipe,
    chefId: string | null,
    sourceUrl: string,
    searchQuery: string
  ): Promise<string | null> {
    try {
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
        throw new Error('No ID returned after recipe insert');
      }

      // Link to chef
      if (chefId) {
        await db
          .insert(chefRecipes)
          .values({
            chef_id: chefId,
            recipe_id: newRecipe.id,
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
      }

      return newRecipe.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutonomousIngestion] DB insert failed: ${msg}`);
      return null;
    }
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
      bySource.forEach((r) => r.source && seen.add(r.source));

      // Check chefRecipes.original_url (secondary — catches chef-linked scrapes)
      const byChefUrl = await db
        .select({ original_url: chefRecipes.original_url })
        .from(chefRecipes)
        .where(inArray(chefRecipes.original_url, validUrls));
      byChefUrl.forEach((r) => r.original_url && seen.add(r.original_url));

      return seen;
    } catch (error) {
      console.error('[AutonomousIngestion] Duplicate check failed, assuming no duplicates');
      return new Set();
    }
  }

  /**
   * Create a new run record in the DB
   */
  private async createRun(isDryRun: boolean): Promise<string> {
    const [run] = await db
      .insert(recipeDiscoveryRuns)
      .values({
        run_type: 'daily',
        status: 'running',
        dry_run: isDryRun,
        urls_discovered: 0,
        recipes_extracted: 0,
        recipes_stored: 0,
        recipes_skipped: 0,
        chefs_created: 0,
        errors: [],
        started_at: new Date(),
      })
      .returning({ id: recipeDiscoveryRuns.id });

    if (!run?.id) throw new Error('Failed to create recipe discovery run record');
    return run.id;
  }

  /**
   * Update an existing run record with final metrics
   */
  private async updateRun(runId: string, result: IngestionRunResult): Promise<void> {
    try {
      await db
        .update(recipeDiscoveryRuns)
        .set({
          status: result.status === 'partial' ? 'completed' : result.status,
          urls_discovered: result.urlsDiscovered,
          recipes_extracted: result.recipesExtracted,
          recipes_stored: result.recipesStored,
          recipes_skipped: result.recipesSkipped,
          chefs_created: result.chefsCreated,
          errors: result.errors,
          completed_at: new Date(),
          duration_ms: result.durationMs,
        })
        .where(eq(recipeDiscoveryRuns.id, runId));
    } catch (error) {
      console.error(`[AutonomousIngestion] Failed to update run ${runId}:`, error);
    }
  }

  private determineStatus(
    recipesStored: number,
    errors: string[]
  ): 'completed' | 'failed' | 'partial' {
    if (errors.length > 0 && recipesStored > 0) return 'partial';
    if (errors.length > 0 && recipesStored === 0) return 'failed';
    return 'completed';
  }

  private buildResult(
    runId: string,
    status: 'completed' | 'failed' | 'partial',
    metrics: {
      urlsDiscovered: number;
      recipesExtracted: number;
      recipesStored: number;
      recipesSkipped: number;
      chefsCreated: number;
      errors: string[];
    },
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

  private extractRootDomain(url: string): string | null {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return null;
    }
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
