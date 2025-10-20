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
 */

'use server';

import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { evaluateRecipeQuality } from '@/lib/ai/recipe-quality-evaluator';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { recipes } from '@/lib/db/schema';
import { discoverWeeklyRecipes } from '@/lib/perplexity-discovery';
import { filterRecipeSites, searchRecipesWithSerpAPI } from '@/lib/serpapi';
import { formatWeekInfo, getWeekInfo, type WeekInfo } from '@/lib/week-utils';

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
  } catch (error: any) {
    console.error('[Search] Error:', error.message);
    return {
      success: false,
      results: [],
      error: error.message,
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

    // Fetch webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Limit HTML size to prevent token limits
    const limitedHtml = html.substring(0, 50000);

    // Use Claude via OpenRouter to extract recipe
    const openrouter = getOpenRouterClient();

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from this HTML. Return ONLY valid JSON with no markdown formatting, code blocks, or extra text.

HTML Content:
${limitedHtml}

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

    const content = completion.choices[0].message.content || '{}';

    // Remove markdown code blocks if present
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const extracted: ExtractedRecipe = JSON.parse(cleanContent);

    if (!extracted.isValid) {
      console.log(`[Convert] Invalid recipe extracted from ${url}`);
      return {
        success: false,
        error: 'Could not extract valid recipe from URL',
      };
    }

    console.log(`[Convert] Successfully extracted recipe: ${extracted.name}`);

    return {
      success: true,
      recipe: extracted,
    };
  } catch (error: any) {
    console.error(`[Convert] Error extracting from ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
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

// ============================================================================
// STEP 4: STORE - Save recipe to database
// ============================================================================

/**
 * Downloads and stores recipe images
 * For now, just validates and returns URLs
 *
 * @param imageUrls - Array of image URLs
 * @returns Array of stored image URLs
 */
async function downloadAndStoreImages(imageUrls: string[]): Promise<string[]> {
  // For now, return the URLs as-is (limit to 6 images)
  // In production, you would:
  // 1. Download images
  // 2. Upload to cloud storage (Vercel Blob, S3, etc.)
  // 3. Return the new URLs

  const validUrls = imageUrls
    .filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 6);

  return validUrls;
}

/**
 * Stores a recipe in the database with embeddings
 *
 * @param recipe - Recipe to store
 * @param metadata - Source metadata
 * @returns Result with recipe ID
 */
export async function storeRecipe(
  recipe: ExtractedRecipe,
  metadata: {
    sourceUrl: string;
    searchQuery: string;
  }
): Promise<{
  success: boolean;
  recipeId?: string;
  error?: string;
}> {
  try {
    console.log(`[Store] Storing recipe: ${recipe.name}`);

    const { userId } = await auth();

    // Download and store images
    const storedImages = await downloadAndStoreImages(recipe.images || []);

    // Evaluate recipe quality with AI
    console.log(`[Store] Evaluating recipe quality for "${recipe.name}"`);
    const qualityEval = await evaluateRecipeQuality({
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    });
    console.log(`[Store] Quality rating: ${qualityEval.rating}/5 - ${qualityEval.reasoning}`);

    // Generate embedding for semantic search
    // IMPORTANT: Wrap in try-catch to prevent embedding failures from blocking recipe storage
    let embeddingResult: { embedding: number[]; embeddingText: string } | null = null;
    try {
      console.log(`[Store] Generating embedding for: ${recipe.name}`);
      embeddingResult = await generateRecipeEmbedding({
        id: '', // Temporary ID, will be replaced
        user_id: userId || '',
        chef_id: null,
        source_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        prep_time: null,
        cook_time: null,
        servings: null,
        image_url: null,
        images: null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: !userId,
        nutrition_info: null,
        model_used: null,
        source: null,
        license: 'ALL_RIGHTS_RESERVED', // Default license for crawled recipes
        created_at: new Date(),
        updated_at: new Date(),
        search_query: null,
        discovery_date: null,
        confidence_score: null,
        validation_model: null,
        embedding_model: null,
        discovery_week: null,
        discovery_year: null,
        published_date: null,
        system_rating: null,
        system_rating_reason: null,
        avg_user_rating: null,
        total_user_ratings: null,
        slug: null,
        is_meal_prep_friendly: false,
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        like_count: 0,
        fork_count: 0,
        collection_count: 0,
        instruction_metadata: null,
        instruction_metadata_version: null,
        instruction_metadata_generated_at: null,
        instruction_metadata_model: null,
        content_flagged_for_cleanup: false,
        ingredients_need_cleanup: false,
        instructions_need_cleanup: false,
        deleted_at: null,
        deleted_by: null,
        // Meal pairing metadata (v0.65.0)
        weight_score: null,
        richness_score: null,
        acidity_score: null,
        sweetness_level: null,
        dominant_textures: null,
        dominant_flavors: null,
        serving_temperature: null,
        pairing_rationale: null,
        video_url: null,
        // Waste-reduction and resourcefulness fields (v0.45.0)
        resourcefulness_score: null,
        waste_reduction_tags: null,
        scrap_utilization_notes: null,
        environmental_notes: null,
      });
      console.log(
        `[Store] Successfully generated embedding (${embeddingResult.embedding.length} dimensions)`
      );
    } catch (error: any) {
      console.error(`[Store] Failed to generate embedding for "${recipe.name}":`, error.message);
      console.error(
        `[Store] Error details:`,
        JSON.stringify(error.details || {}).substring(0, 300)
      );
      console.warn(
        `[Store] Continuing without embedding - recipe will be saved but won't be searchable`
      );
      embeddingResult = null;
    }

    // Save recipe to database
    const [savedRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId || 'system',
        chef_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: parseTimeToMinutes(recipe.prepTime),
        cook_time: parseTimeToMinutes(recipe.cookTime),
        servings: recipe.servings || null,
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        images: JSON.stringify(storedImages),
        source: metadata.sourceUrl,
        search_query: metadata.searchQuery,
        discovery_date: new Date(),
        confidence_score: recipe.confidenceScore.toString(),
        validation_model: 'anthropic/claude-3-haiku',
        embedding_model: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: !userId,
        // Quality rating fields
        system_rating: qualityEval.rating.toFixed(1),
        system_rating_reason: qualityEval.reasoning,
        avg_user_rating: null,
        total_user_ratings: 0,
      })
      .returning();

    // Save embedding if generation succeeded
    if (embeddingResult) {
      try {
        await saveRecipeEmbedding(
          savedRecipe.id,
          embeddingResult.embedding,
          embeddingResult.embeddingText,
          'sentence-transformers/all-MiniLM-L6-v2'
        );
        console.log(`[Store] Successfully saved embedding to database`);
      } catch (error: any) {
        console.error(`[Store] Failed to save embedding to database:`, error.message);
        console.warn(`[Store] Recipe saved but embedding not stored - can be regenerated later`);
      }
    } else {
      console.warn(
        `[Store] Recipe saved WITHOUT embedding - will need manual embedding generation`
      );
    }

    console.log(`[Store] Successfully stored recipe with ID: ${savedRecipe.id}`);

    return {
      success: true,
      recipeId: savedRecipe.id,
    };
  } catch (error: any) {
    console.error(`[Store] Error storing recipe:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Parses time strings to minutes
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;

  // Extract numbers from string
  const match = timeStr.match(/(\d+)/);
  if (!match) return null;

  const value = parseInt(match[1], 10);

  // Check for hours
  if (timeStr.toLowerCase().includes('hour')) {
    return value * 60;
  }

  // Default to minutes
  return value;
}

/**
 * Validates and parses date strings to Date objects
 * Returns null for invalid dates instead of throwing errors
 *
 * @param dateString - Date string to parse (can be undefined, null, or invalid)
 * @returns Valid Date object or null
 */
function validateAndParseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  // Reject known invalid values
  if (
    dateString.toLowerCase() === 'approximate' ||
    dateString.toLowerCase() === 'unknown' ||
    dateString.toLowerCase() === 'n/a'
  ) {
    console.warn(`[Store] Invalid date string: "${dateString}" - using null`);
    return null;
  }

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      console.warn(`[Store] Invalid date string: "${dateString}" - parsed to Invalid Date`);
      return null;
    }

    // Sanity check: reject dates too far in past or future
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[Store] Date out of reasonable range: "${dateString}" (year: ${year})`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`[Store] Error parsing date: "${dateString}"`, error);
    return null;
  }
}

