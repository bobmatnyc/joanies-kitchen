/**
 * Zod validation schemas for Favorites API endpoints
 *
 * Provides request/response validation for v1 REST API
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Schema for listing user's favorites (query parameters)
 */
export const listFavoritesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'name', 'updated_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schema for validating recipe ID parameter
 */
export const recipeIdParamSchema = z.object({
  // #308: guid() is zod v3's uuid() check; v4 uuid() also requires RFC version/variant bits
  recipeId: z.string().guid('Invalid recipe ID format'),
});

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuerySchema>;
export type RecipeIdParam = z.infer<typeof recipeIdParamSchema>;
