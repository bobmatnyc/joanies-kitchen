#!/usr/bin/env tsx
/**
 * Scrape Curated Chef Recipes
 *
 * Direct scraping from hand-picked recipe URLs for high-priority chefs.
 * Bypasses SerpAPI and uses known high-quality recipe pages.
 *
 * Usage:
 *   pnpm tsx scripts/scrape-curated-chef-recipes.ts              # Dry run
 *   APPLY_CHANGES=true pnpm tsx scripts/scrape-curated-chef-recipes.ts  # Live run
 */

import { config } from 'dotenv';
import { resolve } from 'path';

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
};

// Curated recipe URLs for each chef (researched by Research agent)
const CURATED_URLS: Record<string, string[]> = {
  'dan-barber': [
    'https://blog.williams-sonoma.com/5-new-recipes-from-chef-dan-barber/',
    'https://blog.williams-sonoma.com/from-the-source-blue-hill-farm/',
    'https://blog.williams-sonoma.com/dan-barber-on-grains/',
  ],
  'rene-redzepi': [
    'https://www.theguardian.com/lifeandstyle/2011/sep/16/rene-redzepi-masterclass-recipes',
    'https://www.tastingtable.com/685666/rene-redzepis-danish-cold-buttermilk-soup-recipe/',
  ],
  'skye-gyngell': [
    'https://springrestaurant.co.uk/scroll/skye-gyngell-fresh-pasta/',
    'https://springrestaurant.co.uk/scroll/monthly-recipeskye-gyngells-summer-pudding/',
    'https://springrestaurant.co.uk/scroll/skye-christmas-pudding/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-skye-gyngells-bergamot-cedro-marmalade/',
    'https://springrestaurant.co.uk/scroll/monthly-recipeskye-gyngells-grilled-langoustine-with-seaweed-butter/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-skye-gyngells-iced-summer-fruits-with-rose-scented-geranium-syrup/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-skye-gyngells-grenadine/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-nectarine-sorbet/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-vanilla-pots-de-creme-with-strawberries-and-espresso-caramel/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-asparagus-fonduta/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-beef-carpaccio/',
    'https://springrestaurant.co.uk/scroll/monthly-recipe-wild-nettle-risotto/',
    'https://www.greatbritishchefs.com/recipes/monkfish-chard-beans-recipe',
    'https://www.greatbritishchefs.com/recipes/yoghurt-grapefruit-panna-cotta-recipe',
    'https://www.greatbritishchefs.com/recipes/parsnip-soup-collard-greens-recipe',
  ],
  'bren-smith': [
    'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles',
    'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6',
    'https://www.greenwave.org/recipes-1/bbq-kelp-carrots',
  ],
  'cristina-scarpaleggia': [
    'https://julskitchen.substack.com/p/tuscan-bean-soup-with-pasta-mista',
  ],
  'jeremy-fox': [
    'https://www.lamag.com/digestblog/jeremy-fox-recipe/',
    'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/',
  ],
  'massimo-bottura': [
    'https://www.masterclass.com/articles/how-to-reduce-food-waste-with-chef-massimo-bottura',
  ],
  'tamar-adler': [
    'https://www.tamareadler.com/2011/10/18/how-to-boil-water/',
    'https://www.tamareadler.com/2011/09/30/pantry-basics/',
  ],
  'alton-brown': [
    'https://www.foodnetwork.com/recipes/alton-brown/good-eats-meat-loaf-recipe-1937673',
    'https://www.foodnetwork.com/recipes/alton-brown/crepes-recipe-1911037',
    'https://www.foodnetwork.com/recipes/alton-brown/french-toast-recipe-1942216',
    'https://www.foodnetwork.com/recipes/alton-brown/the-once-and-future-beans-recipe-1938616',
    'https://www.foodnetwork.com/recipes/alton-brown/stovetop-mac-n-cheese-recipe-1939465',
    'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
    'https://www.foodnetwork.com/recipes/alton-brown/cranberry-sauce-recipe2-1944111',
    'https://www.foodnetwork.com/recipes/alton-brown/royal-icing-recipe-1941917',
    'https://www.foodnetwork.com/recipes/alton-brown/omelet-recipe-1914282.html',
    'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/',
  ],
  'bryant-terry': [
    'https://food52.com/story/25044-best-vegetable-kingdom-bryant-terry-cookbook-recipes',
    'https://www.ebony.com/bryant-terrys-afro-vegan-recipes-403/',
    'https://www.lionsroar.com/dig-into-3-recipes-from-vegan-chef-bryant-terry/',
  ],
  'david-zilber': [],  // No direct recipe URLs found - cookbook focused
  'ina-garten': [
    'https://barefootcontessa.com/recipes/perfect-roast-chicken',
    'https://barefootcontessa.com/recipes/fresh-blueberry-pie',
    'https://barefootcontessa.com/recipes/charlie-birds-farro-salad',
    'https://barefootcontessa.com/recipes/grilled-new-york-strip-steaks',
    'https://www.foodnetwork.com/recipes/ina-garten/engagement-roast-chicken-recipe-1948980',
    'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
    'https://www.foodnetwork.com/recipes/ina-garten/beef-bourguignon-recipe-1942045',
    'https://www.foodnetwork.com/recipes/ina-garten/lemon-yogurt-cake-recipe-1947092',
    'https://www.foodnetwork.com/recipes/ina-garten/garlic-roast-chicken-recipe-1943498',
  ],
  'kirsten-christopher-shockey': [],  // No direct recipe URLs found - cookbook focused
  'nik-sharma': [
    'https://niksharmacooks.com/butter-chicken/',
    'https://niksharmacooks.com/goan-style-meat-patties-coconut-curry/',
    'https://niksharmacooks.com/madras-beef-curry/',
    'https://food52.com/recipes/90047-turmeric-roast-chicken-with-coconut-rice',
  ],
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeRecipeFromUrl(url: string, chefName: string): Promise<any | null> {
  console.log(`\n📄 Scraping: ${url}`);

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

    console.log(`   ✓ Scraped: ${recipeData.title}`);
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
    console.error(`   ✗ Failed: ${error.message}`);
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
    console.log(`   ⊛ DRY RUN: Would insert "${recipe.title}"`);
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
      console.log(`   ⊘ Duplicate URL - skipping`);
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

    console.log(`   ✓ Inserted: ${newRecipe.id}`);
    return newRecipe.id;

  } catch (error: any) {
    console.error(`   ✗ Insert failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('CURATED CHEF RECIPE SCRAPING');
  console.log('='.repeat(80));
  console.log(`Mode: ${CONFIG.APPLY_CHANGES ? '🔴 LIVE' : '⊛ DRY RUN'}`);
  console.log('='.repeat(80));

  if (!CONFIG.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found');
    process.exit(1);
  }

  console.log('✓ Firecrawl API key validated\n');

  let totalScraped = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [chefSlug, urls] of Object.entries(CURATED_URLS)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📚 Processing: ${chefSlug} (${urls.length} recipes)`);
    console.log('='.repeat(80));

    // Get chef from database
    const [chef] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, chefSlug))
      .limit(1);

    if (!chef) {
      console.error(`❌ Chef not found: ${chefSlug}`);
      continue;
    }

    console.log(`Chef: ${chef.name}`);
    console.log(`Current recipe count: ${chef.recipe_count || 0}`);

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

    console.log(`\n📊 Chef Summary:`);
    console.log(`   ✓ Success: ${chefSuccess}`);
    console.log(`   ⊘ Skipped: ${chefSkipped}`);
    console.log(`   ✗ Failed: ${chefFailed}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Chefs processed: ${Object.keys(CURATED_URLS).length}`);
  console.log(`✓ Successfully scraped: ${totalScraped}`);
  console.log(`⊘ Skipped (duplicates): ${totalSkipped}`);
  console.log(`✗ Failed: ${totalFailed}`);
  console.log('='.repeat(80));

  if (!CONFIG.APPLY_CHANGES) {
    console.log('\n⊛ DRY RUN COMPLETE');
    console.log('   Run with APPLY_CHANGES=true to insert recipes');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
