/**
 * Zod validation schemas for Collection API endpoints
 *
 * Provides request/response validation for v1 REST API collection operations
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS - COLLECTIONS
// ============================================================================

/**
 * Schema for creating a new collection
 */
export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required').max(200),
  description: z.string().max(1000).optional(),
  is_public: z.boolean().default(false),
  cover_image_url: z.string().url().optional(),
});

/**
 * Schema for updating an existing collection
 * All fields are optional since it's a PATCH operation
 */
export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  is_public: z.boolean().optional(),
  cover_image_url: z.string().url().optional(),
});

/**
 * Schema for listing collections with query parameters
 */
export const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'recipe_count']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  isPublic: z.coerce.boolean().optional(),
});

/**
 * Schema for adding a recipe to a collection
 */
export const addRecipeToCollectionSchema = z.object({
  recipeId: z.string().min(1, 'Recipe ID is required'),
  personalNote: z.string().max(500).optional(),
});

/**
 * Schema for listing recipes in a collection
 */
export const listCollectionRecipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
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
 * Paginated collections response
 */
export const paginatedCollectionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    collections: z.array(z.any()),
    pagination: paginationMetadataSchema,
  }),
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

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type ListCollectionsQuery = z.infer<typeof listCollectionsQuerySchema>;
export type AddRecipeToCollectionInput = z.infer<typeof addRecipeToCollectionSchema>;
export type ListCollectionRecipesQuery = z.infer<typeof listCollectionRecipesQuerySchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
