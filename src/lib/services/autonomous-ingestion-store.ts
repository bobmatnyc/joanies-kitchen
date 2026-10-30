/**
 * DB writes and run bookkeeping for `AutonomousRecipeIngestionService`.
 *
 * Why: `autonomous-recipe-ingestion.service.ts` had grown past the 500-line
 * cap (#142). These helpers hold no service state, so they live here.
 * What: store a recipe with its chef link, record the recipe of the day,
 * pre-check URLs already ingested, and build the run result.
 * Test: `src/lib/services/__tests__/run-accounting.test.ts`,
 * `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipeOfTheDay } from '@/lib/db/autonomous-scraper-schema';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { pickRecipeImage } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import type { DiscoveryRunStatus } from './discovery-run-store';
import type { ScrapedRecipe } from './recipe-extraction.service';

export const SYSTEM_USER_ID = 'system';

export interface RunMetrics {
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
  /** #6 S2: item rows that failed to write (fail-open); summarised into errors[]. */
  itemWriteFailures: number;
  /** False when the run row could not be created (dry run or create failure). */
  tracked: boolean;
  /**
   * #6: true once the deadline hit. Abandoned in-flight work then writes no
   * item rows and moves no counters, so the finalized counters match the items.
   */
  closed: boolean;
  /** #6: URLs that already have (or are writing) their item row. */
  itemUrls: Set<string>;
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
  /** False when no `recipe_discovery_runs` row backs this run. */
  tracked: boolean;
}

/**
 * Record the featured recipe of the day.
 * Uses ON CONFLICT DO NOTHING so re-runs on the same day are idempotent.
 */
export async function recordRecipeOfTheDay(recipeId: string, sourceUrl: string): Promise<void> {
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
export async function storeIngestedRecipe(
  recipe: ScrapedRecipe,
  chefId: string | null,
  sourceUrl: string,
  searchQuery: string
): Promise<string | null> {
  // #185: last check before the write; a site asset is stored as no image (NULL).
  const imageUrl = pickRecipeImage({ contentImages: recipe.image_url });
  const [newRecipe] = await db
    .insert(recipes)
    .values({
      user_id: SYSTEM_USER_ID,
      chef_id: chefId ?? undefined,
      name: recipe.title,
      description: recipe.description ?? '',
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      // #12: integer columns get an integer or null, whatever the extractor produced.
      prep_time: toRecipeInt(recipe.prep_time),
      cook_time: toRecipeInt(recipe.cook_time),
      servings: toRecipeInt(recipe.servings),
      cuisine: recipe.cuisine,
      tags: JSON.stringify(recipe.tags),
      images: JSON.stringify(imageUrl ? [imageUrl] : []),
      image_url: imageUrl,
      is_public: true,
      is_system_recipe: true,
      source: sourceUrl,
      search_query: searchQuery,
      discovery_date: new Date(),
      discovery_week: getISOWeek(new Date()),
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

  const newRecipeId = newRecipe.id;

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
export async function checkUrlDuplicates(urls: string[]): Promise<Set<string>> {
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
    console.error(`[AutonomousIngestion] Duplicate check failed (assuming no duplicates): ${msg}`);
    return new Set();
  }
}

export function determineRunStatus(recipesStored: number, errors: string[]): DiscoveryRunStatus {
  if (errors.length > 0 && recipesStored > 0) return 'partial';
  if (errors.length > 0 && recipesStored === 0) return 'failed';
  return 'completed';
}

export function buildRunResult(
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
    // #6 S2: item-write failures are surfaced as one summary entry. It is added
    // here, after the status was decided, so it never changes the status.
    errors:
      metrics.itemWriteFailures > 0
        ? [...metrics.errors, `item writes failed: ${metrics.itemWriteFailures}`]
        : metrics.errors,
    durationMs: Date.now() - startTime,
    tracked: metrics.tracked,
  };
}

/**
 * Get ISO week number for a date (1-52)
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
