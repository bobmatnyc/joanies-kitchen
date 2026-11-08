/**
 * Recipe Extraction Service
 *
 * Extracts structured recipe data from a URL using a multi-tier extraction chain:
 *   1. Firecrawl (primary — structured JSON schema extraction)
 *   2. Jina Reader (fallback 1 — clean markdown extraction)
 *   3. Tavily Extract (fallback 2 — raw content extraction)
 *   4. Claude Haiku (structuring layer — parses unstructured content into recipe schema)
 *
 * Each tier falls back to the next only if the previous fails or returns insufficient content.
 * If OPENROUTER_API_KEY is set, Claude Haiku via OpenRouter structures any raw text.
 * Falls back to ANTHROPIC_API_KEY if OpenRouter is unavailable.
 */

import Firecrawl from '@mendable/firecrawl-js';
import OpenAI from 'openai';
import { extractFirstJsonObject } from '@/lib/ai/extract-first-json';
import { fetchContentWithJina } from '@/lib/ai/jina-scraper';
import {
  assertWithinDailyCap,
  TAVILY_EXTRACT_FLOOR_URLS,
  trackCost,
  unitsOrFloor,
  withChatCostTracking,
} from '@/lib/costs';
import { pickRecipeImage } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import { FirecrawlHttpError, formatFirecrawlFailure } from './firecrawl-failure-log';
import { endTier, startTier, timeStage } from './ingestion-timing';
import type {
  ExtractionReport,
  ExtractionTierAttempt,
  ExtractionTierResult,
  FirecrawlRecipeSchema,
  ScrapedRecipe,
} from './recipe-extraction.types';
import { mapFirecrawlSchema, parseMarkdown } from './recipe-extraction-parsers';
import {
  type FirecrawlSeen,
  findRecipeSchema,
  firecrawlMiss,
  type LlmVerdict,
  newLlmVerdict,
  rawContentMiss,
} from './recipe-extraction-verdict';

// #298: re-exported so callers keep importing it from this module.
export type { ExtractionReport, ScrapedRecipe } from './recipe-extraction.types';

const MIN_INGREDIENTS = 3;
const MIN_INSTRUCTIONS = 2;
const MIN_TITLE_LENGTH = 5;

export class RecipeExtractionService {
  private _firecrawl: Firecrawl | null = null;
  private _openrouter: OpenAI | null = null;

  private readonly firecrawlApiKey: string;
  private readonly jinaApiKey: string;
  private readonly tavilyApiKey: string;
  // OpenRouter is primary (same key as aipowerranking); ANTHROPIC_API_KEY kept as fallback label
  private readonly llmApiKey: string;
  private readonly llmBaseUrl: string;

  constructor() {
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY || '';
    this.jinaApiKey = process.env.JINA_API_KEY || '';
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    // Prefer OpenRouter (shared with aipowerranking), fall back to direct Anthropic
    this.llmApiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.llmBaseUrl = process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.anthropic.com/v1'; // unused if no key

    if (!this.firecrawlApiKey) {
      console.warn('[RecipeExtraction] FIRECRAWL_API_KEY not set — will fall back to Jina/Tavily');
    }
    if (!this.jinaApiKey) {
      console.warn('[RecipeExtraction] JINA_API_KEY not set — Jina fallback unavailable');
    }
    if (!this.llmApiKey) {
      console.warn(
        '[RecipeExtraction] No LLM key (OPENROUTER_API_KEY / ANTHROPIC_API_KEY) — Claude structuring unavailable'
      );
    }
  }

  private get firecrawl(): Firecrawl {
    if (!this._firecrawl) {
      if (!this.firecrawlApiKey) throw new Error('FIRECRAWL_API_KEY is not configured');
      this._firecrawl = new Firecrawl({ apiKey: this.firecrawlApiKey });
    }
    return this._firecrawl;
  }

  private get openrouter(): OpenAI {
    if (!this._openrouter) {
      if (!this.llmApiKey)
        throw new Error('No LLM API key configured (OPENROUTER_API_KEY or ANTHROPIC_API_KEY)');
      this._openrouter = withChatCostTracking(
        new OpenAI({
          apiKey: this.llmApiKey,
          baseURL: this.llmBaseUrl,
          defaultHeaders: process.env.OPENROUTER_API_KEY
            ? { 'HTTP-Referer': 'https://joanies.kitchen', 'X-Title': "Joanie's Kitchen" }
            : {},
        }),
        process.env.OPENROUTER_API_KEY ? 'openrouter' : 'anthropic'
      );
    }
    return this._openrouter;
  }

