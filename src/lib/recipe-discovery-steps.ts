/**
 * Recipe discovery steps 1-3: Brave search, LLM extraction, LLM tagging.
 *
 * Why: `src/app/actions/recipe-discovery.ts` had grown past the 500-line cap
 * (#142). These steps hold no auth or DB logic, so they live here; the action
 * file keeps auth, rate limits, dedup and the save.
 * What: moved unchanged. Server-internal and deliberately NOT 'use server':
 * none of these paid calls is a client-callable action.
 * Test: `src/app/actions/__tests__/recipe-discovery.test.ts`,
 * `src/app/actions/__tests__/recipe-discovery-int-fields.test.ts`
 */

import { extractFirstJsonObject } from '@/lib/ai/extract-first-json';
import { getOpenRouterClient, MODELS } from '@/lib/ai/openrouter-server';
import { searchRecipes as braveSearchRecipes } from '@/lib/brave-search';
import { isPaidCallBlocked } from '@/lib/costs';
import { toErrorMessage } from '@/lib/utils/error-handling';

export interface RecipeDiscoveryOptions {
  cuisine?: string;
  ingredients?: string[];
  dietaryRestrictions?: string[];
  maxResults?: number;
  minConfidence?: number; // Filter out low-confidence extractions (0.0-1.0)
}

export interface ExtractedRecipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  isValid: boolean;
  confidenceScore: number;
}

export interface RecipeMetadata {
  cuisine: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  dietaryInfo: string[];
}

// ============================================================================
// Step 1: Brave Search Integration
// ============================================================================

/**
 * Discovers recipe URLs using Brave Search API
 * Builds optimized query and filters for quality recipe sources
 */
export async function discoverRecipeUrls(
  query: string,
  options: RecipeDiscoveryOptions
): Promise<Array<{ url: string; title: string; description: string }>> {
  const { cuisine, ingredients = [], dietaryRestrictions = [], maxResults = 10 } = options;

  // Build recipe-specific search query
  let searchQuery = `${query} recipe`;

  if (cuisine) {
    searchQuery += ` ${cuisine}`;
  }

  if (ingredients.length > 0) {
    searchQuery += ` with ${ingredients.join(' ')}`;
  }

  if (dietaryRestrictions.length > 0) {
    searchQuery += ` ${dietaryRestrictions.join(' ')}`;
  }

  // Add site filters for quality sources
  searchQuery +=
    ' (site:allrecipes.com OR site:foodnetwork.com OR site:seriouseats.com OR site:bonappetit.com OR site:epicurious.com OR site:tasty.co)';

  try {
    const results = await braveSearchRecipes(searchQuery, maxResults);

    return results.map((result) => ({
      url: result.url,
      title: result.title,
      description: result.description,
    }));
  } catch (error) {
    if (isPaidCallBlocked(error)) throw error; // #57: keep the cost-ceiling code typed
    console.error('Brave Search error:', error);
    throw new Error('Failed to search for recipes');
  }
}

// ============================================================================
// Step 2: LLM Recipe Extraction & Validation
// ============================================================================

/**
 * Fetches webpage content and extracts text
 * Uses simple fetch approach - in production, consider using a scraping service
 */
async function fetchWebpageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeManager/1.0; +https://recipe-manager.com)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Simple HTML content extraction (remove scripts, styles, etc.)
    // In production, consider using a proper HTML parser like cheerio
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit content length to avoid token limits
    return cleanedHtml.substring(0, 10000);
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

/**
 * Extracts and validates recipe from webpage content using Claude 3 Haiku
 */
