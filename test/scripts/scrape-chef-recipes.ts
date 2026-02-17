#!/usr/bin/env tsx

/**
 * Chef Recipe Scraping Script - SerpAPI + Firecrawl Integration
 *
 * Comprehensive script to discover and scrape recipes from famous chefs.
 *
 * Features:
 * - SerpAPI for finding recipe URLs (organic search)
 * - Firecrawl for extracting structured recipe data
 * - Database integration with chef_recipes linking
 * - Progress tracking with resume support
 * - Dry-run mode for safety
 * - Rate limiting to respect API quotas
 * - Error handling and retry logic
 * - Duplicate detection by URL and title similarity
 *
 * Usage:
 *   pnpm tsx scripts/scrape-chef-recipes.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true pnpm tsx scripts/scrape-chef-recipes.ts  # Actually insert recipes
 *   pnpm tsx scripts/scrape-chef-recipes.ts --resume     # Resume from last checkpoint
 *   pnpm tsx scripts/scrape-chef-recipes.ts --chef=kenji-lopez-alt  # Single chef
 *
 * Environment Variables:
 *   SERPAPI_API_KEY   - Required for recipe URL discovery
 *   FIRECRAWL_API_KEY - Required for recipe content extraction
 *   APPLY_CHANGES     - Set to 'true' to actually insert into database
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { eq, and, desc, sql, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, chefRecipes, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getJson } from 'serpapi';
import Firecrawl from '@mendable/firecrawl-js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SerpAPIOrganicResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
  source?: string;
  displayed_link?: string;
}

interface SerpAPIResponse {
  organic_results?: SerpAPIOrganicResult[];
  search_metadata?: {
    status: string;
    total_results?: number;
  };
  error?: string;
}

interface FirecrawlRecipeData {
  title?: string;
  name?: string;
  recipeIngredient?: string[];
  ingredients?: string[];
  recipeInstructions?: any[];
  instructions?: string[];
  description?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string;
  servings?: number;
  recipeCuisine?: string;
  recipeCategory?: string;
  keywords?: string;
  image?: string;
  nutrition?: any;
  difficulty?: string;
}

interface ScrapedRecipe {
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
}

interface ProgressState {
  lastProcessedChef?: string;
  processedChefs: string[];
  failedChefs: string[];
  scrapedRecipes: {
    chef: string;
    recipeUrl: string;
    recipeId?: string;
    status: 'success' | 'failed' | 'skipped';
    reason?: string;
  }[];
  timestamp: string;
  stats: {
    totalChefs: number;
    totalRecipes: number;
    successfulRecipes: number;
    failedRecipes: number;
    skippedRecipes: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',
  RESUME: process.argv.includes('--resume'),
  SPECIFIC_CHEF: process.argv.find(arg => arg.startsWith('--chef='))?.split('=')[1],

  PROGRESS_FILE: resolve(process.cwd(), 'tmp/chef-recipe-scraping-progress.json'),
  TMP_DIR: resolve(process.cwd(), 'tmp'),

  // Rate limiting
  SERPAPI_RATE_LIMIT_MS: 1000,  // 1 second between SerpAPI calls
  FIRECRAWL_RATE_LIMIT_MS: 2000, // 2 seconds between Firecrawl calls

  // Scraping limits
  MAX_RECIPES_PER_CHEF: 5,
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT_MS: 30000,

  // Quality thresholds
  MIN_INGREDIENTS: 3,
  MIN_INSTRUCTIONS: 2,
  MIN_TITLE_LENGTH: 5,
};

// Domains to avoid (stock photos, generic sites, non-recipe pages)
const EXCLUDED_DOMAINS = [
  'pinterest.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'youtube.com',
  'amazon.com',
  'walmart.com',
  'target.com',
];

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function loadProgress(): Promise<ProgressState> {
  try {
    if (existsSync(CONFIG.PROGRESS_FILE)) {
      const data = await readFile(CONFIG.PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️  Could not load progress file, starting fresh');
  }

  return {
    processedChefs: [],
    failedChefs: [],
    scrapedRecipes: [],
    timestamp: new Date().toISOString(),
    stats: {
      totalChefs: 0,
      totalRecipes: 0,
      successfulRecipes: 0,
      failedRecipes: 0,
      skippedRecipes: 0,
    },
  };
}

async function saveProgress(progress: ProgressState) {
  try {
    await mkdir(CONFIG.TMP_DIR, { recursive: true });
    await writeFile(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('⚠️  Failed to save progress:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseTimeString(timeStr?: string): number | undefined {
  if (!timeStr) return undefined;

  // ISO 8601 duration format: PT30M, PT1H30M, etc.
  const match = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }

  // Simple number format
  const numMatch = timeStr.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }

  return undefined;
}

function extractInstructions(data: any): string[] {
  // Try recipeInstructions first (schema.org)
  if (data.recipeInstructions) {
    if (Array.isArray(data.recipeInstructions)) {
      return data.recipeInstructions.map((step: any) => {
        if (typeof step === 'string') return step;
        if (step.text) return step.text;
        return String(step);
      }).filter(Boolean);
    }
    if (typeof data.recipeInstructions === 'string') {
      return [data.recipeInstructions];
    }
  }

  // Fallback to instructions field
  if (data.instructions && Array.isArray(data.instructions)) {
    return data.instructions;
  }

  return [];
}

function extractIngredients(data: any): string[] {
  // Try recipeIngredient first (schema.org)
  if (data.recipeIngredient && Array.isArray(data.recipeIngredient)) {
    return data.recipeIngredient.filter(Boolean);
  }

  // Fallback to ingredients field
  if (data.ingredients && Array.isArray(data.ingredients)) {
    return data.ingredients;
  }

  return [];
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ============================================================================
// SERPAPI - RECIPE URL DISCOVERY
// ============================================================================

async function findRecipeUrls(chef: any): Promise<string[]> {
  console.log(`\n🔍 Searching for ${chef.name} recipes...`);

  const queries = buildSearchQueries(chef);
  const allUrls = new Set<string>();

  for (const query of queries) {
    try {
      console.log(`   Query: "${query}"`);

      const results = await getJson({
        engine: 'google',
        q: query,
        api_key: CONFIG.SERPAPI_API_KEY,
        num: CONFIG.MAX_RECIPES_PER_CHEF,
      });

      const organicResults = (results as SerpAPIResponse).organic_results || [];

      for (const result of organicResults) {
        const url = result.link;

        // Filter out excluded domains
        if (isExcludedDomain(url)) {
          console.log(`   ⊘ Skipped (excluded domain): ${url}`);
          continue;
        }

        // Filter for recipe-like URLs
        if (isRecipeLikeUrl(url)) {
          allUrls.add(url);
          console.log(`   ✓ Found: ${result.title}`);
        }
      }

      // Respect rate limits
      await sleep(CONFIG.SERPAPI_RATE_LIMIT_MS);

      // Stop if we have enough URLs
      if (allUrls.size >= CONFIG.MAX_RECIPES_PER_CHEF) break;

    } catch (error: any) {
      console.error(`   ✗ Search failed: ${error.message}`);
    }
  }

  console.log(`   📊 Found ${allUrls.size} unique recipe URLs`);
  return Array.from(allUrls).slice(0, CONFIG.MAX_RECIPES_PER_CHEF);
}

function buildSearchQueries(chef: any): string[] {
  const queries: string[] = [];

  // Strategy 1: Search within chef's own website for ACTUAL recipe pages
  if (chef.website) {
    const domain = new URL(chef.website).hostname.replace('www.', '');
    // More specific queries that target recipe pages, not author pages
    queries.push(`"${chef.name}" recipe instructions site:${domain}`);
    queries.push(`recipe ingredients cooking instructions site:${domain}`);
  }

  // Strategy 2: Target specific recipe platforms with recipe-specific keywords
  // Using quotes and specific keywords to avoid author/profile pages
  queries.push(`"${chef.name}" recipe ingredients instructions cooking`);
  queries.push(`"${chef.name}" recipe "how to make" ingredients`);

  // Strategy 3: Search for recipe titles with chef name
  // More likely to find actual recipe pages vs. bio/profile pages
  queries.push(`"${chef.name}" recipe "prep time" "cook time"`);

  // Strategy 4: Search with specialties (if available)
  if (chef.specialties && chef.specialties.length > 0) {
    const specialty = chef.specialties[0];
    queries.push(`"${chef.name}" ${specialty} recipe ingredients instructions`);
  }

  return queries;
}

function isExcludedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return EXCLUDED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return true; // Invalid URL
  }
}

function isRecipeLikeUrl(url: string): boolean {
  const urlLower = url.toLowerCase();

  // EXCLUDE author/profile/bio pages (common patterns)
  const excludePatterns = [
    '/author/',
    '/by/',
    '/profile/',
    '/bio',
    '/about',
    '/chef/',
    '/contributor/',
    '/writers/',
    '/staff/',
    '/team/',
  ];

  // Reject if URL contains any excluded patterns
  if (excludePatterns.some(pattern => urlLower.includes(pattern))) {
    return false;
  }

  // INCLUDE pages that look like actual recipes
  const recipeIndicators = [
    '/recipe/',
    '/recipes/',
    'recipe?',
    'recipes?',
    '-recipe-',
    '_recipe_',
  ];

  // Strong indicators in URL path
  if (recipeIndicators.some(indicator => urlLower.includes(indicator))) {
    return true;
  }

  // Fallback: require recipe keyword but NOT just in domain
  const recipeKeywords = ['recipe', 'recipes', 'cooking', 'dish', 'food', 'kitchen'];
  const urlPath = urlLower.split('/').slice(3).join('/'); // Get path after domain

  return recipeKeywords.some(keyword => urlPath.includes(keyword));
}

// ============================================================================
// FIRECRAWL - RECIPE CONTENT EXTRACTION
// ============================================================================

async function scrapeRecipe(url: string, chefName: string): Promise<ScrapedRecipe | null> {
  console.log(`\n📄 Scraping recipe: ${url}`);

  try {
    const firecrawl = new Firecrawl({ apiKey: CONFIG.FIRECRAWL_API_KEY });

    // Use v2 API scrape endpoint with format options
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    }) as any;

    // Check if scraping was successful
    if (!result) {
      throw new Error('No result returned from Firecrawl');
    }

    // Check for errors in metadata
    if (result.metadata?.statusCode >= 400) {
      throw new Error(result.metadata.error || `HTTP ${result.metadata.statusCode}`);
    }

    // Check if we have markdown content
    if (!result.markdown || result.markdown.length < 100) {
      throw new Error('Insufficient content returned from Firecrawl');
    }

    // Parse recipe data from structured data (metadata.schema or parsed HTML)
    const recipeData = extractRecipeData(result);

    if (!recipeData) {
      throw new Error('No recipe data found in scraped content');
    }

    // Transform to our schema
    const recipe = transformToRecipeSchema(recipeData, url, chefName);

    // Validate quality
    if (!validateRecipeQuality(recipe)) {
      throw new Error('Recipe failed quality validation');
    }

    console.log(`   ✓ Successfully scraped: ${recipe.title}`);
    return recipe;

  } catch (error: any) {
    console.error(`   ✗ Scraping failed: ${error.message}`);
    if (error.response?.data) {
      console.error(`   API Error: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

function extractRecipeData(data: any): FirecrawlRecipeData | null {
  // DEBUG: Log the data structure we're receiving
  console.log('   [DEBUG] Firecrawl response keys:', Object.keys(data || {}));
  if (data.metadata) {
    console.log('   [DEBUG] Metadata keys:', Object.keys(data.metadata));
  }

  // Look for schema.org Recipe markup (Firecrawl v1 style)
  if (data.metadata?.schema) {
    const schemas = Array.isArray(data.metadata.schema)
      ? data.metadata.schema
      : [data.metadata.schema];

    console.log(`   [DEBUG] Found ${schemas.length} schema(s)`);

    const recipeSchema = schemas.find((s: any) =>
      s['@type'] === 'Recipe' || s['@type']?.includes('Recipe')
    );

    if (recipeSchema) {
      console.log('   [DEBUG] ✓ Found Recipe schema');
      return recipeSchema;
    } else {
      console.log('   [DEBUG] ✗ No Recipe schema found. Schema types:',
        schemas.map((s: any) => s['@type']).join(', '));
    }
  } else {
    console.log('   [DEBUG] No metadata.schema found - trying markdown parsing (Firecrawl v2)');
  }

  // Firecrawl v2: Parse markdown content
  if (data.markdown) {
    console.log('   [DEBUG] Attempting to parse markdown content');
    const recipeFromMarkdown = parseRecipeFromMarkdown(data.markdown, data.metadata);
    if (recipeFromMarkdown) {
      console.log('   [DEBUG] ✓ Successfully parsed recipe from markdown');
      return recipeFromMarkdown;
    } else {
      console.log('   [DEBUG] ✗ Failed to extract recipe from markdown');
    }
  }

  // Fallback to raw data parsing
  if (data.title || data.name) {
    console.log('   [DEBUG] Using fallback: found title/name');
    return data;
  }

  console.log('   [DEBUG] No recipe data could be extracted');
  return null;
}

/**
 * Parse recipe data from Firecrawl v2 markdown content
 */
