/**
 * AI-Powered Meal Recommendations
 *
 * Analyzes a main dish and recommends complementary recipes for:
 * - Appetizers
 * - Side dishes
 * - Desserts
 *
 * Uses Claude 3.5 Sonnet or GPT-4o-mini via OpenRouter for intelligent matching
 */

import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type Recipe, recipes } from '@/lib/db/schema';
import { getOpenRouterClient } from './openrouter-server';

interface RecommendationResult {
  appetizers: Recipe[];
  sides: Recipe[];
  desserts: Recipe[];
  analysis: {
    cuisine: string;
    cookingMethod: string;
    flavorProfile: string;
    mainIngredient: string;
  };
}

/**
 * Generate meal recommendations based on a main dish
 */
export async function generateMealRecommendations(
  mainRecipe: Recipe
): Promise<RecommendationResult> {
  // Analyze the main recipe using AI
  const analysis = await analyzeMainDish(mainRecipe);

  // Search for matching recipes in database
  const [appetizerRecipes, sideRecipes, dessertRecipes] = await Promise.all([
    searchRecipesByCategory('appetizer', analysis, mainRecipe.id),
    searchRecipesByCategory('side', analysis, mainRecipe.id),
    searchRecipesByCategory('dessert', analysis, mainRecipe.id),
  ]);

  return {
    appetizers: appetizerRecipes.slice(0, 3),
    sides: sideRecipes.slice(0, 5),
    desserts: dessertRecipes.slice(0, 3),
    analysis,
  };
}

/**
 * Analyze main dish using AI to extract key characteristics
 */
async function analyzeMainDish(mainRecipe: Recipe) {
  const client = getOpenRouterClient();

  const prompt = `Analyze this recipe and extract key characteristics for meal pairing:

Recipe: ${mainRecipe.name}
Description: ${mainRecipe.description || 'No description'}
Cuisine: ${mainRecipe.cuisine || 'Unknown'}
Tags: ${mainRecipe.tags || '[]'}
Ingredients: ${mainRecipe.ingredients}

Respond with a JSON object containing:
{
  "cuisine": "type of cuisine (Italian, Mexican, Asian, American, etc.)",
  "cookingMethod": "primary cooking method (grilled, baked, fried, steamed, etc.)",
  "flavorProfile": "dominant flavor (spicy, savory, light, rich, tangy, etc.)",
  "mainIngredient": "primary protein or ingredient (chicken, beef, fish, vegetarian, etc.)"
}

Only return valid JSON, no additional text.`;

  try {
    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    return {
      cuisine: parsed.cuisine || mainRecipe.cuisine || 'American',
      cookingMethod: parsed.cookingMethod || 'mixed',
      flavorProfile: parsed.flavorProfile || 'savory',
      mainIngredient: parsed.mainIngredient || 'mixed',
    };
  } catch (error) {
    console.error('Failed to analyze main dish:', error);

    // Fallback to basic analysis
    return {
      cuisine: mainRecipe.cuisine || 'American',
      cookingMethod: 'mixed',
      flavorProfile: 'savory',
      mainIngredient: 'mixed',
    };
  }
}

/**
 * Search for recipes by category that complement the main dish
 */
async function searchRecipesByCategory(
  category: 'appetizer' | 'side' | 'dessert',
  analysis: {
    cuisine: string;
    cookingMethod: string;
    flavorProfile: string;
    mainIngredient: string;
  },
  excludeRecipeId: string
): Promise<Recipe[]> {
  // Build search terms based on category
  const searchTerms: Record<string, string[]> = {
    appetizer: getAppetizerTerms(analysis),
    side: getSideTerms(analysis),
    dessert: getDessertTerms(analysis),
  };

  const terms = searchTerms[category];

  // Search for recipes matching the terms
  // Priority: cuisine match > flavor match > any public recipe
  const results = await db
    .select()
    .from(recipes)
    .where(
      sql`(
        ${recipes.cuisine} ILIKE ${`%${analysis.cuisine}%`}
        OR ${recipes.tags}::text ILIKE ANY(ARRAY[${terms.map((t) => `%${t}%`).join(',')}])
        OR ${recipes.name}::text ILIKE ANY(ARRAY[${terms.map((t) => `%${t}%`).join(',')}])
        OR ${recipes.description}::text ILIKE ANY(ARRAY[${terms.map((t) => `%${t}%`).join(',')}])
      )
      AND ${recipes.id} != ${excludeRecipeId}
      AND (${recipes.is_public} = true OR ${recipes.is_system_recipe} = true)`
    )
    .orderBy(desc(recipes.system_rating), desc(recipes.created_at))
    .limit(10);

  return results;
}

