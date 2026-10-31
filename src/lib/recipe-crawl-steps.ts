/**
 * Recipe crawl steps 1-3: search, convert, approve (#142: split out of
 * `src/lib/recipe-crawl.ts`, which re-exports everything here).
 *
 * #13: server-internal and deliberately NOT 'use server', so none of these
 * paid functions is a client-callable action. Callers have already authorized
 * the run: the cron/CRON_SECRET-gated routes, CLI scripts, and the admin-gated
 * wrappers in `src/app/actions/recipe-crawl.ts`.
 */

import { extractFirstJsonObject } from '@/lib/ai/extract-first-json';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { filterRecipeSites, searchRecipesWithSerpAPI } from '@/lib/serpapi';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { metadataImageSources, pickRecipeImages } from '@/lib/utils/recipe-image-picker';

// Types
export interface RecipeSearchResult {
  title: string;
  url: string;
  snippet: string;
  thumbnail?: string;
  source?: string;
}

export interface ExtractedRecipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  images?: string[];
  cuisine?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  confidenceScore: number;
  isValid: boolean;
}

export interface ValidationResult {
  approved: boolean;
  score: number;
  issues: string[];
}

export interface CrawlStats {
  searched: number;
  converted: number;
  approved: number;
  stored: number;
  failed: number;
}

export interface CrawlRecipeResult {
  id?: string;
  name: string;
  url: string;
  status: 'stored' | 'rejected' | 'failed';
  reason?: string;
  /** #135: set with status 'rejected' when the URL duplicates stored recipe `id`. */
  duplicateOf?: string;
}

// ============================================================================
// STEP 1: SEARCH - Find recipes using SerpAPI
// ============================================================================

/**
 * Searches for recipes online using SerpAPI
 *
 * @param query - Search query (e.g., "pasta carbonara")
 * @param options - Search options
 * @returns Array of recipe search results
 */
export async function searchRecipesOnline(
  query: string,
  options?: {
    maxResults?: number;
    filterToRecipeSites?: boolean;
  }
): Promise<{
  success: boolean;
  results: RecipeSearchResult[];
  error?: string;
}> {
  try {
    console.log(`[Search] Searching for recipes: "${query}"`);

    const searchResults = await searchRecipesWithSerpAPI({
      query,
      num: options?.maxResults || 10,
    });

    if (!searchResults.success) {
      return {
        success: false,
        results: [],
        error: searchResults.error,
      };
    }

    let results = searchResults.results;

    // Filter to known recipe sites if requested
    if (options?.filterToRecipeSites) {
      const beforeCount = results.length;
      results = filterRecipeSites(results);
      console.log(`[Search] Filtered ${beforeCount} results to ${results.length} recipe sites`);
    }

    const mappedResults: RecipeSearchResult[] = results.map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      thumbnail: r.thumbnail,
      source: r.source,
    }));

    console.log(`[Search] Found ${mappedResults.length} recipe results`);

    return {
      success: true,
      results: mappedResults,
    };
  } catch (error: unknown) {
    const errorMsg = toErrorMessage(error);
    console.error('[Search] Error:', errorMsg);
    return {
      success: false,
      results: [],
      error: errorMsg,
    };
  }
}

// ============================================================================
// STEP 2: CONVERT - Extract recipe data from URL
// ============================================================================

/**
 * Extracts recipe data from a URL using AI
 *
 * @param url - Recipe URL to extract from
 * @returns Extracted recipe data
 */
export async function convertUrlToRecipe(url: string): Promise<{
  success: boolean;
  recipe?: ExtractedRecipe;
  error?: string;
}> {
  try {
    console.log(`[Convert] Extracting recipe from: ${url}`);

    // Use Firecrawl for robust scraping (handles JS-rendered pages)
    const { scrapeRecipePage } = await import('@/lib/firecrawl');
    const scrapeResult = await scrapeRecipePage(url);

    // Use markdown content (cleaner than HTML for AI extraction)
    const content = scrapeResult.markdown || scrapeResult.html || '';

    if (!content) {
      throw new Error(scrapeResult.error || 'No content extracted from page');
    }

    // Limit content size to prevent token limits
    const limitedContent = content.substring(0, 50000);

    // Use Claude via OpenRouter to extract recipe
    const openrouter = getOpenRouterClient();

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from this content. Return ONLY valid JSON with no markdown formatting, code blocks, or extra text.

Recipe Content:
${limitedContent}

Required JSON format:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "images": ["image_url_1", "image_url_2"],
  "cuisine": "Italian",
  "tags": ["quick", "healthy"],
  "difficulty": "easy",
  "confidenceScore": 0.95,
  "isValid": true
}

Important:
- Return ONLY the JSON object, no markdown code blocks
- Set isValid to true if you found a complete recipe
- Set isValid to false if the page doesn't contain a recipe
- Include as many images as you can find (max 6)
- confidenceScore should be 0-1 (how confident you are this is a valid recipe)`,
        },
      ],
      temperature: 0.1,
    });

    const aiResponse = completion.choices[0].message.content || '{}';

    // #228: fence-strip-then-parse broke on trailing prose; parse the first balanced object.
    const extracted = extractFirstJsonObject(aiResponse) as ExtractedRecipe;

    if (!extracted.isValid) {
      console.log(`[Convert] Invalid recipe extracted from ${url}`);
      return {
        success: false,
        error: 'Could not extract valid recipe from URL',
      };
    }

    // #185: the page's og:image leads; the LLM's picks follow, and site assets are dropped.
    extracted.images = pickRecipeImages(
      { ...metadataImageSources(scrapeResult.metadata), contentImages: extracted.images },
      url,
      6
    );

    console.log(`[Convert] Successfully extracted recipe: ${extracted.name}`);

    return {
      success: true,
      recipe: extracted,
    };
  } catch (error: unknown) {
    const errorMsg = toErrorMessage(error);
    console.error(`[Convert] Error extracting from ${url}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ============================================================================
// STEP 3: APPROVE - Validate recipe quality
// ============================================================================

/**
 * Validates a recipe for quality and completeness
 *
 * @param recipe - Recipe to validate
 * @returns Validation result
 */
export async function validateRecipe(recipe: ExtractedRecipe): Promise<ValidationResult> {
  const issues: string[] = [];
  let score = 100;

  // Check required fields
  if (!recipe.name || recipe.name.length < 3) {
    issues.push('Name is too short or missing');
    score -= 20;
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    issues.push('No ingredients found');
    score -= 30;
  } else if (recipe.ingredients.length < 3) {
    issues.push('Too few ingredients (less than 3)');
    score -= 10;
  }

  if (!recipe.instructions || recipe.instructions.length === 0) {
    issues.push('No instructions found');
    score -= 30;
  } else if (recipe.instructions.length < 2) {
    issues.push('Too few instructions (less than 2 steps)');
    score -= 10;
  }

  if (!recipe.description || recipe.description.length < 10) {
    issues.push('Description is too short or missing');
    score -= 5;
  }

  // Check confidence score
  if (recipe.confidenceScore < 0.7) {
    issues.push(`Low confidence score: ${recipe.confidenceScore.toFixed(2)}`);
    score -= 10;
  }

  // Approved if score >= 60
  const approved = score >= 60;

  console.log(
    `[Validate] Recipe "${recipe.name}": ${approved ? 'APPROVED' : 'REJECTED'} (score: ${score})`
  );
  if (issues.length > 0) {
    console.log(`[Validate] Issues: ${issues.join(', ')}`);
  }

  return {
    approved,
    score,
    issues,
  };
}
