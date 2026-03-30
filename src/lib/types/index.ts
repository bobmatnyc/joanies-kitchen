/**
 * Type Utilities for Recipe Manager
 *
 * This module provides centralized type definitions and utilities for safe type handling
 * across the application, particularly for database types and JSON parsing.
 *
 * ParsedRecipe and ParsedChef are re-exported from @/lib/db/transformers,
 * which is the single authoritative source for those types.
 */

import type { Chef } from '@/lib/db/chef-schema';
import type { Recipe } from '@/lib/db/schema';
import type { ParsedChef, ParsedRecipe } from '@/lib/db/transformers';
import type { Collection } from '@/lib/db/user-discovery-schema';

// ============================================================================
// PARSED TYPES - Re-exported from authoritative transformers module
// ============================================================================

export type { ParsedChef, ParsedRecipe } from '@/lib/db/transformers';

// Re-export transformer functions so existing callers don't need to change
export {
  parseChef,
  parseChefs,
  parseRecipe,
  parseRecipes,
} from '@/lib/db/transformers';

/**
 * Collection with parsed JSON fields
 */
export type ParsedCollection = Omit<Collection, 'specialties'> & {
  specialties?: string[];
};

// ============================================================================
// STRUCTURED TYPES - Specific object shapes
// ============================================================================

/**
 * Social media links structure
 */
export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
}

/**
 * Nutritional information structure
 */
export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servingSize?: string;
}

// ============================================================================
// SERIALIZERS - Convert frontend types back to database format
// ============================================================================

/**
 * Serialize ParsedRecipe back to Recipe format for database operations
 */
export function serializeRecipe(recipe: Partial<ParsedRecipe>): Partial<Recipe> {
  const serialized: Record<string, unknown> = { ...recipe };

  if (recipe.tags) {
    serialized.tags = JSON.stringify(recipe.tags);
  }
  if (recipe.images) {
    serialized.images = JSON.stringify(recipe.images);
  }
  if (recipe.ingredients) {
    serialized.ingredients = JSON.stringify(recipe.ingredients);
  }
  if ('nutrition_info' in recipe && recipe.nutrition_info !== undefined) {
    serialized.nutrition_info = recipe.nutrition_info
      ? JSON.stringify(recipe.nutrition_info)
      : null;
  }

  return serialized as Partial<Recipe>;
}

/**
 * Serialize ParsedChef back to Chef format for database operations
 */
export function serializeChef(chef: Partial<ParsedChef>): Partial<Chef> {
  // Chef uses JSONB so Drizzle handles serialization; return as-is
  return chef as Partial<Chef>;
}

// ============================================================================
// TYPE GUARDS - Runtime type checking
// ============================================================================

/**
 * Check if a recipe has been parsed (has array fields instead of JSON strings)
 */
export function isParsedRecipe(recipe: Recipe | ParsedRecipe): recipe is ParsedRecipe {
  return Array.isArray((recipe as ParsedRecipe).tags);
}

/**
 * Check if a chef has been parsed
 */
export function isParsedChef(chef: Chef | ParsedChef): chef is ParsedChef {
  return Array.isArray((chef as ParsedChef).specialties);
}

// ============================================================================
// DATABASE TYPE RE-EXPORTS
// ============================================================================

export type { Chef } from '@/lib/db/chef-schema';
export type { Recipe } from '@/lib/db/schema';
export type {
  Collection,
  CollectionRecipe,
  Favorite,
  RecipeView,
  UserProfile,
} from '@/lib/db/user-discovery-schema';
