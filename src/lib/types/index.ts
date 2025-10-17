/**
 * Type Utilities for Recipe Manager
 *
 * This module provides centralized type definitions and utilities for safe type handling
 * across the application, particularly for database types and JSON parsing.
 */

import type { Chef } from '@/lib/db/chef-schema';
import type { Recipe } from '@/lib/db/schema';
import type { Collection } from '@/lib/db/user-discovery-schema';

// ============================================================================
// PARSED TYPES - Frontend representations with parsed JSON fields
// ============================================================================

/**
 * Recipe with parsed JSON fields
 * Use this type in frontend components where you need array/object types
 */
export type ParsedRecipe = Omit<
  Recipe,
  'tags' | 'images' | 'ingredients' | 'instructions' | 'nutrition_info'
> & {
  tags: string[];
  images: string[];
  ingredients: string[];
  instructions: string[];
  nutrition_info: NutritionInfo | null;
};

/**
 * Chef with parsed JSON fields
 */
export type ParsedChef = Omit<Chef, 'social_links' | 'specialties'> & {
  social_links: SocialLinks;
  specialties: string[];
};

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
// SAFE PARSERS - Handle null/undefined gracefully
// ============================================================================

/**
 * Safely parse a JSON string field, returning default value on error
 */
function safeJsonParse<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('[Type Parser] Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Parse Recipe from database to frontend format
 */
export function parseRecipe(recipe: Recipe): ParsedRecipe {
  return {
    ...recipe,
    tags: safeJsonParse<string[]>(recipe.tags, []),
    images: safeJsonParse<string[]>(recipe.images, []),
    ingredients: safeJsonParse<string[]>(recipe.ingredients, []),
    instructions: safeJsonParse<string[]>(recipe.instructions, []),
    nutrition_info: safeJsonParse<NutritionInfo | null>(recipe.nutrition_info, null),
  };
}

/**
 * Parse multiple recipes
 */
export function parseRecipes(recipes: Recipe[]): ParsedRecipe[] {
  return recipes.map(parseRecipe);
}

/**
 * Parse Chef from database to frontend format
 */
export function parseChef(chef: Chef): ParsedChef {
  return {
    ...chef,
    social_links: chef.social_links || {},
    specialties: chef.specialties || [],
  };
}

/**
 * Parse multiple chefs
 */
export function parseChefs(chefs: Chef[]): ParsedChef[] {
  return chefs.map(parseChef);
}

// ============================================================================
// SERIALIZERS - Convert frontend types back to database format
// ============================================================================

/**
 * Serialize ParsedRecipe back to Recipe format for database operations
 */
export function serializeRecipe(recipe: Partial<ParsedRecipe>): Partial<Recipe> {
  const serialized: any = { ...recipe };

  // Serialize array fields to JSON strings
  if (recipe.tags) {
    serialized.tags = JSON.stringify(recipe.tags);
  }
  if (recipe.images) {
    serialized.images = JSON.stringify(recipe.images);
  }
  if (recipe.ingredients) {
    serialized.ingredients = JSON.stringify(recipe.ingredients);
  }
  if (recipe.instructions) {
    serialized.instructions = JSON.stringify(recipe.instructions);
  }
  if (recipe.nutrition_info) {
    serialized.nutrition_info = JSON.stringify(recipe.nutrition_info);
  }

  return serialized as Partial<Recipe>;
}

/**
 * Serialize ParsedChef back to Chef format for database operations
 */
export function serializeChef(chef: Partial<ParsedChef>): Partial<Chef> {
  const serialized: any = { ...chef };

  // Chef already uses jsonb, no string serialization needed
  // but ensure proper types
  if (chef.social_links) {
    serialized.social_links = chef.social_links;
  }
  if (chef.specialties) {
    serialized.specialties = chef.specialties;
  }

  return serialized;
}

// ============================================================================
// TYPE GUARDS - Runtime type checking
// ============================================================================

/**
 * Check if a recipe has been parsed (has array fields)
 */
export function isParsedRecipe(recipe: Recipe | ParsedRecipe): recipe is ParsedRecipe {
  return Array.isArray((recipe as any).tags);
}

/**
 * Check if a chef has been parsed
 */
export function isParsedChef(chef: Chef | ParsedChef): chef is ParsedChef {
  return Array.isArray((chef as any).specialties);
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Chef } from '@/lib/db/chef-schema';
// Re-export database types
export type { Recipe } from '@/lib/db/schema';
export type {
  Collection,
  CollectionRecipe,
  Favorite,
  RecipeView,
  UserProfile,
} from '@/lib/db/user-discovery-schema';
