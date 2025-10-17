'use server';

/**
 * Recipe Discovery Pipeline
 *
 * Complete 6-step pipeline for discovering, validating, and storing recipes:
 * 1. Brave Search API → Find recipe URLs
 * 2. LLM Validation → Extract & validate recipe data from URLs
 * 3. LLM Tagging → Generate tags, cuisine, difficulty, dietary info
 * 4. Generate Embeddings → Create 384-dimensional vector
 * 5. Save to DB → Store recipe with full provenance + embedding
 * 6. Return Results → Display validated recipes to user
 */

import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { getOpenRouterClient, MODELS } from '@/lib/ai/openrouter-server';
import { checkAuth, requireAuth } from '@/lib/auth-guard';
import { searchRecipes as braveSearchRecipes } from '@/lib/brave-search';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { type Recipe, recipes } from '@/lib/db/schema';

// ============================================================================
// Type Definitions
// ============================================================================

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

export interface DiscoveryResult {
  success: boolean;
  recipes: Recipe[];
  stats: {
    searched: number;
    validated: number;
    saved: number;
    failed: number;
    skipped: number;
  };
  errors?: Array<{
    url: string;
    step: string;
    error: string;
  }>;
}

// ============================================================================
// Step 1: Brave Search Integration
// ============================================================================

/**
 * Discovers recipe URLs using Brave Search API
 * Builds optimized query and filters for quality recipe sources
 */