function parseRecipeFromMarkdown(markdown: string, metadata: any): FirecrawlRecipeData | null {
  if (!markdown || markdown.trim().length === 0) {
    return null;
  }

  const recipe: any = {};

  // Extract title from metadata or markdown heading
  recipe.name = metadata?.ogTitle || metadata?.title || extractFirstHeading(markdown);

  // Extract description
  recipe.description = metadata?.ogDescription || metadata?.description || extractDescription(markdown);

  // Extract ingredients
  recipe.recipeIngredient = extractIngredientsFromMarkdown(markdown);

  // Extract instructions
  recipe.recipeInstructions = extractInstructionsFromMarkdown(markdown);

  // Extract times
  const times = extractTimesFromMarkdown(markdown);
  if (times.prepTime) recipe.prepTime = times.prepTime;
  if (times.cookTime) recipe.cookTime = times.cookTime;
  if (times.totalTime) recipe.totalTime = times.totalTime;

  // Extract servings/yield
  const servings = extractServingsFromMarkdown(markdown);
  if (servings) recipe.recipeYield = servings;

  // Extract image
  recipe.image = metadata?.ogImage || extractImageFromMarkdown(markdown);

  // Only return if we have minimum viable recipe data
  if (!recipe.name || (!recipe.recipeIngredient?.length && !recipe.recipeInstructions?.length)) {
    return null;
  }

  return recipe;
}

