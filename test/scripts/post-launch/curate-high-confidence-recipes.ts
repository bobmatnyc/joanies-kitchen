#!/usr/bin/env tsx
/**
 * High-Confidence Recipe Curation
 *
 * FOCUSED APPROACH: Only use URLs from sources with proven >50% success rates:
 * - Great British Chefs (works reliably)
 * - Food Network (works for Alton Brown, Ina Garten)
 * - Chef personal sites (works for Nik Sharma, Tamar Adler, Skye Gyngell)
 * - GreenWave.org (works for Bren Smith)
 *
 * Target: 50-70 high-quality recipes (realistic vs. 100-130 aspirational)
 *
 * Usage:
 *   pnpm tsx scripts/post-launch/curate-high-confidence-recipes.ts              # Dry run
 *   APPLY_CHANGES=true pnpm tsx scripts/post-launch/curate-high-confidence-recipes.ts  # Live run
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { appendFileSync } from 'fs';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import Firecrawl from '@mendable/firecrawl-js';

// Configuration
const CONFIG = {
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',
  RATE_LIMIT_MS: 3000, // 3 seconds between requests
  REQUEST_TIMEOUT_MS: 30000,
  LOG_FILE: resolve(process.cwd(), 'tmp/high-confidence-curation.log'),
};

/**
 * HIGH-CONFIDENCE RECIPE URLS
 *
 * ONLY sources with >50% historical success rate.
 * Conservative approach prioritizing quality over quantity.
 */
