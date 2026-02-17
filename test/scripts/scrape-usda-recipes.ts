#!/usr/bin/env tsx

/**
 * USDA Recipe Scraper
 *
 * Scrapes recipes from USDA Team Nutrition
 * Source: https://www.fns.usda.gov/tn/recipes
 * License: PUBLIC_DOMAIN (U.S. Government work)
 *
 * Features:
 * - Uses Firecrawl API for structured data extraction
 * - Progress tracking with resume capability
 * - Rate limiting and error handling
 * - Pilot mode: Extract 10-20 recipes for validation
 * - Full mode: Extract up to 100 recipes
 *
 * Note: The original What's Cooking? USDA Mixing Bowl site was discontinued in 2019.
 * This script now targets the Team Nutrition recipe collection (80+ standardized recipes).
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import FirecrawlApp from '@mendable/firecrawl-js';
import { recipes, recipeSources } from '@/lib/db/schema';
import { ImportProgressTracker } from './lib/import-progress';
import { transformUSDARecipe, type USDARecipe } from './lib/recipe-transformers';

// Load environment variables
config({ path: '.env.local' });

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system';

// USDA source configuration
const USDA_BASE_URL = 'https://www.fns.usda.gov';
const USDA_RECIPES_URL = `${USDA_BASE_URL}/tn/recipes`;

// Rate limiting: 2 seconds between requests (respectful crawling)
const RATE_LIMIT_MS = 2000;

// Command line arguments
const args = process.argv.slice(2);
const isPilot = args.includes('--pilot');
const maxRecipes = isPilot ? 20 : (parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1] || '100'));

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract recipe URLs from USDA search results
 */
async function extractRecipeUrls(firecrawl: FirecrawlApp, maxUrls: number): Promise<string[]> {
  console.log('🔍 Discovering recipe URLs from USDA...\n');

  const recipeUrls: string[] = [];

  try {
    // Scrape the main recipes search page
    console.log(`  Scraping: ${USDA_RECIPES_URL}`);

    const scrapeResult = (await firecrawl.scrape(USDA_RECIPES_URL, {
      formats: ['markdown', 'links'],
      onlyMainContent: true,
    })) as any;

    // Firecrawl v4 returns data directly, not wrapped in success
    if (!scrapeResult.markdown && !scrapeResult.html) {
      throw new Error(`Failed to scrape USDA recipes page: ${JSON.stringify(scrapeResult).substring(0, 200)}`);
    }

    // Extract recipe links from the page
    // Note: Firecrawl v4 may not return links directly, we need to parse from HTML/markdown
    const markdown = scrapeResult.markdown || '';

    // Extract all URLs from markdown links format: [text](url)
    const linkMatches = markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    const links: string[] = [];

    for (const match of linkMatches) {
      links.push(match[2]);
    }

    for (const link of links) {
      // Filter for actual recipe URLs (they typically contain /recipes/ in the path)
      if (link.includes('/recipes/') && !link.includes('/search') && !recipeUrls.includes(link)) {
        // Ensure full URL
        const fullUrl = link.startsWith('http') ? link : `${USDA_BASE_URL}${link}`;
        recipeUrls.push(fullUrl);

        if (recipeUrls.length >= maxUrls) {
          break;
        }
      }
    }

    console.log(`  ✅ Found ${recipeUrls.length} recipe URLs\n`);

  } catch (error) {
    console.error('  ❌ Failed to extract recipe URLs:', error);
    throw error;
  }

  return recipeUrls;
}

/**
 * Scrape a single recipe from USDA
 */
