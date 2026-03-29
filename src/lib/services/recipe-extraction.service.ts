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
 * If ANTHROPIC_API_KEY is set, Claude Haiku is used to structure any raw text.
 */

import Anthropic from '@anthropic-ai/sdk';
import Firecrawl from '@mendable/firecrawl-js';

export interface ScrapedRecipe {
  url: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags: string[];
  image_url?: string;
  chef_name?: string;
  extraction_method: 'firecrawl' | 'jina' | 'tavily_extract' | 'claude_structured';
}

/**
 * Parsed recipe data from Firecrawl schema.org extraction
 */
interface FirecrawlRecipeSchema {
  name?: string;
  title?: string;
  description?: string;
  recipeIngredient?: string[];
  ingredients?: string[];
  recipeInstructions?: Array<string | { text?: string; name?: string }>;
  instructions?: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  servings?: number;
  recipeCuisine?: string;
  recipeCategory?: string;
  keywords?: string | string[];
  image?: string | { url?: string };
  author?: string | { name?: string };
  difficulty?: string;
}

const MIN_INGREDIENTS = 3;
const MIN_INSTRUCTIONS = 2;
const MIN_TITLE_LENGTH = 5;

export class RecipeExtractionService {
  private _firecrawl: Firecrawl | null = null;
  private _anthropic: Anthropic | null = null;

  private readonly firecrawlApiKey: string;
  private readonly jinaApiKey: string;
  private readonly tavilyApiKey: string;
  private readonly anthropicApiKey: string;

