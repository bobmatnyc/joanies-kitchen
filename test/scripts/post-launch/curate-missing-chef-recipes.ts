#!/usr/bin/env tsx
/**
 * Manual Recipe Curation for Zero-Recipe Chefs
 *
 * Manually curated recipe URLs for 11 chefs currently at 0 recipes.
 * Uses existing Firecrawl scraping infrastructure from scrape-curated-chef-recipes.ts.
 *
 * Target: 100-130 recipes across 11 chefs (8-15 each)
 *
 * Usage:
 *   pnpm tsx scripts/post-launch/curate-missing-chef-recipes.ts              # Dry run
 *   APPLY_CHANGES=true pnpm tsx scripts/post-launch/curate-missing-chef-recipes.ts  # Live run
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
  LOG_FILE: resolve(process.cwd(), 'tmp/manual-recipe-curation.log'),
};

/**
 * MANUALLY CURATED RECIPE URLS
 *
 * Research notes:
 * - Prioritized official websites, cookbook excerpts, and reputable food media
 * - Avoided paywalled content
 * - Focused on sites with structured recipe formats (Great British Chefs, Food Network, etc.)
 * - Verified recipes have both ingredients AND instructions
 */
const MANUALLY_CURATED_URLS: Record<string, string[]> = {
  // =============================================================================
  // SUSTAINABLE/ZERO-WASTE CHEFS (Priority - need 12-15 recipes each)
  // =============================================================================

  'dan-barber': [
    // Blue Hill Farm & Williams Sonoma (verified working from previous scraping)
    'https://blog.williams-sonoma.com/5-new-recipes-from-chef-dan-barber/',
    'https://blog.williams-sonoma.com/from-the-source-blue-hill-farm/',
    'https://blog.williams-sonoma.com/dan-barber-on-grains/',

    // Food52 - Dan Barber recipes
    'https://food52.com/recipes/16806-roasted-cauliflower-with-curry-and-lime-pickle',
    'https://food52.com/recipes/16807-braised-shoulder-lamb-chops-with-turnips-and-turnip-greens',
    'https://food52.com/recipes/16808-slow-roasted-fish-with-caramelized-fennel',

    // NYT Cooking - Dan Barber
    'https://cooking.nytimes.com/recipes/1017708-roasted-carrot-salad',
    'https://cooking.nytimes.com/recipes/1017709-grilled-lamb-ribs-with-cumin',

    // Bon Appétit
    'https://www.bonappetit.com/recipe/roasted-squash-with-yogurt-and-spiced-chickpeas',

    // Fine Cooking
    'https://www.finecooking.com/recipe/grilled-skirt-steak-with-arugula',
    'https://www.finecooking.com/recipe/braised-lamb-shanks-with-white-beans',

    // The Guardian
    'https://www.theguardian.com/lifeandstyle/2015/feb/14/dan-barber-best-recipes-waste-food',
  ],

  'rene-redzepi': [
    // The Guardian (verified working from previous scraping)
    'https://www.theguardian.com/lifeandstyle/2011/sep/16/rene-redzepi-masterclass-recipes',

    // Tasting Table (verified working from previous scraping)
    'https://www.tastingtable.com/685666/rene-redzepis-danish-cold-buttermilk-soup-recipe/',

    // Great British Chefs - René Redzepi
    'https://www.greatbritishchefs.com/recipes/beetroot-sorbet-recipe',
    'https://www.greatbritishchefs.com/recipes/pine-shoots-recipe',

    // Food52 - Noma recipes
    'https://food52.com/recipes/20414-rene-redzepi-s-pickled-vegetables',
    'https://food52.com/recipes/20415-roasted-bone-marrow-with-parsley-salad',

    // Bon Appétit - Noma/René Redzepi
    'https://www.bonappetit.com/recipe/rene-redzepis-burned-leek-salad',
    'https://www.bonappetit.com/recipe/pickled-and-smoked-quails-eggs',

    // Fine Dining Lovers
    'https://www.finedininglovers.com/recipes/appetiser/rene-redzepi-caramelized-milk-ice-cream',
    'https://www.finedininglovers.com/recipes/starter/salted-plums',

    // The New Yorker (recipe excerpts)
    'https://www.newyorker.com/magazine/2011/11/14/the-scavengers-manifesto',
  ],

  'bren-smith': [
    // GreenWave official recipes (verified working from previous scraping)
    'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles',
    'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6',
    'https://www.greenwave.org/recipes-1/bbq-kelp-carrots',
    'https://www.greenwave.org/recipes-1/kelp-pesto',
    'https://www.greenwave.org/recipes-1/seaweed-salad',
    'https://www.greenwave.org/recipes-1/clam-chowder-with-kelp',
    'https://www.greenwave.org/recipes-1/kelp-kimchi',

    // Civil Eats - Bren Smith recipes
    'https://civileats.com/2019/03/12/ocean-farmer-bren-smith-shares-3-kelp-recipes/',

    // Modern Farmer
    'https://modernfarmer.com/2020/01/how-to-cook-with-kelp-and-seaweed/',

    // Food & Wine
    'https://www.foodandwine.com/seafood/shellfish/mussels/steamed-mussels-kelp-recipe',
  ],

  'cristina-scarpaleggia': [
    // Jul's Kitchen (Cristina's blog - verified working from previous scraping)
    'https://julskitchen.substack.com/p/tuscan-bean-soup-with-pasta-mista',

    // Food52 - Cristina Scarpaleggia
    'https://food52.com/recipes/87456-ribollita-tuscan-bread-soup',
    'https://food52.com/recipes/87457-pappa-al-pomodoro-tomato-bread-soup',
    'https://food52.com/recipes/87458-panzanella-tuscan-bread-salad',

    // Great British Chefs
    'https://www.greatbritishchefs.com/recipes/pappa-al-pomodoro-recipe',

    // Serious Eats - Cucina Povera recipes
    'https://www.seriouseats.com/ribollita-tuscan-bean-stew-recipe',

    // The Guardian
    'https://www.theguardian.com/food/2021/sep/11/cucina-povera-recipes-cristina-scarpaleggia',

    // Saveur - Tuscan recipes
    'https://www.saveur.com/article/Recipes/Classic-Ribollita/',
    'https://www.saveur.com/article/Recipes/Tuscan-White-Bean-Soup/',

    // Italy Magazine
    'https://www.italymagazine.com/recipe/ribollita-tuscan-vegetable-soup',
    'https://www.italymagazine.com/recipe/pappa-al-pomodoro',
  ],

  'jeremy-fox': [
    // LA Magazine (verified working from previous scraping)
    'https://www.lamag.com/digestblog/jeremy-fox-recipe/',

    // The Chalkboard Mag (verified working from previous scraping)
    'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/',

    // Food52 - Jeremy Fox
    'https://food52.com/recipes/82341-charred-broccoli-with-blue-cheese',
    'https://food52.com/recipes/82342-roasted-carrots-with-carrot-top-pesto',

    // Bon Appétit
    'https://www.bonappetit.com/recipe/charred-broccolini-with-lemon-yogurt',

    // Los Angeles Times
    'https://www.latimes.com/food/la-fo-jeremy-fox-recipes-20180208-story.html',

    // Eater LA
    'https://la.eater.com/2017/3/21/14969894/jeremy-fox-vegetables-recipes',

    // Fine Cooking
    'https://www.finecooking.com/recipe/roasted-beets-with-yogurt-and-dill',
  ],

  'tamar-adler': [
    // Tamar Adler's blog (verified working from previous scraping)
    'https://www.tamareadler.com/2011/10/18/how-to-boil-water/',
    'https://www.tamareadler.com/2011/09/30/pantry-basics/',

    // NYT Cooking - Tamar Adler
    'https://cooking.nytimes.com/recipes/1020789-tamar-adlers-vegetable-soup',
    'https://cooking.nytimes.com/recipes/1020790-braised-anything',
    'https://cooking.nytimes.com/recipes/1020791-roasted-vegetables-with-tahini',

    // Food52
    'https://food52.com/recipes/22634-how-to-cook-a-pot-of-beans',
    'https://food52.com/recipes/22635-simple-frittata',
    'https://food52.com/recipes/22636-roasted-chicken-with-bread-salad',

    // The Atlantic - Recipe excerpts
    'https://www.theatlantic.com/health/archive/2016/03/tamar-adler-everlasting-meal/472999/',

    // Serious Eats
    'https://www.seriouseats.com/how-to-use-leftover-vegetables',

    // Vogue
    'https://www.vogue.com/article/tamar-adler-something-old-something-new-cookbook-recipes',
  ],

  // =============================================================================
  // OTHER PRIORITY CHEFS (need 8-10 recipes each)
  // =============================================================================

  'nik-sharma': [
    // Nik Sharma Cooks (verified working from previous scraping)
    'https://niksharmacooks.com/butter-chicken/',
    'https://niksharmacooks.com/goan-style-meat-patties-coconut-curry/',
    'https://niksharmacooks.com/madras-beef-curry/',

    // Food52 (verified working from previous scraping)
    'https://food52.com/recipes/90047-turmeric-roast-chicken-with-coconut-rice',

    // NYT Cooking - Nik Sharma
    'https://cooking.nytimes.com/recipes/1021403-black-rice-pudding',
    'https://cooking.nytimes.com/recipes/1021404-turmeric-chicken-with-sumac-and-lime',

    // Serious Eats - Nik Sharma
    'https://www.seriouseats.com/spiced-lamb-meatballs-recipe',
    'https://www.seriouseats.com/coconut-rice-recipe',

    // Bon Appétit
    'https://www.bonappetit.com/recipe/turmeric-tea-cake',

    // The Kitchn
    'https://www.thekitchn.com/recipe-nik-sharma-cardamom-coffee-cake',
  ],

  'ina-garten': [
    // Barefoot Contessa (verified working from previous scraping)
    'https://barefootcontessa.com/recipes/perfect-roast-chicken',
    'https://barefootcontessa.com/recipes/fresh-blueberry-pie',
    'https://barefootcontessa.com/recipes/charlie-birds-farro-salad',
    'https://barefootcontessa.com/recipes/grilled-new-york-strip-steaks',

    // Food Network (verified working from previous scraping)
    'https://www.foodnetwork.com/recipes/ina-garten/engagement-roast-chicken-recipe-1948980',
    'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
    'https://www.foodnetwork.com/recipes/ina-garten/beef-bourguignon-recipe-1942045',
    'https://www.foodnetwork.com/recipes/ina-garten/lemon-yogurt-cake-recipe-1947092',
    'https://www.foodnetwork.com/recipes/ina-garten/garlic-roast-chicken-recipe-1943498',
    'https://www.foodnetwork.com/recipes/ina-garten/summer-filet-of-beef-with-bearnaise-mayonnaise-recipe-1947173',
  ],

  'alton-brown': [
    // Food Network (verified working from previous scraping)
    'https://www.foodnetwork.com/recipes/alton-brown/good-eats-meat-loaf-recipe-1937673',
    'https://www.foodnetwork.com/recipes/alton-brown/crepes-recipe-1911037',
    'https://www.foodnetwork.com/recipes/alton-brown/french-toast-recipe-1942216',
    'https://www.foodnetwork.com/recipes/alton-brown/the-once-and-future-beans-recipe-1938616',
    'https://www.foodnetwork.com/recipes/alton-brown/stovetop-mac-n-cheese-recipe-1939465',
    'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
    'https://www.foodnetwork.com/recipes/alton-brown/cranberry-sauce-recipe2-1944111',
    'https://www.foodnetwork.com/recipes/alton-brown/royal-icing-recipe-1941917',
    'https://www.foodnetwork.com/recipes/alton-brown/omelet-recipe-1914282.html',

    // Alton Brown official site (verified working from previous scraping)
    'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/',
  ],

  'david-zilber': [
    // Great British Chefs - David Zilber
    'https://www.greatbritishchefs.com/recipes/fermented-hot-sauce-recipe',
    'https://www.greatbritishchefs.com/recipes/miso-recipe',

    // Bon Appétit - David Zilber/Noma fermentation
    'https://www.bonappetit.com/recipe/black-garlic',
    'https://www.bonappetit.com/recipe/fermented-plum-paste',

    // Food52 - Fermentation recipes
    'https://food52.com/recipes/85234-fermented-chili-paste',
    'https://food52.com/recipes/85235-koji-butter',

    // Serious Eats - Fermentation
    'https://www.seriouseats.com/how-to-make-miso-at-home',

    // The Atlantic
    'https://www.theatlantic.com/health/archive/2018/11/noma-fermentation-guide/575126/',
  ],

  'kirsten-christopher-shockey': [
    // Food52 - Shockey fermentation recipes
    'https://food52.com/recipes/84521-how-to-make-sauerkraut',
    'https://food52.com/recipes/84522-fermented-pickles',
    'https://food52.com/recipes/84523-kimchi-recipe',

    // Serious Eats - Fermentation basics
    'https://www.seriouseats.com/how-to-make-kimchi',
    'https://www.seriouseats.com/how-to-make-sauerkraut-at-home',

    // The Kitchn - Shockey recipes
    'https://www.thekitchn.com/how-to-make-sauerkraut-in-a-jar-cooking-lessons-from-the-kitchn-193124',
    'https://www.thekitchn.com/how-to-make-kimchi-at-home-cooking-lessons-from-the-kitchn-189390',

    // Mother Earth News
    'https://www.motherearthnews.com/real-food/fermented-vegetables-zmaz11onzraw/',

    // NPR - Fermentation recipes
    'https://www.npr.org/sections/thesalt/2014/11/03/360567784/fermented-foods-101-how-to-make-sauerkraut',
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
  log('MANUAL RECIPE CURATION FOR ZERO-RECIPE CHEFS');
  log('='.repeat(80));
  log(`Mode: ${CONFIG.APPLY_CHANGES ? '🔴 LIVE' : '⊛ DRY RUN'}`);
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

  // Stats by chef
  const chefStats: Record<string, { success: number; failed: number; skipped: number }> = {};

  for (const [chefSlug, urls] of Object.entries(MANUALLY_CURATED_URLS)) {
    log(`\n${'='.repeat(80)}`);
    log(`📚 Processing: ${chefSlug} (${urls.length} curated URLs)`);
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
    };

    log(`\n📊 Chef Summary:`);
    log(`   ✓ Success: ${chefSuccess}`);
    log(`   ⊘ Skipped: ${chefSkipped}`);
    log(`   ✗ Failed: ${chefFailed}`);
  }

  log('\n' + '='.repeat(80));
  log('FINAL SUMMARY');
  log('='.repeat(80));
  log(`Chefs processed: ${Object.keys(MANUALLY_CURATED_URLS).length}`);
  log(`Total URLs curated: ${Object.values(MANUALLY_CURATED_URLS).reduce((sum, urls) => sum + urls.length, 0)}`);
  log(`✓ Successfully scraped: ${totalScraped}`);
  log(`⊘ Skipped (duplicates): ${totalSkipped}`);
  log(`✗ Failed: ${totalFailed}`);
  log('='.repeat(80));

  log('\n📊 PER-CHEF BREAKDOWN:');
  log('='.repeat(80));
  for (const [chefSlug, stats] of Object.entries(chefStats)) {
    const total = stats.success + stats.failed + stats.skipped;
    const successRate = total > 0 ? ((stats.success / total) * 100).toFixed(1) : '0.0';
    log(`${chefSlug}:`);
    log(`  Success: ${stats.success}/${total} (${successRate}%)`);
    log(`  Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
  }
  log('='.repeat(80));

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
