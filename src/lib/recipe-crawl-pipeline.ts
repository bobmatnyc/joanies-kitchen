/**
 * Recipe crawl pipelines: weekly (Perplexity) and legacy search (SerpAPI).
 *
 * Why: `src/lib/recipe-crawl.ts` had grown past the 500-line cap, and its two
 * pipelines repeated the same per-URL convert → approve → store body (#142).
 * What: `crawlOneUrl` runs that body for one URL; `crawlWeeklyRecipes` and
 * `crawlAndStoreRecipes` differ only in discovery and in how they store.
 * `src/lib/recipe-crawl.ts` re-exports both pipelines.
 * Test: `src/lib/services/__tests__/recipe-crawl-dedup.test.ts`,
 * `src/lib/services/__tests__/recipe-crawl-should-continue.test.ts`
 *
 * #13: server-internal and deliberately NOT 'use server'.
 */

import { discoverWeeklyRecipes } from '@/lib/perplexity-discovery';
import {
  type CrawlRecipeResult,
  type CrawlStats,
  convertUrlToRecipe,
  type ExtractedRecipe,
  searchRecipesOnline,
  validateRecipe,
} from '@/lib/recipe-crawl-steps';
import { type StoreRecipeResult, storeCrawledRecipe } from '@/lib/recipe-crawl-store';
import { type DuplicateMatch, duplicateSkipReason, findDuplicateRecipe } from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { formatWeekInfo, getWeekInfo, type WeekInfo } from '@/lib/week-utils';

/** #135: a skipped duplicate, reported as 'rejected' and linked to the stored recipe. */
function duplicateCrawlResult(url: string, name: string, match: DuplicateMatch): CrawlRecipeResult {
  const reason = duplicateSkipReason(match);
  console.log(`[Crawl] ${reason} (${match.reason}): ${url}`);
  return { id: match.id, url, name, status: 'rejected', reason, duplicateOf: match.id };
}

/** #135: checked before the paid scrape; the title half of the rule runs again at store time. */
const urlDuplicate = (url: string) => findDuplicateRecipe({ sourceUrl: url }, { titleRule: true });

const emptyStats = (): CrawlStats => ({
  searched: 0,
  converted: 0,
  approved: 0,
  stored: 0,
  failed: 0,
});

interface CrawlRun {
  /** Log prefix, e.g. `[Pipeline]`. */
  label: string;
  stats: CrawlStats;
  results: CrawlRecipeResult[];
  autoApprove?: boolean;
}

/**
 * #142: convert → approve → store one discovered URL, pushing exactly one
 * result and updating `run.stats`. Never throws: one bad URL must not fail the run.
 */
async function crawlOneUrl(
  run: CrawlRun,
  found: { url: string; title: string },
  store: (recipe: ExtractedRecipe) => Promise<StoreRecipeResult>
): Promise<void> {
  const { label, stats, results } = run;
  try {
    console.log(`${label} Processing: ${found.url}`);

    const known = await urlDuplicate(found.url); // #135
    if (known) {
      results.push(duplicateCrawlResult(found.url, found.title, known));
      return;
    }

    // STEP 2: Convert (Extract recipe from URL)
    const conversion = await convertUrlToRecipe(found.url);

    if (!conversion.success || !conversion.recipe) {
      results.push({
        url: found.url,
        name: found.title,
        status: 'failed',
        reason: conversion.error || 'Extraction failed',
      });
      stats.failed++;
      return;
    }

    const recipe = conversion.recipe;
    stats.converted++;
    console.log(`${label} Step 2 complete: Extracted "${recipe.name}"`);

    // STEP 3: Approve (Validate)
    const validation = await validateRecipe(recipe);

    if (!validation.approved && !run.autoApprove) {
      results.push({
        url: found.url,
        name: recipe.name,
        status: 'rejected',
        reason: validation.issues.join(', '),
      });
      console.log(`${label} Step 3: REJECTED "${recipe.name}"`);
      return;
    }

    stats.approved++;
    console.log(`${label} Step 3 complete: Approved "${recipe.name}"`);

    // STEP 4: Store
    const storage = await store(recipe);

    if (storage.duplicate) {
      results.push(duplicateCrawlResult(found.url, recipe.name, storage.duplicate));
    } else if (storage.success && storage.recipeId) {
      results.push({ id: storage.recipeId, url: found.url, name: recipe.name, status: 'stored' });
      stats.stored++;
      console.log(`${label} Step 4 complete: Stored "${recipe.name}"`);
    } else {
      results.push({ url: found.url, name: recipe.name, status: 'failed', reason: storage.error });
      stats.failed++;
    }

    // Rate limiting: wait 2 seconds between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error: unknown) {
    console.error(`${label} Error processing ${found.url}:`, toErrorMessage(error));
    results.push({
      url: found.url,
      name: found.title,
      status: 'failed',
      reason: toErrorMessage(error),
    });
    stats.failed++;
  }
}