  constructor() {
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY || '';
    this.jinaApiKey = process.env.JINA_API_KEY || '';
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!this.firecrawlApiKey) {
      console.warn('[RecipeExtraction] FIRECRAWL_API_KEY not set — will fall back to Jina/Tavily');
    }
    if (!this.jinaApiKey) {
      console.warn('[RecipeExtraction] JINA_API_KEY not set — Jina fallback unavailable');
    }
    if (!this.anthropicApiKey) {
      console.warn('[RecipeExtraction] ANTHROPIC_API_KEY not set — Claude structuring unavailable');
    }
  }

  private get firecrawl(): Firecrawl {
    if (!this._firecrawl) {
      if (!this.firecrawlApiKey) throw new Error('FIRECRAWL_API_KEY is not configured');
      this._firecrawl = new Firecrawl({ apiKey: this.firecrawlApiKey });
    }
    return this._firecrawl;
  }

  private get anthropic(): Anthropic {
    if (!this._anthropic) {
      if (!this.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
      this._anthropic = new Anthropic({ apiKey: this.anthropicApiKey });
    }
    return this._anthropic;
  }

  /**
   * Extract a structured recipe from a URL
   * Tries each extraction method in order until one succeeds
   */
  async extractRecipe(url: string): Promise<ScrapedRecipe | null> {
    console.log(`[RecipeExtraction] Extracting: ${url}`);

    // Tier 1: Firecrawl
    if (this.firecrawlApiKey) {
      try {
        const result = await this.extractWithFirecrawl(url);
        if (result && this.isViableRecipe(result)) {
          console.log(`[RecipeExtraction] Firecrawl success: "${result.title}"`);
          return { ...result, extraction_method: 'firecrawl' };
        }
        console.log('[RecipeExtraction] Firecrawl returned insufficient data, trying Jina');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[RecipeExtraction] Firecrawl failed: ${msg}`);
      }
    }

    // Tier 2: Jina Reader
    if (this.jinaApiKey) {
      try {
        const rawContent = await this.fetchWithJina(url);
        if (rawContent && rawContent.length > 200) {
          const parsed = await this.parseRawContent(rawContent, url, 'jina');
          if (parsed && this.isViableRecipe(parsed)) {
            console.log(`[RecipeExtraction] Jina success: "${parsed.title}"`);
            return parsed;
          }
        }
        console.log('[RecipeExtraction] Jina returned insufficient data, trying Tavily Extract');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[RecipeExtraction] Jina failed: ${msg}`);
      }
    }

    // Tier 3: Tavily Extract
    if (this.tavilyApiKey) {
      try {
        const rawContent = await this.fetchWithTavilyExtract(url);
        if (rawContent && rawContent.length > 200) {
          const parsed = await this.parseRawContent(rawContent, url, 'tavily_extract');
          if (parsed && this.isViableRecipe(parsed)) {
            console.log(`[RecipeExtraction] Tavily Extract success: "${parsed.title}"`);
            return parsed;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[RecipeExtraction] Tavily Extract failed: ${msg}`);
      }
    }

    console.error(`[RecipeExtraction] All extraction methods failed for: ${url}`);
    return null;
  }

  /**
   * Extract using Firecrawl with schema.org JSON-LD extraction
   */
  private async extractWithFirecrawl(url: string): Promise<ScrapedRecipe | null> {
    const result = await this.firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
    }) as Record<string, unknown>;

    if (!result) throw new Error('Firecrawl returned no result');

    const metadata = result.metadata as Record<string, unknown> | undefined;
    const statusCode = (metadata?.statusCode as number) ?? 0;
    if (statusCode >= 400) {
      throw new Error(`HTTP ${statusCode} from Firecrawl`);
    }

    // Try schema.org Recipe markup first (rich structured data)
    const schemaData = metadata?.schema;
    if (schemaData) {
      const schemas = Array.isArray(schemaData) ? schemaData : [schemaData];
      const recipeSchema = schemas.find(
        (s: FirecrawlRecipeSchema) =>
          s['@type' as keyof typeof s] === 'Recipe' ||
          (s['@type' as keyof typeof s] as string[])?.includes?.('Recipe')
      ) as FirecrawlRecipeSchema | undefined;

      if (recipeSchema) {
        return this.mapFirecrawlSchema(recipeSchema, url);
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
   * Fetch content via Jina Reader API
   */
  private async fetchWithJina(url: string): Promise<string | null> {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.jinaApiKey}`,
        Accept: 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Jina Reader API error ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Fetch content via Tavily Extract API
   */
  private async fetchWithTavilyExtract(url: string): Promise<string | null> {
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

    const data = await response.json() as {
      results?: Array<{ raw_content?: string }>;
      failed_results?: Array<{ error: string }>;
    };

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
    method: 'jina' | 'tavily_extract' | 'claude_structured'
  ): Promise<ScrapedRecipe | null> {
    // Try regex-based markdown parsing first (free, fast)
    const parsed = this.parseMarkdown(content, undefined, url);
    if (parsed && this.isViableRecipe(parsed)) {
      return { ...parsed, extraction_method: method };
    }

    // Fall back to Claude Haiku for unstructured content
    if (this.anthropicApiKey) {
      const structured = await this.structureWithClaude(content, url);
      if (structured) {
        return { ...structured, extraction_method: 'claude_structured' };
      }
    }

    return parsed ? { ...parsed, extraction_method: method } : null;
  }

  /**
   * Use Claude Haiku to extract structured recipe data from raw content
   */
  private async structureWithClaude(content: string, url: string): Promise<ScrapedRecipe | null> {
    const truncated = content.substring(0, 6000); // Stay within token limits

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
      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText =
        message.content[0]?.type === 'text' ? message.content[0].text : '';

      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[RecipeExtraction] Claude returned no JSON');
        return null;
      }

      const data = JSON.parse(jsonMatch[0]) as {
        title?: string;
        description?: string;
        chef_name?: string;
        ingredients?: string[];
        instructions?: string[];
        prep_time?: number;
        cook_time?: number;
        servings?: number;
        cuisine?: string;
        tags?: string[];
        image_url?: string;
      };

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
        prep_time: data.prep_time,
        cook_time: data.cook_time,
        servings: data.servings,
        cuisine: data.cuisine,
        tags: data.tags ?? [],
        image_url: data.image_url,
        extraction_method: 'claude_structured',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[RecipeExtraction] Claude structuring failed: ${msg}`);
      return null;
    }
  }

  /**
   * Map Firecrawl schema.org Recipe data to ScrapedRecipe
   */
  private mapFirecrawlSchema(data: FirecrawlRecipeSchema, url: string): ScrapedRecipe {
    const title = data.name || data.title || 'Untitled Recipe';

    const ingredients = this.extractIngredients(data);
    const instructions = this.extractInstructions(data);

    const servingsRaw = data.recipeYield ?? data.servings;
    let servings: number | undefined;
    if (typeof servingsRaw === 'number') {
      servings = servingsRaw;
    } else if (typeof servingsRaw === 'string') {
      const match = servingsRaw.match(/(\d+)/);
      servings = match ? parseInt(match[1]) : undefined;
    }

    const tags: string[] = [];
    if (data.recipeCuisine) tags.push(data.recipeCuisine);
    if (data.recipeCategory) tags.push(data.recipeCategory);
    if (data.keywords) {
      const kws =
        typeof data.keywords === 'string'
          ? data.keywords.split(',').map((k) => k.trim())
          : data.keywords;
      tags.push(...kws.filter(Boolean));
    }

    const imageUrl =
      typeof data.image === 'string'
        ? data.image
        : (data.image as { url?: string })?.url;

    const chefName =
      typeof data.author === 'string'
        ? data.author
        : (data.author as { name?: string })?.name;

    return {
      url,
      title,
      description: data.description,
      ingredients,
      instructions,
      prep_time: this.parseISO8601Duration(data.prepTime),
      cook_time: this.parseISO8601Duration(data.cookTime),
      servings,
      cuisine: data.recipeCuisine,
      tags: [...new Set(tags)],
      image_url: imageUrl,
      chef_name: chefName,
      extraction_method: 'firecrawl',
    };
  }

  /**
   * Parse markdown content into a ScrapedRecipe using regex
   */
  private parseMarkdown(
    markdown: string,
    metadata: Record<string, string> | undefined,
    url: string
  ): ScrapedRecipe | null {
    const title =
      metadata?.ogTitle ||
      metadata?.title ||
      this.extractFirstHeading(markdown);

    if (!title) return null;

    const ingredients = this.extractIngredientsFromMarkdown(markdown);
    const instructions = this.extractInstructionsFromMarkdown(markdown);
    const times = this.extractTimesFromMarkdown(markdown);
    const servings = this.extractServingsFromMarkdown(markdown);
    const chefName = this.extractAuthorFromMarkdown(markdown, metadata);
    const imageUrl = metadata?.ogImage ?? this.extractImageFromMarkdown(markdown);

    return {
      url,
      title,
      description: metadata?.ogDescription ?? metadata?.description,
      ingredients,
      instructions,
      prep_time: times.prepTime,
      cook_time: times.cookTime,
      servings,
      tags: [],
      image_url: imageUrl,
      chef_name: chefName,
      extraction_method: 'firecrawl', // overwritten by caller
    };
  }

  // ---------------------------------------------------------------------------
  // Markdown parsing helpers
  // ---------------------------------------------------------------------------

  private extractFirstHeading(markdown: string): string | undefined {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
  }

  private extractIngredientsFromMarkdown(markdown: string): string[] {
    const match = markdown.match(
      /#+\s*Ingredients?\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i
    );
    if (!match) return [];

    return match[1]
      .split('\n')
      .map((line) => {
        const listMatch = line.trim().match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
        return listMatch ? listMatch[1].trim() : '';
      })
      .filter((s) => s.length > 2);
  }

  private extractInstructionsFromMarkdown(markdown: string): string[] {
    const match = markdown.match(
      /#+\s*(?:Instructions?|Directions?|Method|Steps?|Preparation)\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i
    );
    if (!match) return [];

    const lines: string[] = [];
    for (const line of match[1].split('\n')) {
      const cleaned = line.trim();
      const listMatch = cleaned.match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
      if (listMatch && listMatch[1].length > 10) {
        lines.push(listMatch[1].trim());
      } else if (cleaned.length > 20 && !cleaned.startsWith('#')) {
        lines.push(cleaned);
      }
    }
    return lines;
  }

  private extractTimesFromMarkdown(markdown: string): { prepTime?: number; cookTime?: number } {
    const times: { prepTime?: number; cookTime?: number } = {};

    const prepMatch = markdown.match(/Prep(?:\s+Time)?:\s*(?:(\d+)\s*h(?:ours?)?\s*)?(\d+)\s*min/i);
    if (prepMatch) {
      const hours = prepMatch[1] ? parseInt(prepMatch[1]) : 0;
      times.prepTime = hours * 60 + parseInt(prepMatch[2]);
    }

    const cookMatch = markdown.match(/Cook(?:\s+Time)?:\s*(?:(\d+)\s*h(?:ours?)?\s*)?(\d+)\s*min/i);
    if (cookMatch) {
      const hours = cookMatch[1] ? parseInt(cookMatch[1]) : 0;
      times.cookTime = hours * 60 + parseInt(cookMatch[2]);
    }

    return times;
  }

  private extractServingsFromMarkdown(markdown: string): number | undefined {
    const match = markdown.match(/(?:Servings?|Yields?|Makes):\s*(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractAuthorFromMarkdown(
    markdown: string,
    metadata?: Record<string, string>
  ): string | undefined {
    if (metadata?.author) return metadata.author;

    // Look for "By [Author Name]" patterns
    const bylineMatch = markdown.match(/^by\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/m);
    if (bylineMatch) return bylineMatch[1];

    // Look for "Recipe by [Name]" or "Author: [Name]"
    const authorMatch = markdown.match(/(?:Recipe by|Author:|Written by)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
    return authorMatch ? authorMatch[1] : undefined;
  }

  private extractImageFromMarkdown(markdown: string): string | undefined {
    const match = markdown.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/);
    return match ? match[1] : undefined;
  }

  // ---------------------------------------------------------------------------
  // Schema.org data helpers
  // ---------------------------------------------------------------------------

  private extractIngredients(data: FirecrawlRecipeSchema): string[] {
    if (data.recipeIngredient?.length) return data.recipeIngredient.filter(Boolean);
    if (data.ingredients?.length) return data.ingredients.filter(Boolean);
    return [];
  }

  private extractInstructions(data: FirecrawlRecipeSchema): string[] {
    if (data.recipeInstructions) {
      if (Array.isArray(data.recipeInstructions)) {
        return data.recipeInstructions
          .map((step) => {
            if (typeof step === 'string') return step;
            return step.text ?? step.name ?? '';
          })
          .filter(Boolean);
      }
      if (typeof data.recipeInstructions === 'string') {
        return [data.recipeInstructions];
      }
    }
    if (data.instructions?.length) return data.instructions.filter(Boolean);
    return [];
  }

  /**
   * Parse ISO 8601 duration string (PT30M, PT1H15M) to minutes
   */
  private parseISO8601Duration(duration?: string): number | undefined {
    if (!duration) return undefined;

    const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (isoMatch) {
      const hours = isoMatch[1] ? parseInt(isoMatch[1]) : 0;
      const minutes = isoMatch[2] ? parseInt(isoMatch[2]) : 0;
      return hours * 60 + minutes || undefined;
    }

    const numMatch = duration.match(/^(\d+)$/);
    return numMatch ? parseInt(numMatch[1]) : undefined;
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
