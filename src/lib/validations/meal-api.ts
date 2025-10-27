/**
 * Zod validation schemas for Meal API endpoints
 *
 * Provides request/response validation for v1 REST API meal and shopping list operations
 */

import { z } from 'zod';
import {
  courseCategoryEnum,
  mealTypeEnum,
  shoppingListItemSchema,
  shoppingListStatusEnum,
} from '@/lib/meals/validation';

// ============================================================================
// REQUEST SCHEMAS - MEALS
// ============================================================================

/**
 * Schema for creating a new meal
 */
export const createMealSchema = z.object({
  name: z.string().min(1, 'Meal name is required').max(200),
  description: z.string().min(1, 'Description is required').max(1000),
  meal_type: mealTypeEnum.optional(),
  occasion: z.string().max(200).optional(),
  serves: z.number().int().positive().min(1).max(100).default(4),
  tags: z.array(z.string()).optional(),
  is_template: z.boolean().default(false),
  is_public: z.boolean().default(false),
  estimated_total_cost: z.string().optional(),
  estimated_cost_per_serving: z.string().optional(),
  recipes: z
    .array(
      z.object({
        recipeId: z.string().min(1, 'Recipe ID is required'),
        servingMultiplier: z.number().positive().default(1),
        courseCategory: courseCategoryEnum.default('main'),
        displayOrder: z.number().int().nonnegative().optional(),
        preparationNotes: z.string().max(500).optional(),
      })
    )
    .optional(),
});

/**
 * Schema for updating an existing meal
 * All fields are optional since it's a PATCH operation
 */
export const updateMealSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  meal_type: mealTypeEnum.optional(),
  occasion: z.string().max(200).optional(),
  serves: z.number().int().positive().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  is_template: z.boolean().optional(),
  is_public: z.boolean().optional(),
  estimated_total_cost: z.string().optional(),
  estimated_cost_per_serving: z.string().optional(),
  image_url: z.string().url().optional(),
});

/**
 * Schema for listing meals with query parameters
 */
export const listMealsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  mealType: mealTypeEnum.optional(),
  isTemplate: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
});

/**
 * Schema for adding a recipe to a meal
 */
export const addRecipeToMealSchema = z.object({
  recipeId: z.string().min(1, 'Recipe ID is required'),
  servingMultiplier: z.number().positive().default(1),
  courseCategory: courseCategoryEnum.default('main'),
  displayOrder: z.number().int().nonnegative().optional().default(0),
  preparationNotes: z.string().max(500).optional(),
});

/**
 * Schema for updating a meal recipe relationship
 */
export const updateMealRecipeSchema = z.object({
  servingMultiplier: z.number().positive().optional(),
  courseCategory: courseCategoryEnum.optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  preparationNotes: z.string().max(500).optional(),
});

// ============================================================================
// REQUEST SCHEMAS - SHOPPING LISTS
// ============================================================================

/**
 * Schema for generating a shopping list from a meal
 */
export const generateShoppingListSchema = z.object({
  // Empty body - uses meal's recipes automatically
});

/**
 * Schema for listing shopping lists with query parameters
 */
export const listShoppingListsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  mealId: z.string().uuid().optional(),
  status: shoppingListStatusEnum.optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schema for updating a shopping list
 */
export const updateShoppingListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(shoppingListItemSchema).optional(),
  status: shoppingListStatusEnum.optional(),
  estimated_total_cost: z.string().optional(),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Standard success response wrapper
 */
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
});

/**
 * Standard error response wrapper
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

/**
 * Paginated response metadata
 */
export const paginationMetadataSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

/**
 * Paginated meals response
 */
export const paginatedMealsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    meals: z.array(z.any()),
    pagination: paginationMetadataSchema,
  }),
});

/**
 * Paginated shopping lists response
 */
export const paginatedShoppingListsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    shoppingLists: z.array(z.any()),
    pagination: paginationMetadataSchema,
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
export type ListMealsQuery = z.infer<typeof listMealsQuerySchema>;
export type AddRecipeToMealInput = z.infer<typeof addRecipeToMealSchema>;
export type UpdateMealRecipeInput = z.infer<typeof updateMealRecipeSchema>;
export type GenerateShoppingListInput = z.infer<typeof generateShoppingListSchema>;
export type ListShoppingListsQuery = z.infer<typeof listShoppingListsQuerySchema>;
export type UpdateShoppingListInput = z.infer<typeof updateShoppingListSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