/**
 * Weekly recipe discovery pipeline using Perplexity AI
 * Discovers recipes published in a specific week
 *
 * @param weeksAgo - Number of weeks in the past (0 = current week)
 * @param options - Discovery options
 * @returns Pipeline results with week info and statistics
 */
export async function crawlWeeklyRecipes(
  weeksAgo: number = 0,
  options?: {
    cuisine?: string;
    maxResults?: number;
    autoApprove?: boolean;
    /**
     * #6 S2: checked before each paid URL; returning false stops the week.
     * Server-side callers only (e.g. the run budget in recorded-weekly-crawl).
     */
    shouldContinue?: () => boolean;
  }
): Promise<{
  success: boolean;
  weekInfo: WeekInfo;
  stats: CrawlStats;
  recipes: CrawlRecipeResult[];
  /** URLs discovered but never processed because `shouldContinue` returned false. */
  stoppedUrls?: string[];
  error?: string;
}> {
  const weekInfo = getWeekInfo(weeksAgo);
  const run: CrawlRun = {
    label: '[Weekly Pipeline]',
    stats: emptyStats(),
    results: [],
    autoApprove: options?.autoApprove,
  };
  const { stats, results: recipeResults } = run;
  const stoppedUrls: string[] = [];

  try {
    console.log(`[Weekly Pipeline] Starting discovery for ${formatWeekInfo(weekInfo)}`);

    // STEP 1: Discover recipes using Perplexity
    const discovery = await discoverWeeklyRecipes(weekInfo, {
      cuisine: options?.cuisine,
      maxResults: options?.maxResults || 10,
    });

    if (!discovery.success) {
      return { success: false, weekInfo, stats, recipes: recipeResults, error: discovery.error };
    }

    stats.searched = discovery.recipes.length;
    console.log(`[Weekly Pipeline] Step 1 complete: Discovered ${stats.searched} recipes`);

    for (const [index, result] of discovery.recipes.entries()) {
      if (options?.shouldContinue && !options.shouldContinue()) {
        stoppedUrls.push(...discovery.recipes.slice(index).map((r) => r.url));
        console.warn(`[Weekly Pipeline] Stopped before ${stoppedUrls.length} URL(s)`);
        break;
      }
      // STEP 4 stores with week tracking.
      await crawlOneUrl(run, result, (recipe) =>
        storeCrawledRecipe(recipe, {
          sourceUrl: result.url,
          week: { info: weekInfo, publishedDate: result.publishedDate },
        })
      );
    }

    console.log(`[Weekly Pipeline] Complete! Stats:`, stats);

    return { success: true, weekInfo, stats, recipes: recipeResults, stoppedUrls };
  } catch (error: unknown) {
    const errorMsg = toErrorMessage(error);
    console.error(`[Store] Error storing recipe:`, errorMsg);
    return { success: false, weekInfo, stats, recipes: recipeResults, error: errorMsg };
  }
}

/**
 * Complete web crawl pipeline: Search → Convert → Approve → Store
 * Uses SerpAPI for search (legacy method)
 *
 * @param query - Search query
 * @param options - Pipeline options
 * @returns Pipeline results with statistics
 */
export async function crawlAndStoreRecipes(
  query: string,
  options?: {
    maxResults?: number;
    autoApprove?: boolean;
    minConfidence?: number;
  }
): Promise<{
  success: boolean;
  stats: CrawlStats;
  recipes: CrawlRecipeResult[];
}> {
  const run: CrawlRun = {
    label: '[Pipeline]',
    stats: emptyStats(),
    results: [],
    autoApprove: options?.autoApprove,
  };
  const { stats, results: recipeResults } = run;

  try {
    console.log(`[Pipeline] Starting crawl for: "${query}"`);
    console.log(`[Pipeline] Options:`, options);

    // STEP 1: Search
    const searchResults = await searchRecipesOnline(query, {
      maxResults: options?.maxResults || 5,
      filterToRecipeSites: true,
    });

    if (!searchResults.success) {
      throw new Error(`Search failed: ${searchResults.error}`);
    }

    stats.searched = searchResults.results.length;
    console.log(`[Pipeline] Step 1 complete: Found ${stats.searched} results`);

    for (const result of searchResults.results) {
      await crawlOneUrl(run, result, (recipe) =>
        storeCrawledRecipe(recipe, { sourceUrl: result.url, searchQuery: query })
      );
    }

    console.log(`[Pipeline] Complete! Stats:`, stats);

    return { success: true, stats, recipes: recipeResults };
  } catch (error: unknown) {
    const errorMsg = toErrorMessage(error);
    console.error(`[Pipeline] Fatal error:`, errorMsg);
    return { success: false, stats, recipes: recipeResults };
  }
}
