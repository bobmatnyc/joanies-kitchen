/**
 * Web Crawl Pipeline for Recipe Manager
 *
 * Complete pipeline for discovering, extracting, validating, and storing recipes from the web.
 *
 * Pipeline Flow:
 * 1. Search: Use Perplexity AI to find NEW recipes published in specific weeks
 * 2. Convert: Extract recipe data from URLs using AI
 * 3. Approve: Validate recipe quality and completeness
 * 4. Store: Save recipe to database with embeddings, images, and week tracking
 *
 * #142: the code lives in `recipe-crawl-steps.ts` (steps 1-3),
 * `recipe-crawl-store.ts` (step 4) and `recipe-crawl-pipeline.ts` (the two
 * pipelines); this module is the stable import path and re-exports them.
 *
 * #13: this module is server-internal and deliberately NOT 'use server', so
 * none of these paid functions is a client-callable action. Callers here have
 * already authorized the run: the cron/CRON_SECRET-gated routes, CLI scripts,
 * and the admin-gated wrappers in `src/app/actions/recipe-crawl.ts`.
 */

export { crawlAndStoreRecipes, crawlWeeklyRecipes } from '@/lib/recipe-crawl-pipeline';
export {
  type CrawlRecipeResult,
  type CrawlStats,
  convertUrlToRecipe,
  type ExtractedRecipe,
  type RecipeSearchResult,
  searchRecipesOnline,
  type ValidationResult,
  validateRecipe,
} from '@/lib/recipe-crawl-steps';
export { storeRecipe } from '@/lib/recipe-crawl-store';