async function discoverRecipeUrls(
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
async function extractAndValidateRecipe(
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
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      extracted = JSON.parse(jsonStr);
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
    console.error(`Extraction error for ${url}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

// ============================================================================
// Step 3: LLM Auto-Tagging
// ============================================================================

/**
 * Generates recipe metadata using Claude 3 Haiku
 */
async function generateRecipeMetadata(recipe: ExtractedRecipe): Promise<RecipeMetadata> {
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
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const metadata = JSON.parse(jsonStr);

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

// ============================================================================
// Steps 4 & 5: Generate Embedding & Save with Provenance
// ============================================================================

/**
 * Saves discovered recipe with embedding and full provenance tracking
 */
async function saveDiscoveredRecipe(
  recipe: ExtractedRecipe,
  metadata: RecipeMetadata,
  source: {
    url: string;
    title: string;
    searchQuery: string;
    confidenceScore: number;
  }
): Promise<string> {
  // Check authentication (required for saving discovered recipes)
  const { userId, isAuthenticated } = await checkAuth();

  if (!isAuthenticated) {
    throw new Error('Authentication required to save discovered recipes');
  }

  // Parse time strings to minutes
  const parsePrepTime = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const parseCookTime = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Create recipe object for embedding generation
  const recipeForEmbedding: Partial<Recipe> = {
    name: recipe.name,
    description: recipe.description,
    ingredients: JSON.stringify(recipe.ingredients),
    instructions: JSON.stringify(recipe.instructions),
    cuisine: metadata.cuisine,
    tags: JSON.stringify(metadata.tags),
    difficulty: metadata.difficulty,
  };

  // Step 4: Generate embedding
  let embeddingResult;
  try {
    embeddingResult = await generateRecipeEmbedding(recipeForEmbedding as Recipe);
  } catch (error) {
    console.error('Embedding generation error:', error);
    // Continue without embedding - will retry later
    embeddingResult = null;
  }

  // Step 5: Save recipe with provenance
  const [savedRecipe] = await db
    .insert(recipes)
    .values({
      user_id: userId!, // userId is guaranteed to exist due to auth check above
      chef_id: null,
      name: recipe.name,
      description: recipe.description,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      prep_time: parsePrepTime(recipe.prepTime),
      cook_time: parseCookTime(recipe.cookTime),
      servings: recipe.servings || null,
      cuisine: metadata.cuisine,
      tags: JSON.stringify(metadata.tags),
      difficulty: metadata.difficulty,
      source: source.url,
      search_query: source.searchQuery,
      discovery_date: new Date(),
      confidence_score: source.confidenceScore.toFixed(2),
      validation_model: 'anthropic/claude-3-haiku',
      embedding_model: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,
      is_ai_generated: false, // Discovered from web
      is_public: !userId, // Anonymous discoveries are public
      is_system_recipe: !userId, // Anonymous = system recipe
      nutrition_info: null,
      image_url: null,
      images: null,
    })
    .returning();

  // Save embedding if generation succeeded
  if (embeddingResult && savedRecipe.id) {
    try {
      await saveRecipeEmbedding(
        savedRecipe.id,
        embeddingResult.embedding,
        embeddingResult.embeddingText,
        embeddingResult.modelName
      );
    } catch (error) {
      console.error('Failed to save embedding:', error);
      // Continue - embedding can be regenerated later
    }
  }

  return savedRecipe.id;
}

// ============================================================================
// Step 6: Main Discovery Function
// ============================================================================

/**
 * Main recipe discovery pipeline
 * Orchestrates all 6 steps with error handling and rate limiting
 */
export async function discoverRecipes(
  query: string,
  options: RecipeDiscoveryOptions = {}
): Promise<DiscoveryResult> {
  // Require authentication for recipe discovery pipeline
  await requireAuth('recipe discovery');

  const { minConfidence = 0.6, maxResults = 5 } = options;

  const errors: Array<{ url: string; step: string; error: string }> = [];
  let searched = 0;
  let validated = 0;
  let saved = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Step 1: Search for recipe URLs
    console.log('Step 1: Searching for recipes...');
    const searchResults = await discoverRecipeUrls(query, { ...options, maxResults });
    searched = searchResults.length;

    if (searchResults.length === 0) {
      return {
        success: true,
        recipes: [],
        stats: { searched: 0, validated: 0, saved: 0, failed: 0, skipped: 0 },
      };
    }

    const discoveredRecipes: Recipe[] = [];

    // Process each URL sequentially to avoid rate limits
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      console.log(`Processing ${i + 1}/${searchResults.length}: ${result.url}`);

      try {
        // Step 2: Extract & validate recipe
        const extraction = await extractAndValidateRecipe(result.url, result.title);

        if (!extraction.success || !extraction.recipe) {
          failed++;
          errors.push({
            url: result.url,
            step: 'extraction',
            error: extraction.error || 'Unknown extraction error',
          });
          console.log(`Failed to extract: ${extraction.error}`);
          continue;
        }

        validated++;

        // Check confidence threshold
        if (extraction.confidenceScore && extraction.confidenceScore < minConfidence) {
          skipped++;
          errors.push({
            url: result.url,
            step: 'validation',
            error: `Low confidence: ${extraction.confidenceScore.toFixed(2)} < ${minConfidence}`,
          });
          console.log(`Skipped: confidence ${extraction.confidenceScore.toFixed(2)} too low`);
          continue;
        }

        // Step 3: Generate metadata
        console.log('Generating metadata...');
        const metadata = await generateRecipeMetadata(extraction.recipe);

        // Steps 4 & 5: Generate embedding & save
        console.log('Saving recipe with embedding...');
        const recipeId = await saveDiscoveredRecipe(extraction.recipe, metadata, {
          url: result.url,
          title: result.title,
          searchQuery: query,
          confidenceScore: extraction.confidenceScore || 0.7,
        });

        saved++;

        // Fetch saved recipe for return
        const savedRecipe = await db.query.recipes.findFirst({
          where: (recipes, { eq }) => eq(recipes.id, recipeId),
        });

        if (savedRecipe) {
          discoveredRecipes.push(savedRecipe);
        }

        console.log(`Successfully saved: ${extraction.recipe.name}`);

        // Rate limiting: 2 second delay between requests
        if (i < searchResults.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        failed++;
        errors.push({
          url: result.url,
          step: 'pipeline',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Pipeline error for ${result.url}:`, error);
      }
    }

    return {
      success: true,
      recipes: discoveredRecipes,
      stats: {
        searched,
        validated,
        saved,
        failed,
        skipped,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('Discovery pipeline error:', error);
    return {
      success: false,
      recipes: [],
      stats: {
        searched,
        validated,
        saved,
        failed,
        skipped,
      },
      errors: [
        {
          url: 'pipeline',
          step: 'initialization',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick discovery for single URL
 */
export async function discoverRecipeFromUrl(url: string): Promise<{
  success: boolean;
  recipe?: Recipe;
  error?: string;
}> {
  // Require authentication for URL-based recipe discovery
  await requireAuth('recipe import from URL');

  try {
    // Extract and validate
    const extraction = await extractAndValidateRecipe(url, 'Manual URL');

    if (!extraction.success || !extraction.recipe) {
      return {
        success: false,
        error: extraction.error || 'Failed to extract recipe',
      };
    }

    // Generate metadata
    const metadata = await generateRecipeMetadata(extraction.recipe);

    // Save recipe
    const recipeId = await saveDiscoveredRecipe(extraction.recipe, metadata, {
      url,
      title: 'Manual Import',
      searchQuery: '',
      confidenceScore: extraction.confidenceScore || 0.7,
    });

    // Fetch saved recipe
    const savedRecipe = await db.query.recipes.findFirst({
      where: (recipes, { eq }) => eq(recipes.id, recipeId),
    });

    return {
      success: true,
      recipe: savedRecipe,
    };
  } catch (error) {
    console.error('Single URL discovery error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