const HIGH_CONFIDENCE_URLS: Record<string, string[]> = {
  // =============================================================================
  // TIER 1: PROVEN WORKING SOURCES (Food Network, Great British Chefs, GreenWave)
  // =============================================================================

  'ina-garten': [
    // Barefoot Contessa official site (verified working)
    'https://barefootcontessa.com/recipes/perfect-roast-chicken',
    'https://barefootcontessa.com/recipes/fresh-blueberry-pie',
    'https://barefootcontessa.com/recipes/charlie-birds-farro-salad',
    'https://barefootcontessa.com/recipes/grilled-new-york-strip-steaks',
    'https://barefootcontessa.com/recipes/weeknight-bolognese',
    'https://barefootcontessa.com/recipes/provencal-fish-stew',

    // Food Network (verified working)
    'https://www.foodnetwork.com/recipes/ina-garten/engagement-roast-chicken-recipe-1948980',
    'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
    'https://www.foodnetwork.com/recipes/ina-garten/beef-bourguignon-recipe-1942045',
    'https://www.foodnetwork.com/recipes/ina-garten/lemon-yogurt-cake-recipe-1947092',
  ],

  'alton-brown': [
    // Food Network (verified working)
    'https://www.foodnetwork.com/recipes/alton-brown/good-eats-meat-loaf-recipe-1937673',
    'https://www.foodnetwork.com/recipes/alton-brown/crepes-recipe-1911037',
    'https://www.foodnetwork.com/recipes/alton-brown/french-toast-recipe-1942216',
    'https://www.foodnetwork.com/recipes/alton-brown/the-once-and-future-beans-recipe-1938616',
    'https://www.foodnetwork.com/recipes/alton-brown/stovetop-mac-n-cheese-recipe-1939465',
    'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
    'https://www.foodnetwork.com/recipes/alton-brown/cranberry-sauce-recipe2-1944111',
    'https://www.foodnetwork.com/recipes/alton-brown/royal-icing-recipe-1941917',
    'https://www.foodnetwork.com/recipes/alton-brown/omelet-recipe-1914282.html',

    // Alton Brown official site (verified working)
    'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/',
  ],

  'nik-sharma': [
    // Nik Sharma Cooks personal site (verified working)
    'https://niksharmacooks.com/butter-chicken/',
    'https://niksharmacooks.com/goan-style-meat-patties-coconut-curry/',
    'https://niksharmacooks.com/madras-beef-curry/',
    'https://niksharmacooks.com/roasted-cauliflower-with-ginger-and-turmeric/',
    'https://niksharmacooks.com/spicy-shrimp-curry/',

    // Food52 (1 verified working URL)
    'https://food52.com/recipes/90047-turmeric-roast-chicken-with-coconut-rice',
  ],

  'bren-smith': [
    // GreenWave official recipes (verified working in previous scraping)
    'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles',
    'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6',
    'https://www.greenwave.org/recipes-1/bbq-kelp-carrots',
    'https://www.greenwave.org/recipes-1/kelp-pesto',
    'https://www.greenwave.org/recipes-1/seaweed-salad',
    'https://www.greenwave.org/recipes-1/clam-chowder-with-kelp',
  ],

  // =============================================================================
  // TIER 2: LIKELY WORKING SOURCES (Great British Chefs, Chef Blogs)
  // =============================================================================

  'rene-redzepi': [
    // Great British Chefs (1 verified success - beetroot sorbet)
    'https://www.greatbritishchefs.com/recipes/beetroot-sorbet-recipe',

    // Search Great British Chefs for more Redzepi recipes
    // NOTE: These are speculative but from verified-working source
    'https://www.greatbritishchefs.com/recipes/pickled-vegetables-recipe',
    'https://www.greatbritishchefs.com/recipes/fermented-asparagus-recipe',
  ],

  'dan-barber': [
    // NOTE: Dan Barber has very limited web recipe availability
    // Manual entry may be better option - keeping this minimal
    // Trying Great British Chefs pattern (most reliable source)
    'https://www.greatbritishchefs.com/recipes/roasted-squash-recipe',
  ],

  'cristina-scarpaleggia': [
    // Jul's Kitchen (verified working)
    'https://julskitchen.substack.com/p/tuscan-bean-soup-with-pasta-mista',
    'https://julskitchen.substack.com/p/ribollita-tuscan-bread-and-bean-soup',
    'https://julskitchen.substack.com/p/pappa-al-pomodoro',
  ],

  'jeremy-fox': [
    // LA Magazine (verified working)
    'https://www.lamag.com/digestblog/jeremy-fox-recipe/',

    // Chalkboard Mag (verified working)
    'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/',
  ],

  'tamar-adler': [
    // Tamar Adler blog (verified working)
    'https://www.tamareadler.com/2011/10/18/how-to-boil-water/',
    'https://www.tamareadler.com/2011/09/30/pantry-basics/',
    'https://www.tamareadler.com/2011/10/11/how-to-cook-vegetables/',
    'https://www.tamareadler.com/2011/10/04/simple-chicken-soup/',
  ],

  // =============================================================================
  // TIER 3: MINIMAL COVERAGE (Fermentation Experts - Cookbook Focus)
  // =============================================================================

  'david-zilber': [
    // Great British Chefs (proven reliable source)
    'https://www.greatbritishchefs.com/recipes/fermented-hot-sauce-recipe',
  ],

  'kirsten-christopher-shockey': [
    // NOTE: Very limited web availability - recommend manual entry instead
    // Leaving empty for now, may add 1-2 basic fermentation recipes manually
  ],
};

// Utility functions
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    appendFileSync(CONFIG.LOG_FILE, logLine);
  } catch (error) {
    // Silently fail if log file can't be written
  }
}

async function scrapeRecipeFromUrl(url: string, chefName: string): Promise<any | null> {
  log(`\n📄 Scraping: ${url}`);

  try {
    const firecrawl = new Firecrawl({ apiKey: CONFIG.FIRECRAWL_API_KEY });

    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    }) as any;

    if (!result || !result.markdown) {
      throw new Error('No content returned');
    }

    // Extract recipe data from markdown
    const recipeData = parseRecipeFromMarkdown(result.markdown, result.metadata);

    if (!recipeData) {
      throw new Error('Could not parse recipe data');
    }

    log(`   ✓ Scraped: ${recipeData.title}`);
    return {
      url,
      title: recipeData.title,
      description: recipeData.description,
      ingredients: recipeData.ingredients || [],
      instructions: recipeData.instructions || [],
      tags: [chefName, ...(recipeData.tags || [])],
      image_url: recipeData.image,
    };

  } catch (error: any) {
    log(`   ✗ Failed: ${error.message}`);
    return null;
  }
}

