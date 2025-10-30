/**
 * Zod validation schemas for Recipe API endpoints
 *
 * Provides request/response validation for v1 REST API
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Schema for creating a new recipe
 */
export const createRecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(255),
  description: z.string().optional(),
  ingredients: z.array(z.string()).min(1, 'At least one ingredient is required'),
  instructions: z.array(z.string()).min(1, 'At least one instruction is required'),
  prep_time: z.number().int().positive().optional(),
  cook_time: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string().url()).max(6, 'Maximum 6 images allowed').optional(),
  image_url: z.string().url().optional(), // Deprecated but kept for backwards compatibility
  is_public: z.boolean().default(false),
  is_meal_prep_friendly: z.boolean().default(false),
  nutrition_info: z.record(z.any()).optional(),
  video_url: z.string().url().optional(),
  source: z.string().optional(),
  license: z
    .enum([
      'PUBLIC_DOMAIN',
      'CC_BY',
      'CC_BY_SA',
      'CC_BY_NC',
      'CC_BY_NC_SA',
      'EDUCATIONAL_USE',
      'PERSONAL_USE',
      'ALL_RIGHTS_RESERVED',
      'FAIR_USE',
    ])
    .default('ALL_RIGHTS_RESERVED'),
});

/**
 * Schema for updating an existing recipe
 * All fields are optional since it's a PATCH operation
 */
export const updateRecipeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  ingredients: z.array(z.string()).min(1).optional(),
  instructions: z.array(z.string()).min(1).optional(),
  prep_time: z.number().int().positive().optional(),
  cook_time: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string().url()).max(6).optional(),
  image_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
  is_meal_prep_friendly: z.boolean().optional(),
  nutrition_info: z.record(z.any()).optional(),
  video_url: z.string().url().optional(),
  source: z.string().optional(),
  license: z
    .enum([
      'PUBLIC_DOMAIN',
      'CC_BY',
      'CC_BY_SA',
      'CC_BY_NC',
      'CC_BY_NC_SA',
      'EDUCATIONAL_USE',
      'PERSONAL_USE',
      'ALL_RIGHTS_RESERVED',
      'FAIR_USE',
    ])
    .optional(),
});

/**
 * Schema for listing recipes with query parameters
 */
export const listRecipesQuerySchema = z.object({
  tags: z.string().optional(), // Comma-separated tags
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  cuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  isPublic: z.coerce.boolean().optional(),
});

/**
 * Schema for similar recipes query parameters
 */
export const similarRecipesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.5),
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
 * Paginated recipes response
 */
export const paginatedRecipesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    recipes: z.array(z.any()),
    pagination: paginationMetadataSchema,
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;
export type SimilarRecipesQuery = z.infer<typeof similarRecipesQuerySchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
