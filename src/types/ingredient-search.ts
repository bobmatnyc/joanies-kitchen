/**
 * Ingredient Search Types
 *
 * Shared types for ingredient-based recipe search
 * Exported separately to avoid "use server" conflicts with client components
 */

import type { Recipe } from '@/lib/db/schema';

/**
 * Recipe with ingredient match information
 */
export interface RecipeWithMatch extends Recipe {
  matchedIngredients: string[];
  totalIngredients: number;
  matchPercentage: number;
  rankingScore: number;
}

/**
 * Match modes for ingredient-based recipe search
 */
export type MatchModeType = 'all' | 'any' | 'exact';

/**
 * Search options for ingredient-based recipe search
 */
export interface SearchOptions {
  matchMode?: MatchModeType;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  dietaryRestrictions?: string[];
  minMatchPercentage?: number;
  limit?: number;
  offset?: number;
  includePrivate?: boolean;
  rankingMode?: 'balanced' | 'semantic' | 'quality' | 'popular' | 'trending' | 'discovery';
  includeScoreBreakdown?: boolean;
}

/**
 * Search result response
 */
export interface IngredientSearchResult {
  success: boolean;
  recipes: RecipeWithMatch[];
  totalCount: number;
  error?: string;
}

/**
 * Ingredient suggestion
 */
export interface IngredientSuggestion {
  id: string;
  name: string;
  displayName: string;
  category: string | null;
  isCommon: boolean;
  recipeCount?: number;
}

/**
 * Suggestion result response
 */
export interface SuggestionResult {
  success: boolean;
  suggestions: IngredientSuggestion[];
  error?: string;
}
