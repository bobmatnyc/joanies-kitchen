'use server';

/**
 * Why: every export of a 'use server' file is callable by any visitor who can
 * load a page importing it, and each crawl step spends Perplexity, SerpAPI,
 * Firecrawl, LLM and embedding credits (#13).
 * What: admin-gated action wrappers over the server-internal pipeline in
 * `@/lib/recipe-crawl`. `requireAdmin` runs before any paid call and throws
 * `Admin access required` otherwise. Only the steps the admin UI calls are
 * exported; server code (routes, cron, scripts) imports `@/lib/recipe-crawl`.
 * Test: `src/app/actions/__tests__/paid-actions-auth.test.ts`
 */

import { requireAdmin } from '@/lib/admin';
import * as crawl from '@/lib/recipe-crawl';

export type {
  CrawlRecipeResult,
  CrawlStats,
  ExtractedRecipe,
  RecipeSearchResult,
  ValidationResult,
} from '@/lib/recipe-crawl';

/** Admin-only: weekly Perplexity discovery → convert → validate → store. */
export async function crawlWeeklyRecipes(
  ...args: Parameters<typeof crawl.crawlWeeklyRecipes>
): ReturnType<typeof crawl.crawlWeeklyRecipes> {
  await requireAdmin(); // #13: admin before any paid work
  return crawl.crawlWeeklyRecipes(...args);
}

/** Admin-only: legacy SerpAPI search → convert → validate → store. */
export async function crawlAndStoreRecipes(
  ...args: Parameters<typeof crawl.crawlAndStoreRecipes>
): ReturnType<typeof crawl.crawlAndStoreRecipes> {
  await requireAdmin(); // #13: admin before any paid work
  return crawl.crawlAndStoreRecipes(...args);
}

/** Admin-only: Firecrawl scrape + LLM extraction of one recipe URL. */
export async function convertUrlToRecipe(
  ...args: Parameters<typeof crawl.convertUrlToRecipe>
): ReturnType<typeof crawl.convertUrlToRecipe> {
  await requireAdmin(); // #13: admin before any paid work
  return crawl.convertUrlToRecipe(...args);
}