async function scrapeUSDARecipe(firecrawl: FirecrawlApp, url: string): Promise<USDARecipe | null> {
  try {
    const scrapeResult = (await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    })) as any;

    if (!scrapeResult.markdown) {
      return null;
    }

    // Parse the markdown content to extract recipe data
    const markdown = scrapeResult.markdown;

    // Extract recipe name (usually first H1 or H2)
    const nameMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : '';

    if (!name) {
      return null;
    }

    // Extract description (usually first paragraph after title)
    const descMatch = markdown.match(/^#.*?\n\n(.+?)(?:\n\n|$)/s);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract ingredients section
    const ingredientsMatch = markdown.match(/##?\s*Ingredients?[\s\S]*?\n([\s\S]*?)(?=##|$)/i);
    const ingredientsText = ingredientsMatch ? ingredientsMatch[1] : '';
    const ingredients = ingredientsText
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);

    // Extract instructions section
    const instructionsMatch = markdown.match(/##?\s*(?:Directions?|Instructions?)[\s\S]*?\n([\s\S]*?)(?=##|$)/i);
    const instructionsText = instructionsMatch ? instructionsMatch[1] : '';
    const instructions = instructionsText
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)) && trimmed.length > 5;
      })
      .map(line => line.replace(/^[-*\d.]\s*/, '').trim())
      .filter(line => line.length > 0);

    // Extract servings
    const servingsMatch = markdown.match(/(?:Servings?|Yield):\s*(\d+)/i);
    const servings = servingsMatch ? parseInt(servingsMatch[1]) : undefined;

    // Extract times
    const prepMatch = markdown.match(/(?:Prep(?:aration)?\s*Time):\s*(\d+)\s*(?:min|minute)/i);
    const cookMatch = markdown.match(/(?:Cook(?:ing)?\s*Time):\s*(\d+)\s*(?:min|minute)/i);
    const prepTime = prepMatch ? parseInt(prepMatch[1]) : undefined;
    const cookTime = cookMatch ? parseInt(cookMatch[1]) : undefined;

    // Extract nutrition information (USDA typically provides detailed nutrition)
    const nutrition: Record<string, number> = {};
    const nutritionMatch = markdown.match(/##?\s*Nutrition(?:\s*Facts?)?[\s\S]*?\n([\s\S]*?)(?=##|$)/i);

    if (nutritionMatch) {
      const nutritionText = nutritionMatch[1];

      const caloriesMatch = nutritionText.match(/Calories?:\s*(\d+)/i);
      if (caloriesMatch) nutrition.calories = parseInt(caloriesMatch[1]);

      const proteinMatch = nutritionText.match(/Protein:\s*([\d.]+)\s*g/i);
      if (proteinMatch) nutrition.protein = parseFloat(proteinMatch[1]);

      const carbsMatch = nutritionText.match(/(?:Carbohydrate|Carbs?):\s*([\d.]+)\s*g/i);
      if (carbsMatch) nutrition.carbohydrates = parseFloat(carbsMatch[1]);

      const fatMatch = nutritionText.match(/(?:Total\s*)?Fat:\s*([\d.]+)\s*g/i);
      if (fatMatch) nutrition.fat = parseFloat(fatMatch[1]);

      const fiberMatch = nutritionText.match(/(?:Dietary\s*)?Fiber:\s*([\d.]+)\s*g/i);
      if (fiberMatch) nutrition.fiber = parseFloat(fiberMatch[1]);

      const sodiumMatch = nutritionText.match(/Sodium:\s*([\d.]+)\s*mg/i);
      if (sodiumMatch) nutrition.sodium = parseFloat(sodiumMatch[1]);
    }

    // Validate minimum requirements
    if (!name || ingredients.length < 2 || instructions.length < 2) {
      return null;
    }

    return {
      name,
      description,
      ingredients,
      instructions,
      servings,
      prepTime,
      cookTime,
      nutrition: Object.keys(nutrition).length > 0 ? nutrition : undefined,
      sourceUrl: url,
      sourceName: 'USDA What\'s Cooking',
    };

  } catch (error) {
    console.error(`Error scraping recipe from ${url}:`, error);
    return null;
  }
}

/**
 * Main scraping function
 */
