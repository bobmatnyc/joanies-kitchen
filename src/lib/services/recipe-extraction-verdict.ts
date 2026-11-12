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

import type {
  ChainVerdict,
  ExtractionTierAttempt,
  ExtractionTierResult,
  ScrapedRecipe,
} from './recipe-extraction.types';

/** What the Firecrawl tier saw, filled by `extractWithFirecrawl`. */
export interface FirecrawlSeen {
  /** The page carried schema.org data (JSON-LD), whatever its type. */
  schemaRead: boolean;
  /** One of those schema objects was a Recipe. */
  recipeSchema: boolean;
  /** The scraped markdown and title, for the interstitial check. */
  text: string;
  /** #302: the page title, for the index-title verdict. */
  title?: string;
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

/** #314: page titles Cloudflare gives its challenge pages. */
const CHALLENGE_TITLE =
  /^\s*(?:just a moment(?:\.{3}|…)|attention required!|checking your browser\b)/i;

/**
 * #314: the longest body read as a challenge page. Challenge bodies are short
 * (Jina returned 56 chars on 11-11); a recipe page that mentions "captcha" in
 * its comment form is far longer, so it never matches.
 */
export const CHALLENGE_MAX_CHARS = 2000;

/**
 * Why: on 11-11 two Cloudflare pages reached the LLM path (#314); a challenge
 * page says nothing about the page behind it.
 * What: true when a Jina/Tavily response is short (`CHALLENGE_MAX_CHARS`) and
 * carries a challenge title or an interstitial pattern. The caller also
 * requires no regex-parsed ingredient or instruction.
 * Test: `reads a challenge response`, `does not read a recipe page as a challenge`
 */
export function isChallengeResponse(title: string | undefined, content: string): boolean {
  if (content.length > CHALLENGE_MAX_CHARS) return false;
  return (title !== undefined && CHALLENGE_TITLE.test(title)) || isInterstitialPage(content);
}

/**
 * Why: a page every tier saw only as a challenge is not a parse failure, and
 * its skip row is retried on the next run (#314).
 * What: `challenge` when at least one tier hit a challenge page and every
 * other attempt is `empty`; any `no_recipe`, `recipe_partial` or `error`
 * attempt keeps the #300 reading (an error stays an error).
 * Test: `challengeChainVerdict`
 */
export function challengeChainVerdict(
  attempts: ExtractionTierAttempt[],
  challenged: number
): ChainVerdict | null {
  if (challenged === 0) return null;
  return attempts.every((a) => a.result === 'empty') ? 'challenge' : null;
}

/** True when a schema object's `@type` is "Recipe" or an array containing it. */
function isRecipeType(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

/**
 * #300: the first schema.org Recipe in Firecrawl's `metadata.schema`, depth
 * first: a top-level object, any array of objects, or `@graph` members
 * (Yoast/WPRM nest the Recipe there). Undefined when there is none.
 */
export function findRecipeSchema(schema: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 5 || !schema || typeof schema !== 'object') return undefined;
  if (Array.isArray(schema)) {
    for (const item of schema) {
      const found = findRecipeSchema(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const node = schema as Record<string, unknown>;
  if (isRecipeType(node)) return node;
  return findRecipeSchema(node['@graph'], depth + 1);
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

/**
 * Page titles WordPress and similar CMSs give index and listing pages:
 * "Cooking With Legends Archives - Lidia", "Category: Soups", "Page 2 of 9".
 */
const INDEX_TITLE_PATTERNS: RegExp[] = [
  // #302: WordPress shape only: plural "Archives" before a separator or at the end.
  /\barchives\s*(?:[-–—|:·•»]|$)/i,
  /\b(?:category|tag|topic)\s*:/i,
  /\b(?:posts|articles|recipes)\s+(?:tagged|in\s+category|filed\s+under)\b/i,
  /\bpage\s+\d+\s+of\s+\d+\b/i,
];

/**
 * Why: on the 2026-11-09 run six index pages read by Jina still spent 25s in
 * Tavily and the LLM (#302); their title alone says there is no recipe.
 * What: `index-title` when the scraped page title matches an index/archive
 * pattern, else null. Deterministic: no title, no verdict.
 * Test: `src/lib/services/__tests__/cron-tier-speedups-302.test.ts`
 */
export function indexTitleVerdict(title: string | undefined): ChainVerdict | null {
  if (!title) return null;
  return INDEX_TITLE_PATTERNS.some((p) => p.test(title)) ? 'index-title' : null;
}