function extractFirstHeading(markdown: string): string | undefined {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  return headingMatch ? headingMatch[1].trim() : undefined;
}

function extractDescription(markdown: string): string | undefined {
  // Look for text after first heading but before ingredients/instructions
  const sections = markdown.split(/^##?\s+/m);
  if (sections.length > 1) {
    const intro = sections[1].split('\n').slice(1, 4).join(' ').trim();
    return intro.length > 20 ? intro : undefined;
  }
  return undefined;
}

function extractIngredientsFromMarkdown(markdown: string): string[] {
  const ingredients: string[] = [];

  // Look for "Ingredients" section (case-insensitive)
  const ingredientsMatch = markdown.match(/#+\s*Ingredients?\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i);

  if (ingredientsMatch) {
    const ingredientsText = ingredientsMatch[1];

    // Extract list items (both * and - markers, plus numbered lists)
    const lines = ingredientsText.split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      // Match list items: "* item", "- item", "1. item", etc.
      const listMatch = cleaned.match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const ingredient = listMatch[1].trim();
        if (ingredient.length > 2) { // Minimum length check
          ingredients.push(ingredient);
        }
      }
    }
  }

  return ingredients;
}

function extractInstructionsFromMarkdown(markdown: string): string[] {
  const instructions: string[] = [];

  // Look for "Instructions" or "Directions" section (case-insensitive)
  const instructionsMatch = markdown.match(/#+\s*(?:Instructions?|Directions?|Method|Steps?)\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i);

  if (instructionsMatch) {
    const instructionsText = instructionsMatch[1];

    // Extract list items or paragraphs
    const lines = instructionsText.split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      // Match list items or standalone paragraphs
      const listMatch = cleaned.match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const instruction = listMatch[1].trim();
        if (instruction.length > 10) { // Minimum length check
          instructions.push(instruction);
        }
      } else if (cleaned.length > 20 && !cleaned.startsWith('#')) {
        // Standalone paragraph that's not a heading
        instructions.push(cleaned);
      }
    }
  }

  return instructions;
}

