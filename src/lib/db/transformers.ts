/**
 * Type transformation utilities for DB → Frontend type consistency
 *
 * PostgreSQL/Drizzle Type Behavior:
 * - DECIMAL/NUMERIC columns: Returned as string (need parseFloat)
 * - INTEGER columns: Returned as number (no transformation needed)
 * - JSON/JSONB text columns: Returned as string (need JSON.parse)
 * - TEXT[] arrays: Returned as string[] (no transformation needed)
 *
 * This module provides utilities to transform raw database types into
 * frontend-friendly TypeScript types with proper type safety.
 */

import type { Recipe, Tool } from './schema';
import type { Chef } from './chef-schema';
import type { Ingredient } from './ingredients-schema';
import type { Meal } from './meals-schema';
import type { InventoryItem } from './inventory-schema';

/**
 * Parse decimal string from DB to number
 * Used for NUMERIC/DECIMAL fields that Drizzle returns as strings
 *
 * @param value - String value from database
 * @returns Parsed number or null if invalid
 */
export function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse integer string from DB to number
 * Fallback for any integer fields that might be returned as strings
 *
 * @param value - String or number value from database
 * @returns Parsed integer or null if invalid
 */
export function parseInteger(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse JSON text field from DB to typed value
 * Used for TEXT columns that store JSON strings
 *
 * @param value - JSON string from database
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed value or default
 */
export function parseJsonField<T>(value: string | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined || value === '') return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Parse array JSON field (common pattern for images, tags, etc.)
 * Used for TEXT columns storing JSON arrays
 *
 * @param value - JSON array string from database
 * @returns Parsed array or empty array if invalid
 */
export function parseJsonArray(value: string | null | undefined): string[] {
  return parseJsonField<string[]>(value, []);
}

// ============================================================================
// Recipe Transformers
// ============================================================================

/**
 * Parsed ingredient entry from recipe ingredients JSON field
 */
export interface ParsedIngredientEntry {
  ingredient_id?: string;
  ingredient_name: string;
  amount: string;
  unit: string;
  notes?: string;
}

/**
 * Parsed nutrition information from recipe nutrition JSON field
 */
export interface ParsedNutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
}

/**
 * Frontend-ready recipe type with corrected type conversions
 */
export interface ParsedRecipe extends Omit<Recipe,
  | 'confidence_score'
  | 'system_rating'
  | 'avg_user_rating'
  | 'images'
  | 'ingredients'
  | 'nutrition_info'
  | 'tags'
  | 'instruction_metadata'
  | 'dominant_textures'
  | 'dominant_flavors'
  | 'waste_reduction_tags'
> {
  // Numeric fields (NUMERIC/DECIMAL → string → number)
  confidence_score: number | null;
  system_rating: number | null;
  avg_user_rating: number | null;

  // JSON text fields (TEXT → string → parsed)
  images: string[];
  ingredients: ParsedIngredientEntry[];
  nutrition_info: ParsedNutrition | null;
  tags: string[];
  instruction_metadata: unknown | null; // Keep as unknown since structure varies
  dominant_textures: string[];
  dominant_flavors: string[];
  waste_reduction_tags: string[];
}

/**
 * Transform raw recipe from DB to frontend-ready format
 * Handles all type conversions for numeric and JSON fields
 *
 * @param recipe - Raw recipe from database
 * @returns Frontend-ready parsed recipe
 */
export function parseRecipe(recipe: Recipe): ParsedRecipe {
  return {
    ...recipe,
    // Parse NUMERIC/DECIMAL fields
    confidence_score: parseDecimal(recipe.confidence_score),
    system_rating: parseDecimal(recipe.system_rating),
    avg_user_rating: parseDecimal(recipe.avg_user_rating),

    // Parse JSON text fields
    images: parseJsonArray(recipe.images),
    ingredients: parseJsonField<ParsedIngredientEntry[]>(recipe.ingredients, []),
    nutrition_info: parseJsonField<ParsedNutrition | null>(recipe.nutrition_info, null),
    tags: parseJsonArray(recipe.tags),
    instruction_metadata: parseJsonField<unknown | null>(recipe.instruction_metadata, null),
    dominant_textures: parseJsonArray(recipe.dominant_textures),
    dominant_flavors: parseJsonArray(recipe.dominant_flavors),
    waste_reduction_tags: parseJsonArray(recipe.waste_reduction_tags),
  };
}

// ============================================================================
// Meal Transformers
// ============================================================================

/**
 * Frontend-ready meal type with corrected type conversions
 */
export interface ParsedMeal extends Omit<Meal,
  | 'estimated_total_cost'
  | 'estimated_cost_per_serving'
  | 'price_estimation_confidence'
  | 'tags'
> {
  // Numeric fields (NUMERIC/DECIMAL → string → number)
  estimated_total_cost: number | null;
  estimated_cost_per_serving: number | null;
  price_estimation_confidence: number | null;

  // JSON text fields
  tags: string[];
}

/**
 * Transform raw meal from DB to frontend-ready format
 *
 * @param meal - Raw meal from database
 * @returns Frontend-ready parsed meal
 */
export function parseMeal(meal: Meal): ParsedMeal {
  return {
    ...meal,
    // Parse NUMERIC/DECIMAL fields
    estimated_total_cost: parseDecimal(meal.estimated_total_cost),
    estimated_cost_per_serving: parseDecimal(meal.estimated_cost_per_serving),
    price_estimation_confidence: parseDecimal(meal.price_estimation_confidence),

    // Parse JSON text fields
    tags: parseJsonArray(meal.tags),
  };
}