  /**
   * Why: the crawl must tell a page with no recipe from a recipe page that
   * failed, and only the tiers see the page (#300).
   * What: tries each configured tier in order and returns the first viable
   * recipe, or null. When `report` is given, each tier that ran and missed
   * appends what it saw (`ExtractionTierResult`); the return value is unchanged.
   * Test: `src/lib/services/__tests__/recipe-extraction-report-300.test.ts`
   */
  async extractRecipe(url: string, report?: ExtractionReport): Promise<ScrapedRecipe | null> {
    console.log(`[RecipeExtraction] Extracting: ${url}`);
    const miss = (tier: ExtractionTierAttempt['tier'], result: ExtractionTierResult) =>
      report?.attempts.push({ tier, result });
    // #302: measurement only; each tier's finally adds its ms, less structuring (llmMs).

    // Tier 1: Firecrawl (primary — structured JSON schema extraction)
    if (this.firecrawlApiKey) {
      const timer = startTier('firecrawl');
      try {
        const seen: FirecrawlSeen = { schemaRead: false, recipeSchema: false, text: '' };
        const result = await this.extractWithFirecrawl(url, seen);
        if (result && this.isViableRecipe(result)) {
          console.log(`[RecipeExtraction] Tier1/Firecrawl success: "${result.title}"`);
          return { ...result, extraction_method: 'firecrawl' };
        }
        // #300: only a schema read is a verdict here; a regex miss on markdown is not.
        miss('firecrawl', firecrawlMiss(result, seen));
        console.debug(
          '[RecipeExtraction] Tier1/Firecrawl returned insufficient data, falling through'
        );
      } catch (error) {
        miss('firecrawl', 'error');
        // #111: include URL (no query), status and cause so 403s are diagnosable.
        console.warn(formatFirecrawlFailure(url, error, this.firecrawlApiKey));
      } finally {
        endTier(timer);
      }
    } else {
      console.debug('[RecipeExtraction] Tier1/Firecrawl skipped — FIRECRAWL_API_KEY not set');
    }

    // Tier 2: Jina Reader (fallback 1 — clean markdown extraction)
    // Skipped gracefully when JINA_API_KEY is absent — never throws.
    if (this.jinaApiKey) {
      const timer = startTier('jina');
      try {
        const rawContent = await fetchContentWithJina(url);
        if (rawContent && rawContent.length > 200) {
          const llm = newLlmVerdict();
          const parsed = await timeStage('llmMs', () =>
            this.parseRawContent(rawContent, url, 'jina', llm)
          );
          if (parsed && this.isViableRecipe(parsed)) {
            console.log(`[RecipeExtraction] Tier2/Jina success: "${parsed.title}"`);
            return parsed;
          }
          miss('jina', rawContentMiss(parsed, llm, rawContent)); // #300: LLM verdict only
        } else {
          miss('jina', 'empty');
        }
        console.debug('[RecipeExtraction] Tier2/Jina returned insufficient data, falling through');
      } catch (error) {
        miss('jina', 'error');
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[RecipeExtraction] Tier2/Jina failed: ${msg}`);
      } finally {
        endTier(timer);
      }
    } else {
      console.debug('[RecipeExtraction] Tier2/Jina skipped — JINA_API_KEY not set');
    }

    // Tier 3: Tavily Extract (fallback 2 — raw content extraction)
    if (this.tavilyApiKey) {
      const timer = startTier('tavily');
      try {
        const rawContent = await this.fetchWithTavilyExtract(url);
        if (rawContent && rawContent.length > 200) {
          const llm = newLlmVerdict();
          const parsed = await timeStage('llmMs', () =>
            this.parseRawContent(rawContent, url, 'tavily_extract', llm)
          );
          if (parsed && this.isViableRecipe(parsed)) {
            console.log(`[RecipeExtraction] Tier3/Tavily Extract success: "${parsed.title}"`);
            return parsed;
          }
          miss('tavily_extract', rawContentMiss(parsed, llm, rawContent)); // #300: LLM verdict only
        } else {
          miss('tavily_extract', 'empty');
        }
      } catch (error) {
        miss('tavily_extract', 'error');
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[RecipeExtraction] Tier3/Tavily Extract failed: ${msg}`);
      } finally {
        endTier(timer);
      }
    } else {
      console.debug('[RecipeExtraction] Tier3/Tavily Extract skipped — TAVILY_API_KEY not set');
    }

