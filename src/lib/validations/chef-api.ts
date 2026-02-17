/**
 * Zod validation schemas for Chef API endpoints
 *
 * Provides request/response validation for v1 REST API
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Schema for creating a new chef
 */
export const createChefSchema = z.object({
  slug: z
    .string()
    .min(1, 'Chef slug is required')
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1, 'Chef name is required').max(255),
  display_name: z.string().max(255).optional(),
  bio: z.string().optional(),
  profile_image_url: z.string().url().optional(),
  website: z.string().url().optional(),
  social_links: z
    .object({
      instagram: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
      facebook: z.string().url().optional(),
    })
    .optional(),
  specialties: z.array(z.string()).optional(),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
  // Location data
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  location_city: z.string().max(100).optional(),
  location_state: z.string().max(50).optional(),
  location_country: z.string().max(50).optional(),
});

/**
 * Schema for updating an existing chef
 * All fields are optional since it's a PATCH operation
 */
export const updateChefSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .optional(),
  name: z.string().min(1).max(255).optional(),
  display_name: z.string().max(255).optional(),
  bio: z.string().optional(),
  profile_image_url: z.string().url().optional(),
  website: z.string().url().optional(),
  social_links: z
    .object({
      instagram: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
      facebook: z.string().url().optional(),
    })
    .optional(),
  specialties: z.array(z.string()).optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
  // Location data
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  location_city: z.string().max(100).optional(),
  location_state: z.string().max(50).optional(),
  location_country: z.string().max(50).optional(),
});

/**
 * Schema for listing chefs with query parameters
 */
export const listChefsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'recipe_count']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  includeInactive: z.coerce.boolean().default(false),
});

/**
 * Schema for listing chef recipes with query parameters
 */
export const listChefRecipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateChefInput = z.infer<typeof createChefSchema>;
export type UpdateChefInput = z.infer<typeof updateChefSchema>;
export type ListChefsQuery = z.infer<typeof listChefsQuerySchema>;
export type ListChefRecipesQuery = z.infer<typeof listChefRecipesQuerySchema>;