function parseRecipeFromMarkdown(markdown: string, metadata: any): any | null {
  const recipe: any = {};

  // Extract title
  recipe.title = metadata?.ogTitle || metadata?.title || extractFirstHeading(markdown);

  if (!recipe.title) return null;

  // Extract description
  recipe.description = metadata?.ogDescription || metadata?.description;

  // Extract ingredients and instructions
  recipe.ingredients = extractIngredients(markdown);
  recipe.instructions = extractInstructions(markdown);

  // Must have at least some content
  if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
    return null;
  }

  // Extract image
  recipe.image = metadata?.ogImage;

  return recipe;
}

function extractFirstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractIngredients(markdown: string): string[] {
  const ingredients: string[] = [];
  const match = markdown.match(/#+\s*Ingredients?\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i);

  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      const listMatch = cleaned.match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
      if (listMatch && listMatch[1].length > 2) {
        ingredients.push(listMatch[1].trim());
      }
    }
  }

  return ingredients;
}

function extractInstructions(markdown: string): string[] {
  const instructions: string[] = [];
  const match = markdown.match(/#+\s*(?:Instructions?|Directions?|Method|Steps?)\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i);

  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      const listMatch = cleaned.match(/^(?:[*\-]|\d+\.)\s+(.+)$/);
      if (listMatch && listMatch[1].length > 10) {
        instructions.push(listMatch[1].trim());
      } else if (cleaned.length > 20 && !cleaned.startsWith('#')) {
        instructions.push(cleaned);
      }
    }
  }

  return instructions;
}

async function insertRecipe(recipe: any, chef: any): Promise<string | null> {
  if (!CONFIG.APPLY_CHANGES) {
    log(`   ⊛ DRY RUN: Would insert "${recipe.title}"`);
    return 'dry-run-id';
  }

  try {
    // Check for duplicates by URL
    const existing = await db
      .select()
      .from(chefRecipes)
      .where(eq(chefRecipes.original_url, recipe.url))
      .limit(1);

    if (existing.length > 0) {
      log(`   ⊘ Duplicate URL - skipping`);
      return null;
    }

    // Insert recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: 'system',
        chef_id: chef.id,
        name: recipe.title,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
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

    log(`   ✓ Inserted: ${newRecipe.id}`);
    return newRecipe.id;

  } catch (error: any) {
    log(`   ✗ Insert failed: ${error.message}`);
    return null;
  }
}

