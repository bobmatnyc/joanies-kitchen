/**
 * Per-tier miss verdicts for `RecipeExtractionService.extractRecipe` (#300).
 *
 * Why: a skipped page is never retried, so a tier may say "no recipe here"
 * only when it has a reliable verdict. A regex miss, a challenge page, or a
 * run with no LLM proves nothing about the page.
 * What: `firecrawlMiss` and `rawContentMiss` map what a tier saw to an
 * `ExtractionTierResult`; `isInterstitialPage` spots bot-check pages.
 * Test: `src/lib/services/__tests__/recipe-extraction-report-300.test.ts`
 */

import type { ExtractionTierResult, ScrapedRecipe } from './recipe-extraction.types';

/** What the Firecrawl tier saw, filled by `extractWithFirecrawl`. */
export interface FirecrawlSeen {
  /** The page carried schema.org data (JSON-LD), whatever its type. */
  schemaRead: boolean;
  /** One of those schema objects was a Recipe. */
  recipeSchema: boolean;
  /** The scraped markdown and title, for the interstitial check. */
  text: string;
}

/** What the LLM structuring step did, filled by `structureWithClaude`. */
export interface LlmVerdict {
  /** The LLM replied with parseable JSON: it judged the content. */
  ran: boolean;
  /** The call or the reply parse threw. */
  failed: boolean;
  /** Its reply held any ingredient or instruction. */
  partial: boolean;
}

export const newLlmVerdict = (): LlmVerdict => ({ ran: false, failed: false, partial: false });

/**
 * Bot-check and challenge pages served with HTTP 200 (Cloudflare and similar).
 * Their content says nothing about the page behind them.
 */
const INTERSTITIAL_PATTERNS: RegExp[] = [
  /just a moment\.\.\./i,
  /checking (?:if the site connection is secure|your browser)/i,
  /enable javascript and cookies to continue/i,
  /attention required!?\s*\|\s*cloudflare/i,
  /verify(?:ing)? you are (?:a )?human/i,
  /\bcf-(?:chl|browser-verification)\b/i,
  /\bcaptcha\b/i,
  /access denied/i,
];

/** True for a bot-check or challenge page. */
export function isInterstitialPage(text: string): boolean {
  return INTERSTITIAL_PATTERNS.some((p) => p.test(text));
}

/** True when a non-viable parse still found any ingredient or instruction. */
export function hasRecipeContent(recipe: Partial<ScrapedRecipe> | null | undefined): boolean {
  return (recipe?.ingredients?.length ?? 0) > 0 || (recipe?.instructions?.length ?? 0) > 0;
}

/**
 * Firecrawl's verdict: `recipe_partial` on a Recipe schema or any parsed
 * ingredient or instruction; `no_recipe` only on a schema read with no Recipe
 * in it (and not a challenge page); otherwise `empty`, since a regex miss on
 * markdown is no verdict.
 */
export function firecrawlMiss(
  result: ScrapedRecipe | null,
  seen: FirecrawlSeen
): ExtractionTierResult {
  if (seen.recipeSchema || hasRecipeContent(result)) return 'recipe_partial';
  if (seen.schemaRead && !isInterstitialPage(seen.text)) return 'no_recipe';
  return 'empty';
}

/**
 * Jina/Tavily verdict on real content: `recipe_partial` when the regex parse
 * or the LLM saw any ingredient or instruction; `error` when the LLM failed;
 * `no_recipe` only when the LLM ran and found nothing on a page that is not a
 * challenge page; otherwise `empty` (no LLM key, or a challenge page).
 */
export function rawContentMiss(
  parsed: ScrapedRecipe | null,
  llm: LlmVerdict,
  content: string
): ExtractionTierResult {
  if (hasRecipeContent(parsed) || llm.partial) return 'recipe_partial';
  if (llm.failed) return 'error';
  if (llm.ran && !isInterstitialPage(content)) return 'no_recipe';
  return 'empty';
}