function extractTimesFromMarkdown(markdown: string): { prepTime?: string; cookTime?: string; totalTime?: string } {
  const times: any = {};

  // Look for time mentions (e.g., "Prep Time: 15 minutes", "Cook Time: 30 min", etc.)
  const prepMatch = markdown.match(/Prep(?:\s+Time)?:\s*(\d+(?:\s+hours?)?\s+)?(\d+)\s*(?:min|minutes?)/i);
  if (prepMatch) {
    const hours = prepMatch[1] ? parseInt(prepMatch[1]) : 0;
    const minutes = parseInt(prepMatch[2]);
    times.prepTime = `PT${hours ? hours + 'H' : ''}${minutes}M`;
  }

  const cookMatch = markdown.match(/Cook(?:\s+Time)?:\s*(\d+(?:\s+hours?)?\s+)?(\d+)\s*(?:min|minutes?)/i);
  if (cookMatch) {
    const hours = cookMatch[1] ? parseInt(cookMatch[1]) : 0;
    const minutes = parseInt(cookMatch[2]);
    times.cookTime = `PT${hours ? hours + 'H' : ''}${minutes}M`;
  }

  const totalMatch = markdown.match(/Total(?:\s+Time)?:\s*(\d+(?:\s+hours?)?\s+)?(\d+)\s*(?:min|minutes?)/i);
  if (totalMatch) {
    const hours = totalMatch[1] ? parseInt(totalMatch[1]) : 0;
    const minutes = parseInt(totalMatch[2]);
    times.totalTime = `PT${hours ? hours + 'H' : ''}${minutes}M`;
  }

  return times;
}