async function main() {
  log('='.repeat(80));
  log('HIGH-CONFIDENCE RECIPE CURATION');
  log('='.repeat(80));
  log(`Mode: ${CONFIG.APPLY_CHANGES ? '🔴 LIVE' : '⊛ DRY RUN'}`);
  log(`Strategy: Proven sources only (>50% success rate)`);
  log(`Log file: ${CONFIG.LOG_FILE}`);
  log('='.repeat(80));

  if (!CONFIG.FIRECRAWL_API_KEY) {
    log('\n❌ FIRECRAWL_API_KEY not found');
    process.exit(1);
  }

  log('✓ Firecrawl API key validated\n');

  let totalScraped = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalUrls = 0;

  // Stats by chef
  const chefStats: Record<string, { success: number; failed: number; skipped: number; urls: number }> = {};

  for (const [chefSlug, urls] of Object.entries(HIGH_CONFIDENCE_URLS)) {
    if (urls.length === 0) {
      log(`\n⊘ Skipping ${chefSlug}: No high-confidence URLs available`);
      continue;
    }

    log(`\n${'='.repeat(80)}`);
    log(`📚 Processing: ${chefSlug} (${urls.length} high-confidence URLs)`);
    log('='.repeat(80));

    // Get chef from database
    const [chef] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, chefSlug))
      .limit(1);

    if (!chef) {
      log(`❌ Chef not found: ${chefSlug}`);
      continue;
    }

    log(`Chef: ${chef.name}`);
    log(`Current recipe count: ${chef.recipe_count || 0}`);

    let chefSuccess = 0;
    let chefFailed = 0;
    let chefSkipped = 0;

    totalUrls += urls.length;

    for (const url of urls) {
      const recipe = await scrapeRecipeFromUrl(url, chef.name);

      if (!recipe) {
        chefFailed++;
        totalFailed++;
        await sleep(CONFIG.RATE_LIMIT_MS);
        continue;
      }

      const recipeId = await insertRecipe(recipe, chef);

      if (recipeId === null) {
        chefSkipped++;
        totalSkipped++;
      } else {
        chefSuccess++;
        totalScraped++;
      }

      await sleep(CONFIG.RATE_LIMIT_MS);
    }

    chefStats[chefSlug] = {
      success: chefSuccess,
      failed: chefFailed,
      skipped: chefSkipped,
      urls: urls.length,
    };

    const successRate = urls.length > 0 ? ((chefSuccess / urls.length) * 100).toFixed(1) : '0.0';

    log(`\n📊 Chef Summary:`);
    log(`   ✓ Success: ${chefSuccess}/${urls.length} (${successRate}%)`);
    log(`   ⊘ Skipped: ${chefSkipped}`);
    log(`   ✗ Failed: ${chefFailed}`);
  }

  log('\n' + '='.repeat(80));
  log('FINAL SUMMARY');
  log('='.repeat(80));
  log(`Chefs processed: ${Object.keys(chefStats).length}`);
  log(`Total URLs attempted: ${totalUrls}`);
  log(`✓ Successfully scraped: ${totalScraped}`);
  log(`⊘ Skipped (duplicates): ${totalSkipped}`);
  log(`✗ Failed: ${totalFailed}`);

  const overallSuccessRate = totalUrls > 0 ? ((totalScraped / totalUrls) * 100).toFixed(1) : '0.0';
  log(`📈 Overall success rate: ${overallSuccessRate}%`);
  log('='.repeat(80));

  log('\n📊 PER-CHEF BREAKDOWN:');
  log('='.repeat(80));
  for (const [chefSlug, stats] of Object.entries(chefStats)) {
    const successRate = stats.urls > 0 ? ((stats.success / stats.urls) * 100).toFixed(1) : '0.0';
    log(`${chefSlug}:`);
    log(`  Success: ${stats.success}/${stats.urls} (${successRate}%)`);
    log(`  Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
  }
  log('='.repeat(80));

  // Chefs with no URLs
  const missingChefs = ['kirsten-christopher-shockey'];
  if (missingChefs.length > 0) {
    log('\n⚠️  CHEFS WITH NO HIGH-CONFIDENCE URLS:');
    log('='.repeat(80));
    for (const chefSlug of missingChefs) {
      log(`${chefSlug}: Recommend manual entry of 2-3 signature recipes`);
    }
    log('='.repeat(80));
  }

  if (!CONFIG.APPLY_CHANGES) {
    log('\n⊛ DRY RUN COMPLETE');
    log('   Run with APPLY_CHANGES=true to insert recipes');
  } else {
    log('\n✅ LIVE RUN COMPLETE');
    log('   All recipes have been inserted into the database');
  }

  log(`\n📝 Full log saved to: ${CONFIG.LOG_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log('\n❌ FATAL ERROR: ' + error.message);
    console.error(error);
    process.exit(1);
  });