// ============================================================================
// Chef Transformers
// ============================================================================

/**
 * Frontend-ready chef type with corrected type conversions
 */
export interface ParsedChef extends Omit<Chef,
  | 'latitude'
  | 'longitude'
  | 'social_links'
> {
  // Numeric fields (NUMERIC/DECIMAL → string → number)
  latitude: number | null;
  longitude: number | null;

  // JSONB field (already parsed by Drizzle, but type as unknown)
  social_links: unknown | null;
}

/**
 * Transform raw chef from DB to frontend-ready format
 *
 * @param chef - Raw chef from database
 * @returns Frontend-ready parsed chef
 */
export function parseChef(chef: Chef): ParsedChef {
  return {
    ...chef,
    // Parse NUMERIC/DECIMAL fields
    latitude: parseDecimal(chef.latitude),
    longitude: parseDecimal(chef.longitude),

    // social_links is JSONB, so Drizzle already parses it
    social_links: chef.social_links,
  };
}

// ============================================================================
// Ingredient Transformers
// ============================================================================

/**
 * Frontend-ready ingredient type with corrected type conversions
 */
export interface ParsedIngredient extends Omit<Ingredient,
  | 'aliases'
  | 'common_units'
  | 'substitutions'
> {
  // JSON text fields
  aliases: string[];
  common_units: string[];
  substitutions: string[];
}

/**
 * Transform raw ingredient from DB to frontend-ready format
 *
 * @param ingredient - Raw ingredient from database
 * @returns Frontend-ready parsed ingredient
 */
export function parseIngredient(ingredient: Ingredient): ParsedIngredient {
  return {
    ...ingredient,
    // Parse JSON text fields
    aliases: parseJsonArray(ingredient.aliases),
    common_units: parseJsonArray(ingredient.common_units),
    substitutions: parseJsonArray(ingredient.substitutions),
  };
}

// ============================================================================
// Tool Transformers
// ============================================================================

/**
 * Frontend-ready tool type with corrected type conversions
 */
export interface ParsedTool extends Omit<Tool,
  | 'typical_price_usd'
  | 'alternatives'
> {
  // Numeric fields (NUMERIC/DECIMAL → string → number)
  typical_price_usd: number | null;

  // JSON text fields
  alternatives: string[];
}

/**
 * Transform raw tool from DB to frontend-ready format
 *
 * @param tool - Raw tool from database
 * @returns Frontend-ready parsed tool
 */
export function parseTool(tool: Tool): ParsedTool {
  return {
    ...tool,
    // Parse NUMERIC/DECIMAL fields
    typical_price_usd: parseDecimal(tool.typical_price_usd),

    // Parse JSON text fields
    alternatives: parseJsonArray(tool.alternatives),
  };
}

// ============================================================================
// Inventory Transformers
// ============================================================================

/**
 * Frontend-ready inventory item type with corrected type conversions
 */
export interface ParsedInventoryItem extends Omit<InventoryItem,
  | 'quantity'
  | 'cost_usd'
> {
  // Numeric fields (NUMERIC/DECIMAL → string → number)
  quantity: number;
  cost_usd: number | null;
}

/**
 * Transform raw inventory item from DB to frontend-ready format
 *
 * @param item - Raw inventory item from database
 * @returns Frontend-ready parsed inventory item
 */
export function parseInventoryItem(item: InventoryItem): ParsedInventoryItem {
  return {
    ...item,
    // Parse NUMERIC/DECIMAL fields (quantity is required, so default to 0)
    quantity: parseDecimal(item.quantity) ?? 0,
    cost_usd: parseDecimal(item.cost_usd),
  };
}

// ============================================================================
// Batch Transformers
// ============================================================================

/**
 * Transform array of recipes
 *
 * @param recipes - Array of raw recipes
 * @returns Array of parsed recipes
 */
export function parseRecipes(recipes: Recipe[]): ParsedRecipe[] {
  return recipes.map(parseRecipe);
}

/**
 * Transform array of meals
 *
 * @param meals - Array of raw meals
 * @returns Array of parsed meals
 */
export function parseMeals(meals: Meal[]): ParsedMeal[] {
  return meals.map(parseMeal);
}

/**
 * Transform array of chefs
 *
 * @param chefs - Array of raw chefs
 * @returns Array of parsed chefs
 */
export function parseChefs(chefs: Chef[]): ParsedChef[] {
  return chefs.map(parseChef);
}

/**
 * Transform array of ingredients
 *
 * @param ingredients - Array of raw ingredients
 * @returns Array of parsed ingredients
 */
export function parseIngredients(ingredients: Ingredient[]): ParsedIngredient[] {
  return ingredients.map(parseIngredient);
}

/**
 * Transform array of tools
 *
 * @param tools - Array of raw tools
 * @returns Array of parsed tools
 */
export function parseTools(tools: Tool[]): ParsedTool[] {
  return tools.map(parseTool);
}

/**
 * Transform array of inventory items
 *
 * @param items - Array of raw inventory items
 * @returns Array of parsed inventory items
 */
export function parseInventoryItems(items: InventoryItem[]): ParsedInventoryItem[] {
  return items.map(parseInventoryItem);
}