export async function extractAndValidateRecipe(
  url: string,
  title: string
): Promise<{
  success: boolean;
  recipe?: ExtractedRecipe;
  confidenceScore?: number;
  error?: string;
}> {
  try {
    // Fetch webpage content
    const htmlContent = await fetchWebpageContent(url);

    if (!htmlContent || htmlContent.length < 100) {
      return {
        success: false,
        error: 'Insufficient content from URL',
      };
    }

    // Use Claude 3 Haiku for extraction
    const openrouter = getOpenRouterClient();

    const response = await openrouter.chat.completions.create({
      model: MODELS.CLAUDE_3_HAIKU,
      messages: [
        {
          role: 'user',
          content: `Extract recipe information from this webpage content. Return ONLY valid JSON, no other text.

URL: ${url}
Title: ${title}

Content excerpt:
${htmlContent.substring(0, 8000)}

IMPORTANT: Return ONLY this exact JSON format:
{
  "name": "Recipe name",
  "description": "Brief 1-2 sentence description",
  "ingredients": ["ingredient 1 with measurement", "ingredient 2 with measurement"],
  "instructions": ["step 1", "step 2", "step 3"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "confidenceScore": 0.95,
  "isValid": true
}

Set isValid to false if:
- No ingredients found
- No instructions found
- Content doesn't appear to be a recipe
- Confidence is below 0.6

Set confidenceScore (0.0-1.0) based on:
- Completeness of recipe data
- Clarity of instructions
- Quality of ingredient list
- Overall recipe structure`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'No response from LLM',
      };
    }

    // Parse JSON response
    let extracted: ExtractedRecipe;
    try {
      // #228: take the first balanced object, fenced or not; a greedy match broke
      // on trailing prose or a second block.
      extracted = extractFirstJsonObject(content) as ExtractedRecipe;
    } catch (_parseError) {
      return {
        success: false,
        error: 'Failed to parse LLM response as JSON',
      };
    }

    // Validate extracted data
    if (
      !extracted.isValid ||
      !extracted.name ||
      !extracted.ingredients?.length ||
      !extracted.instructions?.length
    ) {
      return {
        success: false,
        recipe: extracted,
        confidenceScore: extracted.confidenceScore || 0,
        error: 'Invalid or incomplete recipe data',
      };
    }

    return {
      success: true,
      recipe: extracted,
      confidenceScore: extracted.confidenceScore || 0.7,
    };
  } catch (error) {
    if (isPaidCallBlocked(error)) throw error; // #57
    console.error(`Extraction error for ${url}:`, error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

// ============================================================================
// Step 3: LLM Auto-Tagging
// ============================================================================

/**
 * Generates recipe metadata using Claude 3 Haiku
 */
export async function generateRecipeMetadata(recipe: ExtractedRecipe): Promise<RecipeMetadata> {
  try {
    const openrouter = getOpenRouterClient();

    const response = await openrouter.chat.completions.create({
      model: MODELS.CLAUDE_3_HAIKU,
      messages: [
        {
          role: 'user',
          content: `Analyze this recipe and generate metadata. Return ONLY valid JSON.

Recipe:
Name: ${recipe.name}
Description: ${recipe.description}
Ingredients: ${recipe.ingredients.join(', ')}
Instructions: ${recipe.instructions.slice(0, 3).join(' ')}

Return this EXACT JSON format:
{
  "cuisine": "Italian",
  "tags": ["quick", "healthy", "comfort-food", "weeknight"],
  "difficulty": "easy",
  "dietaryInfo": ["vegetarian", "gluten-free"]
}

Guidelines:
- cuisine: One primary cuisine type (Italian, Mexican, Thai, French, American, Chinese, Indian, Mediterranean, Japanese, etc.)
- tags: 3-6 descriptive tags (quick, healthy, comfort-food, budget-friendly, one-pot, meal-prep, etc.)
- difficulty: easy, medium, or hard based on technique and time
- dietaryInfo: Array of dietary categories this recipe fits (vegetarian, vegan, gluten-free, dairy-free, keto, paleo, low-carb, nut-free)

Only include dietaryInfo categories that clearly apply based on ingredients.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    // #228: take the first balanced object; a malformed reply still falls to the defaults below.
    const metadata = extractFirstJsonObject(content) as Record<string, any>;

    // Validate and provide defaults
    return {
      cuisine: metadata.cuisine || 'International',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      difficulty: ['easy', 'medium', 'hard'].includes(metadata.difficulty)
        ? metadata.difficulty
        : 'medium',
      dietaryInfo: Array.isArray(metadata.dietaryInfo) ? metadata.dietaryInfo : [],
    };
  } catch (error) {
    if (isPaidCallBlocked(error)) throw error; // #57
    console.error('Metadata generation error:', error);
    // Return safe defaults on error
    return {
      cuisine: 'International',
      tags: [],
      difficulty: 'medium',
      dietaryInfo: [],
    };
  }
}