    console.error(`[RecipeExtraction] All available extraction tiers failed for: ${url}`);
    return null;
  }

  /**
   * Extract using Firecrawl with schema.org JSON-LD extraction
   */
  private async extractWithFirecrawl(
    url: string,
    seen?: FirecrawlSeen
  ): Promise<ScrapedRecipe | null> {
    // #57: daily cost ceiling hard stop before the paid call.
    await assertWithinDailyCap();
    const result = (await this.firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
    })) as Record<string, unknown>;

    if (!result) throw new Error('Firecrawl returned no result');

    const metadata = result.metadata as Record<string, unknown> | undefined;
    await trackCost({
      provider: 'firecrawl',
      operation: 'scrape',
      units: Number(metadata?.creditsUsed) || 1,
    });
    const statusCode = (metadata?.statusCode as number) ?? 0;
    if (statusCode >= 400) {
      // #111: keep the Firecrawl response `error` text for the warn line.
      const respError = metadata?.error ?? result.error;
      throw new FirecrawlHttpError(
        statusCode,
        typeof respError === 'string' ? respError : undefined
      );
    }

    // #300: the interstitial check reads the title and markdown.
    if (seen) seen.text = `${String(metadata?.title ?? '')}\n${String(result.markdown ?? '')}`;

    // Try schema.org Recipe markup first (rich structured data)
    const schemaData = metadata?.schema;
    if (schemaData) {
      const schemas = Array.isArray(schemaData) ? schemaData : [schemaData];
      if (seen && schemas.length > 0) seen.schemaRead = true; // #300: a schema verdict
      // #300: also finds a Recipe nested in `@graph` (Yoast/WPRM) or under an array `@type`.
      const recipeSchema = findRecipeSchema(schemas) as FirecrawlRecipeSchema | undefined;

      if (recipeSchema) {
        if (seen) seen.recipeSchema = true; // #300: the page declares a recipe
        return this.mapFirecrawlSchema(recipeSchema, url, metadata); // #185: og:image first
      }
    }

    // Fallback to markdown parsing
    const markdown = result.markdown as string | undefined;
    if (markdown && markdown.length > 100) {
      return this.parseMarkdown(markdown, metadata as Record<string, string> | undefined, url);
    }

    return null;
  }

  /**
   * Fetch content via Tavily Extract API
   */
  private async fetchWithTavilyExtract(url: string): Promise<string | null> {
    // #57: daily cost ceiling hard stop before the paid call.
    await assertWithinDailyCap();
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.tavilyApiKey,
        urls: [url],
        extract_depth: 'advanced',
        format: 'markdown',
        timeout: 15,
        chunks_per_source: 5,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Tavily Extract API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      results?: Array<{ raw_content?: string }>;
      failed_results?: Array<{ error: string }>;
    };
    // #77: Tavily bills only extracted URLs; all-failed books nothing, an unknown empty shape books the floor.
    const allFailed = !data.results?.length && (data.failed_results?.length ?? 0) > 0;
    if (!allFailed) {
      await trackCost({
        provider: 'tavily',
        operation: 'extract.advanced',
        units: unitsOrFloor(data.results?.length, TAVILY_EXTRACT_FLOOR_URLS),
      });
    }

    if (data.results?.[0]?.raw_content) {
      return data.results[0].raw_content;
    }

    if (data.failed_results?.[0]?.error) {
      throw new Error(`Tavily Extract failed: ${data.failed_results[0].error}`);
    }

    return null;
  }

  /**
   * Parse raw markdown/text content into a ScrapedRecipe.
   * Uses regex-based parsing first; falls back to Claude Haiku if available.
   */
  private async parseRawContent(
    content: string,
    url: string,
    method: 'jina' | 'tavily_extract' | 'claude_structured',
    llm?: LlmVerdict
  ): Promise<ScrapedRecipe | null> {
    // Try regex-based markdown parsing first (free, fast)
    const parsed = this.parseMarkdown(content, undefined, url);
    if (parsed && this.isViableRecipe(parsed)) {
      return { ...parsed, extraction_method: method };
    }

    // Fall back to Claude Haiku via OpenRouter for unstructured content
    if (this.llmApiKey) {
      const structured = await this.structureWithClaude(content, url, llm);
      if (structured) {
        return { ...structured, extraction_method: 'claude_structured' };
      }
    }

    return parsed ? { ...parsed, extraction_method: method } : null;
  }

  /**
   * Use Claude Haiku to extract structured recipe data from raw content
   */
  private async structureWithClaude(
    content: string,
    url: string,
    llm?: LlmVerdict
  ): Promise<ScrapedRecipe | null> {
    const truncated = content.substring(0, 12000); // Stay within token limits (increased to capture recipe content past nav headers)

    const prompt = `Extract recipe information from the following web page content and return ONLY a JSON object.

URL: ${url}

Content:
${truncated}

Return a JSON object with these fields (omit fields you cannot find):
{
  "title": "Recipe name",
  "description": "Brief description",
  "chef_name": "Author/chef name if mentioned",
  "ingredients": ["1 cup flour", "2 eggs", ...],
  "instructions": ["Step 1: ...", "Step 2: ...", ...],
  "prep_time": 15,
  "cook_time": 30,
  "servings": 4,
  "cuisine": "Italian",
  "tags": ["pasta", "vegetarian"],
  "image_url": "https://..."
}

Return ONLY the JSON object, no other text.`;

    try {
      // Use OpenRouter with claude-haiku model (cost-efficient structuring)
      const completion = await this.openrouter.chat.completions.create({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = completion.choices[0]?.message?.content ?? '';

      // #216: take the first balanced JSON object; a greedy regex spanned trailing text.
      // Throws on no / truncated / malformed JSON, logged below as a structuring failure.
      const data = extractFirstJsonObject(responseText) as {
        title?: string;
        description?: string;
        chef_name?: string;
        ingredients?: string[];
        instructions?: string[];
        // #12: the LLM returns free text here ("4 to 6", "3 quarts") despite the prompt.
        prep_time?: unknown;
        cook_time?: unknown;
        servings?: unknown;
        cuisine?: string;
        tags?: string[];
        image_url?: string;
      };

      // #300: the LLM judged the content; any ingredient or instruction is recipe evidence.
      if (llm) {
        llm.ran = true;
        llm.partial = (data.ingredients?.length ?? 0) > 0 || (data.instructions?.length ?? 0) > 0;
      }
      if (!data.title || !data.ingredients?.length || !data.instructions?.length) {
        return null;
      }

      return {
        url,
        title: data.title,
        description: data.description,
        chef_name: data.chef_name,
        ingredients: data.ingredients ?? [],
        instructions: data.instructions ?? [],
        // #12: coerce to integer-or-undefined so a range string never reaches the DB.
        prep_time: toRecipeInt(data.prep_time) ?? undefined,
        cook_time: toRecipeInt(data.cook_time) ?? undefined,
        servings: toRecipeInt(data.servings) ?? undefined,
        cuisine: data.cuisine,
        tags: data.tags ?? [],
        // #185: the LLM can pick the header logo; drop it rather than store a site asset.
        image_url: pickRecipeImage({ contentImages: data.image_url }, url) ?? undefined,
        extraction_method: 'claude_structured',
      };
    } catch (error) {
      // #300: an unreadable or failed LLM reply never counts as "no recipe here".
      if (llm) llm.failed = true;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[RecipeExtraction] Claude structuring failed: ${msg}`);
      return null;
    }
  }

  /** Map schema.org Recipe data; see `mapFirecrawlSchema` in ./recipe-extraction-parsers. */
  private mapFirecrawlSchema(
    data: FirecrawlRecipeSchema,
    url: string,
    metadata?: Record<string, unknown>
  ): ScrapedRecipe {
    return mapFirecrawlSchema(data, url, metadata);
  }

  /** Regex-parse page markdown; see `parseMarkdown` in ./recipe-extraction-parsers. */
  private parseMarkdown(
    markdown: string,
    metadata: Record<string, string> | undefined,
    url: string
  ): ScrapedRecipe | null {
    return parseMarkdown(markdown, metadata, url);
  }

  /**
   * Gate: check if a scraped recipe has enough data to be worth storing
   */
  isViableRecipe(recipe: Partial<ScrapedRecipe>): boolean {
    if (!recipe.title || recipe.title.length < MIN_TITLE_LENGTH) return false;
    if ((recipe.ingredients?.length ?? 0) < MIN_INGREDIENTS) return false;
    if ((recipe.instructions?.length ?? 0) < MIN_INSTRUCTIONS) return false;
    return true;
  }
}

// Singleton
let _instance: RecipeExtractionService | null = null;

export function getRecipeExtractionService(): RecipeExtractionService {
  if (!_instance) {
    _instance = new RecipeExtractionService();
  }
  return _instance;
}
