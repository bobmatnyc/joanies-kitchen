/**
 * REST API v1 - Inventory Collection Endpoints
 *
 * GET    /api/v1/inventory - List user's inventory items with filters
 * POST   /api/v1/inventory - Add item to inventory
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiSuccess,
  apiSuccessPaginated,
  applyPagination,
  applySorting,
  parseJsonBody,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { inventoryService } from '@/lib/services/inventory-service';
import {
  createInventoryItemSchema,
  listInventoryQuerySchema,
} from '@/lib/validations/inventory-api';

/**
 * GET /api/v1/inventory
 *
 * List inventory items for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, expiry_date)
 * - order: Sort order (asc, desc)
 * - storage: Filter by storage location (fridge, freezer, pantry, other)
 * - status: Filter by status (fresh, use_soon, expiring, expired, used, wasted)
 * - expiringWithinDays: Filter items expiring within N days
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     items: InventoryItem[],
 *     pagination: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number,
 *       hasMore: boolean
 *     }
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:inventory scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_INVENTORY], async (request: NextRequest, auth) => {
  try {
    // Ensure user is authenticated
    if (!auth.userId) {
      return apiError('User not authenticated', 401);
    }

    // Parse and validate query parameters
    const parsed = parseQueryParams(request, listInventoryQuerySchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedQuery } = parsed;

    // Build filters for service layer
    const filters: {
      storage?: any;
      status?: any;
      expiringWithinDays?: number;
    } = {};

    if (validatedQuery.storage) {
      filters.storage = validatedQuery.storage;
    }

    if (validatedQuery.status) {
      filters.status = validatedQuery.status;
    }

    if (validatedQuery.expiringWithinDays !== undefined) {
      filters.expiringWithinDays = validatedQuery.expiringWithinDays;
    }

    // Fetch inventory items from service
    const items = await inventoryService.findByUserId(auth.userId, filters);

    // Service already sorts by expiry_date, but respect user's sort preference
    let sortedItems = items;
    if (validatedQuery.sortBy && validatedQuery.sortBy !== 'expiry_date') {
      sortedItems = applySorting(items, validatedQuery.sortBy, validatedQuery.order!);
    } else if (validatedQuery.order === 'desc') {
      // Reverse order if descending requested for expiry_date
      sortedItems = [...items].reverse();
    }

    // Apply pagination
    const { items: paginatedItems, total } = applyPagination(
      sortedItems,
      validatedQuery.page!,
      validatedQuery.limit!
    );

    return apiSuccessPaginated(paginatedItems, validatedQuery.page!, validatedQuery.limit!, total);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return apiError('Internal server error');
  }
});

/**
 * POST /api/v1/inventory
 *
 * Add a new item to the user's inventory
 *
 * Request Body:
 * {
 *   ingredient_id: string (UUID),
 *   storage_location: 'fridge' | 'freezer' | 'pantry' | 'other',
 *   quantity: number,
 *   unit: string,
 *   expiry_date?: Date,
 *   cost_usd?: number,
 *   notes?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: InventoryItem
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing write:inventory scope)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const POST = requireScopes([SCOPES.WRITE_INVENTORY], async (request: NextRequest, auth) => {
  try {
    // Ensure user is authenticated
    if (!auth.userId) {
      return apiError('User not authenticated', 401);
    }

    // Parse and validate request body
    const parsed = await parseJsonBody(request, createInventoryItemSchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedData } = parsed;

    // Transform numeric fields to strings for database compatibility
    const createData = {
      ...validatedData,
      quantity: validatedData.quantity.toString(),
      cost_usd: validatedData.cost_usd?.toString(),
    };

    // Create inventory item using service
    const newItem = await inventoryService.create(auth.userId, createData);

    return apiSuccess(newItem, 201);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return apiError('Internal server error');
  }
});
