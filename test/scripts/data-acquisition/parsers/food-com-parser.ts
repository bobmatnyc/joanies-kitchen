/**
 * Food.com Recipe Parser
 *
 * Parses Food.com CSV datasets into standardized recipe format
 */

import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

interface FoodComRecipe {
  RecipeId: string;
  Name: string;
  Description: string;
  RecipeIngredientParts: string;
  RecipeInstructions: string;
  PrepTime: string;
  CookTime: string;
  TotalTime: string;
  RecipeServings: string;
  RecipeYield: string;
  RecipeCategory: string;
  Calories: string;
  FatContent: string;
  ProteinContent: string;
  CarbohydrateContent: string;
  AggregatedRating: string;
  ReviewCount: string;
  Images: string;
}

export interface StandardRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  category?: string;
  cuisine?: string;
  tags?: string[];
  nutrition?: Record<string, string>;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  videoUrl?: string;
  source: string;
  sourceUrl: string;
}

/**
 * Parses a string that looks like a list: "['item1', 'item2']" or "c('item1', 'item2')"
 */
function parseListString(value: string): string[] {
  if (!value || value.trim() === '') return [];

  try {
    // Try JSON parse first
    if (value.startsWith('[')) {
      return JSON.parse(value);
    }

    // Handle R-style c() format: c("item1", "item2")
    if (value.startsWith('c(')) {
      const cleaned = value.replace(/^c\(|\)$/g, '');
      return cleaned
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }

    // Handle bracketed format: ["item1", "item2"]
    const cleaned = value.replace(/^\[|\]$/g, '').replace(/["']/g, '');
    return cleaned
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch (_error) {
    console.warn('Failed to parse list string:', value.substring(0, 100));
    return [];
  }
}

/**
 * Parses Food.com recipes from CSV file
 *
 * @param csvPath - Path to Food.com CSV file
 * @returns Array of standardized recipes
 */
export function parseFoodComRecipes(csvPath: string): StandardRecipe[] {
  console.log(`[Food.com Parser] Reading CSV: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records: FoodComRecipe[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  console.log(`[Food.com Parser] Found ${records.length} recipes`);

  return records.map((recipe) => {
    // Parse ingredients
    const ingredients = parseListString(recipe.RecipeIngredientParts);

    // Parse instructions
    const instructions = parseListString(recipe.RecipeInstructions);

    // Parse images
    let images: string[] = [];
    if (recipe.Images) {
      try {
        images = JSON.parse(recipe.Images);
      } catch (_error) {
        images = parseListString(recipe.Images);
      }
    }

    // Convert time from ISO 8601 duration (PT30M) to minutes
    const parseTime = (duration: string): string | undefined => {
      if (!duration) return undefined;
      const match = duration.match(/PT(\d+)M/);
      return match ? `${match[1]} minutes` : undefined;
    };

    return {
      name: recipe.Name,
      description: recipe.Description || undefined,
      ingredients,
      instructions,
      prepTime: parseTime(recipe.PrepTime),
      cookTime: parseTime(recipe.CookTime),
      servings: recipe.RecipeServings || undefined,
      category: recipe.RecipeCategory || undefined,
      nutrition: {
        calories: recipe.Calories || '',
        fat: recipe.FatContent || '',
        protein: recipe.ProteinContent || '',
        carbohydrates: recipe.CarbohydrateContent || '',
      },
      rating: parseFloat(recipe.AggregatedRating) || undefined,
      reviewCount: parseInt(recipe.ReviewCount, 10) || undefined,
      images: images.filter(Boolean),
      source: 'Food.com',
      sourceUrl: `https://www.food.com/recipe/${recipe.RecipeId}`,
    };
  });
}

/**
 * Parses Food.com recipes with progress tracking
 *
 * @param csvPath - Path to CSV file
 * @param onProgress - Optional progress callback
 * @returns Array of standardized recipes
 */
export function parseFoodComRecipesWithProgress(
  csvPath: string,
  onProgress?: (current: number, total: number) => void
): StandardRecipe[] {
  const recipes = parseFoodComRecipes(csvPath);

  if (onProgress) {
    onProgress(recipes.length, recipes.length);
  }

  return recipes;
}