function extractServingsFromMarkdown(markdown: string): string | undefined {
  // Look for servings/yield mentions
  const servingsMatch = markdown.match(/(?:Servings?|Yields?|Makes):\s*(\d+(?:\s*-\s*\d+)?)/i);
  return servingsMatch ? servingsMatch[1] : undefined;
}

function extractImageFromMarkdown(markdown: string): string | undefined {
  // Look for first image in markdown
  const imageMatch = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  return imageMatch ? imageMatch[2] : undefined;
}

function transformToRecipeSchema(data: FirecrawlRecipeData, url: string, chefName: string): ScrapedRecipe {
  const title = data.title || data.name || 'Untitled Recipe';
  const ingredients = extractIngredients(data);
  const instructions = extractInstructions(data);
  const prepTime = parseTimeString(data.prepTime);
  const cookTime = parseTimeString(data.cookTime);

  // Parse servings
  let servings: number | undefined;
  if (data.servings) {
    servings = data.servings;
  } else if (data.recipeYield) {
    const match = String(data.recipeYield).match(/(\d+)/);
    servings = match ? parseInt(match[1]) : undefined;
  }

  // Build tags
  const tags: string[] = [chefName];
  if (data.recipeCuisine) tags.push(data.recipeCuisine);
  if (data.recipeCategory) tags.push(data.recipeCategory);
  if (data.keywords) {
    const keywords = typeof data.keywords === 'string'
      ? data.keywords.split(',').map(k => k.trim())
      : data.keywords;
    tags.push(...keywords);
  }

  return {
    url,
    title,
    description: data.description,
    ingredients,
    instructions,
    prep_time: prepTime,
    cook_time: cookTime,
    servings,
    difficulty: data.difficulty as any,
    cuisine: data.recipeCuisine,
    tags: [...new Set(tags)], // Remove duplicates
    image_url: data.image,
  };
}

