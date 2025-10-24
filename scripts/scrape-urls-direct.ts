#!/usr/bin/env tsx

/**
 * Direct URL Scraping Script - Firecrawl Integration
 *
 * Reads URLs from tmp/chef-urls-to-scrape.txt and scrapes each one directly.
 * Determines which chef owns each recipe by matching URL domains to chef websites.
 * Reuses all parsing logic from scrape-chef-recipes.ts.
 *
 * Usage:
 *   pnpm tsx scripts/scrape-urls-direct.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true pnpm tsx scripts/scrape-urls-direct.ts  # Actually insert recipes
 *
 * Environment Variables:
 *   FIRECRAWL_API_KEY - Required for recipe content extraction
 *   APPLY_CHANGES     - Set to 'true' to actually insert into database
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import Firecrawl from '@mendable/firecrawl-js';

// ============================================================================
// IMPORT REUSABLE FUNCTIONS FROM scrape-chef-recipes.ts
// ============================================================================

// Re-import types
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

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',

  URL_FILE: resolve(process.cwd(), process.argv[2] || 'tmp/chef-urls-to-scrape.txt'),
  LOG_FILE: resolve(process.cwd(), 'tmp/direct-scraping.log'),
  TMP_DIR: resolve(process.cwd(), 'tmp'),

  // Rate limiting
  FIRECRAWL_RATE_LIMIT_MS: 1000, // 1 second between Firecrawl calls

  // Quality thresholds (from scrape-chef-recipes.ts)
  MIN_INGREDIENTS: 3,
  MIN_INSTRUCTIONS: 2,
  MIN_TITLE_LENGTH: 5,
  REQUEST_TIMEOUT_MS: 30000,
};

// ============================================================================
// LOGGING
// ============================================================================

const logs: string[] = [];

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  logs.push(logLine);
  console.log(message);
}

async function saveLogs() {
  try {
    await mkdir(CONFIG.TMP_DIR, { recursive: true });
    await writeFile(CONFIG.LOG_FILE, logs.join('\n'));
  } catch (error) {
    console.error('⚠️  Failed to save logs:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS (IMPORTED FROM scrape-chef-recipes.ts)
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

function extractRecipeData(data: any): FirecrawlRecipeData | null {
  // Look for schema.org Recipe markup (Firecrawl v1 style)
  if (data.metadata?.schema) {
    const schemas = Array.isArray(data.metadata.schema)
      ? data.metadata.schema
      : [data.metadata.schema];

    const recipeSchema = schemas.find((s: any) =>
      s['@type'] === 'Recipe' || s['@type']?.includes('Recipe')
    );

    if (recipeSchema) {
      return recipeSchema;
    }
  }

  // Firecrawl v2: Parse markdown content
  if (data.markdown) {
    const recipeFromMarkdown = parseRecipeFromMarkdown(data.markdown, data.metadata);
    if (recipeFromMarkdown) {
      return recipeFromMarkdown;
    }
  }

  // Fallback to raw data parsing
  if (data.title || data.name) {
    return data;
  }

  return null;
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
    log(`   ⊘ Validation failed: Title too short or missing`);
    return false;
  }

  // Must have ingredients OR instructions (minimum)
  const hasIngredients = recipe.ingredients.length >= CONFIG.MIN_INGREDIENTS;
  const hasInstructions = recipe.instructions.length >= CONFIG.MIN_INSTRUCTIONS;

  if (!hasIngredients && !hasInstructions) {
    log(`   ⊘ Validation failed: Insufficient ingredients (${recipe.ingredients.length}) and instructions (${recipe.instructions.length})`);
    return false;
  }

  return true;
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
// FIRECRAWL - RECIPE CONTENT EXTRACTION (REUSED)
// ============================================================================

async function scrapeRecipeUrl(url: string, chefName: string): Promise<ScrapedRecipe | null> {
  log(`\n📄 Scraping recipe: ${url}`);

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

    log(`   ✓ Successfully scraped: ${recipe.title}`);
    return recipe;

  } catch (error: any) {
    log(`   ✗ Scraping failed: ${error.message}`);
    if (error.response?.data) {
      log(`   API Error: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function findChefByUrl(url: string): Promise<any | null> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    // Query all chefs
    const allChefs = await db.select().from(chefs).where(eq(chefs.is_active, true));

    // Find chef whose website matches this URL's domain
    for (const chef of allChefs) {
      if (!chef.website) continue;

      try {
        const chefUrlObj = new URL(chef.website);
        const chefHostname = chefUrlObj.hostname.replace('www.', '');

        if (hostname === chefHostname || hostname.includes(chefHostname)) {
          log(`   ✓ Matched chef: ${chef.name} (${chef.website})`);
          return chef;
        }
      } catch (error) {
        // Invalid chef website URL, skip
        continue;
      }
    }

    log(`   ⚠️  No chef found for domain: ${hostname}`);
    return null;
  } catch (error) {
    log(`   ✗ Invalid URL: ${url}`);
    return null;
  }
}

async function checkDuplicate(url: string, title: string, chefId: string): Promise<boolean> {
  // Check by URL first (exact match)
  const existingByUrl = await db
    .select()
    .from(chefRecipes)
    .where(eq(chefRecipes.original_url, url))
    .limit(1);

  if (existingByUrl.length > 0) {
    log(`   ⊘ Duplicate detected (URL match)`);
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
      .where(eq(recipes.id, recipeIds[0])); // Simple check for first recipe

    // Check similarity
    for (const existing of existingRecipes) {
      const similarity = calculateSimilarity(title, existing.name);
      if (similarity > 0.85) {
        log(`   ⊘ Duplicate detected (Title similarity: ${(similarity * 100).toFixed(1)}%)`);
        return true;
      }
    }
  }

  return false;
}

async function insertRecipe(recipe: ScrapedRecipe, chef: any): Promise<string | null> {
  if (!CONFIG.APPLY_CHANGES) {
    log(`   ⊛ DRY RUN: Would insert recipe "${recipe.title}"`);
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

    log(`   ✓ Inserted recipe: ${newRecipe.id}`);
    return newRecipe.id;

  } catch (error: any) {
    log(`   ✗ Database insertion failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('DIRECT URL SCRAPING SCRIPT');
  console.log('='.repeat(70));
  console.log(`Mode: ${CONFIG.APPLY_CHANGES ? '🔴 LIVE' : '⊛ DRY RUN'}`);
  console.log(`URL File: ${CONFIG.URL_FILE}`);
  console.log(`Log File: ${CONFIG.LOG_FILE}`);
  console.log('='.repeat(70));

  // Validate API keys
  if (!CONFIG.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found in environment');
    console.error('   Add it to .env.local and try again');
    process.exit(1);
  }

  console.log('✓ API keys validated\n');

  // Read URLs from file
  if (!existsSync(CONFIG.URL_FILE)) {
    console.error(`\n❌ URL file not found: ${CONFIG.URL_FILE}`);
    console.error('   Create the file with one URL per line');
    process.exit(1);
  }

  const fileContent = await readFile(CONFIG.URL_FILE, 'utf-8');
  const urls = fileContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.startsWith('http'));

  if (urls.length === 0) {
    console.error('\n❌ No valid URLs found in file');
    process.exit(1);
  }

  log(`Found ${urls.length} URLs to scrape\n`);

  // Process statistics
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let noChefCount = 0;

  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    log(`\n${'='.repeat(70)}`);
    log(`Processing URL ${i + 1}/${urls.length}: ${url}`);
    log(`${'='.repeat(70)}`);

    try {
      // Find matching chef
      const chef = await findChefByUrl(url);

      if (!chef) {
        noChefCount++;
        log(`   ⊘ Skipped: No matching chef found`);
        continue;
      }

      // Scrape recipe
      const recipe = await scrapeRecipeUrl(url, chef.name);

      if (!recipe) {
        failCount++;
        log(`   ✗ Scraping failed`);
        await sleep(CONFIG.FIRECRAWL_RATE_LIMIT_MS);
        continue;
      }

      // Insert into database
      const recipeId = await insertRecipe(recipe, chef);

      if (recipeId === null) {
        skipCount++;
        log(`   ⊘ Skipped: Duplicate detected`);
      } else {
        successCount++;
        log(`   ✓ Success: Recipe ID ${recipeId}`);
      }

      // Rate limiting
      await sleep(CONFIG.FIRECRAWL_RATE_LIMIT_MS);

    } catch (error: any) {
      failCount++;
      log(`   ❌ Error: ${error.message}`);
    }
  }

  // Final summary
  log('\n' + '='.repeat(70));
  log('FINAL SUMMARY');
  log('='.repeat(70));
  log(`Total URLs: ${urls.length}`);
  log(`✓ Successfully scraped: ${successCount}`);
  log(`⊘ Skipped (duplicates): ${skipCount}`);
  log(`⊘ No matching chef: ${noChefCount}`);
  log(`✗ Failed: ${failCount}`);
  log('='.repeat(70));

  // Save logs
  await saveLogs();
  log(`\n📄 Logs saved to: ${CONFIG.LOG_FILE}`);

  if (!CONFIG.APPLY_CHANGES) {
    log('\n⊛ DRY RUN COMPLETE - No changes made to database');
    log('   Run with APPLY_CHANGES=true to insert recipes');
  }
}

// Run main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