// ============================================================================
// WEEKLY DISCOVERY PIPELINE (PERPLEXITY)
// ============================================================================

/**
 * Stores a recipe with week tracking metadata
 */
async function storeRecipeWithWeek(
  recipe: ExtractedRecipe,
  metadata: {
    sourceUrl: string;
    weekInfo: WeekInfo;
    publishedDate?: string;
  }
): Promise<{
  success: boolean;
  recipeId?: string;
  error?: string;
}> {
  try {
    console.log(`[Store] Storing recipe with week tracking: ${recipe.name}`);

    const { userId } = await auth();

    // Download and store images
    const storedImages = await downloadAndStoreImages(recipe.images || []);

    // Generate embedding for semantic search
    // IMPORTANT: Wrap in try-catch to prevent embedding failures from blocking recipe storage
    let embeddingResult: { embedding: number[]; embeddingText: string } | null = null;
    try {
      console.log(`[Store] Generating embedding for: ${recipe.name}`);
      embeddingResult = await generateRecipeEmbedding({
        id: '',
        user_id: userId || '',
        chef_id: null,
        source_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        prep_time: null,
        cook_time: null,
        servings: null,
        image_url: null,
        images: null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: !userId,
        nutrition_info: null,
        model_used: null,
        source: null,
        license: 'ALL_RIGHTS_RESERVED', // Default license for crawled recipes
        created_at: new Date(),
        updated_at: new Date(),
        search_query: null,
        discovery_date: null,
        confidence_score: null,
        validation_model: null,
        embedding_model: null,
        discovery_week: null,
        discovery_year: null,
        published_date: null,
        system_rating: null,
        system_rating_reason: null,
        avg_user_rating: null,
        total_user_ratings: null,
        slug: null,
        is_meal_prep_friendly: false,
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        like_count: 0,
        fork_count: 0,
        collection_count: 0,
        instruction_metadata: null,
        instruction_metadata_version: null,
        instruction_metadata_generated_at: null,
        instruction_metadata_model: null,
        content_flagged_for_cleanup: false,
        ingredients_need_cleanup: false,
        instructions_need_cleanup: false,
        deleted_at: null,
        deleted_by: null,
        // Meal pairing metadata (v0.65.0)
        weight_score: null,
        richness_score: null,
        acidity_score: null,
        sweetness_level: null,
        dominant_textures: null,
        dominant_flavors: null,
        serving_temperature: null,
        pairing_rationale: null,
        video_url: null,
        // Waste-reduction and resourcefulness fields (v0.45.0)
        resourcefulness_score: null,
        waste_reduction_tags: null,
        scrap_utilization_notes: null,
        environmental_notes: null,
      });
      console.log(
        `[Store] Successfully generated embedding (${embeddingResult.embedding.length} dimensions)`
      );
    } catch (error: any) {
      console.error(`[Store] Failed to generate embedding for "${recipe.name}":`, error.message);
      console.error(
        `[Store] Error details:`,
        JSON.stringify(error.details || {}).substring(0, 300)
      );
      console.warn(
        `[Store] Continuing without embedding - recipe will be saved but won't be searchable`
      );
      embeddingResult = null;
    }

    // Parse published date with validation
    const publishedDate = validateAndParseDate(metadata.publishedDate);

    console.log(
      `[Store] Week: ${metadata.weekInfo.week}, Year: ${metadata.weekInfo.year}, Published: ${publishedDate ? publishedDate.toISOString() : 'null'}`
    );

    // Evaluate recipe quality with AI
    console.log(`[Store] Evaluating recipe quality for "${recipe.name}"`);
    const qualityEval = await evaluateRecipeQuality({
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    });
    console.log(`[Store] Quality rating: ${qualityEval.rating}/5 - ${qualityEval.reasoning}`);

    // Save recipe to database with week tracking
    const [savedRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId || 'system',
        chef_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: parseTimeToMinutes(recipe.prepTime),
        cook_time: parseTimeToMinutes(recipe.cookTime),
        servings: recipe.servings || null,
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        images: JSON.stringify(storedImages),
        source: metadata.sourceUrl,
        discovery_date: new Date(),
        discovery_week: metadata.weekInfo.week,
        discovery_year: metadata.weekInfo.year,
        published_date: publishedDate,
        confidence_score: recipe.confidenceScore.toString(),
        validation_model: 'anthropic/claude-3-haiku',
        embedding_model: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: !userId,
        // Quality rating fields
        system_rating: qualityEval.rating.toFixed(1),
        system_rating_reason: qualityEval.reasoning,
        avg_user_rating: null,
        total_user_ratings: 0,
      })
      .returning();

    // Save embedding if generation succeeded
    if (embeddingResult) {
      try {
        await saveRecipeEmbedding(
          savedRecipe.id,
          embeddingResult.embedding,
          embeddingResult.embeddingText,
          'sentence-transformers/all-MiniLM-L6-v2'
        );
        console.log(`[Store] Successfully saved embedding to database`);
      } catch (error: any) {
        console.error(`[Store] Failed to save embedding to database:`, error.message);
        console.warn(`[Store] Recipe saved but embedding not stored - can be regenerated later`);
      }
    } else {
      console.warn(
        `[Store] Recipe saved WITHOUT embedding - will need manual embedding generation`
      );
    }

    console.log(
      `[Store] Successfully stored recipe with ID: ${savedRecipe.id} (Week ${metadata.weekInfo.week}, ${metadata.weekInfo.year})`
    );

    return {
      success: true,
      recipeId: savedRecipe.id,
    };
  } catch (error: any) {
    console.error(`[Store] Error storing recipe:`, error.message);
    console.error(`[Store] Error details:`, {
      recipeName: recipe.name,
      publishedDateInput: metadata.publishedDate,
      parsedPublishedDate: validateAndParseDate(metadata.publishedDate),
      weekInfo: metadata.weekInfo,
      errorStack: error.stack?.substring(0, 500),
    });
    return {
      success: false,
      error: error.message,
    };
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
  }
): Promise<{
  success: boolean;
  weekInfo: WeekInfo;
  stats: CrawlStats;
  recipes: CrawlRecipeResult[];
  error?: string;
}> {
  const weekInfo = getWeekInfo(weeksAgo);

  const stats: CrawlStats = {
    searched: 0,
    converted: 0,
    approved: 0,
    stored: 0,
    failed: 0,
  };

  const recipeResults: CrawlRecipeResult[] = [];

  try {
    console.log(`[Weekly Pipeline] Starting discovery for ${formatWeekInfo(weekInfo)}`);

    // STEP 1: Discover recipes using Perplexity
    const discovery = await discoverWeeklyRecipes(weekInfo, {
      cuisine: options?.cuisine,
      maxResults: options?.maxResults || 10,
    });

    if (!discovery.success) {
      return {
        success: false,
        weekInfo,
        stats,
        recipes: recipeResults,
        error: discovery.error,
      };
    }

    stats.searched = discovery.recipes.length;
    console.log(`[Weekly Pipeline] Step 1 complete: Discovered ${stats.searched} recipes`);

    // Process each discovered recipe
    for (const result of discovery.recipes) {
      try {
        console.log(`[Weekly Pipeline] Processing: ${result.url}`);

        // STEP 2: Convert (Extract recipe from URL)
        const conversion = await convertUrlToRecipe(result.url);

        if (!conversion.success || !conversion.recipe) {
          recipeResults.push({
            url: result.url,
            name: result.title,
            status: 'failed',
            reason: conversion.error || 'Extraction failed',
          });
          stats.failed++;
          continue;
        }

        stats.converted++;
        console.log(`[Weekly Pipeline] Step 2 complete: Extracted "${conversion.recipe.name}"`);

        // STEP 3: Approve (Validate)
        const validation = await validateRecipe(conversion.recipe);

        if (!validation.approved && !options?.autoApprove) {
          recipeResults.push({
            url: result.url,
            name: conversion.recipe.name,
            status: 'rejected',
            reason: validation.issues.join(', '),
          });
          console.log(`[Weekly Pipeline] Step 3: REJECTED "${conversion.recipe.name}"`);
          continue;
        }

        stats.approved++;
        console.log(`[Weekly Pipeline] Step 3 complete: Approved "${conversion.recipe.name}"`);

        // STEP 4: Store with week tracking
        const storage = await storeRecipeWithWeek(conversion.recipe, {
          sourceUrl: result.url,
          weekInfo,
          publishedDate: result.publishedDate,
        });

        if (storage.success) {
          recipeResults.push({
            id: storage.recipeId!,
            url: result.url,
            name: conversion.recipe.name,
            status: 'stored',
          });
          stats.stored++;
          console.log(`[Weekly Pipeline] Step 4 complete: Stored "${conversion.recipe.name}"`);
        } else {
          recipeResults.push({
            url: result.url,
            name: conversion.recipe.name,
            status: 'failed',
            reason: storage.error,
          });
          stats.failed++;
        }

        // Rate limiting: wait 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`[Weekly Pipeline] Error processing ${result.url}:`, error.message);
        recipeResults.push({
          url: result.url,
          name: result.title,
          status: 'failed',
          reason: error.message,
        });
        stats.failed++;
      }
    }

    console.log(`[Weekly Pipeline] Complete! Stats:`, stats);

    return {
      success: true,
      weekInfo,
      stats,
      recipes: recipeResults,
    };
  } catch (error: any) {
    console.error(`[Weekly Pipeline] Fatal error:`, error.message);
    return {
      success: false,
      weekInfo,
      stats,
      recipes: recipeResults,
      error: error.message,
    };
  }
}

