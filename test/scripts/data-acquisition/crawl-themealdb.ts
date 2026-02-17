#!/usr/bin/env tsx

/**
 * TheMealDB API Crawler
 *
 * Crawls TheMealDB free API to download recipes
 * API Docs: https://www.themealdb.com/api.php
 *
 * Free tier limitations:
 * - 100 requests per second (we use 200ms delay = 5/sec to be conservative)
 * - Search by first letter (a-z)
 * - Full recipe details available
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';
const OUTPUT_DIR = path.join(process.cwd(), 'data/recipes/incoming/themealdb');
const RATE_LIMIT_MS = 200; // Conservative: 5 requests/second

interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
  [key: string]: any; // For strIngredient1-20 and strMeasure1-20
}

interface MealDBResponse {
  meals: MealDBMeal[] | null;
}

/**
 * Fetches data from API with retry logic
 */
async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[API] Fetching: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`[API] Attempt ${i + 1}/${retries} failed:`, error.message);

      if (i === retries - 1) {
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

/**
 * Parses ingredients from MealDB format
 */
function parseIngredients(meal: MealDBMeal): string[] {
  const ingredients: string[] = [];

  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];

    if (ingredient?.trim()) {
      ingredients.push(`${measure || ''} ${ingredient}`.trim());
    }
  }

  return ingredients;
}

/**
 * Parses instructions into steps
 */
function parseInstructions(instructions: string): string[] {
  if (!instructions) return [];

  // Split by newlines
  return instructions
    .split(/\r\n|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function crawlTheMealDB(options: { limit?: number; letters?: string } = {}) {
  console.log('[TheMealDB] Starting crawl...');
  console.log('[TheMealDB] Options:', options);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const recipes = [];
  const letters = options.letters || 'abcdefghijklmnopqrstuvwxyz';
  const limit = options.limit;

  for (const letter of letters) {
    if (limit && recipes.length >= limit) break;

    console.log(`\n[TheMealDB] === Fetching meals starting with '${letter.toUpperCase()}' ===`);

    try {
      const searchResponse = await fetchWithRetry(`${BASE_URL}search.php?f=${letter}`);

      if (!searchResponse.meals) {
        console.log(`[TheMealDB] No meals found for '${letter}'`);
        continue;
      }

      console.log(`[TheMealDB] Found ${searchResponse.meals.length} meals for '${letter}'`);

      for (const meal of searchResponse.meals) {
        if (limit && recipes.length >= limit) break;

        try {
          // Fetch full details
          const detailResponse = await fetchWithRetry(`${BASE_URL}lookup.php?i=${meal.idMeal}`);

          if (!detailResponse.meals || !detailResponse.meals[0]) {
            console.warn(`[TheMealDB] No details for meal ${meal.idMeal}`);
            continue;
          }

          const fullMeal = detailResponse.meals[0];

          // Parse ingredients (strIngredient1-20 and strMeasure1-20)
          const ingredients = parseIngredients(fullMeal);

          // Parse instructions (split by newlines or periods)
          const instructions = parseInstructions(fullMeal.strInstructions);

          const recipe = {
            id: fullMeal.idMeal,
            name: fullMeal.strMeal,
            description:
              `${fullMeal.strCategory || ''} dish from ${fullMeal.strArea || 'unknown'} cuisine`.trim(),
            ingredients,
            instructions,
            category: fullMeal.strCategory || '',
            cuisine: fullMeal.strArea || '',
            tags: fullMeal.strTags ? fullMeal.strTags.split(',').map((t: string) => t.trim()) : [],
            images: fullMeal.strMealThumb ? [fullMeal.strMealThumb] : [],
            videoUrl: fullMeal.strYoutube || '',
            source: 'TheMealDB',
            sourceUrl: fullMeal.strSource || `https://www.themealdb.com/meal/${fullMeal.idMeal}`,
          };

          recipes.push(recipe);
          console.log(
            `[TheMealDB]   ✓ ${fullMeal.strMeal} (${ingredients.length} ingredients, ${instructions.length} steps)`
          );

          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[TheMealDB]   ✗ Error fetching meal ${meal.idMeal}:`, errorMessage);
        }
      }

      // Wait between letters
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS * 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[TheMealDB] Error fetching letter '${letter}':`, errorMessage);
    }
  }

  // Save to JSON file
  const outputPath = path.join(OUTPUT_DIR, `recipes-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[TheMealDB] ✓ Crawl complete!`);
  console.log(`[TheMealDB] Saved ${recipes.length} recipes to:`);
  console.log(`[TheMealDB] ${outputPath}`);
  console.log('='.repeat(60));

  return { success: true, count: recipes.length, file: outputPath };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0], 10) : undefined;
  const letters = args[1] || undefined;

  crawlTheMealDB({ limit, letters })
    .then((result) => {
      console.log('\n✓ Success:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Failed:', error);
      process.exit(1);
    });
}

export { crawlTheMealDB };
