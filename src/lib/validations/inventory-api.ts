/**
 * Zod validation schemas for Inventory API endpoints
 *
 * Provides request/response validation for v1 REST API inventory operations
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const storageLocationEnum = z.enum(['fridge', 'freezer', 'pantry', 'other']);

export const inventoryStatusEnum = z.enum([
  'fresh',
  'use_soon',
  'expiring',
  'expired',
  'used',
  'wasted',
]);

export const usageActionEnum = z.enum([
  'cooked',
  'eaten_raw',
  'composted',
  'trashed',
  'donated',
]);

// ============================================================================
// REQUEST SCHEMAS - INVENTORY ITEMS
// ============================================================================

/**
 * Schema for creating a new inventory item
 */
export const createInventoryItemSchema = z.object({
  ingredient_id: z.string().uuid('Invalid ingredient ID'),
  storage_location: storageLocationEnum,
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(50),
  expiry_date: z.coerce.date().optional(),
  cost_usd: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Schema for updating an existing inventory item
 * All fields are optional since it's a PATCH operation
 */
export const updateInventoryItemSchema = z.object({
  storage_location: storageLocationEnum.optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.string().min(1).max(50).optional(),
  expiry_date: z.coerce.date().optional(),
  cost_usd: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
  status: inventoryStatusEnum.optional(),
});

/**
 * Schema for listing inventory items with query parameters
 */
export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'expiry_date']).default('expiry_date'),
  order: z.enum(['asc', 'desc']).default('asc'),
  storage: storageLocationEnum.optional(),
  status: inventoryStatusEnum.optional(),
  expiringWithinDays: z.coerce.number().int().positive().max(30).optional(),
});

/**
 * Schema for marking an item as used
 */
export const markAsUsedSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  action: usageActionEnum.default('cooked'),
  recipe_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Schema for recipe matching query parameters
 */
export const matchRecipesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  minMatchPercentage: z.coerce.number().int().min(0).max(100).default(50),
  prioritizeExpiring: z.coerce.boolean().default(false),
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
 * Paginated inventory response
 */
export const paginatedInventoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(z.any()),
    pagination: paginationMetadataSchema,
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type MarkAsUsedInput = z.infer<typeof markAsUsedSchema>;
export type MatchRecipesQuery = z.infer<typeof matchRecipesQuerySchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