// ============================================================================
// COMPLETE PIPELINE (LEGACY - SERPAPI)
// ============================================================================

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
  const stats: CrawlStats = {
    searched: 0,
    converted: 0,
    approved: 0,
    stored: 0,
    failed: 0,
  };

  const recipeResults: CrawlRecipeResult[] = [];

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

    // Process each result through the pipeline
    for (const result of searchResults.results) {
      try {
        console.log(`[Pipeline] Processing: ${result.url}`);

        // STEP 2: Convert
        const conversion = await convertUrlToRecipe(result.url);

        if (!conversion.success || !conversion.recipe) {
          recipeResults.push({
            url: result.url,
            name: result.title,
            status: 'failed',
            reason: conversion.error || 'Extraction failed',
          });
          stats.failed++;
          continue;
        }

        stats.converted++;
        console.log(`[Pipeline] Step 2 complete: Extracted "${conversion.recipe.name}"`);

        // STEP 3: Approve
        const validation = await validateRecipe(conversion.recipe);

        if (!validation.approved && !options?.autoApprove) {
          recipeResults.push({
            url: result.url,
            name: conversion.recipe.name,
            status: 'rejected',
            reason: validation.issues.join(', '),
          });
          console.log(`[Pipeline] Step 3: REJECTED "${conversion.recipe.name}"`);
          continue;
        }

        stats.approved++;
        console.log(`[Pipeline] Step 3 complete: Approved "${conversion.recipe.name}"`);

        // STEP 4: Store
        const storage = await storeRecipe(conversion.recipe, {
          sourceUrl: result.url,
          searchQuery: query,
        });

        if (storage.success) {
          recipeResults.push({
            id: storage.recipeId!,
            url: result.url,
            name: conversion.recipe.name,
            status: 'stored',
          });
          stats.stored++;
          console.log(`[Pipeline] Step 4 complete: Stored "${conversion.recipe.name}"`);
        } else {
          recipeResults.push({
            url: result.url,
            name: conversion.recipe.name,
            status: 'failed',
            reason: storage.error,
          });
          stats.failed++;
        }

        // Rate limiting: wait 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`[Pipeline] Error processing ${result.url}:`, error.message);
        recipeResults.push({
          url: result.url,
          name: result.title,
          status: 'failed',
          reason: error.message,
        });
        stats.failed++;
      }
    }

    console.log(`[Pipeline] Complete! Stats:`, stats);

    return {
      success: true,
      stats,
      recipes: recipeResults,
    };
  } catch (error: any) {
    console.error(`[Pipeline] Fatal error:`, error.message);
    return {
      success: false,
      stats,
      recipes: recipeResults,
    };
  }
}