function validateRecipeQuality(recipe: ScrapedRecipe): boolean {
  // Must have title
  if (!recipe.title || recipe.title.length < CONFIG.MIN_TITLE_LENGTH) {
    console.log(`   ⊘ Validation failed: Title too short or missing`);
    return false;
  }

  // Must have ingredients OR instructions (minimum)
  const hasIngredients = recipe.ingredients.length >= CONFIG.MIN_INGREDIENTS;
  const hasInstructions = recipe.instructions.length >= CONFIG.MIN_INSTRUCTIONS;

  if (!hasIngredients && !hasInstructions) {
    console.log(`   ⊘ Validation failed: Insufficient ingredients (${recipe.ingredients.length}) and instructions (${recipe.instructions.length})`);
    return false;
  }

  return true;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function checkDuplicate(url: string, title: string, chefId: string): Promise<boolean> {
  // Check by URL first (exact match)
  const existingByUrl = await db
    .select()
    .from(chefRecipes)
    .where(eq(chefRecipes.original_url, url))
    .limit(1);

  if (existingByUrl.length > 0) {
    console.log(`   ⊘ Duplicate detected (URL match)`);
    return true;
  }

  // Check by title similarity (within same chef)
  const chefRecipeIds = await db
    .select({ recipe_id: chefRecipes.recipe_id })
    .from(chefRecipes)
    .where(eq(chefRecipes.chef_id, chefId));

  if (chefRecipeIds.length > 0) {
    const recipeIds = chefRecipeIds.map(r => r.recipe_id);
    const existingRecipes = await db
      .select({ name: recipes.name })
      .from(recipes)
      .where(sql`${recipes.id} IN ${recipeIds}`);

    // Check similarity
    for (const existing of existingRecipes) {
      const similarity = calculateSimilarity(title, existing.name);
      if (similarity > 0.85) {
        console.log(`   ⊘ Duplicate detected (Title similarity: ${(similarity * 100).toFixed(1)}%)`);
        return true;
      }
    }
  }

  return false;
}

async function insertRecipe(recipe: ScrapedRecipe, chef: any): Promise<string | null> {
  if (!CONFIG.APPLY_CHANGES) {
    console.log(`   ⊛ DRY RUN: Would insert recipe "${recipe.title}"`);
    return 'dry-run-id';
  }

  try {
    // Check for duplicates
    const isDuplicate = await checkDuplicate(recipe.url, recipe.title, chef.id);
    if (isDuplicate) {
      return null;
    }

    // Insert recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: 'system', // System-generated recipe
        chef_id: chef.id,
        name: recipe.title,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: JSON.stringify(recipe.tags),
        images: recipe.image_url ? JSON.stringify([recipe.image_url]) : JSON.stringify([]),
        is_public: true,
        is_system_recipe: true,
        source: recipe.url,
      })
      .returning({ id: recipes.id });

    // Link to chef
    await db.insert(chefRecipes).values({
      chef_id: chef.id,
      recipe_id: newRecipe.id,
      original_url: recipe.url,
      scraped_at: new Date(),
    });

    // Update chef recipe count
    await db
      .update(chefs)
      .set({
        recipe_count: sql`${chefs.recipe_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, chef.id));

    console.log(`   ✓ Inserted recipe: ${newRecipe.id}`);
    return newRecipe.id;

  } catch (error: any) {
    console.error(`   ✗ Database insertion failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MAIN SCRAPING LOGIC
// ============================================================================

async function scrapeChefRecipes(chef: any, progress: ProgressState) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📚 SCRAPING RECIPES FOR: ${chef.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Slug: ${chef.slug}`);
  console.log(`   Website: ${chef.website || 'N/A'}`);
  console.log(`   Specialties: ${chef.specialties?.join(', ') || 'N/A'}`);
  console.log(`   Current Recipe Count: ${chef.recipe_count || 0}`);

  // Step 1: Find recipe URLs
  const urls = await findRecipeUrls(chef);

  if (urls.length === 0) {
    console.log(`\n⚠️  No recipe URLs found for ${chef.name}`);
    progress.failedChefs.push(chef.slug);
    return;
  }

  // Step 2: Scrape each recipe
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const url of urls) {
    try {
      // Scrape recipe content
      const recipe = await scrapeRecipe(url, chef.name);

      if (!recipe) {
        failCount++;
        progress.scrapedRecipes.push({
          chef: chef.slug,
          recipeUrl: url,
          status: 'failed',
          reason: 'Scraping failed',
        });
        continue;
      }

      // Insert into database
      const recipeId = await insertRecipe(recipe, chef);

      if (recipeId === null) {
        skipCount++;
        progress.scrapedRecipes.push({
          chef: chef.slug,
          recipeUrl: url,
          status: 'skipped',
          reason: 'Duplicate detected',
        });
      } else {
        successCount++;
        progress.scrapedRecipes.push({
          chef: chef.slug,
          recipeUrl: url,
          recipeId,
          status: 'success',
        });
      }

      // Respect rate limits
      await sleep(CONFIG.FIRECRAWL_RATE_LIMIT_MS);

    } catch (error: any) {
      failCount++;
      console.error(`\n❌ Error processing ${url}: ${error.message}`);
      progress.scrapedRecipes.push({
        chef: chef.slug,
        recipeUrl: url,
        status: 'failed',
        reason: error.message,
      });
    }
  }

  // Update stats
  progress.stats.totalRecipes += urls.length;
  progress.stats.successfulRecipes += successCount;
  progress.stats.failedRecipes += failCount;
  progress.stats.skippedRecipes += skipCount;

  // Summary
  console.log(`\n📊 CHEF SUMMARY:`);
  console.log(`   ✓ Success: ${successCount}`);
  console.log(`   ⊘ Skipped (duplicates): ${skipCount}`);
  console.log(`   ✗ Failed: ${failCount}`);

  progress.processedChefs.push(chef.slug);
  progress.lastProcessedChef = chef.slug;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('CHEF RECIPE SCRAPING SCRIPT');
  console.log('='.repeat(70));
  console.log(`Mode: ${CONFIG.APPLY_CHANGES ? '🔴 LIVE' : '⊛ DRY RUN'}`);
  console.log(`Resume: ${CONFIG.RESUME ? 'Yes' : 'No'}`);
  console.log(`Max recipes per chef: ${CONFIG.MAX_RECIPES_PER_CHEF}`);
  console.log('='.repeat(70));

  // Validate API keys
  if (!CONFIG.SERPAPI_API_KEY) {
    console.error('\n❌ SERPAPI_API_KEY not found in environment');
    console.error('   Add it to .env.local and try again');
    process.exit(1);
  }

  if (!CONFIG.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found in environment');
    console.error('   Add it to .env.local and try again');
    process.exit(1);
  }

  console.log('✓ API keys validated\n');

  // Load progress
  const progress = await loadProgress();

  // Query chefs from database
  let chefsToProcess;

  if (CONFIG.SPECIFIC_CHEF) {
    console.log(`🎯 Processing specific chef: ${CONFIG.SPECIFIC_CHEF}\n`);
    chefsToProcess = await db
      .select()
      .from(chefs)
      .where(and(
        eq(chefs.slug, CONFIG.SPECIFIC_CHEF),
        eq(chefs.is_active, true)
      ))
      .limit(1);
  } else {
    console.log('📋 Querying all active chefs...\n');
    chefsToProcess = await db
      .select()
      .from(chefs)
      .where(eq(chefs.is_active, true))
      .orderBy(desc(chefs.recipe_count));
  }

  if (chefsToProcess.length === 0) {
    console.error('❌ No active chefs found in database');
    process.exit(1);
  }

  console.log(`Found ${chefsToProcess.length} chef(s) to process\n`);
  progress.stats.totalChefs = chefsToProcess.length;

  // Filter out already processed chefs if resuming
  if (CONFIG.RESUME) {
    chefsToProcess = chefsToProcess.filter(
      chef => !progress.processedChefs.includes(chef.slug)
    );
    console.log(`Resume mode: ${chefsToProcess.length} chef(s) remaining\n`);
  }

  // Process each chef
  for (const chef of chefsToProcess) {
    try {
      await scrapeChefRecipes(chef, progress);
      await saveProgress(progress);
    } catch (error: any) {
      console.error(`\n❌ FATAL ERROR processing ${chef.name}: ${error.message}`);
      progress.failedChefs.push(chef.slug);
      await saveProgress(progress);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Chefs processed: ${progress.processedChefs.length}/${progress.stats.totalChefs}`);
  console.log(`Total recipes found: ${progress.stats.totalRecipes}`);
  console.log(`✓ Successfully scraped: ${progress.stats.successfulRecipes}`);
  console.log(`⊘ Skipped (duplicates): ${progress.stats.skippedRecipes}`);
  console.log(`✗ Failed: ${progress.stats.failedRecipes}`);
  console.log(`Failed chefs: ${progress.failedChefs.length}`);

  if (progress.failedChefs.length > 0) {
    console.log(`\nFailed chefs: ${progress.failedChefs.join(', ')}`);
  }

  console.log(`\n📄 Progress saved to: ${CONFIG.PROGRESS_FILE}`);
  console.log('='.repeat(70));

  if (!CONFIG.APPLY_CHANGES) {
    console.log('\n⊛ DRY RUN COMPLETE - No changes made to database');
    console.log('   Run with APPLY_CHANGES=true to insert recipes');
  }
}

// Run main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
