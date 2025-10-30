/**
 * Zod validation schemas for API Key Management endpoints
 *
 * Provides request/response validation for API key CRUD operations
 */

import { z } from 'zod';
import { SCOPES } from '@/lib/api-auth/scopes';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All valid scopes for validation
 */
const VALID_SCOPES = Object.values(SCOPES);

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Schema for creating a new API key
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'Name must be 100 characters or less')
    .describe('Human-readable name for the API key'),

  scopes: z
    .array(z.enum(VALID_SCOPES as [string, ...string[]]))
    .min(1, 'At least one scope is required')
    .describe('Array of permission scopes'),

  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .describe('Optional description of the key purpose'),

  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .describe('Optional expiration date (ISO 8601 format)'),
});

/**
 * Schema for updating an existing API key
 * All fields are optional since it's a PATCH operation
 */
export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional().describe('Human-readable name for the API key'),

  scopes: z
    .array(z.enum(VALID_SCOPES as [string, ...string[]]))
    .min(1)
    .optional()
    .describe('Array of permission scopes'),

  description: z.string().max(500).optional().describe('Optional description of the key purpose'),

  expiresAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null) return null;
      if (val === undefined) return undefined;
      return new Date(val);
    })
    .describe('Optional expiration date (ISO 8601 format, null to remove expiration)'),
});

/**
 * Schema for usage query parameters
 */
export const usageQuerySchema = z.object({
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .describe('Start date for usage period (ISO 8601 format)'),

  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .describe('End date for usage period (ISO 8601 format)'),

  endpoint: z.string().optional().describe('Filter by specific endpoint'),

  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(1000)
    .default(100)
    .describe('Maximum number of timeline entries to return'),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * API key metadata (safe for display - no full key)
 */
export const apiKeyMetadataSchema = z.object({
  id: z.string().uuid(),
  keyPrefix: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  lastUsedAt: z.date().nullable(),
  totalRequests: z.number().int(),
  expiresAt: z.date().nullable(),
  environment: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Full API key response (includes actual key - ONLY shown once at creation)
 */
export const createApiKeyResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    apiKey: z.string().describe('⚠️ SHOWN ONLY ONCE - Store securely'),
    keyPrefix: z.string(),
    name: z.string(),
    scopes: z.array(z.string()),
    description: z.string().nullable().optional(),
    expiresAt: z.date().nullable(),
    createdAt: z.date(),
    warning: z.literal('This key will only be shown once. Store it securely.'),
  }),
});

/**
 * List API keys response
 */
export const listApiKeysResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(apiKeyMetadataSchema),
});

/**
 * Single API key response
 */
export const getApiKeyResponseSchema = z.object({
  success: z.literal(true),
  data: apiKeyMetadataSchema,
});

/**
 * Delete API key response
 */
export const deleteApiKeyResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * API key usage statistics response
 */
export const usageStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    keyId: z.string().uuid(),
    totalRequests: z.number().int(),
    period: z.object({
      start: z.date().nullable(),
      end: z.date().nullable(),
    }),
    byEndpoint: z.array(
      z.object({
        endpoint: z.string(),
        count: z.number().int(),
      })
    ),
    byStatus: z.array(
      z.object({
        status: z.number().int(),
        count: z.number().int(),
      })
    ),
    timeline: z.array(
      z.object({
        date: z.string(),
        requests: z.number().int(),
      })
    ),
    averageResponseTime: z.number().optional(),
    errorRate: z.number().min(0).max(1).optional(),
  }),
});

/**
 * Standard error response
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type UsageQueryParams = z.infer<typeof usageQuerySchema>;
export type ApiKeyMetadata = z.infer<typeof apiKeyMetadataSchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
export type ListApiKeysResponse = z.infer<typeof listApiKeysResponseSchema>;
export type GetApiKeyResponse = z.infer<typeof getApiKeyResponseSchema>;
export type DeleteApiKeyResponse = z.infer<typeof deleteApiKeyResponseSchema>;
export type UsageStatsResponse = z.infer<typeof usageStatsResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