async function scrapeUSDARecipes() {
  console.log('🚀 USDA Recipe Scraper\n');
  console.log(`Mode: ${isPilot ? 'PILOT' : 'FULL'}`);
  console.log(`Max recipes: ${maxRecipes}\n`);

  // Initialize Firecrawl
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable is not set');
  }

  const firecrawl = new FirecrawlApp({ apiKey });

  // Initialize database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  // Initialize progress tracker
  const tracker = new ImportProgressTracker('usda');
  await tracker.loadProgress();

  try {
    // Step 1: Get or create USDA recipe source
    console.log('📋 Setting up USDA recipe source...\n');

    let usdaSource = await db
      .select()
      .from(recipeSources)
      .where(eq(recipeSources.slug, 'usda-team-nutrition'))
      .limit(1);

    if (usdaSource.length === 0) {
      const [newSource] = await db
        .insert(recipeSources)
        .values({
          name: 'USDA Team Nutrition',
          slug: 'usda-team-nutrition',
          website_url: 'https://www.fns.usda.gov/tn/recipes',
          description: 'Public domain recipes from USDA Team Nutrition - 80+ standardized recipes for schools and families',
          is_active: true,
        })
        .returning();

      usdaSource = [newSource];
      console.log('  ✅ Created USDA recipe source\n');
    } else {
      console.log('  ✅ USDA recipe source already exists\n');
    }

    const sourceId = usdaSource[0].id;

    // Step 2: Extract recipe URLs
    const recipeUrls = await extractRecipeUrls(firecrawl, maxRecipes * 2); // Get extra URLs in case some fail
    tracker.setTotal(Math.min(recipeUrls.length, maxRecipes));

    console.log(`📥 Starting scraping (max: ${maxRecipes} recipes)...\n`);

    let successCount = 0;

    // Step 3: Scrape each recipe
    for (let i = 0; i < recipeUrls.length && successCount < maxRecipes; i++) {
      const url = recipeUrls[i];

      // Skip if already processed
      if (tracker.shouldSkip(url)) {
        console.log(`⏭️  [${successCount}/${maxRecipes}] Skipping ${url} (already processed)`);
        continue;
      }

      try {
        console.log(`📄 [${successCount + 1}/${maxRecipes}] Scraping: ${url}`);

        // Scrape recipe
        const recipeData = await scrapeUSDARecipe(firecrawl, url);

        if (!recipeData) {
          tracker.markFailed(url, 'Failed to parse recipe data');
          console.log(`  ❌ Failed to parse recipe\n`);
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Check if recipe already exists by slug
        const slug = transformUSDARecipe(recipeData, SYSTEM_USER_ID, sourceId).slug;
        const existingRecipe = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, slug))
          .limit(1);

        if (existingRecipe.length > 0) {
          tracker.markSkipped(url);
          console.log(`  ⏭️  Recipe already exists: "${recipeData.name}"\n`);
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Transform and insert recipe
        const transformedRecipe = transformUSDARecipe(recipeData, SYSTEM_USER_ID, sourceId);
        await db.insert(recipes).values(transformedRecipe);

        tracker.markImported(url);
        successCount++;

        console.log(`  ✅ Imported: "${recipeData.name}"`);
        console.log(`  📊 Progress: ${successCount}/${maxRecipes}\n`);

        // Rate limiting
        await sleep(RATE_LIMIT_MS);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.markFailed(url, errorMsg);
        console.error(`  ❌ Failed to import recipe:`, errorMsg);
        console.log('');
        await sleep(RATE_LIMIT_MS);
      }
    }

    // Mark as complete
    await tracker.markComplete();
    tracker.printSummary();

    console.log('\n✅ Scraping complete!\n');

    if (isPilot) {
      console.log('🎯 Pilot run complete! Review the imported recipes before running full extraction.\n');
      console.log('To run full extraction: tsx scripts/scrape-usda-recipes.ts --max=100\n');
    }

  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    await tracker.cleanup();
    process.exit(1);
  } finally {
    await tracker.cleanup();
    await client.end();
  }
}

// Run scraper
scrapeUSDARecipes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