/**
 * Get appetizer search terms based on meal analysis
 */
function getAppetizerTerms(analysis: {
  cuisine: string;
  cookingMethod: string;
  flavorProfile: string;
}): string[] {
  const terms: string[] = ['appetizer', 'starter', 'app'];

  // Add cuisine-specific terms
  const cuisineTerms: Record<string, string[]> = {
    Italian: ['bruschetta', 'antipasto', 'caprese'],
    Mexican: ['guacamole', 'salsa', 'quesadilla', 'nachos'],
    Asian: ['spring roll', 'dumpling', 'edamame', 'tempura'],
    French: ['pate', 'escargot', 'tart'],
    American: ['wings', 'dip', 'slider'],
    Mediterranean: ['hummus', 'tzatziki', 'olive', 'feta'],
  };

  const cuisineKey = Object.keys(cuisineTerms).find((key) =>
    analysis.cuisine.toLowerCase().includes(key.toLowerCase())
  );
  if (cuisineKey) {
    terms.push(...cuisineTerms[cuisineKey]);
  }

  return terms;
}

/**
 * Get side dish search terms based on meal analysis
 */
function getSideTerms(analysis: {
  cuisine: string;
  cookingMethod: string;
  flavorProfile: string;
}): string[] {
  const terms: string[] = ['side', 'side dish'];

  // Add cuisine-specific terms
  const cuisineTerms: Record<string, string[]> = {
    Italian: ['risotto', 'polenta', 'pasta', 'vegetables'],
    Mexican: ['rice', 'beans', 'corn', 'elote'],
    Asian: ['rice', 'noodle', 'stir-fry', 'bok choy'],
    French: ['potato', 'gratin', 'ratatouille'],
    American: ['potato', 'corn', 'coleslaw', 'mac and cheese'],
    Mediterranean: ['couscous', 'tabbouleh', 'pilaf'],
  };

  const cuisineKey = Object.keys(cuisineTerms).find((key) =>
    analysis.cuisine.toLowerCase().includes(key.toLowerCase())
  );
  if (cuisineKey) {
    terms.push(...cuisineTerms[cuisineKey]);
  }

  // Add cooking method complements
  if (analysis.cookingMethod.includes('grill')) {
    terms.push('grilled', 'roasted', 'vegetables');
  } else if (analysis.cookingMethod.includes('bake')) {
    terms.push('baked', 'roasted');
  }

  return terms;
}

/**
 * Get dessert search terms based on meal analysis
 */
function getDessertTerms(analysis: { cuisine: string; flavorProfile: string }): string[] {
  const terms: string[] = ['dessert', 'sweet'];

  // Add cuisine-specific terms
  const cuisineTerms: Record<string, string[]> = {
    Italian: ['tiramisu', 'panna cotta', 'gelato', 'cannoli'],
    Mexican: ['flan', 'churro', 'tres leches'],
    Asian: ['mochi', 'mango sticky rice', 'sesame'],
    French: ['creme brulee', 'macaron', 'tart', 'mousse'],
    American: ['pie', 'cake', 'brownie', 'cookie'],
    Mediterranean: ['baklava', 'honey', 'pistachio'],
  };

  const cuisineKey = Object.keys(cuisineTerms).find((key) =>
    analysis.cuisine.toLowerCase().includes(key.toLowerCase())
  );
  if (cuisineKey) {
    terms.push(...cuisineTerms[cuisineKey]);
  }

  // Light desserts for rich main courses
  if (analysis.flavorProfile.includes('rich') || analysis.flavorProfile.includes('heavy')) {
    terms.push('light', 'fruit', 'sorbet', 'fresh');
  }

  return terms;
}
