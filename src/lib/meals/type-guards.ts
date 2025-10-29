/**
 * Type Guards and Validators for Meals Feature
 *
 * This module provides runtime type validation to eliminate unsafe `as any` assertions.
 * All enum values and JSON parsing operations are validated at runtime.
 */

import { z } from 'zod';

// ==================== Enum Type Guards ====================

/**
 * Course category for meal recipes
 */
export const COURSE_CATEGORIES = [
  'appetizer',
  'main',
  'side',
  'dessert',
  'drink',
  'bread',
  'salad',
  'soup',
  'other',
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export function isValidCourseCategory(value: unknown): value is CourseCategory {
  return typeof value === 'string' && COURSE_CATEGORIES.includes(value as CourseCategory);
}

export function assertCourseCategory(value: unknown): CourseCategory {
  if (!isValidCourseCategory(value)) {
    throw new Error(
      `Invalid course category: "${value}". Must be one of: ${COURSE_CATEGORIES.join(', ')}`
    );
  }
  return value;
}

/**
 * Meal type classification
 */
export const MEAL_TYPES = [
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'party',
  'holiday',
  'custom',
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export function isValidMealType(value: unknown): value is MealType {
  return typeof value === 'string' && MEAL_TYPES.includes(value as MealType);
}

export function assertMealType(value: unknown): MealType {
  if (!isValidMealType(value)) {
    throw new Error(`Invalid meal type: "${value}". Must be one of: ${MEAL_TYPES.join(', ')}`);
  }
  return value;
}

/**
 * Shopping list status
 */
export const SHOPPING_LIST_STATUSES = [
  'draft',
  'active',
  'shopping',
  'completed',
  'archived',
] as const;

export type ShoppingListStatus = (typeof SHOPPING_LIST_STATUSES)[number];

export function isValidShoppingListStatus(value: unknown): value is ShoppingListStatus {
  return typeof value === 'string' && SHOPPING_LIST_STATUSES.includes(value as ShoppingListStatus);
}

export function assertShoppingListStatus(value: unknown): ShoppingListStatus {
  if (!isValidShoppingListStatus(value)) {
    throw new Error(
      `Invalid shopping list status: "${value}". Must be one of: ${SHOPPING_LIST_STATUSES.join(', ')}`
    );
  }
  return value;
}

// ==================== Zod Schemas for JSON Parsing ====================

/**
 * Shopping list item schema with runtime validation
 */
export const ShoppingListItemSchema = z.object({
  ingredient_id: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().nonnegative('Quantity must be non-negative'),
  unit: z.string(),
  category: z.string(),
  estimated_price: z.number().nonnegative().optional(),
  checked: z.boolean(),
  from_recipes: z.array(z.string()),
  notes: z.string().optional(),
  isToTaste: z.boolean().optional(),
});

export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

/**
 * Parse and validate shopping list items from JSON string
 */
export function parseShoppingListItems(jsonString: string): ShoppingListItem[] {
  try {
    const parsed = JSON.parse(jsonString);
    return ShoppingListItemSchema.array().parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid shopping list items: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`
      );
    }
    throw new Error(
      `Failed to parse shopping list items: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Recipe images schema
 */
export const RecipeImagesSchema = z.array(z.string().url()).max(6, 'Maximum 6 images allowed');

export type RecipeImages = z.infer<typeof RecipeImagesSchema>;

/**
 * Parse and validate recipe images from JSON string
 */
export function parseRecipeImages(jsonString: string | null): string[] {
  if (!jsonString) return [];

  try {
    const parsed = JSON.parse(jsonString);
    return RecipeImagesSchema.parse(parsed);
  } catch (error) {
    console.error('Failed to parse recipe images:', error);
    return []; // Graceful fallback for non-critical data
  }
}

/**
 * Meal template structure schema
 */
export const MealTemplateStructureSchema = z.object({
  courses: z.array(
    z.object({
      category: z.enum(COURSE_CATEGORIES),
      required: z.boolean(),
      count: z.number().int().positive().optional(),
      suggestions: z.array(z.string()).optional(),
    })
  ),
});

export type MealTemplateStructure = z.infer<typeof MealTemplateStructureSchema>;

/**
 * Parse and validate meal template structure from JSON string
 */
export function parseMealTemplateStructure(jsonString: string): MealTemplateStructure {
  try {
    const parsed = JSON.parse(jsonString);
    return MealTemplateStructureSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid template structure: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`
      );
    }
    throw new Error(
      `Failed to parse template structure: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ==================== Branded Types for Type Safety ====================

/**
 * Branded type for Meal IDs
 */
export type MealId = string & { readonly __brand: 'MealId' };

export function createMealId(id: string): MealId {
  return id as MealId;
}

/**
 * Branded type for Shopping List IDs
 */
export type ShoppingListId = string & { readonly __brand: 'ShoppingListId' };

export function createShoppingListId(id: string): ShoppingListId {
  return id as ShoppingListId;
}

// ==================== Helper Types ====================

/**
 * Result type for safe error handling
 */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

/**
 * Type-safe course category configuration
 */
export interface CourseCategoryConfig {
  value: CourseCategory;
  label: string;
}

export const COURSE_CATEGORY_CONFIGS: CourseCategoryConfig[] = [
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'main', label: 'Main Course' },
  { value: 'side', label: 'Side Dish' },
  { value: 'salad', label: 'Salad' },
  { value: 'soup', label: 'Soup' },
  { value: 'bread', label: 'Bread' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
  { value: 'other', label: 'Other' },
];

/**
 * Type-safe meal type configuration
 */
export interface MealTypeConfig {
  value: MealType;
  label: string;
}

export const MEAL_TYPE_CONFIGS: MealTypeConfig[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'party', label: 'Party' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'custom', label: 'Custom' },
];
